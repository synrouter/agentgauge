import { readFileSync } from "node:fs";
import { encodingForModel } from "js-tiktoken";

const root = "/Users/luoshi/Documents/AI/github/system-prompts-and-models-of-ai-tools";

const mappings: Record<string, [string, string | null]> = {
  "claude-code": [
    "Anthropic/Claude for Chrome/Prompt.txt",
    "Anthropic/Claude for Chrome/Tools.json",
  ],
  codex: ["Open Source prompts/Codex CLI/openai-codex-cli-system-prompt-20250820.txt", null],
  cursor: ["Cursor Prompts/Agent Prompt 2.0.txt", "Cursor Prompts/Agent Tools v1.0.json"],
  windsurf: ["Windsurf/Prompt Wave 11.txt", "Windsurf/Tools Wave 11.txt"],
  cline: ["Open Source prompts/Cline/Prompt.txt", null],
  "gemini-cli": ["Open Source prompts/Gemini CLI/google-gemini-cli-system-prompt.txt", null],
  "roo-code": ["Open Source prompts/RooCode/Prompt.txt", null],
  amp: ["Amp/claude-4-sonnet.yaml", null],
  "replit-agent": ["Replit/Prompt.txt", "Replit/Tools.json"],
};

const enc = encodingForModel("gpt-4");
function countTokens(path: string): number {
  return enc.encode(readFileSync(`${root}/${path}`, "utf8")).length;
}

for (const [agent, [promptPath, toolPath]] of Object.entries(mappings)) {
  const promptTokens = countTokens(promptPath);
  const toolTokens = toolPath ? countTokens(toolPath) : 0;
  const ratio = promptTokens / (promptTokens + (toolTokens || 5000));
  console.log(
    `${agent.padEnd(15)} prompt=${String(promptTokens).padStart(6)}  tools=${String(toolTokens).padStart(6)}  ratio=${ratio.toFixed(3)}`,
  );
}
