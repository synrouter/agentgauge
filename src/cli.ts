#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { analyzeCommand } from "./cli/commands/analyze.js";
import { doctorCommand } from "./cli/commands/doctor.js";
import { sessionsCommand } from "./cli/commands/sessions.js";
import { updatePricingCommand } from "./cli/commands/update-pricing.js";
import { packageVersion } from "./lib/analysis.js";

const main = defineCommand({
  meta: {
    name: "agentgauge",
    version: packageVersion(),
    description: "See where AI coding agents spend tokens",
  },
  subCommands: {
    analyze: analyzeCommand,
    sessions: sessionsCommand,
    doctor: doctorCommand,
    "update-pricing": updatePricingCommand,
  },
});

if (process.argv.slice(2).length === 0) {
  process.argv.push("analyze", "--last");
}

runMain(main);
