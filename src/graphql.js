import { readFileSync } from "fs";
import federation from "@apollo/federation";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { buildSchema, parse } from "graphql";
import { findServices } from "./protos.js";
import { dirname } from "path";

/**
 * @param {string} sdl
 */
export function convertFederationSdl(sdl) {
  const federatedSchema = federation.buildFederatedSchema({
    typeDefs: parse(sdl),
    resolvers: {},
  });
  return printSchemaWithDirectives(federatedSchema);
}

/**
 * @param {string} file
 * @param {{ federated: boolean }} options
 */
export function load(file, { federated }) {
  const sdl = readFileSync(file, "utf-8");
  return loadString(sdl, { federated, cwd: dirname(file) });
}

/**
 * @param {string} sdl
 * @param {{ federated?: boolean; cwd: string  }} options
 */
export function loadString(sdl, { federated, cwd }) {
  if (federated) {
    sdl = convertFederationSdl(sdl);
  }

  const schema = buildSchema(sdl);
  const services = findServices(schema, { cwd });

  return { schema, services };
}
