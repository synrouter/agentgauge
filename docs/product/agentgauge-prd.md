---
id: PRD-AGENTGAUGE
title: "agentgauge — Agent Token 归因诊断 CLI"
status: draft
created: 2026-06-11
updated: 2026-06-22
owner: Luoshi
tags: [open-source, growth, cli, synrouter-funnel]
---

# agentgauge — Agent Token 归因诊断 CLI

> One-liner: **用 ccusage 的分发方式，交付 agentsview 级别的信息深度。**
>
> 一行命令告诉开发者：你的 Claude Code 这一周花了多少钱、钱花在了哪里、哪部分可以省、能省多少。
> 开源 CLI 作为 synrouter 的获客漏斗顶端：诊断免费开源，治疗（自动修复）是 synrouter。

---

## 0. 文档目的与边界

| | |
|---|---|
| **本文档定位** | agentgauge 这个开源工具的产品战略 PRD + CLI 接口契约（独立公开 repo 的唯一权威产品文档） |
| **关系** | agentgauge 是 **独立公开 repo**（MIT 许可），synrouter monorepo 闭源；二者通过转化漏斗连接 |
| **不在本文范围** | synrouter 网关本身的功能（见 SPEC-001 ~ SPEC-020）、agentgauge 的源代码细节（在独立 repo 内） |
| **将来产物** | ✅ 已拆分为 SPEC-AG-001 ~ SPEC-AG-006（见 [docs/INDEX.md](../INDEX.md) 状态表） |

---

## 1. 背景与机会

### 1.1 市场观察

当前 agent token 用量监控的 CLI 类目已有几个玩家，但 **全部停留在"记账"层面**：

| 工具 | 定位 | 缺口 |
|------|------|------|
| **ccusage** | Claude Code 用量统计鼻祖，npx 一行命令出账单 | 只告诉你"花了多少"，不告诉你"花在哪、能省多少" |
| **agentsview** | ccusage 的 GUI 替代品，覆盖 7 种 agent，本地解析多种 session 格式 | 同样是记账维度，没有结构化归因 |
| **tokscale** | Rust TUI 的多 agent 用量追踪器 | 同上 |

社区已经有更深层需求的明确信号：GitHub issue 里出现"想看 orchestrator vs sub-agent 各花了多少 / 便宜模型是否承担了大部分工作"等问题，但没有产品在解决。（v0.1 即以 sub-agent 维度拆分回应此需求，见 FR-AG-2；数据源 `isSidechain` 字段现成可用。）

### 1.2 我们的空位

**专门面向 agent 工作负载，做语义级 token 归因 + 可压缩空间估算的开源 CLI = 当前没人做。**

两层递进的差异化：

1. **结构化归因**：把单次 session 的 token 按语义角色拆分成 7 类（system / tools / tool_results / history / user_input / output / cache_read+write），现有工具最多只到模型/项目维度
2. **可操作建议**：每条 finding 都金额化（"你的 tool_definitions 占了 22%，14/18 个工具从未被调用，预计可省 $1.12"）——从"看报表"变成"知道该改什么"

第二层是真正的护城河和转化钩子。

### 1.3 战略价值（为什么对 synrouter 重要）

```
GitHub 开源 CLI（零摩擦，npx 一行命令）
  ↓
诊断报告里：⚡ 标记 = 需要请求层介入的优化项
  ↓
"想自动修复？切换 base URL 接入 synrouter"
  ↓
synrouter 商业产品（cache_control 注入、tool definitions 动态裁剪、tool_results 压缩）
```

agentgauge 同时承担三个角色：

- **获客漏斗顶端**：免费、零摩擦、自带传播性的开发者工具
- **产品宣传载体**：每条 ⚡ finding 都是 synrouter 的功能展示位
- **市场教育工具**：让用户认识到"token 是可以被精细归因和压缩的"，从而对 synrouter 的价值有概念

参考路径：LiteLLM、Langfuse 都是"开源工具引流 → 商业产品变现"成功跑通的赛道。

---

## 2. 用户与场景

### 2.1 主要用户画像

| 群体 | 特征 | 痛点 | 与 synrouter 关系 |
|------|------|------|----------------------|
| **A. Claude Code 订阅用户（Pro/Max）** | 个人开发者，焦虑订阅限额（5h window） | "为什么我又被限流了" | 不直接付费 synrouter（订阅流量不走 API），但是**传播载体** |
| **B. API key 跑 agent 的开发者** | 用 ANTHROPIC_API_KEY 跑 Claude Code、用 OpenAI key 跑 Codex | 月底真实账单痛感 | **核心转化对象**，agentgauge 报告里 ⚡ 项直接导向 synrouter |
| **C. 跑 agent fleet 的小团队** | 5–50 人团队、自建 agent 工具或运营 SaaS | 团队总账单不透明、归因困难 | 同 B，且付费意愿更强；CLI 是入口，synrouter dashboard 是长期客户化 |

### 2.2 检测器优先级 = 用户优先级

检测器（detector）的设计文案 **优先服务 B/C 类**：金额化的节省估算只对真实账单用户有冲击力。
A 类用户也能看到价值（限流就是 token 用太多），但产品文案的口径是 **"节省的钱 ($X.YZ)"** 而不是 **"节省的 token 数"**——金额是行动动机。

### 2.3 典型场景

1. **冷启动诊断（一次性）**：用户在 Reddit/HN 看到 agentgauge 帖子 → `npx agentgauge analyze --last` → 10 秒看到自己昨天的会话花费拆解 → 截图发推
2. **周报模式（重复使用）**：用户每周一跑 `agentgauge analyze --last-7d --html report.html` → 发给团队 → 形成"周末看账单"习惯
3. **CI 集成（高粘性）**：用户把 `agentgauge analyze --json` 接进 CI，跟踪每个 PR 引入的 token 变化（v0.2+）
4. **常驻监控（高转化）**：用户开始要"实时显示"→ 进入 `agentgauge watch` TUI 模式 → 再进一步用户开始考虑接入 synrouter 的实时网关

---

## 3. 产品形态总览

### 3.1 三层架构

```
第一层  CLI 终端报告（获客入口）
        npx agentgauge analyze
        职责：10 秒内让用户看到 "你能省 $X"
        ─ ASCII 表格 + 彩色进度条，开发者亲和度高

第二层  HTML 静态报告（传播 + 深度展示）
        agentgauge analyze --html report.html
        职责：承载 GUI 级信息密度，零部署，单文件分享
        ─ 可发给老板、可截图发推

第三层  agentgauge watch（TUI 实时）   ← v0.3+
        持续监控正在运行的 session
        职责：CLI 用户向 synrouter 实时网关升级的过渡形态
```

**GUI 的所有优点（信息密度、可分享给非终端用户、产品感）由静态 HTML 报告承担，所有缺点（启动摩擦、开发成本、部署复杂度）都被绕开。**

### 3.2 商业边界

| 能力 | 开源 (agentgauge) | 商业 (synrouter) |
|------|--------------------|--------------------|
| **诊断**：归因、检测器、报告 | ✅ 全部开源 | — |
| **治疗**：cache_control 注入、tool definitions 动态裁剪、tool_results 压缩、跨 session 优化 | ❌ | ✅ |
| **持续监控** | ✅ 本地 `watch` 模式（v0.3） | ✅ 云端 dashboard、团队视图、告警 |
| **数据持有** | 本地文件，零上传 | 用户主动接入网关 |

规则：**诊断免费开源，治疗是商业产品。**

---

## 4. v0.1 MVP（首发版本，目标 2-3 周可上线）

### FR-AG-1: Claude Code Session 解析

> 对应 SPEC: [SPEC-AG-001](../specs/SPEC-AG-001-claude-code-parser/prd.md)

