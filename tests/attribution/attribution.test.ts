import { describe, expect, it } from "vitest";
import { computeCost, savingsFromTokens } from "../../src/attribution/cost.js";
import {
  bundledPricingTable,
  isBillableModel,
  resolveModelPrice,
} from "../../src/attribution/pricing.js";
import { approximateTokens, attributeSession } from "../../src/attribution/tokenize.js";
import { identify } from "../../src/identify/index.js";
import { parseClaudeSessionFile } from "../../src/parsers/claude-code.js";
import { totalInput } from "../../src/parsers/types.js";
import { fixture } from "../helpers.js";

describe("attribution and cost", () => {
  it("keeps section totals equal to usage totals", async () => {
    const session = await parseClaudeSessionFile(fixture("noisy-sidechain.jsonl"));
    const attr = attributeSession(session, identify(session));
    const sectionTokens = attr.sections.reduce((sum, section) => sum + section.tokens, 0);
    expect(sectionTokens).toBe(totalInput(attr.usage) + attr.usage.outputTokens);
    expect(attr.sidechain.sidechain?.turns).toBe(1);
  });

  it("computes balanced costs and savings", async () => {
    const session = await parseClaudeSessionFile(fixture("clean-session.jsonl"));
    const attr = attributeSession(session, identify(session));
    const cost = computeCost(attr, bundledPricingTable());
    expect(cost.totalUSD).not.toBeNull();
    expect(cost.cacheHitRate).toBeGreaterThan(0);
    expect(cost.sections.reduce((sum, section) => sum + (section.costUSD ?? 0), 0)).toBeGreaterThan(
      0,
    );
    const savings = savingsFromTokens(10_000);
    expect(savings.conservative_usd).toBeLessThanOrEqual(savings.theoretical_usd);
  });

  it("normalizes model aliases and excludes synthetic models", () => {
    const table = bundledPricingTable();
    expect(resolveModelPrice(table, "claude-sonnet-4-5-20250929")).toBeDefined();
    expect(isBillableModel("<synthetic>")).toBe(false);
    expect(approximateTokens("abcd")).toBe(1);
  });
});
