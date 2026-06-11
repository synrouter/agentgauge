# agentgauge

Open-source CLI for seeing where AI coding agents spend tokens: per session, per tool,
with cost attribution and compressible-noise estimates.

## Credits & Prior Art

The D0 noise detector is adapted from [RTK](https://github.com/rtk-ai/rtk) (MIT). They
pioneered this at the CLI layer; agentgauge measures it at the session-log layer.

## Quickstart

```bash
npx agentgauge
npx agentgauge analyze --last --json
npx agentgauge analyze --last --html report.html
npx agentgauge doctor
```

agentgauge reads local Claude Code logs from `~/.claude/projects/**/*.jsonl` and does not
upload data. The only network-capable command is `update-pricing`.

## Commands

- `analyze`: terminal, JSON, or single-file HTML report.
- `sessions`: list discovered Claude Code sessions.
- `doctor`: diagnose missing local data and pricing state.
- `update-pricing`: explicitly fetch and validate a user pricing table.
