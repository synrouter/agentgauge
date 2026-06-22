import type { SectionKey } from "../attribution/tokenize.js";
import type { ReportModel } from "./model.js";

type SectionGroup = {
  title: string;
  keys: SectionKey[];
};

const SECTION_GROUPS: SectionGroup[] = [
  { title: "Stable prefix", keys: ["system_prompt", "tool_definitions"] },
  { title: "Conversation context", keys: ["tool_results", "history"] },
  { title: "Current turn", keys: ["user_input"] },
  { title: "Cache", keys: ["cache_read", "cache_write"] },
];

function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

/** @spec SPEC-AG-004, R2 — single-file HTML report */
export function renderHtml(model: ReportModel): string {
  const findings = model.findings
    .map(
      (finding) =>
        `<details><summary><b>${esc(finding.id)}</b> ${esc(finding.title)} <span>$${finding.savings.conservative_usd.toFixed(2)}${finding.estimated ? "~" : ""}</span>${finding.fix_url ? ` <a href="${esc(finding.fix_url)}">⚡</a>` : ""}</summary><ul>${finding.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul><p>${esc(finding.fix_path)}</p></details>`,
    )
    .join("");
  const sectionMap = new Map(model.aggregate.sections.map((section) => [section.key, section]));
  const groups = SECTION_GROUPS.map((group) => {
    const rows = group.keys
      .map((key) => sectionMap.get(key))
      .filter(
        (section): section is (typeof model.aggregate.sections)[number] => section !== undefined,
      );
    if (rows.length === 0) return "";
    const body = rows
      .map(
        (section) =>
          `<tr><td>${esc(section.key)}</td><td>${section.estimated ? "~" : ""}${section.tokens}</td><td>${section.costUSD === null ? "unknown" : `$${section.costUSD.toFixed(2)}`}</td></tr>`,
      )
      .join("");
    return `<section><h3>${esc(group.title)}</h3><table><tbody>${body}</tbody></table></section>`;
  }).join("");
  const outputSection = sectionMap.get("assistant_output");
  const output = outputSection
    ? `<section><h3>Output</h3><table><tbody><tr><td>${esc(outputSection.key)}</td><td>${outputSection.estimated ? "~" : ""}${outputSection.tokens}</td><td>${outputSection.costUSD === null ? "unknown" : `$${outputSection.costUSD.toFixed(2)}`}</td></tr></tbody></table></section>`
    : "";
  const behavior = model.behavior;
  const toolBehavior = behavior?.toolBehavior.length
    ? `<section><h2>Tool behavior</h2><table><thead><tr><th>Tool</th><th>Calls</th><th>Output tokens</th><th>Avg out</th><th>Error</th><th>Repeat</th><th>Top target</th></tr></thead><tbody>${behavior.toolBehavior
        .map(
          (tool) =>
            `<tr><td>${esc(tool.tool)}</td><td>${tool.calls}</td><td>${tool.totalTokens}</td><td>${tool.avgOutputTokens}</td><td>${(tool.errorRate * 100).toFixed(0)}%</td><td>${(tool.repeatRate * 100).toFixed(0)}%</td><td>${esc(tool.topTargets[0]?.label ?? "")}</td></tr>`,
        )
        .join("")}</tbody></table></section>`
    : "";
  const inventory = behavior?.toolInventory
    ? `<p>Tools used ${behavior.toolInventory.used}/${behavior.toolInventory.loaded}${behavior.toolInventory.estimated ? "~" : ""}</p>`
    : "";
  const visibleTurns = behavior?.turnEfficiency
    ? [...behavior.turnEfficiency]
        .sort((a, b) => b.inputTokens - a.inputTokens || a.turnIndex - b.turnIndex)
        .slice(0, 120)
        .sort((a, b) => a.turnIndex - b.turnIndex)
    : [];
  const omittedTurns =
    behavior && behavior.turnEfficiency.length > visibleTurns.length
      ? `<p>Showing the 120 highest-input turns; ${behavior.turnEfficiency.length - visibleTurns.length} lower-input turns are omitted from HTML. Full data is available in JSON.</p>`
      : "";
  const turns = behavior?.turnEfficiency.length
    ? `<section><h2>Turn efficiency</h2>${inventory}${omittedTurns}<table><thead><tr><th>Turn</th><th>Input</th><th>Output</th><th>Context</th><th>Tools</th><th>Flags</th></tr></thead><tbody>${visibleTurns
        .map(
          (turn) =>
            `<tr><td>${turn.turnIndex}</td><td>${turn.inputTokens}</td><td>${turn.outputTokens}</td><td>${turn.contextTokens}</td><td>${turn.toolCallCount}</td><td>${esc(turn.flags.join(", "))}</td></tr>`,
        )
        .join("")}</tbody></table></section>`
    : "";
  const suggestions = behavior?.suggestions.length
    ? `<section><h2>Suggestions</h2>${behavior.suggestions
        .map(
          (item) =>
            `<details><summary><b>${esc(item.severity.toUpperCase())}</b> ${esc(item.title)}</summary><p>${esc(item.action)}</p><pre>${esc(JSON.stringify(item.evidence, null, 2))}</pre></details>`,
        )
        .join("")}</section>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>agentgauge report</title><style>body{margin:0;background:#111;color:#eee;font:14px ui-monospace,SFMono-Regular,Menlo,monospace}main{max-width:980px;margin:auto;padding:32px}a{color:#71d6ff}.hero{padding:28px 0;border-bottom:1px solid #333}.nums{display:flex;gap:18px;flex-wrap:wrap}.num{font-size:24px;font-weight:700}section{margin:18px 0}table{width:100%;border-collapse:collapse;margin:10px 0 0}td,th{border-bottom:1px solid #333;padding:8px;text-align:left}details{border:1px solid #333;padding:12px;margin:10px 0;border-radius:6px}summary{cursor:pointer}.cta{display:inline-block;margin-top:16px;padding:10px 14px;background:#eee;color:#111;text-decoration:none;border-radius:6px}pre{white-space:pre-wrap;color:#bbb}</style></head><body><main><section class="hero"><h1>agentgauge ${esc(model.version)}</h1><div class="nums"><div><div>COST</div><div class="num">${model.aggregate.cost_usd === null ? "unknown" : `$${model.aggregate.cost_usd.toFixed(2)}`}</div></div><div><div>POTENTIAL SAVINGS</div><div class="num">$${model.aggregate.potential_savings_usd.toFixed(2)}</div></div><div><div>CACHE HIT</div><div class="num">${(model.aggregate.cache_hit_rate * 100).toFixed(1)}%</div></div></div><a class="cta" href="https://synrouter.ai/connect?source=agentgauge">Explore automatic fixes</a></section><h2>Breakdown</h2>${groups}${output}${toolBehavior}${turns}${suggestions}${findings ? `<h2>Findings</h2>${findings}` : "<h2>Findings</h2><p>No findings above threshold.</p>"}<footer><a href="https://synrouter.ai/connect?source=agentgauge">synrouter.ai/connect</a></footer></main></body></html>`;
}
