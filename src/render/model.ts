import type { CostBreakdown } from "../attribution/cost.js";
import type { Attribution } from "../attribution/tokenize.js";
import type { Finding } from "../detectors/index.js";
import type { AgentIdentity } from "../identify/index.js";
import type { Session } from "../parsers/types.js";

export interface ReportSession {
  id: string;
  project: string;
  agent: string;
  agent_confidence: number;
  turns: number;
  parse_errors: number;
  sidechain: Attribution["sidechain"];
}

export interface ReportModel {
  version: string;
  schema_version: 1;
  generated_at: string;
  sessions: ReportSession[];
  aggregate: {
    cost_usd: number | null;
    potential_savings_usd: number;
    cache_hit_rate: number;
    sections: CostBreakdown["sections"];
    warnings: string[];
  };
  findings: Finding[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function redactPath(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

export function redactContent(content: string): string {
  if (content.length <= 140) return content;
  return `${content.slice(0, 80)} ... ${content.slice(-40)} [${content.length} chars]`;
}

// Any absolute POSIX path (covers /Users, /home, /tmp, /mnt/c, ...) plus
// Windows drive paths; basename-only output is the privacy guarantee (FR-AG-6).
const ABSOLUTE_PATH_RE = /(?:[A-Za-z]:)?(?:\/[\w.@+-]+){2,}/g;

function redactEvidence(line: string, includeContent: boolean): string {
  const pathless = line.replace(ABSOLUTE_PATH_RE, (match) => redactPath(match));
  return includeContent ? pathless : redactContent(pathless);
}

/** @spec SPEC-AG-004, R4 — build-time report redaction */
export function buildReportModel(
  input: {
    version: string;
    sessions: Session[];
    identity: AgentIdentity;
    attribution: Attribution;
    cost: CostBreakdown;
    findings: Finding[];
  },
  opts: { includeContent?: boolean } = {},
): ReportModel {
  const includeContent = opts.includeContent ?? false;
  return {
    version: input.version,
    schema_version: 1,
    generated_at: new Date().toISOString(),
    sessions: input.sessions.map((session) => ({
      id: session.id,
      project: redactPath(session.projectName),
      agent: input.identity.agent,
      agent_confidence: input.identity.confidence,
      turns: session.turns.length,
      parse_errors: session.parseErrors,
      sidechain: input.attribution.sidechain,
    })),
    aggregate: {
      cost_usd: input.cost.totalUSD,
      potential_savings_usd: round(
        input.findings.reduce((sum, finding) => sum + finding.savings.conservative_usd, 0),
      ),
      cache_hit_rate: input.cost.cacheHitRate,
      sections: input.cost.sections,
      warnings: input.cost.warnings,
    },
    findings: input.findings.map((finding) => ({
      ...finding,
      evidence: finding.evidence.map((line) => redactEvidence(line, includeContent)),
    })),
  };
}
