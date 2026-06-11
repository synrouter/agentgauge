---
spec: SPEC-AG-002
updated: 2026-06-11
---

# SPEC-AG-002 任务列表

> 任务 ID 命名：`T-AG-002.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

_（暂无）_

## 进行中

_（暂无）_

## 待完成

- [ ] T-AG-002.1: `assets/pricing.json` 初始快照 + zod schema（`attribution/pricing.ts`）
- [ ] T-AG-002.2: 可测段 tiktoken 计数 + usage 等比缩放（R1）
- [ ] T-AG-002.3: 残差法稳定前缀估算 + 中位数平滑（R2）
- [ ] T-AG-002.4: sidechain 分桶聚合（R3）
- [ ] T-AG-002.5: 成本计算 + 缓存折扣等比分摊（R4，`attribution/cost.ts`）
- [ ] T-AG-002.6: 双口径节省原语（R5）
- [ ] T-AG-002.7: 恒等式属性测试 + 配平测试

## 验收

完成所有任务后需通过：

- [ ] `pnpm test` 全绿
- [ ] `pnpm biome check .` 无新增告警
- [ ] `pnpm tsc --noEmit` 无类型错误
- [ ] 关键函数已加 `@spec SPEC-AG-002, R<N>` 注解
- [ ] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）
- [ ] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射
- [ ] 如涉及 CLI 接口变化，PRD §5 已同步更新