**优先级**: P0
**状态**: proposed

- 自动发现并解析 `~/.claude/projects/**/*.jsonl` 文件
- 支持选定时间窗口（`--last`、`--last-7d`、`--since YYYY-MM-DD`）
- 支持选定项目（`--project <name>`）或全量（`--all`）
- 零配置启动：`npx agentgauge analyze --last` 应该在没有任何 flag 的情况下也能跑出最近一次 session 的报告

**验收**:
- 能识别 Claude Code 当前版本（≥ 1.x）的 session 文件格式
- 在常见目录结构（macOS / Linux / WSL）下都能自动定位
- 单 session 解析 < 1s，1000 session 全量扫描 < 5s

### FR-AG-2: 语义角色 Token 归因（7 类）

> 对应 SPEC: [SPEC-AG-002](../specs/SPEC-AG-002-token-attribution/prd.md)

**优先级**: P0
**状态**: proposed

把每个请求的 input token 按语义角色拆解。

**数据源分层（关键约束）**：Claude Code 的 session JSONL 是**响应日志，不是请求体**——实测记录中没有 `system` 字段、没有 `tools` 数组，只有 message content 与 usage 统计。因此归因分两个精度档：

| 模式 | 数据源 | 精度 |
|------|--------|------|
| **log 模式（v0.1 默认）** | `~/.claude/projects/**/*.jsonl` | tool_results / history / user_input / output 精确；system_prompt + tool_definitions 合并为"稳定前缀"，用残差法估算 |
| **proxy 模式（v0.2，FR-AG-10）** | 拦截完整请求体 | 7 类全部精确 |

| 角色 | 定义 | log 模式可得性 |
|------|------|----------------|
| `system_prompt` | system 字段（含 Claude Code 内置 system instructions） | ⚠ 残差估算 |
| `tool_definitions` | tools 数组中所有工具的 schema | ⚠ 残差估算 |
| `tool_results` | messages 中所有 tool_result block（历史 + 当前轮次） | ✅ 精确 |
| `history` | messages 中除 tool_result 外的历史 user/assistant 消息 | ✅ 精确 |
| `user_input` | 本轮新增的 user message | ✅ 精确 |
| `assistant_output` | 本次响应的 output token | ✅ usage 直读 |
| `cache_read` / `cache_write` | API 返回的 usage 中的 cache_read_input_tokens / cache_creation_input_tokens | ✅ usage 直读 |

**实现要点**:
- **usage 是 ground truth**：每轮的 input + cache_read + cache_creation + output 总量以 API 返回的 usage 为准，永不偏离
- **残差归因（log 模式）**：`稳定前缀（system + tools）≈ usage 总 input − 本地可 tokenize 的部分（tool_results + history + user_input）`；多轮间残差应近似恒定，取中位数平滑——残差的异常波动本身就是 D10（system_prompt 动态片段）的检测信号
- **tokenizer 只切内部比例**：Anthropic 未公开 Claude 3+ 的 tokenizer（`@anthropic-ai/tokenizer` 仅覆盖 Claude 2.x），本地计数（js-tiktoken）只决定各段**相对占比**，再按 usage 总量等比缩放回真实 token 数——总量永远精确，内部切分为近似
- 报告中残差估算的两类（system_prompt / tool_definitions）百分比带 `~` 前缀（如 `~22%`），HTML hover 解释估算方法；proxy 模式下去掉 `~`

**子 Agent 维度拆分（回应 §1.1 的社区需求）**:
Claude Code JSONL 自带 `isSidechain` 字段标记 Task tool 派生的 sub-agent 轮次。归因结果按 orchestrator / sub-agent 两个维度各自汇总（cost / tokens / 模型分布），终端报告在 session 头部追加一行 `Sub-agents  12 turns · $1.04 (22%)`（无 sidechain 轮次时不显示），JSON 输出带 `sidechain` 聚合对象。这是 ccusage / agentsview / tokscale 都没有的拆分维度，且字段现成、实现成本低。

### FR-AG-3: 内置定价表

> 对应 SPEC: [SPEC-AG-002](../specs/SPEC-AG-002-token-attribution/prd.md)（与 FR-AG-2 合并实现）

**优先级**: P0
**状态**: proposed

- 内置主流模型的输入/输出/缓存读/缓存写价格（claude-sonnet-4-5 / -3-7 / claude-opus / claude-haiku）
- 支持远程更新（`agentgauge update-pricing` 拉取 GitHub raw URL 的 `pricing.json`）
- 支持用户覆盖（`~/.agentgauge/pricing.json` 优先于内置）

### FR-AG-4: 检测器 D0–D5（首发 6 个）

> 对应 SPEC: [SPEC-AG-003](../specs/SPEC-AG-003-detectors-d0-d5/prd.md)

**优先级**: P0
**状态**: proposed

每个检测器输出一条 finding：`{id, severity, title, evidence, savings: {conservative_usd, theoretical_usd}, fix_path}`（双口径节省见 §9.2）。

| ID | 检测器 | 检测逻辑 | severity 判定 | 数据依赖 | 修复路径 |
|----|--------|----------|---------------|----------|----------|
| **D0** | L0 可压缩噪声 | 对每条 tool_result 跑噪声估算管道：ANSI 转义序列、进度条/spinner 残留、重复行、空白膨胀等，得出"可压缩比例"；噪声 token × 出现轮次 × input 单价 = 浪费金额。算法 adapted from RTK（致谢要求见 §14） | 噪声占 tool_results > 15% = MED | log 精确 | ⚡ synrouter L0 压缩 |
| **D1** | 工具定义膨胀 | **log 模式（估算）**：从 tool_use 调用记录 + agent 指纹的内置工具清单（FR-AG-12）统计已加载但从未调用的工具，按已知 schema 尺寸估算闲置 token × 出现轮次 × input 单价；**proxy 模式（精确）**：直读 tools 数组逐个计数 | 闲置 > 50% 且总损耗 > $0.50 = HIGH | log 估算 / proxy 精确 | ⚡ synrouter 动态裁剪 |
| **D2** | 缓存前缀破坏 | **log 模式（估算）**：用 usage 信号推断——相邻轮次 cache_read 骤降且 cache_creation 突增 = 断裂点，损失 ≈ 重写的 cache_creation token × 1.25× input 单价；**proxy 模式（精确）**：按 token 流对比相邻请求 prefix，定位首个分叉点 | 单 session 损失 > $1.0 = HIGH | log 估算 / proxy 精确 | ⚡ synrouter 断点管理 |
| **D3** | 重复工具结果 | 对每条 tool_result 内容做 SHA256 哈希 + size 桶；同一哈希出现 ≥ 3 次 = 重复回传；统计重复部分 token × input 单价 × 出现轮次 | 重复占比 > 20% = MED | log 精确 | 手动（用户改 prompt 或 retrieval）+ synrouter 去重 |
| **D4** | 超长工具结果 | 单次 tool_result > 10K tokens 且后续 N 轮未被引用（被引用 = 在后续 assistant 消息中出现 ≥ 30 token 子串重合） | 单条 > 20K = MED | log 精确 | 手动（agent 端配 max-output） |
| **D5** | 可压缩历史 | 早期 turn (第 1 到第 K，K=总轮次 × 20%) 在最后 5 轮的 assistant 上下文中零引用 | 可压缩 token > 总 history 的 30% = LOW | log 精确 | 手动（compact 时机） |

> D0 即核心三件套（identify / breakdown / noise）中的 **noise** 能力。"数据依赖"列标注该检测器在 log 模式下是估算还是精确；估算项的金额在报告中带 `~` 前缀，proxy 模式（v0.2）下升级为精确值。

**⚡ 标记**：所有"⚡"的项点击/hover 后展示一行 CTA：
`Auto-fixable by synrouter — switch base URL to https://api.synrouter.ai`

