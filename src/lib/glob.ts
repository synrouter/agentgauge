import { homedir } from "node:os";
import { basename, join } from "node:path";
import fg from "fast-glob";
import type { SessionFile, SessionSelector } from "../parsers/types.js";

function roots(): string[] {
  const override = process.env.AGENTGAUGE_CLAUDE_PROJECTS;
  if (override)
    return override
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  return [join(homedir(), ".claude", "projects")];
}

/** @spec SPEC-AG-001, R1 — discover Claude Code JSONL sessions */
export async function discoverClaudeSessionFiles(
  selector: SessionSelector = {},
): Promise<SessionFile[]> {
  const files: SessionFile[] = [];
  for (const root of roots()) {
    const entries = await fg("**/*.jsonl", {
      cwd: root,
      absolute: true,
      onlyFiles: true,
      suppressErrors: true,
      stats: true,
    });
    for (const entry of entries) {
      if (typeof entry === "string") continue;
      if (!entry.stats) continue;
      const path = entry.path;
      const segments = path.split(/[\\/]/);
      const projectName = segments.at(-2) ?? "unknown";
      const sessionId = basename(path, ".jsonl");
      if (selector.project && !projectName.includes(selector.project)) continue;
      if (
        selector.session &&
        sessionId !== selector.session &&
        !sessionId.startsWith(selector.session)
      )
        continue;
      if (selector.since && entry.stats.mtime < selector.since) continue;
      files.push({ path, projectName, sessionId, mtimeMs: entry.stats.mtimeMs });
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return selector.all || typeof selector.last === "string" ? files : files.slice(0, 1);
}
