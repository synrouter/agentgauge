---
spec: SPEC-AG-005
updated: 2026-06-11
---

# SPEC-AG-005 任务列表

> 任务 ID 命名：`T-AG-005.N`。完成后保留勾选项与日期，方便回顾追溯。

## 已完成

_（暂无）_

## 进行中

_（暂无）_

## 待完成

- [ ] T-AG-005.1: 把 `--last [duration]` 语法决议回写 PRD §5.4.1（设计决策 D1；走 AGENTS.md 同步清单）
- [ ] T-AG-005.2: citty 脚手架 + 全局选项 + 帮助文本（R1）
- [ ] T-AG-005.3: analyze 编排（选择器 / 输出 / 检测器开关 / 互斥规则）（R2）
- [ ] T-AG-005.4: 退出码常量 + stdout/stderr 分流 + 子进程测试（R3）
- [ ] T-AG-005.5: doctor + update-pricing（R4）
- [ ] T-AG-005.6: sessions 子命令（R5）
- [ ] T-AG-005.7: 零网络静态断言进 CI

## 验收

完成所有任务后需通过：

- [ ] `pnpm test` 全绿
- [ ] `pnpm biome check .` 无新增告警
- [ ] `pnpm tsc --noEmit` 无类型错误
- [ ] 关键函数已加 `@spec SPEC-AG-005, R<N>` 注解
- [ ] 如涉及 render 改动，黄金快照已审查并更新（`tests/__snapshots__/`）
- [ ] `docs/INDEX.md` 已更新 SPEC 状态与 FR ↔ SPEC ↔ 文件映射
- [ ] 如涉及 CLI 接口变化，PRD §5 已同步更新
