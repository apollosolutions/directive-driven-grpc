import Mali from "mali";

/**
 * @param {any[]} recorder
 * @returns {(_: any) => void}
 */
const ListPosts = (recorder) => (ctx) => {
  recorder.push(["ListPosts", ctx.req]);
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
 * @param {any[]} recorder
 * @returns {(_: any) => void}
 */
const BatchGetPosts = (recorder) => (ctx) => {
  recorder.push(["BatchGetPosts", ctx.req]);
  ctx.res = {
    posts: ctx.req.ids?.map((/** @type {string} */ id) => {
      return {
        id,
        title: `Post ${id}`,
      };
    }),
  };
};

/**
 * @param {any[]} recorder
 * @returns {(_: any) => void}
 */
const GetAuthor = (recorder) => (ctx) => {
  recorder.push(["GetAuthor", ctx.req]);
  ctx.res = {
    author: {
      id: ctx.req.id,
      name: `Author ${ctx.req.id}`,
    },
  };
};

/**
 * @param {any[]} recorder
 * @returns {(_: any) => void}
 */
const BatchGetAuthors = (recorder) => (ctx) => {
  recorder.push(["BatchGetAuthors", ctx.req]);
  ctx.res = {
    authors: ctx.req.ids?.map((/** @type {string} */ id) => {
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
    BatchGetPosts: BatchGetPosts(requests),
    GetAuthor: GetAuthor(requests),
    BatchGetAuthors: BatchGetAuthors(requests),
  });
  await app.start(`localhost:${port}`);
  return [requests, () => app.close()];
}
