---
id: DESIGN-AG-005
spec: SPEC-AG-005
title: "CLI 接口实现设计"
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# DESIGN-AG-005: CLI 接口实现设计

## 背景

cli.ts 是纯编排层：解析参数 → 调 parsers → attribution → detectors → render → 退出码。所有业务在上游 SPEC，本层做到"薄"。

> 编号规则：设计决策用 `D1`、`D2`…。

## 设计决策

### D1: 时间窗口语法定为 `--last [duration]`，废弃 `--last-Nd` 动态 flag 名

**理由**: citty（及一切主流 CLI 框架）无法声明 flag 名中含变量的 `--last-7d`；`--last`（无值 = 最近一次 session）+ `--last 7d`（带值 = 时间窗）一个 flag 覆盖两个语义
**考虑的替代方案**: 枚举注册 `--last-1d` ~ `--last-30d`——荒谬；`--window 7d`——多一个概念
**取舍**: 与 PRD §5.4.1 现文字不一致 → **本决策需回写 PRD §5.4.1**（T-AG-005.1，走 docs/AGENTS.md 同步清单）

### D2: 子命令各自一个 `commands/<name>.ts`，cli.ts 只做注册

**理由**: citty 子命令模型天然支持；每文件 < 200 行（仓库规约）
**考虑的替代方案**: 单文件 cli.ts——v0.2 加 proxy/watch 后必然超 800 行上限
**取舍**: 无

### D3: `update-pricing` 默认从 LiteLLM 拉取价格快照

**理由**: LiteLLM 已经聚合了各模型的最新计费信息；把它作为默认源可以减少手工维护成本，用户也能直接刷新本地缓存
**考虑的替代方案**: 只保留内置快照——会很快过期；只允许自定义 URL——默认体验太差
**取舍**: 默认命中网络，故只把网络放在显式命令里

### D4: 退出码集中在 `lib/exit.ts` 常量 + 类型化错误

**理由**: PRD §5.11 是契约；散落的 `process.exit(1)` 无法测试
**考虑的替代方案**: 无
**取舍**: 无

## 实现

```typescript
// @prd FR-AG-1, §5
const main = defineCommand({
  subCommands: { analyze, sessions, doctor, 'update-pricing': updatePricing },
  // 无子命令 → analyze --last
});
```

## 文件

- `src/cli.ts`（注册 + 全局选项）
- `src/cli/commands/{analyze,sessions,doctor,update-pricing}.ts`
- `src/lib/exit.ts` / `src/lib/log.ts`（stderr 分流）

## 测试

- `tests/cli/*.test.ts` — 子进程级：退出码、stdout 纯净性、PRD §5.4.4 示例回归
- `update-pricing` 默认抓取 LiteLLM；可用 `--url` / `AGENTGAUGE_PRICING_URL` 覆盖

## 与 synrouter 的边界

终端报告底部一行 `An open-source funnel for synrouter.ai`（PRD §14，轻量不隐瞒）；CLI 本身无任何 synrouter 网络交互。