### FR-AG-5: 三种输出格式

> 对应 SPEC: [SPEC-AG-004](../specs/SPEC-AG-004-report-rendering/prd.md)

**优先级**: P0
**状态**: proposed

#### 5a. 终端报告（默认）

```
$ npx agentgauge analyze --last

  agentgauge v0.1.0 — session report
  ──────────────────────────────────────────────────────
  Session   claude-code · my-project · 42 turns · 1h 23m
  Model     claude-sonnet-4-5

  COST          $4.83        POTENTIAL SAVINGS    $2.91 (60%)
  TOKENS        3.04M in / 118K out
  CACHE HIT     38%          (achievable: 85%)

  TOKEN COMPOSITION (input)
  tool results      ████████████░░░░░░  41%   1.24M   $1.86
  tool definitions  ██████░░░░░░░░░░░░ ~22%    680K   $1.02
  history           █████░░░░░░░░░░░░░  17%    520K   $0.78
  system prompt     ████░░░░░░░░░░░░░░ ~13%    390K   $0.59
  user input        █░░░░░░░░░░░░░░░░░   3%     95K   $0.14

  FINDINGS (6)                                  est. savings
  ● HIGH  D1 Tool definition bloat: 14/18 idle      $1.12  ⚡
  ● HIGH  D2 Cache prefix broken at token ~1,240    $0.84  ⚡
  ● MED   D3 Duplicate tool results (6× same file)  $0.52
  ● MED   D0 Compressible noise (ANSI, dup lines)   $0.31  ⚡
  ● MED   D4 Oversized tool result (48KB grep)      $0.27
  ● LOW   D5 Compactable history (turns 1-9)        $0.16

  ⚡ = auto-fixable with synrouter → synrouter.ai/connect
```

设计原则：
- **首屏三个数字**（COST / POTENTIAL SAVINGS / CACHE HIT）→ 截图传播的核心素材
- findings 按金额降序、附 severity 色块
- 不超过单屏（24 行），让用户一眼看完
- log 模式下 `tool definitions` / `system prompt` 两行为残差估算，百分比带 `~` 前缀（proxy 模式精确后去掉）

#### 5b. HTML 报告

`--html report.html`：单文件、零依赖、深色开发者风格，所有图表纯 CSS。

- 包含终端报告的所有信息 + 每条 finding 的展开证据（具体哪个工具闲置了、prefix 在哪个 token 分叉、哪些文件被重复回传）
- 顶部带 hero CTA："这份报告里有 2 条 ⚡ — 接入 synrouter 自动修复" → 跳 https://synrouter.ai
- 文件大小 < 80KB，可邮件附件、可 GitHub Gist

#### 5c. JSON 输出

`--json`：机器可读，便于接 CI / 二次加工。

```json
{
  "version": "0.1.0",
  "session": { "agent": "claude-code", "agent_confidence": 0.98, "project": "my-project", "turns": 42, "duration_sec": 4980 },
  "model": "claude-sonnet-4-5",
  "cost_usd": 4.83,
  "potential_savings": { "conservative_usd": 2.91, "theoretical_usd": 4.10 },
  "tokens": { "input": 3042100, "output": 118300 },
  "cache": { "hit_rate": 0.38, "achievable": 0.85 },
  "composition": {
    "tool_results":    { "tokens": 1240000, "pct": 0.41, "cost_usd": 1.86 },
    "tool_definitions":{ "tokens":  680000, "pct": 0.22, "cost_usd": 1.02, "estimated": true },
    "history":         { "tokens":  520000, "pct": 0.17, "cost_usd": 0.78 },
    "system_prompt":   { "tokens":  390000, "pct": 0.13, "cost_usd": 0.59, "estimated": true },
    "user_input":      { "tokens":   95000, "pct": 0.03, "cost_usd": 0.14 }
  },
  "findings": [
    {
      "id": "D1", "severity": "HIGH",
      "title": "Tool definition bloat",
      "evidence": { "loaded": 18, "invoked": 4, "idle_tools": ["WebFetch", "..."] },
      "savings": { "conservative_usd": 1.12, "theoretical_usd": 1.74 },
      "fix_path": "synrouter",
      "fix_url": "https://synrouter.ai/connect"
    }
  ]
}
```

### FR-AG-6: 隐私保护

> 对应 SPEC: [SPEC-AG-004](../specs/SPEC-AG-004-report-rendering/prd.md)（脱敏）+ [SPEC-AG-005](../specs/SPEC-AG-005-cli-interface/prd.md)（价格刷新）

**优先级**: P0
**状态**: proposed

- **本地优先**：所有解析、计算、报告生成都在本地完成，**无任何网络请求**（除了 `update-pricing`）
- HTML 报告中默认对敏感字符串脱敏：tool_result 内容只保留前 80 字符 + 后 40 字符 + 长度
- 提供 `--include-content` 显式开关（仅用户本人本地查看时使用）
- 不收集任何遥测数据（v0.1）；v0.2 引入匿名遥测时也必须默认 opt-out

### FR-AG-12: Agent 识别（三层指纹）

> 对应 SPEC: [SPEC-AG-006](../specs/SPEC-AG-006-agent-identify/prd.md)

**优先级**: P0（核心三件套之一：identify / breakdown / noise）
**状态**: proposed

> 编号说明：FR-AG-8–11 已被 v0.2 / v0.3 章节占用，新增项从 FR-AG-12 起编号，不重排旧编号。

输出 `{ agent, version?, confidence }`，三层信号按优先级降级：

1. **数据源路径 / header**（confidence ≥ 0.95）：session 文件来源目录（`~/.claude/projects` → claude-code）；proxy 模式下读请求 header（如 `user-agent`）
2. **工具签名**（confidence 0.7–0.95）：内置工具集合与命名风格（如 Claude Code 的 Read / Edit / Glob / Task 组合）与 16 个已知 agent 的指纹库比对
3. **提示词特征**（confidence 0.4–0.7）：system / user 消息中的固定句式特征（仅 proxy 模式或 `--include-content` 下可用）

指纹库维护在 `src/identify/profiles.ts`（16 agent 全量；算法参考 synrouter 的 session_fingerprint / agent_registry，TypeScript 重写，不复制内部命名）。confidence < 0.4 时报 `unknown` 并降级为通用归因，不输出 agent 特定的检测器结论。

v0.1 log 模式下第 1 层即足够（数据源目录就是 claude-code）；该 FR 的价值在 v0.2 多 agent + proxy 模式时展开，但接口（JSON schema 中的 `agent` + `agent_confidence` 字段）从 v0.1 就锁定。D1 的内置工具清单也依赖本指纹库。

### FR-AG-13: Agent 行为洞察与可执行建议

> 对应 SPEC: [SPEC-AG-007](../specs/SPEC-AG-007-behavior-insights/prd.md)

**优先级**: P1
**状态**: proposed

v0.1 已经回答"花了多少、花在哪、哪里能省"，但用户真正要优化 agent 调用时，还需要知道"为什么这些浪费发生、该改哪条 prompt/工具策略"。FR-AG-13 将 agentgauge 从一次性账单诊断推进到 **agent session profiler**：在不引入网络副作用、不改变请求、不读取额外私密数据的前提下，从本地日志中提炼工具行为、轮次效率和上下文健康信号。

**首批行为洞察（v0.1.x，低风险增量）**：

