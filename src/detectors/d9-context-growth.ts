import { savingsFromTokens } from "../attribution/cost.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

/** @spec SPEC-AG-007, R8 — context growth slope detector */
export function d9ContextGrowth(ctx: DetectorContext): Finding[] {
  const turns = ctx.insights?.turnEfficiency ?? [];
  if (turns.length < THRESHOLDS.contextGrowthMinTurns) return [];
  const positive = turns.filter((turn) => turn.contextTokens > 0);
  if (positive.length < THRESHOLDS.contextGrowthMinTurns) return [];
  const first = positive[0]!;
  const last = positive.at(-1)!;
  if (last.contextTokens / first.contextTokens < THRESHOLDS.contextGrowthRatio) return [];
  const lowActionTurns = positive.filter(
    (turn) => turn.toolCallCount === 0 && !turn.flags.includes("edit") && turn.outputTokens < 160,
  ).length;
  if (lowActionTurns < 2) return [];
  const growth = last.contextTokens - first.contextTokens;
  return [
    {
      id: "D9",
      severity: growth > 10_000 ? "med" : "low",
      title: "Context grew quickly without much action",
      evidence: [
        `Context grew from ${first.contextTokens} to ${last.contextTokens} tokens between turns ${first.turnIndex}-${last.turnIndex}.`,
        `${lowActionTurns} low-action turn(s) occurred while context was growing.`,
      ],
      savings: savingsFromTokens(growth, 3, 0.25),
      fix_path: `Consider compacting before turn ${last.turnIndex} or capping large tool outputs earlier.`,
      estimated: true,
    },
  ];
}
