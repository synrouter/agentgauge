import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineCommand } from "citty";
import { analyze } from "../../lib/analysis.js";
import { EXIT } from "../../lib/exit.js";
import { formatIsoMinute } from "../../lib/time.js";
import { renderHtml, renderJson, renderTerminal } from "../../render/index.js";
import { list, numberArg, severity, stringOrTrue } from "../args.js";

function htmlPath(value: unknown, outputDir: string | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string" && value !== "true") return value;
  return join(outputDir ?? process.cwd(), `agentgauge-report-${formatIsoMinute()}.html`);
}

export const analyzeCommand = defineCommand({
  meta: {
    name: "analyze",
    description: "Analyze Claude Code session logs",
  },
  args: {
    last: {
      type: "string",
      required: false,
      description: "Analyze the latest session, or a duration like 7d/24h",
    },
    since: { type: "string", required: false },
    until: { type: "string", required: false },
    all: { type: "boolean", required: false },
    project: { type: "string", alias: "p", required: false },
    session: { type: "string", required: false },
    agent: { type: "string", required: false },
    model: { type: "string", required: false },
    json: { type: "boolean", required: false },
    html: { type: "string", required: false },
    outputDir: { type: "string", required: false },
    quiet: { type: "boolean", alias: "q", required: false },
    verbose: { type: "boolean", alias: "v", required: false },
    topN: { type: "string", required: false },
    includeContent: { type: "boolean", required: false },
    detectors: { type: "string", required: false },
    skipDetectors: { type: "string", required: false },
    minSeverity: { type: "string", required: false },
    minSavings: { type: "string", required: false },
  },
  async run({ args }) {
    if (args.json && (args.quiet || args.verbose)) {
      console.error("--json cannot be combined with --quiet or --verbose");
      process.exitCode = EXIT.USAGE;
      return;
    }
    const result = await analyze({
      all: args.all,
      last: args.all ? undefined : stringOrTrue(args.last),
      since: args.since,
      until: args.until,
      project: args.project,
      session: args.session,
      agent: args.agent,
      model: args.model,
      detectors: list(args.detectors),
      skipDetectors: list(args.skipDetectors),
      minSeverity: severity(args.minSeverity),
      minSavings: numberArg(args.minSavings),
      warn: (message) => console.error(message),
    });
    if (!result) {
      console.error(
        "No Claude Code session data found. Run `agentgauge doctor` for setup suggestions.",
      );
      process.exitCode = EXIT.NO_DATA;
      return;
    }
    const outHtml = htmlPath(args.html, args.outputDir);
    if (outHtml) {
      const html = renderHtml(result.report);
      if (outHtml === "-") {
        process.stdout.write(html);
      } else {
        mkdirSync(dirname(outHtml), { recursive: true });
        writeFileSync(outHtml, html);
        console.error(`Wrote ${outHtml} (${Buffer.byteLength(html)} bytes)`);
      }
    }
    if (args.json) {
      process.stdout.write(renderJson(result.report));
      return;
    }
    if (!args.html || outHtml !== "-") {
      process.stdout.write(
        renderTerminal(result.report, {
          quiet: args.quiet,
          topN: numberArg(args.topN),
          color: Boolean(process.stdout.isTTY && !process.env.NO_COLOR),
        }),
      );
    }
  },
});
