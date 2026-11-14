#!/usr/bin/env node
// The `thema` command. Run from a clone with `pnpm thema …` until the package is published.
import { main } from "./cli.js";

main(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  cwd: process.env.INIT_CWD ?? process.cwd(),
  env: process.env,
  now: () => new Date(),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
