/** @enum {string} */
export const ErrorCodes = {
  MissingField: "MissingField",
  IncorrectType: "IncorrectType",
  ExtranousEnumValue: "ExtranousEnumValue",
  MissingEnumValue: "MissingEnumValue",
  InvalidFetchDig: "InvalidFetchDig",
  IncorrectArgument: "IncorrectArgument",
  IncorrectArgumentName: "IncorrectArgumentName",
  InputMapMissingProtoField: "InputMapMissingProtoField",
  InputMapMissingGqlField: "InputMapMissingGqlField",
  InputMapIncorrectType: "InputMapIncorrectType",
};

/**
 * @param {{ parentType: string; fieldName: string; path: import("./typings").PathPart[] }} params
 */
export function makeMissingFieldError({ parentType, fieldName, path }) {
  const key = [parentType, fieldName].join(".");
  return {
    code: ErrorCodes.MissingField,
    key,
    message: `${key} not found`,
    path: prettyPath(path),
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
 *  path: import("./typings").PathPart[],
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
    path: prettyPath(path),
  };
}

/**
 * @param {{
 *  gqlEnumName: string
 *  gqlEnumValue: string
 *  protoEnumName: string
 *  path: import("./typings").PathPart[]
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
    path: prettyPath(path),
  };
}

/**
 * @param {{
 *  gqlEnumName: string
 *  protoEnumValue: string
 *  protoEnumName: string
 *  path: import("./typings").PathPart[]
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
    path: prettyPath(path),
  };
}

/**
 * @param {{
 *  operationType: string;
 *  fieldName: string;
 *  dig: string;
 *  rpc: string;
 *  returnType: string;
 *  path: import("./typings").PathPart[]
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
    path: prettyPath(path),
  };
}

/**
 * @param {{
 *  operationType: string;
 *  fieldName: string;
 *  argName: string;
 *  renamedArgName?: string;
 *  rpc: string;
 *  returnType: string;
 * }} params
 */
export function makeIncorrectArgumentError({
  operationType,
  fieldName,
  argName,
  renamedArgName,
  rpc,
  returnType,
}) {
  const key = `${operationType}.${fieldName}(${argName})`;
  const nameMessage = renamedArgName
    ? `${renamedArgName} (renamed from ${argName})`
    : argName;
  return {
    code: ErrorCodes.IncorrectArgument,
    key,
    message: `Argument ${nameMessage} on ${operationType}.${fieldName} does not exist on rpc ${rpc} return type ${returnType}`,
    path: `${operationType}.${fieldName}`,
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
}) {
  const key = `${operationType}.${fieldName}(${argName})`;
  const nameMessage = renamedArgName
    ? `${renamedArgName} (renamed from ${argName})`
    : argName;
  return {
    code: ErrorCodes.IncorrectArgument,
    key,
    message: `Argument ${nameMessage}:${argType} on ${operationType}.${fieldName} does not match the ${protoField}:${protoType} return type ${returnType} (${rpc})`,
    path: `${operationType}.${fieldName}`,
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
 * }} params
 */
export function makeInputMapMissingProtoFieldError({
  parentName,
  fieldName,
  gql,
  proto,
  rpcName,
  requestType,
}) {
  return {
    code: ErrorCodes.InputMapMissingProtoField,
    key: `${parentName}.${fieldName}(${gql} => ${proto})`,
    message: `${parentName}.${fieldName} (calling rpc ${rpcName}) is trying to map the GraphQL field ${gql} to request type ${requestType}.${proto}, but ${requestType}.${proto} doesn't exist`,
    path: `${parentName}.${fieldName}`,
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
 * }} params
 */
export function makeInputMapMissingGqlFieldError({
  parentName,
  fieldName,
  gql,
  proto,
  rpcName,
  requestType,
}) {
  return {
    code: ErrorCodes.InputMapMissingGqlField,
    key: `${parentName}.${fieldName}(${gql} => ${proto})`,
    message: `${parentName}.${fieldName} (calling rpc ${rpcName}) is trying to map the GraphQL field ${gql} to request type ${requestType}.${proto}, but ${gql} doesn't exist`,
    path: `${parentName}.${fieldName}`,
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
}) {
  return {
    code: ErrorCodes.InputMapIncorrectType,
    key: `${parentName}.${fieldName}(${gql} => ${proto})`,
    message: `${parentName}.${fieldName} (calling rpc ${rpcName}) is trying to map the GraphQL field ${gql}:${gqlType} request type ${requestType}.${proto}:${protoType}`,
    path: `${parentName}.${fieldName}`,
  };
}

/**
 * @param {import("./typings").PathPart[]} path
 */
function prettyPath(path) {
  return path.map((p) => `${p.parentType}.${p.field}`).join(" -> ");
}
