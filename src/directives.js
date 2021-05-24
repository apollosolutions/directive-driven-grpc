import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";

export const coreExperimental = new GraphQLDirective({
  name: "coreExperimental",
  isRepeatable: true,
  locations: [DirectiveLocation.SCHEMA],
  args: {
    feature: {
      type: GraphQLNonNull(GraphQLString),
    },
    as: {
      type: GraphQLString,
    },
  },
});

/** @type {import("graphql").DirectiveNode} */
export const coreExperimentalApplied = {
  kind: "Directive",
  name: { kind: "Name", value: coreExperimental.name },
  arguments: [
    {
      kind: "Argument",
      name: { kind: "Name", value: "feature" },
      value: { kind: "StringValue", value: "https://notareal.spec/core/v0.1" },
    },
  ],
};

/** @type {import("graphql").DirectiveNode} */
export const grpcFeatureApplied = {
  kind: "Directive",
  name: { kind: "Name", value: coreExperimental.name },
  arguments: [
    {
      kind: "Argument",
      name: { kind: "Name", value: "feature" },
      value: { kind: "StringValue", value: "https://notareal.spec/grpc/v0.1" },
    },
  ],
};

export const grpc = new GraphQLDirective({
  name: "grpc",
  locations: [DirectiveLocation.ENUM_VALUE],
  args: {
    protoFile: { type: GraphQLNonNull(GraphQLString) },
    serviceName: { type: GraphQLNonNull(GraphQLString) },
    address: { type: GraphQLNonNull(GraphQLString) },
  },
});

/**
 * @param {{ protoFile: string; serviceName: string; address: string }} param0
 * @returns {import("graphql").DirectiveNode}
 */
export function makeGrpcApplied({ protoFile, serviceName, address }) {
  return {
    kind: "Directive",
    name: { kind: "Name", value: grpc.name },
    arguments: [
      {
        kind: "Argument",
        name: { kind: "Name", value: "protoFile" },
        value: { kind: "StringValue", value: protoFile },
      },
      {
        kind: "Argument",
        name: { kind: "Name", value: "serviceName" },
        value: { kind: "StringValue", value: serviceName },
      },
      {
        kind: "Argument",
        name: { kind: "Name", value: "address" },
        value: { kind: "StringValue", value: address },
      },
    ],
  };
}

/**
 * @param {import("graphql").GraphQLEnumType} serviceEnum
 */
export function makeGrpcFetch(serviceEnum) {
  return new GraphQLDirective({
    name: "grpc__fetch",
    locations: [DirectiveLocation.FIELD_DEFINITION],
    args: {
      service: {
        type: GraphQLNonNull(serviceEnum),
      },
      rpc: { type: GraphQLNonNull(GraphQLString) },
      dig: { type: GraphQLString },
      input: { type: GraphQLList(GraphQLNonNull(GraphQLString)) },
    },
  });
}

/**
 * @param {{ service: string; rpc: string; }} params
 * @returns {import("graphql").DirectiveNode}
 */
export function makeGrpcFetchApplied({ service, rpc }) {
  return {
    kind: "Directive",
    name: { kind: "Name", value: "grpc__fetch" },
    arguments: [
      {
        kind: "Argument",
        name: { kind: "Name", value: "service" },
        value: { kind: "EnumValue", value: service },
      },
      {
        kind: "Argument",
        name: { kind: "Name", value: "rpc" },
        value: { kind: "StringValue", value: rpc },
      },
    ],
  };
}

export const grpcRename = new GraphQLDirective({
  name: "grpc__rename",
  locations: [
    DirectiveLocation.FIELD_DEFINITION,
    DirectiveLocation.ARGUMENT_DEFINITION,
    DirectiveLocation.ENUM_VALUE,
    DirectiveLocation.INPUT_FIELD_DEFINITION,
  ],
  args: {
    to: { type: GraphQLNonNull(GraphQLString) },
  },
});

export const grpcWrap = new GraphQLDirective({
  name: "grpc__wrap",
  locations: [DirectiveLocation.FIELD_DEFINITION],
  isRepeatable: true,
  args: {
    gql: { type: GraphQLNonNull(GraphQLString) },
    proto: { type: GraphQLNonNull(GraphQLString) },
  },
});
