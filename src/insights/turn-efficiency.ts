import type { Attribution } from "../attribution/tokenize.js";
import type { Session, Turn } from "../parsers/types.js";
import { sumUsage, totalInput } from "../parsers/types.js";
import { toolResultLooksLikeError } from "./tool-behavior.js";
import type { TurnEfficiency } from "./types.js";

function sectionTokens(turn: Attribution["turns"][number] | undefined, key: string): number {
  return turn?.sections.find((section) => section.key === key)?.tokens ?? 0;
}

function hasEdit(turn: Turn): boolean {
  return turn.messages.some((message) =>
    message.toolCalls.some((call) => /^(edit|multiedit|write)$/i.test(call.name)),
  );
}

function hasTestCommand(turn: Turn): boolean {
  return turn.messages.some((message) =>
    message.toolCalls.some((call) => {
      if (call.name.toLowerCase() !== "bash") return false;
      if (!call.input || typeof call.input !== "object") return false;
      const command = (call.input as Record<string, unknown>).command;
      return (
        typeof command === "string" &&
        /\b(test|vitest|jest|pytest|cargo test|go test)\b/i.test(command)
      );
    }),
  );
}

function hasError(turn: Turn): boolean {
  return turn.messages.some((message) =>
    message.toolResults.some(
      (result) => result.isError || toolResultLooksLikeError(result.content),
    ),
  );
}

function toolCallCount(turn: Turn): number {
  return turn.messages.reduce((sum, message) => sum + message.toolCalls.length, 0);
}

/** @spec SPEC-AG-007, R3 — turn-level efficiency sequence */
export function buildTurnEfficiency(session: Session, attribution: Attribution): TurnEfficiency[] {
  const byTurn = new Map(attribution.turns.map((turn) => [turn.turnId, turn]));
  return session.turns.map((turn, index) => {
    const attributed = byTurn.get(turn.id);
    const usage = attributed?.usage ?? sumUsage(turn.messages.map((message) => message.usage));
    const inputTokens = totalInput(usage);
    const outputTokens = usage.outputTokens;
    const calls = toolCallCount(turn);
    const flags: TurnEfficiency["flags"] = [];
    if (hasEdit(turn)) flags.push("edit");
    if (hasTestCommand(turn)) flags.push("test");
    if (hasError(turn)) flags.push("error");
    if (calls <= 1 && outputTokens <= 120 && !flags.includes("edit")) flags.push("simple");
    return {
      turnIndex: index + 1,
      turnId: turn.id,
      inputTokens,
      outputTokens,
      costUsd: attributed?.costUSD ?? 0,
      inputOutputRatio: outputTokens > 0 ? inputTokens / outputTokens : null,
      toolCallCount: calls,
      contextTokens:
        sectionTokens(attributed, "history") + sectionTokens(attributed, "tool_results"),
      cacheReadTokens: usage.cacheReadInputTokens,
      cacheWriteTokens: usage.cacheCreationInputTokens,
      flags,
    };
  });
}

function downsample(values: number[], width: number): number[] {
  if (values.length <= width) return values;
  return Array.from({ length: width }, (_, index) => {
    const start = Math.floor((index / width) * values.length);
    const end = Math.max(start + 1, Math.floor(((index + 1) / width) * values.length));
    return Math.max(...values.slice(start, end));
  });
}

export function sparkline(values: number[], width = 64): string {
  if (values.length === 0) return "";
  const ticks = "▁▂▃▄▅▆▇█";
  const sampled = downsample(values, Math.max(1, width));
  const max = Math.max(...sampled);
  if (max <= 0) return "▁".repeat(sampled.length);
  return sampled
    .map(
      (value) => ticks[Math.min(ticks.length - 1, Math.floor((value / max) * (ticks.length - 1)))],
    )
    .join("");
}
