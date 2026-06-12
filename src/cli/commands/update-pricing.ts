import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import { loadPricingTable, pricingTableSchema } from "../../attribution/pricing.js";
import { EXIT } from "../../lib/exit.js";

export const updatePricingCommand = defineCommand({
  meta: { name: "update-pricing", description: "Update local pricing table" },
  args: {
    url: { type: "string", required: false },
    dryRun: { type: "boolean", required: false },
    force: { type: "boolean", required: false },
  },
  async run({ args }) {
    const url = args.url ?? process.env.AGENTGAUGE_PRICING_URL;
    if (!url) {
      console.error("Missing --url or AGENTGAUGE_PRICING_URL.");
      process.exitCode = EXIT.USAGE;
      return;
    }
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch pricing: ${response.status}`);
      process.exitCode = EXIT.CONFIG;
      return;
    }
    const table = pricingTableSchema.safeParse(await response.json());
    if (!table.success) {
      console.error("Remote pricing JSON failed schema validation.");
      process.exitCode = EXIT.CONFIG;
      return;
    }
    if (args.dryRun) {
      process.stdout.write(`${JSON.stringify(table.data, null, 2)}\n`);
      return;
    }
    if (!args.force && loadPricingTable().version === table.data.version) {
      process.stdout.write(
        `Pricing already at version ${table.data.version}; use --force to overwrite.\n`,
      );
      return;
    }
    const path = join(homedir(), ".agentgauge", "pricing.json");
    mkdirSync(join(homedir(), ".agentgauge"), { recursive: true });
    writeFileSync(path, `${JSON.stringify(table.data, null, 2)}\n`);
    process.stdout.write(`Wrote ${path}\n`);
  },
});
