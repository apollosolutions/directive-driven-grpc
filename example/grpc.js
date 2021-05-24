import Mali from "mali";

const app = new Mali("example/protos/service.proto", "Movies");

const impl = {
  BatchGetMovies(ctx) {
    console.log("BatchGetMovies", ctx.req);
    ctx.res = {
      movies: ctx.req.ids.map((id) => ({ id })),
    };
  },
  CreateMovie() {},
  DeleteMovie() {},
  GetCastForMovie(ctx) {
    console.log("GetCastForMovie", ctx.req);
    ctx.res = {
      cast: [
        {
          id: "person1",
        },
      ],
    };
  },
  GetMovie(ctx) {
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
  ListMovies(ctx) {
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
app.start("localhost:50001");
