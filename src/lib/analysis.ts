import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeCost } from "../attribution/cost.js";
import { loadPricingTable } from "../attribution/pricing.js";
import { attributeSession, zeroAttribution } from "../attribution/tokenize.js";
import { type DetectorOptions, runDetectors } from "../detectors/index.js";
import { identify } from "../identify/index.js";
import { discoverClaudeSessionFiles } from "../lib/glob.js";
import { parseDate, parseDuration } from "../lib/time.js";
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
}

export interface AnalysisOutput {
  report: ReportModel;
  sessions: Session[];
  warnings: string[];
}

export function packageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(new URL("../../", import.meta.url).pathname, "package.json"), "utf8"),
    );
    return String(pkg.version ?? "0.1.0");
  } catch {
    return "0.1.0";
  }
}

export function selectorFromOptions(opts: AnalyzeOptions, now = new Date()): SessionSelector {
  const since = opts.since
    ? parseDate(opts.since)
    : typeof opts.last === "string"
      ? parseDuration(opts.last, now)
      : undefined;
  return {
    all: opts.all,
    last: opts.last,
    since,
    until: opts.until ? parseDate(opts.until) : undefined,
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
  ).filter((session) => !session.isUsageProbe);
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
  const findings = runDetectors(
    { session: merged, attribution, cost, agent: identity },
    {
      detectors: opts.detectors,
      skipDetectors: opts.skipDetectors,
      minSeverity: opts.minSeverity,
      minSavings: opts.minSavings,
      warn: opts.warn,
    },
  );
  const report = buildReportModel({
    version: packageVersion(),
    sessions,
    identity,
    attribution,
    cost,
    findings,
  });
  return { report, sessions, warnings: cost.warnings };
}
