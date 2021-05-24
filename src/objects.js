import {
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { makeGrpcFetchApplied } from "./directives.js";
import { isProtoEnum, makeEnum } from "./enums.js";
import { ProtoService } from "./protos.js";
import { isProtoScalar, protoScalarToGraphQL } from "./scalars.js";

class TypeRecorder {
  /** @type {Map<string, import("graphql").GraphQLType>} */
  #map = new Map();
  #seen = new Set();

  markSeen(name) {
    this.#seen.add(name);
  }

  hasSeen(name) {
    return this.#seen.has(name);
  }

  get(name) {
    return this.#map.get(name);
  }

  add(name, type) {
    if (this.#map.has(name)) return;
    this.#map.set(name, type);
    this.#seen.add(name);
  }
}

/**
 * @param {ProtoService[]} services
 */
export function makeMutationType(services) {
  const acc = new TypeRecorder();

  /** @type {[string, import("graphql").GraphQLFieldConfig<*,*>][]} */
  const entries = [];

  for (const service of services) {
    const rpcs = service.service;
    for (const [name, def] of Object.entries(rpcs)) {
      entries.push([
        name,
        {
          type: GraphQLNonNull(
            createResponseType(def.responseType, service, acc)
          ),
          args: createRequestArgs(def.requestType, service, acc),
          astNode: {
            kind: "FieldDefinition",
            name: { kind: "Name", value: name },
            type: dummyTypeASTNode,
            directives: [
              makeGrpcFetchApplied({
                service: service.name,
                rpc: name,
              }),
            ],
          },
        },
      ]);
    }
  }

  return new GraphQLObjectType({
    name: "Mutation",
    fields: Object.fromEntries(entries),
  });
}

export function makeDummyQueryType() {
  return new GraphQLObjectType({
    name: "Query",
    fields: { _removeMe: { type: GraphQLString } },
  });
}

/**
 * @param {import("@grpc/proto-loader").MessageTypeDefinition} requestType
 * @param {ProtoService} service
 * @param {TypeRecorder} acc
 * @returns {import("graphql").GraphQLFieldConfigArgumentMap}
 */
function createRequestArgs(requestType, service, acc) {
  const entries = requestType.type.field.map((field) => {
    const type = createInputType(field, requestType.type, service, acc);
    return [field.name, { type }];
  });

  return Object.fromEntries(entries);
}

/**
 * @param {{ type: string; typeName: string; label: string; name: string; }} field
 * @param {{ enumType: any[]; name: string; }} parentType
 * @param {TypeRecorder} acc
 * @param {ProtoService} service
 */
function createInputType(field, parentType, service, acc) {
  const newType = (() => {
    if (isProtoScalar(field.type)) {
      return protoScalarToGraphQL(field);
    }

    if (isProtoEnum(field.type)) {
      const newEnum = makeEnum(field.typeName, parentType, service);
      if (acc.hasSeen(newEnum.name)) return acc.get(newEnum.name);
      acc.add(newEnum.name, newEnum);
      return newEnum;
    }

    const nestedType = parentType.nestedType.find(
      (t) => t.name === field.typeName
    );
    const protoType = nestedType ?? service.getType(field.typeName);
    if (!protoType) throw new Error(`Type "${field.typeName}" missing`); // TODO look for nested types

    const newInputTypeName = `${nestedType ? parentType.name + "_" : ""}${
      field.typeName
    }Input`;
    // stop recursion if we've seen this before
    if (acc.hasSeen(newInputTypeName)) return acc.get(newInputTypeName);
    acc.markSeen(newInputTypeName);

    const type = new GraphQLInputObjectType({
      name: newInputTypeName,
      fields: () => {
        const entries = protoType.field.map((f) => {
          return [
            f.name,
            { type: createInputType(f, protoType, service, acc) },
          ];
        });
        return Object.fromEntries(entries);
      },
    });

    acc.add(newInputTypeName, type);

    return type;
  })();

  if (field.label === "LABEL_REPEATED") {
    return newType && GraphQLList(newType);
  }

  return newType;
}

/**
 * @param {import("@grpc/proto-loader").MessageTypeDefinition} responseType
 * @param {ProtoService} service
 * @param {TypeRecorder} acc
 */
function createResponseType(responseType, service, acc) {
  const entries = responseType.type.field.map((field) => {
    const type = createOutputType(field, responseType.type, service, acc);
    return [field.name, { type }];
  });

  return new GraphQLObjectType({
    name: responseType.type.name,
    fields: Object.fromEntries(entries),
  });
}

/**
 * @param {{ type: string; typeName: string; label: string; name: string; }} field
 * @param {{ enumType: any[]; name: string; }} parentType
 * @param {TypeRecorder} acc
 * @param {ProtoService} service
 */
function createOutputType(field, parentType, service, acc) {
  const newType = (() => {
    if (isProtoScalar(field.type)) {
      return protoScalarToGraphQL(field);
    }

    if (isProtoEnum(field.type)) {
      const newEnum = makeEnum(field.typeName, parentType, service);
      if (acc.hasSeen(newEnum.name)) return acc.get(newEnum.name);
      acc.add(newEnum.name, newEnum);
      return newEnum;
    }

    const nestedType = parentType.nestedType.find(
      (t) => t.name === field.typeName
    );
    const protoType = nestedType ?? service.getType(field.typeName);
    if (!protoType) throw new Error(`Type "${field.typeName}" missing`);

    const newTypeName = `${nestedType ? parentType.name + "_" : ""}${
      field.typeName
    }`;

    // stop recursion if we've seen this before
    if (acc.hasSeen(newTypeName)) {
      return acc.get(newTypeName);
    }

    acc.markSeen(newTypeName);

    const type = new GraphQLObjectType({
      name: newTypeName,
      fields: () => {
        const entries = protoType.field.map((f) => {
          return [
            f.name,
            { type: createOutputType(f, protoType, service, acc) },
          ];
        });
        return Object.fromEntries(entries);
      },
    });

    acc.add(newTypeName, type);

    return type;
  })();

  if (field.label === "LABEL_REPEATED") {
    return newType && GraphQLList(newType);
  }

  return newType;
}

// ts sometimes requires an AST node that's actually just ignored
/** @type {{ kind: "NamedType"; name: { kind: "Name", value: string; }}} */
const dummyTypeASTNode = {
  kind: "NamedType",
  name: { kind: "Name", value: GraphQLInt.name },
};

/**
 * @param {{ typeName: any; }} field
 * @param {any | { nestedType: { name: string; }[] }} parentType
 * @param {ProtoService} service
 */
export function findTypeForField(field, parentType, service) {
  const nestedType = parentType.nestedType.find(
    (t) => t.name === field.typeName
  );
  return nestedType ?? service.getType(field.typeName);
}
