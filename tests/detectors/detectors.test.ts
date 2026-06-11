import { describe, expect, it } from "vitest";
import { computeCost } from "../../src/attribution/cost.js";
import { bundledPricingTable } from "../../src/attribution/pricing.js";
import { attributeSession } from "../../src/attribution/tokenize.js";
import { d0Noise, estimateNoise } from "../../src/detectors/d0-noise.js";
import { d1ToolBloat } from "../../src/detectors/d1-tool-bloat.js";
import { d2CacheBreak } from "../../src/detectors/d2-cache-break.js";
import { d3DupResults } from "../../src/detectors/d3-dup-results.js";
import { d4Oversize } from "../../src/detectors/d4-oversize.js";
import { d5Compactable } from "../../src/detectors/d5-compactable.js";
import { DETECTORS, type DetectorContext, runDetectors } from "../../src/detectors/index.js";
import { identify } from "../../src/identify/index.js";
import { parseClaudeSessionFile } from "../../src/parsers/claude-code.js";
import type { Session, Turn } from "../../src/parsers/types.js";
import { fixture } from "../helpers.js";

async function ctx(name: string): Promise<DetectorContext> {
  const session = await parseClaudeSessionFile(fixture(name));
  const agent = identify({ ...session, sourcePath: "/x/.claude/projects/p/s.jsonl" });
  const attribution = attributeSession(session, agent);
  const cost = computeCost(attribution, bundledPricingTable());
  return { session, attribution, cost, agent };
}

describe("detectors", () => {
  it("detects D0 noise and reports stages", async () => {
    const stats = estimateNoise("\u001b[32mOK\u001b[0m\n[=====>     ] 50%\nA\nA\nA\n");
    expect(stats.noisyTokens).toBeGreaterThan(0);
    expect(d0Noise(await ctx("noisy-sidechain.jsonl"))[0]?.id).toBe("D0");
  });

  it("runs registry with filtering and failure isolation", async () => {
    const context = await ctx("noisy-sidechain.jsonl");
    const original = DETECTORS.D5!;
    DETECTORS.D5 = () => {
      throw new Error("boom");
    };
    const warnings: string[] = [];
    const findings = runDetectors(context, {
      detectors: ["D0", "D5"],
      warn: (m) => warnings.push(m),
    });
    DETECTORS.D5 = original;
    expect(findings.map((finding) => finding.id)).toContain("D0");
    expect(warnings[0]).toContain("D5");
  });

  it("does not report noisy findings for clean fixture above thresholds", async () => {
    const findings = runDetectors(await ctx("clean-session.jsonl"), { skipDetectors: ["D1"] });
    expect(findings.every((finding) => finding.id !== "D0")).toBe(true);
  });

  it("covers D1 and D2 positive paths", async () => {
    const context = await ctx("noisy-sidechain.jsonl");
    context.session.turns = Array.from({ length: 80 }, (_, index) => ({
      ...context.session.turns[0]!,
      id: `t-${index}`,
    }));
    expect(d1ToolBloat(context)[0]?.id).toBe("D1");
    const cacheContext = await ctx("noisy-sidechain.jsonl");
    cacheContext.attribution.turns[0]!.usage.cacheReadInputTokens = 800;
    cacheContext.attribution.turns[0]!.usage.cacheCreationInputTokens = 50;
    cacheContext.attribution.turns[1]!.usage.cacheReadInputTokens = 20;
    cacheContext.attribution.turns[1]!.usage.cacheCreationInputTokens = 500;
    expect(d2CacheBreak(cacheContext)[0]?.id).toBe("D2");
  });

  it("covers D3, D4, and D5 positive paths", async () => {
    const duplicate = await ctx("clean-session.jsonl");
    const result = duplicate.session.turns[2]!.messages[0]!.toolResults[0]!;
    result.content = "same output\n".repeat(200);
    duplicate.session.turns[2]!.messages[0]!.toolResults = [result, result, result, result];
    expect(d3DupResults(duplicate)[0]?.id).toBe("D3");

    const oversized = await ctx("clean-session.jsonl");
    oversized.session.turns[2]!.messages[0]!.toolResults[0]!.content = "x".repeat(45_000);
    expect(d4Oversize(oversized)[0]?.id).toBe("D4");

    const baseTurn = oversized.session.turns[0]!;
    const turns: Turn[] = Array.from({ length: 6 }, (_, index) => ({
      ...baseTurn,
      id: `h-${index}`,
      messages: [
        {
          ...baseTurn.messages[0]!,
          text: index === 0 ? "ancient context ".repeat(200) : `recent ${index}`,
          isCompactBoundary: false,
        },
      ],
    }));
    const session: Session = { ...oversized.session, turns };
    expect(d5Compactable({ ...oversized, session })[0]?.id).toBe("D5");
  });
});
