import { getDirectives } from "@graphql-tools/utils";
import {
  defaultFieldResolver,
  getNamedType,
  GraphQLEnumType,
  GraphQLSchema,
  isEnumType,
} from "graphql";
import { get } from "lodash-es";
import Dataloader from "dataloader";
import { ProtoService } from "./protos";

/**
 * @param {Map<string, import("./protos").ProtoService>} services
 * @returns {import("graphql").GraphQLFieldResolver<any, any, { [argName: string]: any; }>}
 */
export function makeFieldResolver(services) {
  return async (source, args, ctx, info) => {
    const { grpc__fetch, grpc__rename, grpc__wrap, grpc__fetchBatch } =
      getFieldDirectives(info);

    if (grpc__fetchBatch) {
      const dataloaderName = getNamedType(info.returnType).name;
      const dataloader = getDataloader(
        ctx,
        dataloaderName,
        grpc__fetchBatch,
        services
      );
      return dataloader.load(
        resolveDataloaderKey(source, args, grpc__fetchBatch)
      );
    }

    if (grpc__fetch) {
      const { service, rpc, dig, input } = grpc__fetch;

      applyArgumentRenames(info, args);

      if (input) {
        args = convertInputArgs(input, source);
      }

      const resp = await services.get(service)?.call(rpc, args);

      if (dig) {
        return get(resp, dig);
      }

      return resp;
    }

    if (grpc__rename) {
      const { to } = grpc__rename;
      return source[to];
    }

    if (grpc__wrap?.length > 0) {
      /**
       * @param {{ [key: string]: any }} wrapper
       * @param {{ gql: string; proto: string; }} directive
       * @returns {{ [key: string]: any }}
       */
      const reducer = (wrapper, { gql, proto }) =>
        Object.assign(wrapper, {
          [gql]: source[proto],
        });
      return grpc__wrap.reduce(reducer, {});
    }

    const namedReturnType = getNamedType(info.returnType);
    if (isEnumType(namedReturnType)) {
      const map = renamedEnumValueMap(info.schema, namedReturnType);
      return map[defaultFieldResolver(source, args, ctx, info)];
    }

    return defaultFieldResolver(source, args, ctx, info);
  };
}

/**
 * @param {import("graphql").GraphQLResolveInfo} info
 * @param {{ [x: string]: any; }} args
 */
function applyArgumentRenames(info, args) {
  const directives = getArgumentDirectives(info);
  for (const [name, { grpc__rename }] of Object.entries(directives)) {
    if (grpc__rename) {
      const { to } = grpc__rename;
      args[to] = args[name];
      delete args[name];
    }
  }
}

/**
 * @param {string[]} inputMaps
 * @param {any} source
 */
function convertInputArgs(inputMaps, source) {
  const pairs = inputMaps.map((pair) =>
    pair.split(/\s=>\s/).map((s) => s.trim())
  );

  return pairs.reduce((acc, [gql, proto]) => {
    return Object.assign(acc, {
      [proto]: get({ $source: source }, gql),
    });
  }, {});
}

/**
 * @param {import("graphql").GraphQLResolveInfo} info
 */
function getFieldDirectives(info) {
  return getDirectives(
    info.schema,
    info.parentType.getFields()[info.fieldName]
  );
}

/**
 * @param {import("graphql").GraphQLResolveInfo} info
 */
function getArgumentDirectives(info) {
  const field = info.parentType.getFields()[info.fieldName];

  if (!field) return;

  const entries = field.args.map((arg) => {
    return [arg.name, getDirectives(info.schema, arg)];
  });

  return Object.fromEntries(entries);
}

/**
 * @param {GraphQLSchema} schema
 * @param {GraphQLEnumType} enumType
 */
function renamedEnumValueMap(schema, enumType) {
  /** @type {{ [key:string]: string }} */
  const map = {};
  for (const value of enumType.getValues()) {
    const { grpc__rename } = getDirectives(schema, value);
    if (grpc__rename) {
      map[grpc__rename.to] = value.name;
    } else {
      map[value.name] = value.name;
    }
  }
  return map;
}

const dataloaderWeakMap = new WeakMap();

/**
 * @param {any} ctx
 * @param {string} dataloaderKey
 * @param {any} grpc__fetchBatch
 * @param {Map<string, ProtoService>} services
 * @returns {Dataloader<*, *>}
 */
function getDataloader(ctx, dataloaderKey, grpc__fetchBatch, services) {
  if (!ctx) {
    throw new Error("You must set a context to use dataloaders");
  }

  if (!dataloaderWeakMap.has(ctx)) {
    dataloaderWeakMap.set(ctx, new Map());
  }

  if (!dataloaderWeakMap.get(ctx).has(dataloaderKey)) {
    dataloaderWeakMap.get(ctx).set(
      dataloaderKey,
      new Dataloader(async (keys) => {
        const { service, rpc, dig, responseKey, listArgument } =
          grpc__fetchBatch;

        const args = { [listArgument]: keys };

        let resp = await services.get(service)?.call(rpc, args);

        if (dig) {
          resp = get(resp, dig);
        }

        if (responseKey) {
          return keys.map((key) =>
            resp.find((item) => item[responseKey] === key)
          );
        }

        return resp;
      })
    );
  }

  return dataloaderWeakMap.get(ctx).get(dataloaderKey);
}

/**
 *
 * @param {any} source
 * @param {any} args
 * @param {{ key: string }} grpc__fetchBatch
 * @returns {any}
 */
function resolveDataloaderKey(source, args, grpc__fetchBatch) {
  return get(
    {
      $source: source,
      $args: args,
    },
    grpc__fetchBatch.key
  );
}
