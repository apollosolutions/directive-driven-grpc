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
import { ProtoService } from "./protos.js";

/**
 * @param {Map<string, import("./protos").ProtoService>} services
 * @returns {import("graphql").GraphQLFieldResolver<any, any, { [argName: string]: any; }>}
 */
export function makeFieldResolver(services) {
  return async (source, args, ctx, info) => {
    if (isEntityQuery(info)) {
      return resolveEntities(
        source,
        /** @type {import("./typings.js").EntityArgs} */ (args),
        ctx,
        info,
        services
      );
    }

    const { grpc__fetch, grpc__renamed, grpc__wrap } = getFieldDirectives(info);

    if (grpc__fetch) {
      return resolveFetch(source, args, ctx, info, grpc__fetch, services);
    }

    if (grpc__renamed) {
      const { from } = grpc__renamed;
      return source[from];
    }

    if (grpc__wrap?.length > 0) {
      return Object.fromEntries(
        /** @type {{ gql: string; proto: string }[]} */
        (grpc__wrap).map(({ gql, proto }) => [gql, source[proto]])
      );
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
 * @template TSource, TArgs, TContext
 * @param {TSource} source
 * @param {TArgs} args
 * @param {TContext} ctx
 * @param {import("graphql").GraphQLResolveInfo} info
 * @param {import("./typings.js").FetchDirective} directive
 * @param {Map<string, ProtoService>} services
 * @param {string?} [dataloaderKey]
 */
async function resolveFetch(
  source,
  args,
  ctx,
  info,
  directive,
  services,
  dataloaderKey
) {
  const {
    service,
    rpc,
    dig,
    mapArguments,
    dataloader: dataloaderParams,
  } = directive;

  const grpcService = services.get(service);
  if (!grpcService) throw new Error(`service ${service} not found`);

  const call = (/** @type {any} */ args) => grpcService.call(rpc, args, ctx);

  if (dataloaderParams) {
    const dataloaderName = dataloaderKey ?? getNamedType(info.returnType).name;
    const dataloader = getDataloader(ctx, dataloaderName, directive, call);
    return dataloader.load(
      resolveDataloaderKey(source, args, dataloaderParams)
    );
  }

  applyArgumentRenames(info, args);

  if (mapArguments) {
    args = /** @type {TArgs} */ (convertInputArgs(mapArguments, source));
  }

  const resp = await call(args);

  return dig ? get(resp, dig) : resp;
}

/**
 * @param {import("graphql").GraphQLResolveInfo} info
 */
function isEntityQuery(info) {
  return (
    info.parentType === info.schema.getQueryType() &&
    info.fieldName === "_entities"
  );
}

/**
 * @template {import("./typings.js").EntityArgs} TArgs
 *
 * @template TSource, TContext
 * @param {TSource} source
 * @param {TArgs} args
 * @param {TContext} ctx
 * @param {import("graphql").GraphQLResolveInfo} info
 * @param {Map<string, ProtoService>} services
 */
function resolveEntities(source, args, ctx, info, services) {
  return Promise.all(
    args.representations.map((representation) => {
      const { __typename } = representation;

      const type = info.schema.getType(__typename);
      if (!type) throw new Error(`${__typename} not found`);

      const { grpc__fetch } = getDirectives(info.schema, type);
      if (!grpc__fetch) return representation;

      return resolveFetch(
        source,
        representation,
        ctx,
        info,
        grpc__fetch,
        services,
        __typename // otherwise the key is _Entity
      ).then((res) => ({ ...representation, ...res, __typename }));
    })
  );
}

/**
 * Mutates args
 * @param {import("graphql").GraphQLResolveInfo} info
 * @param {{ [x: string]: any; }} args
 */
function applyArgumentRenames(info, args) {
  const directives = getArgumentDirectives(info);

  for (const [name, { grpc__renamed }] of Object.entries(directives)) {
    if (grpc__renamed) {
      const { from } = grpc__renamed;
      args[from] = args[name];
      delete args[name];
    }
  }

  const field = info.parentType.getFields()[info.fieldName];

  for (const arg of field.args) {
    const enumType = getNamedType(arg.type);
    if (isEnumType(enumType)) {
      const renames = reverseRenamedEnumValueMap(info.schema, enumType);
      args[arg.name] = renames[args[arg.name]];
    }
  }
}

/**
 * @template T
 * @param {{ sourceField: string; arg: string; }[]} inputMaps
 * @param {T} source
 */
function convertInputArgs(inputMaps, source) {
  return Object.fromEntries(
    inputMaps.map(({ sourceField, arg }) => [arg, get(source, sourceField)])
  );
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
    const { grpc__renamed } = getDirectives(schema, value);
    if (grpc__renamed) {
      map[grpc__renamed.from] = value.name;
    } else {
      map[value.name] = value.name;
    }
  }
  return map;
}

/**
 * @param {GraphQLSchema} schema
 * @param {GraphQLEnumType} enumType
 */
function reverseRenamedEnumValueMap(schema, enumType) {
  return Object.fromEntries(
    Object.entries(renamedEnumValueMap(schema, enumType)).map(
      ([proto, gql]) => [gql, proto]
    )
  );
}

const dataloaderWeakMap = new WeakMap();

/**
 * @param {any} ctx
 * @param {string} dataloaderKey
 * @param {import("./typings.js").FetchDirective} directive
 * @param {(_: any) => Promise<any>} call
 * @returns {Dataloader<*, *>}
 */
function getDataloader(ctx, dataloaderKey, directive, call) {
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
        const { dig, dataloader } = directive;
        const { responseKey, listArgument } =
          /** @type {import("./typings.js").DataloaderParams} */ (dataloader);

        const args = { [listArgument]: keys };

        let resp = await call(args);

        if (dig) {
          resp = get(resp, dig);
        }

        if (responseKey) {
          return keys.map((key) =>
            /** @type {any[]} */
            (resp).find((item) => item[responseKey] === key)
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
 * @param {import("./typings.js").DataloaderParams} dataloaderParams
 * @returns {any}
 */
function resolveDataloaderKey(source, args, { key }) {
  return get({ $source: source, $args: args }, key);
}
