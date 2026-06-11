import { type PricingTable, isBillableModel, resolveModelPrice } from "./pricing.js";
import type { Attribution, SectionAttribution } from "./tokenize.js";

export interface CostBreakdown {
  totalUSD: number | null;
  cacheHitRate: number;
  sections: SectionAttribution[];
  warnings: string[];
}

export interface Savings {
  conservative_usd: number;
  theoretical_usd: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** @spec SPEC-AG-002, R4 — cost and cache discount allocation */
export function computeCost(attribution: Attribution, pricing: PricingTable): CostBreakdown {
  const warnings: string[] = [];
  let total = 0;
  for (const turn of attribution.turns) {
    if (typeof turn.costUSD === "number") {
      total += turn.costUSD;
      continue;
    }
    if (!isBillableModel(turn.model)) continue;
    const price = resolveModelPrice(pricing, turn.model);
    if (!price) {
      warnings.push(`Unknown model: ${turn.model}`);
      continue;
    }
    total +=
      (turn.usage.inputTokens / 1_000_000) * price.inputPerMillion +
      (turn.usage.outputTokens / 1_000_000) * price.outputPerMillion +
      (turn.usage.cacheReadInputTokens / 1_000_000) *
        price.inputPerMillion *
        price.cacheReadMultiplier +
      (turn.usage.cacheCreationInputTokens / 1_000_000) *
        price.inputPerMillion *
        price.cacheWriteMultiplier;
  }
  const totalTokens = attribution.sections.reduce((sum, section) => sum + section.tokens, 0);
  const sections = attribution.sections.map((section) => ({
    ...section,
    costUSD: totalTokens > 0 ? roundMoney((section.tokens / totalTokens) * total) : 0,
  }));
  const inputTotal =
    attribution.usage.inputTokens +
    attribution.usage.cacheReadInputTokens +
    attribution.usage.cacheCreationInputTokens;
  return {
    totalUSD: warnings.length > 0 && total === 0 ? null : roundMoney(total),
    cacheHitRate: inputTotal > 0 ? attribution.usage.cacheReadInputTokens / inputTotal : 0,
    sections,
    warnings,
  };
}

/** @spec SPEC-AG-002, R5 — dual savings primitives */
export function savingsFromTokens(
  tokens: number,
  inputPerMillion = 3,
  conservativeRatio = 0.6,
): Savings {
  const theoretical = (tokens / 1_000_000) * inputPerMillion;
  return {
    conservative_usd: roundMoney(theoretical * conservativeRatio),
    theoretical_usd: roundMoney(theoretical),
  };
}
