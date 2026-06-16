import { createHash } from "node:crypto";
import { z } from "zod";
import type { ModelPrice, PricingTable } from "./pricing.js";

export const LITELLM_PRICING_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

const liteLlmEntrySchema = z.object({
  input_cost_per_token: z.number().nonnegative().optional(),
  output_cost_per_token: z.number().nonnegative().optional(),
  cache_read_input_token_cost: z.number().nonnegative().optional(),
  input_cost_per_token_cache_hit: z.number().nonnegative().optional(),
  cache_creation_input_token_cost: z.number().nonnegative().optional(),
});

const liteLlmPricingSchema = z.record(liteLlmEntrySchema);

interface PricingSpec {
  id: string;
  candidates: string[];
}

const SPECS: PricingSpec[] = [
  {
    id: "claude-sonnet-4-5",
    candidates: [
      "anthropic.claude-sonnet-4-5-20250929-v1:0",
      "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    ],
  },
  {
    id: "claude-opus-4-1",
    candidates: [
      "anthropic.claude-opus-4-1-20250805-v1:0",
      "global.anthropic.claude-opus-4-1-20250805-v1:0",
    ],
  },
  {
    id: "claude-opus-4-8",
    candidates: ["anthropic.claude-opus-4-8", "global.anthropic.claude-opus-4-8"],
  },
  {
    id: "claude-sonnet-4-6",
    candidates: ["anthropic.claude-sonnet-4-6", "global.anthropic.claude-sonnet-4-6"],
  },
  {
    id: "claude-fable-5",
    candidates: ["anthropic.claude-fable-5", "global.anthropic.claude-fable-5"],
  },
  {
    id: "claude-haiku-4-5",
    candidates: [
      "anthropic.claude-haiku-4-5-20251001-v1:0",
      "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    ],
  },
  {
    id: "claude-opus-4-7",
    candidates: ["anthropic.claude-opus-4-7", "global.anthropic.claude-opus-4-7"],
  },
  {
    id: "gemini-3-pro-preview",
    candidates: ["gemini-3-pro-preview", "gemini/gemini-3-pro-preview"],
  },
  {
    id: "gemini-3.1-flash-lite",
    candidates: ["gemini-3.1-flash-lite", "gemini-3.1-flash-lite-preview"],
  },
  {
    id: "gemini-pro-latest",
    candidates: ["gemini-pro-latest", "gemini/gemini-pro-latest"],
  },
  {
    id: "gemini-flash-latest",
    candidates: ["gemini-flash-latest", "gemini/gemini-flash-latest"],
  },
  {
    id: "gemini-flash-lite-latest",
    candidates: ["gemini-flash-lite-latest", "gemini/gemini-flash-lite-latest"],
  },
  {
    id: "gpt-5.4",
    candidates: ["gpt-5.4", "azure/global/gpt-5.4", "azure/gpt-5.4", "azure_ai/gpt-5.4"],
  },
  {
    id: "gpt-5.4-pro",
    candidates: [
      "gpt-5.4-pro",
      "azure/global/gpt-5.4-pro",
      "azure/gpt-5.4-pro",
      "azure_ai/gpt-5.4-pro",
    ],
  },
  {
    id: "gpt-5.4-mini",
    candidates: [
      "gpt-5.4-mini",
      "azure/global/gpt-5.4-mini",
      "azure/gpt-5.4-mini",
      "azure_ai/gpt-5.4-mini",
    ],
  },
  {
    id: "gpt-5.4-nano",
    candidates: [
      "gpt-5.4-nano",
      "azure/global/gpt-5.4-nano",
      "azure/gpt-5.4-nano",
      "azure_ai/gpt-5.4-nano",
    ],
  },
  {
    id: "gpt-5.1",
    candidates: ["gpt-5.1", "azure/global/gpt-5.1", "azure/gpt-5.1-2025-11-13", "azure_ai/gpt-5.1"],
  },
  {
    id: "gpt-5.1-chat",
    candidates: [
      "gpt-5.1-chat-latest",
      "azure/global/gpt-5.1-chat",
      "azure/gpt-5.1-chat-2025-11-13",
    ],
  },
  {
    id: "gpt-5.1-codex",
    candidates: ["gpt-5.1-codex", "azure/global/gpt-5.1-codex", "azure/gpt-5.1-codex-2025-11-13"],
  },
  {
    id: "gpt-5",
    candidates: ["gpt-5", "azure/global/gpt-5", "azure/gpt-5-2025-08-07"],
  },
  {
    id: "gpt-5-mini",
    candidates: ["gpt-5-mini", "azure/global/gpt-5-mini", "azure/gpt-5-mini-2025-08-07"],
  },
  {
    id: "gpt-5-nano",
    candidates: ["gpt-5-nano", "azure/global/gpt-5-nano", "azure/gpt-5-nano-2025-08-07"],
  },
  {
    id: "deepseek-v3.2",
    candidates: ["deepseek/deepseek-v3.2", "deepseek-v3.2", "azure_ai/deepseek-v3.2"],
  },
  {
    id: "deepseek-v3.2-speciale",
    candidates: [
      "deepseek/deepseek-v3.2-speciale",
      "deepseek-v3.2-speciale",
      "azure_ai/deepseek-v3.2-speciale",
    ],
  },
  {
    id: "deepseek-r1",
    candidates: ["deepseek/deepseek-r1", "deepseek-r1", "azure_ai/deepseek-r1"],
  },
  {
    id: "deepseek-chat",
    candidates: ["deepseek/deepseek-chat", "deepseek-chat"],
  },
  {
    id: "deepseek-reasoner",
    candidates: ["deepseek/deepseek-reasoner", "deepseek-reasoner"],
  },
  {
    id: "kimi-k2.6",
    candidates: ["moonshot/kimi-k2.6", "azure_ai/kimi-k2.6"],
  },
  {
    id: "kimi-k2.5",
    candidates: ["azure_ai/kimi-k2.5", "bedrock/moonshotai.kimi-k2.5"],
  },
  {
    id: "kimi-k2-thinking",
    candidates: [
      "bedrock/us-east-1/moonshotai.kimi-k2-thinking",
      "moonshot/kimi-k2-thinking",
      "gmi/moonshotai/Kimi-K2-Thinking",
    ],
  },
  {
    id: "minimax-m2.5",
    candidates: ["bedrock/us-east-1/minimax.minimax-m2.5"],
  },
  {
    id: "minimax-m2.1",
    candidates: ["bedrock/us-east-1/minimax.minimax-m2.1"],
  },
  {
    id: "qwen3-coder-next",
    candidates: ["bedrock/us-east-1/qwen.qwen3-coder-next"],
  },
  {
    id: "qwen-max",
    candidates: ["dashscope/qwen-max"],
  },
  {
    id: "qwen-plus",
    candidates: ["dashscope/qwen-plus"],
  },
  {
    id: "glm-5",
    candidates: ["zai/glm-5", "zai.glm-5", "openrouter/z-ai/glm-5", "baseten/zai-org/GLM-5"],
  },
  {
    id: "glm-5-code",
    candidates: ["zai/glm-5-code"],
  },
  {
    id: "glm-4.7",
    candidates: ["zai/glm-4.7", "zai.glm-4.7", "openrouter/z-ai/glm-4.7"],
  },
  {
    id: "glm-4.7-flash",
    candidates: ["zai/glm-4.7-flash", "zai.glm-4.7-flash", "openrouter/z-ai/glm-4.7-flash"],
  },
  {
    id: "mimo-v2.5-pro",
    candidates: ["openrouter/xiaomi/mimo-v2.5-pro"],
  },
  {
    id: "mimo-v2.5",
    candidates: ["openrouter/xiaomi/mimo-v2.5"],
  },
  {
    id: "mimo-v2-flash",
    candidates: ["openrouter/xiaomi/mimo-v2-flash", "novita/xiaomimimo/mimo-v2-flash"],
  },
];

function firstPrice(raw: Record<string, z.infer<typeof liteLlmEntrySchema>>, candidates: string[]) {
  for (const candidate of candidates) {
    const entry = raw[candidate];
    if (
      entry &&
      typeof entry.input_cost_per_token === "number" &&
      typeof entry.output_cost_per_token === "number"
    ) {
      return entry;
    }
  }
  return undefined;
}

function multiplier(base?: number, fallback = 0.1): number {
  return typeof base === "number" && Number.isFinite(base) ? base : fallback;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function cacheReadMultiplier(entry: z.infer<typeof liteLlmEntrySchema>): number {
  const base = entry.cache_read_input_token_cost ?? entry.input_cost_per_token_cache_hit;
  if (
    typeof base === "number" &&
    typeof entry.input_cost_per_token === "number" &&
    entry.input_cost_per_token > 0
  ) {
    return base / entry.input_cost_per_token;
  }
  return 0.1;
}

function cacheWriteMultiplier(entry: z.infer<typeof liteLlmEntrySchema>): number {
  if (
    typeof entry.cache_creation_input_token_cost === "number" &&
    typeof entry.input_cost_per_token === "number" &&
    entry.input_cost_per_token > 0
  ) {
    return entry.cache_creation_input_token_cost / entry.input_cost_per_token;
  }
  return 1.25;
}

export function buildPricingTableFromLiteLLM(
  raw: unknown,
  sourceText?: string,
): PricingTable | undefined {
  const parsed = liteLlmPricingSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const models: Record<string, ModelPrice> = {};
  for (const spec of SPECS) {
    const entry = firstPrice(parsed.data, spec.candidates);
    if (!entry) continue;
    const input = entry.input_cost_per_token ?? 0;
    const output = entry.output_cost_per_token ?? 0;
    models[spec.id] = {
      aliases: [],
      inputPerMillion: round(input * 1_000_000),
      outputPerMillion: round(output * 1_000_000),
      cacheReadMultiplier: round(multiplier(cacheReadMultiplier(entry), 0.1), 4),
      cacheWriteMultiplier: round(multiplier(cacheWriteMultiplier(entry), 1.25), 4),
    };
  }
  return {
    version: sourceText
      ? `litellm:${createHash("sha256").update(sourceText).digest("hex").slice(0, 12)}`
      : "litellm",
    models,
  };
}
