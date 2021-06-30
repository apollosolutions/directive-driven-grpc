/**
 * PM2 has a bug when running in cluster mode + no-daemon where it passes
 * all arguments to the worker script, and then duplicates the worker args.
 *
 * This script works around the bug by:
 *  * removing everything before the --
 *  * removing redundant worker args
 *  * calling cli.js
 */
const argStart = process.argv.findIndex((v) => v === "--");

process.argv = [
  "node",
  "cli.js",
  ...process.argv.slice(
    argStart + 1,
    argStart + 1 + (process.argv.length - argStart) / 2
  ),
];

import("./cli.js");
