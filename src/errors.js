import { groupBy } from "lodash-es";
import React from "react";
import { Text } from "ink";

/** @enum {string} */
export const ErrorCodes = {
  MissingRpc: "MissingRpc",
  MissingField: "MissingField",
  IncorrectType: "IncorrectType",
  ProtobufIsList: "ProtobufIsList",
  ProtobufIsNotList: "ProtobufIsNotList",
  ExtranousEnumValue: "ExtranousEnumValue",
  MissingEnumValue: "MissingEnumValue",
  InvalidFetchDig: "InvalidFetchDig",
  IncorrectArgument: "IncorrectArgument",
  IncorrectArgumentName: "IncorrectArgumentName",
  InputMapIncorrectArg: "InputMapIncorrectArg",
  InputMapMissingSourceField: "InputMapMissingSourceField",
  InputMapIncorrectType: "InputMapIncorrectType",
  DataloaderIncorrectKeyFormat: "DataloaderIncorrectKeyFormat",
  DataloaderIncorrectSourceKey: "DataloaderIncorrectSourceKey",
  DataloaderIncorrectArgKey: "DataloaderIncorrectArgKey",
  DataloaderIncorrectListArgument: "DataloaderIncorrectListArgument",
  DataloaderIncorrectResponseKey: "DataloaderIncorrectResponseKey",
  NonNullableRecursiveField: "NonNullableRecursiveField",
  WrappedFieldNotFound: "WrappedFieldNotFound",
};

/**
 * @param {import("./typings").ValidationError[]} errors
 * @returns {import("./typings").ConsolidatedError[]}
 */
export function consolidateErrors(errors) {
  const groups = groupBy(errors, (error) => [error.code, error.key].join(":"));

  return Object.values(groups).map((group) => {
    return {
      code: group[0].code,
      message: group[0].message,
      paths: group.map((g) => g.path),
    };
  });
}

/**
 * @param {{ serviceName: string; rpcName: string; path: import("./typings").Path }} params
 */
export function makeMissingRpcError({ serviceName, rpcName, path }) {
  return {
    code: ErrorCodes.MissingRpc,
    key: `${serviceName}.${rpcName}`,
    message: `RPC ${rpcName} not found in ${serviceName}`,
    path,
  };
}

/**
 * @param {{ parentType: string; fieldName: string; path: import("./typings").Path }} params
 */
export function makeMissingFieldError({ parentType, fieldName, path }) {
  const key = [parentType, fieldName].join(".");
  return {
    code: ErrorCodes.MissingField,
    key,
    message: `${key} not found`,
    path,
  };
}

/**
 * @param {{
 *  gqlParentType: string;
 *  gqlFieldName: string;
 *  protoParentType: string;
 *  protoFieldName: string;
 *  gqlType: string;
 *  protoType: string,
 *  path: import("./typings").Path,
 * }} params
 */
export function makeIncorrectTypeError({
  gqlParentType,
  gqlFieldName,
  protoParentType,
  protoFieldName,
  gqlType,
  protoType,
  path,
}) {
  const key = `${gqlParentType}.${gqlFieldName}`;
  return {
    code: ErrorCodes.IncorrectType,
    key,
    message: `${key} returns a ${gqlType}, but ${protoParentType}.${protoFieldName} returns a ${protoType}`,
    path,
  };
}

/**
 * @param {{
 *  gqlParentType: string;
 *  gqlFieldName: string;
 *  protobufParentType: string;
 *  protobufFieldName: string;
 *  protobufFieldLabel: string;
 *  path: import("./typings").Path
 * }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeProtobufIsListError({
  gqlParentType,
  gqlFieldName,
  protobufParentType,
  protobufFieldName,
  protobufFieldLabel,
  path,
}) {
  return {
    code: "ProtobufIsList",
    key: `${gqlParentType}.${gqlFieldName}`,
    message: `${gqlParentType}.${gqlFieldName} is not a list, but ${protobufParentType}.${protobufFieldName} is ${protobufFieldLabel}`,
    path,
  };
}

/**
 * @param {{
 *  gqlParentType: string;
 *  gqlFieldName: string;
 *  protobufParentType: string;
 *  protobufFieldName: string;
 *  protobufFieldLabel: string;
 *  path: import("./typings").Path
 * }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeProtobufIsNotListError({
  gqlParentType,
  gqlFieldName,
  protobufParentType,
  protobufFieldName,
  protobufFieldLabel,
  path,
}) {
  return {
    code: "ProtobufIsNotList",
    key: `${gqlParentType}.${gqlFieldName}`,
    message: `${gqlParentType}.${gqlFieldName} is a list, but ${protobufParentType}.${protobufFieldName} is ${protobufFieldLabel}`,
    path,
  };
}

/**
 * @param {{
 *  gqlEnumName: string
 *  gqlEnumValue: string
 *  protoEnumName: string
 *  path: import("./typings").Path
 * }} param0
 */
