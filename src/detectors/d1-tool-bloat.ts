import { savingsFromTokens } from "../attribution/cost.js";
import { getProfile } from "../identify/profiles.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

/** @spec SPEC-AG-003, R3 — log-mode idle tool definition estimator */
export function d1ToolBloat(ctx: DetectorContext): Finding[] {
  const profile = getProfile(ctx.agent.agent);
  if (!profile || profile.builtinTools.length === 0) return [];
  const used = new Set(
    ctx.session.turns.flatMap((turn) =>
      turn.messages.flatMap((message) => message.toolCalls.map((call) => call.name)),
    ),
  );
  const idle = profile.builtinTools.filter((tool) => !used.has(tool.name));
  const idleRatio = idle.length / profile.builtinTools.length;
  const idleTokens = idle.reduce((sum, tool) => sum + tool.schemaTokens, 0);
  const savings = savingsFromTokens(idleTokens * Math.max(1, ctx.session.turns.length));
  if (
    idleRatio <= THRESHOLDS.toolIdleRatioHigh ||
    savings.conservative_usd <= THRESHOLDS.toolIdleSavingsHigh
  )
    return [];
  return [
    {
      id: "D1",
      severity: "high",
      title: "Loaded tool definitions that were not used",
      evidence: [
        `${idle.length}/${profile.builtinTools.length} builtin tools were idle: ${idle.map((tool) => tool.name).join(", ")}`,
      ],
      savings,
      fix_path: "Load a smaller tool set for narrow tasks.",
      fix_url: "https://synrouter.ai/connect?source=agentgauge&detector=D1",
      estimated: true,
    },
  ];
}
