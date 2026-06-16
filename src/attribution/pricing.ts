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

function clonePricingTable(table: PricingTable): PricingTable {
  return {
    version: table.version,
    models: Object.fromEntries(
      Object.entries(table.models).map(([model, price]) => [
        model,
        { ...price, aliases: [...price.aliases] },
      ]),
    ),
  };
}

function mergePricingTables(base: PricingTable, overlay: PricingTable): PricingTable {
  return {
    version: overlay.version || base.version,
    models: {
      ...clonePricingTable(base).models,
      ...clonePricingTable(overlay).models,
    },
  };
}

export function loadPricingTable(
  path = join(homedir(), ".agentgauge", "pricing.json"),
): PricingTable {
  if (existsSync(path)) {
    try {
      return mergePricingTables(
        bundledPricingTable(),
        pricingTableSchema.parse(JSON.parse(readFileSync(path, "utf8"))),
      );
    } catch {
      return bundledPricingTable();
    }
  }
  return bundledPricingTable();
}

function normalizeModel(value: string): string {
  const shortName = value.toLowerCase().split("/").at(-1) ?? value.toLowerCase();
  return shortName.replace(/[.@_]/g, "-");
}

function candidateModelNames(model: string): string[] {
  const raw = model.trim().toLowerCase();
  const parts = raw.split(/[/:]/).filter(Boolean);
  const candidates = [raw, ...parts, ...parts.map(normalizeModel), normalizeModel(raw)];
  return [...new Set(candidates.filter(Boolean))];
}

/** @spec SPEC-AG-002, R4 — model alias resolution */
export function resolveModelPrice(table: PricingTable, model?: string): ModelPrice | undefined {
  if (!model || model === "<synthetic>") return undefined;
  const candidates = candidateModelNames(model);
  const normalizedCandidates = candidates.map(normalizeModel);
  // Exact candidate matches win first; after that we fall back to the longest
  // fuzzy alias, so short prefixes cannot shadow more specific versions.
  let best: { price: ModelPrice; length: number } | undefined;
  for (const [id, price] of Object.entries(table.models)) {
    for (const name of [id, ...price.aliases].map(normalizeModel)) {
      if (normalizedCandidates.includes(name)) return price;
      if (
        normalizedCandidates.some((candidate) => candidate.includes(name)) &&
        name.length > (best?.length ?? 0)
      ) {
        best = { price, length: name.length };
      }
    }
  }
  return best?.price;
}

export function isBillableModel(model?: string): boolean {
  return Boolean(model && model !== "<synthetic>");
}
