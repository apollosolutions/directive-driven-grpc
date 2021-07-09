import { buildSchema, graphql } from "graphql";
import { makeFieldResolver } from "../src/execute.js";
import { loadString } from "../src/graphql.js";
import { findServices } from "../src/protos.js";
import { validate } from "../src/validate.js";
import { run } from "./__fixtures__/posts.js";
import { print } from "../src/errors.js";
import { generateSdl } from "./__fixtures__/posts-utils.js";

test("dataloader", async () => {
  const schema = buildSchema(
    generateSdl(`#graphql
  type Query {
    posts: [Post] @grpc__fetch(service: POSTS, rpc: "ListPosts", dig: "posts")
  }

  type Post {
    id: ID
    title: String
    author: Author
      @grpc__fetch(
        service: POSTS
        rpc: "BatchGetAuthors"
        dig: "authors"
        dataloader: {
          key: "$source.author_id"
          listArgument: "ids"
          responseKey: "id"
        }
      )
  }

  type Author {
    id: ID
    name: String
  }
  `)
  );

  const services = findServices(schema, { cwd: process.cwd() });

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
      Array [
        "ListPosts",
        Object {},
      ],
      Array [
        "BatchGetAuthors",
        Object {
          "ids": Array [
            "1",
            "2",
          ],
        },
      ],
    ]
  `);

  await stopGrpc();
});

test("dataloader args", async () => {
  const schema = buildSchema(
    generateSdl(`#graphql
  type Query {
    post(id: ID!): Post
      @grpc__fetch(service: POSTS, rpc: "BatchGetPosts", dig: "posts", dataloader: {
        key: "$args.id"
        listArgument: "ids"
        responseKey: "id"
      })
  }

  type Post {
    id: ID
    title: String
  }
  `)
  );

  const services = findServices(schema, { cwd: process.cwd() });

  const [requests, stopGrpc] = await run(50002);

  const result = await graphql({
    schema,
    source: `{
      one: post(id: "1") {
        title
      }
      two: post(id: "2") {
        title
      }
    }`,
    fieldResolver: makeFieldResolver(services),
    contextValue: {},
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "one": Object {
          "title": "Post 1",
        },
        "two": Object {
          "title": "Post 2",
        },
      },
    }
  `);

  expect(requests).toMatchInlineSnapshot(`
    Array [
      Array [
        "BatchGetPosts",
        Object {
          "ids": Array [
            "1",
            "2",
          ],
        },
      ],
    ]
  `);

  await stopGrpc();
});

describe("validation", () => {
  test("valid schema", async () => {
    const sdl = generateSdl(`#graphql
  type Query {
    posts: [Post] @grpc__fetch(service: POSTS, rpc: "ListPosts", dig: "posts")
    post(id: ID!): Post
      @grpc__fetch(service: POSTS, rpc: "BatchGetPosts", dig: "posts", dataloader: {
        key: "$args.id"
        listArgument: "ids"
        responseKey: "id"
      })
  }

  type Post {
    id: ID
    title: String
    author: Author
      @grpc__fetch(
        service: POSTS
        rpc: "BatchGetAuthors"
        dig: "authors"
        dataloader: {
          key: "$source.author_id"
          listArgument: "ids"
          responseKey: "id"
        }
      )
  }

  type Author {
    id: ID
    name: String
  }`);

    expect(
      validate(loadString(sdl, { federated: true, cwd: process.cwd() })).map(
        print
      )
    ).toEqual([]);
  });

  test("incorrect dataloader params", async () => {
    const sdl = generateSdl(`#graphql
      type Query {
        posts: [Post] @grpc__fetch(service: POSTS, rpc: "ListPosts", dig: "posts")
      }

      type Post {
        id: ID
        title: String
        author: Author
          @grpc__fetch(
            service: POSTS
            rpc: "BatchGetAuthors"
            dig: "authors"
            dataloader: {
              key: "$source.not_a_real_field"
              listArgument: "not_on_request_type"
              responseKey: "not_on_message"
            }
          )
      }

      type Author {
        id: ID
        name: String
      }
    `);

    expect(
      validate(loadString(sdl, { federated: true, cwd: process.cwd() })).map(
        print
      )
    ).toMatchInlineSnapshot(`
      Array [
        "[ERROR] Dataloader cache key not_a_real_field not found on source message Post
              Post.author:Author calls Posts/BatchGetAuthors
      ",
        "[ERROR] Field not_on_request_type not found on BatchGetAuthorsRequest for dataloader listArgument
              Post.author:Author calls Posts/BatchGetAuthors
      ",
        "[ERROR] Response key not_on_message not found on message Author
              Post.author:Author calls Posts/BatchGetAuthors
      ",
      ]
    `);
  });

  test("incorrect dataloader params ($args)", async () => {
    const sdl = generateSdl(`#graphql
      type Query {
        post(id: ID!): Post
          @grpc__fetch(service: POSTS, rpc: "BatchGetPosts", dig: "posts", dataloader: {
            key: "$args.not_a_real_field"
            listArgument: "ids"
            responseKey: "id"
          })
      }

      type Post {
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
        "[ERROR] Argument id on Query.post does not exist on rpc BatchGetPosts request type BatchGetPostsRequest
              Query.post:Post calls Posts/BatchGetPosts
      ",
        "[ERROR] Dataloader cache key $args.not_a_real_field not found on in arguments for Query.post
              Query.post:Post calls Posts/BatchGetPosts
      ",
      ]
    `);
  });
});
