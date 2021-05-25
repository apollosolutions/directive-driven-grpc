# schema-driven-grpc

A directive-driven runtime and schema validator for gRPC-backed GraphQL APIs.

## ⚠️ Disclaimer ⚠️

This project is experimental and is not a fully-supported Apollo Graph project.
We may not respond to issues and pull requests at this time.
See [Known Limitations](#known-limitations).

## Usage

Generate a GraphQL schema from a Protocol Buffer IDL. The result is most likely
not the GraphQL API you want, but it's a good starting point!

### Generate some boilerplate

```sh
npx github:apollosolutions/schema-driven-grpc generate --proto file.proto \
   --service com.example.ServiceName \
   --name SERVICE \
   --address localhost:50051
```

### Validate that your schema matches your protocol buffers

Validate a schema against a Protocol Buffer IDL, ensuring that the runtime
behavior will work against a gRPC API.

```sh
npx github:apollosolutions/schema-driven-grpc validate --schema schema.graphql --federated
```

(You can also pass `--watch` to continuously validate your schema during development.)

### Serve your GraphQL API

Serve a GraphQL API in front of a gRPC API.

```sh
npx github:apollosolutions/schema-driven-grpc serve --schema schema.graphql \
   --federated \
   --port 4000
```

## Directives

- [`@grpc`](#grpc)
- [`@grpc__fetch`](#grpc__fetch)
  - [`dig` argument](#dig-argument)
  - [`mapArguments` argument](#mapArguments-argument)
  - [`dataloader` argument](#dataloader-argument)
  - [Entity Resolvers](#entity-resolvers)
- [`@grpc__renamed`](#grpc__renamed)
- [`@grpc__wrap`](#grpc__wrap)

### `@grpc`

Apply this directive to values in an enum in order to define:

1. The location of the `.proto` files (relative to this GraphQL schema file).
2. The fully-qualified service name.
3. The gRPC service address.
4. Any client metadata (i.e. headers).

```graphql
enum grpc__Service {
  MY_SERVICE
    @grpc(
      protoFile: "path/relative/to/schema/file/service.proto"
      serviceName: "com.example.MyService"
      address: "localhost:50051"
      metadata: [
        { name: "authorization", valueFrom: "req.headers.authorization" }
        { name: "headername", value: "staticvalue" }
      ]
    )
}
```

### `@grpc__fetch`

Add the fetch directive to any field on any object type, including the Query and
Mutation types. Reference a service with its annotated enum value.

```graphql
type Query {
  post(id: ID!): Post! @grpc__fetch(service: MY_SERVICE, rpc: "GetPost")
}

type Post {
  id: ID!
  comments: [Comment]
    # you'll most likely need the mapArguments and dig arguments; see below
    @grpc__fetch(service: MY_SERVICE, rpc: "GetCommentsForPost")
}
```

#### `dig` argument

It's common to use a response message in gRPC, while in GraphQL you may not want
that extra layer. Use the `dig` argument to "dig" a value out of the response
message.

```proto
service MyService {
   rpc GetPost (GetPostRequest) returns (GetPostResponse) {}
}

message GetPostRequest {
   string id = 1;
}

message GetPostResponse {
   Post post = 1;
}
```

```graphql
type Query {
  post(id: ID!): Post!
    @grpc__fetch(service: MY_SERVICE, rpc: "GetPost", dig: "post")
}
```

#### `mapArguments` argument

Use the `mapArguments` argument to pluck values off the parent object for use
as fields on the request message. In this example, the `Post` Protocol Buffer
message has an `author_id` field (which we don't expose in GraphQL). We can
pass that value as the `id` field of the `GetPerson` request message.

```graphql
type Post {
  id: ID!
  author: Person
    @grpc__fetch(
      service: MY_SERVICE
      rpc: "GetPerson"
      mapArguments: { sourceField: "author_id", arg: "id" }
    )
}
```

#### `dataloader` argument

To efficiently batch RPCs and avoid the N+1 query problem, use the `dataloader`
argument. You can specify the cache key, the RPC request message field for the
list of cache keys, and the field that must match the cache key to correctly
store the response message for the lifetime of the request.

```graphql
type Post {
  id: ID!
  author: Person
    @grpc__fetch(
      service: MY_SERVICE
      rpc: "BatchGetPerson"
      dataloader: {
        key: "$source.author_id" # value on parent message
        listArgument: "ids" # field on the request type
        responseKey: "id" # field on the items in the response type that must match the key
      }
    )
}
```

The `dataloader.key` argument can come from the parent message
(`$source.author_id`) or from the field arguments (`$args.id`). The latter is
used mostly in [Entity Resolvers](#entity-resolvers), but you can also use it
in other fields if you want to aggressively cache-and-batch RPCs.

```graphql
type Query {
  post(id: ID!): Post
    @grpc__fetch(
      service: POSTS
      rpc: "BatchGetPosts"
      dig: "posts"
      dataloader: { key: "$args.id", listArgument: "ids", responseKey: "id" }
    )
}

type Post {
  id: ID
  title: String
}
```

#### Entity Resolvers

When using Apollo Federation, you can add the fetch directive to object types as
well to create the equivalent of the [`__resolveReference`][refs] resolver.

[refs]: https://www.apollographql.com/docs/federation/entities/#resolving

```graphql
type Post
  @key(fields: "id")
  @grpc__fetch(
    service: MY_SERVICE
    rpc: "BatchGetPosts"
    dig: "posts"
    dataloader: { key: "$args.id", listArgument: "ids", responseKey: "id" }
  ) {
  id: ID!
  title: String
}
```

In this example, `$args` refers to the entity representation passed to
`__resolveReference`.

### `@grpc__renamed`

The renamed directive allows renaming elements from your gRPC API. You can
rename field arguments:

```graphql
type Query {
  product(id: ID! @grpc__renamed(from: "sku")): Product
    @grpc__fetch(service: PRODUCTS, rpc: "GetProduct")
}
```

Fields:

```graphql
type Product {
  price: Int @grpc__renamed(from: "amount")
}
```

Enum values:

```graphql
enum Status {
  AVAILABLE
  UNAVAILABLE @grpc__renamed(from: "NOT_AVAILABLE")
}
```

### `@grpc__wrap`

Takes a value off the Protocol Buffer message and wraps it in separate GraphQL
type. The primary use-case is converting foreign keys into nested objects
(especially useful in federation if the nested object is an entity provided by
another service.)

```proto
message Post {
   string id = 1;
   string title = 2;
   string author_id = 3;
}
```

```graphql
type Post {
  id: ID!
  title: String
  author: Person @grpc__wrap(gql: "id", proto: "author_id")
}

type Person @key(fields: "id") @extends {
  id: ID! @external
}
```

## Usage in your own GraphQL server

```sh
npm i github:apollosolutions/schema-driven-grpc#v0.1.0
```

This library exports two functions for loading the schema and providing the
resolver function:

```js
import { load, makeFieldResolver } from "@apollosolutions/schema-driven-grpc";

const { schema, services } = load("path/to/schema.graphql", {
  federated: true,
});

const server = new ApolloServer({
  schema,
  fieldResolver: makeFieldResolver(services),
  plugins: [ApolloServerPluginInlineTraceDisabled()],
  context(args) {
    return args; // used for metadata
  },
});

server
  .listen(4000)
  .then(({ url }) => console.log(`Running GraphQL API at ${url}`));
```

## Known Limitations

- gRPC client credentials are currently hardcoded to `createInsecure` (appropriate
  when you're using a service mesh that supports mutual TLS, but otherwise not a
  good idea).
- Will not support protocol buffer Maps.
- Does not yet support protocol buffer `oneof`.
- Supports only the `proto3` syntax.
- Does not validate non-nullability/`required`.
- To use the `metadata` argument in `@grpc`, you must create a GraphQL context
  object for each request that maps to your `valueFrom` arguments.
- Support for protocol buffer `bytes` field types is buggy.
- Does not support Apollo Federation subgraph introspection (the
  `{ _service { sdl } }` operation).

## Notes

### Validation algorithm

1. Find all fields and entity types marked with `@grpc__fetch`. These are the
   "fetch roots".
2. For each fetch root, walk the graph and compare GraphQL fields against the
   relevant Protocol Buffer message, starting with the RPC response type.
   Because RPC APIs are not recursive, all paths must terminate.
   - A path terminates at scalar or enum fields, or at another fetch root.
   - If type recursion is encountered, the field must be nullable and we can end
     a path here as well.
3. At each node in the graph, check that field names and type match (taking
   rename directives into account).
4. Validate that the field arguments on a fetch root match the fields on the RPC
   request type.

### Boilerplate generation algorithm

1. Create a `grpc__Service` enum value for the service.
2. Create a Mutation field for each RPC (there's no way to differentiate between
   side-effectful and side-effectless RPCs, so we must assume they're all
   mutations). Add a `@grpc__fetch` directive on each.
3. Use RPC request types to create field arguments.
4. Recursively create types and enums starting with RPC response types.

## Future ideas

- [ ] Additional validation rules:
  - [ ] Root fields must have a fetch directive.
  - [ ] Wrap and Rename directives can't exist on the same field.
  - [ ] Federation: `@key`d entities must have a `@grpc__fetch` directive.
  - [ ] Disallow unreachable fields?
- [ ] Support error unions?
- [ ] Subscriptions with gRPC streams?
