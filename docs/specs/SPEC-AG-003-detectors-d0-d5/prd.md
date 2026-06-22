---
id: SPEC-AG-003
title: "检测器 D0–D5 与 Finding 框架"
status: implemented
created: 2026-06-11
updated: 2026-06-11
tags: [detectors, noise, v0.1, P0]
relates: [SPEC-AG-002, SPEC-AG-004, SPEC-AG-006]
---

# SPEC-AG-003: 检测器 D0–D5 与 Finding 框架

## 背景

实现 PRD §FR-AG-4（检测器 D0–D5，首发 6 个）。这是产品核心三件套中的 **noise** 能力（D0）+ 全部可操作建议的来源。每条 finding 金额化（双口径）是与 ccusage / agentsview 的护城河差异，⚡ 标记是 synrouter 转化钩子。

**RTK 致谢（强制）**：D0 算法 adapted from [RTK (rtk-ai/rtk, MIT)](https://github.com/rtk-ai/rtk)，`d0-noise.ts` 文件头注释必须保留 "noise detection adapted from RTK"（PRD §14 三处致谢之一）。

## 数据依赖与可行性验证（必填）

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| Attribution / CostBreakdown | SPEC-AG-002 输出 | log | 依赖 SPEC-AG-002 |
| tool_result 原文 | message content | log | ✅ 2026-06-11 实测存在（D0/D3/D4/D5 直接消费） |
| tool_use 调用记录（name + input） | assistant 记录 | log | ✅ 2026-06-11 实测存在（D1 log 估算用） |
| usage 轮间序列 | SPEC-AG-002 | log | ✅（D2 log 估算用：cache_read 骤降 + cache_creation 突增） |
| tools 数组（精确 D1）/ 请求 prefix（精确 D2） | 请求体 | **proxy only** | ⚠ v0.1 走估算路径，PRD FR-AG-4 已标注"数据依赖"列 |
| agent 内置工具清单 | SPEC-AG-006 指纹库 | log | 依赖 SPEC-AG-006（D1 log 估算需要） |
| compact 边界 / 系统注入消息标记 | SPEC-AG-001 解析层打标 | log | ✅ 字段存在性经 agentsview 源码证实（`isCompactSummary`、continuation/resume 等模式）；D3/D5 消费以防误报 |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…；跨文档全称引用写 `SPEC-AG-003, R<N>`。

### R1: Finding 框架与检测器注册表

**优先级**: P0
**状态**: proposed

- `Finding = {id, severity, title, evidence, savings: {conservative_usd, theoretical_usd}, fix_path, fix_url?, estimated?}`
- 注册表模式：每个检测器纯函数 `(session, attribution, cost) → Finding[]`；单个检测器抛错只跳过该检测器（stderr 警告），不毁报告
- 支持 `--detectors` / `--skip-detectors` / `--min-severity` / `--min-savings` 过滤（接口在 SPEC-AG-005）
- 验收：注入一个必抛错的假检测器，报告仍完整输出其余 findings

### R2: D0 可压缩噪声（L0）

**优先级**: P0
**状态**: proposed

- 对每条 tool_result 估算可压缩比例：ANSI 转义、进度条/spinner 残留、重复行、空白膨胀
- 噪声 token × 出现轮次 × input 单价 = 浪费金额；噪声占 tool_results > 15% = MED
- 算法 adapted from RTK（文件头致谢）
- 验收：对含 ANSI/进度条的 fixture，检出比例与人工标注偏差 < 20%

### R3: D1 工具定义膨胀（log 估算路径）

**优先级**: P0
**状态**: proposed

- 从 tool_use 记录得"实际调用集合"，从 SPEC-AG-006 指纹库得"已加载集合"与典型 schema 尺寸
- 闲置 > 50% 且损耗 > $0.50 = HIGH；金额带 `~`（estimated: true）
- 验收：claude-code fixture 上 idle 集合与人工核对一致

### R4: D2 缓存前缀破坏（log 估算路径）

**优先级**: P0
**状态**: proposed

- 轮间 usage 信号：cache_read 骤降 + cache_creation 突增 → 断裂点；损失 ≈ 重写 cache_creation × 1.25× 单价
- 单 session 损失 > $1.0 = HIGH；金额带 `~`
- 验收：人工构造断裂的 fixture 上定位轮次准确

### R5: D3 重复工具结果 + D4 超长工具结果 + D5 可压缩历史

**优先级**: P0
**状态**: proposed

- D3：SHA256 + size 桶，同哈希 ≥ 3 次 = 重复；占比 > 20% = MED
- D4：单条 > 10K tokens 且后续未被引用（≥ 30 token 子串重合判定）；> 20K = MED
- D5：前 20% 轮次在最后 5 轮 assistant 上下文零引用；可压缩 > 30% history = LOW
- 三者均为 log 精确路径，不带 `~`
- 验收：各自 fixture 上零误报（对干净 session 不报）

## 成功标准

- 6 个检测器在 examples/ 全部 fixture 上跑通，干净 fixture 零误报
- 全部 finding 金额可追溯（--verbose 展示计算式，PRD §9.2）
- 单 session 全检测器 < 500ms

## 非目标

- D6–D10 候选检测器（每个届时单独立 SPEC 或扩展本 SPEC）
- 任何"修复"动作（synrouter 边界）
- proxy 精确路径（v0.2；R3/R4 接口预留 mode 参数）

## 相关文档

- 设计文档: `design.md` ｜ 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md` §FR-AG-4 / §8 / §12
- 依赖: SPEC-AG-002、SPEC-AG-006（仅 D1）
