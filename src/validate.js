import {
  buildSchema,
  getNamedType,
  GraphQLEnumType,
  GraphQLSchema,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
} from "graphql";
import { ProtoService } from "./protos.js";
import { findServices } from "./lib.js";
import { findTypeForField } from "./objects.js";
import { isProtoScalar, SCALAR_PROTO_MAP } from "./scalars.js";
import { getDirectives } from "@graphql-tools/utils";
import {
  makeExtranousEnumValueError,
  makeIncorrectArgumentError,
  makeIncorrectArgumentTypeError,
  makeIncorrectTypeError,
  makeInputMapMismatchedTypesError,
  makeInputMapMissingGqlFieldError,
  makeInputMapMissingProtoFieldError,
  makeInvalidFetchDigError,
  makeMissingEnumValueError,
  makeMissingFieldError,
} from "./errors.js";

/**
 * @param {string} sdl
 */
export function validate(sdl) {
  const schema = buildSchema(sdl);
  const services = findServices(schema);

  const fields = findFetchRootFields(schema);

  const allErrors = [];

  for (const fieldWithParent of fields) {
    const { field } = fieldWithParent;
    const paths = collectPathsFromFetchRoot(fieldWithParent, [], [], schema);

    const directive = fetchDirective(schema, field, services);
    if (!directive) continue; // can't happen

    const { service, rpc, rpcName, dig } = directive;

    allErrors.push(
      ...validateFetchRootArguments(
        fieldWithParent,
        rpc,
        rpcName,
        schema,
        service
      )
    );

    for (const path of paths) {
      const { ok, errors } = validateOutputFromFetchRoot(
        path,
        rpc,
        rpcName,
        service,
        schema,
        dig
      );
      if (!ok) allErrors.push(...(errors ?? []));
    }
  }

  return allErrors;
}

/**
 * @param {import("graphql").GraphQLSchema} schema
 */
function findFetchRootFields(schema) {
  const rootTypes = Object.values(schema.getTypeMap()).filter(isObjectType);

  const rootFieldsWithParent = rootTypes.flatMap((o) => {
    const fields = Object.values(o.getFields()) ?? [];
    return fields.map((f) => ({ parentName: o.name, field: f }));
  });

  return rootFieldsWithParent.filter(({ field }) => {
    const { grpc__fetch } = getDirectives(schema, field);
    return !!grpc__fetch;
  });
}

/**
 * @param {{ parentName: string; field: import("graphql").GraphQLField<*,*>}} fieldWithParent
 * @param {import("./typings.js").PathPart[]} parents
 * @param {import("./typings.js").PathPart[][]} acc
 * @param {GraphQLSchema} schema
 * @param {?string} [overrideRpcName]
 */
function collectPathsFromFetchRoot(
  { field, parentName },
  parents = [],
  acc = [],
  schema,
  overrideRpcName = undefined
) {
  const namedType = getNamedType(field.type);
  const isList = isListType(field.type);
  const isNonNull = isNonNullType(field.type);

  const isRecursive = !!parents.find((p) => p.type === namedType.name);

  const { grpc__rename, grpc__wrap } = getDirectives(schema, field);

  const rpcName = grpc__rename?.to ?? field.name;
  const wrapsFields = isObjectType(namedType) ? grpc__wrap ?? [] : [];

  const part = {
    field: field.name,
    type: namedType.name,
    parentType: parentName,
    rpcName: overrideRpcName ?? rpcName,
    isNonNull,
    isList,
    isRecursive,
    isWrapped: wrapsFields.length > 0,
  };

  // when a wrap is encountered, break it up in multiple paths
  if (wrapsFields.length) {
    for (const { gql, proto } of wrapsFields) {
      if (isObjectType(namedType)) {
        const child = namedType.getFields()[gql];
        if (!child) {
          console.log("field missing:", gql, [
            ...parents.slice().map((p) => p.field),
            field.name,
          ]);
        } else {
          collectPathsFromFetchRoot(
            { field: child, parentName: namedType.name },
            parents.slice(),
            acc,
            schema,
            proto
          );
        }
      }
    }
    return acc;
  }

  if (isRecursive) {
    const path = parents.slice();
    path.push({ ...part, isLeaf: true });
    acc.push(path);
    return acc;
  }

  if (isScalarType(namedType) || isEnumType(namedType)) {
    const path = parents.slice();
    path.push({ ...part, isLeaf: true });
    acc.push(path);
    return acc;
  }

  const { grpc__fetch } = getDirectives(schema, field);
  if (parents.length > 0 && grpc__fetch) return acc;

  parents.push({ ...part, isLeaf: false });

  if (isObjectType(namedType)) {
    for (const field of Object.values(namedType.getFields())) {
      const { grpc__fetch } = getDirectives(schema, field);

      // new fetch root, don't recurse
      if (grpc__fetch) break;

      collectPathsFromFetchRoot(
        { field, parentName: namedType.name },
        parents.slice(),
        acc,
        schema
      );
    }
  }

  return acc;
}