| 洞察 | 数据来源 | 输出位置 | 用户行动 |
|------|----------|----------|----------|
| Tool behavior 表 | tool_use name/input + tool_result + per-tool attribution | 终端摘要、HTML 详情、JSON `tool_behavior[]` | 限制高输出工具、减少重复读取、在 CLAUDE.md 固化项目事实 |
| 已注册 vs 实际使用工具 | D1 / agent profile / tool_use 集合 | D1 evidence + 报告摘要 | 禁用闲置 MCP 工具或使用 synrouter 动态裁剪 |
| Turn efficiency 曲线 | 每轮 usage、归因分段、是否 tool_use | 终端 sparkline、HTML 时间线、JSON `turn_efficiency[]` | 发现上下文暴涨、空转轮次、compact 时机 |
| Context growth 指标 | history / tool_results 随轮次增长 | HTML 详情、D9 finding | 提前 compact 或调整长输出工具 |

**建议文案原则**：

- 只输出能被用户执行的建议，例如"Read 同一文件 17 次，考虑在 CLAUDE.md 记录稳定项"，而不是泛泛地说"减少 token"。
- 对 log 模式推断结论标注 confidence；证据不足时降级为 info，不输出强建议。
- 终端默认只展示 top 3 行为洞察，避免破坏首屏传播；HTML/JSON 输出完整数据。
- 所有建议仍然保持"测量不改写"边界；⚡ 只用于需要 synrouter 请求层介入的修复路径。

**后续检测器（D6-D9，见 §8）**：

- D6 tool failure loop：工具失败/错误输出导致的重试浪费。
- D7 model mismatch：简单轮次或纯工具等待轮使用高价模型。
- D8 read churn：同一文件或同一查询被重复读取，属于比 D3 重复结果更上游的行为问题。
- D9 context growth：上下文增长斜率异常，定位应 compact 的拐点。

### FR-AG-7: 技术栈与分发

**优先级**: P0
**状态**: **decided（2026-06-11）**

#### 7.1 选型决策

**TypeScript / Node.js**（Node ≥ 18，纯重写，不复用任何 Python 代码）。

理由（UX 视角）：

1. **`npx agentgauge` 一行运行 = 没有任何替代品**。ccusage 能起飞最大原因就是这一行命令，目标用户读完 Reddit/HN 帖子当场就能跑。Python 侧最接近的 `uvx` 仍需先 `brew install uv`，多一步会指数级损失流量。
2. **运行时已预装**。Claude Code、Codex CLI 本身都是 Node CLI；装了 Claude Code = 100% 有 Node。我们的获客对象天然没有运行时成本。
3. **Ink (React for CLI) 是当下 TUI 体验天花板**。v0.3 的 watch 模式想做出 Vercel dev server / Prisma migrate 那种"看着像现代 Web 应用"的 TUI，几乎只能选 Ink。
4. **HTML 报告生成是 Node 强项**。Node 侧可直接用模板字符串/React render 出单文件 HTML，零工程开销。
5. **可组合性 / 二次分发**。被 dotfiles alias、awesome-list、其他工具 wrap，npm 包是被动分发最强的形态。

**关于性能的反驳**：agentgauge 是测量工具不是热路径。单 session 解析几百兆 JSONL ≈ 1-3 秒，watch 增量解析每秒几次，远低于 Node 的处理上限。Rust 的 10ms vs Node 的 150ms 冷启动对一次性 CLI 用户无感。

**未来 Hybrid 演进路径**：如果 v1.0 之后 watch 模式真的成 CPU/内存瓶颈，参照 esbuild/swc/biome 模式 —— Rust 写核心 + npm 包通过 postinstall 拉对应平台 binary。`npx agentgauge` 命令本身不变，UX 零退步。**v0.x 不要预先押注。**

#### 7.2 技术栈清单

| 类别 | 选型 | 不选什么 |
|------|------|----------|
| 语言 | TypeScript（strict） | — |
| Runtime | Node ≥ 18 | — |
| 包管理（开发） | pnpm | npm（lockfile 慢、磁盘浪费）/ yarn（生态萎缩） |
| 用户安装方式 | `npx agentgauge`（默认）+ `npm i -g agentgauge` | — |
| 构建 | tsup（esbuild 内核，ESM/CJS 双发） | webpack / rollup（重） |
| CLI 框架 | **citty** | oclif（重，启动慢，过度抽象） / commander（API 偏 OOP，类型不够现代） |
| TUI（v0.3 引入） | Ink + ink-table + ink-spinner + ink-text-input | blessed（旧）/ neo-blessed |
| 颜色 / 进度 | picocolors + cli-progress | chalk（体积大 50 倍） |
| Tokenizer | `js-tiktoken`（近似计数，仅决定内部比例；总量以 API usage 为准，见 FR-AG-2） | `@anthropic-ai/tokenizer`（仅覆盖 Claude 2.x，对 Claude 3+ 不可用）/ tiktoken-node（需编译 binding） |
| HTML 模板 | 单文件模板字符串 + 内联 CSS（参考 savings-demo.html 风格） | React SSR（v0.1 杀鸡用牛刀） |
| Schema 校验 | zod（pricing.json 等远程资源） | ajv（API 没 zod 友好） |
| 测试 | vitest | jest（慢、配置繁） |
| Lint + Format | biome | eslint + prettier 组合（配置爆炸） |
| 类型检查 | tsc --noEmit（CI 阶段） | — |
| 打包发布 | npm（主）+ jsr.io（可选） | — |
| 文件读取 | 内置 `fs/promises` + `fast-glob`（扫 `~/.claude/projects/**/*.jsonl`） | globby（同类替代） |
| 日志 / Debug | `debug` 包，`DEBUG=agentgauge:*` 即开 | winston / pino（CLI 用不上） |

#### 7.3 分发渠道与里程碑

- **v0.1**：npm 包 — `npx agentgauge` 和 `npm i -g agentgauge`
- **v0.2**：Homebrew formula — `brew install agentgauge`（仍包装的是 npm 包）
- **v0.3**：可选的单文件二进制（通过 `pkg` 或 `bun build --compile`），给完全没装 Node 的非主流用户兜底
- **v1.0+（不预先押注）**：若性能真成瓶颈，迁移到 Rust 核 + npm 壳（esbuild 模式）

#### 7.4 仓库结构（TS 重写版）

```
agentgauge/
├── src/
│   ├── cli.ts                  # 入口：analyze / sessions / doctor / update-pricing / proxy / watch
│   ├── parsers/
│   │   ├── claude-code.ts      # ~/.claude/projects/**/*.jsonl
│   │   ├── codex.ts            # ~/.codex/sessions/    (v0.2)
│   │   └── types.ts            # 归一化 Session / Turn / Message
│   ├── attribution/
│   │   ├── tokenize.ts         # 7 类 token 归因（log 模式残差法 + proxy 模式精确）
│   │   ├── pricing.ts          # 模型定价 + 远程更新（zod 校验）
│   │   └── cost.ts             # cost / savings 计算器
│   ├── detectors/
│   │   ├── d0-noise.ts         # L0 可压缩噪声（adapted from RTK，文件头注明）
│   │   ├── d1-tool-bloat.ts
│   │   ├── d2-cache-break.ts
│   │   ├── d3-dup-results.ts
│   │   ├── d4-oversize.ts
│   │   ├── d5-compactable.ts
│   │   └── index.ts            # 注册表 + Finding 类型
│   ├── identify/
│   │   └── profiles.ts         # 16 Agent 指纹（三层识别，FR-AG-12）
│   ├── render/
│   │   ├── terminal.ts         # 默认终端报告（picocolors + cli-progress）
│   │   ├── html.ts             # --html 单文件输出
│   │   └── json.ts             # --json 输出
│   ├── tui/                    # v0.3：Ink components
│   │   └── watch.tsx
│   └── lib/                    # glob / fs / log / time 工具
├── tests/                      # vitest（与 src/ 同名 *.test.ts）
├── examples/                   # 脱敏样例 session（小，便于复现 + 测试 fixture）
├── assets/
│   └── pricing.json            # 内置定价快照
├── docs/
│   └── product/
│       └── agentgauge-prd.md   # 本文档
├── package.json
├── tsconfig.json
├── biome.json
├── tsup.config.ts
├── vitest.config.ts
├── LICENSE                     # MIT
└── README.md                   # 含 Credits & Prior Art（RTK）+ quickstart
```

