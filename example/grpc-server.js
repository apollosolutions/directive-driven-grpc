import Mali from "mali";
import { appendFileSync } from "fs";

const app = new Mali("example/protos/service.proto", "Movies");

const impl = {
  /**
   * @param {{ request: { metadata: any; }; req: { ids: any[]; }; res: { movies: any; }; }} ctx
   */
  BatchGetMovies(ctx) {
    console.log(ctx.request.metadata);
    console.log("BatchGetMovies", ctx.req);
    ctx.res = {
      movies: ctx.req.ids.sort().map((id) => ({ id, name: `movie ${id}` })),
    };
  },
  CreateMovie() {},
  DeleteMovie() {},
  /**
   * @param {{ request: { metadata: any; }; req: any; res: { cast: { id: string; }[]; }; }} ctx
   */
  GetCastForMovie(ctx) {
    console.log(ctx.request.metadata);
    console.log("GetCastForMovie", ctx.req);
    ctx.res = {
      cast: [
        {
          id: "person1",
        },
      ],
    };
  },
  /**
   * @param {{ request: { metadata: any; }; req: { id: any; }; res: { movie: { id: any; name: string; rating: number; status: string; sequel: { id: string; name: string; }; directorId: string; }; }; }} ctx
   */
  GetMovie(ctx) {
    console.log(ctx.request.metadata);
    console.log("GetMovie", ctx.req);
    ctx.res = {
      movie: {
        id: ctx.req.id,
        name: "Jaws",
        rating: 4.9,
        status: "RELEASED",
        sequel: { id: "2", name: "Jaws 2 Electric Boogaloo" },
        directorId: "100",
      },
    };
  },
  /**
   * @param {{ request: { metadata: any; }; req: any; res: { movies: { id: string; name: string; rating: number; status: string; sequel: { id: string; name: string; }; directorId: string; }[]; cursor: string; }; }} ctx
   */
  ListMovies(ctx) {
    console.log(ctx.request.metadata);
    console.log("ListMovies", ctx.req);
    ctx.res = {
      movies: [
        {
          id: "1",
          name: "Jaws",
          rating: 4.9,
          status: "RELEASED",
          sequel: { id: "2", name: "Jaws 2 Electric Boogaloo" },
          directorId: "100",
        },
      ],
      cursor: "nextpage",
    };
  },
};

app.use(impl);
app.start(`localhost:50001`);
