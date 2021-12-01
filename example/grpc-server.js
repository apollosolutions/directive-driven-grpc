import Mali from "mali";

const app = new Mali("example/protos/service.proto", "Movies");

/** @typedef {"CONCEPT" | "PREPRODUCTION" | "PRODUCTION" | "POSTPRODUCTION" | "RELEASED"} Status */

/** @type {{ id: any; name: string; rating?: number; status: Status; sequel?: { id: string; name: string; }; directorId: string; }[]} */
const movies = [
  {
    id: "1",
    name: "Iron Man",
    rating: 7.9,
    status: "RELEASED",
    sequel: { id: "3", name: "Iron Man 2" },
    directorId: "100",
  },
  {
    id: "2",
    name: "The Incredible Hulk",
    rating: 6.6,
    status: "RELEASED",
    directorId: "101",
  },
  {
    id: "3",
    name: "Iron Man 2",
    rating: 7,
    status: "RELEASED",
    directorId: "101",
  },
  {
    id: "4",
    name: "Thor",
    rating: 7,
    status: "RELEASED",
    sequel: { id: "8", name: "Thor: The Dark World" },
    directorId: "103",
  },
  {
    id: "5",
    name: "Captain America: The First Avenger",
    rating: 6.9,
    status: "RELEASED",
    sequel: { id: "9", name: "Captain America: The Winter Soldier" },
    directorId: "104",
  },
  {
    id: "6",
    name: "The Avengers",
    rating: 8,
    status: "RELEASED",
    sequel: { id: "11", name: "Avengers: Age of Ultron" },
    directorId: "105",
  },
  {
    id: "7",
    name: "Iron Man 3",
    rating: 7.1,
    status: "RELEASED",
    directorId: "106",
  },
  {
    id: "8",
    name: "Thor: The Dark World",
    rating: 6.8,
    status: "RELEASED",
    sequel: { id: "17", name: "Thor: Ragnarok" },
    directorId: "107",
  },
  {
    id: "9",
    name: "Captain America: The Winter Soldier",
    rating: 7.7,
    status: "RELEASED",
    sequel: { id: "13", name: "Captain America: Civil War" },
    directorId: "108",
  },
  {
    id: "10",
    name: "Guardians of the Galaxy",
    rating: 8,
    status: "RELEASED",
    sequel: { id: "15", name: "Guardians of the Galaxy Vol. 2" },
    directorId: "109",
  },
  {
    id: "11",
    name: "Avengers: Age of Ultron",
    rating: 7.3,
    status: "RELEASED",
    sequel: { id: "18", name: "Avengers: Infinity War" },
    directorId: "105",
  },
  {
    id: "12",
    name: "Ant-Man",
    rating: 7.3,
    status: "RELEASED",
    sequel: { id: "21", name: "Ant-Man and the Wasp" },
    directorId: "110",
  },
  {
    id: "13",
    name: "Captain America: Civil War",
    rating: 7.8,
    status: "RELEASED",
    directorId: "111",
  },
  {
    id: "14",
    name: "Doctor Strange",
    rating: 7.5,
    status: "RELEASED",
    sequel: { id: "27", name: "Doctor Strange and the Multiverse of Madness" },
    directorId: "112",
  },
  {
    id: "15",
    name: "Guardians of the Galaxy Vol. 2",
    rating: 7.6,
    status: "RELEASED",
    directorId: "109",
  },
  {
    id: "16",
    name: "Spider-Man: Homecoming",
    rating: 7.4,
    status: "RELEASED",
    sequel: { id: "23", name: "Spider-Man: Far From Home" },
    directorId: "113",
  },
  {
    id: "17",
    name: "Thor: Ragnarok",
    rating: 7.9,
    status: "RELEASED",
    sequel: { id: "28", name: "Thor: Love and Thunder" },
    directorId: "114",
  },
  {
    id: "18",
    name: "Avengers: Infinity War",
    rating: 8.4,
    status: "RELEASED",
    sequel: { id: "22", name: "Avengers: Endgame" },
    directorId: "108",
  },
  {
    id: "19",
    name: "Black Panther",
    rating: 7.3,
    status: "RELEASED",
    sequel: { id: "29", name: "Black Panther: Wakanda Forever" },
    directorId: "115",
  },
  {
    id: "20",
    name: "Captain Marvel",
    rating: 6.8,
    status: "RELEASED",
    directorId: "116",
  },
  {
    id: "21",
    name: "Ant-Man and the Wasp",
    rating: 7,
    status: "RELEASED",
    directorId: "117",
  },
  {
    id: "22",
    name: "Avengers: Endgame",
    rating: 8.4,
    status: "RELEASED",
    directorId: "108",
  },
  {
    id: "23",
    name: "Spider-Man: Far from Home",
    rating: 7.4,
    status: "RELEASED",
    directorId: "118",
  },
  {
    id: "24",
    name: "Black Widow",
    rating: 6.7,
    status: "RELEASED",
    directorId: "119",
  },
  {
    id: "25",
    name: "Eternals",
    rating: 6.8,
    status: "RELEASED",
    directorId: "120",
  },
  {
    id: "26",
    name: "Shang-Chi and the Legend of the Ten Rings",
    rating: 7.6,
    status: "RELEASED",
    directorId: "121",
  },
  {
    id: "27",
    name: "Doctor Strange and the Multiverse of Madness",
    status: "POSTPRODUCTION",
    sequel: { id: "", name: "" },
    directorId: "122",
  },
  {
    id: "28",
    name: "Thor: Love and Thuder",
    status: "POSTPRODUCTION",
    directorId: "123",
  },
  {
    id: "29",
    name: "Black Panther: Wakanda Forever",
    status: "PRODUCTION",
    directorId: "124",
  },
];

