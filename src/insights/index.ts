import type { Attribution } from "../attribution/tokenize.js";
import type { Finding } from "../detectors/index.js";
import type { AgentIdentity } from "../identify/index.js";
import type { Session } from "../parsers/types.js";
import { buildBehaviorSuggestions } from "./suggestions.js";
import { buildToolBehavior, buildToolInventory } from "./tool-behavior.js";
import { buildTurnEfficiency } from "./turn-efficiency.js";
import type { BehaviorInsights } from "./types.js";

export type {
  BehaviorInsights,
  BehaviorSuggestion,
  InsightSeverity,
  ToolBehavior,
  ToolTarget,
  TurnEfficiency,
} from "./types.js";
export { sparkline } from "./turn-efficiency.js";
export { targetSignature } from "./tool-behavior.js";
export { buildBehaviorSuggestions } from "./suggestions.js";

/** @spec SPEC-AG-007, R1/R2/R3/R4 — build behavior profiler data */
export function buildBehaviorInsights(input: {
  session: Session;
  attribution: Attribution;
  agent: AgentIdentity;
  findings?: Finding[];
}): BehaviorInsights {
  const toolBehavior = buildToolBehavior(input.session, input.attribution);
  const toolInventory = buildToolInventory(input.agent, input.session);
  const turnEfficiency = buildTurnEfficiency(input.session, input.attribution);
  const findingIds = (input.findings ?? []).map((finding) => finding.id);
  const suggestions = buildBehaviorSuggestions({
    tools: toolBehavior,
    turns: turnEfficiency,
    toolInventory,
    findingIds,
  });
  return { toolBehavior, toolInventory, turnEfficiency, suggestions };
}
