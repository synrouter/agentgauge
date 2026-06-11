---
id: DESIGN-AG-002
spec: SPEC-AG-002
title: "Token 归因与成本计算设计"
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# DESIGN-AG-002: Token 归因与成本计算设计

## 背景

log 模式没有请求体，归因 = "可测段精确 + 残差估算"的混合体。设计目标：恒等式不破、估算诚实标注、纯函数（同输入同输出，供 watch 增量复用）。

> 编号规则：设计决策用 `D1`、`D2`…（与 PRD 检测器编号 D0-D10 无关）。

## 设计决策

### D1: usage 为 ground truth，tokenizer 只决定内部比例

**理由**: Claude 3+ tokenizer 未公开，js-tiktoken 绝对计数不可信；但 usage 总量是 API 实报的精确值。比例切分 + 等比缩放让总量永远精确
**考虑的替代方案**: 直接信 tokenizer 绝对值——总量会与账单对不上，违反"不夸大估算"原则（PRD §9.2）
**取舍**: 各段绝对值仍是近似；用 `~` / `estimated` 标注换取诚实

### D2: 残差中位数平滑，而非逐轮残差

**理由**: 单轮残差受 cache 边界、轮内重试等噪声影响；稳定前缀（system+tools）在 session 内近似恒定，中位数是稳健估计
**考虑的替代方案**: 均值——被异常轮拉偏；首轮值——首轮往往含 cache_creation 特殊性
**取舍**: 残差真实波动的信息被压平；把波动序列单独保留，供 D6 候选检测器消费

### D3: 缓存折扣按段占比分摊

**理由**: 终端报告各段美元数之和必须等于 COST 总数（用户会用计算器验算，PRD §11.3 风险）；等比分摊是唯一不需要请求体知识的自洽规则
**考虑的替代方案**: 把缓存优惠全记给"稳定前缀"段——更接近物理事实但 log 模式下无法证明，且各段加总仍须配平
**取舍**: 段级美元数是"摊薄成本"而非"边际成本"；HTML hover 注明口径

### D4: pricing 用 zod 校验 + 双层来源（用户副本 > 内置快照）

**理由**: PRD FR-AG-3 明确要求；远程 JSON 不可信，zod 失败回退内置快照（退出码 4 仅当两层全坏）
**考虑的替代方案**: 仅内置——价格过期快；仅远程——违反零网络承诺
**取舍**: 无显著代价

## 实现

```typescript
// @prd FR-AG-2
export function attribute(session: Session, opts: { mode: 'log' }): Attribution {
  // 1. 各 Turn 可测段 tiktoken 计数 → 比例
  // 2. 按 usage.input 等比缩放
  // 3. residual = input − measured；median(residuals) → stable prefix
  // 4. isSidechain 分桶聚合
}

// @prd FR-AG-3
export function computeCost(attr: Attribution, pricing: PricingTable): CostBreakdown {
  // 段级成本 + cache 折扣等比分摊；Σ段 ≡ 总 COST
}
```

## 文件

- `src/attribution/tokenize.ts`（R1/R2/R3）
- `src/attribution/pricing.ts`（R4 定价加载 + zod）
- `src/attribution/cost.ts`（R4/R5 成本与节省原语）
- `assets/pricing.json`

## 测试

- `tests/attribution/tokenize.test.ts` — 恒等式属性测试（任意 fixture Σ段=usage）
- `tests/attribution/cost.test.ts` — 分摊配平、未知模型降级
- 真实 fixture（examples/），非 mock

## 现有实现参考（ccusage / agentsview）

> 均 MIT，本地路径 `~/Documents/AI/github/{ccusage,agentsview}`。读懂 → TS 重写，PR 注明出处。

| 本 SPEC 需求 | 参考位置 | 参考什么 |
|--------------|----------|----------|
| R1 usage 兜底 | ccusage `src/types.rs:28-39` | usage 子字段可能部分缺失——zod schema 全部 `.default(0)`，与其 serde default 同构 |
| R4 定价三模式 | ccusage `src/cost.rs:9-37` | JSONL 自带 `costUSD` 字段不可靠/缺失的三态处理（display / auto / calculate）——v0.1 至少实现 auto 语义：有 costUSD 用之，无则按 token 计算 |
| R4 cache 计费 | ccusage `src/cost.rs:81-145` | cache_creation 分 `ephemeral_5m` / `ephemeral_1h`（1h = 2× input）、200k 阶梯价——我们 pricing.json schema 设计需预留这两个维度，否则金额对不上账单 |
| R4 模型 ID 归一化 | ccusage `src/pricing.rs:960-1024` + agentsview `internal/pricing/normalize.go` | `.`/`@` → `-` 归一化 + 子串匹配的数字边界保护（防 `sonnet-4` 误配 `sonnet-4-5`）——直接决定 pricing 别名解析正确性 |
| R4 定价来源 | 两者一致：LiteLLM `model_prices_and_context_window.json` + 内置 fallback | 印证 PRD Q3 决议（内置快照 + 远程更新）是同类工具共识；LiteLLM JSON 可作 update-pricing 的上游格式参考 |
| R5 节省口径 | agentsview `internal/db/session_stats.go:962-1042` | `dollarsNoCac − dollarsSpent` 的"反事实成本"算法——正是我们 CACHE HIT (achievable) 与节省金额的计算原型 |
| 归因口径一致性 | agentsview `internal/db/usage.go:171-175` | 所有统计共用同一条 eligibility 规则（排除 `<synthetic>` model 等），防各报表数字漂移——我们的 ReportModel 同理 |

**显式不参考**：ccusage 的定价 override 自动缩放（v0.1 用户覆盖直接全量替换，YAGNI）。

## 与 synrouter 的边界

不直接涉及 ⚡。残差波动信号是 D6（⚡ prefix stabilizer）的输入，但检测本身在 SPEC-AG-003+。
