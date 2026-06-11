---
id: DESIGN-AG-004
spec: SPEC-AG-004
title: "报告渲染设计"
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# DESIGN-AG-004: 报告渲染设计

## 背景

三个渲染器消费同一个 `ReportModel`（归因 + 成本 + findings 的视图模型），各自只做格式化。脱敏发生在 ReportModel 构建层，而非各渲染器——保证三种输出脱敏行为一致。

> 编号规则：设计决策用 `D1`、`D2`…（与 PRD 检测器编号无关）。

## 设计决策

### D1: 先构建 ReportModel，渲染器无业务逻辑

**理由**: 三种输出信息一致性（PRD：HTML 含终端全部信息）；脱敏只做一次；黄金快照只锁格式不锁计算
**考虑的替代方案**: 各渲染器直接吃 Attribution——脱敏逻辑三处重复，必然漂移
**取舍**: 多一层类型；值得

### D2: 脱敏在 ReportModel 构建期完成，`--include-content` 是构建参数

**理由**: 渲染器拿到的就是已脱敏数据，不可能"忘了脱敏"（安全默认）
**考虑的替代方案**: 渲染期脱敏——每个新渲染器都要重新记得这件事
**取舍**: debug 时看不到原文；`--include-content` + `--verbose` 组合覆盖

### D3: HTML 用模板字符串 + 内联 CSS，不引 React SSR

**理由**: PRD §7.2 已决；单文件 < 80KB 约束下模板字符串最可控
**考虑的替代方案**: React SSR——v0.1 杀鸡用牛刀（PRD 原话）
**取舍**: 模板可读性差；拆 section 级小函数缓解

### D4: stdout/stderr 严格分流 + 黄金快照测试

**理由**: PRD §5.12 契约（`> file` 时文件内容必须是纯结果）；快照锁 UX 是 PRD 质量门
**考虑的替代方案**: 无
**取舍**: 快照测试脆——约定快照 diff 必须出现在 PR 描述中供人工审查

## 实现

```typescript
// @prd FR-AG-5, FR-AG-6
export function buildReportModel(input: AnalysisResult, opts: { includeContent: boolean }): ReportModel;
export function renderTerminal(model: ReportModel, opts: TermOpts): string;  // → stdout
export function renderHtml(model: ReportModel): string;                       // 单文件
export function renderJson(model: ReportModel): string;                       // schema_version: 1
```

## 文件

- `src/render/model.ts`（ReportModel + 脱敏）
- `src/render/terminal.ts` / `src/render/html.ts` / `src/render/json.ts`

## 测试

- `tests/render/*.test.ts` + `tests/__snapshots__/`（终端 / HTML 黄金快照）
- JSON 契约测试（zod 自校验 + 字段只增不删断言）
- 脱敏测试：默认输出 grep 不到敏感占位串

## 与 synrouter 的边界

HTML 三处 CTA + 终端 ⚡ 行导向 synrouter.ai/connect；文案保持"工具气质"（PRD §9.3：不出现营销词）。
