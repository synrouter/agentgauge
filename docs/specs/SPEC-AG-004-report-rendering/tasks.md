---
spec: SPEC-AG-004
updated: 2026-06-11
---

# SPEC-AG-004 任务列表

> 任务 ID 命名：`T-AG-004.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

_（暂无）_

## 进行中

_（暂无）_

## 待完成

- [ ] T-AG-004.1: ReportModel + 构建期脱敏（R4）
- [ ] T-AG-004.2: 终端渲染器 + `~` 估算标记 + quiet/top-n（R1）
- [ ] T-AG-004.3: HTML 渲染器（< 80KB、三处 CTA、证据展开）（R2）
- [ ] T-AG-004.4: JSON 渲染器 + zod 契约（R3）
- [ ] T-AG-004.5: 黄金快照测试三件套 + JSON 契约测试
- [ ] T-AG-004.6: 脱敏断言测试（默认无原文 / 无完整路径）

## 验收

完成所有任务后需通过：

- [ ] `pnpm test` 全绿
- [ ] `pnpm biome check .` 无新增告警
- [ ] `pnpm tsc --noEmit` 无类型错误
- [ ] 关键函数已加 `@spec SPEC-AG-004, R<N>` 注解
- [ ] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）
- [ ] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射
- [ ] 如涉及 CLI 接口变化，PRD §5 已同步更新
