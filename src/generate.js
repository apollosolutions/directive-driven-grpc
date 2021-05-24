import { makeGrpcService } from "./enums.js";
import {
  coreExperimental,
  coreExperimentalApplied,
  grpc,
  grpcFeatureApplied,
  grpcRename,
  grpcWrap,
  makeGrpcFetch,
} from "./directives.js";
import { GraphQLSchema } from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import prettier from "prettier";
import { ProtoService } from "./protos.js";
import { makeMutationType, makeDummyQueryType } from "./objects.js";

/**
 * @param {{ name: string; protoFile: string; serviceName: string; address: string }[]} services
 * @returns {string}
 */
export function generate(services) {
  const protoServices = services.map((s) => ProtoService.load(s));

  const grpcServiceEnum = makeGrpcService(services);
  const dummyQuery = makeDummyQueryType();

  const mutation = makeMutationType(protoServices);

  const schema = new GraphQLSchema({
    directives: [
      coreExperimental,
      grpc,
      grpcRename,
      grpcWrap,
      makeGrpcFetch(grpcServiceEnum),
    ],
    types: [grpcServiceEnum, dummyQuery, mutation],
    astNode: {
      kind: "SchemaDefinition",
      directives: [coreExperimentalApplied, grpcFeatureApplied],
      operationTypes: [
        {
          kind: "OperationTypeDefinition",
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: dummyQuery.name },
          },
          operation: "query",
        },
        {
          kind: "OperationTypeDefinition",
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: mutation.name },
          },
          operation: "mutation",
        },
      ],
    },
  });

  return prettier.format(printSchemaWithDirectives(schema), {
    parser: "graphql",
  });
}
