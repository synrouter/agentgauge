import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeCost } from "../src/attribution/cost.js";
import { bundledPricingTable } from "../src/attribution/pricing.js";
import { attributeSession } from "../src/attribution/tokenize.js";
import { runDetectors } from "../src/detectors/index.js";
import { identify } from "../src/identify/index.js";
import { parseClaudeSessionFile } from "../src/parsers/claude-code.js";
import { buildReportModel } from "../src/render/model.js";

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const fixture = (name: string) => join(root, "examples", name);

export async function sampleReport(name = "noisy-sidechain.jsonl") {
  const session = await parseClaudeSessionFile(fixture(name));
  const identity = identify({
    ...session,
    sourcePath: "/Users/example/.claude/projects/project/session.jsonl",
  });
  const attribution = attributeSession(session, identity);
  const cost = computeCost(attribution, bundledPricingTable());
  const findings = runDetectors({ session, attribution, cost, agent: identity });
  const report = buildReportModel({
    version: "0.1.0",
    sessions: [session],
    identity,
    attribution,
    cost,
    findings,
  });
  return { session, identity, attribution, cost, findings, report };
}
