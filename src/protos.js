import { getDirectives } from "@graphql-tools/utils";
import { credentials, loadPackageDefinition, Metadata } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { GraphQLSchema, isEnumType } from "graphql";
import { get, toPath } from "lodash-es";
import { resolve } from "path";

export const grpcServiceEnumName = "grpc__Service";

/**
 * @param {GraphQLSchema} schema
 * @param {{ cwd: string }} options
 * @returns {Map<string, ProtoService>}
 */
export function findServices(schema, { cwd }) {
  const servicesEnum = Object.values(schema.getTypeMap()).find(
    (d) => isEnumType(d) && d.name === grpcServiceEnumName
  );

  if (!isEnumType(servicesEnum)) {
    return new Map();
  }

  const services =
    servicesEnum.getValues().map((v) => {
      const { grpc } = getDirectives(schema, v);
      if (!grpc) return;

      const { serviceName, address, protoFile, metadata } = grpc;
      if (!serviceName || !address || !protoFile) return;

      return ProtoService.load(
        {
          serviceName,
          address,
          name: v.name,
          protoFile,
          metadata,
        },
        { cwd }
      );
    }) ?? [];

  const result = new Map();
  for (const service of services) {
    if (service) {
      result.set(service.name, service);
    }
  }

  return result;
}

export class ProtoService {
  /**
   * @param {import("./typings").ServiceConfig} params
   * @param {{ cwd: string }} options
   */
  static load({ serviceName, address, name, protoFile, metadata }, { cwd }) {
    const definitions = loadSync(resolve(cwd, protoFile), {
      keepCase: true,
      longs: String,
      enums: String,
      bytes: String,
    });

    const service = definitions[serviceName];
    if (!isServiceDefinition(service))
      throw new Error(`Service "${serviceName} not found`);

    return new this({
      definitions,
      serviceName,
      service,
      address,
      name,
      metadata,
    });
  }

  /**
   * @param {{
   *  definitions: import("@grpc/proto-loader").PackageDefinition;
   *  serviceName: string;
   *  address: string;
   *  name: string;
   *  service: import("@grpc/proto-loader").ServiceDefinition;
   *  metadata: { name: string; value?: string; valueFrom?: string }[]
   * }} params
   */
  constructor({ definitions, serviceName, address, name, service, metadata }) {
    this.name = name;
    this.definitions = definitions;
    this.namespace = findCommonPrefix(Object.keys(definitions));
    this.serviceName = serviceName;
    this.address = address;
    this.service = service;
    this.metadata = metadata;
  }

  getClient() {
    this.grpc = this.grpc ?? loadPackageDefinition(this.definitions);
    if (!this.client) {
      const Service = get(this.grpc, this.serviceName);
      this.client = new Service(this.address, credentials.createInsecure());
    }
    return this.client;
  }

  /**
   * @param {string} rpcName
   * @param {any} request
   * @param {any} ctx
   */
  call(rpcName, request, ctx) {
    const metadata = processMetadata(this.metadata, ctx);

    return new Promise((resolve, reject) => {
      this.getClient()[rpcName](
        request,
        metadata,
        (/** @type {any} */ err, /** @type {any} */ response) => {
          if (err) reject(err);
          resolve(response);
        }
      );
    });
  }

  /**
   * @param {string} name
   * @param {import("@grpc/proto-loader").MessageType?} [parent]
   * @returns {import("@grpc/proto-loader").MessageType | undefined}
   */
  getMessageType(name, parent) {
    if (parent?.nestedType) {
      const nested = parent.nestedType.find((t) => t.name === name);
      if (nested) return nested;
    }

    const definition = this.definitions[`${this.namespace}${name}`];
    if (isMessageTypeDefinition(definition)) return definition.type;
  }

  /**
   * @param {string} name
   * @param {import("@grpc/proto-loader").MessageType?} [parent]
   * @returns {import("@grpc/proto-loader").EnumType | undefined}
   */
  getEnumType(name, parent) {
    if (parent?.enumType) {
      const nested = parent.enumType.find((t) => t.name === name);
      if (nested) return nested;
    }

    const definition = this.definitions[`${this.namespace}${name}`];
    if (isEnumTypeDefinition(definition)) return definition.type;
  }

  /**
   * @param {string} name
   */
  getRPC(name) {
    return this.service[name];
  }

  /**
   * @param {import("@grpc/proto-loader").MessageType} startingType
   * @param {string} dig - dot-delimited string
   * @returns {import("@grpc/proto-loader").MessageType | null}
   */
  digFromType(startingType, dig) {
    const path = toPath(dig);

    /** @type {import("@grpc/proto-loader").MessageType | undefined} */
    let type = startingType;

    /** @type {string | undefined} */
    let fieldName;

    while ((fieldName = path.pop())) {
      const field = type.field.find((f) => f.name === fieldName);
      if (field) {
        type = this.getMessageType(field.typeName);
        if (!type) return null;
      } else {
        return null;
      }
    }

    return type;
  }
}

/**
 * @param {{ name: string; value?: string; valueFrom?: string }[] | undefined} metadata
 * @param {any} context - GraphQL request context
 */
function processMetadata(metadata, context) {
  const grpcMeta = new Metadata();
  if (!metadata) return grpcMeta;

  for (const { name, value, valueFrom } of metadata) {
    if (value) {
      grpcMeta.add(name, value);
    } else if (valueFrom) {
      grpcMeta.add(name, get(context, valueFrom));
    }
  }

  return grpcMeta;
}

/**
 * @param {string[]} strings
 */
function findCommonPrefix(strings) {
  return strings.reduce((ns, d) => {
    if (!d.startsWith(ns)) {
      let common = "";
      let i = 0;
      while (i < d.length && i < ns.length && d[i] === ns[i]) {
        common += d[i];
        i++;
      }
      return common;
    }
    return ns;
  });
}

/**
 * @param {any} obj
 * @return {obj is import("@grpc/proto-loader").ServiceDefinition}
 */
export function isServiceDefinition(obj) {
  return Object.values(obj).every(isMethodDefinition);
}

/**
 * @param {any} obj
 * @return {obj is import("@grpc/proto-loader").MethodDefinition<*,*,*,*>}
 */
export function isMethodDefinition(obj) {
  return "path" in obj;
}

/**
 * @param {any} obj
 * @return {obj is import("@grpc/proto-loader").MessageTypeDefinition}
 */
export function isMessageTypeDefinition(obj) {
  return obj.format?.includes("DescriptorProto");
}

/**
 * @param {any} obj
 * @return {obj is import("@grpc/proto-loader").MessageType}
 */
export function isMessageType(obj) {
  return "field" in obj;
}

/**
 * @param {any} obj
 * @return {obj is import("@grpc/proto-loader").EnumTypeDefinition}
 */
export function isEnumTypeDefinition(obj) {
  return obj.format?.includes("EnumDescriptorProto");
}
