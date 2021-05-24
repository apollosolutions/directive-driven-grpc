import Mali from "mali";

const ListPosts = (recorder) => (ctx) => {
  recorder.push(ctx.req);
  ctx.res = {
    posts: [
      {
        id: "1",
        title: "Post 1",
        authorId: "1",
      },
      {
        id: "2",
        title: "Post 2",
        authorId: "1",
      },
      {
        id: "3",
        title: "Post 3",
        authorId: "2",
      },
    ],
  };
};

/**
 * @param {any} ctx
 */
const GetAuthor = (recorder) => (ctx) => {
  recorder.push(ctx.req);
  ctx.res = {
    author: {
      id: ctx.req.id,
      name: `Author ${ctx.req.id}`,
    },
  };
};

/**
 * @param {{ req: { ids: string[] }, res: any }} ctx
 */
const BatchGetAuthors = (recorder) => (ctx) => {
  recorder.push(ctx.req);
  ctx.res = {
    authors: ctx.req.ids?.map((id) => {
      return {
        id,
        name: `Author ${id}`,
      };
    }),
  };
};

/**
 * @param {number} port
 * @returns {Promise<[any[], () => Promise<void>]>}
 */
export async function run(port) {
  /** @type {any[]} */
  const requests = [];
  const app = new Mali("test/__fixtures__/posts.proto", "Posts");
  app.use({
    ListPosts: ListPosts(requests),
    GetAuthor: GetAuthor(requests),
    BatchGetAuthors: BatchGetAuthors(requests),
  });
  await app.start(`localhost:${port}`);
  return [requests, () => app.close()];
}
