import pc from "picocolors";
import type { SectionKey } from "../attribution/tokenize.js";
import { sparkline } from "../insights/index.js";
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

function modelRows(models: ReportModel["aggregate"]["models"], fallback?: string): string[][] {
  const labels =
    models.length > 0
      ? models.map((model) => `${model.id} (${model.turns} turns)`)
      : [fallback ?? "unknown"];
  return labels.map((label, index) => [index === 0 ? "Models" : "", label]);
}

function displayName(key: string): string {
  return key.replace(/_/g, " ");
}

const SECTION_ORDER: SectionKey[] = [
  "system_prompt",
  "tool_definitions",
  "tool_results",
  "history",
  "user_input",
  "cache_read",
  "cache_write",
  "assistant_output",
];

function percent(part: number, total: number, estimated = false): string {
  const value = total > 0 ? (part / total) * 100 : 0;
  return `${estimated ? "~" : ""}${value.toFixed(1)}%`;
}

function formatPeriod(start: string | null, end: string | null): string {
  const startDay = start?.slice(0, 10) ?? null;
  const endDay = end?.slice(0, 10) ?? null;
  if (!startDay && !endDay) return "unknown";
  if (startDay === endDay || !endDay) return startDay ?? "unknown";
  if (!startDay) return endDay;
  return `${startDay} -> ${endDay}`;
}

function behaviorLines(model: ReportModel): string[] {
  const behavior = model.behavior;
  if (!behavior) return [];
  const lines: string[] = [];
  const inventory = behavior.toolInventory;
  if (inventory) {
    lines.push(`Tools used ${inventory.used}/${inventory.loaded}${inventory.estimated ? "~" : ""}`);
  }
  const turnInputs = behavior.turnEfficiency.map((turn) => turn.inputTokens);
  const curve = sparkline(turnInputs, 64);
  if (curve) {
    const maxTurn = behavior.turnEfficiency.reduce(
      (max, turn) => (turn.inputTokens > max.inputTokens ? turn : max),
      behavior.turnEfficiency[0]!,
    );
    lines.push(`Turn input ${curve}  peak turn ${maxTurn.turnIndex}`);
  }
  const topTool = behavior.toolBehavior.find((tool) => tool.calls > 0);
  if (topTool) {
    lines.push(
      `Top tool ${topTool.tool}: ${topTool.calls} calls · ${formatTokens(topTool.totalTokens)} out · ${(topTool.errorRate * 100).toFixed(0)}% errors`,
    );
  }
  return lines;
}

function renderTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const formatRow = (row: string[]) =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join(" | ")} |`;
  const divider = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;
  return [formatRow(headers), divider, ...rows.map(formatRow)];
}

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
  const totalTokens = totalInput + totalOutput;

  const sessions = model.sessions;
  const totalTurns = sessions.reduce((sum, session) => sum + session.turns, 0);
  const projectLabel =
    sessions.length > 1 ? `${sessions.length} sessions` : (sessions[0]?.project ?? "unknown");
  const agentLabel =
    sessions.length === 1
      ? (sessions[0]?.agent ?? "unknown")
      : [...new Set(sessions.map((session) => session.agent))].join(", ");
  const periodLabel = formatPeriod(model.period.start, model.period.end);

  const header = [
    c.bold(`agentgauge ${model.version} — session report`),
    "",
    ...renderTable(
      ["Metric", "Value"],
      [
        ["Time range", periodLabel],
        ["Agent", agentLabel],
        ...modelRows(model.aggregate.models, model.aggregate.model),
        ["Scope", `${projectLabel}, ${totalTurns} turns`],
        ["Tokens", `${formatTokens(totalInput)} in / ${formatTokens(totalOutput)} out`],
        ["Cost", money(model.aggregate.cost_usd)],
      ],
    ),
    "",
    `Potential savings ${money(savings)} (${savingsPct}%) · Cache hit ${(model.aggregate.cache_hit_rate * 100).toFixed(1)}%`,
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

  const tokenRows = SECTION_ORDER.map((key) => sectionMap.get(key))
    .filter(
      (section): section is (typeof model.aggregate.sections)[number] => section !== undefined,
    )
    .map((section) => [
      displayName(section.key),
      section.key === "assistant_output" ? "output" : "input",
      `${section.estimated ? "~" : ""}${formatTokens(section.tokens)}`,
      percent(section.tokens, totalTokens, section.estimated),
      money(section.costUSD),
    ]);

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
    ...(sidechainLine ? [sidechainLine] : []),
    ...behaviorLines(model),
    "",
    c.bold("TOKEN BREAKDOWN"),
    c.dim("~ = estimated residual; share is of total reported tokens"),
    ...renderTable(["Section", "Kind", "Tokens", "Share", "Cost"], tokenRows),
    "",
    c.bold(`FINDINGS (${model.findings.length})                                  est. savings`),
    ...(findings.length > 0 ? findings : ["  No findings above threshold."]),
    "",
    "⚡ = auto-fixable with synrouter → synrouter.ai/connect",
  ];

  return `${lines.join("\n")}\n`;
}
