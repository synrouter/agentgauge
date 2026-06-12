import { describe, expect, it } from "vitest";
import { renderHtml } from "../../src/render/html.js";
import { renderJson, reportSchema } from "../../src/render/json.js";
import { buildReportModel, redactContent, redactPath } from "../../src/render/model.js";
import { renderTerminal } from "../../src/render/terminal.js";
import { sampleReport } from "../helpers.js";

describe("renderers", () => {
  it("renders terminal, html, and json reports", async () => {
    const { report } = await sampleReport();
    const terminal = renderTerminal(report, { topN: 3 });
    expect(terminal).toContain("agentgauge");
    expect(terminal).toContain("Breakdown");
    const html = renderHtml(report);
    expect(Buffer.byteLength(html)).toBeLessThan(80_000);
    expect(html).toContain("synrouter.ai/connect");
    const json = renderJson(report);
    expect(reportSchema.parse(JSON.parse(json)).schema_version).toBe(1);
  });

  it("supports quiet and redaction helpers", async () => {
    const { report } = await sampleReport("clean-session.jsonl");
    expect(renderTerminal(report, { quiet: true })).not.toContain("Breakdown");
    expect(redactPath("/Users/example/secret/project/file.ts")).toBe("file.ts");
    expect(redactContent("x".repeat(200))).toContain("[200 chars]");
  });

  it("redacts absolute paths on every platform in built reports", async () => {
    const { session, identity, attribution, cost } = await sampleReport();
    const findings = [
      {
        id: "D0" as const,
        severity: "med" as const,
        title: "test",
        evidence: [
          "read /Users/alice/repo/secret.ts and /home/bob/repo/key.pem and /mnt/c/Users/eve/x.txt",
        ],
        savings: { conservative_usd: 0, theoretical_usd: 0 },
        fix_path: "n/a",
      },
    ];
    const report = buildReportModel(
      { version: "0.1.0", sessions: [session], identity, attribution, cost, findings },
      { includeContent: true },
    );
    const evidence = report.findings[0]?.evidence[0] ?? "";
    expect(evidence).not.toContain("/Users/");
    expect(evidence).not.toContain("/home/");
    expect(evidence).not.toContain("/mnt/");
    expect(evidence).toContain("secret.ts");
    const html = renderHtml(report);
    expect(html).not.toContain("/home/bob");
    expect(html).not.toContain("/Users/alice");
  });

  it("locks terminal and html output with golden snapshots", async () => {
    const { report } = await sampleReport();
    const frozen = { ...report, generated_at: "2026-01-01T00:00:00.000Z", version: "0.0.0" };
    expect(renderTerminal(frozen, { topN: 5 })).toMatchSnapshot("terminal");
    expect(renderHtml(frozen)).toMatchSnapshot("html");
  });
});
