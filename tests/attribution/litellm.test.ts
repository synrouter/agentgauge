import { describe, expect, it } from "vitest";
import { buildPricingTableFromLiteLLM } from "../../src/attribution/litellm.js";
import { resolveModelPrice } from "../../src/attribution/pricing.js";

describe("LiteLLM pricing conversion", () => {
  it("converts raw LiteLLM pricing into the compact agentgauge table", () => {
    const table = buildPricingTableFromLiteLLM({
      "anthropic.claude-opus-4-8": {
        input_cost_per_token: 0.000005,
        output_cost_per_token: 0.000025,
        cache_creation_input_token_cost: 0.00000625,
        cache_read_input_token_cost: 0.0000005,
      },
      "gpt-5.4": {
        input_cost_per_token: 0.0000025,
        output_cost_per_token: 0.000015,
        cache_read_input_token_cost: 0.00000025,
      },
      "dashscope/qwen-plus": {
        input_cost_per_token: 0.0000004,
        output_cost_per_token: 0.0000012,
      },
    });

    expect(table?.version).toBe("litellm");
    expect(resolveModelPrice(table!, "anthropic/claude-opus-4.8")?.inputPerMillion).toBe(5);
    expect(resolveModelPrice(table!, "gpt-5.4")?.inputPerMillion).toBe(2.5);
    expect(resolveModelPrice(table!, "qwen-plus")?.inputPerMillion).toBe(0.4);
    expect(
      resolveModelPrice(table!, "anthropic/claude-opus-4.8")?.cacheWriteMultiplier,
    ).toBeCloseTo(1.25, 4);
    expect(resolveModelPrice(table!, "gpt-5.4")?.cacheReadMultiplier).toBeCloseTo(0.1, 4);
  });
});
