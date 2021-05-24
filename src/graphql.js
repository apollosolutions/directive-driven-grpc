import { buildFederatedSchema } from "@apollo/federation";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { parse } from "graphql";

/**
 * @param {string} sdl
 */
export function convertFederationSdl(sdl) {
  const federatedSchema = buildFederatedSchema({
    typeDefs: parse(sdl),
    resolvers: {},
  });
  return printSchemaWithDirectives(federatedSchema);
}
