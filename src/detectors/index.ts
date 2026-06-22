import type { CostBreakdown } from "../attribution/cost.js";
import type { Attribution } from "../attribution/tokenize.js";
import type { AgentIdentity } from "../identify/index.js";
import type { BehaviorInsights } from "../insights/index.js";
import type { Session } from "../parsers/types.js";
import { d0Noise } from "./d0-noise.js";
import { d1ToolBloat } from "./d1-tool-bloat.js";
import { d2CacheBreak } from "./d2-cache-break.js";
import { d3DupResults } from "./d3-dup-results.js";
import { d4Oversize } from "./d4-oversize.js";
import { d5Compactable } from "./d5-compactable.js";
import { d6ToolFailures } from "./d6-tool-failures.js";
import { d7ModelMismatch } from "./d7-model-mismatch.js";
import { d8ReadChurn } from "./d8-read-churn.js";
import { d9ContextGrowth } from "./d9-context-growth.js";

export type Severity = "low" | "med" | "high";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  evidence: string[];
  savings: {
    conservative_usd: number;
    theoretical_usd: number;
  };
  fix_path: string;
  fix_url?: string;
  estimated?: boolean;
}

export interface DetectorContext {
  session: Session;
  attribution: Attribution;
  cost: CostBreakdown;
  agent: AgentIdentity;
  insights?: BehaviorInsights;
}

export interface DetectorOptions {
  detectors?: string[];
  skipDetectors?: string[];
  minSeverity?: Severity;
  minSavings?: number;
  warn?: (message: string) => void;
}

export type Detector = (ctx: DetectorContext) => Finding[];

export const DETECTORS: Record<string, Detector> = {
  D0: d0Noise,
  D1: d1ToolBloat,
  D2: d2CacheBreak,
  D3: d3DupResults,
  D4: d4Oversize,
  D5: d5Compactable,
  D6: d6ToolFailures,
  D7: d7ModelMismatch,
  D8: d8ReadChurn,
  D9: d9ContextGrowth,
};

const severityRank: Record<Severity, number> = { low: 1, med: 2, high: 3 };

/** @spec SPEC-AG-003, R1 — detector registry with failure isolation */
export function runDetectors(ctx: DetectorContext, opts: DetectorOptions = {}): Finding[] {
  const include = opts.detectors
    ? new Set(opts.detectors.map((id) => id.toUpperCase()))
    : undefined;
  const skip = new Set((opts.skipDetectors ?? []).map((id) => id.toUpperCase()));
  const minRank = opts.minSeverity ? severityRank[opts.minSeverity] : 0;
  const findings: Finding[] = [];
  for (const [id, detector] of Object.entries(DETECTORS)) {
    if (include && !include.has(id)) continue;
    if (skip.has(id)) continue;
    try {
      findings.push(...detector(ctx));
    } catch (error) {
      opts.warn?.(
        `Detector ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return findings
    .filter((finding) => severityRank[finding.severity] >= minRank)
    .filter((finding) => finding.savings.conservative_usd >= (opts.minSavings ?? 0))
    .sort((a, b) => b.savings.conservative_usd - a.savings.conservative_usd);
}
