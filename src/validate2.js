import { getDirectives } from "@graphql-tools/utils";
import { GraphQLSchema, isObjectType } from "graphql";

/**
 * @param {GraphQLSchema} schema
 * @returns {(import("./typings").FetchRoot)[]}
 */
export function findFetchRoots(schema) {
  const rootTypes = Object.values(schema.getTypeMap()).filter(isObjectType);

  const rootFieldsWithParent = rootTypes.flatMap((o) => {
    const fields = Object.values(o.getFields()) ?? [];
    return fields.map((f) => ({ parentName: o.name, field: f }));
  });

  const results = rootFieldsWithParent.map(({ parentName, field }) => {
    const { grpc__fetch, grpc__batchFetch } = getDirectives(schema, field);

    if (grpc__fetch) {
      const {
        service: serviceName,
        rpc: rpcName,
        dig,
        input: inputMap,
      } = grpc__fetch;

      return {
        kind: /** @type {"FETCH"} */ ("FETCH"),
        parentName,
        field,
        serviceName,
        rpcName,
        dig,
        inputMap,
      };
    } else if (grpc__batchFetch) {
      const {
        service: serviceName,
        rpc: rpcName,
        dig,
        key,
        listArgument,
        responseKey,
      } = grpc__batchFetch;

      return {
        kind: /** @type {"BATCH_FETCH"} */ ("BATCH_FETCH"),
        parentName,
        field,
        serviceName,
        rpcName,
        dig,
        key,
        listArgument,
        responseKey,
      };
    }
  });

  return results.filter(
    /** @type {(_: any) => _ is any} } */
    ((o) => !!o)
  );
}
