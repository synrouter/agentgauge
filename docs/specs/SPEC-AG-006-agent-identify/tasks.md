---
spec: SPEC-AG-006
updated: 2026-06-11
---

# SPEC-AG-006 任务列表

> 任务 ID 命名：`T-AG-006.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

_（暂无）_

## 进行中

_（暂无）_

## 待完成

- [x] T-AG-006.1: AgentIdentity 类型 + matcher 链框架（R1）  _(2026-06-11)_
- [x] T-AG-006.2: claude-code 完整 profile（含 builtinTools 实测尺寸快照 + quirks 注释）（R2）  _(2026-06-11)_
- [x] T-AG-006.3: 其余 15 agent 占位条目（R2）  _(2026-06-11)_
- [x] T-AG-006.4: 工具签名 Jaccard 匹配（R3）  _(2026-06-11)_
- [x] T-AG-006.5: 识别测试 + D1 消费契约测试  _(2026-06-11)_

## 验收

完成所有任务后需通过：

- [x] `pnpm test` 全绿  _(2026-06-11)_
- [x] `pnpm biome check .` 无新增告警  _(2026-06-11)_
- [x] `pnpm tsc --noEmit` 无类型错误  _(2026-06-11)_
- [x] 关键函数已加 `@spec SPEC-AG-006, R<N>` 注解  _(2026-06-11)_
- [x] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）  _(2026-06-11)_
- [x] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射  _(2026-06-11)_
- [x] 如涉及 CLI 接口变化，PRD §5 已同步更新  _(2026-06-11)_
