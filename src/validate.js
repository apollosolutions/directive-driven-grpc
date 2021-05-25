import { getDirectives } from "@graphql-tools/utils";
import {
  getNamedType,
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLSchema,
  isEnumType,
  isListType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isScalarType,
  isUnionType,
} from "graphql";
import {
  consolidateErrors,
  makeDataloaderIncorrectArgKeyError,
  makeDataloaderIncorrectEntityKeyError,
  makeDataloaderIncorrectKeyFormatError,
  makeDataloaderIncorrectListArgumentError,
  makeDataloaderIncorrectResponseKeyError,
  makeDataloaderIncorrectSourceKeyError,
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
  makeMissingRpcError,
  makeNonNullableRecursiveFieldError,
  makeProtobufIsListError,
  makeProtobufIsNotListError,
  makeWrappedFieldNotFoundError,
} from "./errors.js";
import { findTypeForField } from "./objects.js";
import { isMessageType, ProtoService } from "./protos.js";
import { isProtoScalar, SCALAR_PROTO_MAP } from "./scalars.js";

/**
 * @param {{ schema: GraphQLSchema; services: Map<string, ProtoService> }} params
 */
export function validate({ schema, services }) {
  const roots = [
    ...findFetchRoots(schema, services),
    ...findEntityFetchRoots(schema, services),
  ];

  /** @type {import("./typings").ValidationError[]} */
  const allErrors = [];
  const allFetchRootParents = new Map();

  for (const root of roots) {
    const service = services.get(root.serviceName);
    if (!service) throw new Error(`service ${root.serviceName} not found`);
    const rpc = service.getRPC(root.rpcName);
    if (!rpc) {
      allErrors.push(
        makeMissingRpcError({
          serviceName: root.serviceName,
          rpcName: root.rpcName,
          path: { root, steps: [] },
        })
      );
      continue;
    }

    const { errors, fetchRootParents } = walkPathsFromRoot({
      root,
      schema,
      service,
      rpc,
    });
    allErrors.push(...errors);

    for (const [key, set] of fetchRootParents) {
      if (!allFetchRootParents.has(key)) {
        allFetchRootParents.set(key, new Set());
      }
      for (const value of set) {
        allFetchRootParents.get(key).add(value);
      }
    }
  }

  for (const root of roots) {
    const service = services.get(root.serviceName);
    if (!service) throw new Error(`service ${root.serviceName} not found`);
    const rpc = service.getRPC(root.rpcName);
    if (!rpc) continue; // error handled above

    /** @type {import("./typings").Path} */
    const path = {
      root,
      steps: [
        {
          gql: { type: root.parent, field: root.field },
          protobuf: { type: rpc.responseType.type },
        },
      ],
    };

    allErrors.push(
      ...validateFetchRootArguments({
        root,
        path,
        schema,
        rpc,
        service,
        fetchRootParents: allFetchRootParents,
      })
    );
  }

  return consolidateErrors(allErrors);
}

/**
 * @param {GraphQLSchema} schema
 * @param {Map<string, ProtoService>} services
 * @returns {(import("./typings").FetchRoot<any>)[]}
 */
export function findFetchRoots(schema, services) {
  const rootTypes = Object.values(schema.getTypeMap()).filter(isObjectType);

  const rootFieldsWithParent = rootTypes.flatMap((o) => {
    const fields = Object.values(o.getFields()) ?? [];
    return fields.map((f) => ({ parent: o, field: f }));
  });

  const results = rootFieldsWithParent.map(({ parent, field }) => {
    const { grpc__fetch } = getDirectives(schema, field);

    if (grpc__fetch) {
      return {
        kind: grpc__fetch.dataloader
          ? /** @type {"BATCH_FETCH"} */ ("BATCH_FETCH")
          : /** @type {"FETCH"} */ ("FETCH"),
        parent,
        field,
        serviceName: grpc__fetch.service,
        fullyQualifiedServiceName: services.get(grpc__fetch.service)
          ?.serviceName,
        rpcName: grpc__fetch.rpc,
        dig: grpc__fetch.dig,
        mapArguments: grpc__fetch.mapArguments,
        key: grpc__fetch.dataloader?.key,
        listArgument: grpc__fetch.dataloader?.listArgument,
        responseKey: grpc__fetch.dataloader?.responseKey,
      };
    }
  });

  return results.filter(
    /** @type {(_: any) => _ is any} */
    ((o) => !!o)
  );
}

