import { savingsFromTokens } from "../attribution/cost.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

/** @spec SPEC-AG-003, R4 — cache break signal from usage sequence */
export function d2CacheBreak(ctx: DetectorContext): Finding[] {
  const findings: Finding[] = [];
  for (let index = 1; index < ctx.attribution.turns.length; index += 1) {
    const prev = ctx.attribution.turns[index - 1]!;
    const current = ctx.attribution.turns[index]!;
    const readDrop = prev.usage.cacheReadInputTokens - current.usage.cacheReadInputTokens;
    const writeJump = current.usage.cacheCreationInputTokens - prev.usage.cacheCreationInputTokens;
    if (
      readDrop > THRESHOLDS.cacheBreakReadDropMin &&
      writeJump > THRESHOLDS.cacheBreakWriteJumpMin
    ) {
      const savings = savingsFromTokens(writeJump * THRESHOLDS.cacheWriteCostMultiplier, 3, 0.8);
      findings.push({
        id: "D2",
        severity: savings.conservative_usd > THRESHOLDS.cacheBreakSavingsHigh ? "high" : "med",
        title: "Cache prefix appears to break between turns",
        evidence: [
          `between turns ${index} and ${index + 1}: cache_read dropped ${readDrop}, cache_creation rose ${writeJump}`,
        ],
        savings,
        fix_path: "Keep stable prompt/tool prefixes byte-identical across turns.",
        fix_url: "https://synrouter.ai/connect?source=agentgauge&detector=D2",
        estimated: true,
      });
    }
  }
  return findings;
}
