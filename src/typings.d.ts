import { EnumTypeDefinition, MessageType } from "@grpc/proto-loader";
import { GraphQLField, GraphQLObjectType } from "graphql";
import { ErrorCodes } from "./errors";

export type FetchRoot<any> = SingleFetchRoot<any> | BatchFetchRoot<any>;

export interface SingleFetchRoot<any> {
  kind: "FETCH";
  parent: GraphQLObjectType;
  field: GraphQLField<any, any>;
  serviceName: string;
  fullyQualifiedServiceName: string;
  rpcName: string;
  dig?: string;
  mapArguments: { sourceField: string; arg: string }[];
  entityType?: GraphQLObjectType;
}

export interface BatchFetchRoot<any> {
  kind: "BATCH_FETCH";
  parent: GraphQLObjectType;
  field: GraphQLField<any, any>;
  serviceName: string;
  fullyQualifiedServiceName: string;
  rpcName: string;
  dig?: string;
  key: string;
  listArgument: string;
  responseKey?: string;
  entityType?: GraphQLObjectType;
}

export interface PathStep {
  gql: { type: GraphQLObjectType; field: GraphQLField };
  protobuf: { type: MessageType };
}

export interface Path {
  root: FetchRoot;
  steps: PathStep[];
}

interface ValidationError {
  code: ErrorCodes;
  key: string;
  message: string;
  path: Path;
}

interface ConsolidatedError {
  code: ErrorCodes;
  message: string;
  paths: Path[];
}

declare module "@grpc/proto-loader" {
  interface Field {
    name: string;
    type: string; // TODO enumerate
    typeName: string;
    label: "LABEL_OPTIONAL" | "LABEL_REPEATED";
  }

  interface MessageType {
    name: string;
    field: Field[];
    enumType: EnumType[];
    nestedType: MessageType[];
  }

  interface MessageTypeDefinition {
    type: MessageType;
  }

  interface EnumType {
    name: string;
    value: {
      name: string;
    }[];
  }

  interface EnumTypeDefinition {
    type: EnumType;
  }
}

interface DataloaderParams {
  key: string;
  listArgument: string;
  responseKey?: string;
}

interface FetchDirective {
  service: string;
  rpc: string;
  dig: string;
  mapArguments?: { sourceField: string; arg: string }[];
  dataloader?: DataloaderParams;
}

interface EntityArgs {
  representations: { __typename: string; [key: string]: any }[];
}

interface ServiceConfig {
  name: string;
  protoFile: string;
  serviceName: string;
  address: string;
  metadata: { name: string; value?: string; valueFrom?: string }[];
}
