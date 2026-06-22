import { describe, expect, it } from "vitest";
import { attributeSession } from "../../src/attribution/tokenize.js";
import { identify } from "../../src/identify/index.js";
import { buildBehaviorInsights, sparkline, targetSignature } from "../../src/insights/index.js";
import { parseClaudeSessionFile } from "../../src/parsers/claude-code.js";
import { fixture } from "../helpers.js";

describe("behavior insights", () => {
  it("aggregates tool behavior and turn efficiency", async () => {
    const session = await parseClaudeSessionFile(fixture("clean-session.jsonl"));
    const agent = identify({ ...session, sourcePath: "/x/.claude/projects/p/s.jsonl" });
    const attribution = attributeSession(session, agent);
    const insights = buildBehaviorInsights({ session, attribution, agent });
    expect(insights.toolBehavior[0]?.tool).toBe("Read");
    expect(insights.toolBehavior[0]?.calls).toBe(1);
    expect(insights.toolInventory?.loaded).toBeGreaterThan(0);
    expect(insights.turnEfficiency).toHaveLength(session.turns.length);
    expect(sparkline([0, 5, 10])).toHaveLength(3);
  });

  it("builds redacted target signatures", () => {
    const target = targetSignature({
      id: "t",
      name: "Read",
      input: { file_path: "/Users/example/project/src/index.ts" },
    });
    expect(target.label).toContain("index.ts#");
    expect(target.label).not.toContain("/Users/example");
  });
});
