import { credentials, loadPackageDefinition } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { get } from "lodash-es";

export class ProtoService {
  /**
   * @param {{
   *  serviceName: string;
   *  address: string;
   *  name: string;
   *  protoFile: string;
   * }} params
   */
  static load({ serviceName, address, name, protoFile }) {
    const definitions = loadSync(protoFile, {
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
    });
  }

  /**
   * @param {{
   *  definitions: import("@grpc/proto-loader").PackageDefinition;
   *  serviceName: string;
   *  address: string;
   *  name: string;
   *  service: import("@grpc/proto-loader").ServiceDefinition
   * }} params
   */
  constructor({ definitions, serviceName, address, name, service }) {
    this.name = name;
    this.definitions = definitions;
    this.namespace = findCommonPrefix(Object.keys(definitions));
    this.serviceName = serviceName;
    this.serviceNameWithoutNamespace = this.serviceName.slice(
      this.namespace.length
    );
    this.address = address;
    this.service = service;
  }

  getClient() {
    this.grpc = this.grpc || loadPackageDefinition(this.definitions);
    const Service = get(this.grpc, this.serviceName);
    return new Service(this.address, credentials.createInsecure());
  }

  /**
   * @param {string} rpcName
   * @param {any} request
   */
  call(rpcName, request) {
    return new Promise((resolve, reject) => {
      this.getClient()[rpcName](
        request,
        (/** @type {any} */ err, /** @type {any} */ response) => {
          if (err) reject(err);
          resolve(response);
        }
      );
    });
  }

  /**
   * @param {string} name
   */
  getType(name) {
    return this.definitions[`${this.namespace}${name}`]?.type;
  }

  /**
   * @param {any} name
   * @param {{ enumType: any[]; }} parent
   * @returns {import("@grpc/proto-loader").EnumTypeDefinition | undefined}
   */
  getNestedEnum(name, parent) {
    if (parent.enumType) {
      return parent.enumType.find((t) => t.name === name);
    }
  }

  getRPCs() {
    return Object.values(this.service);
  }
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
 * @return {obj is import("@grpc/proto-loader").EnumTypeDefinition}
 */
export function isEnumTypeDefinition(obj) {
  return "value" in obj;
}
