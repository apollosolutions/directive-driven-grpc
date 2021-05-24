import { run } from "./__fixtures__/kitchensink.js";
import { makeFieldResolver } from "../src/execute.js";
import { buildSchema, graphql } from "graphql";
import { findServices } from "../src/lib.js";
import { readFileSync } from "fs";

test("serve kitchen sync", async () => {
  const schema = buildSchema(
    readFileSync("test/__fixtures__/kitchensink.graphql", "utf-8")
  );
  const services = findServices(schema);

  const stopGrpc = await run(50001);

  const result = await graphql({
    schema,
    source: `#graphql
    mutation KitchenSink {
      DoSomething(
        field_double: 1.1
        field_float: 2.2
        field_int32: 3
        field_int64: 4
        field_uint32: 5
        field_uint64: 6
        field_sint32: 7
        field_sint64: 8
        field_fixed32: 9
        field_fixed64: 10
        field_sfixed32: 11
        field_sfixed64: 12
        field_bool: false
        field_string: "hello"
        # field_bytes: "world" # TODO receiving an error about encoding
        field_strings: ["goodbye"]
        field_enum: one
        field_nested_enum: three
        field_child: {
          foo: "bar"
        }
        field_nested_child: {
          bar: "baz"
        }
        field_recursive: {
          depth: 1
          recursive: {
            depth: 2
          }
        }
      ) {
        field_double
        field_float
        field_int32
        field_int64
        field_uint32
        field_uint64
        field_sint32
        field_sint64
        field_fixed32
        field_fixed64
        field_sfixed32
        field_sfixed64
        field_bool
        field_string
        field_bytes
        field_strings
        field_enum
        field_nested_enum
        field_child {
          foo
        }
        field_nested_child {
          bar
        }
        field_recursive {
          depth
          recursive {
            depth
          }
        }
      }
    }`,
    fieldResolver: makeFieldResolver(services),
  });

  expect(result).toMatchSnapshot();

  await stopGrpc();
});

test("renaming", async () => {
  const schema = buildSchema(`#graphql
  ${readFileSync("test/__fixtures__/core.graphql")}
  
  type Query {
    doSomething(
      input: String @grpc__rename(to: "field_string")
    ): Result! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
  }

  type Result {
    output: String @grpc__rename(to: "field_string")
    field_enum: RenamedEnum
  }

  type Mutation {
    dummy: String
  }

  enum RenamedEnum {
    one
    TWO @grpc__rename(to: "two")
  }
  `);
  const services = findServices(schema);

  const stopGrpc = await run(50001);

  const result = await graphql({
    schema,
    source: `{ doSomething(input: "hello") { output field_enum } }`,
    fieldResolver: makeFieldResolver(services),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "doSomething": Object {
          "field_enum": "TWO",
          "output": "{\\"fieldString\\":\\"hello\\"}",
        },
      },
    }
  `);

  await stopGrpc();
});

test("nested rpc calls", async () => {
  const schema = buildSchema(`#graphql
  ${readFileSync("test/__fixtures__/core.graphql")}
  
  type Query {
    doSomething(field_string: String): Parent! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
  }

  type Parent {
    field_string: String

    child(field_string: String): Child @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
  }

  type Child {
    field_string: String
  }

  type Mutation {
    dummy: String
  }
  `);
  const services = findServices(schema);

  const stopGrpc = await run(50001);

  const result = await graphql({
    schema,
    source: `#graphql
    { 
      doSomething(field_string: "Call one") { 
        field_string 
        child(field_string: "Call two") { 
          field_string 
        } 
      } 
    }`,
    fieldResolver: makeFieldResolver(services),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "doSomething": Object {
          "child": Object {
            "field_string": "{\\"fieldString\\":\\"Call two\\"}",
          },
          "field_string": "{\\"fieldString\\":\\"Call one\\"}",
        },
      },
    }
  `);

  await stopGrpc();
});

test("input types", async () => {
  const schema = buildSchema(`#graphql
  ${readFileSync("test/__fixtures__/core.graphql")}
  
  type Query {
    doSomething(
      arg: MyMessage @grpc__rename(to: "field_child")
    ): Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
  }

  type Message {
    field_string: String
  }

  input MyMessage {
    foo: String
  }

  type Mutation {
    dummy: String
  }
  `);
  const services = findServices(schema);

  const stopGrpc = await run(50001);

  const result = await graphql({
    schema,
    source: `{ doSomething(arg: { foo: "bar" }) { field_string } }`,
    fieldResolver: makeFieldResolver(services),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "doSomething": Object {
          "field_string": "{\\"fieldChild\\":{\\"foo\\":\\"bar\\"}}",
        },
      },
    }
  `);

  await stopGrpc();
});

test("wrapping", async () => {
  const schema = buildSchema(`#graphql
  ${readFileSync("test/__fixtures__/core.graphql")}
  
  type Query {
    doSomething: Message! @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
  }

  type Message {
    wrapper: Wrapper 
      @grpc__wrap(gql: "fromParent", proto: "field_string")
      @grpc__wrap(gql: "anotherOne", proto: "field_int32")
      @grpc__wrap(gql: "child", proto: "field_child")
  }

  type Wrapper {
    fromParent: String
    anotherOne: Int
    child: Child
  }

  type Child {
    foo: String
  }

  type Mutation {
    dummy: String
  }
  `);
  const services = findServices(schema);

  const stopGrpc = await run(50001);

  const result = await graphql({
    schema,
    source: `{ doSomething { wrapper { fromParent anotherOne child { foo } } } }`,
    fieldResolver: makeFieldResolver(services),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "doSomething": Object {
          "wrapper": Object {
            "anotherOne": -3,
            "child": Object {
              "foo": "bar",
            },
            "fromParent": "{}",
          },
        },
      },
    }
  `);

  await stopGrpc();
});

test("dig", async () => {
  const schema = buildSchema(`#graphql
  ${readFileSync("test/__fixtures__/core.graphql")}
  
  type Query {
    doSomethingChild: Int! 
      @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething", dig: "field_recursive.recursive.depth")
  }

  type Mutation {
    dummy: String
  }
  `);
  const services = findServices(schema);

  const stopGrpc = await run(50001);

  const result = await graphql({
    schema,
    source: `{ doSomethingChild }`,
    fieldResolver: makeFieldResolver(services),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "doSomethingChild": 2,
      },
    }
  `);

  await stopGrpc();
});

test("input mapping", async () => {
  const schema = buildSchema(`
  ${readFileSync("test/__fixtures__/core.graphql")}
  
  type Query {
    doSomething: Message! 
      @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething")
  }

  type Message {
    field_int32: Int
    field_string: String

    nested: Message!
      @grpc__fetch(service: KITCHEN_SINK, rpc: "DoSomething", input: "$source.field_int32 => field_int32")
  }

  type Mutation {
    dummy: String
  }
  `);
  const services = findServices(schema);

  const stopGrpc = await run(50001);

  const result = await graphql({
    schema,
    source: `{ doSomething { field_int32 nested { field_string } } }`,
    fieldResolver: makeFieldResolver(services),
  });

  expect(result).toMatchInlineSnapshot(`
    Object {
      "data": Object {
        "doSomething": Object {
          "field_int32": -3,
          "nested": Object {
            "field_string": "{\\"fieldInt32\\":-3}",
          },
        },
      },
    }
  `);

  await stopGrpc();
});
