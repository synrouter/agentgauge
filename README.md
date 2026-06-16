# agentgauge

[![npm version](https://badge.fury.io/js/agentgauge.svg)](https://www.npmjs.com/package/agentgauge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

> Open-source CLI that breaks down where your AI coding agent burns tokens — per-section, per-tool, with cost & compressible-noise estimates.

`agentgauge` reads local Claude Code session logs (`~/.claude/projects/**/*.jsonl`) and shows you exactly where tokens go: system prompt, tool definitions, tool results, history, user input, assistant output, and cache read/write. It then flags waste with six detectors and estimates how much you could save.

```
agentgauge 0.1.1 — session report
COST $4.83   POTENTIAL SAVINGS $1.12   CACHE HIT 62.3%

Breakdown
  system_prompt       ~1 240 tok  $0.37
  tool_definitions      ~890 tok  $0.27
  tool_results         4 120 tok  $1.24
  history              2 100 tok  $0.63
  user_input             180 tok  $0.05
  assistant_output       420 tok  $0.63
  cache_read           3 800 tok  $0.11
  cache_write            240 tok  $0.09

Findings
1. [HIGH] $0.58~ Loaded tool definitions that were not used ⚡
2. [MED ] $0.31  Compressible tool output noise
3. [MED ] $0.23~ Cache prefix appears to break between turns ⚡
```

## Install

Requires **Node.js >= 18**.

```bash
# Run without installing
npx agentgauge

# Or install globally
npm install -g agentgauge
agentgauge --help
```

## Quickstart

```bash
# Analyze your most recent Claude Code session
npx agentgauge

# Last 7 days as a shareable HTML report
npx agentgauge analyze --last 7d --html report.html

# JSON for CI / custom dashboards
npx agentgauge analyze --last 24h --json > usage.json

# Screenshot-friendly minimal output
npx agentgauge analyze --last 7d --quiet

# List discovered sessions
npx agentgauge sessions

# Diagnose your local setup
npx agentgauge doctor
```

## Features

- **Local-only analysis** — reads `~/.claude/projects/**/*.jsonl`; no data is uploaded.
- **Semantic token attribution** — splits usage into 8 sections: `system_prompt`, `tool_definitions`, `tool_results`, `history`, `user_input`, `assistant_output`, `cache_read`, `cache_write`.
- **Sidechain vs orchestrator split** — see how much of the session was spent in sub-agent (`Task`) turns.
- **Cost calculation** — uses API-reported cost when available; otherwise falls back to a built-in pricing table with model aliases and Anthropic cache discounts.
- **Agent fingerprinting** — identifies the agent from log path and tool signatures. v0.1 is active for Claude Code; profiles for 16 additional agents are scaffolded for v0.2.
- **Six built-in detectors** — D0–D5 find compressible noise, idle tools, cache breaks, duplicate tool results, oversized context, and stale history.
- **Three output formats** — terminal, single-file HTML, and JSON (`schema_version: 1`).
- **Privacy-first redaction** — paths and tool-result content are redacted by default; use `--include-content` to keep full text in HTML/JSON.

## Commands

### `analyze` (default)

When run with no arguments, `agentgauge` is shorthand for `agentgauge analyze --last`.

**Session selectors** (AND-combined):

| Option | Description |
|--------|-------------|
| `--last [duration]` | Latest session, or a duration like `7d` / `24h` |
| `--since <date>` | Start date (`YYYY-MM-DD` or ISO 8601) |
| `--until <date>` | End date |
| `--all` | All discovered sessions |
| `-p, --project <name>` | Match project directory name |
| `--session <id>` | Match jsonl filename or UUID prefix |
| `--agent <agent>` | Filter by agent (v0.1: `claude-code`) |
| `--model <model-id>` | Filter by model |

**Output options**:

| Option | Description |
|--------|-------------|
| `--html [path]` | Write single-file HTML report. Default path: `./agentgauge-report-{timestamp}.html`; use `-` for stdout |
| `--output-dir <dir>` | Directory for the default HTML filename |
| `--json` | Print structured JSON to stdout (mutually exclusive with `--quiet` / `--verbose`) |
| `-q, --quiet` | Minimal three-number output: cost / savings / cache hit |
| `-v, --verbose` | Show finding evidence and calculation notes |
| `--top-n <N>` | Limit terminal findings to N (default 5; HTML/JSON always full) |
| `--include-content` | Include full tool-result text in HTML/JSON |

**Detector filters**:

| Option | Description |
|--------|-------------|
| `--detectors <list>` | Comma-separated whitelist, e.g. `D1,D2,D3` |
| `--skip-detectors <list>` | Comma-separated blacklist |
| `--min-severity <low\|med\|high>` | Only findings >= severity |
| `--min-savings <usd>` | Only findings with conservative savings >= amount |

### `sessions`

List discovered sessions. Supports `--json`, `--limit N`, `--sort-by time|id`, and the same selectors as `analyze` except output-format flags.

```bash
agentgauge sessions --last 7d --limit 20
agentgauge sessions --json --sort-by id
```

### `doctor`

Diagnose the local environment: Node version, Claude Code data path, number of sessions, and pricing table version.

```bash
agentgauge doctor
```

### `update-pricing`

Fetch and validate a remote pricing table. This is the **only** command that makes an outbound network request.

```bash
agentgauge update-pricing --url https://example.com/pricing.json
```

## Detectors

| ID | Title | What it looks for |
|----|-------|-------------------|
| D0 | Compressible tool output noise | ANSI codes, progress bars, repeated lines, and whitespace in tool results |
| D1 | Loaded tool definitions that were not used | Builtin tools defined in the agent profile but never called |
| D2 | Cache prefix appears to break between turns | Drops in `cache_read` paired with jumps in `cache_creation` |
| D3 | Repeated tool results in context | Identical tool-result content replayed across turns |
| D4 | Oversized tool result was kept in context | Large tool outputs that are never referenced later |
| D5 | Old history looks compactable | Early turns not referenced in recent turns |

Findings marked with ⚡ point to optimizations that require request-layer changes (cache control, tool trimming, result compression). For automatic fixes, see [synrouter.ai](https://synrouter.ai).

## Privacy

- **Zero upload**: no telemetry, no database, no cloud API calls during analysis.
- **Zero network**: the only network-capable command is `update-pricing`.
- **Redaction**: paths are reduced to basenames and tool results are truncated in reports unless you pass `--include-content`.
- **Override data root**: set `AGENTGAUGE_CLAUDE_PROJECTS=/path/to/projects` (comma-separated for multiple roots).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `AGENTGAUGE_CLAUDE_PROJECTS` | Comma-separated roots to scan instead of `~/.claude/projects` |
| `AGENTGAUGE_PRICING_URL` | Default URL for `update-pricing` |
| `NO_COLOR` | Disable ANSI colors in terminal output |

## Roadmap

- **v0.2** — Codex parser, proxy mode, more agent profiles.
- **v0.3** — `watch` mode with an Ink-based TUI.

See [docs/product/agentgauge-prd.md](docs/product/agentgauge-prd.md) and [docs/INDEX.md](docs/INDEX.md) for the full spec map.

## Credits & Prior Art

- The D0 noise detector is adapted from [RTK](https://github.com/rtk-ai/rtk) (MIT). They pioneered this at the CLI layer; `agentgauge` measures it at the session-log layer.
- Design influenced by [ccusage](https://github.com/ccusage/ccusage) and [agentsview](https://github.com/agentsview/agentsview) — both excellent local usage trackers.
- `agentgauge` is an independent open-source project and the free diagnostic top of the funnel for [synrouter](https://synrouter.ai), which provides automatic request-layer optimizations.

## License

MIT © [synrouter](https://github.com/synrouter)
