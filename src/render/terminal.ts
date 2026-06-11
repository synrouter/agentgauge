import pc from "picocolors";
import type { ReportModel } from "./model.js";

export interface TerminalOptions {
  color?: boolean;
  quiet?: boolean;
  topN?: number;
}

function money(value: number | null): string {
  return value === null ? "unknown" : `$${value.toFixed(2)}`;
}

function maybeEstimate(estimated: boolean, value: number): string {
  return `${estimated ? "~" : ""}${value}`;
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
      };
  const savings = model.aggregate.potential_savings_usd;
  const header = [
    c.bold(`agentgauge ${model.version} — session report`),
    `COST ${money(model.aggregate.cost_usd)}   POTENTIAL SAVINGS ${money(savings)}   CACHE HIT ${(model.aggregate.cache_hit_rate * 100).toFixed(1)}%`,
  ];
  if (opts.quiet) {
    return `${header.join("\n")}\n${model.findings.length} finding(s). Try agentgauge --help for more commands\n`;
  }
  const sections = model.aggregate.sections
    .map(
      (section) =>
        `  ${section.key.padEnd(18)} ${maybeEstimate(section.estimated, section.tokens).padStart(8)} tok  ${money(section.costUSD)}`,
    )
    .join("\n");
  const findings = model.findings.slice(0, opts.topN ?? 5).map((finding, index) => {
    const sev =
      finding.severity === "high"
        ? c.red("HIGH")
        : finding.severity === "med"
          ? c.yellow("MED ")
          : c.green("LOW ");
    const bolt = finding.fix_url ? " ⚡" : "";
    return `${index + 1}. [${sev}] ${money(finding.savings.conservative_usd)}${finding.estimated ? "~" : ""} ${finding.title}${bolt}`;
  });
  return `${[
    ...header,
    "",
    "Breakdown",
    sections,
    "",
    "Findings",
    findings.length > 0 ? findings.join("\n") : "  No findings above threshold.",
    "",
    "An open-source funnel for synrouter.ai",
    "Try agentgauge --help for more commands",
  ].join("\n")}\n`;
}
