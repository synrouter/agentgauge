import { savingsFromTokens } from "../attribution/cost.js";
import { approximateTokens } from "../attribution/tokenize.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

/** @spec SPEC-AG-003, R5 — old history with no recent reference */
export function d5Compactable(ctx: DetectorContext): Finding[] {
  if (ctx.session.turns.some((turn) => turn.messages.some((message) => message.isCompactBoundary)))
    return [];
  if (ctx.session.turns.length < 5) return [];
  const earlyCount = Math.max(1, Math.floor(ctx.session.turns.length * 0.2));
  const earlyText = ctx.session.turns
    .slice(0, earlyCount)
    .flatMap((turn) => turn.messages.map((message) => message.text))
    .join("\n");
  const recentText = ctx.session.turns
    .slice(-5)
    .flatMap((turn) => turn.messages.map((message) => message.text))
    .join("\n");
  const sample = earlyText.replace(/\s+/g, " ").slice(0, 30);
  const tokens = approximateTokens(earlyText);
  const historyTokens = ctx.session.turns.reduce(
    (sum, turn) =>
      sum + turn.messages.reduce((inner, message) => inner + approximateTokens(message.text), 0),
    0,
  );
  if (tokens === 0 || historyTokens === 0 || recentText.includes(sample)) return [];
  if (tokens / historyTokens <= THRESHOLDS.compactableHistoryRatio) return [];
  return [
    {
      id: "D5",
      severity: "low",
      title: "Old history looks compactable",
      evidence: [`first ${earlyCount} turn(s) are not referenced in the last 5 turns`],
      savings: savingsFromTokens(tokens),
      fix_path: "Compact or summarize stale context before continuing the session.",
    },
  ];
}
