// noise detection adapted from RTK (https://github.com/rtk-ai/rtk, MIT)
import { savingsFromTokens } from "../attribution/cost.js";
import { approximateTokens } from "../attribution/tokenize.js";
import type { DetectorContext, Finding } from "./index.js";
import { THRESHOLDS } from "./thresholds.js";

interface NoiseStats {
  totalTokens: number;
  noisyTokens: number;
  stages: Record<string, number>;
}

function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

const ESC = String.fromCharCode(27);
// CSI with any final byte (colors, cursor moves, erase) plus OSC/string sequences,
// not just SGR `...m` — build/test tools emit cursor control heavily.
const ANSI_RE = new RegExp(
  `${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^${ESC}\\x07]*(?:\\x07|${ESC}\\\\)?|${ESC}[@-Z\\\\^_]`,
  "g",
);

/** @spec SPEC-AG-003, R2 — L0 compressible noise estimator */
export function estimateNoise(content: string): NoiseStats {
  const stages: Record<string, number> = { ansi: 0, progress: 0, repeated: 0, whitespace: 0 };
  // Stages strip what they count before handing off, so each character is
  // attributed to at most one stage (DESIGN-AG-003, D4 first-come-first-served).
  const ansiMatches = content.match(ANSI_RE) ?? [];
  stages.ansi = approximateTokens(ansiMatches.join(""));
  const stripped = content.replace(ANSI_RE, "");
  const seen = new Map<string, number>();
  for (const line of lines(stripped)) {
    const normalized = line.trim();
    if (!normalized) {
      stages.whitespace = (stages.whitespace ?? 0) + approximateTokens(line);
      continue;
    }
    if (/^\[[=>\-\s#]+\]\s*\d+%?$/.test(normalized) || /spinner|progress/i.test(normalized)) {
      stages.progress = (stages.progress ?? 0) + approximateTokens(line);
      continue;
    }
    seen.set(normalized, (seen.get(normalized) ?? 0) + 1);
  }
  for (const [line, count] of seen) {
    if (count >= 3)
      stages.repeated = (stages.repeated ?? 0) + approximateTokens(line) * (count - 1);
  }
  const totalTokens = approximateTokens(content);
  const noisyTokens = Math.min(
    totalTokens,
    Object.values(stages).reduce((sum, value) => sum + value, 0),
  );
  return { totalTokens, noisyTokens, stages };
}

export function d0Noise(ctx: DetectorContext): Finding[] {
  let total = 0;
  let noisy = 0;
  for (const turn of ctx.session.turns) {
    for (const message of turn.messages) {
      for (const result of message.toolResults) {
        const stats = estimateNoise(result.content);
        total += stats.totalTokens;
        noisy += stats.noisyTokens;
      }
    }
  }
  if (total === 0 || noisy / total <= THRESHOLDS.noiseRatioMed) return [];
  return [
    {
      id: "D0",
      severity: "med",
      title: "Compressible tool output noise",
      evidence: [`${noisy}/${total} tool-result tokens look compressible`],
      savings: savingsFromTokens(noisy),
      fix_path:
        "Trim ANSI, progress bars, repeated lines, and whitespace before replaying tool output.",
      fix_url: "https://synrouter.ai/connect?source=agentgauge&detector=D0",
    },
  ];
}
