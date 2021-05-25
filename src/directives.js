import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";

const grpcMetadata = new GraphQLInputObjectType({
  name: "grpc__Metadata",
  fields: {
    name: { type: GraphQLNonNull(GraphQLString) },
    value: { type: GraphQLString },
    valueFrom: { type: GraphQLString },
  },
});

export const grpc = new GraphQLDirective({
  name: "grpc",
  locations: [DirectiveLocation.ENUM_VALUE],
  args: {
    protoFile: { type: GraphQLNonNull(GraphQLString) },
    serviceName: { type: GraphQLNonNull(GraphQLString) },
    address: { type: GraphQLNonNull(GraphQLString) },
    metadata: { type: GraphQLList(GraphQLNonNull(grpcMetadata)) },
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
    locations: [DirectiveLocation.FIELD_DEFINITION, DirectiveLocation.OBJECT],
    args: {
      service: {
        type: GraphQLNonNull(serviceEnum),
      },
      rpc: { type: GraphQLNonNull(GraphQLString) },
      dig: { type: GraphQLString },
      mapArguments: { type: GraphQLList(GraphQLNonNull(grpcInputMapType)) },
      dataloader: { type: grpcDataloader },
    },
  });
}

export const grpcInputMapType = new GraphQLInputObjectType({
  name: "grpc__InputMap",
  fields: {
    sourceField: { type: GraphQLNonNull(GraphQLString) },
    arg: { type: GraphQLNonNull(GraphQLString) },
  },
});

export const grpcDataloader = new GraphQLInputObjectType({
  name: "grpc__Dataloader",
  fields: {
    key: { type: GraphQLNonNull(GraphQLString) },
    listArgument: { type: GraphQLNonNull(GraphQLString) },
    responseKey: { type: GraphQLString },
  },
});

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
  name: "grpc__renamed",
  locations: [
    DirectiveLocation.FIELD_DEFINITION,
    DirectiveLocation.ARGUMENT_DEFINITION,
    DirectiveLocation.ENUM_VALUE,
    DirectiveLocation.INPUT_FIELD_DEFINITION,
  ],
  args: {
    from: { type: GraphQLNonNull(GraphQLString) },
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
