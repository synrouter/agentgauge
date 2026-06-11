---
id: DESIGN-AG-XXX
spec: SPEC-AG-XXX
title: "<设计标题>"
status: draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# DESIGN-AG-XXX: <设计标题>

## 背景

<!-- 此设计要解决的问题、存在的约束条件、与 PRD 之间的关系 -->

## 设计决策

### D-AG-X.1: <决策标题>

**理由**: <为什么做出此选择>
**考虑的替代方案**: <评估了哪些其他方案>
**取舍**: <选择的代价>

### D-AG-X.2: <决策标题>

...

## 实现

<!-- 技术细节、ASCII 流程图、代码片段；agentgauge 是 TS/Node 项目，给 TS 示例 -->

```typescript
// 关键算法 / 数据流示例
```

## 文件

<!-- 实现此设计的关键源文件 -->

- `src/path/to/file1.ts`
- `src/path/to/file2.ts`

## 测试

- `tests/path/to/file1.test.ts`
- 黄金报告快照（如涉及 render 改动）: `tests/__snapshots__/...`

## 与 synrouter 的边界

<!-- 仅当本 SPEC 涉及 ⚡ 标记（导向 synrouter）时填写。 -->

<!-- 说明：本检测器输出哪些 finding 会标 ⚡，对应 synrouter 哪个 SPEC 的修复能力。
agentgauge 永远只测量、不改写。 -->
