import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import bundledPricing from "../../assets/pricing.json" with { type: "json" };

const modelPriceSchema = z.object({
  aliases: z.array(z.string()).default([]),
  inputPerMillion: z.number().nonnegative(),
  outputPerMillion: z.number().nonnegative(),
  cacheReadMultiplier: z.number().nonnegative().default(0.1),
  cacheWriteMultiplier: z.number().nonnegative().default(1.25),
});

export const pricingTableSchema = z.object({
  version: z.string(),
  models: z.record(modelPriceSchema),
});

export type PricingTable = z.infer<typeof pricingTableSchema>;
export type ModelPrice = z.infer<typeof modelPriceSchema>;

export function bundledPricingTable(): PricingTable {
  return pricingTableSchema.parse(bundledPricing);
}

export function loadPricingTable(
  path = join(homedir(), ".agentgauge", "pricing.json"),
): PricingTable {
  if (existsSync(path)) {
    try {
      return pricingTableSchema.parse(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      return bundledPricingTable();
    }
  }
  return bundledPricingTable();
}

function normalizeModel(value: string): string {
  return value.toLowerCase().replace(/[.@_]/g, "-");
}

/** @spec SPEC-AG-002, R4 — model alias resolution */
export function resolveModelPrice(table: PricingTable, model?: string): ModelPrice | undefined {
  if (!model || model === "<synthetic>") return undefined;
  const normalized = normalizeModel(model);
  for (const [id, price] of Object.entries(table.models)) {
    const names = [id, ...price.aliases].map(normalizeModel);
    if (names.some((name) => normalized === name || normalized.includes(name))) return price;
  }
  return undefined;
}

export function isBillableModel(model?: string): boolean {
  return Boolean(model && model !== "<synthetic>");
}
