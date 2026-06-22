import { savingsFromTokens } from "../attribution/cost.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

/** @spec SPEC-AG-007, R5 — repeated tool failure loop detector */
export function d6ToolFailures(ctx: DetectorContext): Finding[] {
  const tools = ctx.insights?.toolBehavior ?? [];
  const failing = tools
    .filter(
      (tool) =>
        tool.errorCount >= THRESHOLDS.toolFailureMinErrors &&
        tool.errorRate >= THRESHOLDS.toolFailureErrorRate,
    )
    .sort((a, b) => b.errorCount - a.errorCount || b.totalTokens - a.totalTokens)[0];
  if (!failing) return [];
  const wastedTokens = Math.round(failing.totalTokens * failing.errorRate);
  const savings = savingsFromTokens(wastedTokens, 3, 0.5);
  return [
    {
      id: "D6",
      severity: failing.errorRate >= 0.6 ? "med" : "low",
      title: "Tool failure loop",
      evidence: [
        `${failing.tool} failed ${failing.errorCount}/${failing.calls} calls (${Math.round(
          failing.errorRate * 100,
        )}%).`,
        `Estimated failed-output waste: ${wastedTokens} tokens.`,
      ],
      savings,
      fix_path:
        "Document the correct command, environment, or permissions before the agent retries.",
      estimated: true,
    },
  ];
}
