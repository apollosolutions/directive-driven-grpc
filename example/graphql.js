import { readFileSync } from "fs";
import { ApolloServer } from "apollo-server";
import { convertFederationSdl } from "../src/graphql.js";
import { ApolloServerPluginInlineTraceDisabled } from "apollo-server-core";
import { findServices } from "../src/lib.js";
import { makeFieldResolver } from "../src/execute.js";
import { buildSchema } from "graphql";

const typeDefs = convertFederationSdl(readFileSync(process.argv[2], "utf-8"));
const schema = buildSchema(typeDefs);
const serviceMap = findServices(schema);

const server = new ApolloServer({
  schema,
  fieldResolver: makeFieldResolver(serviceMap),
  plugins: [ApolloServerPluginInlineTraceDisabled()],
});

server
  .listen({ port: process.env.PORT ?? 5000 })
  .then(({ url }) => console.log(`Running at ${url}`));
