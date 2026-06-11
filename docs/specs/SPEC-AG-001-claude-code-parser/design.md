---
id: DESIGN-AG-001
spec: SPEC-AG-001
title: "Claude Code Session 解析器设计"
status: draft
created: 2026-06-11
updated: 2026-06-11
---

# DESIGN-AG-001: Claude Code Session 解析器设计

## 背景

JSONL 是 Claude Code 的**响应日志**而非请求体（实测无 system / tools 字段），解析层只负责忠实还原日志内容 + 归一化，不做任何估算（估算属于 SPEC-AG-002）。约束：流式、容错、纯函数化（watch 模式增量复用）。

> 编号规则：设计决策用 `D1`、`D2`…（与 PRD 检测器编号 D0-D10 无关）。

## 设计决策

### D1: 逐行流式解析而非整文件 JSON.parse

**理由**: session 文件可达数十 MB；watch 模式（v0.3）需要尾部增量解析，流式接口天然支持
**考虑的替代方案**: `fs.readFile` + split——实现快但峰值内存高、无法增量
**取舍**: 代码略复杂；用"行号 + 字节偏移"做增量游标

### D2: 解析失败降级为跳过 + 计数，而非抛错

**理由**: 仓库级承诺"parsers/ 必须跑通 fuzzer 级损坏输入"；单行损坏不应毁掉整个报告
**考虑的替代方案**: 严格模式抛错——对 CLI 用户毫无价值，他们无法修复日志
**取舍**: 可能静默掩盖解析器自身 bug；用 `parse_errors` 计数暴露在 debug 日志与 JSON 输出 meta 中

### D3: 归一化类型与 agent 解耦，Claude Code 特有字段收进 `raw` 逃生舱

**理由**: v0.2 要接 Codex / OpenCode；检测器与归因层不应感知 agent 差异
**考虑的替代方案**: 直接用 Claude Code 字段名做全局类型——v0.2 必返工
**取舍**: 多一层映射；`raw?: unknown` 字段保留原始记录供 debug

## 实现

```typescript
// @prd FR-AG-1
export async function* parseSessionFile(path: string): AsyncGenerator<RawRecord> {
  // readline 逐行；JSON.parse 包 try/catch；未知 type 跳过
}

export function normalizeSession(records: RawRecord[]): Session {
  // parentUuid 链重排 → Turn[]；tool_use_id 索引；isSidechain 透传
}
```

## 文件

- `src/parsers/claude-code.ts`
- `src/parsers/types.ts`
- `src/lib/glob.ts`（发现）/ `src/lib/time.ts`（窗口过滤）

## 测试

- `tests/parsers/claude-code.test.ts`（真实 fixture，非 mock）
- `examples/` 下：正常 session ×2、含 sidechain ×1、损坏样本 ×3（截断 / 二进制 / 超长行）

## 现有实现参考（ccusage / agentsview）

> 两仓库均 MIT，已拉到本地（`~/Documents/AI/github/{ccusage,agentsview}`）。规则同 synrouter：**读懂算法 → TypeScript 重写**，不逐行翻译（ccusage 核心是 Rust，agentsview 是 Go，本就无法直接复用）。在 PR 描述注明"算法参考自 X"。

| 本 SPEC 需求 | 参考位置 | 参考什么 |
|--------------|----------|----------|
| R1 文件发现 | ccusage `rust/crates/ccusage/src/adapter/claude/paths.rs:13-113` | `CLAUDE_CONFIG_DIR`（逗号分隔多路径）+ XDG 回退 + 项目名非法段防御；我们的 `AGENTGAUGE_CLAUDE_PROJECTS` 应对齐这套发现顺序 |
| R2 容错 | ccusage `adapter/claude/mod.rs:350-494` | 失败即跳过；字节级预过滤（行内先找 `"usage":{` 子串再 JSON.parse，跳过大量非计费行）；关键字段为 null 的整行丢弃清单 |
| R2 大行防御 | agentsview `internal/parser/linereader.go` | 64MB maxLineSize + 截断检测 |
| R3 归一化模型 | agentsview `internal/parser/types.go:84-502` | `ParsedSession/ParsedMessage/ParsedUsageEvent` 字段清单是 7 种 agent 实战归纳的最大公约数，设计 `parsers/types.ts` 前通读一遍，避免 v0.2 加 Codex 时返工 |
| R4 chunk 合并 | agentsview `internal/parser/claude.go:257-262, 568-605` | 同 `message.id` 累积快照合并：usage 取末、content 取并 |
| R4 去重 | ccusage `adapter/claude/mod.rs:223-330` | `(messageId, requestId)` 哈希 + sidechain 回退 messageId-only + "非 sidechain 优先/token 多者优先"替换规则 |
| R5 时间过滤 | ccusage（同 adapter） | 仅作交叉验证，无特殊算法 |

**显式不参考**：ccusage 的 5h billing block 切分（订阅限额视角，v0.1 非目标）、agentsview 的 DAG fork 拆分 session（我们保持 1 文件 = 1 session 的简单模型，sidechain 只透传不拆分）。

## 与 synrouter 的边界

不涉及 ⚡ 标记。tool_use_id 索引算法参考 synrouter `tool_index.py`，TypeScript 重写，不复制内部命名。
