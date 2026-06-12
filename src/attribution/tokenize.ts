import type { AgentIdentity } from "../identify/index.js";
import type { Session, Turn, Usage } from "../parsers/types.js";
import { emptyUsage, sumUsage, totalInput } from "../parsers/types.js";

export type SectionKey =
  | "system_prompt"
  | "tool_definitions"
  | "tool_results"
  | "history"
  | "user_input"
  | "assistant_output"
  | "cache_read"
  | "cache_write";

export interface SectionAttribution {
  key: SectionKey;
  tokens: number;
  estimated: boolean;
  costUSD: number | null;
}

export interface TurnAttribution {
  turnId: string;
  isSidechain: boolean;
  model?: string;
  usage: Usage;
  sections: SectionAttribution[];
  residualInputTokens: number;
  costUSD?: number;
}

export interface BucketSummary {
  tokens: number;
  costUSD: number | null;
  turns: number;
}

export interface Attribution {
  sessionId: string;
  agent: AgentIdentity;
  usage: Usage;
  sections: SectionAttribution[];
  turns: TurnAttribution[];
  residuals: number[];
  sidechain: {
    orchestrator: BucketSummary;
    sidechain?: BucketSummary;
  };
}

export function approximateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function hasBillableUsage(turn: Turn): boolean {
  return turn.messages.some((message) => {
    const usage = message.usage;
    return (
      usage.inputTokens > 0 ||
      usage.outputTokens > 0 ||
      usage.cacheReadInputTokens > 0 ||
      usage.cacheCreationInputTokens > 0
    );
  });
}

function messageInputText(turn: Turn): {
  toolResults: number;
  userInput: number;
  history: number;
  output: number;
} {
  let toolResults = 0;
  let userInput = 0;
  let history = 0;
  let output = 0;
  for (const message of turn.messages) {
    if (message.role === "assistant") output += message.usage.outputTokens;
    if (message.role === "user" && !message.isSystemInjected) {
      const resultText = message.toolResults.map((result) => result.content).join("\n");
      toolResults += approximateTokens(resultText);
      userInput += approximateTokens(message.text);
    }
    if (message.role !== "system") {
      history += approximateTokens(message.text);
      history += approximateTokens(message.toolResults.map((result) => result.content).join("\n"));
    }
  }
  return { toolResults, userInput, history, output };
}

function measurableForRequest(
  turns: Turn[],
  usageTurnIndex: number,
  previousUsageIndex: number,
): {
  toolResults: number;
  userInput: number;
  history: number;
} {
  let toolResults = 0;
  let userInput = 0;
  let history = 0;
  for (let index = 0; index < usageTurnIndex; index += 1) {
    const measured = messageInputText(turns[index]!);
    if (index > previousUsageIndex) {
      toolResults += measured.toolResults;
      userInput += measured.userInput;
    } else {
      history += measured.history;
    }
  }
  return { toolResults, userInput, history };
}

function scaleInputs(
  usage: Usage,
  counts: { toolResults: number; userInput: number; history: number },
) {
  const available = Math.max(0, usage.inputTokens);
  const rawTotal = counts.toolResults + counts.userInput + counts.history;
  if (rawTotal === 0) return { toolResults: 0, userInput: 0, history: 0, residual: available };
  const cap = Math.min(rawTotal, available);
  const toolResults = Math.round((counts.toolResults / rawTotal) * cap);
  const userInput = Math.round((counts.userInput / rawTotal) * cap);
  const history = Math.max(0, cap - toolResults - userInput);
  return { toolResults, userInput, history, residual: Math.max(0, available - cap) };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function blankSection(key: SectionKey, tokens = 0, estimated = false): SectionAttribution {
  return { key, tokens, estimated, costUSD: null };
}

function bucket(turns: TurnAttribution[]): BucketSummary {
  const tokens = turns.reduce(
    (sum, turn) => sum + totalInput(turn.usage) + turn.usage.outputTokens,
    0,
  );
  return { tokens, costUSD: null, turns: turns.length };
}

/** @spec SPEC-AG-002, R1/R2/R3 — log-mode semantic token attribution */
export function attributeSession(session: Session, agent: AgentIdentity): Attribution {
  const usage = sumUsage(
    session.turns.flatMap((turn) => turn.messages.map((message) => message.usage)),
  );
  const residuals: number[] = [];
  let previousUsageIndex = -1;
  const turnInputs = session.turns.flatMap((turn, turnIndex) => {
    if (!hasBillableUsage(turn)) return [];
    const turnUsage = sumUsage(turn.messages.map((message) => message.usage));
    const measured = measurableForRequest(session.turns, turnIndex, previousUsageIndex);
    previousUsageIndex = turnIndex;
    const scaled = scaleInputs(turnUsage, measured);
    residuals.push(scaled.residual);
    return [{ turn, turnUsage, scaled }];
  });
  const stablePrefix = median(residuals.filter((value) => value > 0));
  const turns: TurnAttribution[] = turnInputs.map(({ turn, turnUsage, scaled }) => {
    const prefix = stablePrefix > 0 ? Math.min(stablePrefix, scaled.residual) : scaled.residual;
    const system = Math.round(prefix * 0.35);
    const tools = Math.max(0, scaled.residual - system);
    return {
      turnId: turn.id,
      isSidechain: turn.isSidechain,
      model: turn.messages.find((message) => message.model)?.model,
      usage: turnUsage,
      costUSD: turn.messages.find((message) => typeof message.costUSD === "number")?.costUSD,
      residualInputTokens: scaled.residual,
      sections: [
        blankSection("system_prompt", system, true),
        blankSection("tool_definitions", tools, true),
        blankSection("tool_results", scaled.toolResults),
        blankSection("history", scaled.history),
        blankSection("user_input", scaled.userInput),
        blankSection("assistant_output", turnUsage.outputTokens),
        blankSection("cache_read", turnUsage.cacheReadInputTokens),
        blankSection("cache_write", turnUsage.cacheCreationInputTokens),
      ],
    };
  });
  const sections = new Map<SectionKey, SectionAttribution>();
  for (const turn of turns) {
    for (const section of turn.sections) {
      const prev = sections.get(section.key) ?? blankSection(section.key, 0, section.estimated);
      prev.tokens += section.tokens;
      prev.estimated = prev.estimated || section.estimated;
      sections.set(section.key, prev);
    }
  }
  const orchestratorTurns = turns.filter((turn) => !turn.isSidechain);
  const sidechainTurns = turns.filter((turn) => turn.isSidechain);
  return {
    sessionId: session.id,
    agent,
    usage,
    sections: [...sections.values()],
    turns,
    residuals,
    sidechain: {
      orchestrator: bucket(orchestratorTurns),
      sidechain: sidechainTurns.length > 0 ? bucket(sidechainTurns) : undefined,
    },
  };
}

export function zeroAttribution(sessionId: string, agent: AgentIdentity): Attribution {
  return {
    sessionId,
    agent,
    usage: emptyUsage(),
    sections: [],
    turns: [],
    residuals: [],
    sidechain: { orchestrator: { tokens: 0, costUSD: null, turns: 0 } },
  };
}
