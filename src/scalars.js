import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from "graphql";

/** @type {{ [key: string]: Set<string> }} */
export const SCALAR_PROTO_MAP = {
  ID: new Set(["TYPE_STRING"]),
  String: new Set(["TYPE_STRING", "TYPE_BYTES"]),
  Int: new Set([
    "TYPE_INT64",
    "TYPE_UINT64",
    "TYPE_INT32",
    "TYPE_FIXED64",
    "TYPE_FIXED32",
    "TYPE_SFIXED32",
    "TYPE_SFIXED64",
    "TYPE_SINT32",
    "TYPE_SINT64",
    "TYPE_UINT32",
  ]),
  Float: new Set(["TYPE_DOUBLE", "TYPE_FLOAT"]),
  Boolean: new Set(["TYPE_BOOL"]),
};

/**
 * @param {string} typeName
 */
export function isProtoScalar(typeName) {
  return [
    "TYPE_DOUBLE",
    "TYPE_FLOAT",
    "TYPE_INT64",
    "TYPE_UINT64",
    "TYPE_INT32",
    "TYPE_FIXED64",
    "TYPE_FIXED32",
    "TYPE_SFIXED32",
    "TYPE_SFIXED64",
    "TYPE_SINT32",
    "TYPE_SINT64",
    "TYPE_UINT32",
    "TYPE_BOOL",
    "TYPE_BYTES",
    "TYPE_STRING",
  ].includes(typeName);
}

/**
 * @param {{ type: string; label: string; name: string; }} field
 */
export function protoScalarToGraphQL(field) {
  switch (field.type) {
    case "TYPE_DOUBLE":
    case "TYPE_FLOAT":
      return GraphQLFloat;
    case "TYPE_INT64":
    case "TYPE_UINT64":
    case "TYPE_INT32":
    case "TYPE_FIXED64":
    case "TYPE_FIXED32":
    case "TYPE_SFIXED32":
    case "TYPE_SFIXED64":
    case "TYPE_SINT32":
    case "TYPE_SINT64":
    case "TYPE_UINT32":
      return GraphQLInt;
    case "TYPE_BOOL":
      return GraphQLBoolean;
    case "TYPE_BYTES":
      return GraphQLString;
    case "TYPE_STRING": {
      return field.name.endsWith("id") || field.name.endsWith("ids")
        ? GraphQLID
        : GraphQLString;
    }

    case "TYPE_GROUP":
    case "TYPE_MESSAGE":
    case "TYPE_ENUM":
      throw new Error(`${field.type} is not a scalar`);
  }
  throw new Error(`${field.type} is not a scalar`);
}
