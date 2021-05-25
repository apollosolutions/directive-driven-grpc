import { buildSchema, graphql } from "graphql";
import { print } from "../src/errors.js";
import { makeFieldResolver } from "../src/execute.js";
import { convertFederationSdl, loadString } from "../src/graphql.js";
import { findServices } from "../src/protos.js";
import { validate } from "../src/validate.js";
import { run } from "./__fixtures__/posts.js";

test("entities", async () => {
  const schema = buildSchema(
    convertFederationSdl(
      generateSdl(`#graphql
  type Query {
    posts: [Post] @grpc__fetch(service: POSTS, rpc: "ListPosts", dig: "posts")
  }

  type Post @key(fields: "id")
    @grpc__fetch(
      service: POSTS
      rpc: "BatchGetPosts"
      dig: "posts"
      dataloader: {
        key: "$args.id"
        listArgument: "ids"
        responseKey: "id"
      }
    ) {
    id: ID
    title: String
  }

  type Author @key(fields: "id")       
    @grpc__fetch(
      service: POSTS
      rpc: "BatchGetAuthors"
      dig: "authors"
      dataloader: {
        key: "$args.id"
        listArgument: "ids"
        responseKey: "id"
      }
    ) {
    id: ID
    name: String
  }`)
    )
  );

  const services = findServices(schema, { cwd: process.cwd() });

  const [requests, stopGrpc] = await run(50003);

  const result = await graphql({
    schema,
    source: `{ 
      _entities(representations: [
        { __typename: "Post" id: "2" },
        { __typename: "Author" id: "1" },
        { __typename: "Post" id: "1" },
      ]) {
        ... on Post {
          id title
        }
        ... on Author {
          id name
        }
      }
    }`,
    fieldResolver: makeFieldResolver(services),
    contextValue: {},
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "_entities": Array [
          Object {
            "id": "2",
            "title": "Post 2",
          },
          Object {
            "id": "1",
            "name": "Author 1",
          },
          Object {
            "id": "1",
            "title": "Post 1",
          },
        ],
      },
    }
  `);

  expect(requests).toMatchInlineSnapshot(`
    Array [
      Array [
        "BatchGetPosts",
        Object {
          "ids": Array [
            "2",
            "1",
          ],
        },
      ],
      Array [
        "BatchGetAuthors",
        Object {
          "ids": Array [
            "1",
          ],
        },
      ],
    ]
  `);

  await stopGrpc();
});

describe("validation", () => {
  test("missing field", async () => {
    const sdl = generateSdl(`#graphql
      type Post @key(fields: "id")
        @grpc__fetch(
          service: POSTS
          rpc: "BatchGetPosts"
          dig: "posts"
          dataloader: {
            key: "$args.id"
            listArgument: "ids"
            responseKey: "id"
          }
        ) {
        id: ID
        name: String # incorrect name
        title: Int # incorrect type
      }
    `);

    expect(
      validate(loadString(sdl, { federated: true, cwd: process.cwd() })).map(
        print
      )
    ).toMatchInlineSnapshot(`
      Array [
        "[ERROR] Post.name not found
              Query._entities:[_Entity]! calls Posts/BatchGetPosts
               ⌙ Post.name -> Post
      ",
        "[ERROR] Post.title returns a Int, but Post.title returns a TYPE_STRING
              Query._entities:[_Entity]! calls Posts/BatchGetPosts
               ⌙ Post.title -> Post
      ",
      ]
    `);
  });

  test("incorrect dig", async () => {
    const sdl = generateSdl(`#graphql
      type Post @key(fields: "id")
        @grpc__fetch(
          service: POSTS
          rpc: "BatchGetPosts"
          dig: "XXX"
          dataloader: {
            key: "$args.id"
            listArgument: "ids"
            responseKey: "id"
          }
        ) {
        id: ID
        title: String
      }
    `);

    expect(
      validate(loadString(sdl, { federated: true, cwd: process.cwd() })).map(
        print
      )
    ).toMatchInlineSnapshot(`
      Array [
        "[ERROR] Query._entities cannot dig \`XXX\` from rpc BatchGetPosts return type BatchGetPostsResponse
              Query._entities:[_Entity]! calls Posts/BatchGetPosts
      ",
        "[ERROR] Response key id not found on message BatchGetPostsResponse
              Query._entities:[_Entity]! calls Posts/BatchGetPosts
      ",
      ]
    `);
  });

  test("incorrect dataloader params", async () => {
    const sdl = generateSdl(`#graphql
      type Post @key(fields: "id")
        @grpc__fetch(
          service: POSTS
          rpc: "BatchGetPosts"
          dig: "posts"
          dataloader: {
            key: "$args.uuid" # must match @key fields
            listArgument: "uuids" # doesn't match request type
            responseKey: "uuid" # doesn't match request type (after digging)
          }
        ) {
        id: ID
        title: String
      }
    `);

    expect(
      validate(loadString(sdl, { federated: true, cwd: process.cwd() })).map(
        print
      )
    ).toMatchInlineSnapshot(`
      Array [
        "[ERROR] Dataloader cache key uuid does not match the @key directives (id)
              Query._entities:[_Entity]! calls Posts/BatchGetPosts
      ",
        "[ERROR] Field uuids not found on BatchGetPostsRequest for dataloader listArgument
              Query._entities:[_Entity]! calls Posts/BatchGetPosts
      ",
        "[ERROR] Response key uuid not found on message Post
              Query._entities:[_Entity]! calls Posts/BatchGetPosts
      ",
      ]
    `);
  });
});

/**
 * @param {string} additional
 */
function generateSdl(additional) {
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
        address: "localhost:50003"
      )
  }

  ${additional}
  `;
}
