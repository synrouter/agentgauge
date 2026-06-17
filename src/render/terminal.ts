import pc from "picocolors";
import type { SectionKey } from "../attribution/tokenize.js";
import type { ReportModel } from "./model.js";

export interface TerminalOptions {
  color?: boolean;
  quiet?: boolean;
  topN?: number;
}

function money(value: number | null): string {
  return value === null ? "unknown" : `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${value}`;
}

function bar(pct: number, width = 20): string {
  const filled = Math.max(0, Math.min(width, Math.round(pct * width)));
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function displayName(key: string): string {
  return key.replace(/_/g, " ");
}

const COMPOSITION_GROUPS: Array<{
  title: string;
  keys: SectionKey[];
}> = [
  { title: "Stable prefix", keys: ["system_prompt", "tool_definitions"] },
  { title: "Conversation context", keys: ["tool_results", "history"] },
  { title: "Current turn", keys: ["user_input"] },
  { title: "Cache", keys: ["cache_read", "cache_write"] },
];

/** @spec SPEC-AG-004, R1 — terminal report renderer */
export function renderTerminal(model: ReportModel, opts: TerminalOptions = {}): string {
  const color = opts.color ?? false;
  const c = color
    ? pc
    : {
        bold: (s: string) => s,
        green: (s: string) => s,
        yellow: (s: string) => s,
        red: (s: string) => s,
        dim: (s: string) => s,
        cyan: (s: string) => s,
      };

  const savings = model.aggregate.potential_savings_usd;
  const cost = model.aggregate.cost_usd ?? 0;
  const savingsPct = cost > 0 ? Math.round((savings / cost) * 100) : 0;
  const totalInput = model.aggregate.tokens.input;
  const totalOutput = model.aggregate.tokens.output;

  const sessions = model.sessions;
  const totalTurns = sessions.reduce((sum, session) => sum + session.turns, 0);
  const projectLabel =
    sessions.length > 1 ? `${sessions.length} sessions` : (sessions[0]?.project ?? "unknown");
  const sessionLine = `Session   ${model.sessions[0]?.agent ?? "unknown"} · ${projectLabel} · ${totalTurns} turns`;
  const modelLine = model.aggregate.model ? `Model     ${model.aggregate.model}` : undefined;

  const header = [
    c.bold(`agentgauge ${model.version} — session report`),
    sessionLine,
    ...(modelLine ? [modelLine] : []),
    "",
    `COST          ${money(model.aggregate.cost_usd).padEnd(10)} POTENTIAL SAVINGS    ${money(savings)} (${savingsPct}%)`,
    `TOKENS        ${formatTokens(totalInput).padEnd(5)} in / ${formatTokens(totalOutput).padEnd(5)} out                CACHE HIT ${(model.aggregate.cache_hit_rate * 100).toFixed(1)}%`,
  ];

  if (opts.quiet) {
    return `${header.join("\n")}\n${model.findings.length} finding(s). Try agentgauge --help for more commands\n`;
  }

  const sidechain = sessions[0]?.sidechain?.sidechain;
  const sidechainLine = sidechain
    ? `Sub-agents  ${sidechain.turns} turns · ${formatTokens(sidechain.tokens)} tok (${totalInput > 0 ? Math.round((sidechain.tokens / totalInput) * 100) : 0}% of input)`
    : undefined;

  const sectionMap = new Map<SectionKey, (typeof model.aggregate.sections)[number]>(
    model.aggregate.sections.map((section) => [section.key, section]),
  );

  const cacheReadSection = sectionMap.get("cache_read");
  const otherInputTokens = model.aggregate.sections
    .filter(
      (section) =>
        section.key !== "cache_read" &&
        section.key !== "cache_write" &&
        section.key !== "assistant_output",
    )
    .reduce((sum, section) => sum + section.tokens, 0);
  const otherInputCost = model.aggregate.sections
    .filter(
      (section) =>
        section.key !== "cache_read" &&
        section.key !== "cache_write" &&
        section.key !== "assistant_output",
    )
    .reduce((sum, section) => sum + (section.costUSD ?? 0), 0);
  const cacheReadTokens = cacheReadSection?.tokens ?? 0;
  const cacheReadCost = cacheReadSection?.costUSD ?? 0;
  // Effective total matches cache_hit_rate semantics (excludes output + cache_write)
  const effectiveInput = otherInputTokens + cacheReadTokens;
  const otherPct = effectiveInput > 0 ? Math.round((otherInputTokens / effectiveInput) * 100) : 0;
  const cachePct = effectiveInput > 0 ? Math.round((cacheReadTokens / effectiveInput) * 100) : 0;

  const cacheHitStr = `CACHE HIT ${(model.aggregate.cache_hit_rate * 100).toFixed(1)}%`;
  const regularRow = `  Regular input ${formatTokens(otherInputTokens).padStart(6)} ${money(otherInputCost).padStart(8)}${String(otherPct).padStart(4)}%`;
  const cachedRow = `  Cached input  ${formatTokens(cacheReadTokens).padStart(6)} ${money(cacheReadCost).padStart(8)}${String(cachePct).padStart(4)}%`;
  const inputBreakdown = [
    c.bold("INPUT BREAKDOWN"),
    c.dim("  regular = billed at full rate · cached = billed at 0.1× (cache read)"),
    "",
    `${regularRow.padEnd(52)}${cacheHitStr}`,
    cachedRow,
    "",
  ];

  function renderRow(section: (typeof model.aggregate.sections)[number]): string {
    const pct = totalInput > 0 ? section.tokens / totalInput : 0;
    const pctStr = `${section.estimated ? "~" : ""}${(pct * 100).toFixed(0)}%`;
    const label = displayName(section.key).padEnd(17);
    const value = `${formatTokens(section.tokens).padStart(6)}  ${money(section.costUSD)}`;
    if (
      section.key === "assistant_output" ||
      section.key === "cache_read" ||
      section.key === "cache_write"
    ) {
      return `  ${label}${" ".repeat(20 + 2 + 4 + 2)}${value}`;
    }
    return `  ${label}${bar(pct)}  ${pctStr.padStart(4)}  ${value}`;
  }

  const compositionBlocks = COMPOSITION_GROUPS.map((group) => {
    const rows = group.keys
      .map((key) => sectionMap.get(key))
      .filter(
        (section): section is (typeof model.aggregate.sections)[number] => section !== undefined,
      );
    if (rows.length === 0) return undefined;
    return [c.bold(group.title), ...rows.map(renderRow)];
  }).filter((block): block is string[] => block !== undefined);

  const outputSection = sectionMap.get("assistant_output");
  const outputBlock = outputSection ? [c.bold("Output"), renderRow(outputSection)] : undefined;

  const findings = model.findings.slice(0, opts.topN ?? 5).map((finding) => {
    const sevColor =
      finding.severity === "high" ? c.red : finding.severity === "med" ? c.yellow : c.green;
    const sev = finding.severity.toUpperCase().padEnd(4);
    const bolt = finding.fix_url ? " ⚡" : "";
    const savingsStr = `${money(finding.savings.conservative_usd)}${finding.estimated ? "~" : ""}`;
    return `● ${sevColor(sev)} ${finding.id.padEnd(3)} ${finding.title.padEnd(45)} ${savingsStr.padStart(7)}${bolt}`;
  });

  const lines = [
    ...header,
    "",
    ...inputBreakdown,
    c.bold("TOKEN COMPOSITION (input)"),
    c.dim("  ~ = estimated residual; system + tool definitions are billed on every request"),
    ...compositionBlocks.flatMap((block) => ["", ...block]),
    ...(outputBlock ? ["", ...outputBlock] : []),
    "",
    c.bold(`FINDINGS (${model.findings.length})                                  est. savings`),
    ...(findings.length > 0 ? findings : ["  No findings above threshold."]),
    "",
    "⚡ = auto-fixable with synrouter → synrouter.ai/connect",
  ];

  if (sidechainLine) {
    lines.splice(4, 0, sidechainLine);
  }

  return `${lines.join("\n")}\n`;
}