> 本结构与仓库根 `CLAUDE.md` 的"仓库结构（实施版）"保持同步维护，两边内容一致；如有冲突以本节为准并回写 CLAUDE.md。

---

## 5. CLI 接口规范

> 对应 SPEC: [SPEC-AG-005](../specs/SPEC-AG-005-cli-interface/prd.md)（实现要求与本节未尽细节；本节是接口唯一权威）

> 本节是 agentgauge 对外的接口契约。所有版本的命令行参数、子命令、退出码、环境变量都收敛在此。v0.2/v0.3 引入的新命令在对应章节标注，但**全局选项 / 退出码 / 输出约定一旦定下来就不再破坏性变更**。

### 5.1 设计原则

1. **零参数即可用**：`npx agentgauge` 不带任何参数也要出有用结果（≡ `analyze --last`）。这是 npx 一行运行体验的核心。
2. **子命令而非 flag 海洋**：`analyze` / `sessions` / `proxy` / `watch` / `doctor` 等并列子命令，未来扩展时不污染主命令命名空间。参考 `gh` / `cargo` / `vercel`。
3. **Unix 友好**：stdout 只输出结果数据（JSON / 报告主体），日志走 stderr，TTY 检测决定是否上色。`agentgauge ... | jq` 必须能直接管道。
4. **可发现性**：所有子命令支持 `--help`；`agentgauge` 不带参数时除了出报告，也在末尾提示"Try `agentgauge --help` for more commands"。
5. **稳定的退出码 + 稳定的 JSON schema**：CI 集成方需要据此判断成功/失败和解析结果。
6. **遵守通用约定**：`NO_COLOR` 环境变量、`--version` / `-V`、`--help` / `-h`、`--no-color`。

### 5.2 命令总览

```
agentgauge                              # 默认动作：analyze --last
agentgauge analyze    [options]         # 单次分析报告（v0.1 P0）
agentgauge sessions   [options]         # 列出可用 session（v0.1 P0）
agentgauge doctor                       # 环境诊断 / 找不到数据时友好提示（v0.1 P0）
agentgauge update-pricing               # 拉取最新定价表（v0.1 P0）
agentgauge proxy      [options]         # 本地代理 + 精确归因（v0.2）
agentgauge watch      [options]         # Ink TUI 实时模式（v0.3）
agentgauge --version | -V
agentgauge --help    | -h
```

### 5.3 全局选项（所有子命令通用）

| 选项 | 简写 | 默认 | 说明 |
|------|------|------|------|
| `--help` | `-h` | — | 显示帮助；放在子命令后则显示该子命令的帮助 |
| `--version` | `-V` | — | 输出版本号，退出 |
| `--no-color` | — | 自动 | 禁用 ANSI 颜色；非 TTY 自动禁用；遵守 `NO_COLOR` 环境变量 |
| `--debug` | — | off | 等价于 `DEBUG=agentgauge:*`，开调试日志到 stderr |
| `--config <path>` | — | `~/.agentgauge/config.json` | 自定义配置文件 |
| `--cwd <path>` | — | `process.cwd()` | 改变相对路径解析基准（CI/脚本场景） |

### 5.4 `analyze` —— 主命令

```
agentgauge analyze [options]
```

**默认行为**（无任何参数）：等价于 `agentgauge analyze --last`，分析最近一次 session 并以终端报告渲染到 stdout。

#### 5.4.1 选择器（决定"分析哪些 session"）

| 选项 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `--last [duration]` | — | 最近一次 session（无值，默认）或最近 N 天 / 小时 | `--last` `--last 7d` `--last 24h` |
| `--since <date>` | — | 起始时间（ISO 8601 / `YYYY-MM-DD`） | `--since 2026-06-01` |
| `--until <date>` | — | 结束时间 | `--until 2026-06-07` |
| `--all` | — | 所有可发现的 session | `--all` |
| `--project <name>` | `-p` | 限定项目（路径名匹配 `~/.claude/projects/<name>`） | `-p my-project` |
| `--session <id>` | — | 限定单个 session（jsonl 文件名或 UUID） | `--session 9f3a...` |
| `--agent <agent>` | — | 限定 agent 类型（v0.1 仅 `claude-code`） | `--agent claude-code` |
| `--model <model-id>` | — | 限定模型 | `--model claude-sonnet-4-5` |

**选择器组合规则**：选择器之间是 **AND** 关系；冲突的时间窗口（如 `--last` 与 `--last-7d` 同时给）按"更晚出现的覆盖"处理并打印 stderr 警告。

#### 5.4.2 输出格式

| 选项 | 说明 |
|------|------|
| 默认 | 终端 ANSI 报告到 stdout |
| `--html [path]` | 生成 HTML 报告。无路径时默认 `./agentgauge-report-{YYYYMMDD-HHMMSS}.html`；路径为 `-` 时打到 stdout |
| `--json` | 输出 JSON 到 stdout（同时**关闭**终端报告，禁用颜色） |
| `--output-dir <path>` | 与 `--html` 联用时改输出目录 |
| `--quiet` / `-q` | 只打"花了多少 / 能省多少 / 缓存命中率"三个数字 + findings 一行摘要（截图传播专用） |
| `--verbose` / `-v` | 详细模式：每条 finding 展开计算公式与证据 |
| `--top-n <N>` | 终端报告里 findings 最多显示 N 条（默认 5；HTML/JSON 总是完整） |
| `--include-content` | HTML/JSON 中包含 tool_result 完整原文（默认脱敏：前 80 + 后 40 字符 + 长度） |
| `--mode <api\|subscription>` | 成本口径：`api`（默认，USD 金额）/ `subscription`（把美元换算为等价订阅周期消耗，面向 Pro/Max 用户；见 §9.3） |

**互斥规则**：
- `--json` 与 `--quiet` / `--verbose` 互斥（JSON 永远完整结构化）
- `--html` 与 `--json` 可以同时给（HTML 写文件，JSON 写 stdout）

#### 5.4.3 检测器开关

| 选项 | 说明 |
|------|------|
| `--detectors <list>` | 逗号分隔白名单，例如 `--detectors D1,D2,D3` |
| `--skip-detectors <list>` | 黑名单 |
| `--min-severity <level>` | 仅显示 ≥ 该级别（`low` / `med` / `high`） |
| `--min-savings <usd>` | 仅显示估算节省 ≥ 该金额，例如 `--min-savings 0.5` |

#### 5.4.4 完整示例

```bash
# 默认 — 最近一次 session
npx agentgauge

# 等价写法
agentgauge analyze --last

# 最近一周的汇总报告，输出 HTML 给老板看
agentgauge analyze --last 7d --html report.html

# 特定项目，输出 JSON 进 CI
agentgauge analyze --project my-app --last 24h --json > usage.json

# 调试某个具体 session
agentgauge analyze --session 9f3a1b2c... --verbose

# 截图传播（极简输出）
agentgauge analyze --last 7d --quiet

# 只看高价值 finding
agentgauge analyze --last 7d --min-severity high --min-savings 1.0
```

### 5.5 `sessions` —— 列出可用 session

```
agentgauge sessions [options]
```

输出表格（默认）或 JSON。复用 §5.4.1 的所有选择器；不接受输出格式选项以外的 analyze 参数。

| 选项 | 说明 |
|------|------|
| 选择器 | 同 §5.4.1 |
| `--json` | JSON 输出 |
| `--sort-by <field>` | 排序字段：`time`（默认） / `cost` / `tokens` / `turns` |
| `--limit <N>` | 最多列出 N 条（默认 50） |

