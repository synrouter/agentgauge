---
updated: 2026-06-11
---

# INDEX — agentgauge 文档索引与规范追溯

> Open-source CLI that breaks down where your AI coding agent burns tokens.

## 快速导航

- **SPEC 规范**: [SPEC-AG 状态表](#规范索引) — 功能需求 → 设计 → 代码追溯
- **产品文档**: [agentgauge PRD（产品战略 + CLI 接口契约）](product/agentgauge-prd.md)
- **AI Agent 协作**: [docs/AGENTS.md](AGENTS.md)（轻量 Spec-Driven 流程）/ 仓库根 [AGENTS.md](../AGENTS.md)（技术栈与工作约定）

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
> 一个 SPEC 对应一个相对独立的功能模块或一类改动（约 3-10 个 FR）。命名为 `SPEC-AG-XXX`。

| 规范 ID | 功能 | PRD | 设计 | 任务 | 状态 |
|---------|------|-----|------|------|------|
| _尚无 SPEC，所有 v0.1 工作直接基于 [agentgauge-prd.md](product/agentgauge-prd.md) 的 FR-AG-1 ~ FR-AG-7_ | | | | | |

<!--
新增 SPEC 时按下面格式登记：

| SPEC-AG-001 | <功能名> | [prd](specs/SPEC-AG-001-<kebab-name>/prd.md) | [design](specs/SPEC-AG-001-<kebab-name>/design.md) | [tasks](specs/SPEC-AG-001-<kebab-name>/tasks.md) | draft / in-progress / implemented / deferred |
-->

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

> 当已知要修改的文件时，反向定位它属于哪个 PRD 章节或哪个 SPEC。
> v0.1 阶段直接索引 PRD FR；引入 SPEC 后改为 FR ↔ SPEC ↔ file 三向索引。

### v0.1 PRD FR 映射（占位 — 实现后填充）

| FR | 需求 | 文件 |
|----|------|------|
| FR-AG-1 | Claude Code session 解析 | `src/parsers/claude-code.ts`（待实现） |
| FR-AG-2 | 7 类语义角色 token 归因 | `src/attribution/tokenize.ts`（待实现） |
| FR-AG-3 | 内置定价表 | `src/attribution/pricing.ts`、`assets/pricing.json`（待实现） |
| FR-AG-4 | 检测器 D1–D5 | `src/detectors/d1-*.ts` ~ `d5-*.ts`（待实现） |
| FR-AG-5 | 终端 / HTML / JSON 输出 | `src/render/{terminal,html,json}.ts`（待实现） |
| FR-AG-6 | 隐私保护（脱敏、零网络） | 跨模块约束，见 PRD §FR-AG-6 |
| FR-AG-7 | 技术栈与分发 | `package.json` / `tsup.config.ts`（待实现） |

## 架构决策记录（ADR）

> agentgauge 是轻量项目，大决策直接进 PRD 待决问题表（§15）。这里只登记跨 SPEC 的重大决策。

| ADR ID | 标题 | 来源 | 决策日期 |
|--------|------|------|----------|
| ADR-001 | 技术栈使用 TypeScript/Node 而非 Python（npx 分发 + 用户已装 Node + Ink TUI） | PRD §FR-AG-7.1 / Q1 | 2026-06-11 |
| ADR-002 | CLI 框架使用 citty（unjs 生态、类型友好），不用 commander/oclif | PRD §FR-AG-7.2 / Q7 | 2026-06-11 |
| ADR-003 | doctor 与 update-pricing 保持为独立子命令（不合并为 `doctor --fix`） | PRD §5.6 / Q8 | 2026-06-11 |

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
- **代码注解**：TypeScript JSDoc 中使用 `@spec SPEC-AG-XXX, FR-Y.Z`；单行注释 `// @spec SPEC-AG-XXX, FR-Y.Z` 也可接受。
- **已完成 SPEC**：标 `(只读)` 的规范已完成实现，bug fix / 小改动直接读代码上的 `@spec` 注解，无需翻阅 prd/design。

## 文件快速索引

> v0.1 实现完成后，把 `src/` 下的关键文件反向索引到对应 PRD FR / SPEC 填到这里。

| 源文件 | 归属 | 备注 |
|--------|------|------|
| _待 v0.1 实现后填充_ | | |
