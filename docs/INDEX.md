---
updated: 2026-06-22
---

# INDEX — agentgauge 文档索引与规范追溯

> Open-source CLI that breaks down where your AI coding agent burns tokens.

## 快速导航

- **SPEC 规范**: [SPEC-AG 状态表](#规范索引) — 功能需求 → 设计 → 代码追溯
- **产品文档**: [agentgauge PRD（产品战略 + CLI 接口契约）](product/agentgauge-prd.md)
- **AI Agent 协作**: [docs/AGENTS.md](AGENTS.md)（轻量 Spec-Driven 流程 + PRD 变更同步清单）/ 仓库根 [AGENTS.md](../AGENTS.md)（技术栈与工作约定）

## 文档目录结构

```
docs/
├── INDEX.md            # 本文件 — SPEC 映射 + 文档索引
├── AGENTS.md           # AI Agent 工作流规则（轻量 Spec-Driven）
├── product/            # 产品战略 PRD（主文档：agentgauge-prd.md）
├── specs/              # 功能规范 SPEC-AG-001+
│   └── _template/      # 新 SPEC 的起始模板
├── growth/             # 增长 / launch 文案（按需创建）
└── competitive/        # 竞品分析（按需创建）
```

## 规范索引

> agentgauge 采用**轻量 Spec-Driven**：只为真正复杂的改动立 SPEC。**绝大多数改动都不需要 SPEC**——直接动手。
> 一个 SPEC 对应一个相对独立的功能模块或一类改动（约 3-10 个需求 R1…RN）。命名为 `SPEC-AG-XXX`。
> 状态枚举：`draft / in-progress / implemented / deferred / deprecated`。**`implemented` 即只读**——后续 bug fix / 小改动直接读代码上的 `@spec` 注解，无需翻阅 prd/design。

| 规范 ID | 功能 | PRD | 设计 | 任务 | 状态 |
|---------|------|-----|------|------|------|
| SPEC-AG-001 | Claude Code Session 解析器 | [prd](specs/SPEC-AG-001-claude-code-parser/prd.md) | [design](specs/SPEC-AG-001-claude-code-parser/design.md) | [tasks](specs/SPEC-AG-001-claude-code-parser/tasks.md) | implemented |
| SPEC-AG-002 | 语义角色 Token 归因与成本计算 | [prd](specs/SPEC-AG-002-token-attribution/prd.md) | [design](specs/SPEC-AG-002-token-attribution/design.md) | [tasks](specs/SPEC-AG-002-token-attribution/tasks.md) | implemented |
| SPEC-AG-003 | 检测器 D0–D5 与 Finding 框架 | [prd](specs/SPEC-AG-003-detectors-d0-d5/prd.md) | [design](specs/SPEC-AG-003-detectors-d0-d5/design.md) | [tasks](specs/SPEC-AG-003-detectors-d0-d5/tasks.md) | implemented |
| SPEC-AG-004 | 报告渲染：终端 / HTML / JSON | [prd](specs/SPEC-AG-004-report-rendering/prd.md) | [design](specs/SPEC-AG-004-report-rendering/design.md) | [tasks](specs/SPEC-AG-004-report-rendering/tasks.md) | implemented |
| SPEC-AG-005 | CLI 接口（analyze / sessions / doctor / update-pricing） | [prd](specs/SPEC-AG-005-cli-interface/prd.md) | [design](specs/SPEC-AG-005-cli-interface/design.md) | [tasks](specs/SPEC-AG-005-cli-interface/tasks.md) | implemented |
| SPEC-AG-006 | Agent 识别（三层指纹） | [prd](specs/SPEC-AG-006-agent-identify/prd.md) | [design](specs/SPEC-AG-006-agent-identify/design.md) | [tasks](specs/SPEC-AG-006-agent-identify/tasks.md) | implemented |
| SPEC-AG-007 | Agent 行为洞察与可执行建议 | [prd](specs/SPEC-AG-007-behavior-insights/prd.md) | [design](specs/SPEC-AG-007-behavior-insights/design.md) | [tasks](specs/SPEC-AG-007-behavior-insights/tasks.md) | implemented |

**实现依赖顺序**（不是严格串行，标注硬依赖）：

```
SPEC-AG-001 (parser)
  ├─→ SPEC-AG-002 (attribution)  ─→ SPEC-AG-003 (detectors) ─→ SPEC-AG-004 (render)
  └─→ SPEC-AG-006 (identify)     ─→ SPEC-AG-003 的 D1            │
                                                                  ▼
                                                       SPEC-AG-005 (cli 编排，收口)

SPEC-AG-007 (behavior insights)
  ├─ consumes SPEC-AG-001 normalized turns / tool events
  ├─ consumes SPEC-AG-002 attribution / per-tool tokens
  ├─ extends SPEC-AG-003 with D6-D9
  └─ extends SPEC-AG-004 render model without schema_version bump
```

### 何时立 SPEC？

立 SPEC：
- 新增独立 parser（v0.2 的 Codex / OpenCode parser）
- 新增检测器（D6+），且检测算法需要设计讨论
- 引入新工作模式（v0.2 proxy、v0.3 watch/TUI）
- 报告格式或 JSON schema 的破坏性变更（schema_version 升级）
- 任何跨越 3+ 模块的改动

不立 SPEC：
- 修复 bug
- 改文案 / 改颜色 / 调阈值
- 添加单文件辅助函数
- 单一 parser 内部重构
- README 与文档优化

## 需求到代码的映射（反向索引）

> 当已知要修改的文件时，反向定位它属于哪个 PRD FR / SPEC。文件列记录当前实现入口与主要测试覆盖。

| PRD FR | 需求 | SPEC | 文件 |
|--------|------|------|------|
| FR-AG-1 | Claude Code session 解析 | SPEC-AG-001 | `src/parsers/claude-code.ts`、`src/parsers/types.ts`、`src/lib/glob.ts`、`src/lib/time.ts`、`examples/*.jsonl` |
| FR-AG-2 | 7 类语义角色归因 + sidechain 拆分 | SPEC-AG-002 | `src/attribution/tokenize.ts`、`tests/attribution/attribution.test.ts` |
| FR-AG-3 | 内置定价表 | SPEC-AG-002 | `src/attribution/pricing.ts`、`src/attribution/cost.ts`、`assets/pricing.json` |
| FR-AG-4 | 检测器 D0–D5 | SPEC-AG-003 | `src/detectors/d0-noise.ts`、`src/detectors/d1-tool-bloat.ts`、`src/detectors/d2-cache-break.ts`、`src/detectors/d3-dup-results.ts`、`src/detectors/d4-oversize.ts`、`src/detectors/d5-compactable.ts`、`src/detectors/index.ts` |
| FR-AG-5 | 终端 / HTML / JSON 输出 | SPEC-AG-004 | `src/render/model.ts`、`src/render/terminal.ts`、`src/render/html.ts`、`src/render/json.ts` |
| FR-AG-6 | 隐私保护（脱敏） | SPEC-AG-004（脱敏）+ SPEC-AG-005 | `src/render/model.ts`、`src/cli/commands/update-pricing.ts`、`assets/pricing.json` |
| FR-AG-7 | 技术栈与分发 | —（已决，无需 SPEC） | `package.json`、`tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`、`biome.json` |
| FR-AG-12 | Agent 识别（三层指纹） | SPEC-AG-006 | `src/identify/profiles.ts`、`src/identify/index.ts` |
| FR-AG-13 | Agent 行为洞察与可执行建议 | SPEC-AG-007 | `src/insights/tool-behavior.ts`、`src/insights/turn-efficiency.ts`、`src/detectors/d6-tool-failures.ts`、`src/detectors/d7-model-mismatch.ts`、`src/detectors/d8-read-churn.ts`、`src/detectors/d9-context-growth.ts`、`src/render/model.ts` |
| PRD §5 | CLI 接口契约 | SPEC-AG-005 | `src/cli.ts`、`src/cli/args.ts`、`src/cli/commands/analyze.ts`、`src/cli/commands/sessions.ts`、`src/cli/commands/doctor.ts`、`src/cli/commands/update-pricing.ts` |

## 架构决策记录

> 不单独维护 ADR 表——**PRD §15 待决问题表即决策记录**（Q1/Q2/Q7/Q8 已决议，含日期与理由链接）。SPEC 级设计决策在各 SPEC 的 `design.md` 中（编号 D1、D2…）。

## 非 SPEC 文档索引

### 产品 (`product/`)

| 文件 | 说明 |
|------|------|
| [agentgauge-prd.md](product/agentgauge-prd.md) | 产品战略 PRD + CLI 接口契约 + KPI + 落地路线图 |

### 增长 (`growth/` — 按需创建)

_尚无文档。launch 文案准备时新建。_

### 竞品 (`competitive/` — 按需创建)

_尚无文档。深度竞品对比时新建（ccusage / agentsview / tokscale 等）。_

## 文档约定

- **ID 稳定性**：SPEC ID 一经分配即不可变。已弃用的规范设置 `status: deprecated`，不删除目录。
- **Frontmatter**：所有规范文件使用 YAML frontmatter，包含 `id`、`title`、`status`、`created`、`updated`。
- **交叉引用**：规范之间通过 frontmatter 的 `relates` 字段和 markdown 链接相互引用。
- **代码注解**：有 SPEC 的代码用 `@spec SPEC-AG-XXX, R<N>`；无 SPEC、直接依据 PRD 的代码用 `@prd FR-AG-<N>`（格式详见 [AGENTS.md](AGENTS.md)）。
- **PRD 变更**：修改 PRD 后按 [AGENTS.md 的同步清单](AGENTS.md#prd-变更同步清单强制) 核对本文件的映射表。
