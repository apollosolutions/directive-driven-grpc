import { makeGrpcService } from "./enums.js";
import { grpc, grpcRename, grpcWrap, makeGrpcFetch } from "./directives.js";
import { GraphQLSchema } from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import prettier from "prettier";
import { ProtoService } from "./protos.js";
import { makeMutationType, makeDummyQueryType } from "./objects.js";

/**
 * @param {import("./typings").ServiceConfig[]} services
 * @param {{ cwd: string }} options
 * @returns {string}
 */
export function generate(services, { cwd }) {
  const protoServices = services.map((s) => ProtoService.load(s, { cwd }));

  const grpcServiceEnum = makeGrpcService(services);
  const dummyQuery = makeDummyQueryType();

  const mutation = makeMutationType(protoServices);

  const schema = new GraphQLSchema({
    directives: [grpc, grpcRename, grpcWrap, makeGrpcFetch(grpcServiceEnum)],
    types: [grpcServiceEnum, dummyQuery, mutation],
  });

  return prettier.format(printSchemaWithDirectives(schema), {
    parser: "graphql",
  });
}