/**
 * @param {GraphQLSchema} schema
 * @param {Map<string, ProtoService>} services
 * @returns {(import("./typings").FetchRoot<any>)[]}
 */
function findEntityFetchRoots(schema, services) {
  const rootTypes = Object.values(schema.getTypeMap()).filter(isObjectType);
  const queryType = schema.getQueryType();
  const entitiesField = queryType?.getFields()["_entities"];

  const results = rootTypes.map((obj) => {
    const { grpc__fetch } = getDirectives(schema, obj);

    if (grpc__fetch) {
      return {
        kind: grpc__fetch.dataloader
          ? /** @type {"BATCH_FETCH"} */ ("BATCH_FETCH")
          : /** @type {"FETCH"} */ ("FETCH"),
        parent: queryType,
        field: entitiesField,
        serviceName: grpc__fetch.service,
        fullyQualifiedServiceName: services.get(grpc__fetch.service)
          ?.serviceName,
        rpcName: grpc__fetch.rpc,
        dig: grpc__fetch.dig,
        inputMap: grpc__fetch.mapArguments,
        key: grpc__fetch.dataloader?.key,
        listArgument: grpc__fetch.dataloader?.listArgument,
        responseKey: grpc__fetch.dataloader?.responseKey,
        entityType: obj,
      };
    }
  });

  return results.filter(
    /** @type {(_: any) => _ is any} */
    ((o) => !!o)
  );
}

/**
 * @param {{
 *  root: import("./typings").FetchRoot<any>;
 *  schema: GraphQLSchema;
 *  service: ProtoService;
 *  rpc: import("@grpc/proto-loader").MethodDefinition<*,*>
 * }} params
 */
function walkPathsFromRoot({ root, schema, service, rpc }) {
  /** @type {import("./typings").ValidationError[]} */
  const errors = [];
  const fetchRootParents = new Map();

  const gql = {
    type: root.parent,
    field: root.field,
  };

  const protobuf = {
    type: rpc.responseType.type,
  };

  pathWalker(
    {
      root,
      schema,
      service,
      rpc,
      errors,
      fetchRootParents,
    },
    gql,
    protobuf,
    []
  );

  return { errors, fetchRootParents };
}

/**
 * @param {{
 *  root: import("./typings").FetchRoot<any>;
 *  schema: GraphQLSchema;
 *  service: ProtoService;
 *  rpc: import("@grpc/proto-loader").MethodDefinition<*,*>;
 *  errors: import("./typings").ValidationError[];
 *  fetchRootParents: Map<string, Set<any>>;
 * }} state
 * @param {{
 *  type: GraphQLObjectType;
 *  field: import("graphql").GraphQLField<*,*>
 * }} gql
 * @param {{
 *  type: import("@grpc/proto-loader").MessageType;
 *  fieldName?: string;
 * }} protobuf
 * @param {import("./typings").PathStep[]} path
 */
