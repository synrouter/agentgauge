#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const built = join(root, "dist", "cli.js");
const source = join(root, "src", "cli.ts");
const target = existsSync(built) ? built : source;
const command = process.execPath;
const commandArgs = existsSync(built)
  ? [target, ...process.argv.slice(2)]
  : ["--import", "tsx", target, ...process.argv.slice(2)];
const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 0);