export function makeExtranousEnumValueError({
  gqlEnumName,
  gqlEnumValue,
  protoEnumName,
  path,
}) {
  const key = `${gqlEnumName}.${gqlEnumValue}`;
  return {
    code: ErrorCodes.ExtranousEnumValue,
    key,
    message: `${key} not found in ${protoEnumName}`,
    path,
  };
}

/**
 * @param {{
 *  gqlEnumName: string
 *  protoEnumValue: string
 *  protoEnumName: string
 *  path: import("./typings").Path
 * }} param0
 */
export function makeMissingEnumValueError({
  gqlEnumName,
  protoEnumName,
  protoEnumValue,
  path,
}) {
  const key = `${gqlEnumName}.${protoEnumValue}`;
  return {
    code: ErrorCodes.MissingEnumValue,
    key,
    message: `${gqlEnumName} is missing value ${protoEnumName}.${protoEnumValue}`,
    path,
  };
}

/**
 * @param {{
 *  operationType: string;
 *  fieldName: string;
 *  dig: string;
 *  rpc: string;
 *  returnType: string;
 *  path: import("./typings").Path
 * }} params
 */
export function makeInvalidFetchDigError({
  operationType,
  fieldName,
  dig,
  rpc,
  returnType,
  path,
}) {
  const key = `${operationType}.${fieldName}`;
  return {
    code: ErrorCodes.InvalidFetchDig,
    key,
    message: `${key} cannot dig \`${dig}\` from rpc ${rpc} return type ${returnType}`,
    path,
  };
}

/**
 * @param {{
 *  operationType: string;
 *  fieldName: string;
 *  argName: string;
 *  renamedArgName?: string;
 *  rpc: string;
 *  requestType: string;
 *  path: import("./typings").Path;
 * }} params
 */
export function makeIncorrectArgumentError({
  operationType,
  fieldName,
  argName,
  renamedArgName,
  rpc,
  requestType,
  path,
}) {
  const key = `${operationType}.${fieldName}(${argName})`;
  const nameMessage = renamedArgName
    ? `${renamedArgName} (renamed from ${argName})`
    : argName;
  return {
    code: ErrorCodes.IncorrectArgument,
    key,
    message: `Argument ${nameMessage} on ${operationType}.${fieldName} does not exist on rpc ${rpc} request type ${requestType}`,
    path,
  };
}

/**
 * @param {{
 *  operationType: string;
 *  fieldName: string;
 *  argName: string;
 *  renamedArgName?: string;
 *  argType: string;
 *  rpc: string;
 *  returnType: string;
 *  protoField: string;
 *  protoType: string;
 *  path: import("./typings").Path;
 * }} params
 */
export function makeIncorrectArgumentTypeError({
  operationType,
  fieldName,
  argName,
  renamedArgName,
  argType,
  rpc,
  returnType,
  protoField,
  protoType,
  path,
}) {
  const key = `${operationType}.${fieldName}(${argName})`;
  const nameMessage = renamedArgName
    ? `${renamedArgName} (renamed from ${argName})`
    : argName;
  return {
    code: ErrorCodes.IncorrectArgument,
    key,
    message: `Argument ${nameMessage}:${argType} on ${operationType}.${fieldName} does not match the ${protoField}:${protoType} return type ${returnType} (${rpc})`,
    path,
  };
}

/**
 * @param {{
 *  parentName: string;
 *  fieldName: string;
 *  gql: string;
 *  proto: string;
 *  rpcName: string;
 *  requestType: string;
 *  path: import("./typings").Path;
 * }} params
 */
export function makeInputMapMissingProtoFieldError({
  parentName,
  fieldName,
  gql,
  proto,
  rpcName,
  requestType,
  path,
}) {
  return {
    code: ErrorCodes.InputMapIncorrectArg,
    key: `${parentName}.${fieldName}(${gql} => ${proto})`,
    message: `${parentName}.${fieldName} (calling rpc ${rpcName}) is trying to map the GraphQL field ${gql} to request type ${requestType}.${proto}, but ${requestType}.${proto} doesn't exist`,
    path,
  };
}

/**
 * @param {{
 *  parentName: string
 *  fieldName: string
 *  gql: string
 *  proto: string
 *  rpcName: string
 *  requestType: string
 *  path: import("./typings").Path;
 * }} params
 */
export function makeInputMapMissingGqlFieldError({
  parentName,
  fieldName,
  gql,
  proto,
  rpcName,
  requestType,
  path,
}) {
  return {
    code: ErrorCodes.InputMapMissingSourceField,
    key: `${parentName}.${fieldName}(${gql} => ${proto})`,
    message: `${parentName}.${fieldName} (calling rpc ${rpcName}) is trying to map the GraphQL field ${gql} to request field ${requestType}.${proto}, but ${gql} doesn't exist`,
    path,
  };
}

/**
 * @param {{
 *  parentName: string
 *  fieldName: string
 *  gql: string
 *  gqlType: string
 *  proto: string
 *  protoType: string
 *  rpcName: string
 *  requestType: string
 *  path: import("./typings").Path;
 * }} params
 */
