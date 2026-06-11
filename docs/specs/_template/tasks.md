---
spec: SPEC-AG-XXX
updated: YYYY-MM-DD
---

# SPEC-AG-XXX 任务列表

> 任务 ID 命名：`T-AG-XXX.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

- [x] T-AG-XXX.1: <任务描述>  _（YYYY-MM-DD）_

## 进行中

- [ ] T-AG-XXX.2: <任务描述>

## 待完成

- [ ] T-AG-XXX.3: <任务描述>
- [ ] T-AG-XXX.4: <任务描述>

## 验收

完成所有任务后需通过：

- [ ] `pnpm test` 全绿
- [ ] `pnpm biome check .` 无新增告警
- [ ] `pnpm tsc --noEmit` 无类型错误
- [ ] 关键函数已加 `@spec SPEC-AG-XXX, R<N>` 注解
- [ ] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）
- [ ] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射
- [ ] 如涉及 CLI 接口变化，PRD §5 已同步更新
