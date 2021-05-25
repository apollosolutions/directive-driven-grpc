import { generate } from "../src/generate.js";

test("kitchen sync", () => {
  expect(
    generate(
      [
        {
          name: "KITCHEN_SINK",
          protoFile: "test/__fixtures__/kitchensink.proto",
          serviceName: "KitchenSink",
          address: "localhost:50051",
          metadata: [],
        },
      ],
      { cwd: process.cwd() }
    )
  ).toMatchSnapshot();
});
