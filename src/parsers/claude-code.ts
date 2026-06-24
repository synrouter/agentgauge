import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { isWithin } from "../lib/time.js";
import {
  type Message,
  type Session,
  type SessionSelector,
  type ToolCall,
  type ToolResult,
  type Turn,
  type Usage,
  buildToolIndex,
  emptyUsage,
} from "./types.js";

interface ParseResult {
  records: unknown[];
  parseErrors: number;
}

function unwrap(raw: unknown): unknown {
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    raw.data &&
    typeof raw.data === "object" &&
    "message" in raw.data
  ) {
    return raw.data.message;
  }
  return raw;
}

/** @spec SPEC-AG-001, R2 — tolerant streaming JSONL parser */
export async function parseJsonl(path: string): Promise<ParseResult> {
  const records: unknown[] = [];
  let parseErrors = 0;
  try {
    const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }) });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(unwrap(JSON.parse(trimmed)));
      } catch {
        parseErrors += 1;
      }
    }
  } catch {
    parseErrors += 1;
  }
  return { records, parseErrors };
}

function usageFrom(raw: any): Usage {
  const usage = raw?.message?.usage ?? {};
  return {
    inputTokens: Number(usage.input_tokens ?? usage.inputTokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? usage.outputTokens ?? 0),
    cacheReadInputTokens: Number(usage.cache_read_input_tokens ?? usage.cacheReadInputTokens ?? 0),
    cacheCreationInputTokens: Number(
      usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens ?? 0,
    ),
  };
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      // tool_result content is tracked separately in toolResults; counting it
      // here too would double-attribute the same tokens (SPEC-AG-002, R1).
      if ((block as { type?: unknown }).type === "tool_result") return "";
      if ("text" in block && typeof block.text === "string") return block.text;
      if ("content" in block && typeof block.content === "string") return block.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function callsFromContent(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (!block || typeof block !== "object" || (block as any).type !== "tool_use") return [];
    return [
      {
        id: String((block as any).id ?? ""),
        name: String((block as any).name ?? ""),
        input: (block as any).input ?? {},
      },
    ];
  });
}

function resultsFromContent(content: unknown): ToolResult[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (!block || typeof block !== "object" || (block as any).type !== "tool_result") return [];
    const value = (block as any).content;
    return [
      {
        toolUseId: String((block as any).tool_use_id ?? ""),
        content: typeof value === "string" ? value : JSON.stringify(value ?? ""),
        isError: Boolean((block as any).is_error) || undefined,
      },
    ];
  });
}

function isInjected(raw: any, text: string): boolean {
  const lower = `${raw?.type ?? ""} ${text}`.toLowerCase();
  return /continuation|resume|interrupted|stop_hook|compact summary/.test(lower);
}

function toMessage(raw: any): Message | undefined {
  const role = raw?.message?.role ?? raw?.type;
  if (role !== "user" && role !== "assistant" && role !== "system") return undefined;
  const content = raw?.message?.content ?? "";
  const text = textFromContent(content);
  return {
    id: String(raw?.message?.id ?? raw?.uuid ?? `${role}-${raw?.timestamp ?? ""}`),
    role,
    text,
    toolCalls: callsFromContent(content).filter((call) => call.id && call.name),
    toolResults: resultsFromContent(content).filter((result) => result.toolUseId),
    usage: role === "assistant" ? usageFrom(raw) : emptyUsage(),
    model: raw?.message?.model,
    costUSD: typeof raw?.costUSD === "number" ? raw.costUSD : undefined,
    isCompactBoundary: Boolean(raw?.isCompactSummary) || /compact summary/i.test(text),
    isSystemInjected: isInjected(raw, text),
  };
}

function betterTurn(existing: Turn, candidate: Turn): Turn {
  const existingUsage = existing.messages.reduce(
    (sum, m) => sum + m.usage.inputTokens + m.usage.outputTokens,
    0,
  );
  const candidateUsage = candidate.messages.reduce(
    (sum, m) => sum + m.usage.inputTokens + m.usage.outputTokens,
    0,
  );
  if (existing.isSidechain !== candidate.isSidechain)
    return existing.isSidechain ? candidate : existing;
  return candidateUsage >= existingUsage ? candidate : existing;
}

/** @spec SPEC-AG-001, R3/R4/R5 — normalize, dedupe, merge, filter */
export function normalizeClaudeSession(
  records: unknown[],
  sourcePath: string,
  parseErrors = 0,
  selector: SessionSelector = {},
): Session {
  const byKey = new Map<string, Turn>();
  for (const rawRecord of records) {
    const raw: any = rawRecord;
    if (!raw || typeof raw !== "object") continue;
    if (!isWithin(raw.timestamp, selector.since, selector.until)) continue;
    const message = toMessage(raw);
    if (!message) continue;
    if (selector.model && message.model && !message.model.includes(selector.model)) continue;
    const messageId = message.id;
    const requestId = String(raw.requestId ?? "");
    const key =
      messageId && requestId
        ? `${messageId}:${requestId}`
        : messageId || String(raw.uuid ?? Math.random());
    const turn: Turn = {
      id: String(raw.uuid ?? message.id),
      parentId: raw.parentUuid ? String(raw.parentUuid) : undefined,
      timestamp: raw.timestamp,
      cwd: raw.cwd,
      requestId: requestId || undefined,
      isSidechain: Boolean(raw.isSidechain),
      messages: [message],
      raw,
    };
    const existing = byKey.get(key) ?? (messageId ? byKey.get(messageId) : undefined);
    byKey.set(key, existing ? betterTurn(existing, turn) : turn);
    if (messageId) byKey.set(messageId, byKey.get(key)!);
  }
  const uniqueTurns = [...new Set(byKey.values())].sort((a, b) =>
    (a.timestamp ?? "").localeCompare(b.timestamp ?? ""),
  );
  const allMessages = uniqueTurns.flatMap((turn) => turn.messages);
  const toolIndex = buildToolIndex(allMessages);
  for (const message of allMessages) {
    for (const result of message.toolResults) {
      result.toolName = toolIndex.get(result.toolUseId)?.name;
    }
  }
  const userMessages = allMessages.filter(
    (message) => message.role === "user" && !message.isSystemInjected,
  );
  return {
    id: basename(sourcePath, ".jsonl"),
    sourcePath,
    projectName: sourcePath.split(/[\\/]/).at(-2) ?? "unknown",
    turns: uniqueTurns,
    parseErrors,
    isUsageProbe: userMessages.length === 1 && userMessages[0]?.text.trim() === "/usage",
  };
}

export async function parseClaudeSessionFile(
  path: string,
  selector: SessionSelector = {},
): Promise<Session> {
  const parsed = await parseJsonl(path);
  return normalizeClaudeSession(parsed.records, path, parsed.parseErrors, selector);
}
