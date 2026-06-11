---
id: SPEC-AG-XXX
title: "<功能名称>"
status: draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: []
relates: []
---

# SPEC-AG-XXX: <功能名称>

## 背景

<!-- 1-2 段关于问题、背景和动机的描述 -->

<!-- 与 docs/product/agentgauge-prd.md 中的哪个 FR / 章节相关？如：
本 SPEC 实现 PRD §FR-AG-4 中的检测器 D6（system_prompt 动态片段定位）。 -->

## 数据依赖与可行性验证（必填）

<!-- 本 SPEC 依赖哪些输入数据？逐项标注可得性：
     log 模式可得 / proxy 模式可得 / 需实测确认。
     凡"需实测确认"项，必须先用真实数据（examples/ fixture 或本机 session）
     验证字段确实存在，把验证日期与结论写在这里。
     反面教材：曾假设 session JSONL 含 system/tools 字段，实测并不存在，
     导致归因方案返工（见 PRD FR-AG-2 数据源分层）。 -->

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| <字段/数据> | <文件/API> | log / proxy / 需实测 | <日期 + 结论> |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…（SPEC 内自增）；跨文档全称引用写 `SPEC-AG-XXX, R<N>`。
> 不要使用 `FR-AG-*` 前缀——那是产品 PRD 的命名空间。

### R1: <需求标题>

**优先级**: P0 | P1 | P2
**状态**: proposed | in-progress | implemented | deferred

<描述和验收标准>

### R2: <需求标题>

**优先级**: P0 | P1 | P2
**状态**: proposed | in-progress | implemented | deferred

<描述和验收标准>

## 成功标准

<!-- 可衡量的结果。例如：
- D6 检测器对样例 fixture 1-5 给出与人工标注一致的 finding
- 误报率 < 5%（在 examples/ 下 20 个真实 session 上测试）
- 单 session 检测耗时 < 50ms
-->

## 非目标

<!-- 显式列出本 SPEC 不做的事，避免范围蔓延。 -->

## 相关文档

- 设计文档: `design.md`
- 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md`
- 依赖: SPEC-AG-YYY（如适用）
