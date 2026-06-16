---
id: SPEC-AG-005
title: "CLI 接口：analyze / sessions / doctor / update-pricing"
status: draft
created: 2026-06-11
updated: 2026-06-11
tags: [cli, v0.1, P0]
relates: [SPEC-AG-001, SPEC-AG-004]
---

# SPEC-AG-005: CLI 接口：analyze / sessions / doctor / update-pricing

## 背景

实现 PRD §5（CLI 接口规范——对外接口契约）的 v0.1 部分：citty 入口、4 个子命令、全局选项、退出码、stdout/stderr 分流。`npx agentgauge` 零参数出报告是整个获客漏斗的第一关。**PRD §5 是唯一权威**，本 SPEC 不重复罗列每个 flag，只登记实现要求与 PRD 未尽的实现细节；PRD §5 变化时本 SPEC 随之更新（docs/AGENTS.md 同步清单）。

## 数据依赖与可行性验证（必填）

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| 上游模块产物 | SPEC-AG-001/002/003/004 | log | 纯编排层，无外部数据假设 |
| 远程 pricing.json | `AGENTGAUGE_PRICING_URL` / LiteLLM 默认源 | 网络（仅 update-pricing） | 默认拉取 LiteLLM 的模型价格快照；zod 校验后落 `~/.agentgauge/pricing.json` |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…；跨文档全称引用写 `SPEC-AG-005, R<N>`。

### R1: citty 入口与全局选项

**优先级**: P0
**状态**: proposed

- 子命令：`analyze`（默认）/ `sessions` / `doctor` / `update-pricing`；全局选项与帮助文本按 PRD §5.3 / §5.15
- 零参数 ≡ `analyze --last`，末尾提示 `Try agentgauge --help`
- 时间窗口语法采用 `--last [7d|24h]`（PRD §5.4.1 的 `--last-Nd` 动态 flag 名 citty 无法声明——见 design.md D1，需回写 PRD）
- 验收：`npx agentgauge`、`agentgauge --help`、每个子命令 `--help`（含 1-2 示例）全部可用

### R2: analyze 选择器 / 输出 / 检测器开关编排

**优先级**: P0
**状态**: proposed

- 实现 PRD §5.4.1–5.4.3 全部 flag 与互斥规则（冲突时间窗口"后者覆盖 + stderr 警告"）
- `--json` 关终端报告并禁色；`--html` 与 `--json` 可同给
- 验收：PRD §5.4.4 的 7 个完整示例逐条跑通

### R3: 退出码与 stdout/stderr 契约

**优先级**: P0
**状态**: proposed

- 退出码按 PRD §5.11（0/1/2/3/4/64/130）；找不到数据 = 3（区别于失败）
- stdout 只出结果，进度/警告/debug 全走 stderr（PRD §5.12）
- 验收：`agentgauge analyze --json > out.json` 后 out.json 是合法 JSON；无数据时退出码 3

### R4: doctor 与 update-pricing

**优先级**: P0
**状态**: proposed

- doctor：Node 版本 / 数据源发现 / pricing 版本 / TTY 状态，找不到数据给可复制修复建议（PRD §5.6）；只诊断无副作用
- update-pricing：`--url` / `--dry-run` / `--force`，zod 校验失败不落盘（PRD §5.7）
- 验收：在无 `~/.claude` 的容器环境跑 doctor 出修复建议、退出码非 0 但不 crash

### R5: sessions 子命令

**优先级**: P1
**状态**: proposed

- 表格 / `--json`、`--sort-by`、`--limit`，复用 analyze 选择器（PRD §5.5）
- 验收：1000 session 下 `sessions --limit 50` < 3s

## 成功标准

- 漏斗第一关：干净机器 `npx agentgauge` → 10 秒内出报告或 doctor 级修复建议，零 crash
- cli 模块覆盖率 ≥ 60%（PRD 质量门）
- `update-pricing` 默认从 LiteLLM 拉取价格快照；失败时才由 `--url` 或 `AGENTGAUGE_PRICING_URL` 覆盖

## 非目标

- proxy（v0.2 FR-AG-10）/ watch（v0.3 FR-AG-11）子命令——届时另立 SPEC，但命令名已在 help 中预留占位
- `--mode subscription` 的换算逻辑（仅解析并提示 "coming soon"）

## 相关文档

- 设计文档: `design.md` ｜ 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md` §5（唯一接口权威）
- 依赖: SPEC-AG-001 ~ 004
