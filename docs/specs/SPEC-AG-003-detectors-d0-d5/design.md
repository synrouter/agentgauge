---
id: DESIGN-AG-003
spec: SPEC-AG-003
title: "检测器框架与 D0–D5 设计"
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# DESIGN-AG-003: 检测器框架与 D0–D5 设计

## 背景

检测器是纯消费方：输入 SPEC-AG-001/002 的产物，输出 Finding[]。设计目标：单检测器故障隔离、阈值集中可调、估算/精确双路径接口统一。

> 编号规则：设计决策用 `D1`、`D2`…（指设计决策；正文中 "检测器 D0-D5" 指 PRD 编号，注意区分）。

## 设计决策

### D1: 注册表 + 纯函数检测器，故障隔离

**理由**: "永不抛异常"承诺；单检测器对畸形输入失败不应毁掉整份报告
**考虑的替代方案**: class 继承体系——对 6 个无状态函数过度设计（YAGNI）
**取舍**: 跨检测器共享中间结果（如 tool_result 哈希表）需显式传参；用一个共享的 `DetectorContext` 预计算层解决

### D2: 阈值全部收进 `thresholds.ts` 常量模块

**理由**: PRD 明示阈值（10K/20K tokens、20%、$0.50…）会被社区质疑与调参；散在各文件 = 改不动
**考虑的替代方案**: CLI 暴露全部阈值 flag——v0.1 过度配置化
**取舍**: 无；D4 阈值常量参考 synrouter tool_trim 的取值（仅参考，不复制命名）

### D3: 估算/精确双路径用同一检测器接口，`mode` 参数区分

**理由**: v0.2 proxy 上线时 D1/D2 升级为精确，不应换接口；finding 的 `estimated` 标志由 mode 决定
**考虑的替代方案**: log/proxy 两套检测器——重复代码
**取舍**: v0.1 各检测器带一个暂时只有一个取值的参数；可接受

### D4: D0 噪声管道按"检测阶段数组"组织

**理由**: RTK 的噪声估算是多阶段管道（ANSI → 进度条 → 重复行 → 空白）；阶段数组便于独立测试与后续加阶段
**考虑的替代方案**: 单个大正则——不可测试、不可解释（HTML 要展示"哪类噪声占多少"）
**取舍**: 每阶段独立 token 计数有重叠风险；按"先到先得"顺序去重

## 实现

```typescript
// @prd FR-AG-4 — noise detection adapted from RTK (https://github.com/rtk-ai/rtk, MIT)
export const d0Noise: Detector = (ctx) => { /* 阶段管道 */ };

export function runDetectors(ctx: DetectorContext, opts: DetectorOpts): Finding[] {
  // 注册表过滤 → 逐个 try/catch → savings 降序
}
```

## 文件

- `src/detectors/index.ts`（注册表 + Finding 类型 + DetectorContext）
- `src/detectors/thresholds.ts`
- `src/detectors/d0-noise.ts` … `d5-compactable.ts`

## 测试

- `tests/detectors/*.test.ts` — 每检测器：阳性 fixture 检出 + 干净 fixture 零误报 + 畸形输入不抛
- 故障隔离测试（R1 验收）

## 现有实现参考（agentsview）

> MIT，本地路径 `~/Documents/AI/github/agentsview`。读懂 → TS 重写。

| 本 SPEC 需求 | 参考位置 | 参考什么 |
|--------------|----------|----------|
| D5 可压缩历史 | agentsview `internal/parser/claude.go:536-549, 1293-1306` | `isCompactSummary` 条目即 Claude Code 已发生的 compact 边界——D5 报"可压缩"前先识别已 compact 过的段，避免对已压缩历史重复报告（误报源） |
| 误报防御（全检测器） | agentsview `internal/parser/claude.go:1749-1766` | 系统注入消息分类（continuation / resume / interrupted / stop_hook 等）——这些不是真实 user 输入，D5 的"引用"判定与 D3 的重复统计都应排除，否则统计被污染 |
| 误报防御（session 级） | agentsview `internal/parser/claude.go:1687-1706` | usage probe 会话检测（唯一用户消息是 `/usage`）——此类空会话应整体跳过分析 |

> 注：系统消息分类与 probe 检测的**实现落点在 SPEC-AG-001 解析层**（消息打标），本 SPEC 只消费标记。D0 噪声管道无现成参考（RTK 是唯一先例，已在 R2 注明）。

## 与 synrouter 的边界

⚡ 标记项：D0（L0 压缩，SPEC-009）、D1（动态裁剪）、D2（cache_control 注入，SPEC-002）。agentgauge 只输出 finding 与 fix_url，永不改写请求。
