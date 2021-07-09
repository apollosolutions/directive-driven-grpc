import { ApolloServer } from "apollo-server";
import { readFileSync } from "fs";
import { makeFieldResolver } from "./execute.js";
import { generate } from "./generate.js";
import { load } from "./graphql.js";
import { validate } from "./validate.js";
import { watch } from "chokidar";
import { print, printPathInk } from "./errors.js";
import React from "react";
import { render, Text } from "ink";
import { buildSchema } from "graphql";
import {
  MapperKind,
  mapSchema,
  printSchemaWithDirectives,
} from "@graphql-tools/utils";
import {
  fromFederatedSDLToValidSDL,
  fromValidSDLToFederatedSDL,
} from "@apollosolutions/federation-converter";

const h = React.createElement;

/**
 * @param {{ name?: string; proto?: string; service?: string; address?: string; }} flags
 */
export function generateCommand(flags) {
  if (!flags.name) {
    console.error("--name missing");
    process.exit(1);
  }
  if (!flags.proto) {
    console.error("--proto missing");
    process.exit(1);
  }
  if (!flags.service) {
    console.error("--service missing");
    process.exit(1);
  }
  if (!flags.address) {
    console.error("--address missing");
    process.exit(1);
  }

  console.log(
    generate(
      [
        {
          name: flags.name,
          protoFile: flags.proto,
          serviceName: flags.service,
          address: flags.address,
          metadata: [],
        },
      ],
      { cwd: process.cwd() }
    )
  );
}

/**
 * @param {{ schema?: string; federated: boolean; watch: boolean }} flags
 */
export function validateCommand(flags) {
  const schema = flags.schema;

  if (!schema) {
    console.error("--schema missing");
    process.exit(1);
  }

  const callback = () => {
    let sdl = readFileSync(schema, "utf-8");

    if (flags.federated) {
      sdl = fromFederatedSDLToValidSDL(sdl);
    }

    return validate(load(schema, flags));
  };

  if (flags.watch) {
    watch(schema).on("all", () => {
      const errors = callback();
      if (errors?.length) {
        render(UI({ errors }));
      } else {
        render(UI({ file: schema }));
      }
    });
  } else {
    const errors = callback();
    if (errors.length) {
      errors.map(print).map((message) => console.log(message));
      process.exit(1);
    } else {
      console.log("Valid schema");
    }
  }
}

/**
 * @param {{ file: string; } | { errors: import("./typings.js").ConsolidatedError[] }} state
 */
function UI(state) {
  if ("file" in state) {
    return h(Text, {}, `✅ Watching ${state.file}...`);
  } else {
    return h(
      React.Fragment,
      {},
      state.errors.map((error, i) => {
        return h(React.Fragment, { key: i }, [
          h(Text, { key: "error", bold: true }, `❗️ ${error.message}`),
          ...error.paths.slice(0, 2).map((path, i) => {
            return printPathInk(path, { key: i });
          }),
          ...(error.paths.length > 2
            ? [
                h(
                  Text,
                  { key: "more", italic: true },
                  `   … and ${error.paths.length - 2} more.`
                ),
              ]
            : []),
        ]);
      })
    );
  }
}

/**
 * @param {{ schema?: string; port?: any; federated: boolean; }} flags
 */
export function serveCommand(flags) {
  if (!flags.schema) {
    console.error("--schema missing");
    process.exit(1);
  }

  const { schema, services } = load(flags.schema, flags);

  new ApolloServer({
    schema,
    fieldResolver: makeFieldResolver(services),
    context(args) {
      return args;
    },
  })
    .listen({ port: flags.port ?? 4000 })
    .then(({ url }) => console.log(`Running GraphQL API at ${url}`));
}

/**
 * @param {{ schema?: string; federated: boolean; }} flags
 */
export function stripCommand(flags) {
  if (!flags.schema) {
    console.error("--schema missing");
    process.exit(1);
  }

  let sdl = readFileSync(flags.schema, "utf-8");

  if (flags.federated) {
    sdl = fromFederatedSDLToValidSDL(sdl);
  }

  const schema = buildSchema(sdl);

  /** @type {(_: import("graphql").GraphQLNamedType | import('graphql').GraphQLDirective) => any} */
  const stripGrpcTypes = (type) => {
    if (type.name === "grpc" || type.name.startsWith("grpc__")) {
      return null;
    }
  };

  const newSchema = mapSchema(schema, {
    [MapperKind.FIELD](field) {
      if (field.astNode?.directives) {
        field.astNode = {
          ...field.astNode,
          directives: field.astNode.directives.filter(
            (d) => !d.name.value.startsWith("grpc__")
          ),
        };
      }
      return field;
    },
    [MapperKind.TYPE]: stripGrpcTypes,
    [MapperKind.DIRECTIVE]: stripGrpcTypes,
  });

  if (flags.federated) {
    const newSdl = printSchemaWithDirectives(newSchema);
    console.log(fromValidSDLToFederatedSDL(newSdl));
  } else {
    console.log(printSchemaWithDirectives(newSchema));
  }
}
