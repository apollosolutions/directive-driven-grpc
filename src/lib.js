import { getDirectives } from "@graphql-tools/utils";
import { GraphQLSchema, isEnumType } from "graphql";
import { ProtoService } from "./protos.js";

/**
 * @param {GraphQLSchema} schema
 * @returns {Map<string, ProtoService>}
 */
export function findServices(schema) {
  const servicesEnum = Object.values(schema.getTypeMap()).find(
    (d) => isEnumType(d) && d.name === "grpc__Service"
  );

  if (!isEnumType(servicesEnum)) {
    return new Map();
  }

  const services =
    servicesEnum.getValues().map((v) => {
      const { grpc } = getDirectives(schema, v);
      if (!grpc) return;

      const { serviceName, address, protoFile } = grpc;
      if (!serviceName || !address || !protoFile) return;

      return ProtoService.load({
        serviceName,
        address,
        name: v.name,
        protoFile,
      });
    }) ?? [];

  const result = new Map();
  for (const service of services) {
    if (service) {
      result.set(service.name, service);
    }
  }

  return result;
}
