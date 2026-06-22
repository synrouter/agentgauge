---
spec: SPEC-AG-007
updated: 2026-06-22
---

# SPEC-AG-007 任务列表

> 任务 ID 命名：`T-AG-007.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

- [x] T-AG-007.1: 补充 behavior fixture：重复 Read、工具失败、上下文增长、未知 tool input（R1/R3/R5/R7/R8）  _(2026-06-22)_
- [x] T-AG-007.2: 实现 `src/insights/tool-behavior.ts`，输出 per-tool calls/tokens/error/repeat/topTargets（R1）  _(2026-06-22)_
- [x] T-AG-007.3: 将 D1 loaded/used/idle evidence 提升为 `toolInventory`（R2）  _(2026-06-22)_
- [x] T-AG-007.4: 实现 `src/insights/turn-efficiency.ts` 与终端 sparkline 数据（R3）  _(2026-06-22)_
- [x] T-AG-007.5: 实现 `src/insights/suggestions.ts`，生成带 evidence/action/confidence 的建议卡片（R4）  _(2026-06-22)_
- [x] T-AG-007.6: 扩展 ReportModel、terminal、HTML、JSON；终端默认仍控制在 24 行内（R1-R4）  _(2026-06-22)_
- [x] T-AG-007.7: 实现 D6 tool failure loop 并接入检测器注册表（R5）  _(2026-06-22)_
- [x] T-AG-007.8: 实现 D8 read churn 与 D9 context growth（R7/R8）  _(2026-06-22)_
- [x] T-AG-007.9: 实现 D7 model mismatch，默认保守阈值与 info/low severity（R6）  _(2026-06-22)_
- [x] T-AG-007.10: 增加 insight 单测、detector 单测、render 黄金快照和 JSON 契约测试  _(2026-06-22)_

## 进行中

_（暂无）_

## 待完成

_（暂无）_

## 分阶段交付建议

- Phase 1: T-AG-007.1 到 T-AG-007.6，只做报告增强，不新增 D6-D9。
- Phase 2: T-AG-007.7 到 T-AG-007.10，新增 D6-D9 检测器。

## 验收

完成所有任务后需通过：

- [x] `pnpm test` 全绿  _(2026-06-22)_
- [x] `pnpm biome check .` 无新增告警  _(2026-06-22，本次 touched 文件全绿；全仓仍被既有 `.omc` / `.mcp.json` / `package.json` 格式问题阻塞)_
- [x] `pnpm tsc --noEmit` 无类型错误  _(2026-06-22)_
- [x] 关键函数已加 `@spec SPEC-AG-007, R<N>` 注解  _(2026-06-22)_
- [x] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）  _(2026-06-22)_
- [x] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射  _(2026-06-22)_
- [x] JSON schema_version 保持 1，新增字段为可选 additive 字段  _(2026-06-22)_
- [x] 默认报告不泄露完整路径、完整命令参数或 tool_result 原文  _(2026-06-22)_
