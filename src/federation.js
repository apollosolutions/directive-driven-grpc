import { buildSchema, GraphQLObjectType, GraphQLSchema, parse } from "graphql";
import federation from "@apollo/subgraph";
import { printSchemaWithDirectives } from "@graphql-tools/utils";

/**
 * Take a GraphQL SDL string intended for Apollo Federation and
 * convert it to a valid SDL while preserving Federation directives.
 * @param {string | import("graphql").Source} sdl
 */
export function fromFederatedSDLToValidSDL(sdl) {
  const parsed = parse(sdl);
  const schema = federation.buildSubgraphSchema(parsed);

  // schema applied directives are lost, but we can add them back
  const originalSchemaDirectives =
    parsed.definitions.find(
      /** @type {(def: any) => def is import("graphql").SchemaDefinitionNode} */
      (def) => def.kind === "SchemaDefinition"
    )?.directives ?? [];

  schema.astNode = {
    // satisfies the type checker
    kind: "SchemaDefinition",
    operationTypes: [],

    ...(schema.astNode ?? {}),
    directives: [
      ...(schema.astNode?.directives ?? []),
      ...originalSchemaDirectives,
    ],
  };

  return printSchemaWithDirectives(schema);
}

/**
 * Take a valid GraphQL SDL string and strip out Apollo Federation
 * directives, types, and fields.
 * @param {string | import("graphql").Source} sdl
 */
export function fromValidSDLToFederatedSDL(sdl) {
  const schema = buildSchema(sdl);

  const query =
    schema.getQueryType() ??
    new GraphQLObjectType({ name: "Query", fields: () => ({}) });

  const typesWithoutQuery = Object.values(schema.getTypeMap()).filter(
    (t) => t.name !== query.name
  );

  delete query.getFields()["_entities"];
  delete query.getFields()["_service"];

  const queryHasFields = Object.keys(query.getFields()).length > 0;

  const schemaWithoutFederationRootFields = new GraphQLSchema({
    ...schema.toConfig(),
    query: queryHasFields ? new GraphQLObjectType(query.toConfig()) : null,
    types: typesWithoutQuery,
  });

  return federation.printSubgraphSchema(schemaWithoutFederationRootFields);
}
