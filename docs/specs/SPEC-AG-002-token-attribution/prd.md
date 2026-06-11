---
id: SPEC-AG-002
title: "语义角色 Token 归因与成本计算"
status: draft
created: 2026-06-11
updated: 2026-06-11
tags: [attribution, pricing, v0.1, P0]
relates: [SPEC-AG-001, SPEC-AG-003, SPEC-AG-004]
---

# SPEC-AG-002: 语义角色 Token 归因与成本计算

## 背景

实现 PRD §FR-AG-2（7 类语义角色归因 + sidechain 拆分）与 §FR-AG-3（内置定价表）。这是产品核心三件套中的 **breakdown** 能力，也是所有检测器金额化的基础。关键约束：log 模式下 system_prompt / tool_definitions 不可直接测量，必须用残差法估算（详见 PRD FR-AG-2 数据源分层）。

## 数据依赖与可行性验证（必填）

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| 归一化 Session / Turn | SPEC-AG-001 输出 | log | 依赖 SPEC-AG-001 |
| usage 四元组（input / output / cache_read / cache_creation） | assistant 记录 `message.usage` | log | ✅ 2026-06-11 实测存在 |
| message content（tool_result / text block） | user & assistant 记录 | log | ✅ 2026-06-11 实测存在 |
| `isSidechain` | Turn 透传 | log | ✅ 2026-06-11 实测存在 |
| system / tools 原文 | 请求体 | **proxy only** | ⚠ log 模式不可得 → R2 残差法 |
| Claude 3+ 精确 tokenizer | — | **不存在** | ⚠ Anthropic 未公开；js-tiktoken 只切内部比例，总量以 usage 为准（PRD Q2 决议） |
| `costUSD` 字段 | assistant 记录（可能缺失/不可靠） | log | ⚠ 经 ccusage 源码证实存在三态（有/无/不可信）→ R4 采用 auto 语义 |
| `<synthetic>` 等非计费 model 值 | assistant 记录 | log | ⚠ 经 agentsview 源码证实存在 → 统一 eligibility 规则排除 |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…；跨文档全称引用写 `SPEC-AG-002, R<N>`。

### R1: 可测段精确归因

**优先级**: P0
**状态**: proposed

- 对 tool_results / history / user_input 用 js-tiktoken 计数得**相对占比**，再按 usage 总 input 等比缩放为 token 数
- assistant_output / cache_read / cache_write 直读 usage
- 验收：各段之和 + 残差 ≡ usage 总量（恒等式永远成立，usage 是 ground truth）

### R2: 稳定前缀残差估算（log 模式）

**优先级**: P0
**状态**: proposed

- `残差 = usage 总 input − 可测段` ≈ system_prompt + tool_definitions
- 多轮残差取中位数平滑；按已知 agent 指纹的典型比例切分 system / tools 两行展示
- 估算值在所有输出中带 `estimated: true`（JSON）/ `~` 前缀（终端、HTML）
- 残差轮间异常波动暴露为信号（供 D6 候选检测器使用）
- 验收：对 examples/ fixture，残差中位数与逐轮残差的偏离 < 10%

### R3: Sidechain 维度聚合

**优先级**: P0
**状态**: proposed

- 按 `isSidechain` 分桶聚合 cost / tokens / 模型分布
- 无 sidechain 轮次时聚合对象为空、报告不显示该行
- 验收：含 Task 派生的 fixture 上，orchestrator + sidechain 之和 = session 总量

### R4: 定价表与成本计算

**优先级**: P0
**状态**: proposed

- `assets/pricing.json` 内置快照（zod schema 校验）；用户副本 `~/.agentgauge/pricing.json` 优先
- cost 计算区分 input / output / cache_read（0.1×）/ cache_write（1.25×）单价
- 缓存折扣分摊规则：cache_read 的折扣按各语义段 token 占比等比分摊回各段成本
- 模型 ID 别名解析（`sonnet-4-5` → 完整 ID）
- costUSD auto 语义：记录自带 `costUSD` 则优先采用，缺失时按 token × 单价计算（参考 ccusage CostMode）
- 统一 eligibility 规则：`model` 为空或 `<synthetic>` 的记录不计入成本（单一常量函数，所有口径共用）
- 未知模型：成本字段输出 null + stderr 警告，不 crash
- 验收：终端报告各行美元数之和与 COST 总数一致（±$0.01 取整误差）

### R5: 双口径节省与归因误差控制

**优先级**: P1
**状态**: proposed

- 为检测器层（SPEC-AG-003）提供 `savings: {conservative_usd, theoretical_usd}` 计算原语
- 内部比例切分的近似性在 `--verbose` 中说明
- 验收：conservative ≤ theoretical 恒成立

## 成功标准

- 恒等式：Σ(各段) = usage 总量，在全部 fixture 上零偏差
- 残差估算两段标注清晰，无"假装精确"
- 单 session 归因 < 200ms（不含解析）

## 非目标

- 检测与 finding 生成（SPEC-AG-003）
- proxy 模式精确归因（v0.2；本 SPEC 的接口预留 `mode: 'log' | 'proxy'` 字段）
- OpenAI / 其他厂商 tokenizer（v0.2）

## 相关文档

- 设计文档: `design.md` ｜ 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md` §FR-AG-2 / §FR-AG-3
- 依赖: SPEC-AG-001
