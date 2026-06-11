import { describe, expect, it } from "vitest";
import {
  normalizeClaudeSession,
  parseClaudeSessionFile,
  parseJsonl,
} from "../../src/parsers/claude-code.js";
import { buildToolIndex } from "../../src/parsers/types.js";
import { fixture } from "../helpers.js";

describe("claude-code parser", () => {
  it("parses normal fixtures and links tool results", async () => {
    const session = await parseClaudeSessionFile(fixture("clean-session.jsonl"));
    expect(session.turns).toHaveLength(4);
    const result = session.turns.flatMap((t) => t.messages).flatMap((m) => m.toolResults)[0];
    expect(result?.toolName).toBe("Read");
    expect(session.parseErrors).toBe(0);
  });

  it("skips broken lines without crashing and detects usage probes", async () => {
    const session = await parseClaudeSessionFile(fixture("broken-session.jsonl"));
    expect(session.parseErrors).toBeGreaterThan(0);
    expect(session.isUsageProbe).toBe(true);
  });

  it("deduplicates streaming chunks and unwraps AgentProgress", async () => {
    const session = await parseClaudeSessionFile(fixture("duplicate-chunks.jsonl"));
    const calls = session.turns.flatMap((t) => t.messages).flatMap((m) => m.toolCalls);
    expect(calls.map((call) => call.id)).toContain("toolu_2");
    expect(session.turns.some((turn) => turn.id === "a-progress")).toBe(true);
    expect(session.turns.filter((turn) => turn.messages[0]?.id === "msg-dup")).toHaveLength(1);
  });

  it("filters by timestamp and builds indexes", async () => {
    const parsed = await parseJsonl(fixture("clean-session.jsonl"));
    const session = normalizeClaudeSession(
      parsed.records,
      fixture("clean-session.jsonl"),
      parsed.parseErrors,
      {
        since: new Date("2026-06-10T10:00:06.000Z"),
      },
    );
    expect(
      session.turns.every(
        (turn) => !turn.timestamp || turn.timestamp >= "2026-06-10T10:00:06.000Z",
      ),
    ).toBe(true);
    const index = buildToolIndex(session.turns.flatMap((turn) => turn.messages));
    expect(index.size).toBe(0);
  });
});
