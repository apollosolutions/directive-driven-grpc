import { generate } from "../src/generate";
import { validate } from "../src/validate";
import { readFileSync } from "fs";

test("generate -> validate", () => {
  const generated = generate([
    {
      serviceName: "KitchenSink",
      address: "localhost:50051",
      name: "KITCHEN_SINK",
      protoFile: "test/__fixtures__/kitchensink.proto",
    },
  ]);

  expect(validate(generated)).toEqual([]);
});

test("wrong field name", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}
    type Mutation { dummy: Int }

    type Query {
      one: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
      two: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
      non_existant: String
    }
  `;

  expect(validate(sdl)).toMatchInlineSnapshot(`
    Array [
      Object {
        "code": "MissingField",
        "key": "Message.non_existant",
        "message": "Message.non_existant not found",
        "path": "Query.one -> Message.non_existant",
      },
      Object {
        "code": "MissingField",
        "key": "Message.non_existant",
        "message": "Message.non_existant not found",
        "path": "Query.two -> Message.non_existant",
      },
    ]
  `);
});

test("wrong field type", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}
    type Mutation { dummy: Int }

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

  expect(validate(sdl)).toMatchInlineSnapshot(`
    Array [
      Object {
        "code": "IncorrectType",
        "key": "Message.field_int32",
        "message": "Message.field_int32 returns a Float, but Message.field_int32 returns a TYPE_INT32",
        "path": "Query.one -> Message.field_int32",
      },
      Object {
        "code": "IncorrectType",
        "key": "Message.field_bool",
        "message": "Message.field_bool returns a Int, but Message.field_bool returns a TYPE_BOOL",
        "path": "Query.one -> Message.field_bool",
      },
      Object {
        "code": "IncorrectType",
        "key": "Message.field_int32",
        "message": "Message.field_int32 returns a Float, but Message.field_int32 returns a TYPE_INT32",
        "path": "Query.two -> Message.field_int32",
      },
      Object {
        "code": "IncorrectType",
        "key": "Message.field_bool",
        "message": "Message.field_bool returns a Int, but Message.field_bool returns a TYPE_BOOL",
        "path": "Query.two -> Message.field_bool",
      },
    ]
  `);
});

test("mismatched enums", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}
    type Mutation { dummy: Int }

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

  expect(validate(sdl)).toMatchInlineSnapshot(`
    Array [
      Object {
        "code": "ExtranousEnumValue",
        "key": "EnumOne.not_found",
        "message": "EnumOne.not_found not found in Enum",
        "path": "Query.one -> Message.field_enum",
      },
      Object {
        "code": "MissingEnumValue",
        "key": "EnumTwo.four",
        "message": "EnumTwo is missing value NestedEnum.four",
        "path": "Query.one -> Message.field_nested_enum",
      },
      Object {
        "code": "ExtranousEnumValue",
        "key": "EnumOne.not_found",
        "message": "EnumOne.not_found not found in Enum",
        "path": "Query.two -> Message.field_enum",
      },
      Object {
        "code": "MissingEnumValue",
        "key": "EnumTwo.four",
        "message": "EnumTwo is missing value NestedEnum.four",
        "path": "Query.two -> Message.field_nested_enum",
      },
    ]
  `);
});

test("wrong dig path", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}
    type Mutation { dummy: Int }

    type Query {
      one: Message! 
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething", dig: "foo")
    }

    type Message {
      foo: String
    }
  `;

  expect(validate(sdl)).toMatchInlineSnapshot(`
    Array [
      Object {
        "code": "InvalidFetchDig",
        "key": "Query.one",
        "message": "Query.one cannot dig \`foo\` from rpc DoSomething return type Message",
        "path": "Query.one",
      },
    ]
  `);
});

test("wrong arguments", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}
    type Mutation { dummy: Int }

    type Query {
      doSomething(
        wrong: String
        renamedWrong: String @grpc__rename(to: "alsowrong")
        renamedRight: String @grpc__rename(to: "field_string")
      ): Message! 
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
    }
  `;

  expect(validate(sdl)).toMatchInlineSnapshot(`
    Array [
      Object {
        "code": "IncorrectArgument",
        "key": "Query.doSomething(wrong)",
        "message": "Argument wrong on Query.doSomething does not exist on rpc DoSomething return type Message",
        "path": "Query.doSomething",
      },
      Object {
        "code": "IncorrectArgument",
        "key": "Query.doSomething(renamedWrong)",
        "message": "Argument alsowrong (renamed from renamedWrong) on Query.doSomething does not exist on rpc DoSomething return type Message",
        "path": "Query.doSomething",
      },
    ]
  `);
});

test("wrong argument type", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}
    type Mutation { dummy: Int }

    type Query {
      doSomething(field_string: Int): Message! 
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
    }
  `;

  expect(validate(sdl)).toMatchInlineSnapshot(`
    Array [
      Object {
        "code": "IncorrectArgument",
        "key": "Query.doSomething(field_string)",
        "message": "Argument field_string:Int on Query.doSomething does not match the field_string:TYPE_STRING return type Message (DoSomething)",
        "path": "Query.doSomething",
      },
    ]
  `);
});

test("incorrect input map", () => {
  const sdl = `#graphql
    ${readFileSync("test/__fixtures__/core.graphql")}
    type Mutation { dummy: Int }

    type Query {
      one: Message! 
        @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
    }

    type Message {
      field_string: String
      field_int32: Int
      two: Message
        @grpc__fetch(
          service: KITCHEN_SINK, 
          rpc: "DoSomething", 
          input: [
            "$source.missingsource => field_string",
            "$source.field_int32 => missingproto",
            "$source.field_string => field_int32"
            "$source.field_bool => field_bool" # field_bool is on proto, not graphql
          ]
        )
    }
  `;

  expect(validate(sdl)).toMatchInlineSnapshot(`
    Array [
      Object {
        "code": "InputMapMissingGqlField",
        "key": "Message.two($source.missingsource => field_string)",
        "message": "Message.two (calling rpc DoSomething) is trying to map the GraphQL field $source.missingsource to request type Message.field_string, but $source.missingsource doesn't exist",
        "path": "Message.two",
      },
      Object {
        "code": "InputMapMissingProtoField",
        "key": "Message.two($source.field_int32 => missingproto)",
        "message": "Message.two (calling rpc DoSomething) is trying to map the GraphQL field $source.field_int32 to request type Message.missingproto, but Message.missingproto doesn't exist",
        "path": "Message.two",
      },
      Object {
        "code": "InputMapIncorrectType",
        "key": "Message.two($source.field_string => field_int32)",
        "message": "Message.two (calling rpc DoSomething) is trying to map the GraphQL field $source.field_string:String request type Message.field_int32:TYPE_INT32",
        "path": "Message.two",
      },
    ]
  `);
});
