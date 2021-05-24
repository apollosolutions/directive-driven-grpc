import Mali from "mali";

/**
 * @param {any} ctx
 */
function DoSomething(ctx) {
  ctx.res = {
    fieldDouble: 0.1,
    fieldFloat: 0.2,
    fieldInt32: -3,
    fieldInt64: -4,
    fieldUint32: 5,
    fieldUint64: 6,
    fieldSint32: -7,
    fieldSint64: -8,
    fieldFixed32: 9,
    fieldFixed64: 10,
    fieldSfixed32: -11,
    fieldSfixed64: -12,
    fieldBool: true,
    fieldString: JSON.stringify(ctx.req),
    fieldBytes: "1234",

    fieldStrings: ["a", "b", "c"],

    fieldEnum: "two",
    fieldNestedEnum: "four",

    fieldChild: {
      foo: "bar",
    },
    fieldNestedChild: {
      bar: "baz",
    },
    fieldRecursive: {
      depth: 1,
      recursive: {
        depth: 2,
      },
    },
  };
}

/**
 * @param {number} port
 */
export async function run(port) {
  const app = new Mali("test/__fixtures__/kitchensink.proto", "KitchenSink");
  app.use({ DoSomething });
  await app.start(`localhost:${port}`);
  return () => app.close();
}
