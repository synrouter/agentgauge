import { describe, expect, it } from "vitest";
import { renderHtml } from "../../src/render/html.js";
import { renderJson, reportSchema } from "../../src/render/json.js";
import { redactContent, redactPath } from "../../src/render/model.js";
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
});