/**
 * @param {GraphQLSchema} schema
 * @param {import("graphql").GraphQLField<*,*>} field
 * @param {Map<string, ProtoService>} services
 */
function fetchDirective(schema, field, services) {
  if (!field.astNode) return;
  const { grpc__fetch } = getDirectives(schema, field);
  const { service: serviceName, rpc: rpcName, dig, input } = grpc__fetch;

  if (!serviceName) throw new Error("service arg missing");
  if (!rpcName) throw new Error("rpc missing");

  const service = services.get(serviceName);
  if (!service) throw new Error(`no service named ${serviceName}`);

  const rpc = service.service[rpcName];
  if (!rpc) throw new Error(`no rpc named ${rpcName}`);

  return { service, rpc, rpcName, dig, input };
}

/**
 * @param {{ field: import("graphql").GraphQLField<*,*>; parentName: string; }} field
 * @param {import("@grpc/proto-loader").MethodDefinition<*,*>} rpc
 * @param {string} rpcName
 * @param {GraphQLSchema} schema
 * @param {ProtoService} service
 */
function validateFetchRootArguments(
  { field, parentName },
  rpc,
  rpcName,
  schema,
  service
) {
  const errors = [];

  const rpcRequestFields = rpc.requestType.type.field;

  for (const arg of field.args) {
    const { grpc__rename } = getDirectives(schema, arg);
    let rpcFieldName = grpc__rename?.to ?? arg.name;

    const messageField = rpcRequestFields.find((f) => f.name === rpcFieldName);

    if (!messageField) {
      errors.push(
        makeIncorrectArgumentError({
          operationType: parentName,
          fieldName: field.name,
          argName: arg.name,
          renamedArgName: grpc__rename?.to,
          rpc: rpcName,
          returnType: rpc.requestType.type.name,
        })
      );
    } else if (isProtoScalar(messageField.type)) {
      const namedType = getNamedType(arg.type);
      if (!SCALAR_PROTO_MAP[namedType.name]?.has(messageField.type)) {
        errors.push(
          makeIncorrectArgumentTypeError({
            operationType: parentName,
            fieldName: field.name,
            argName: arg.name,
            renamedArgName: grpc__rename?.to,
            argType: namedType.name,
            rpc: rpcName,
            returnType: rpc.requestType.type.name,
            protoField: rpcFieldName,
            protoType: messageField.type,
          })
        );
      }
    }
  }

  errors.push(
    ...validateFetchRootInputMaps({ field, parentName }, rpc, rpcName, schema)
  );

  // TODO: recurse through input objects

  return errors;
}

/**
 * @param {{ field: import("graphql").GraphQLField<*,*>; parentName: string }} coordinate
 * @param {import("@grpc/proto-loader").MethodDefinition<*,*>} rpc
 * @param {any} rpcName
 * @param {GraphQLSchema} schema
 */
function validateFetchRootInputMaps(
  { field, parentName },
  rpc,
  rpcName,
  schema
) {
  /** @type {{ code: string; key: string; message: string; path: string; }[]} */
  const errors = [];

  const rpcRequestFields = rpc.requestType.type.field;

  const { grpc__fetch } = getDirectives(schema, field);
  const { input } = grpc__fetch;
  if (!input) return errors;

  const inputs = Array.isArray(input) ? input : [input];
  const pairs = inputs.map((i) => i.split(/\s+=>\s+/).map((s) => s.trim()));

  for (const [gql, proto] of pairs) {
    const messageField = rpcRequestFields.find((f) => f.name === proto);
    if (!messageField) {
      errors.push(
        makeInputMapMissingProtoFieldError({
          parentName,
          fieldName: field.name,
          gql,
          proto,
          rpcName,
          requestType: rpc.requestType.type.name,
        })
      );
    }

    const parentType = schema.getType(parentName);
    if (!isObjectType(parentType)) throw new Error("not possible");

    const sourceFieldName = gql.replace("$source.", "");
    const sourceField = parentType.getFields()[sourceFieldName];

    if (!sourceField) {
      errors.push(
        makeInputMapMissingGqlFieldError({
          parentName,
          fieldName: field.name,
          gql,
          proto,
          rpcName,
          requestType: rpc.requestType.type.name,
        })
      );
    }

    if (messageField && sourceField) {
      const namedType = getNamedType(sourceField.type);

      if (isProtoScalar(messageField.type)) {
        if (!SCALAR_PROTO_MAP[namedType.name]?.has(messageField.type)) {
          errors.push(
            makeInputMapMismatchedTypesError({
              parentName,
              fieldName: field.name,
              gql,
              gqlType: namedType.name,
              proto,
              protoType: messageField.type,
              rpcName,
              requestType: rpc.requestType.type.name,
            })
          );
        }
      } else {
        throw new Error(
          "mapping to object types with @grpc__fetchBatch(input:) is not supported"
        );
      }
    }
  }

  return errors;
}

