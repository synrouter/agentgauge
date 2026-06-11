import { describe, expect, it } from "vitest";
import { identify } from "../../src/identify/index.js";
import { AGENT_PROFILES, getProfile } from "../../src/identify/profiles.js";
import { parseClaudeSessionFile } from "../../src/parsers/claude-code.js";
import { fixture } from "../helpers.js";

describe("identify", () => {
  it("matches Claude Code by source path", async () => {
    const session = await parseClaudeSessionFile(fixture("clean-session.jsonl"));
    const result = identify({ ...session, sourcePath: "/x/.claude/projects/p/s.jsonl" });
    expect(result.agent).toBe("claude-code");
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("falls back to tool signature", async () => {
    const session = await parseClaudeSessionFile(fixture("noisy-sidechain.jsonl"));
    const result = identify({ ...session, sourcePath: "/tmp/not-claude/s.jsonl" });
    expect(result.agent).toBe("claude-code");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("exposes 16 profiles and builtin tool data", () => {
    expect(AGENT_PROFILES).toHaveLength(16);
    expect(getProfile("claude-code")?.builtinTools.length).toBeGreaterThan(5);
  });
});