function pathWalker(state, gql, protobuf, path) {
  if (path.length < 1) {
    const namedType = getNamedType(gql.field.type);

    /** @type {import("@grpc/proto-loader").MessageType | null} */
    let protobufType = protobuf.type;

    if (state.root.dig) {
      protobufType = state.service.digFromType(protobufType, state.root.dig);
      if (!protobufType) {
        state.errors.push(
          makeInvalidFetchDigError({
            operationType: gql.type.name,
            fieldName: gql.field.name,
            dig: state.root.dig,
            rpc: state.root.rpcName,
            returnType: state.rpc.responseType.type.name,
            path: {
              root: state.root,
              steps: [
                {
                  gql: { type: state.root.parent, field: state.root.field },
                  protobuf: { type: protobuf.type },
                },
              ],
            },
          })
        );
        return;
      }
    }

    if (isObjectType(namedType)) {
      for (const field of Object.values(namedType.getFields())) {
        pathWalker(state, { type: namedType, field }, { type: protobufType }, [
          { gql, protobuf },
        ]);
      }
    } else if (isUnionType(namedType) && state.root.entityType) {
      for (const field of Object.values(state.root.entityType.getFields())) {
        pathWalker(
          state,
          { type: state.root.entityType, field },
          { type: protobufType },
          [{ gql, protobuf }]
        );
      }
    }
    return;
  }

  const gqlFieldType = getNamedType(gql.field.type);

  const { grpc__renamed, grpc__wrap, grpc__fetch } = getDirectives(
    state.schema,
    gql.field
  );

  if (grpc__fetch) {
    const key = `${gql.type.name}.${gql.field.name}`;
    if (!state.fetchRootParents.has(key)) {
      state.fetchRootParents.set(key, new Set());
    }
    state.fetchRootParents.get(key)?.add(protobuf.type.name);
    return;
  }

  const isRecursive = path.some(
    (part) => part.gql.type.name === gqlFieldType.name
  );
  if (isRecursive) {
    if (!isNullableType(gql.field.type)) {
      state.errors.push(
        makeNonNullableRecursiveFieldError({
          parentType: gql.type.name,
          fieldName: gql.field.name,
          fieldType: gql.field.type,
          path: { root: state.root, steps: [...path, { gql, protobuf }] },
        })
      );
    }
    return;
  }

  // if wrapped, dig and recurse
  if (grpc__wrap) {
    for (const { gql: childField, proto } of grpc__wrap) {
      if (isObjectType(gqlFieldType)) {
        const child = gqlFieldType.getFields()[childField];
        if (!child) {
          state.errors.push(
            makeWrappedFieldNotFoundError({
              childType: gqlFieldType.name,
              fieldName: childField,
              parentType: gql.type.name,
              protoFieldName: proto,
              path: { root: state.root, steps: [...path, { gql, protobuf }] },
            })
          );
        } else {
          pathWalker(
            state,
            { type: gqlFieldType, field: child },
            { type: protobuf.type, fieldName: proto },
            path
          );
        }
      }
    }
    return;
  }

  const protobufFieldName =
    /* wrapped */ protobuf.fieldName ??
    /* renamed */ grpc__renamed?.from ??
    /* matches */ gql.field.name;

  const protobufField = protobuf.type.field.find(
    (f) => f.name === protobufFieldName
  );

  if (!protobufField) {
    state.errors.push(
      makeMissingFieldError({
        parentType: protobuf.type.name,
        fieldName: protobufFieldName,
        path: { root: state.root, steps: [...path, { gql, protobuf }] },
      })
    );
    return;
  }

  const isList =
    isListType(gql.field.type) ||
    (isNonNullType(gql.field.type) && isListType(gql.field.type.ofType));
  if (protobufField.label === "LABEL_REPEATED" && !isList) {
    state.errors.push(
      makeProtobufIsListError({
        gqlParentType: gql.type.name,
        gqlFieldName: gql.field.name,
        protobufParentType: protobuf.type.name,
        protobufFieldName,
        protobufFieldLabel: protobufField.label,
        path: { root: state.root, steps: [...path, { gql, protobuf }] },
      })
    );
  } else if (protobufField.label !== "LABEL_REPEATED" && isList) {
    state.errors.push(
      makeProtobufIsNotListError({
        gqlParentType: gql.type.name,
        gqlFieldName: gql.field.name,
        protobufParentType: protobuf.type.name,
        protobufFieldName,
        protobufFieldLabel: protobufField.label,
        path: { root: state.root, steps: [...path, { gql, protobuf }] },
      })
    );
  }

  if (isScalarType(gqlFieldType)) {
    if (!SCALAR_PROTO_MAP[gqlFieldType.name]?.has(protobufField.type)) {
      state.errors.push(
        makeIncorrectTypeError({
          gqlParentType: gql.type.name,
          gqlFieldName: gql.field.name,
          gqlType: gql.field.type.toString(),
          protoParentType: protobuf.type.name,
          protoFieldName: protobufFieldName,
          protoType: protobufField.type,
          path: { root: state.root, steps: [...path, { gql, protobuf }] },
        })
      );
    }
    return;
  }

  if (isEnumType(gqlFieldType)) {
    const protoEnum = state.service.getEnumType(
      protobufField.typeName,
      protobuf.type
    );

    // TODO
    if (!protoEnum) throw new Error(`missing protobuf enum ${protobuf.type}`);

    const { errors } = enumsAreCompatible(gqlFieldType, protoEnum, {
      root: state.root,
      steps: [...path, { gql, protobuf }],
    });
    state.errors.push(...(errors ?? []));
    return;
  }

  const nextProtobufType = findTypeForField(
    protobufField,
    protobuf.type,
    state.service
  );

  if (!nextProtobufType) {
    throw new Error(`missing protobuf type for field ${protobufField.name}`);
  }

  // for each gql field, recurse
  if (isObjectType(gqlFieldType)) {
    for (const field of Object.values(gqlFieldType.getFields())) {
      pathWalker(
        state,
        { type: gqlFieldType, field },
        { type: nextProtobufType },
        [...path, { gql, protobuf }]
      );
    }
  }
}

