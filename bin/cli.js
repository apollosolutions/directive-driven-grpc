#!/usr/bin/env node

import meow from "meow";
import {
  generateCommand,
  serveCommand,
  validateCommand,
  stripCommand,
} from "../src/commands.js";

const cli = meow(
  `
	Usage
    $ schema-driven-grpc generate --proto file.proto --service com.example.ServiceName --name SERVICE --address localhost:50051
    $ schema-driven-grpc validate --schema schema.graphql [--federated] [--watch]
    $ schema-driven-grpc serve --schema schema.graphql [--port 4000] [--federated]
    $ schema-driven-grpc make-api-schema --schema schema.graphql
`,
  {
    importMeta: import.meta,
    flags: {
      proto: {
        type: "string",
        alias: "d",
      },
      service: {
        type: "string",
        alias: "s",
      },
      name: {
        type: "string",
        alias: "n",
      },
      address: {
        type: "string",
        alias: "a",
      },
      schema: {
        type: "string",
        alias: "g",
      },
      port: {
        type: "string",
        alias: "p",
      },
      federated: {
        type: "boolean",
        default: false,
      },
      watch: {
        type: "boolean",
        default: false,
      },
    },
  }
);

switch (cli.input[0]) {
  case "generate":
    generateCommand(cli.flags);
    break;
  case "validate":
    validateCommand(cli.flags);
    break;
  case "serve":
    serveCommand(cli.flags);
    break;
  case "make-api-schema":
    stripCommand(cli.flags);
    break;
  default:
    console.error("invalid command");
    process.exit(1);
}
