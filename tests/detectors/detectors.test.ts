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
import { d6ToolFailures } from "../../src/detectors/d6-tool-failures.js";
import { d7ModelMismatch } from "../../src/detectors/d7-model-mismatch.js";
import { d8ReadChurn } from "../../src/detectors/d8-read-churn.js";
import { d9ContextGrowth } from "../../src/detectors/d9-context-growth.js";
import { DETECTORS, type DetectorContext, runDetectors } from "../../src/detectors/index.js";
import { identify } from "../../src/identify/index.js";
import { buildBehaviorInsights } from "../../src/insights/index.js";
import { parseClaudeSessionFile } from "../../src/parsers/claude-code.js";
import type { Session, Turn } from "../../src/parsers/types.js";
import { fixture } from "../helpers.js";

async function ctx(name: string): Promise<DetectorContext> {
  const session = await parseClaudeSessionFile(fixture(name));
  const agent = identify({ ...session, sourcePath: "/x/.claude/projects/p/s.jsonl" });
  const attribution = attributeSession(session, agent);
  const cost = computeCost(attribution, bundledPricingTable());
  const insights = buildBehaviorInsights({ session, attribution, agent });
  return { session, attribution, cost, agent, insights };
}

describe("detectors", () => {
  it("detects D0 noise and reports stages", async () => {
    const stats = estimateNoise("\u001b[32mOK\u001b[0m\n[=====>     ] 50%\nA\nA\nA\n");
    expect(stats.noisyTokens).toBeGreaterThan(0);
    expect(d0Noise(await ctx("noisy-sidechain.jsonl"))[0]?.id).toBe("D0");
  });

  it("counts cursor-control ANSI and keeps stage sums within total", () => {
    // [1A (cursor up) and [2K (erase line) are how build tools redraw progress.
    const cursor = estimateNoise("[1A[2Kcompiling 50%\n[1A[2Kcompiling 99%\n");
    expect(cursor.stages.ansi).toBeGreaterThan(0);
    // Per-line ceil rounding lets the raw stage sum slightly exceed the whole-string
    // estimate, but the reported noisyTokens must stay capped at the total.
    const stats = estimateNoise("[32m[===>] 10%[0m\n".repeat(5));
    expect(stats.noisyTokens).toBeLessThanOrEqual(stats.totalTokens);
    expect(stats.stages.progress).toBeGreaterThan(0);
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

    // D4 must report every oversized result, not just the first (PRD FR-AG-4).
    const multi = await ctx("clean-session.jsonl");
    const base = multi.session.turns[2]!.messages[0]!.toolResults[0]!;
    multi.session.turns[2]!.messages[0]!.toolResults = [
      { ...base, content: "a".repeat(45_000) },
      { ...base, content: "b".repeat(45_000) },
    ];
    expect(d4Oversize(multi)).toHaveLength(2);

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

  it("covers D6-D9 behavior detector positive paths", async () => {
    const failure = await ctx("clean-session.jsonl");
    failure.insights = {
      ...failure.insights!,
      toolBehavior: [
        {
          tool: "Bash",
          calls: 3,
          totalTokens: 900,
          avgOutputTokens: 300,
          costUsd: 0.01,
          errorCount: 2,
          errorRate: 0.67,
          repeatRate: 0,
          largestResultTokens: 400,
          topTargets: [{ label: "bash:pnpm", calls: 3, tokenShare: 1 }],
          confidence: 1,
          estimated: true,
        },
      ],
    };
    expect(d6ToolFailures(failure)[0]?.id).toBe("D6");

    const model = await ctx("clean-session.jsonl");
    model.attribution.turns[0]!.model = "claude-opus-4-1";
    model.insights = {
      ...model.insights!,
      turnEfficiency: [
        {
          turnIndex: 1,
          turnId: model.attribution.turns[0]!.turnId,
          inputTokens: 1500,
          outputTokens: 50,
          costUsd: 0.03,
          inputOutputRatio: 30,
          toolCallCount: 1,
          contextTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          flags: ["simple"],
        },
      ],
    };
    expect(d7ModelMismatch(model)[0]?.id).toBe("D7");

    const churn = await ctx("clean-session.jsonl");
    churn.insights = {
      ...churn.insights!,
      toolBehavior: [
        {
          tool: "Read",
          calls: 4,
          totalTokens: 1200,
          avgOutputTokens: 300,
          costUsd: 0.01,
          errorCount: 0,
          errorRate: 0,
          repeatRate: 0.75,
          largestResultTokens: 300,
          topTargets: [{ label: "index.ts#abcd", calls: 4, tokenShare: 1 }],
          confidence: 1,
          estimated: true,
        },
      ],
    };
    expect(d8ReadChurn(churn)[0]?.id).toBe("D8");

    const growth = await ctx("clean-session.jsonl");
    growth.insights = {
      ...growth.insights!,
      turnEfficiency: [100, 140, 210, 260].map((contextTokens, index) => ({
        turnIndex: index + 1,
        turnId: `g-${index}`,
        inputTokens: 1000,
        outputTokens: 80,
        costUsd: 0,
        inputOutputRatio: 12,
        toolCallCount: 0,
        contextTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        flags: ["simple"],
      })),
    };
    expect(d9ContextGrowth(growth)[0]?.id).toBe("D9");
  });
});