/**
 * @param {GraphQLEnumType} graphQLEnum
 * @param {import("@grpc/proto-loader").EnumType} protoEnum
 * @param {import("./typings.js").Path} path
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

/**
 * @param {{
 *  root: import("./typings").FetchRoot<any>;
 *  path: import("./typings").Path;
 *  rpc: import("@grpc/proto-loader").MethodDefinition<*,*>;
 *  schema: GraphQLSchema;
 *  service: ProtoService;
 *  fetchRootParents: Map<string, Set<string>>
 * }} state
 */
function validateFetchRootArguments({
  root,
  path,
  schema,
  rpc,
  service,
  fetchRootParents,
}) {
  /** @type {import("./typings").ValidationError[]} */
  const errors = [];

  const ignoredDataloaderArg =
    root.kind === "BATCH_FETCH" && root.key.startsWith("$args")
      ? root.key.replace("$args.", "")
      : undefined;

  // _entities has a special representations argument that will never match
  // any protobuf request objects
  if (!root.entityType) {
    const rpcRequestFields = rpc.requestType.type.field;

    for (const arg of root.field.args) {
      if (arg.name === ignoredDataloaderArg) continue;

      const { grpc__renamed } = getDirectives(schema, arg);
      let protobufFieldName = grpc__renamed?.from ?? arg.name;

      const protobufField = rpcRequestFields.find(
        (f) => f.name === protobufFieldName
      );

      if (!protobufField) {
        errors.push(
          makeIncorrectArgumentError({
            operationType: root.parent.name,
            fieldName: root.field.name,
            argName: arg.name,
            renamedArgName: grpc__renamed?.from,
            rpc: root.rpcName,
            requestType: rpc.requestType.type.name,
            path,
          })
        );
      } else if (isProtoScalar(protobufField.type)) {
        const namedType = getNamedType(arg.type);

        if (!SCALAR_PROTO_MAP[namedType.name]?.has(protobufField.type)) {
          errors.push(
            makeIncorrectArgumentTypeError({
              operationType: root.parent.name,
              fieldName: root.field.name,
              argName: arg.name,
              renamedArgName: grpc__renamed?.from,
              argType: namedType.name,
              rpc: root.rpcName,
              returnType: rpc.requestType.type.name,
              protoField: protobufFieldName,
              protoType: protobufField.type,
              path,
            })
          );
        }
      }

      // TODO composite argument types
    }
  }

  errors.push(
    ...validateFetchRootInputMaps({
      root,
      schema,
      rpc,
      service,
      fetchRootParents,
      path,
    })
  );

  errors.push(
    ...validateDataloaderArgs({
      root,
      fetchRootParents,
      path,
      schema,
      service,
      rpc,
    })
  );

  return errors;
}

