#!/usr/bin/env node

import meow from "meow";
import { generate } from "../src/generate.js";
import { validate } from "../src/validate.js";
import { convertFederationSdl } from "../src/graphql.js";
import { readFileSync } from "fs";

const cli = meow(
  `
	Usage
	  $ graphql-grpc generate --proto file.proto --service com.example.ServiceName --name SERVICE --address localhost:50051
    $ graphql-grpc validate --schema schema.graphql

	Options
	  --rainbow, -r  Include a rainbow
`,
  {
    importMeta: import.meta,
    flags: {
      proto: {
        type: "string",
        alias: "p",
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
    },
  }
);

if (cli.input[0] === "generate") {
  if (!cli.flags.name) {
    console.error("--name missing");
    process.exit(1);
  }
  if (!cli.flags.proto) {
    console.error("--proto missing");
    process.exit(1);
  }
  if (!cli.flags.service) {
    console.error("--service missing");
    process.exit(1);
  }
  if (!cli.flags.address) {
    console.error("--address missing");
    process.exit(1);
  }

  console.log(
    generate([
      {
        name: cli.flags.name,
        protoFile: cli.flags.proto,
        serviceName: cli.flags.service,
        address: cli.flags.address,
      },
    ])
  );
} else if (cli.input[0] === "validate") {
  if (!cli.flags.schema) {
    console.error("--schema missing");
    process.exit(1);
  }
  const sdl = convertFederationSdl(readFileSync(cli.flags.schema, "utf-8"));
  const errors = validate(sdl);
  if (errors.length) {
    errors.map((e) => console.log(e));
    process.exit(1);
  } else {
    console.log("Valid schema");
  }
} else {
  console.error("invalid command");
  process.exit(1);
}
