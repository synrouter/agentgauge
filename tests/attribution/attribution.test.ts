import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeCost, savingsFromTokens } from "../../src/attribution/cost.js";
import {
  bundledPricingTable,
  isBillableModel,
  loadPricingTable,
  resolveModelPrice,
} from "../../src/attribution/pricing.js";
import { approximateTokens, attributeSession } from "../../src/attribution/tokenize.js";
import { identify } from "../../src/identify/index.js";
import { parseClaudeSessionFile } from "../../src/parsers/claude-code.js";
import { totalInput } from "../../src/parsers/types.js";
import { fixture } from "../helpers.js";

describe("attribution and cost", () => {
  let tmp: string | undefined;

  afterEach(() => {
    if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
    tmp = undefined;
  });

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
    const section = (key: string) => attr.sections.find((item) => item.key === key)?.tokens ?? 0;
    expect(section("system_prompt")).toBeGreaterThan(0);
    expect(section("tool_definitions")).toBeGreaterThan(0);
    expect(section("tool_results")).toBeGreaterThan(0);
    expect(section("user_input")).toBeGreaterThan(0);
    expect(section("history")).toBeGreaterThan(0);
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
    expect(resolveModelPrice(table, "claude-sonnet-4-6")).toBeDefined();
    expect(resolveModelPrice(table, "anthropic/claude-opus-4.8")?.inputPerMillion).toBe(5);
    expect(resolveModelPrice(table, "anthropic/claude-fable-5")?.inputPerMillion).toBe(10);
    expect(resolveModelPrice(table, "anthropic:claude-opus-4.8")?.inputPerMillion).toBe(5);
    expect(isBillableModel("<synthetic>")).toBe(false);
    expect(approximateTokens("abcd")).toBe(1);
  });

  it("merges local pricing overrides on top of bundled pricing", () => {
    tmp = mkdtempSync(join(tmpdir(), "agentgauge-pricing-"));
    const path = join(tmp, "pricing.json");
    writeFileSync(
      path,
      JSON.stringify(
        {
          version: "override",
          models: {
            "claude-opus-4-8": {
              aliases: ["opus-4-8"],
              inputPerMillion: 7,
              outputPerMillion: 35,
              cacheReadMultiplier: 0.1,
              cacheWriteMultiplier: 1.25,
            },
          },
        },
        null,
        2,
      ),
    );
    const table = loadPricingTable(path);
    expect(table.version).toBe("override");
    expect(resolveModelPrice(table, "anthropic/claude-opus-4.8")?.inputPerMillion).toBe(7);
    expect(resolveModelPrice(table, "claude-sonnet-4-6")?.inputPerMillion).toBe(3);
  });

  it("prefers exact then longest alias so version prefixes cannot shadow", () => {
    const price = (input: number) => ({
      aliases: [],
      inputPerMillion: input,
      outputPerMillion: input * 5,
      cacheReadMultiplier: 0.1,
      cacheWriteMultiplier: 1.25,
    });
    const table = {
      version: "test",
      models: {
        "claude-opus-4": price(10),
        "claude-opus-4-1": price(15),
      },
    };
    expect(resolveModelPrice(table, "claude-opus-4-1")?.inputPerMillion).toBe(15);
    expect(resolveModelPrice(table, "claude-opus-4-1-20250805")?.inputPerMillion).toBe(15);
    expect(resolveModelPrice(table, "claude-opus-4-20250514")?.inputPerMillion).toBe(10);
  });

  it("locks Anthropic usage semantics: input and cache tokens are disjoint", () => {
    // Anthropic usage reports input_tokens EXCLUSIVE of cache_read/cache_creation
    // (unlike OpenAI). Each component is priced independently and summed.
    const table = {
      version: "test",
      models: {
        "claude-sonnet-4-5": {
          aliases: [],
          inputPerMillion: 3,
          outputPerMillion: 15,
          cacheReadMultiplier: 0.1,
          cacheWriteMultiplier: 1.25,
        },
      },
    };
    const usage = {
      inputTokens: 1000,
      outputTokens: 100,
      cacheReadInputTokens: 800,
      cacheCreationInputTokens: 120,
    };
    const attribution = {
      sessionId: "s",
      agent: { agent: "claude-code", confidence: 1 },
      usage,
      sections: [],
      turns: [
        {
          turnId: "t1",
          isSidechain: false,
          model: "claude-sonnet-4-5",
          usage,
          sections: [],
          residualInputTokens: 0,
        },
      ],
      residuals: [],
      sidechain: { orchestrator: { tokens: 0, costUSD: null, turns: 1 } },
    };
    const cost = computeCost(attribution, table);
    const expected =
      (1000 / 1e6) * 3 + (100 / 1e6) * 15 + (800 / 1e6) * 3 * 0.1 + (120 / 1e6) * 3 * 1.25;
    // totalUSD is rounded to 4 decimal places by roundMoney.
    expect(cost.totalUSD).toBeCloseTo(expected, 4);
  });
});
