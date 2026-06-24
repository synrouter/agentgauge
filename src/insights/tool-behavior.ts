import { savingsFromTokens } from "../attribution/cost.js";
import { type Attribution, approximateTokens } from "../attribution/tokenize.js";
import type { Finding } from "../detectors/index.js";
import type { AgentIdentity } from "../identify/index.js";
import { getProfile } from "../identify/profiles.js";
import type { Session, ToolCall } from "../parsers/types.js";
import { redactPath } from "../render/model.js";
import type { ToolBehavior } from "./types.js";

interface Acc {
  tool: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
  errorCount: number;
  largestResultTokens: number;
  targets: Map<string, { calls: number; tokens: number }>;
  parsedTargets: number;
}

const ERROR_RE =
  /\b(error|failed|failure|exception|traceback|permission denied|not found|exit code [1-9]\d*)\b/i;

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function stringField(input: unknown, keys: string[]): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function basenameWithHash(path: string): string {
  const base = redactPath(path);
  let hash = 0;
  for (const char of path) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${base}#${hash.toString(16).slice(0, 4)}`;
}

export function targetSignature(call: ToolCall): { label: string; parsed: boolean } {
  const name = call.name.toLowerCase();
  if (name === "read" || name === "edit" || name === "multiedit" || name === "write") {
    const file = stringField(call.input, ["file_path", "path"]);
    return file
      ? { label: basenameWithHash(file), parsed: true }
      : { label: "unknown", parsed: false };
  }
  if (name === "grep") {
    const pattern = stringField(call.input, ["pattern", "query", "regex"]);
    return pattern
      ? { label: `grep:${pattern.slice(0, 48)}`, parsed: true }
      : { label: "unknown", parsed: false };
  }
  if (name === "glob") {
    const pattern = stringField(call.input, ["pattern", "path"]);
    return pattern
      ? { label: `glob:${redactPath(pattern).slice(0, 48)}`, parsed: true }
      : { label: "unknown", parsed: false };
  }
  if (name === "bash") {
    const command = stringField(call.input, ["command"]);
    return command
      ? { label: `bash:${command.trim().split(/\s+/)[0] ?? "command"}`, parsed: true }
      : { label: "unknown", parsed: false };
  }
  const description = stringField(call.input, ["description", "prompt"]);
  return description
    ? { label: `${call.name}:${description.slice(0, 48)}`, parsed: true }
    : { label: "unknown", parsed: false };
}

function hasError(content: string, isError?: boolean): boolean {
  // Structured is_error flag wins; regex is a fallback for logs that lack it.
  if (isError) return true;
  return ERROR_RE.test(content);
}

function sectionTokens(attribution: Attribution, key: string): number {
  return attribution.sections.find((section) => section.key === key)?.tokens ?? 0;
}

function toolResultCost(tokens: number, attribution: Attribution): number {
  const toolResults = sectionTokens(attribution, "tool_results");
  const cost = attribution.sections.find((section) => section.key === "tool_results")?.costUSD ?? 0;
  return toolResults > 0 ? (tokens / toolResults) * cost : 0;
}

/** @spec SPEC-AG-007, R1 — per-tool behavior aggregation */
export function buildToolBehavior(session: Session, attribution: Attribution): ToolBehavior[] {
  const acc = new Map<string, Acc>();
  const index = new Map<string, ToolCall>();
  for (const turn of session.turns) {
    for (const message of turn.messages) {
      for (const call of message.toolCalls) index.set(call.id, call);
    }
  }
  for (const turn of session.turns) {
    for (const message of turn.messages) {
      for (const call of message.toolCalls) {
        const prev =
          acc.get(call.name) ??
          ({
            tool: call.name,
            calls: 0,
            totalTokens: 0,
            costUsd: 0,
            errorCount: 0,
            largestResultTokens: 0,
            targets: new Map(),
            parsedTargets: 0,
          } satisfies Acc);
        const target = targetSignature(call);
        prev.calls += 1;
        if (target.parsed) prev.parsedTargets += 1;
        const targetPrev = prev.targets.get(target.label) ?? { calls: 0, tokens: 0 };
        targetPrev.calls += 1;
        prev.targets.set(target.label, targetPrev);
        acc.set(call.name, prev);
      }
      for (const result of message.toolResults) {
        const call = index.get(result.toolUseId);
        const tool = result.toolName ?? call?.name ?? "unknown";
        const prev =
          acc.get(tool) ??
          ({
            tool,
            calls: 0,
            totalTokens: 0,
            costUsd: 0,
            errorCount: 0,
            largestResultTokens: 0,
            targets: new Map(),
            parsedTargets: 0,
          } satisfies Acc);
        const tokens = approximateTokens(result.content);
        prev.totalTokens += tokens;
        prev.costUsd += toolResultCost(tokens, attribution);
        prev.largestResultTokens = Math.max(prev.largestResultTokens, tokens);
        if (hasError(result.content, result.isError)) prev.errorCount += 1;
        const target = call ? targetSignature(call) : { label: "unknown", parsed: false };
        const targetPrev = prev.targets.get(target.label) ?? { calls: 0, tokens: 0 };
        targetPrev.tokens += tokens;
        prev.targets.set(target.label, targetPrev);
        acc.set(tool, prev);
      }
    }
  }

  return [...acc.values()]
    .map((item) => {
      const repeatedCalls = [...item.targets.values()].reduce(
        (sum, target) => sum + Math.max(0, target.calls - 1),
        0,
      );
      const topTargets = [...item.targets.entries()]
        .sort((a, b) => b[1].calls - a[1].calls || b[1].tokens - a[1].tokens)
        .slice(0, 3)
        .map(([label, target]) => ({
          label,
          calls: target.calls,
          tokenShare: item.totalTokens > 0 ? target.tokens / item.totalTokens : 0,
        }));
      return {
        tool: item.tool,
        calls: item.calls,
        totalTokens: item.totalTokens,
        avgOutputTokens: item.calls > 0 ? Math.round(item.totalTokens / item.calls) : 0,
        costUsd: round(item.costUsd),
        errorCount: item.errorCount,
        errorRate: item.calls > 0 ? item.errorCount / item.calls : 0,
        repeatRate: item.calls > 0 ? repeatedCalls / item.calls : 0,
        largestResultTokens: item.largestResultTokens,
        topTargets,
        confidence: item.calls > 0 ? item.parsedTargets / item.calls : 0,
        estimated: true,
      } satisfies ToolBehavior;
    })
    .sort(
      (a, b) =>
        b.costUsd - a.costUsd || b.totalTokens - a.totalTokens || a.tool.localeCompare(b.tool),
    );
}

/** @spec SPEC-AG-007, R2 — loaded vs used tool inventory */
export function buildToolInventory(agent: AgentIdentity, session: Session) {
  const profile = getProfile(agent.agent);
  if (!profile || profile.builtinTools.length === 0) return undefined;
  const used = new Set(
    session.turns.flatMap((turn) =>
      turn.messages.flatMap((message) => message.toolCalls.map((call) => call.name)),
    ),
  );
  const loaded = profile.builtinTools.length;
  const usedKnown = profile.builtinTools.filter((tool) => used.has(tool.name)).length;
  return { loaded, used: usedKnown, idle: Math.max(0, loaded - usedKnown), estimated: true };
}

export function repeatedTargetSavings(tokens: number) {
  return savingsFromTokens(tokens, 3, 0.4);
}

export { hasError as toolResultLooksLikeError };
