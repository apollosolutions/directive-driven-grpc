/**
 * @param {string} additional
 */
export function generateSdl(additional) {
  return `#graphql
  directive @grpc(
    protoFile: String!
    serviceName: String!
    address: String!
    metadata: [grpc__Metadata!]
  ) on ENUM_VALUE

  input grpc__Metadata {
    name: String!
    value: String
    valueFrom: String
  }

  directive @grpc__renamed(
    from: String!
  ) on FIELD_DEFINITION | ARGUMENT_DEFINITION | ENUM_VALUE | INPUT_FIELD_DEFINITION

  directive @grpc__wrap(
    gql: String!
    proto: String!
  ) repeatable on FIELD_DEFINITION

  directive @grpc__fetch(
    service: grpc__Service!
    rpc: String!
    dig: String
    mapArguments: [grpc__InputMap!]
    dataloader: grpc__Dataloader
  ) on FIELD_DEFINITION | OBJECT

  input grpc__InputMap {
    sourceField: String!
    arg: String!
  }

  input grpc__Dataloader {
    key: String!
    listArgument: String!
    responseKey: String
  }

  enum grpc__Service {
    POSTS
      @grpc(
        protoFile: "test/__fixtures__/posts.proto"
        serviceName: "Posts"
        address: "localhost:50002"
      )
  }

  ${additional}
  `;
}
