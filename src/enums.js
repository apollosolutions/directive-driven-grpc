import { GraphQLEnumType } from "graphql";
import { makeGrpcApplied } from "./directives.js";
import { grpcServiceEnumName, ProtoService } from "./protos.js";

/**
 * @param {{ name: string; protoFile: string; serviceName: string; address: string }[]} services
 * @returns {GraphQLEnumType}
 */
export function makeGrpcService(services) {
  const values = services.map((service) => {
    /** @type {[string, import("graphql").GraphQLEnumValueConfig]} */
    const entry = [
      service.name,
      {
        astNode: {
          kind: "EnumValueDefinition",
          name: { kind: "Name", value: service.name },
          directives: [makeGrpcApplied(service)],
        },
      },
    ];
    return entry;
  });

  return new GraphQLEnumType({
    name: grpcServiceEnumName,
    values: Object.fromEntries(values),
  });
}

/**
 * @param {string} typeName
 */
export function isProtoEnum(typeName) {
  return typeName === "TYPE_ENUM";
}

/**
 * @param {string} name
 * @param {import("@grpc/proto-loader").MessageType} parentType
 * @param {ProtoService} service
 */
export function makeEnum(name, parentType, service) {
  const nestedEnum = parentType.enumType.find((t) => t.name === name);
  const enumType = service.getEnumType(name, parentType);

  if (!enumType) throw new Error(`Enum "${name}" missing`);

  if (nestedEnum) {
    name = [parentType.name, name].join("_");
  }

  const entries = enumType.value.map((v) => [v.name, {}]);

  return new GraphQLEnumType({
    name,
    values: Object.fromEntries(entries),
  });
}
