export interface BuiltinTool {
  name: string;
  schemaTokens: number;
}

export interface AgentProfile {
  agent: string;
  sourceGlobs: string[];
  toolSignature: string[];
  builtinTools: BuiltinTool[];
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

const placeholders = [
  "codex",
  "cursor",
  "windsurf",
  "cline",
  "aider",
  "opencode",
  "continue",
  "roo-code",
  "github-copilot",
  "gemini-cli",
  "qwen-code",
  "amp",
  "zed",
  "replit-agent",
  "sourcegraph-cody",
];

export const AGENT_PROFILES: AgentProfile[] = [
  {
    agent: "claude-code",
    sourceGlobs: ["**/.claude/projects/**/*.jsonl", "**/claude/projects/**/*.jsonl"],
    toolSignature: claudeTools.map((tool) => tool.name),
    builtinTools: claudeTools,
    quirks: "Claude Code logs assistant usage snapshots and can emit sidechain Task turns.",
  },
  ...placeholders.map((agent) => ({
    agent,
    sourceGlobs: [],
    toolSignature: [],
    builtinTools: [],
    quirks: "Placeholder profile reserved for v0.2 multi-agent support.",
  })),
];

export function getProfile(agent: string): AgentProfile | undefined {
  return AGENT_PROFILES.find((profile) => profile.agent === agent);
}
