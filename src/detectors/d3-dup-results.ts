import { createHash } from "node:crypto";
import { savingsFromTokens } from "../attribution/cost.js";
import { approximateTokens } from "../attribution/tokenize.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** @spec SPEC-AG-003, R5 — repeated tool result detector */
export function d3DupResults(ctx: DetectorContext): Finding[] {
  const buckets = new Map<string, { count: number; tokens: number }>();
  let total = 0;
  for (const turn of ctx.session.turns) {
    for (const message of turn.messages) {
      // Continuation/resume replays repeat earlier results without re-billing
      // them as fresh tool output (DESIGN-AG-003 false-positive defense).
      if (message.isSystemInjected) continue;
      for (const result of message.toolResults) {
        const tokens = approximateTokens(result.content);
        total += tokens;
        const key = hash(result.content.trim());
        const prev = buckets.get(key) ?? { count: 0, tokens };
        prev.count += 1;
        buckets.set(key, prev);
      }
    }
  }
  const repeated = [...buckets.values()].filter(
    (bucket) => bucket.count >= THRESHOLDS.duplicateMinCount,
  );
  const wasted = repeated.reduce((sum, bucket) => sum + bucket.tokens * (bucket.count - 1), 0);
  if (total === 0 || wasted / total <= THRESHOLDS.duplicateRatioMed) return [];
  return [
    {
      id: "D3",
      severity: "med",
      title: "Repeated tool results in context",
      evidence: [`${repeated.length} repeated result bucket(s), about ${wasted} duplicate tokens`],
      savings: savingsFromTokens(wasted),
      fix_path: "Replace repeated tool output with a short reference to the first occurrence.",
    },
  ];
}
