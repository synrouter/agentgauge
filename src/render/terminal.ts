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

const COMPOSITION_ORDER: SectionKey[] = [
  "tool_results",
  "tool_definitions",
  "history",
  "system_prompt",
  "user_input",
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

  const compositionRows = COMPOSITION_ORDER.map((key) => {
    const section = sectionMap.get(key);
    if (!section) return undefined;
    const pct = totalInput > 0 ? section.tokens / totalInput : 0;
    const pctStr = `${section.estimated ? "~" : ""}${(pct * 100).toFixed(0)}%`;
    const label = displayName(key).padEnd(17);
    return `  ${label}${bar(pct)}  ${pctStr.padStart(4)}  ${formatTokens(section.tokens).padStart(6)}  ${money(section.costUSD)}`;
  }).filter((line): line is string => line !== undefined);

  const outputSection = sectionMap.get("assistant_output");
  const outputRow = outputSection
    ? `  ${displayName("assistant_output").padEnd(17)}${" ".repeat(20 + 2 + 4 + 2)}${formatTokens(outputSection.tokens).padStart(6)}  ${money(outputSection.costUSD)}`
    : undefined;

  const cacheRows = (["cache_read", "cache_write"] as SectionKey[])
    .map((key) => {
      const section = sectionMap.get(key);
      if (!section) return undefined;
      const label = displayName(key).padEnd(17);
      return `  ${label}${" ".repeat(20 + 2 + 4 + 2)}${formatTokens(section.tokens).padStart(6)}  ${money(section.costUSD)}`;
    })
    .filter((line): line is string => line !== undefined);

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
    c.bold("TOKEN COMPOSITION (input)"),
    c.dim("  ~ = estimated residual; system + tool definitions are billed on every request"),
    ...compositionRows,
    ...(outputRow ? ["", c.bold("OUTPUT"), outputRow] : []),
    ...(cacheRows.length > 0 ? ["", c.bold("CACHE"), ...cacheRows] : []),
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
