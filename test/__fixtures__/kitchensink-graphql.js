import { run } from "./kitchensink.js";
import { makeFieldResolver } from "../../src/execute.js";
import { buildSchema, graphql } from "graphql";
import { findServices } from "../../src/protos.js";
import { readFileSync } from "fs";

(async () => {
  const schema = buildSchema(
    readFileSync("test/__fixtures__/kitchensink.graphql", "utf-8")
  );
  const services = findServices(schema, { cwd: process.cwd() });

  await run(50001);

  const result = await graphql({
    schema,
    source: `mutation KitchenSink {
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
        # field_bytes: "world"
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

  console.log(result);
})();
