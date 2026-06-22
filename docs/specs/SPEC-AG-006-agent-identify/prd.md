---
id: SPEC-AG-006
title: "Agent 识别（三层指纹）"
status: implemented
created: 2026-06-11
updated: 2026-06-11
tags: [identify, v0.1, P0]
relates: [SPEC-AG-001, SPEC-AG-003]
---

# SPEC-AG-006: Agent 识别（三层指纹）

## 背景

实现 PRD §FR-AG-12（Agent 识别）。核心三件套中的 **identify** 能力。v0.1 log 模式下第 1 层（数据源路径）即可定型，但接口（`agent` + `agent_confidence`）从 v0.1 锁进 JSON schema；指纹库同时为 D1 检测器提供"agent 内置工具清单"。算法参考 synrouter session_fingerprint / agent_registry，TypeScript 重写，不复制内部命名。

## 数据依赖与可行性验证（必填）

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| session 来源目录 | SPEC-AG-001 发现层 | log | ✅ `~/.claude/projects` 即第 1 层信号 |
| tool_use 工具名集合 | 归一化 Turn | log | ✅ 2026-06-11 实测存在（第 2 层签名） |
| 请求 header / system 原文 | 请求体 | **proxy only** | ⚠ 第 1 层 header 变体与第 3 层提示词特征 v0.2 才可用 |
| 16 agent 指纹数据 | synrouter agent_registry（算法参考） | — | 需逐 agent 提炼重写；v0.1 只需 claude-code 一条完整，其余占位 |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…；跨文档全称引用写 `SPEC-AG-006, R<N>`。

### R1: 识别接口与 confidence 模型

**优先级**: P0
**状态**: proposed

- `identify(session) → { agent, version?, confidence }`；三层信号按 PRD FR-AG-12 优先级降级（路径 ≥ 0.95 / 工具签名 0.7–0.95 / 提示词 0.4–0.7）
- confidence < 0.4 → `unknown`，归因走通用路径、不出 agent 特定结论
- 验收：claude-code fixture → `{agent: 'claude-code', confidence ≥ 0.95}`；伪造目录的非 claude-code 内容 → 降级到第 2 层

### R2: 指纹库 profiles.ts

**优先级**: P0
**状态**: proposed

- 每条 profile：`{ agent, sourceGlobs, toolSignature, builtinTools（名称+典型 schema token 尺寸，D1 用）, quirks 注释 }`
- v0.1：claude-code 完整；其余 15 个 agent 占位条目（v0.2 填充）
- 验收：D1（SPEC-AG-003, R3）能从 profile 取到 claude-code 内置工具清单与尺寸

### R3: 工具签名匹配（第 2 层）

**优先级**: P1
**状态**: proposed

- session 内 tool_use 名称集合与 profile.toolSignature 的 Jaccard 相似度 → confidence 映射
- 验收：去掉路径信号后，claude-code fixture 仍以 ≥ 0.7 识别

## 成功标准

- JSON 输出的 `agent` / `agent_confidence` 字段从 v0.1 起稳定（schema 契约）
- 识别耗时 < 10ms / session

## 非目标

- 第 3 层提示词特征匹配（依赖 proxy / `--include-content`，v0.2）
- 16 agent 全量指纹填充（v0.2 多 agent 支持时随各 parser 落地）

## 相关文档

- 设计文档: `design.md` ｜ 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md` §FR-AG-12
- 依赖: SPEC-AG-001；被依赖: SPEC-AG-003（D1）
