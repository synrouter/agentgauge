import type { BehaviorSuggestion, ToolBehavior, TurnEfficiency } from "./types.js";

function suggestion(
  id: string,
  severity: BehaviorSuggestion["severity"],
  title: string,
  evidence: Record<string, unknown>,
  action: string,
  confidence: number,
  relatedFindingIds?: string[],
): BehaviorSuggestion {
  return { id, severity, title, evidence, action, confidence, relatedFindingIds };
}

/** @spec SPEC-AG-007, R4 — evidence-backed behavior suggestions */
export function buildBehaviorSuggestions(input: {
  tools: ToolBehavior[];
  turns: TurnEfficiency[];
  toolInventory?: { loaded: number; used: number; idle: number; estimated: boolean };
  findingIds: string[];
}): BehaviorSuggestion[] {
  const suggestions: BehaviorSuggestion[] = [];
  const repeated = input.tools.find((tool) => tool.repeatRate >= 0.5 && tool.calls >= 3);
  if (repeated) {
    suggestions.push(
      suggestion(
        "S-read-churn",
        "med",
        `${repeated.tool} repeats the same target`,
        {
          tool: repeated.tool,
          calls: repeated.calls,
          repeat_rate: repeated.repeatRate,
          top_targets: repeated.topTargets,
        },
        "Record stable project facts in CLAUDE.md or narrow the tool query before re-reading the same target.",
        repeated.confidence,
        input.findingIds.includes("D8") ? ["D8"] : undefined,
      ),
    );
  }

  const failing = input.tools.find((tool) => tool.errorRate >= 0.3 && tool.errorCount >= 2);
  if (failing) {
    suggestions.push(
      suggestion(
        "S-tool-failures",
        "med",
        `${failing.tool} has repeated failures`,
        { tool: failing.tool, calls: failing.calls, error_count: failing.errorCount },
        "Document the correct command, environment variables, or permissions so the agent does not retry failing calls.",
        Math.max(0.5, failing.confidence),
        input.findingIds.includes("D6") ? ["D6"] : undefined,
      ),
    );
  }

  const inventory = input.toolInventory;
  if (inventory && inventory.loaded > 0 && inventory.idle / inventory.loaded > 0.5) {
    suggestions.push(
      suggestion(
        "S-tool-inventory",
        "high",
        "Most loaded tools were not used",
        {
          loaded: inventory.loaded,
          used: inventory.used,
          idle: inventory.idle,
          estimated: inventory.estimated,
        },
        "Disable unused MCP tools for narrow tasks or use request-layer tool trimming.",
        inventory.estimated ? 0.7 : 0.95,
        input.findingIds.includes("D1") ? ["D1"] : undefined,
      ),
    );
  }

  const contextValues = input.turns.map((turn) => turn.contextTokens);
  const first = contextValues.find((value) => value > 0) ?? 0;
  const last = contextValues.at(-1) ?? 0;
  if (first > 0 && last / first >= 1.8 && input.turns.length >= 4) {
    suggestions.push(
      suggestion(
        "S-context-growth",
        "low",
        "Context grew quickly across the session",
        { first_context_tokens: first, last_context_tokens: last, turns: input.turns.length },
        "Compact earlier or cap large tool outputs before they become repeated history.",
        0.65,
        input.findingIds.includes("D9") ? ["D9"] : undefined,
      ),
    );
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}
