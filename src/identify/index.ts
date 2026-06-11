import type { Session } from "../parsers/types.js";
import { AGENT_PROFILES } from "./profiles.js";

export interface AgentIdentity {
  agent: string;
  confidence: number;
  version?: string;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/** @spec SPEC-AG-006, R1/R3 — path-first, then tool-signature identity */
export function identify(session: Session): AgentIdentity {
  const normalizedPath = session.sourcePath.replace(/\\/g, "/");
  if (
    normalizedPath.includes("/.claude/projects/") ||
    normalizedPath.includes("/claude/projects/")
  ) {
    return { agent: "claude-code", confidence: 0.97 };
  }
  const tools = new Set(
    session.turns.flatMap((turn) =>
      turn.messages.flatMap((message) => message.toolCalls.map((call) => call.name)),
    ),
  );
  let best: AgentIdentity = { agent: "unknown", confidence: 0 };
  for (const profile of AGENT_PROFILES) {
    const score = jaccard(tools, new Set(profile.toolSignature));
    const confidence = score >= 0.15 ? 0.7 + Math.min(score, 1) * 0.25 : 0;
    if (confidence > best.confidence) best = { agent: profile.agent, confidence };
  }
  return best.confidence < 0.4 ? { agent: "unknown", confidence: 0 } : best;
}
