import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeCost } from "../attribution/cost.js";
import { loadPricingTable } from "../attribution/pricing.js";
import { attributeSession, zeroAttribution } from "../attribution/tokenize.js";
import { type DetectorOptions, runDetectors } from "../detectors/index.js";
import { identify } from "../identify/index.js";
import { buildBehaviorInsights, buildBehaviorSuggestions } from "../insights/index.js";
import type { BehaviorInsights } from "../insights/index.js";
import { discoverClaudeSessionFiles } from "../lib/glob.js";
import { parseDateBound, parseDuration } from "../lib/time.js";
import { parseClaudeSessionFile } from "../parsers/claude-code.js";
import type { Session, SessionSelector } from "../parsers/types.js";
import { type ReportModel, buildReportModel } from "../render/model.js";

export interface AnalyzeOptions extends DetectorOptions {
  all?: boolean;
  last?: true | string;
  since?: string;
  until?: string;
  project?: string;
  session?: string;
  agent?: string;
  model?: string;
  includeContent?: boolean;
}

export interface AnalysisOutput {
  report: ReportModel;
  sessions: Session[];
  warnings: string[];
}

export function packageVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    while (dir !== dirname(dir)) {
      const path = join(dir, "package.json");
      if (existsSync(path)) {
        const pkg = JSON.parse(readFileSync(path, "utf8"));
        if (pkg.name === "agentgauge") return String(pkg.version ?? "0.1.0");
      }
      dir = dirname(dir);
    }
  } catch {
    // fall through to default
  }
  return "0.1.0";
}

/** Returns an error message when --last is a string but not a valid duration like 7d/24h. */
export function invalidLastMessage(last: true | string | undefined): string | undefined {
  if (typeof last !== "string") return undefined;
  return parseDuration(last)
    ? undefined
    : `Invalid --last value "${last}". Use a duration like 7d or 24h, or pass --last with no value.`;
}

export function selectorFromOptions(opts: AnalyzeOptions, now = new Date()): SessionSelector {
  const since = opts.since
    ? parseDateBound(opts.since, "start")
    : typeof opts.last === "string"
      ? parseDuration(opts.last, now)
      : undefined;
  return {
    all: opts.all,
    last: opts.last,
    since,
    until: opts.until ? parseDateBound(opts.until, "end") : undefined,
    project: opts.project,
    session: opts.session,
    agent: opts.agent,
    model: opts.model,
  };
}

/** @spec SPEC-AG-005, R2 — analyze command orchestration */
export async function analyze(opts: AnalyzeOptions = {}): Promise<AnalysisOutput | undefined> {
  const selector = selectorFromOptions(opts);
  const files = await discoverClaudeSessionFiles(selector);
  if (files.length === 0) return undefined;
  const sessions = (
    await Promise.all(files.map((file) => parseClaudeSessionFile(file.path, selector)))
  ).filter((session) => !session.isUsageProbe && session.turns.length > 0);
  const merged: Session = {
    id: sessions.map((session) => session.id).join("+") || "empty",
    sourcePath: sessions[0]?.sourcePath ?? "",
    projectName: sessions[0]?.projectName ?? "unknown",
    turns: sessions.flatMap((session) => session.turns),
    parseErrors: sessions.reduce((sum, session) => sum + session.parseErrors, 0),
    isUsageProbe: false,
  };
  const identity = identify(merged);
  const attribution =
    merged.turns.length > 0
      ? attributeSession(merged, identity)
      : zeroAttribution(merged.id, identity);
  const cost = computeCost(attribution, loadPricingTable());
  const baseInsights = buildBehaviorInsights({ session: merged, attribution, agent: identity });
  const findings = runDetectors(
    { session: merged, attribution, cost, agent: identity, insights: baseInsights },
    {
      detectors: opts.detectors,
      skipDetectors: opts.skipDetectors,
      minSeverity: opts.minSeverity,
      minSavings: opts.minSavings,
      warn: opts.warn,
    },
  );
  // Rebuild only suggestions (cheap) against detector findings; reuse the
  // expensive toolBehavior / turnEfficiency / toolInventory from baseInsights
  // instead of recomputing the full traversal a second time.
  const insights: BehaviorInsights = {
    ...baseInsights,
    suggestions: buildBehaviorSuggestions({
      tools: baseInsights.toolBehavior,
      turns: baseInsights.turnEfficiency,
      toolInventory: baseInsights.toolInventory,
      findingIds: findings.map((finding) => finding.id),
    }),
  };
  const report = buildReportModel(
    {
      version: packageVersion(),
      sessions,
      identity,
      attribution,
      cost,
      findings,
      insights,
    },
    { includeContent: opts.includeContent },
  );
  return { report, sessions, warnings: cost.warnings };
}