/**
 * @param {import("./typings.js").PathPart[]} path
 * @param {import("@grpc/proto-loader").MethodDefinition<*,*>} rpc
 * @param {string} rpcName
 * @param {ProtoService} service
 * @param {GraphQLSchema} schema
 * @param {string | undefined} dig
 * @returns {{ ok: boolean; errors?: any[] }}
 */
function validateOutputFromFetchRoot(path, rpc, rpcName, service, schema, dig) {
  let currentMessage = rpc.responseType.type;

  if (dig) {
    for (const fieldName of dig.split(".")) {
      const messageField = currentMessage.field.find(
        (/** @type {{ name: string; }} */ f) => f.name === fieldName
      );
      if (!messageField) {
        return {
          ok: false,
          errors: [
            makeInvalidFetchDigError({
              operationType: path[0].parentType,
              fieldName: path[0].field,
              dig,
              rpc: rpcName,
              returnType: rpc.responseType.type.name,
              path: path.slice(0, 1),
            }),
          ],
        };
      }
      currentMessage = findTypeForField(messageField, currentMessage, service);
    }
  }

  for (const part of path.slice(1)) {
    const messageField = currentMessage.field.find(
      (/** @type {{ name: string; }} */ f) => f.name === part.rpcName
    );

    if (!messageField)
      return {
        ok: false,
        errors: [
          makeMissingFieldError({
            parentType: currentMessage.name,
            fieldName: part.rpcName,
            path,
          }),
        ],
      };

    if (part.isRecursive) {
      return { ok: true }; // TODO validate is null and type matches
    }

    if (part.isLeaf) {
      if (messageField.type === "TYPE_ENUM") {
        const protoEnum =
          service.getNestedEnum(messageField.typeName, currentMessage) ??
          service.getType(messageField.typeName);

        const graphQLEnum = schema.getType(part.type);

        if (!isEnumType(graphQLEnum)) {
          throw new Error(`GraphQLEnum \`${part.type}\` not found`);
        }

        return enumsAreCompatible(graphQLEnum, protoEnum, path);
      } else if (SCALAR_PROTO_MAP[part.type]?.has(messageField.type)) {
        return { ok: true };
      } else {
        return {
          ok: false,
          errors: [
            makeIncorrectTypeError({
              gqlParentType: part.parentType,
              gqlFieldName: part.field,
              gqlType: part.type,
              protoParentType: currentMessage.name,
              protoFieldName: messageField.name,
              protoType: messageField.type,
              path,
            }),
          ],
        };
      }
    }

    currentMessage = findTypeForField(messageField, currentMessage, service);
  }

  return { ok: true };
}

/**
 * @param {GraphQLEnumType} graphQLEnum
 * @param {import("@grpc/proto-loader").EnumTypeDefinition} protoEnum
 * @param {import("./typings.js").PathPart[]} path
 */
export function enumsAreCompatible(graphQLEnum, protoEnum, path) {
  const errors = [];

  for (const graphQLValue of graphQLEnum.getValues()) {
    const protoValue = protoEnum.value.find(
      (/** @type {{ name: string; }} */ v) => v.name === graphQLValue.name
    );
    if (!protoValue) {
      errors.push(
        makeExtranousEnumValueError({
          gqlEnumName: graphQLEnum.name,
          gqlEnumValue: graphQLValue.name,
          protoEnumName: protoEnum.name,
          path,
        })
      );
    }
  }

  for (const protoValue of protoEnum.value) {
    const graphQLValue = graphQLEnum
      .getValues()
      .find((/** @type {{ name: string; }} */ v) => v.name === protoValue.name);
    if (!graphQLValue) {
      errors.push(
        makeMissingEnumValueError({
          gqlEnumName: graphQLEnum.name,
          protoEnumValue: protoValue.name,
          protoEnumName: protoEnum.name,
          path,
        })
      );
    }
  }

  if (errors.length) {
    return { ok: false, errors };
  } else {
    return { ok: true };
  }
}
