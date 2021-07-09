import { generate } from "../src/generate.js";
import { validate } from "../src/validate.js";
import { readFileSync } from "fs";
import { print } from "../src/errors.js";
import { loadString } from "../src/graphql.js";
import { generateSdl } from "./__fixtures__/posts-utils.js";

test("generate -> validate", () => {
  const generated = generate(
    [
      {
        serviceName: "KitchenSink",
        address: "localhost:50051",
        name: "KITCHEN_SINK",
        protoFile: "test/__fixtures__/kitchensink.proto",
        metadata: [],
      },
    ],
    { cwd: process.cwd() }
  );

  expect(validate(loadString(generated, { cwd: process.cwd() }))).toEqual([]);
});

test("wrong field name", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      one: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
      two: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
      non_existant: String
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] Message.non_existant not found
            Query.one:Message! calls KitchenSink/DoSomething
             ⌙ Message.non_existant -> Message
            Query.two:Message! calls KitchenSink/DoSomething
             ⌙ Message.non_existant -> Message
    ",
    ]
  `);
});

test("wrong field type", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      one: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
      two: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
      field_int32: Float
      field_bool: Int
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] Message.field_int32 returns a Float, but Message.field_int32 returns a TYPE_INT32
            Query.one:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_int32 -> Message
            Query.two:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_int32 -> Message
    ",
      "[ERROR] Message.field_bool returns a Int, but Message.field_bool returns a TYPE_BOOL
            Query.one:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_bool -> Message
            Query.two:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_bool -> Message
    ",
    ]
  `);
});

test("mismatched enums", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      one: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
      two: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_enum: EnumOne
      field_nested_enum: EnumTwo
    }

    enum EnumOne {
      one
      two
      not_found
    }

    enum EnumTwo {
      three
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] EnumOne.not_found not found in Enum
            Query.one:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_enum -> Message
            Query.two:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_enum -> Message
    ",
      "[ERROR] EnumTwo is missing value NestedEnum.four
            Query.one:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_nested_enum -> Message
            Query.two:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_nested_enum -> Message
    ",
    ]
  `);
});

test("wrong dig path", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      one: Message!
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething", dig: "foo")
    }

    type Message {
      foo: String
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] Query.one cannot dig \`foo\` from rpc DoSomething return type Message
            Query.one:Message! calls KitchenSink/DoSomething
    ",
    ]
  `);
});

test("wrong arguments", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      doSomething(
        wrong: String
        renamedWrong: String @grpc__renamed(from: "alsowrong")
        renamedRight: String @grpc__renamed(from: "field_string")
      ): Message!
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] Argument wrong on Query.doSomething does not exist on rpc DoSomething request type Message
            Query.doSomething:Message! calls KitchenSink/DoSomething
    ",
      "[ERROR] Argument alsowrong (renamed from renamedWrong) on Query.doSomething does not exist on rpc DoSomething request type Message
            Query.doSomething:Message! calls KitchenSink/DoSomething
    ",
    ]
  `);
});

test("wrong argument type", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      doSomething(field_string: Int): Message!
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] Argument field_string:Int on Query.doSomething does not match the field_string:TYPE_STRING return type Message (DoSomething)
            Query.doSomething:Message! calls KitchenSink/DoSomething
    ",
    ]
  `);
});

test("incorrect input map", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      one: Message!
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
      field_int32: Int
      renamed_float: Float @grpc__renamed(from: "field_float")
      two: Message
        @grpc__fetch(
          service: KITCHEN_SINK,
          rpc: "DoSomething",
          mapArguments: [
            { sourceField: "missingsource", arg: "field_string" }
            { sourceField: "field_int32", arg: "missingproto" }
            { sourceField: "field_string", arg: "field_int32" }
            { sourceField: "field_bool", arg: "field_bool" } # this works: field_bool is on proto
            { sourceField: "renamed_float", arg: "field_float" }
          ]
        )
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] Message.two (calling rpc DoSomething) is trying to map the GraphQL field missingsource to request field Message.field_string, but missingsource doesn't exist
            Message.two:Message calls KitchenSink/DoSomething
    ",
      "[ERROR] Message.two (calling rpc DoSomething) is trying to map the GraphQL field field_int32 to request type Message.missingproto, but Message.missingproto doesn't exist
            Message.two:Message calls KitchenSink/DoSomething
    ",
      "[ERROR] Message.two (calling rpc DoSomething) is trying to map the GraphQL field field_string:TYPE_STRING to request field Message.field_int32:TYPE_INT32
            Message.two:Message calls KitchenSink/DoSomething
    ",
      "[ERROR] Message.two (calling rpc DoSomething) is trying to map the GraphQL field renamed_float to request field Message.field_float, but renamed_float doesn't exist
            Message.two:Message calls KitchenSink/DoSomething
    ",
    ]
  `);
});

test("mapArguments for entities", () => {
  const sdl = generateSdl(`#graphql
      type Query {
        post(id: ID! @grpc__renamed(from: "post_id")): Post
          @grpc__fetch(
            service: POSTS
            rpc: "GetPost"
            dig: "post"
          )
      }

      type Post {
        id: ID
        title: String
        author: User @grpc__wrap(gql: "id", proto: "author_id")
      }

      type User @extends @key(fields: "id") {
        id: ID!
        # works
        firstPost: Post
          @grpc__fetch(
            service: POSTS
            rpc: "GetPostForUser"
            dig: "post"
            mapArguments: { sourceField: "id", arg: "user_id" }
          )
        # doesn't work —  missing field on entity representation
        lastPost: Post
          @grpc__fetch(
            service: POSTS
            rpc: "GetPostForUser"
            dig: "post"
            mapArguments: { sourceField: "doesntExist", arg: "user_id" }
          )
        # doesn't work — mismatched types
        middlePost: Post
          @grpc__fetch(
            service: POSTS
            rpc: "GetPostForUser"
            dig: "post"
            mapArguments: { sourceField: "id", arg: "testing_validation" }
          )
      }
    `);

  expect(
    validate(loadString(sdl, { federated: true, cwd: process.cwd() })).map(
      print
    )
  ).toMatchInlineSnapshot(`
    Array [
      "[ERROR] User.lastPost (calling rpc GetPostForUser) is trying to map the GraphQL field doesntExist to request field GetPostForUserRequest.user_id, but doesntExist doesn't exist
            User.lastPost:Post calls Posts/GetPostForUser
    ",
      "[ERROR] User.middlePost (calling rpc GetPostForUser) is trying to map the GraphQL field id:ID to request field GetPostForUserRequest.testing_validation:TYPE_INT32
            User.middlePost:Post calls Posts/GetPostForUser
    ",
    ]
  `);
});

test("list types", async () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}

    type Query {
      one(field_strings: String field_int32: [Int]): Message!
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_strings: String
      field_int32: [Int]
    }
  `;

  expect(validate(loadString(sdl, { cwd: process.cwd() })).map(print))
    .toMatchInlineSnapshot(`
    Array [
      "[ERROR] Message.field_strings is not a list, but Message.field_strings is LABEL_REPEATED
            Query.one:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_strings -> Message
    ",
      "[ERROR] Message.field_int32 is a list, but Message.field_int32 is LABEL_OPTIONAL
            Query.one:Message! calls KitchenSink/DoSomething
             ⌙ Message.field_int32 -> Message
    ",
    ]
  `);
});
