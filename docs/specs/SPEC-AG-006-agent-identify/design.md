---
id: DESIGN-AG-006
spec: SPEC-AG-006
title: "Agent 三层指纹识别设计"
status: implemented
created: 2026-06-11
updated: 2026-06-11
---

# DESIGN-AG-006: Agent 三层指纹识别设计

## 背景

v0.1 识别近乎平凡（路径即答案），本 SPEC 的真正产出是**接口与指纹库的形状**：让 v0.2 多 agent / proxy 模式扩展时零接口变更，且 D1 检测器今天就能消费内置工具清单。

> 编号规则：设计决策用 `D1`、`D2`…。

## 设计决策

### D1: 三层信号实现为有序 matcher 数组，取首个超过下限的结果

**理由**: PRD 定义的就是优先级降级模型；数组追加即扩展（v0.2 加 header matcher 不动框架）
**考虑的替代方案**: 加权融合打分——三层信号质量差异悬殊，融合反而引入误判且难解释（confidence 要展示给用户）
**取舍**: 信号互证（路径+签名同时命中）不提升 confidence；v0.1 可接受

### D2: 指纹库是纯数据模块（const 数组），不是插件系统

**理由**: 16 条静态记录；YAGNI——社区贡献新 agent = 提 PR 改数据 + 加 fixture
**考虑的替代方案**: 运行时加载外部 profile JSON——多一个攻击面与校验负担，violates 简洁优先
**取舍**: 新增 agent 需发版；与"parsers 接受 PR"的维护模型一致（PRD §11.4）

### D3: builtinTools 的 schema token 尺寸用"实测快照常量"而非运行时计算

**理由**: D1 在 log 模式下拿不到 tools 原文，只能用预存尺寸估算；尺寸随 Claude Code 版本变化 → 记录 `measuredAt` 版本号
**考虑的替代方案**: 不提供尺寸，D1 报"个数"不报金额——金额化是产品核心钩子，不可退
**取舍**: 尺寸会过时；指纹库随版本更新（维护成本已在 PRD §11.4 对策内）

## 实现

```typescript
// @prd FR-AG-12
export function identify(session: Session): AgentIdentity {
  for (const m of MATCHERS) { const r = m(session); if (r && r.confidence >= m.floor) return r; }
  return { agent: 'unknown', confidence: 0 };
}
```

## 文件

- `src/identify/profiles.ts`（指纹数据 + quirks 注释，参考 synrouter agent_registry 重写）
- `src/identify/index.ts`（matcher 链）

## 测试

- `tests/identify/identify.test.ts` — 路径命中 / 路径失效降级签名 / 全失效 → unknown
- D1 消费契约：profile 提供 claude-code 工具清单的形状断言

## 现有实现参考（agentsview）

> MIT，本地路径 `~/Documents/AI/github/agentsview`。

| 本 SPEC 需求 | 参考位置 | 参考什么 |
|--------------|----------|----------|
| R2 指纹库形状 | agentsview `internal/parser/types.go:46-305` | 25 agent 的 registry（`DefaultDirs` + 发现函数指针的纯数据表）——佐证设计决策 D2（纯数据模块而非插件系统）是同类工具的成熟做法；其 25 agent 的路径清单是填充我们 16 agent profile `sourceGlobs` 的现成素材 |

## 与 synrouter 的边界

不涉及 ⚡。算法参考 synrouter `session_fingerprint.py` / `agent_registry.py`，全部 TypeScript 重写、中性命名（仓库规约红线）。