终端默认输出形如：

```
ID         AGENT         PROJECT      MODEL                  TURNS   COST    WHEN
9f3a1b2c   claude-code   my-app       claude-sonnet-4-5      42      $4.83   2h ago
8e2b...    claude-code   docs-site    claude-sonnet-4-5      18      $1.21   yesterday
...
```

### 5.6 `doctor` —— 环境诊断

```
agentgauge doctor
```

无参数。检查并报告：

- Node 版本是否 ≥ 18
- 能否找到 `~/.claude/projects/`（或 `AGENTGAUGE_CLAUDE_PROJECTS` 指定路径）
- 发现了多少个 agent 数据源，分别多少 session
- 内置 pricing 表的版本与最后更新时间
- 当前的 `--no-color` / `NO_COLOR` / TTY 状态

**找不到数据时**，doctor 必须给出可复制的修复建议（"看起来你还没用过 Claude Code，请先安装：…"），而不只是报错。这是初次跑 `npx agentgauge` 失败用户的兜底入口。

> **设计取舍**：doctor **只诊断、不副作用**，不接受 `--fix` flag。需要更新定价表请用 `update-pricing`，需要重置配置等显式操作请使用对应的专用子命令。"诊断"和"修改"是两个动作，分两个命令保持语义干净。

### 5.7 `update-pricing` —— 更新定价表

```
agentgauge update-pricing [options]
```

| 选项 | 说明 |
|------|------|
| `--url <url>` | 自定义远程定价 JSON 地址 |
| `--dry-run` | 只对比 diff，不写入 |
| `--force` | 即使版本相同也覆盖 |

更新后写到 `~/.agentgauge/pricing.json`，运行时优先级：用户文件 > 内置快照。

### 5.8 `proxy` —— v0.2 引入

```
agentgauge proxy [options]
```

| 选项 | 默认 | 说明 |
|------|------|------|
| `--port <port>` | 4090 | 监听端口 |
| `--host <host>` | 127.0.0.1 | 监听地址（不允许默认绑 0.0.0.0，避免误暴露） |
| `--upstream <url>` | `https://api.anthropic.com` | 上游 API |
| `--record-dir <path>` | `~/.agentgauge/proxy-records/` | 拦截请求体落盘位置 |
| `--no-record` | — | 只转发不记录（仅用于调试网络） |

启动后打印一次性的接入说明：

```
agentgauge proxy listening on http://127.0.0.1:4090
Set ANTHROPIC_BASE_URL=http://127.0.0.1:4090 in your Claude Code config.
```

### 5.9 `watch` —— v0.3 引入

```
agentgauge watch [options]
```

| 选项 | 说明 |
|------|------|
| `--project <name>` | 限定项目 |
| `--session <id>` | 锁定到指定 session（默认追最近活跃） |
| `--interval <ms>` | 刷新间隔（默认 500） |

启动 Ink TUI；终端不支持 alt-screen 时降级为滚动模式。

### 5.10 环境变量

| 变量 | 作用 |
|------|------|
| `AGENTGAUGE_HOME` | 覆盖 `~/.agentgauge`（配置、缓存、定价用户副本） |
| `AGENTGAUGE_CLAUDE_PROJECTS` | 覆盖 `~/.claude/projects` 扫描根 |
| `AGENTGAUGE_PRICING_URL` | 覆盖默认远程定价 URL |
| `NO_COLOR` | 通用约定，禁用 ANSI 色 |
| `DEBUG` | `DEBUG=agentgauge:*` 启用 debug 日志（基于 `debug` 包） |
| `FORCE_COLOR` | 强制启用色（CI 场景） |
| `AGENTGAUGE_TELEMETRY` | v0.2+ 可能引入；默认 `off`；只接受 `on` 才上报匿名遥测 |

### 5.11 退出码

| Code | 含义 |
|------|------|
| 0 | 成功 |
| 1 | 通用错误（解析、IO 等） |
| 2 | 用户输入错误（参数解析失败、互斥选项冲突） |
| 3 | 找不到匹配的 session 数据（区分于"运行失败"，方便 CI 判定） |
| 4 | 定价表缺失或损坏 |
| 64 | 系统级错误（权限拒绝、磁盘满等） |
| 130 | 用户 Ctrl-C 中断（保留 Unix 习惯） |

### 5.12 stdout / stderr 分流

| 输出渠道 | 内容 |
|----------|------|
| **stdout** | 终端报告主体、`--html` 写到 `-` 时的 HTML、`--json` 的结构化数据 |
| **stderr** | 进度提示、警告、debug 日志、`doctor` 的修复建议、任何不属于"结果"的文字 |

**判断标准**：用户用 `> file` 重定向 stdout 时，写入文件的内容必须是"结果"（报告 / JSON / HTML），其他全到 stderr。

### 5.13 JSON 输出 Schema（稳定契约）

`--json` 输出遵循 §4 FR-AG-5c 中的 schema，并在顶层带 `version` 字段。CI 集成方可以据此版本号决定如何解析：

```json
{
  "version": "0.1.0",
  "schema_version": 1,
  "generated_at": "2026-06-11T16:45:00Z",
  "sessions": [ /* 一个或多个 session 的归因结果 */ ],
  "aggregate": { /* 汇总（仅当多 session 时） */ },
  "findings": [ /* 跨 session 合并后的 finding 列表 */ ]
}
```

**schema_version 升级规则**：
- 同 schema_version 下只允许**添加**字段
- 删除 / 重命名字段必须递增 schema_version
- v0.x 内 schema_version 维持 1；v1.0 发布前若必要可升级为 2

### 5.14 输入兼容性

- 时间格式：ISO 8601 完整（`2026-06-11T08:00:00Z`）/ 仅日期（`2026-06-11`）/ 相对时间（`24h`, `7d`, `30d`） 三种都接受
- 路径展开：所有 `<path>` 参数都接受 `~`、相对路径、绝对路径
- 模型 ID：接受简写（`sonnet-4-5`）和完整 ID（`claude-sonnet-4-5-20260514`），简写按 pricing 表内的别名解析

### 5.15 帮助文本风格

`agentgauge --help` 输出结构（参考 cargo / gh）：

```
agentgauge — see where your AI coding agent burns tokens

USAGE:
  agentgauge [COMMAND] [OPTIONS]

COMMANDS:
  analyze         Analyze sessions and produce a cost report [default]
  sessions        List discoverable sessions
  doctor          Diagnose installation and data sources
  update-pricing  Refresh built-in pricing table
  proxy           Run local proxy for precise attribution (v0.2)
  watch           Live TUI dashboard (v0.3)

COMMON OPTIONS:
  -h, --help       Show help
  -V, --version    Show version
      --no-color   Disable ANSI colors
      --debug      Enable debug logs to stderr

Run `agentgauge <command> --help` for command-specific options.
Docs: https://github.com/synrouter/agentgauge
```

每个子命令 `--help` 末尾必须附 1-2 个常用示例。

---

## 6. v0.2（验证后跟进，2-4 周）

### FR-AG-8: 多 Agent 支持

**优先级**: P1

新增解析器：

- Codex CLI（OpenAI 官方）：session 文件路径 `~/.codex/sessions/`
- OpenCode：本地 session 格式
- Cursor / Aider（如有公开 session 文件）

每个新 agent 一个 `parsers/<agent>.ts` 适配器，输出统一的归一化 Session 对象。

> 实现参考：agentsview（MIT）已实战解析 25 种 agent，`internal/parser/codex.go` 含 Codex 的关键坑——OpenAI usage 是**累计式 token_count 事件**（需 string 级去重防重发）、`input_tokens` 含 cached 部分（需减 `cached_input_tokens` 归一化为 Anthropic 风格）。届时为 Codex parser 立 SPEC 时，数据可行性验证表直接从该文件提炼。