/**
 * @param {{
 *  root: import("./typings").FetchRoot<any>;
 *  path: import("./typings").Path;
 *  schema: GraphQLSchema;
 *  rpc: import("@grpc/proto-loader").MethodDefinition<*,*>;
 *  service: ProtoService;
 *  fetchRootParents: Map<string, Set<string>>;
 * }} state
 */
function validateFetchRootInputMaps({
  root,
  path,
  schema,
  rpc,
  service,
  fetchRootParents,
}) {
  /** @type {import("./typings").ValidationError[]} */
  const errors = [];
  if (root.kind !== "FETCH" || !root.mapArguments) return errors;

  const rpcRequestFields = rpc.requestType.type.field;

  for (const { sourceField, arg } of root.mapArguments) {
    const messageField = rpcRequestFields.find((f) => f.name === arg);
    if (!messageField) {
      errors.push(
        makeInputMapMissingProtoFieldError({
          parentName: root.parent.name,
          fieldName: root.field.name,
          gql: sourceField, // TODO
          proto: arg, // TODO
          rpcName: root.rpcName,
          requestType: rpc.requestType.type.name,
          path,
        })
      );
    }

    // the "source" passed to the resolver will be the original
    // protobuf message, which is good because we want access to
    // the original data, especially if some fields (like foreign keys)
    // are not exposed in graphql
    const fetchRootParentKey = `${root.parent.name}.${root.field.name}`;
    const possibleSourceMessageTypesNames =
      fetchRootParents.get(fetchRootParentKey) ?? new Set();

    const possibleSourceMessageTypes = Array.from(
      possibleSourceMessageTypesNames
    )
      .map((name) => service.getMessageType(name))
      .filter(isMessageType);

    // the field must exist on every protobuf type that we may
    // encounter from various paths to this fetch root
    const fieldExistsOnProtobuf = possibleSourceMessageTypes.every((proto) =>
      proto.field.find((f) => f.name === sourceField)
    );

    if (!fieldExistsOnProtobuf) {
      errors.push(
        makeInputMapMissingGqlFieldError({
          parentName: root.parent.name,
          fieldName: root.field.name,
          gql: sourceField, // TODO
          proto: arg, // TODO
          rpcName: root.rpcName,
          requestType: rpc.requestType.type.name,
          path,
        })
      );
    }

    if (messageField && fieldExistsOnProtobuf) {
      const protobufFieldTypes = possibleSourceMessageTypes
        .flatMap((proto) => proto.field.filter((f) => f.name === sourceField))
        .map((field) => field.type);
      const uniqueTypes = Array.from(new Set(protobufFieldTypes));

      if (uniqueTypes.length > 1) throw new Error("what do we do here?");

      if (isProtoScalar(messageField.type)) {
        if (uniqueTypes[0] !== messageField.type) {
          errors.push(
            // TODO fix this message!
            makeInputMapMismatchedTypesError({
              parentName: root.parent.name,
              fieldName: root.field.name,
              gql: sourceField, // TODO
              gqlType: uniqueTypes[0],
              proto: arg, // TODO
              protoType: messageField.type,
              rpcName: root.rpcName,
              requestType: rpc.requestType.type.name,
              path,
            })
          );
        }
      } else {
        throw new Error(
          "mapping to object types with @grpc__fetch(mapArguments:) is not supported"
        );
      }
    }
  }

  return errors;
}

