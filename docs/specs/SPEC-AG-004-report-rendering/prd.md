---
id: SPEC-AG-004
title: "报告渲染：终端 / HTML / JSON"
status: implemented
created: 2026-06-11
updated: 2026-06-11
tags: [render, v0.1, P0]
relates: [SPEC-AG-002, SPEC-AG-003, SPEC-AG-005]
---

# SPEC-AG-004: 报告渲染：终端 / HTML / JSON

## 背景

实现 PRD §FR-AG-5（三种输出格式）与 §FR-AG-6（隐私保护/脱敏）。报告是产品的传播面：终端报告承担截图传播（首屏三数字），HTML 承担深度展示 + synrouter CTA，JSON 承担 CI 集成（稳定 schema 契约，PRD §5.13）。

## 数据依赖与可行性验证（必填）

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| Attribution / CostBreakdown / Finding[] | SPEC-AG-002 / 003 输出 | log | 依赖上游 SPEC，无外部数据假设 |
| TTY / NO_COLOR 环境 | process 运行时 | — | 标准 Node API，无需验证 |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…；跨文档全称引用写 `SPEC-AG-004, R<N>`。

### R1: 终端报告

**优先级**: P0
**状态**: proposed

- 按 PRD FR-AG-5a mock：首屏三数字（COST / POTENTIAL SAVINGS / CACHE HIT）+ 7 类构成条 + findings 列表（金额降序、severity 色块、⚡ 标记）
- 残差估算行（system prompt / tool definitions）带 `~` 前缀
- 不超 24 行；`--top-n` 控制 findings 条数（默认 5）；`--quiet` 只出三数字 + 一行摘要
- picocolors 上色；非 TTY / NO_COLOR 自动降级纯文本
- 验收：黄金快照测试锁定输出格式（PRD 质量门要求）

### R2: HTML 单文件报告

**优先级**: P0
**状态**: proposed

- 单文件 < 80KB、零外部依赖、内联 CSS、深色开发者风格、纯 CSS 图表
- 含终端报告全部信息 + 每条 finding 展开证据与计算公式（PRD §9.2 可追溯性）
- 三处 synrouter 入口：hero CTA / 每条 ⚡ finding / 页脚（PRD §11.2）
- 估算值 hover 解释残差法
- 验收：黄金快照 + 文件大小断言 < 80KB

### R3: JSON 输出（稳定契约）

**优先级**: P0
**状态**: proposed

- 遵循 PRD §5.13 schema：顶层 `version` / `schema_version: 1` / `generated_at` / `sessions[]` / `aggregate` / `findings[]`
- finding 带 `savings: {conservative_usd, theoretical_usd}`；估算字段带 `estimated: true`；session 带 `agent` + `agent_confidence` + `sidechain` 聚合
- 同 schema_version 只增不删字段（契约测试锁定）
- 验收：zod schema 自校验 + 契约测试（删字段即测试失败）

### R4: 脱敏（默认开）

**优先级**: P0
**状态**: proposed

- tool_result 内容默认只保留前 80 + 后 40 字符 + 长度；`--include-content` 显式关闭
- finding evidence 中的文件路径默认 basename 化（HTML 报告是设计来外发的，PRD FR-AG-6）
- 验收：默认输出的 HTML/JSON 中 grep 不到 fixture 中的敏感占位内容与完整路径

## 成功标准

- 三种输出全部黄金快照锁定；快照 diff 必须人工审查（防止偷偷改坏 UX）
- JSON 契约测试通过；`--json | jq .` 可直接管道
- render 模块覆盖率 ≥ 60%（PRD 质量门）

## 非目标

- Ink TUI（v0.3，SPEC 届时另立）
- 周报 / 趋势聚合渲染（v0.2 FR-AG-9）
- `--mode subscription` 换算展示（依赖订阅定价模型，v0.1 仅预留 flag 解析）

## 相关文档

- 设计文档: `design.md` ｜ 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md` §FR-AG-5 / §FR-AG-6 / §5.12 / §5.13 / §9
- 依赖: SPEC-AG-002、SPEC-AG-003
