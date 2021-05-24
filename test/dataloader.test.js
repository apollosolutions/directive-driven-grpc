import { buildSchema, graphql } from "graphql";
import { makeFieldResolver } from "../src/execute";
import { findServices } from "../src/lib";
import { run } from "./__fixtures__/posts";

test("dataloader", async () => {
  const schema = buildSchema(`#graphql
  schema
    @coreExperimental(feature: "https://notareal.spec/core/v0.1")
    @coreExperimental(feature: "https://notareal.spec/grpc/v0.1") {
    query: Query
  }

  directive @coreExperimental(feature: String!, as: String) repeatable on SCHEMA

  directive @grpc(
    protoFile: String!
    serviceName: String!
    address: String!
  ) on ENUM_VALUE

  directive @grpc__rename(
    to: String!
  ) on FIELD_DEFINITION | ARGUMENT_DEFINITION | ENUM_VALUE | INPUT_FIELD_DEFINITION

  directive @grpc__wrap(
    gql: String!
    proto: String!
  ) repeatable on FIELD_DEFINITION

  directive @grpc__fetch(
    service: grpc__Service!
    rpc: String!
    dig: String
    input: [String!]
  ) on FIELD_DEFINITION

  directive @grpc__fetchBatch(
    service: grpc__Service!
    rpc: String!
    key: String!
    listArgument: String!
    responseKey: String
    dig: String
  ) on FIELD_DEFINITION

  enum grpc__Service {
    POSTS
      @grpc(
        protoFile: "test/__fixtures__/posts.proto"
        serviceName: "Posts"
        address: "localhost:50002"
      )
  }

  type Query {
    posts: [Post] @grpc__fetch(service: POSTS, rpc: "ListPosts", dig: "posts")
  }

  type Post {
    id: ID
    title: String
    author: Author 
      @grpc__fetchBatch(
        service: POSTS, 
        rpc: "BatchGetAuthors", 
        key: "$source.author_id"
        listArgument: "ids"
        dig: "authors"
        responseKey: "id"
      )
  }

  type Author {
    id: ID
    name: String
  }
  `);
  const services = findServices(schema);

  const [requests, stopGrpc] = await run(50002);

  const result = await graphql({
    schema,
    source: `{ 
      posts {
        title
        author {
          name
        }
      }
    }`,
    fieldResolver: makeFieldResolver(services),
    contextValue: {},
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "posts": Array [
          Object {
            "author": Object {
              "name": "Author 1",
            },
            "title": "Post 1",
          },
          Object {
            "author": Object {
              "name": "Author 1",
            },
            "title": "Post 2",
          },
          Object {
            "author": Object {
              "name": "Author 2",
            },
            "title": "Post 3",
          },
        ],
      },
    }
  `);

  expect(requests).toMatchInlineSnapshot(`
    Array [
      Object {},
      Object {
        "ids": Array [
          "1",
          "2",
        ],
      },
    ]
  `);

  await stopGrpc();
});
