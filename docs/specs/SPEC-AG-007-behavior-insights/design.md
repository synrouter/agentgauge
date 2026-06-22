---
id: DESIGN-AG-007
spec: SPEC-AG-007
title: "Agent 行为洞察设计"
status: implemented
created: 2026-06-22
updated: 2026-06-22
---

# DESIGN-AG-007: Agent 行为洞察设计

## 背景

行为洞察消费 parser、attribution、detector 的既有输出，把日志中的 tool/turn 序列转成更接近行动的 profiler 信号。设计目标是低耦合：第一阶段只增加纯聚合函数和 ReportModel 字段，不改变 usage ground truth、不改变成本计算、不破坏 JSON schema_version。

## 设计决策

### D1: 新增 insights 聚合层，而不是把逻辑塞进 render

**理由**: Tool behavior、turn efficiency 和建议卡片会被 terminal、HTML、JSON 同时消费，放在 render 会导致三处漂移。
**考虑的替代方案**: 在 `render/model.ts` 内直接计算全部指标。
**取舍**: 多一个 `src/insights/` 目录；但纯函数更容易测试，也能被 D6-D9 复用。

### D2: 行为建议与 Finding 分层

**理由**: Finding 是金额化、可排序、可过滤的诊断项；行为建议可能只是 info 级行动提示。混在一起会稀释 savings 排序。
**考虑的替代方案**: 所有建议都做成 D 检测器。
**取舍**: 报告多一个小区块；终端只显示 top 3，HTML/JSON 展开完整列表。

### D3: 目标签名先脱敏再聚合展示

**理由**: Read/Grep/Bash 的重复目标需要用于聚合，但报告默认不能泄露完整路径、命令参数或 secret。
**考虑的替代方案**: 用完整路径聚合后渲染时脱敏。
**取舍**: 不同目录下同名文件可能合并；可用 hash 辅助区分，例如 `package.json#3f2a`。

### D4: D6-D9 复用 insight 输出

**理由**: D6 tool failure、D8 read churn、D9 context growth 都需要 R1-R3 的同一批中间指标。先沉淀聚合层，再写检测器，减少重复。
**考虑的替代方案**: 每个检测器独立扫描 session。
**取舍**: DetectorContext 需要可选挂载 `insights`；没有 insights 时检测器可自行跳过或按旧路径降级。

### D5: schema_version 1 下只增字段

**理由**: JSON 契约已经承诺 v0.x 内 schema_version 维持 1；本 SPEC 是增量能力，不应迫使 CI 用户升级解析器。
**考虑的替代方案**: schema_version 2。
**取舍**: 新字段必须可选，老消费者忽略即可。

## 实现

```typescript
// @spec SPEC-AG-007, R1
export interface ToolBehavior {
  tool: string;
  calls: number;
  totalTokens: number;
  avgOutputTokens: number;
  costUsd: number;
  errorCount: number;
  errorRate: number;
  repeatRate: number;
  largestResultTokens: number;
  topTargets: Array<{ label: string; calls: number; tokenShare: number }>;
  confidence: number;
  estimated?: boolean;
}

// @spec SPEC-AG-007, R3
export interface TurnEfficiency {
  turnIndex: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  inputOutputRatio: number | null;
  toolCallCount: number;
  contextTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  flags: Array<"edit" | "test" | "error" | "simple">;
}

// @spec SPEC-AG-007, R4
export interface BehaviorSuggestion {
  id: string;
  severity: "info" | "low" | "med" | "high";
  title: string;
  evidence: Record<string, unknown>;
  action: string;
  confidence: number;
  relatedFindingIds?: string[];
}

export interface BehaviorInsights {
  toolBehavior: ToolBehavior[];
  toolInventory?: {
    loaded: number;
    used: number;
    idle: number;
    estimated: boolean;
  };
  turnEfficiency: TurnEfficiency[];
  suggestions: BehaviorSuggestion[];
}

export function buildBehaviorInsights(input: {
  session: NormalizedSession;
  attribution: AttributionResult;
  findings: Finding[];
  includeContent: boolean;
}): BehaviorInsights;
```

数据流：

```text
NormalizedSession + Attribution + Findings
        │
        ▼
src/insights/*
        │
        ├─ ReportModel.behavior
        │    ├─ terminal: top 3 + sparkline
        │    ├─ HTML: tables + timeline + suggestions
        │    └─ JSON: optional additive fields
        │
        └─ DetectorContext.insights
             ├─ D6 tool failures
             ├─ D7 model mismatch
             ├─ D8 read churn
             └─ D9 context growth
```

## 文件

- `src/insights/tool-behavior.ts`
- `src/insights/turn-efficiency.ts`
- `src/insights/suggestions.ts`
- `src/insights/index.ts`
- `src/detectors/d6-tool-failures.ts`
- `src/detectors/d7-model-mismatch.ts`
- `src/detectors/d8-read-churn.ts`
- `src/detectors/d9-context-growth.ts`
- `src/render/model.ts`
- `src/render/terminal.ts`
- `src/render/html.ts`
- `src/render/json.ts`

## 测试

- `tests/insights/tool-behavior.test.ts`
- `tests/insights/turn-efficiency.test.ts`
- `tests/insights/suggestions.test.ts`
- `tests/detectors/d6-tool-failures.test.ts`
- `tests/detectors/d7-model-mismatch.test.ts`
- `tests/detectors/d8-read-churn.test.ts`
- `tests/detectors/d9-context-growth.test.ts`
- render 黄金快照：终端新增 behavior 摘要和 sparkline；HTML/JSON 新字段契约测试。

## 现有实现参考

| 本 SPEC 需求 | 参考位置 | 参考什么 |
|--------------|----------|----------|
| Read/Grep/Bash 工具目标解析 | agentsview `parser/claude.go` | Claude Code tool_use / tool_result 结构理解 |
| per-tool cost 汇总 | ccusage `adapter/claude/mod.rs` | 仅参考聚合口径，不复制实现 |
| D6-D9 检测器注册 | 当前 `src/detectors/index.ts` | 延续现有 Finding 框架和失败隔离 |

规则：参考实现只读懂数据形态和口径，TypeScript 重新实现；不逐行翻译。

## 与 synrouter 的边界

本 SPEC 大部分建议是手动优化，默认不标 ⚡。只有工具定义闲置、工具结果压缩、cache/prefix 相关建议复用 D0-D2 时才显示 ⚡ 并导向 synrouter。agentgauge 不自动修改 prompt、CLAUDE.md、MCP 配置、模型路由或请求体。
