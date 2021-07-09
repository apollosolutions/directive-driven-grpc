import { readFileSync } from "fs";
import { buildSchema } from "graphql";
import { findServices } from "./protos.js";
import { dirname } from "path";
import { fromFederatedSDLToValidSDL } from "@apollosolutions/federation-converter";

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
    sdl = fromFederatedSDLToValidSDL(sdl);
  }

  const schema = buildSchema(sdl);
  const services = findServices(schema, { cwd });

  return { schema, services };
}