/**
 * @param {{
 *  root: import("./typings").FetchRoot<any>;
 *  fetchRootParents:Map<string, Set<string>>;
 *  path: import("./typings").Path;
 *  schema: GraphQLSchema;
 *  service: ProtoService;
 *  rpc: import("@grpc/proto-loader").MethodDefinition<*,*>;
 * }} params
 */
function validateDataloaderArgs({
  root,
  fetchRootParents,
  path,
  schema,
  service,
  rpc,
}) {
  if (root.kind !== "BATCH_FETCH") return [];

  /** @type {import("./typings").ValidationError[]} */
  const errors = [];

  if (root.key.startsWith("$source.")) {
    const sourceField = root.key.replace("$source.", "");
    // the "source" passed to the resolver will be the original
    // protobuf message, which is good because we want access to
    // the original data, especially if some fields (like foreign keys)
    // are not exposed in graphql
    const fetchRootParentKey = `${root.parent.name}.${root.field.name}`;
    const possibleSourceMessageTypesNames =
      fetchRootParents.get(fetchRootParentKey) ?? new Set();

    const possibleSourceMessageTypes = Array.from(
      possibleSourceMessageTypesNames
    )
      .map((name) => service.getMessageType(name))
      .filter(isMessageType);

    // the field must exist on every protobuf type that we may
    // encounter from various paths to this fetch root
    const fieldExistsOnProtobuf = possibleSourceMessageTypes.every((proto) =>
      proto.field.find((f) => f.name === sourceField)
    );

    if (!fieldExistsOnProtobuf) {
      errors.push(
        makeDataloaderIncorrectSourceKeyError({
          key: sourceField,
          path,
          sources: Array.from(possibleSourceMessageTypesNames),
        })
      );
    }
  } else if (root.key.startsWith("$args.")) {
    // compare against _entities(representation)
    if (root.entityType) {
      let { key } = getDirectives(schema, root.entityType);

      if (!key) {
        throw new Error("entity must have a @key"); // TODO
      } else {
        key = Array.isArray(key) ? key : [key]; // NOTE: will be repeatable in a future version
        const keyArg = root.key.replace("$args.", "");
        const keyMatches = key.some(
          (/** @type {{ fields: string; }} */ key) => key.fields === keyArg
        );
        if (!keyMatches) {
          errors.push(
            makeDataloaderIncorrectEntityKeyError({
              keyArg,
              keyFields: key.map(
                (/** @type {{ fields: any; }} */ key) => key.fields
              ),
              path,
            })
          );
        }
      }
    } else {
      const argExists = root.field.args.some(
        (arg) => arg.name === root.key.replace("$args.", "")
      );
      if (!argExists) {
        errors.push(
          makeDataloaderIncorrectArgKeyError({
            key: root.key,
            parentName: root.parent.name,
            fieldName: root.field.name,
            path,
          })
        );
      }
    }
  } else {
    errors.push(makeDataloaderIncorrectKeyFormatError({ path, key: root.key }));
  }

  // ensure that root.listArgument exists on the rpc.requestType.type.field
  const listArgument = rpc.requestType.type.field.some(
    (f) => f.name === root.listArgument
  );
  if (!listArgument) {
    errors.push(
      makeDataloaderIncorrectListArgumentError({
        path,
        listArgument: root.listArgument,
        requestType: rpc.requestType.type.name,
      })
    );
  }

  // responseType = rpc.responseType.type or dig into the response message
  // ensure that the responseKey exists on the response type
  if (root.responseKey) {
    let responseType = rpc.responseType.type;
    if (root.dig) {
      const type = service.digFromType(responseType, root.dig);
      if (type) {
        responseType = type;
        // if null, this will be caught in walkPathsFromRoot
      }
    }

    const validResponseKey = responseType.field.some(
      (f) => f.name === root.responseKey
    );
    if (!validResponseKey) {
      errors.push(
        makeDataloaderIncorrectResponseKeyError({
          path,
          responseKey: root.responseKey,
          responseType: responseType.name,
        })
      );
    }
  }

  return errors;
}
