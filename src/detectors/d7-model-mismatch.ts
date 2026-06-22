import { savingsFromTokens } from "../attribution/cost.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

function isExpensiveModel(model: string | undefined): boolean {
  return Boolean(model && /opus/i.test(model));
}

/** @spec SPEC-AG-007, R6 — conservative simple-turn model mismatch audit */
export function d7ModelMismatch(ctx: DetectorContext): Finding[] {
  const turns = ctx.insights?.turnEfficiency ?? [];
  const byId = new Map(ctx.attribution.turns.map((turn) => [turn.turnId, turn]));
  const simpleExpensive = turns.filter((turn) => {
    const attributed = byId.get(turn.turnId);
    return (
      turn.flags.includes("simple") &&
      !turn.flags.includes("edit") &&
      isExpensiveModel(attributed?.model) &&
      turn.inputTokens + turn.outputTokens >= THRESHOLDS.modelMismatchMinTokens
    );
  });
  if (simpleExpensive.length === 0) return [];
  const tokens = simpleExpensive.reduce(
    (sum, turn) => sum + turn.inputTokens + turn.outputTokens,
    0,
  );
  return [
    {
      id: "D7",
      severity: "low",
      title: "Expensive model used for simple turns",
      evidence: [
        `${simpleExpensive.length} simple turn(s) used an Opus-class model.`,
        `Simple-turn tokens: ${tokens}.`,
      ],
      savings: savingsFromTokens(tokens, 3, 0.3),
      fix_path:
        "Review model routing for short read/list/status turns; this is an audit signal, not an automatic downgrade.",
      estimated: true,
    },
  ];
}
