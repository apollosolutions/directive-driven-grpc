Validation algorithm:

1. find all fields marked with @grpc\_\_fetch. these are the "fetch roots".
2. for each fetch root, walk the graph to find all possible paths.
   - a path ends at a scalar or at another fetch root.
   - if type recursion is encountered, the field must be nullable and we can end a path here as well.
3. in the fetch root field, validate that the field arguments match the RPC request type.
4. for each path, validate that:
   - scalar/enum fields match the fields on RPC response type in name and type.
   - recursively walk composite fields and continue to match scalar/enum fields.

Boilerplate generation algorithm:

1. create a grpc\_\_Service enum for the service.
2. create a Mutation field for each RPC. add a @grpc\_\_fetch directive on each.
3. request types are input arguments.
4. recursively create types and enums for response types.

TODO:

- for nested fetch fields, need to know the parent protobuf type for input maps
- oneof => union (oneof scalars are not allowed ... StringBox/IntBox?)
- entity resolvers
- validation rules:
  - root fields must have a fetch directive
  - wrap/rename can't exist on the same field
  - gql: args in wrap and fetch(input) must match types
  - @key must have a @grpc\_\_resolveEntity
- headers->metadata
- nested types ... do i need to walk up the chain to find them in a parent type?
- bytes input encoding issue
- unreachable fields?
- find proto files relative to schema file

issues:

- can't use input object types in directives because of a bug in apollo-graphql (used by @apollo/federation)
