import { z } from "zod";
import type { ReportModel } from "./model.js";

export const reportSchema = z.object({
  version: z.string(),
  schema_version: z.literal(1),
  generated_at: z.string(),
  period: z.object({
    start: z.string().nullable(),
    end: z.string().nullable(),
  }),
  sessions: z.array(
    z.object({
      id: z.string(),
      project: z.string(),
      agent: z.string(),
      agent_confidence: z.number(),
      turns: z.number(),
      parse_errors: z.number(),
      sidechain: z.unknown(),
    }),
  ),
  aggregate: z.object({
    cost_usd: z.number().nullable(),
    potential_savings_usd: z.number(),
    cache_hit_rate: z.number(),
    tokens: z.object({ input: z.number(), output: z.number() }),
    model: z.string().optional(),
    models: z.array(z.object({ id: z.string(), turns: z.number() })),
    sections: z.array(z.unknown()),
    warnings: z.array(z.string()),
  }),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["low", "med", "high"]),
      title: z.string(),
      evidence: z.array(z.string()),
      savings: z.object({ conservative_usd: z.number(), theoretical_usd: z.number() }),
      fix_path: z.string(),
      fix_url: z.string().optional(),
      estimated: z.boolean().optional(),
    }),
  ),
});

/** @spec SPEC-AG-004, R3 — stable JSON schema renderer */
export function renderJson(model: ReportModel): string {
  return `${JSON.stringify(reportSchema.parse(model), null, 2)}\n`;
}