export function makeInputMapMismatchedTypesError({
  parentName,
  fieldName,
  gql,
  gqlType,
  proto,
  protoType,
  rpcName,
  requestType,
  path,
}) {
  return {
    code: ErrorCodes.InputMapIncorrectType,
    key: `${parentName}.${fieldName}(${gql} => ${proto})`,
    message: `${parentName}.${fieldName} (calling rpc ${rpcName}) is trying to map the GraphQL field ${gql}:${gqlType} to request field ${requestType}.${proto}:${protoType}`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; key: string }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeDataloaderIncorrectKeyFormatError({ path, key }) {
  return {
    code: ErrorCodes.DataloaderIncorrectKeyFormat,
    key,
    message: `Dataloader key ${key} must start with "$source" or "$args"`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; key: string; sources: string[]; }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeDataloaderIncorrectSourceKeyError({ path, key, sources }) {
  return {
    code: ErrorCodes.DataloaderIncorrectSourceKey,
    key,
    message: `Dataloader cache key ${key} not found on source message${
      sources.length === 1 ? "" : "s"
    } ${sources.join(", ")}`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; key: string; parentName: string; fieldName: string; }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeDataloaderIncorrectArgKeyError({
  path,
  key,
  parentName,
  fieldName,
}) {
  return {
    code: ErrorCodes.DataloaderIncorrectArgKey,
    key,
    message: `Dataloader cache key ${key} not found on in arguments for ${parentName}.${fieldName}`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; keyArg: string; keyFields: string[]; }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeDataloaderIncorrectEntityKeyError({
  path,
  keyArg,
  keyFields,
}) {
  return {
    code: ErrorCodes.DataloaderIncorrectSourceKey,
    key: keyArg,
    message: `Dataloader cache key ${keyArg} does not match the @key directives (${keyFields.join(
      ", "
    )})`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; listArgument: string; requestType: string; }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeDataloaderIncorrectListArgumentError({
  path,
  listArgument,
  requestType,
}) {
  return {
    code: ErrorCodes.DataloaderIncorrectListArgument,
    key: `${requestType}.${listArgument}`,
    message: `Field ${listArgument} not found on ${requestType} for dataloader listArgument`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; responseKey: string; responseType: string; }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeDataloaderIncorrectResponseKeyError({
  path,
  responseKey,
  responseType,
}) {
  return {
    code: ErrorCodes.DataloaderIncorrectResponseKey,
    key: `${responseType}.${responseKey}`,
    message: `Response key ${responseKey} not found on message ${responseType}`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; parentType: string; fieldName: string; fieldType: string }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeNonNullableRecursiveFieldError({
  path,
  parentType,
  fieldName,
  fieldType,
}) {
  return {
    code: ErrorCodes.NonNullableRecursiveField,
    key: `${parentType}.${fieldName}`,
    message: `${parentType}.${fieldName}:${fieldType} must be nullable because it is recursive`,
    path,
  };
}

/**
 * @param {{ path: import("./typings").Path; childType: string; parentType: string; fieldName: string; protoFieldName: string; }} params
 * @returns {import("./typings").ValidationError}
 */
export function makeWrappedFieldNotFoundError({
  path,
  childType,
  fieldName,
  parentType,
  protoFieldName,
}) {
  return {
    code: ErrorCodes.WrappedFieldNotFound,
    key: `${parentType}.${fieldName}`,
    message: `Field ${fieldName} not found on ${childType} when wrapping ${protoFieldName} from ${parentType}`,
    path,
  };
}

/**
 * @param {import("./typings").Path} path
 * @param {string} prefix
 */
function printPath(path, prefix = "  ") {
  return [
    `${path.root.parent.name}.${path.root.field.name}:${path.root.field.type} calls ${path.root.fullyQualifiedServiceName}/${path.root.rpcName}`,
    ...path.steps
      .slice(1)
      .flatMap(
        (step, i) =>
          ` ${" ".repeat(i * 2)}⌙ ${step.gql.type.name}.${
            step.gql.field.name
          } -> ${step.protobuf.type.name}`
      ),
  ]
    .map((line) => [prefix, line].join(""))
    .join("\n");
}

const h = React.createElement;

/**
 * @param {import("./typings").Path} path
 * @param {{ key: number; }} attrs
 */
export function printPathInk(path, attrs) {
  return h(React.Fragment, attrs, [
    h(
      Text,
      { color: "grey", key: "root" },
      `   ${path.root.parent.name}.${path.root.field.name}:${path.root.field.type} calls ${path.root.fullyQualifiedServiceName}/${path.root.rpcName}`
    ),
    ...path.steps
      .slice(1)
      .flatMap((step, i) =>
        h(
          Text,
          { color: "grey", key: i },
          `    ${" ".repeat(i * 2)}⌙ ${step.gql.type.name}.${
            step.gql.field.name
          } -> ${step.protobuf.type.name}`
        )
      ),
  ]);
}

/**
 * @param {import("./typings").ConsolidatedError} error
 */
export function print(error) {
  return `[ERROR] ${error.message}\n${error.paths
    .map((p) => printPath(p, "        "))
    .join("\n")}\n`;
}