const impl = {
  /**
   * @param {{ request: { metadata: any; }; req: { ids: any[]; }; res: { movies: any; }; }} ctx
   */
  BatchGetMovies(ctx) {
    // console.log(ctx.request.metadata);
    console.log("com.example.Movies/BatchGetMovies", ctx.req);
    ctx.res = {
      movies: movies.filter((movie) => ctx.req.ids.includes(movie.id)),
    };
  },
  CreateMovie() {},
  DeleteMovie() {},
  /**
   * @param {{ request: { metadata: any; }; req: any; res: { cast: { id: string; }[]; }; }} ctx
   */
  GetCastForMovie(ctx) {
    // console.log(ctx.request.metadata);
    console.log("com.example.Movies/GetCastForMovie", ctx.req);
    ctx.res = {
      cast: [
        {
          id: "person1",
        },
      ],
    };
  },
  /**
   * @param {{ request: { metadata: any; }; req: { id: any; }; res: { movie?: { id: any; name: string; rating?: number; status: string; sequel?: { id: string; name: string; }; directorId: string; }; }; }} ctx
   */
  GetMovie(ctx) {
    // console.log(ctx.request.metadata);
    console.log("com.example.Movies/GetMovie", ctx.req);
    ctx.res = {
      movie: movies.find((movie) => movie.id === ctx.req.id),
    };
  },
  /**
   * @param {{ request: { metadata: any; }; req: any; res: { movies: { id: string; name: string; rating?: number; status: string; sequel?: { id: string; name: string; }; directorId: string; }[]; cursor: string; }; }} ctx
   */
  ListMovies(ctx) {
    // console.log(ctx.request.metadata);
    console.log("com.example.Movies/ListMovies", ctx.req);
    ctx.res = {
      movies: movies.slice(
        parseInt(ctx.req.cursor ?? 0, 10),
        ctx.req.limit ?? 10
      ),
      cursor: "nextpage",
    };
  },
};

app.use(impl);
app.start(`localhost:50001`);
console.log("Running gRPC service com.example.Movies at localhost:50001");
