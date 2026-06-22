---
id: SPEC-AG-007
title: "Agent 行为洞察与可执行建议"
status: implemented
created: 2026-06-22
updated: 2026-06-22
tags: [insights, detectors, render, v0.1.x, P1]
relates: [SPEC-AG-001, SPEC-AG-002, SPEC-AG-003, SPEC-AG-004]
---

# SPEC-AG-007: Agent 行为洞察与可执行建议

## 背景

v0.1 已经能从日志中回答"花了多少、花在哪、哪里能省"，但用户优化自身 agent 调用时，需要更接近行动的答案：哪些工具调用模式导致浪费、哪几轮上下文开始失控、哪些行为应该写进 CLAUDE.md 或工具策略里约束。

本 SPEC 实现 PRD §FR-AG-13。目标是把 agentgauge 从账单诊断推进到 **agent session profiler**：继续保持本地、只读、零上传，只从已有 session 日志和 attribution 结果中提炼行为画像与建议。

## 数据依赖与可行性验证（必填）

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| tool_use name/input | SPEC-AG-001 normalized assistant content | log | ✅ 已由 SPEC-AG-003 D1 使用；字段存在 |
| tool_result content / isError | SPEC-AG-001 normalized user/tool result content | log | ✅ 已由 D0/D3/D4 使用；错误形态需在实现前用 examples 补 fixture |
| per-tool token / cost | SPEC-AG-002 attribution | log | ✅ 当前 README/实现基线已有 per-tool 排序 |
| per-turn usage | SPEC-AG-001 + SPEC-AG-002 turn attribution | log | ✅ D2 已消费轮间 usage 序列 |
| loaded tool count | SPEC-AG-006 agent profile / D1 evidence | log estimated / proxy exact | ✅ D1 已有估算路径；proxy 模式未来精确 |
| model id | SPEC-AG-001 session/turn metadata | log | ✅ FR-AG-2/成本计算已依赖 model |
| 文件路径/命令参数 | tool_use input | log | ⚠ 需脱敏和结构化 best-effort；解析失败时降级为 unknown |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…；跨文档全称引用写 `SPEC-AG-007, R<N>`。

### R1: Tool behavior 聚合

**优先级**: P0
**状态**: implemented

从 tool_use + tool_result + attribution 聚合每个工具的行为画像：

- `calls`：调用次数
- `total_tokens` / `avg_output_tokens` / `cost_usd`
- `error_count` / `error_rate`
- `repeat_rate`：同一结构化目标重复调用比例，例如同一文件 Read、多次相同 Grep 查询
- `largest_result_tokens`
- `estimated` / `confidence`：当目标解析或 token 归因不完整时标注

验收：

- 对包含 Read/Grep/Bash/Edit 的 fixture，输出稳定排序：默认按 `cost_usd` 降序。
- 对无法解析 tool input 的记录不抛错，归入 `target: "unknown"`。
- 默认输出不包含完整文件路径；只展示 basename 或 hash。

### R2: Loaded vs used 工具比值展示

**优先级**: P0
**状态**: implemented

复用 D1 的 loaded/used/idle evidence，把"已注册工具数 vs 实际使用数"提升为一等指标：

- 终端报告在 findings 或 behavior 摘要中展示 `Tools used 4/18`。
- HTML 报告列出 idle tools，但默认不展示敏感 MCP server 路径。
- JSON 输出 `tool_inventory = {loaded, used, idle, estimated}`。

验收：

- log 模式下该指标必须带 `estimated: true`，proxy 模式未来可去掉。
- D1 未启用或 agent profile 不支持 loaded 工具清单时，字段可缺省，但报告不能出现 `NaN` / `undefined`。

### R3: Turn efficiency 序列

**优先级**: P0
**状态**: implemented

为每轮构建轻量效率指标：

- `input_tokens` / `output_tokens` / `cost_usd`
- `input_output_ratio`
- `tool_call_count`
- `has_edit` / `has_test_command` / `has_error`
- `context_tokens`：history + tool_results 的近似上下文负载
- `cache_read_tokens` / `cache_write_tokens`

报告层：

- 终端展示一行 input tokens sparkline，标记最高成本 turn。
- HTML 展示 turn timeline，允许 finding evidence 链接到 turn 编号。
- JSON 输出 `turn_efficiency[]`，同 schema_version 下只增字段。

