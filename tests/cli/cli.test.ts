import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { list, numberArg, severity, stringOrTrue } from "../../src/cli/args.js";
import { analyzeCommand } from "../../src/cli/commands/analyze.js";
import { doctorCommand } from "../../src/cli/commands/doctor.js";
import { sessionsCommand } from "../../src/cli/commands/sessions.js";
import { selectorFromOptions } from "../../src/lib/analysis.js";
import { fixture, root } from "../helpers.js";

let tmp: string | undefined;

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [join(root, "cli.js"), ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function setupData() {
  tmp = mkdtempSync(join(tmpdir(), "agentgauge-"));
  const project = join(tmp, "project");
  mkdirSync(project);
  copyFileSync(fixture("noisy-sidechain.jsonl"), join(project, "session.jsonl"));
  return tmp;
}

afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

describe("cli", () => {
  it("prints json and html from analyze", () => {
    const data = setupData();
    const html = join(data, "report.html");
    const result = run(["analyze", "--last", "--json", "--html", html], {
      AGENTGAUGE_CLAUDE_PROJECTS: data,
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).schema_version).toBe(1);
    expect(result.stderr).toContain("Wrote");
  });

  it("doctor exits 3 with advice when no data exists", () => {
    const data = mkdtempSync(join(tmpdir(), "agentgauge-empty-"));
    tmp = data;
    const result = run(["doctor"], { AGENTGAUGE_CLAUDE_PROJECTS: data });
    expect(result.status).toBe(3);
    expect(result.stdout).toContain("No data found");
  });

  it("lists sessions and validates arg helpers", () => {
    const data = setupData();
    const result = run(["sessions", "--json"], { AGENTGAUGE_CLAUDE_PROJECTS: data });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)[0].sessionId).toBe("session");
    expect(list("D0,d1")).toEqual(["D0", "D1"]);
    expect(severity("high")).toBe("high");
    expect(numberArg("2")).toBe(2);
    expect(stringOrTrue(undefined)).toBe(true);
    expect(selectorFromOptions({ last: "24h" }).since).toBeInstanceOf(Date);
  });

  it("covers command run functions directly", async () => {
    const data = setupData();
    const oldEnv = process.env.AGENTGAUGE_CLAUDE_PROJECTS;
    const oldStdout = process.stdout.write;
    const oldStderr = process.stderr.write;
    const stdout: string[] = [];
    const stderr: string[] = [];
    process.env.AGENTGAUGE_CLAUDE_PROJECTS = data;
    process.stdout.write = ((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      await sessionsCommand.run?.({
        args: { json: true },
        rawArgs: [],
        cmd: sessionsCommand,
      } as never);
      await doctorCommand.run?.({ args: {}, rawArgs: [], cmd: doctorCommand } as never);
      await analyzeCommand.run?.({
        args: { last: true, quiet: true, topN: "1" },
        rawArgs: [],
        cmd: analyzeCommand,
      } as never);
    } finally {
      process.stdout.write = oldStdout;
      process.stderr.write = oldStderr;
      process.env.AGENTGAUGE_CLAUDE_PROJECTS = oldEnv;
      process.exitCode = 0;
    }
    expect(stdout.join("")).toContain("agentgauge");
    expect(stderr.join("")).not.toContain("Detector");
  });
});