### FR-AG-9: 跨 Session 趋势

**优先级**: P1

- `agentgauge analyze --last-7d` 输出周报：每天的总花费、缓存命中率趋势、各检测器 finding 累计金额
- `agentgauge analyze --compare last-7d vs prev-7d`：周环比，定位"哪个检测器在恶化"

### FR-AG-10: 代理模式（精确归因）

**优先级**: P1
**状态**: proposed

本地起 HTTP 代理 `agentgauge proxy --port 4090`：

- 用户把 Claude Code 的 `ANTHROPIC_BASE_URL` 指向 `http://localhost:4090`
- agentgauge 拦截每个请求体，得到完整的 system / tools / messages 原文
- 归因从"估算"升级为"精确"，且能实时观测

**战略意义**：这一步用户已经在用 **"修改 base URL"** 这个动作了——这正是 synrouter 的接入形态，切换成本为零。

代理模式只做观测和本地记账，**不做改写**——改写是 synrouter 的事。

---

## 7. v0.3+（TUI / Watch 模式）

### FR-AG-11: agentgauge watch

**优先级**: P2

`agentgauge watch` 启动一个 TUI（基于 Ink），实时监控正在运行的 Claude Code session：

```
┌─ agentgauge ──── claude-code · my-project ── live ──────────────┐
│                                                                  │
│  Turn  42      Cost  $4.83 +$0.07   Cache  38% ↓                 │
│                                                                  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 3.04M tok │
│  41%  tool_results       1.24M tok    $1.86                      │
│  22%  tool_definitions   680K tok     $1.02  ▲ growing           │
│  ...                                                             │
│                                                                  │
│  ALERTS (live)                                                   │
│  ⚠  Turn 42: tool_result "Read(/big.log)" 47K tokens             │
│  ⚠  Turn 41: cache prefix broke (new timestamp in system)        │
│                                                                  │
│  [q] quit  [h] history  [f] findings  [s] sessions               │
└──────────────────────────────────────────────────────────────────┘
```

**触发节奏判断**：v0.3 是否做，看 v0.1/v0.2 上线后是否有用户反复用 `--html` 并要求"能不能常驻监控"。让需求把我们推到 watch 模式，而不是预先押注。

### 明确不做（v1 边界）

- ❌ **自动修复**：属于 synrouter 商业产品（cache_control 注入、tool_definitions 裁剪、tool_results 压缩）
- ❌ **团队协作 / 云端存储**：属于 synrouter dashboard，agentgauge 严格保持本地优先
- ❌ **eval / 质量评估**：避免和 Langfuse / LangSmith 正面竞争
- ❌ **多账号成本聚合**：属于 synrouter dashboard
- ❌ **GUI / Electron 应用**：HTML 报告已经覆盖了 GUI 的所有真实需求

---

## 8. 检测器扩展规划

v0.1 发布 6 个（D0–D5），但需要为后续保留扩展位。每加一个检测器 = 一篇技术博客 + 一次社区话题。

候选清单（按优先级）：

| 候选 | 检测内容 | 与 synrouter 关联 |
|------|---------|----------|
| **D6** | tool failure loop：工具失败/错误输出导致重复调用和无效上下文 | 信息性；可提示用户修复命令、权限或测试入口 |
| **D7** | model mismatch：简单轮次或纯工具等待轮使用高价模型 | 信息性（synrouter 暂不做路由优化） |
| **D8** | read churn：同一文件/查询被重复读取，早于 D3 的上游冗余行为 | 信息性；可提示改 CLAUDE.md 或 retrieval 策略 |
| **D9** | context growth：上下文增长斜率异常，定位 compact 拐点 | 信息性；可提示 compact 时机 |
| **D10** | system_prompt 动态片段定位（时间戳、文件列表、git status 等导致每轮缓存失效） | ⚡ synrouter cache prefix stabilizer |
| **D11** | tool_definitions 顺序抖动（同一 MCP server 重启后顺序变化破坏缓存） | ⚡ synrouter tool order canonicalizer |
| **D12** | subagent 派生导致 prefix 分叉（Claude Code 的 Task tool 派生子 session） | ⚡ synrouter subagent-aware caching |

> 数据依赖：D6-D9 log 模式即可，优先进入 SPEC-AG-007；D10 可在 log 模式下通过残差波动近似（见 FR-AG-2 残差归因）；D11 / D12 需要 proxy 模式请求体。

---

## 9. 报告设计原则

### 9.1 数字必须可截图、可传播

- 三个数字开头：**花了多少 / 能省多少 / 缓存命中率**
- 每条 finding 都附美元金额（不是 token 数）
- ⚡ 标记 = 视觉钩子，对应"可自动修复"

### 9.2 不夸大节省估算

- 节省估算必须有可追溯的计算公式（HTML 报告里展开可见）
- 区分 **"理论节省"**（如果完全修复）和 **"保守节省"**（实际可达）——对应 JSON 字段 `savings.theoretical_usd` / `savings.conservative_usd`；终端 / HTML 默认展示保守值，理论值在展开详情中
- 在 `--verbose` 模式下展示每条 finding 的计算逐步推导

**理由**：用户拿着不准的数字去算账被打脸，比没有数字更糟糕；准确性是壁垒的一部分。

### 9.3 文案口径

- 默认面向 B 类用户（API key 用户）：金额单位 USD
- 对 A 类用户（订阅用户）提供 `--mode subscription`：把美元换算为"等价订阅周期消耗"
- 报告里 **不出现** "免费" "限时优惠" 等营销词；保持工具气质

---

## 10. 成功标准（KPI）

### 10.1 v0.1 上线 30 天目标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| GitHub Stars | 500 | repo star 计数 |
| npm weekly downloads | 1,000 | npmjs.com |
| Reddit / HN / X 自然提及 | 10 次 | 监控关键词 `agentgauge` |
| HTML 报告分享回链（synrouter.ai/connect 流量） | 200 UV | GA4 referrer |
| **synrouter waitlist 注册（来自 agentgauge）** | **30 人** | GA4 utm + 自定义 referrer |

### 10.2 v0.1 上线 90 天目标

| 指标 | 目标 |
|------|------|
| GitHub Stars | 2,000 |
| npm weekly downloads | 5,000 |
| **synrouter 付费转化（来自 agentgauge）** | **5 个客户 / MRR $500+** |
| 月活用户（启动 ≥ 2 次 / 30d） | 1,500（参考值，见下） |

> ⚠ 月活指标依赖 v0.2 才引入的 opt-in 遥测（默认 off，见 Q4），只能得到抽样下界，作参考而非考核；v0.1 期间以 npm 周下载量与 HTML 报告回链流量作为活跃度代理指标。

### 10.3 北极星指标

**"agentgauge → synrouter base URL 切换"事件数。**

定义：用户在 30 天内既跑过 agentgauge analyze，又在 synrouter 后台完成首次 API key 创建并发起 ≥ 1 次请求。这是漏斗闭环的唯一硬指标。

---

## 11. 风险与对策

### 11.1 复制风险（最大风险）

CLI 工具复制成本极低，ccusage 之后涌现了一批替代品。

**对策**：
- **归因精度**是壁垒，需要持续维护各 agent 的 session 格式适配 + 各模型的定价/缓存规则库——这个脏活累活本身就是壁垒
- **检测器**是壁垒，每加一个新检测器需要深入理解 agent 工作机制，不是 fork 就能抄
- **品牌**：抢先把"agentgauge = 唯一带可压缩空间分析的 CLI"心智占住，配合 synrouter 双品牌联动

### 11.2 转化漏斗失效风险

