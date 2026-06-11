---
id: SPEC-AG-001
title: "Claude Code Session 解析器"
status: draft
created: 2026-06-11
updated: 2026-06-11
tags: [parser, v0.1, P0]
relates: [SPEC-AG-002, SPEC-AG-006]
---

# SPEC-AG-001: Claude Code Session 解析器

## 背景

实现 PRD §FR-AG-1（Claude Code Session 解析）。一切归因、检测、报告都建立在解析层之上：发现 `~/.claude/projects/**/*.jsonl`，流式解析为归一化的 Session / Turn / Message 对象。解析层是项目"永不抛异常"承诺的第一道防线——必须能消化 fuzzer 级别的损坏输入。

## 数据依赖与可行性验证（必填）

| 依赖数据 | 来源 | 可得性 | 验证结论 |
|----------|------|--------|----------|
| session JSONL 文件 | `~/.claude/projects/<project-dir>/<uuid>.jsonl` | log | ✅ 2026-06-11 本机实测存在 |
| 记录类型 `type` | 每行 JSON | log | ✅ 2026-06-11 实测枚举：`assistant` / `user` / `system` / `attachment` / `file-history-snapshot` / `last-prompt` / `mode` / `permission-mode`（后五类与归因无关，跳过） |
| `message.usage` | assistant 记录 | log | ✅ 2026-06-11 实测含 `input_tokens` / `output_tokens` / `cache_read_input_tokens` / `cache_creation_input_tokens` 等 |
| `isSidechain` | 顶层字段 | log | ✅ 2026-06-11 实测存在，标记 Task 派生子轮次 |
| `system` 字段 / `tools` 数组 | — | **proxy only** | ⚠ 2026-06-11 实测 JSONL 中**不存在**——归因层必须走残差法（见 PRD FR-AG-2） |
| 其他可用顶层字段 | `timestamp` / `sessionId` / `cwd` / `gitBranch` / `parentUuid` / `uuid` / `version` 等 | log | ✅ 2026-06-11 实测存在 |
| 重复计费记录 | 同一 assistant message 多次落盘（streaming 累积快照同 `message.id`；sidechain replay 换 `requestId`） | log | ✅ 2026-06-11 经 ccusage / agentsview 源码交叉证实（两者均实现去重）；本机 fixture 待复核 |
| AgentProgress 包装格式 | `{"data":{"message":{...}}}` 嵌套变体 | log | ⚠ 经 ccusage 源码证实存在（daily.rs:142-158），本机 fixture 待复核 |

## 需求

> 编号规则：SPEC 内需求用 `R1`、`R2`…；跨文档全称引用写 `SPEC-AG-001, R<N>`。

### R1: Session 文件自动发现

**优先级**: P0
**状态**: proposed

- fast-glob 扫描 `~/.claude/projects/**/*.jsonl`；根目录可被 `AGENTGAUGE_CLAUDE_PROJECTS` 覆盖
- macOS / Linux / WSL 路径均可定位；目录不存在时返回空列表（不抛错，由 doctor 给修复建议）
- 验收：1000 个 session 文件全量扫描（仅 stat，不解析）< 1s

### R2: 容错的流式 JSONL 解析

**优先级**: P0
**状态**: proposed

- 逐行流式读取（`readline` / Web Streams），不整文件载入内存
- 畸形行（截断 JSON、非 JSON、空行）跳过并 debug 日志计数，**永不 crash**
- 未知 `type` 的记录静默跳过（前向兼容 Claude Code 新版本字段）
- 验收：对人工损坏的 fixture（截断尾行、二进制混入、超长行）解析不抛异常；单 session（≤50MB）解析 < 1s

### R3: 归一化 Session / Turn / Message 类型

**优先级**: P0
**状态**: proposed

- `parsers/types.ts` 定义与 agent 无关的 `Session` / `Turn` / `Message` / `Usage`（v0.2 Codex parser 复用）
- 内联 tool_use_id → (tool_name, input) 双格式索引（算法参考 synrouter tool_index，TS 重写）
- `parentUuid` 链重建轮次顺序；`isSidechain` 透传到 Turn（SPEC-AG-002 的 sidechain 聚合依赖它）
- 消息打标供下游消费：`isCompactBoundary`（`isCompactSummary` 条目）、`isSystemInjected`（continuation / resume / interrupted / stop_hook 等注入模式，参考 agentsview 分类器）、session 级 `isUsageProbe`（唯一用户消息为 `/usage` 的空会话）
- 验收：`examples/` 下脱敏 fixture 往返（解析 → 序列化）信息无损

### R4: 记录去重与 streaming chunk 合并

**优先级**: P0
**状态**: proposed

> 缺此需求会**系统性双重计数**——这是 ccusage / agentsview 都踩过并解决的坑（见 design.md 参考映射）。

- 同一 `message.id` 的多条 streaming 累积快照合并为一条：token usage 取最终值，content blocks 取并集（参考 agentsview `mergeClaudeAssistantMessageChunks`）
- 跨记录去重 key = `(messageId, requestId)`；sidechain replay 场景（同 messageId 换 requestId）回退 messageId-only 匹配；冲突保留规则：非 sidechain 优先 > token 总数大者优先（参考 ccusage 去重策略）
- AgentProgress 嵌套包装（`{"data":{"message":...}}`）解包为扁平记录
- 验收：人工构造含重复快照 / sidechain replay 的 fixture，去重后 usage 总量与人工核算一致

### R5: 时间窗口与项目过滤

**优先级**: P0
**状态**: proposed

- 支持 `--last` / `--since` / `--until` / `--project` / `--session` / `--all` 选择器语义（接口定义在 SPEC-AG-005，本层提供过滤实现）
- 时间过滤先按文件 mtime 粗筛，再按记录 `timestamp` 精筛，避免全量解析
- 验收：1000 session 场景下 `--last` 只解析 1 个文件

## 成功标准

- `examples/` 全部 fixture 解析通过；fuzz fixture（损坏样本）零 crash
- 单 session 解析 < 1s，1000 session 全量扫描 < 5s（PRD FR-AG-1 验收）
- SPEC-AG-002 可直接以归一化对象为输入，无 Claude Code 特有字段泄漏

## 非目标

- Codex / OpenCode 等其他 agent 的解析（v0.2，届时另立 SPEC）
- token 计数与成本计算（SPEC-AG-002）
- proxy 模式请求体捕获（v0.2，FR-AG-10）

## 相关文档

- 设计文档: `design.md` ｜ 任务文档: `tasks.md`
- 产品 PRD: `../../product/agentgauge-prd.md` §FR-AG-1
