import { stripCommand } from "../src/commands.js";

test("make-api-schema", async () => {
  const result = stripCommand({
    schema: "test/__fixtures__/posts.graphql",
    federated: true,
  });

  expect(result).toMatchInlineSnapshot(`
"type Author {
  id: ID
  name: String
}

type Post {
  id: ID
  title: String
  author: Author
}

type Query {
  posts: [Post]
}
"
`);
});