验收：

- 空 session / 单 turn session 不抛错，sparkline 降级为单点或省略。
- sparkline 不使用颜色表达唯一语义；NO_COLOR 下仍可读。

### R4: 行为建议卡片

**优先级**: P1
**状态**: implemented

把 R1-R3 的异常项转成可执行建议，不替代 finding：

- 重复读取同一文件：建议在 CLAUDE.md 固化稳定事实或让 agent 先查看缓存摘要。
- Bash/test 失败率高：建议记录正确测试命令、环境变量或权限前置条件。
- 上下文增长快：建议提前 compact 或限制大输出工具。
- 工具定义闲置高：建议禁用未用 MCP 工具或使用 synrouter 动态裁剪（⚡）。

验收：

- 建议必须包含 evidence 数字和 action，不输出泛泛建议。
- confidence < 0.5 的建议只进入 HTML/JSON，不进终端默认 top 3。
- 不生成自动修改 prompt/配置的命令；agentgauge 只测量。

### R5: D6 tool failure loop

**优先级**: P1
**状态**: implemented

检测工具失败造成的重试浪费：

- tool_result 显式 error、Bash 非零退出、或输出中含常见错误前缀时计为失败。
- 同一工具/目标在短窗口内失败 ≥ 2 次，产生 finding。
- 浪费金额按失败 tool_result tokens + 后续重试输入成本保守估算。

验收：

- 对无错误 fixture 零误报。
- 对损坏或缺失 exit code 的日志降级为文本启发式，不抛错。

### R6: D7 model mismatch

**优先级**: P2
**状态**: implemented

识别简单轮次使用高价模型的情况：

- 纯文件列表、短 Bash、无编辑、低 output 的轮次被判为 simple turn。
- simple turn 使用 Opus / 高价模型且成本超过阈值时输出 info/low finding。
- 本检测器默认保守，不声称一定可降级，只给模型策略审计信号。

验收：

- 阈值集中定义，测试覆盖 Opus/Sonnet/Haiku 价格别名。
- 未知模型只跳过，不报错。

### R7: D8 read churn

**优先级**: P1
**状态**: implemented

检测同一目标被重复读取或搜索：

- Read 同一 basename/path hash ≥ 3 次。
- Grep/Glob/Bash 搜索同一 query signature ≥ 3 次。
- 与 D3 区分：D8 看调用意图重复，D3 看结果内容重复。

验收：

- 路径默认脱敏后再进入 evidence。
- 对合理重复（编辑前后各读一次）不报，阈值从 ≥ 3 起。

### R8: D9 context growth

**优先级**: P1
**状态**: implemented

检测上下文增长斜率异常，定位 compact 建议点：

- 用 turn efficiency 的 `context_tokens` 序列计算增长斜率。
- 连续 N 轮高增长且 assistant output / edit action 很少时，认为上下文低效膨胀。
- 输出建议 turn 区间，例如"turn 12-16 context grew 44%, consider compact before turn 17"。

验收：

- 单 turn 或短 session 不报。
- 与 D5 可压缩历史互补：D5 看旧内容是否仍被引用，D9 看增长速度和拐点。

## 成功标准

- 第一阶段（R1-R4）不改变 parser/attribution 主数据流，只扩展 ReportModel 和 render。
- 终端报告仍不超过 24 行；默认新增内容最多 4 行。
- HTML/JSON 完整输出 tool behavior、turn efficiency、建议卡片。
- D6-D9 单个检测器失败不影响其他 finding；符合 SPEC-AG-003 永不 crash 约束。
- examples fixture 覆盖：正常 session、重复 Read、工具失败、上下文增长、未知 tool input。

## 非目标

- 不做跨 session 趋势；仍归 PRD FR-AG-9 / v0.2。
- 不做 watch/TUI；仍归 PRD FR-AG-11 / v0.3。
- 不做 secret 扫描；隐私扫描另立 SPEC，避免和行为洞察混杂。
- 不修改用户 CLAUDE.md、MCP 配置或模型配置。
- 不引入网络请求或遥测。

## 相关文档

- 设计文档: `design.md`
- 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md` §FR-AG-13 / §8 / §9
- 依赖: SPEC-AG-001、SPEC-AG-002、SPEC-AG-003、SPEC-AG-004
