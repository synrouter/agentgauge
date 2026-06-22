import { repeatedTargetSavings } from "../insights/tool-behavior.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

const CHURN_TOOLS = new Set(["read", "grep", "glob", "bash"]);

/** @spec SPEC-AG-007, R7 — repeated read/search intent detector */
export function d8ReadChurn(ctx: DetectorContext): Finding[] {
  const tools = ctx.insights?.toolBehavior ?? [];
  const churn = tools
    .filter(
      (tool) =>
        CHURN_TOOLS.has(tool.tool.toLowerCase()) &&
        tool.calls >= THRESHOLDS.readChurnMinCalls &&
        tool.repeatRate >= THRESHOLDS.readChurnRepeatRate,
    )
    .sort((a, b) => b.repeatRate - a.repeatRate || b.calls - a.calls)[0];
  if (!churn) return [];
  const top = churn.topTargets[0];
  const repeatedTokens = Math.round(churn.totalTokens * churn.repeatRate);
  return [
    {
      id: "D8",
      severity: churn.repeatRate >= 0.75 ? "med" : "low",
      title: "Repeated reads or searches of the same target",
      evidence: [
        `${churn.tool} repeated ${Math.round(churn.repeatRate * 100)}% of ${churn.calls} calls.`,
        top
          ? `Top repeated target: ${top.label} (${top.calls} calls).`
          : "Top repeated target unknown.",
      ],
      savings: repeatedTargetSavings(repeatedTokens),
      fix_path:
        "Put stable project facts in CLAUDE.md or narrow retrieval before re-reading the same target.",
      estimated: true,
    },
  ];
}
