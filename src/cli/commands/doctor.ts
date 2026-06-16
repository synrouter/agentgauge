import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import { loadPricingTable } from "../../attribution/pricing.js";
import { EXIT } from "../../lib/exit.js";
import { discoverClaudeSessionFiles } from "../../lib/glob.js";

export const doctorCommand = defineCommand({
  meta: { name: "doctor", description: "Diagnose local agentgauge setup" },
  async run() {
    const root = process.env.AGENTGAUGE_CLAUDE_PROJECTS ?? join(homedir(), ".claude", "projects");
    const files = await discoverClaudeSessionFiles({ all: true });
    const pricing = loadPricingTable();
    process.stdout.write(
      `Node: ${process.versions.node} (${Number(process.versions.node.split(".")[0]) >= 18 ? "ok" : "unsupported"})\n`,
    );
    process.stdout.write(`Claude data: ${root} (${existsSync(root) ? "exists" : "missing"})\n`);
    process.stdout.write(`Sessions: ${files.length}\n`);
    process.stdout.write(`Pricing: ${pricing.version}\n`);
    process.stdout.write(
      `TTY: stdout=${Boolean(process.stdout.isTTY)} NO_COLOR=${Boolean(process.env.NO_COLOR)}\n`,
    );
    if (files.length === 0) {
      process.stdout.write(
        "\nNo data found. Open Claude Code once, or set AGENTGAUGE_CLAUDE_PROJECTS=/path/to/projects and rerun.\n",
      );
      process.exitCode = EXIT.NO_DATA;
    }
  },
});
