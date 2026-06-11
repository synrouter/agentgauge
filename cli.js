#!/usr/bin/env node
const { existsSync, readdirSync } = require("fs");
const { join } = require("path");
const dir = join(process.env.HOME || "", ".claude", "projects");
console.log("agentgauge v0.0.1 — early preview\n");
if (existsSync(dir)) {
  const projects = readdirSync(dir);
  console.log(`✓ Found Claude Code data: ${projects.length} project(s)`);
  console.log("\nFull analysis coming in v0.1 — star/watch:");
} else {
  console.log("✗ No Claude Code session data found (~/.claude/projects)");
}
console.log("https://github.com/synrouter/agentgauge");