GitHub star 很多但 synrouter 转化为零——开源获客项目的经典踩坑。

**对策**：
- 检测器和文案 **优先为 API 用户设计**，订阅用户作为传播载体但不作为核心服务对象
- ⚡ 标记需要 A/B 测试措辞，目标点击率 > 5%
- HTML 报告里至少有 3 处导向 synrouter 的入口（hero CTA / 每条 ⚡ finding / 页脚），但不能让产品味盖过工具味

### 11.3 归因精度争议风险

用户反馈"你说我能省 $1.12，我修了之后只省了 $0.6"。

**对策**：
- 永远报"保守估算"（实际可达的下界）
- HTML 里完整展开计算公式
- 在 README 注明"估算基于过去 N 天平均值，实际节省取决于使用模式变化"

### 11.4 维护成本风险

各 agent 的 session 格式会随版本变化，pricing 会变。

**对策**：
- 把 `parsers/` 和 `pricing.json` 设计成可远程更新的资源，主程序只负责调度
- 社区贡献机制：parsers 接受 PR，pricing 半自动从各家官方 docs 拉取

---

## 12. 与现有 SPEC 的关系映射

agentgauge 的检测器 → synrouter 的修复能力 →（最终）SPEC 文档：

| agentgauge 检测器 | synrouter 修复路径 | 对应 SPEC |
|-----|-----|-----|
| D0 Compressible noise (L0) | tool_results L0 压缩 | SPEC-009 tool-noise-filtering (L0) |
| D1 Tool definition bloat | tool_definitions 动态裁剪 | （新规划，未立 SPEC） |
| D2 Cache prefix broken | cache_control 注入 + prefix 稳定化 | SPEC-002 cache-control-injection |
| D3 Duplicate tool results | tool result 去重 | SPEC-009 tool-noise-filtering (L0+L1) |
| D4 Oversized tool result | tool result 截断 | SPEC-003 tool-result-trimming |
| D5 Compactable history | history 压缩 | SPEC-010 per-tool-extraction (L2)，未来 |
| D6 Tool failure loop | 提示用户修复命令/权限/测试入口 | 信息性 |
| D7 Model mismatch | 模型路由建议 | 信息性 |
| D8 Read churn | 提示用户固化项目事实 / retrieval 策略 | 信息性 |
| D9 Context growth | compact 时机建议 | 信息性 |
| D10 system_prompt 动态片段 | prefix stabilizer | （新规划） |
| D11 tool_definitions 顺序抖动 | tool order canonicalizer | SPEC-012 agent-tool-format-adaptation |
| D12 subagent prefix split | subagent-aware caching | （新规划） |

---

## 13. 落地路线图

| 阶段 | 时间 | 内容 | 交付 |
|------|------|------|------|
| **T+0** | 已完成 | 战略 PRD（本文档） | docs/product/agentgauge-prd.md |
| **T+1 w** | Week 1 | 独立 repo 初始化（github.com/synrouter/agentgauge，MIT），**TypeScript/Node 脚手架**（pnpm + tsup + biome + vitest），Claude Code parser 雏形 | 内部 dev 版能跑 |
| **T+2 w** | Week 2 | 7 类归因（log 模式残差法）+ D0-D3 检测器 + 终端报告输出 | alpha |
| **T+3 w** | Week 3 | D4-D5 + HTML/JSON 输出 + 隐私保护 + npm 发布 | **v0.1.0 公开发布** |
| **T+4 w** | Week 4 | HN / Reddit / X 内容铺设；监控转化漏斗 | 上线后第一周复盘 |
| **T+5 w** | Week 5 | Tool behavior 表、turn efficiency sparkline、D6-D9 行为检测器 | v0.1.x |
| **T+6 w** | Week 6 | Codex / OpenCode parser，跨 session 趋势 | v0.2.0 |
| **T+8 w** | Week 8 | 代理模式（FR-AG-10），归因升级精确档 | v0.2.1 |
| **T+12 w** | Week 12 | watch / TUI 模式（如需求被验证） | v0.3.0 |

---

## 14. 命名与品牌

- **名称**: `agentgauge`（"agent" + "gauge" 仪表）
  - ⚠️ 注意拼写：**agent**gauge，不是 agentguage / agentgaige。这是 SEO 和品牌可记性的基础
- **域名**: agentgauge.dev（首选）/ agentgauge.io
- **Logo 概念**: 一个仪表盘指针 + 命令行光标，深色主题，绿色高亮
- **README 开场白**: `Use ccusage's distribution. Deliver agentsview's depth.`
- **与 synrouter 关系展示**: 在 agentgauge README、HTML 报告页脚、CLI 输出底部三处标注 `An open-source funnel for synrouter.ai` 或 `Built by the team behind synrouter.ai`，保持轻量但不隐瞒
- **RTK 致谢（强制，三处缺一不可）**: L0 噪声估算思路源自 [RTK (rtk-ai/rtk, MIT)](https://github.com/rtk-ai/rtk)。① README 顶部 `Credits & Prior Art` 段落（含 MIT + 链接 + 一句 "they pioneered this at the CLI layer; we measure it at the session-log layer"）；② `src/detectors/d0-noise.ts` 等噪声模块文件头注释保留 "noise detection adapted from RTK"；③ HN / Reddit launch 帖子正文主动提 RTK

---

## 15. 待决问题（OPEN）

| ID | 问题 | 当前倾向 |
|----|------|---------|
| ~~Q1~~ | ~~TS/Node vs Python 实现~~ | ✅ **decided 2026-06-11**：TypeScript/Node（见 FR-AG-7.1） |
| ~~Q2~~ | ~~Anthropic tokenizer 用哪个库~~ | ✅ **decided 2026-06-11**：`js-tiktoken` 近似计数，仅决定各段内部比例；总量以 API usage 为 ground truth（见 FR-AG-2）。`@anthropic-ai/tokenizer` 仅覆盖 Claude 2.x，不用于 Claude 3+ |
| Q3 | Pricing JSON 是否放 agentgauge repo 还是 synrouter litellm pricing | 复用 synrouter 的 pricing.json，agentgauge 拉取远程版本 |
| Q4 | 是否带匿名遥测 | v0.1 不带，v0.2 默认 off 的 opt-in |
| Q5 | logo 是否做 ASCII art 版本作为 CLI banner | 是，但小巧（≤ 5 行） |
| Q6 | synrouter 是否同步开放一个 `/connect?from=agentgauge` 着陆页 | 是，作为漏斗终点页，需要单独 SPEC |
| ~~Q7~~ | ~~CLI 框架：citty vs commander~~ | ✅ **decided 2026-06-11**：citty（unjs 生态、类型友好、子命令模型清爽；见 FR-AG-7.2） |
| ~~Q8~~ | ~~`update-pricing` 是否合并进 `doctor --fix`~~ | ✅ **decided 2026-06-11**：保持两个独立子命令（"诊断"与"更新"是不同动作，语义清晰；见 §5.6 / §5.7） |

---

## 16. 相关文档

- 战略 PRD: [synrouter-prd.md](synrouter-prd.md)
- 内容传播策略: [growth/content-strategy](../growth/) （内容规划中会有专门 agentgauge launch 章节）
- 相关 SPEC: SPEC-002（缓存注入）、SPEC-003（工具结果截断）、SPEC-009/010/011（工具压缩管道）、SPEC-012/013（多 agent 适配）
- 竞品参考: [LLM 网关 9 强对比](../competitive/llm网关产品对比.md)

---

> **一句话总结**：agentgauge 是 synrouter 的市场教育工具和获客漏斗顶端——用一行 npx 命令让开发者看到 token 是可以被精细归因和压缩的，然后告诉他们"想自动修复，那是 synrouter 的事"。
