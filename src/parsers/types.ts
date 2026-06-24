export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  toolUseId: string;
  toolName?: string;
  content: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  usage: Usage;
  model?: string;
  costUSD?: number;
  isCompactBoundary: boolean;
  isSystemInjected: boolean;
}

export interface Turn {
  id: string;
  parentId?: string;
  timestamp?: string;
  cwd?: string;
  requestId?: string;
  isSidechain: boolean;
  messages: Message[];
  raw?: unknown;
}

export interface Session {
  id: string;
  sourcePath: string;
  projectName: string;
  turns: Turn[];
  parseErrors: number;
  isUsageProbe: boolean;
}

export interface SessionFile {
  path: string;
  projectName: string;
  sessionId: string;
  mtimeMs: number;
}

export interface SessionSelector {
  all?: boolean;
  last?: true | string;
  since?: Date;
  until?: Date;
  project?: string;
  session?: string;
  agent?: string;
  model?: string;
}

export const emptyUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
});

/** @spec SPEC-AG-001, R3 — dual-format tool_use_id index */
export function buildToolIndex(messages: Message[]): Map<string, ToolCall> {
  const index = new Map<string, ToolCall>();
  for (const message of messages) {
    for (const call of message.toolCalls) {
      index.set(call.id, call);
    }
  }
  return index;
}

export function sumUsage(values: Usage[]): Usage {
  return values.reduce(
    (acc, usage) => ({
      inputTokens: acc.inputTokens + usage.inputTokens,
      outputTokens: acc.outputTokens + usage.outputTokens,
      cacheReadInputTokens: acc.cacheReadInputTokens + usage.cacheReadInputTokens,
      cacheCreationInputTokens: acc.cacheCreationInputTokens + usage.cacheCreationInputTokens,
    }),
    emptyUsage(),
  );
}

export function totalInput(usage: Usage): number {
  return usage.inputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens;
}
