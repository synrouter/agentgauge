---
spec: SPEC-AG-001
updated: 2026-06-11
---

# SPEC-AG-001 任务列表

> 任务 ID 命名：`T-AG-001.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

_（暂无）_

## 进行中

_（暂无）_

## 待完成

- [ ] T-AG-001.1: 制作 `examples/` fixture（正常 ×2、sidechain ×1、损坏 ×3，全部脱敏）
- [ ] T-AG-001.2: `parsers/types.ts` 归一化类型 + tool_use_id 索引
- [ ] T-AG-001.3: `lib/glob.ts` session 文件发现（含 env 覆盖）
- [ ] T-AG-001.4: `parsers/claude-code.ts` 流式解析 + 容错
- [ ] T-AG-001.5: 记录去重 + chunk 合并 + AgentProgress 解包（R4；参考 ccusage mod.rs:223-330 / agentsview claude.go:257-605，TS 重写）
- [ ] T-AG-001.6: 时间窗口 / 项目过滤（mtime 粗筛 + timestamp 精筛）（R5）
- [ ] T-AG-001.7: fuzz 测试（损坏 fixture 零 crash）+ 去重 fixture 测试 + 性能基准（1s / 5s 验收）

## 验收

完成所有任务后需通过：

- [ ] `pnpm test` 全绿
- [ ] `pnpm biome check .` 无新增告警
- [ ] `pnpm tsc --noEmit` 无类型错误
- [ ] 关键函数已加 `@spec SPEC-AG-001, R<N>` 注解
- [ ] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）
- [ ] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射
- [ ] 如涉及 CLI 接口变化，PRD §5 已同步更新
