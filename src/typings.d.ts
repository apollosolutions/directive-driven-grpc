import { GraphQLField } from "graphql";

type ProtobufScalarName =
  | "TYPE_DOUBLE"
  | "TYPE_FLOAT"
  | "TYPE_INT64"
  | "TYPE_UINT64"
  | "TYPE_INT32"
  | "TYPE_FIXED64"
  | "TYPE_FIXED32"
  | "TYPE_SFIXED32"
  | "TYPE_SFIXED64"
  | "TYPE_SINT32"
  | "TYPE_SINT64"
  | "TYPE_UINT32"
  | "TYPE_BOOL"
  | "TYPE_BYTES"
  | "TYPE_STRING";

export interface PathPart {
  field: string;
  type: string;
  parentType: string;
  isList: boolean;
  isNonNull: boolean;
  rpcName: string;
  isLeaf: boolean;
  isRecursive: boolean;
  isWrapped: boolean;
}

export interface NewPathPart {
  gql: {
    parentType: string;
    fieldName: string;
    namedType: string;
    isList: boolean;
    isNonNull: boolean;
  };
  protobuf: {
    parentType: string;
    fullyQualifiedParentType: string;
    fieldName: string;
    type: ProtobufScalarName | "TYPE_ENUM" | "TYPE_MESSAGE";
    typeName: string;
    fullyQualifiedTypeName: string;
    isRepeated: boolean;
  };
  isLeaf: boolean;
  isRecursive: boolean;
  isWrapped: boolean;
}

export interface Path {
  root: FetchRoot;
  parts: NewPathPart[];
}

export type FetchRoot = SingleFetchRoot | BatchFetchRoot;

export interface SingleFetchRoot {
  kind: "FETCH";
  parentName: string;
  field: GraphQLField;
  serviceName: string;
  rpcName: string;
  dig?: string;
  inputMap?: { gql: string; proto: string }[];
}

export interface BatchFetchRoot {
  kind: "BATCH_FETCH";
  parentName: string;
  field: GraphQLField;
  serviceName: string;
  rpcName: string;
  dig?: string;
  key: string;
  listArgument: string;
  responseKey?: string;
}
