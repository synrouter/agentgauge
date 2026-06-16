import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import { LITELLM_PRICING_URL, buildPricingTableFromLiteLLM } from "../../attribution/litellm.js";
import { loadPricingTable } from "../../attribution/pricing.js";
import { EXIT } from "../../lib/exit.js";

export const updatePricingCommand = defineCommand({
  meta: { name: "update-pricing", description: "Update local pricing table" },
  args: {
    url: { type: "string", required: false },
    dryRun: { type: "boolean", required: false },
    force: { type: "boolean", required: false },
  },
  async run({ args }) {
    const url = args.url ?? process.env.AGENTGAUGE_PRICING_URL ?? LITELLM_PRICING_URL;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch pricing: ${response.status}`);
      process.exitCode = EXIT.CONFIG;
      return;
    }
    const rawText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("Remote LiteLLM pricing payload is not valid JSON.");
      process.exitCode = EXIT.CONFIG;
      return;
    }
    const table = buildPricingTableFromLiteLLM(parsed, rawText);
    if (!table) {
      console.error("Remote LiteLLM pricing JSON failed schema validation.");
      process.exitCode = EXIT.CONFIG;
      return;
    }
    if (args.dryRun) {
      process.stdout.write(`${JSON.stringify(table, null, 2)}\n`);
      return;
    }
    if (!args.force && loadPricingTable().version === table.version) {
      process.stdout.write(
        `Pricing already at version ${table.version}; use --force to overwrite.\n`,
      );
      return;
    }
    const path = join(homedir(), ".agentgauge", "pricing.json");
    mkdirSync(join(homedir(), ".agentgauge"), { recursive: true });
    writeFileSync(path, `${JSON.stringify(table, null, 2)}\n`);
    process.stdout.write(`Wrote ${path}\n`);
  },
});
