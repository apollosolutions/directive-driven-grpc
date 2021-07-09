#!/usr/bin/env sh

node ./bin/cli.js serve \
  --schema ${SCHEMA_FILE:-/etc/config/schema.graphql} \
  --federated ${FEDERATED:-false} \
  --port ${PORT:-4000}
