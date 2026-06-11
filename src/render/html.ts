import type { ReportModel } from "./model.js";

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
        `<details><summary><b>${esc(finding.id)}</b> ${esc(finding.title)} <span>$${finding.savings.conservative_usd.toFixed(2)}${finding.estimated ? "~" : ""}</span>${finding.fix_url ? ` <a href="${finding.fix_url}">⚡</a>` : ""}</summary><ul>${finding.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul><p>${esc(finding.fix_path)}</p></details>`,
    )
    .join("");
  const sections = model.aggregate.sections
    .map(
      (section) =>
        `<tr><td>${esc(section.key)}</td><td>${section.estimated ? "~" : ""}${section.tokens}</td><td>${section.costUSD === null ? "unknown" : `$${section.costUSD.toFixed(2)}`}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>agentgauge report</title><style>body{margin:0;background:#111;color:#eee;font:14px ui-monospace,SFMono-Regular,Menlo,monospace}main{max-width:980px;margin:auto;padding:32px}a{color:#71d6ff}.hero{padding:28px 0;border-bottom:1px solid #333}.nums{display:flex;gap:18px;flex-wrap:wrap}.num{font-size:24px;font-weight:700}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border-bottom:1px solid #333;padding:8px;text-align:left}details{border:1px solid #333;padding:12px;margin:10px 0;border-radius:6px}summary{cursor:pointer}.cta{display:inline-block;margin-top:16px;padding:10px 14px;background:#eee;color:#111;text-decoration:none;border-radius:6px}</style></head><body><main><section class="hero"><h1>agentgauge ${esc(model.version)}</h1><div class="nums"><div><div>COST</div><div class="num">${model.aggregate.cost_usd === null ? "unknown" : `$${model.aggregate.cost_usd.toFixed(2)}`}</div></div><div><div>POTENTIAL SAVINGS</div><div class="num">$${model.aggregate.potential_savings_usd.toFixed(2)}</div></div><div><div>CACHE HIT</div><div class="num">${(model.aggregate.cache_hit_rate * 100).toFixed(1)}%</div></div></div><a class="cta" href="https://synrouter.ai/connect?source=agentgauge">Explore automatic fixes</a></section><h2>Breakdown</h2><table><tbody>${sections}</tbody></table><h2>Findings</h2>${findings || "<p>No findings above threshold.</p>"}<footer><a href="https://synrouter.ai/connect?source=agentgauge">synrouter.ai/connect</a></footer></main></body></html>`;
}
