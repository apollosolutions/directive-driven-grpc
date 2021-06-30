#!/usr/bin/env sh

node $(yarn bin)/pm2-runtime start \
  -i ${PROCESS_COUNT:-max} \
  --no-autorestart \
  ./bin/pm2.js \
  -- serve --schema /etc/config/schema.graphql --federated $FEDERATED
