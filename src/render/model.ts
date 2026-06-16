import type { CostBreakdown } from "../attribution/cost.js";
import type { Attribution, SectionKey } from "../attribution/tokenize.js";
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
    tokens: { input: number; output: number };
    model?: string;
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
  const inputKeys = new Set<SectionKey>([
    "system_prompt",
    "tool_definitions",
    "tool_results",
    "history",
    "user_input",
    "cache_read",
    "cache_write",
  ]);
  const inputTokens = input.cost.sections
    .filter((section) => inputKeys.has(section.key))
    .reduce((sum, section) => sum + section.tokens, 0);
  const outputTokens =
    input.cost.sections.find((section) => section.key === "assistant_output")?.tokens ?? 0;
  const modelCounts = new Map<string, number>();
  for (const turn of input.attribution.turns) {
    if (turn.model) modelCounts.set(turn.model, (modelCounts.get(turn.model) ?? 0) + 1);
  }
  const model = [...modelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
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
      tokens: { input: inputTokens, output: outputTokens },
      model,
      sections: input.cost.sections,
      warnings: input.cost.warnings,
    },
    findings: input.findings.map((finding) => ({
      ...finding,
      evidence: finding.evidence.map((line) => redactEvidence(line, includeContent)),
    })),
  };
}
