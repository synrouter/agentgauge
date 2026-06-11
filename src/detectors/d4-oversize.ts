import { savingsFromTokens } from "../attribution/cost.js";
import { approximateTokens } from "../attribution/tokenize.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

function referencedLater(content: string, laterText: string): boolean {
  const sample = content.replace(/\s+/g, " ").slice(0, 120);
  return sample.length >= 30 && laterText.includes(sample.slice(0, 30));
}

/** @spec SPEC-AG-003, R5 — oversized unreferenced tool result detector */
export function d4Oversize(ctx: DetectorContext): Finding[] {
  const allText = ctx.session.turns
    .flatMap((turn) => turn.messages.map((message) => message.text))
    .join("\n");
  for (const turn of ctx.session.turns) {
    for (const message of turn.messages) {
      for (const result of message.toolResults) {
        const tokens = approximateTokens(result.content);
        if (tokens > THRESHOLDS.oversizeTokens && !referencedLater(result.content, allText)) {
          return [
            {
              id: "D4",
              severity: tokens > THRESHOLDS.oversizeMedTokens ? "med" : "low",
              title: "Oversized tool result was kept in context",
              evidence: [
                `${result.toolName ?? "tool"} result is about ${tokens} tokens and is not referenced later`,
              ],
              savings: savingsFromTokens(tokens * 0.7),
              fix_path: "Summarize large outputs before carrying them into later turns.",
            },
          ];
        }
      }
    }
  }
  return [];
}
