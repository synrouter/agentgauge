import { readFileSync } from "node:fs";
import { relative } from "node:path";
import fg from "fast-glob";

const allowed = "src/cli/commands/update-pricing.ts";
const forbidden = [
  /from\s+["']node:(?:http|https|net)["']/,
  /from\s+["'](?:undici|node-fetch)["']/,
  /\bfetch\s*\(/,
];

let failed = false;
for (const file of await fg(["src/**/*.ts"], { absolute: false })) {
  if (file === allowed) continue;
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`Network primitive found in ${relative(process.cwd(), file)}: ${pattern}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
