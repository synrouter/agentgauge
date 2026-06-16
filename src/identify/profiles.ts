export interface BuiltinTool {
  name: string;
  schemaTokens: number;
}

export interface AgentProfile {
  agent: string;
  sourceGlobs: string[];
  toolSignature: string[];
  builtinTools: BuiltinTool[];
  /**
   * Fallback ratio of residual input tokens attributed to system_prompt (vs tool_definitions).
   * Only used when measured `systemPromptTokens` / `toolSchemaTokens` are unavailable.
   */
  residualSystemRatio: number;
  /** Measured system prompt tokens (optional, from public prompt dumps). Treated as fixed. */
  systemPromptTokens?: number;
  /** Measured tool schema tokens (optional, from public tool dumps). Treated as elastic. */
  toolSchemaTokens?: number;
  quirks: string;
}

const claudeTools: BuiltinTool[] = [
  { name: "Task", schemaTokens: 1100 },
  { name: "Bash", schemaTokens: 850 },
  { name: "Glob", schemaTokens: 360 },
  { name: "Grep", schemaTokens: 420 },
  { name: "Read", schemaTokens: 500 },
  { name: "Edit", schemaTokens: 640 },
  { name: "MultiEdit", schemaTokens: 780 },
  { name: "Write", schemaTokens: 520 },
  { name: "TodoWrite", schemaTokens: 430 },
  { name: "WebFetch", schemaTokens: 540 },
  { name: "WebSearch", schemaTokens: 420 },
];

// Measured from https://github.com/system-prompts-and-models-of-ai-tools
// (js-tiktoken gpt-4 cl100k_base). Prompt: Anthropic/Claude for Chrome/Prompt.txt
// Tools: Anthropic/Claude for Chrome/Tools.json
const claudeSystemPromptTokens = 8709;
const claudeToolSchemaTokens = 5264;
const claudeResidualSystemRatio =
  claudeSystemPromptTokens / (claudeSystemPromptTokens + claudeToolSchemaTokens);

export const AGENT_PROFILES: AgentProfile[] = [
  {
    agent: "claude-code",
    sourceGlobs: ["**/.claude/projects/**/*.jsonl", "**/claude/projects/**/*.jsonl"],
    toolSignature: claudeTools.map((tool) => tool.name),
    builtinTools: claudeTools,
    residualSystemRatio: claudeResidualSystemRatio,
    systemPromptTokens: claudeSystemPromptTokens,
    toolSchemaTokens: claudeToolSchemaTokens,
    quirks: "Claude Code logs assistant usage snapshots and can emit sidechain Task turns.",
  },
  {
    agent: "codex",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.5,
    systemPromptTokens: 5082,
    toolSchemaTokens: 5000,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  {
    agent: "cursor",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.65,
    systemPromptTokens: 8817,
    toolSchemaTokens: 4795,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  {
    agent: "windsurf",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.26,
    systemPromptTokens: 2515,
    toolSchemaTokens: 7260,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  {
    agent: "cline",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.67,
    systemPromptTokens: 9961,
    toolSchemaTokens: 5000,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  {
    agent: "gemini-cli",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.45,
    systemPromptTokens: 4021,
    toolSchemaTokens: 5000,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  {
    agent: "roo-code",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.65,
    systemPromptTokens: 9272,
    toolSchemaTokens: 5000,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  {
    agent: "amp",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.72,
    systemPromptTokens: 13107,
    toolSchemaTokens: 5000,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  {
    agent: "replit-agent",
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.23,
    systemPromptTokens: 1670,
    toolSchemaTokens: 5517,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  },
  ...[
    "aider",
    "opencode",
    "continue",
    "github-copilot",
    "qwen-code",
    "zed",
    "sourcegraph-cody",
  ].map((agent) => ({
    agent,
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    residualSystemRatio: 0.35,
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  })),
];

export function getProfile(agent: string): AgentProfile | undefined {
  return AGENT_PROFILES.find((profile) => profile.agent === agent);
}

/**
 * Compute the system-prompt share of the residual (stable prefix).
 * Uses the measured fixed system prompt vs elastic tool schema size when available;
 * falls back to `residualSystemRatio` for placeholder profiles without measurements.
 */
export function computeSystemRatio(profile: AgentProfile | undefined): number {
  const systemTokens = profile?.systemPromptTokens ?? 0;
  const toolTokens = profile?.toolSchemaTokens ?? 0;
  if (systemTokens > 0 && toolTokens > 0) {
    return systemTokens / (systemTokens + toolTokens);
  }
  return profile?.residualSystemRatio ?? 0.35;
}
