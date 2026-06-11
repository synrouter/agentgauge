---
spec: SPEC-AG-003
updated: 2026-06-11
---

# SPEC-AG-003 任务列表

> 任务 ID 命名：`T-AG-003.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

_（暂无）_

## 进行中

_（暂无）_

## 待完成

- [ ] T-AG-003.1: Finding 类型 + 注册表 + DetectorContext + 故障隔离（R1）
- [ ] T-AG-003.2: `thresholds.ts` 阈值常量
- [ ] T-AG-003.3: D0 噪声管道（ANSI / 进度条 / 重复行 / 空白）+ RTK 文件头致谢（R2）
- [ ] T-AG-003.4: D1 log 估算路径（依赖 SPEC-AG-006 工具清单）（R3）
- [ ] T-AG-003.5: D2 usage 信号断裂检测（R4）
- [ ] T-AG-003.6: D3 / D4 / D5（R5）
- [ ] T-AG-003.7: 阳性 + 零误报 + 故障隔离测试全套

## 验收

完成所有任务后需通过：

- [ ] `pnpm test` 全绿
- [ ] `pnpm biome check .` 无新增告警
- [ ] `pnpm tsc --noEmit` 无类型错误
- [ ] 关键函数已加 `@spec SPEC-AG-003, R<N>` 注解
- [ ] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）
- [ ] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射
- [ ] 如涉及 CLI 接口变化，PRD §5 已同步更新
- [ ] `d0-noise.ts` 文件头 RTK 致谢在位（PRD §14 强制）
