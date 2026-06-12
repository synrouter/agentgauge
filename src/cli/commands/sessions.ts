import { defineCommand } from "citty";
import { invalidLastMessage, selectorFromOptions } from "../../lib/analysis.js";
import { EXIT } from "../../lib/exit.js";
import { discoverClaudeSessionFiles } from "../../lib/glob.js";

export const sessionsCommand = defineCommand({
  meta: { name: "sessions", description: "List discovered sessions" },
  args: {
    json: { type: "boolean", required: false },
    limit: { type: "string", required: false },
    sortBy: { type: "string", required: false },
    all: { type: "boolean", required: false },
    project: { type: "string", alias: "p", required: false },
    session: { type: "string", required: false },
    since: { type: "string", required: false },
    until: { type: "string", required: false },
    last: { type: "string", required: false },
  },
  async run({ args }) {
    const lastError = invalidLastMessage(args.last);
    if (lastError) {
      console.error(lastError);
      process.exitCode = EXIT.USAGE;
      return;
    }
    const files = await discoverClaudeSessionFiles(selectorFromOptions(args));
    // Sortable from file metadata alone: time (mtime, default) and id.
    // cost/tokens/turns need a full parse of every file; deferred to v0.2.
    const sorted =
      args.sortBy === "id"
        ? [...files].sort((a, b) => a.sessionId.localeCompare(b.sessionId))
        : files;
    if (args.sortBy && !["time", "id"].includes(args.sortBy)) {
      console.error(`Unsupported --sort-by "${args.sortBy}" (supported: time, id). Using time.`);
    }
    const limit = Number(args.limit ?? 50);
    const rows = sorted.slice(0, Number.isFinite(limit) ? limit : 50);
    if (rows.length === 0) {
      console.error("No Claude Code sessions found.");
      process.exitCode = EXIT.NO_DATA;
      return;
    }
    if (args.json) {
      process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
      return;
    }
    process.stdout.write("ID         AGENT         PROJECT      WHEN\n");
    for (const row of rows) {
      process.stdout.write(
        `${row.sessionId.slice(0, 10).padEnd(10)} claude-code   ${row.projectName.padEnd(12)} ${new Date(row.mtimeMs).toISOString()}\n`,
      );
    }
  },
});
