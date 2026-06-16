# agentgauge

> 开源 CLI + 常驻客户端：看清你的编码 Agent 把 token 花在哪了。
> 读取本地 Agent 日志/请求体，按轮次·工具拆解 token 去向，指纹识别 Agent，估算工具输出中可压缩的噪声。
> 公开仓库（MIT）：`github.com/synrouter/agentgauge`。策略/规划文档留在 obsidian 与 `docs/product/`，详见 `docs/product/agentgauge-prd.md`。

---

## 行为准则（AI 编码协作通则）

> 旨在减少 LLM 在编程中常见的错误。倾向于谨慎优先于速度——琐碎任务可自行判断，跨层/敏感改动严格遵守。

### 1. 先思考，再编码

不要假设。不要掩饰困惑。把权衡摆出来。

- 明确陈述假设；不确定就提问。
- 多种理解方式时，全部列出来，不要默默替对方做选择。
- 有更简单方案就说出来，必要时反驳。
- 有不清楚的点，停下来指出并提问，再动手。

### 2. 简洁优先

用最少的代码解决问题。不要做投机性设计。

- 不实现超出需求的功能。
- 不为只用一次的代码做抽象。
- 不引入未被要求的"灵活性"或"可配置性"。
- 不为不可能发生的场景写错误处理。
- 写了 200 行但其实 50 行就够，重写。

自检："资深工程师会不会觉得这太复杂了？" 会，就简化。

### 3. 外科手术式的改动

只动你必须动的地方。只清理你自己制造的混乱。

- 不"顺手优化"周围代码、注释或格式。
- 不重构没坏的东西。
- 与现有风格保持一致，即使个人偏好不同。
- 注意到无关的死代码，提一下，但不要删除。
- 自己的改动产生的孤儿（未使用的 import/变量/函数）必须删干净。

判断标准：每一行被改动的代码，都应能直接追溯到用户的需求。

### 4. 以目标驱动执行

定义成功标准。循环执行直到验证通过。

- "添加验证" → "为非法输入编写测试，让它们通过"
- "修复 bug" → "写一个能复现的测试，让它通过"
- "重构 X" → "重构前后测试都能通过"

多步骤任务先列计划：

```
1. [步骤] → 验证：[检查方式]
2. [步骤] → 验证：[检查方式]
```

清晰的成功标准让你能自主推进；模糊标准（"让它跑起来"）需要不断回头确认。

### 5. 语言偏好

- **默认使用中文输出**，包括计划、分析、解释和对话。
- 代码、注释、commit message、技术标识符保持英文。

---

## 项目背景

- **一句话定位**：看清你的编码 Agent 把 token 花在哪了 —— 按轮次·工具拆解 + Agent 指纹识别 + 可压缩噪声估算。
- **产品形态**：CLI（一次性分析）→ HTML 报告（传播载体）→ 常驻 TUI（v0.3 watch 模式）。对标 ccusage 的分发方式 + agentsview 的信息深度。
- **核心能力三件套**：
  1. **identify** — 三层 Agent 识别（header > 工具签名 > 提示词），输出 agent + confidence。
  2. **breakdown** — 7 类 token 归因（system/tools/tool_results/history/user_input/output/cache_read+write）+ per-tool 排序。
  3. **noise** — L0 噪声估算（ANSI/进度条/重复行 + 其他检测器），衡量工具输出"可压缩"比例并量化美元节省。
- **隐私承诺**：纯本地、零数据库、零上传；价格表默认内置，`update-pricing` 可从 LiteLLM 刷新。这是相对竞品的硬差异，也是 HN/Reddit 帖子的信任基础。
- **与 Synrouter 的边界**：agentgauge 只**测量**不**改写**。在途压缩/缓存断点注入/工具裁剪/计量归因/飞轮全部留在闭源 Synrouter，作为 ⚡ 标记的自动修复路径。

完整 PRD：`docs/product/agentgauge-prd.md`（含检测器 D1-D5 算法、报告格式规范、KPI、漏斗设计）。

---

## 技术栈（v0.x 已决，2026-06-11）

> 决策详见 PRD §FR-AG-7。UX 视角下 **TypeScript / Node** 是唯一答案：`npx agentgauge` 一行运行 + Claude Code 用户 100% 已装 Node + Ink 是当下 TUI 体验天花板。

**不复用 synrouter 的任何 Python 代码**。synrouter 的 `tool_index` / `session_fingerprint` / `agent_registry` / `l0_noise` 仅作为**算法参考**——读懂、用 TypeScript 重写。这样既避开脱敏红线，又能针对 CLI/TUI 场景做单独优化（流式解析、增量更新、纯函数化）。

| 类别 | 选型 | 备注 |
|------|------|------|
| 语言 | TypeScript（strict） | tsconfig: `strict: true`, `noUncheckedIndexedAccess: true` |
| Runtime | Node ≥ 18 | 用 ESM；CJS 仅 tsup 双发兼容 |
| 包管理 | **pnpm** | 开发用；用户端用 `npx` / `npm i -g` |
| 构建 | tsup | esbuild 内核，毫秒级；ESM/CJS 双发 |
| CLI 框架 | **citty** | commander（API 偏 OOP，类型不够现代）/ oclif（重，启动慢） |
| TUI（v0.3） | Ink + ink-table + ink-spinner | 不要 blessed |
| 颜色 / 进度 | picocolors + cli-progress | 不要 chalk |
| Tokenizer | `@anthropic-ai/tokenizer` + `js-tiktoken` | 纯 JS，免编译 binding |
| HTML 模板 | 单文件模板字符串 + 内联 CSS | v0.1 不引入 React SSR |
| Schema 校验 | zod | pricing.json / 外部 JSON |
| 测试 | vitest | 兼容 jest API |
| Lint + Format | **biome** | 单工具替代 eslint + prettier |
| 类型检查 | tsc --noEmit | CI 必跑 |
| 文件扫描 | fast-glob | 扫 `~/.claude/projects/**/*.jsonl` |
| Debug 日志 | `debug`，`DEBUG=agentgauge:*` | 默认静默 |

**Node 版本兼容**：声明 `"engines": { "node": ">=18" }`。所有 ESM 写法、`fs/promises`、`Web Streams API` 可放心用。

**未来 Hybrid 演进路径**（不预先押注）：v1.0 之后若性能成瓶颈，仿照 esbuild/swc/biome —— Rust 写核心 + npm 包 postinstall 拉对应平台 binary。`npx agentgauge` 命令不变，UX 零退步。

---

## 仓库结构（实施版）

```
agentgauge/
├── src/
│   ├── cli.ts                  # 入口：analyze / proxy / watch / update-pricing
│   ├── parsers/
│   │   ├── claude-code.ts      # ~/.claude/projects/**/*.jsonl
│   │   ├── codex.ts            # v0.2
│   │   └── types.ts            # 归一化 Session / Turn / Message
│   ├── attribution/
│   │   ├── tokenize.ts         # 7 类 token 归因
│   │   ├── pricing.ts          # 模型定价 + 远程更新（zod 校验）
│   │   └── cost.ts             # cost / savings 计算器
│   ├── detectors/
│   │   ├── d0-noise.ts
│   │   ├── d1-tool-bloat.ts
│   │   ├── d2-cache-break.ts
│   │   ├── d3-dup-results.ts
│   │   ├── d4-oversize.ts
│   │   ├── d5-compactable.ts
│   │   └── index.ts            # 注册表 + Finding 类型
│   ├── identify/
│   │   └── profiles.ts         # 16 Agent 指纹（三层识别）
│   ├── render/
│   │   ├── terminal.ts         # 默认终端报告（picocolors + cli-progress）
│   │   ├── html.ts             # --html 单文件输出
│   │   └── json.ts             # --json
│   ├── tui/                    # v0.3：Ink components
│   │   └── watch.tsx
│   └── lib/                    # glob / fs / log / time 工具
├── tests/                      # vitest（与 src/ 同名 *.test.ts）
├── examples/                   # 脱敏样例请求体（小，便于复现）
├── assets/
│   └── pricing.json            # 内置定价快照
├── docs/
│   └── product/
│       └── agentgauge-prd.md   # 战略 PRD（仓内对外文档）
├── package.json
├── tsconfig.json
├── biome.json
├── tsup.config.ts
├── vitest.config.ts
├── LICENSE                     # MIT
└── README.md                   # 含 Credits & Prior Art + quickstart
```

---

## 工作约定

- **包管理**：pnpm（开发）；用户端用 `npx agentgauge` 或 `npm i -g agentgauge`。
- **文档位置**：仓内 `docs/product/agentgauge-prd.md` 是单一权威 PRD；`docs/INDEX.md` + `docs/AGENTS.md` 定义轻量 Spec-Driven 流程；策略性 / 增长向 / HN 帖子草稿留在 obsidian 不进本仓。
- **commit 格式**：`<type>: <description>`（feat / fix / refactor / docs / test / chore / perf / ci）。不加 AI 协作署名。
- **macOS AppleDouble**：`._*` 文件不要 commit；`.gitignore` 已包含。
- **任何提交前必跑**：
  ```
  pnpm test            # vitest
  pnpm biome check .   # lint + format
  pnpm tsc --noEmit    # 类型
  ```
- **永不抛异常的代码路径**：所有 analyze / parse / detector 路径对畸形输入返回降级结果或空对象，不得 crash。`parsers/` 必须能跑通 fuzzer 级别的损坏 JSONL。
- **不引入网络副作用**：除 `update-pricing` 子命令外，任何模块都不允许 import `node:net` / `node:http` / `fetch` 做出站请求。隐私承诺是 HN 信任基础。

---

## 算法参考来源（不是代码搬运）

> Synrouter 闭源 monorepo 中以下模块只作为**算法心智模型**参考，不直接复制粘贴。

| 算法主题 | Synrouter 参考位置 | agentgauge 重写位置 |
|----------|----------------------|---------------------|
| 双格式 tool_use_id → (name, input) 索引 | `transform/tool_compress/tool_index.py` | `src/parsers/types.ts` 内联 |
| 三层 Agent identify | `transform/session_fingerprint.py` | `src/identify/profiles.ts` |
| Agent quirk 注释（16 Agent 全量） | `transform/tool_compress/agent_registry.py` | `src/identify/profiles.ts` 注释段 |
| L0 五阶段噪声估算 | `transform/tool_compress/l0_noise.py` | `src/detectors/d0-noise.ts` |
| cache_control 注入逻辑（仅参考，不实现） | `transform/cache_inject.py`（SPEC-002） | 不实现，标 ⚡ 指向 synrouter |
| tool_result 截断阈值（仅参考） | `transform/tool_trim.py`（SPEC-003） | `d4-oversize.ts` 用其阈值常量 |

**规则**：读懂 → 提炼算法 → TypeScript 重写 → 在 PR 描述里注明"算法参考自 synrouter 的 X 模块"。**不复制任何 synrouter 内部命名**（`sk-sr-*` / `x-synrouter-*` / `synrouter_gateway.*`），用中性命名。

### 开源竞品参考（ccusage / agentsview，均 MIT，已拉到本地）

> `~/Documents/AI/github/ccusage`（Rust 核心）/ `~/Documents/AI/github/agentsview`（Go）。语言不同无法直接复用，规则同上：读懂 → TS 重写 → PR 注明出处。**逐需求的精确参考映射维护在各 SPEC 的 design.md "现有实现参考"一节**，此处只列主题：

| 算法主题 | 参考位置 | agentgauge 落点 |
|----------|----------|-----------------|
| JSONL 去重（messageId+requestId / sidechain replay / chunk 合并） | ccusage `adapter/claude/mod.rs` + agentsview `parser/claude.go` | SPEC-AG-001, R4（缺此会系统性双重计数） |
| 多目录发现 + 容错 + null 字段防御 | ccusage `adapter/claude/paths.rs` / `mod.rs` | SPEC-AG-001, R1/R2 |
| cache 计费细节（5m/1h ephemeral、200k tier）+ costUSD 三态 + 模型 ID 归一化 | ccusage `cost.rs` / `pricing.rs` | SPEC-AG-002, R4 |
| 系统注入消息分类 / compact 边界 / usage probe 过滤（误报防御） | agentsview `parser/claude.go` | SPEC-AG-001, R3 打标 → SPEC-AG-003 消费 |
| 多 agent 归一化模型 + registry（25 agent 路径清单） | agentsview `parser/types.go` | SPEC-AG-001, R3 / SPEC-AG-006, R2；v0.2 Codex parser 的主参考是 `parser/codex.go` |

---

## RTK 致谢三处（不可缺）

agentgauge 的 L0 噪声估算思路源自 [RTK (rtk-ai/rtk, MIT)](https://github.com/rtk-ai/rtk)。三处致谢缺一不可：

1. **README 顶部** `Credits & Prior Art` 段落（RTK + MIT + 链接 + 一句"they pioneered this at the CLI layer; we measure it at the session-log layer"）。
2. **`src/detectors/d0-noise.ts` / 噪声相关模块文件头注释** 保留 "noise detection adapted from RTK"。
3. **HN / Reddit launch 帖子正文** 主动提 RTK。

---

## 测试与质量门

- **覆盖率目标**：核心模块 (parsers / attribution / detectors) ≥ 80%；render / cli ≥ 60%。
- **关键纯函数**测试用真实 fixture（`examples/` 脱敏样例）而不是 mock。
- **黄金报告测试**：`render/terminal.ts` 和 `render/html.ts` 用 snapshot 测试锁住输出格式，防止偷偷改坏 UX。
- **CI 必跑**：`pnpm test` + `pnpm biome check` + `pnpm tsc --noEmit`，三个绿才能 merge。

---

## v0.1 实施指令（自主执行 / goal 模式用）

> 本节面向自主完成 v0.1 全量开发的 AI Agent（Codex /goal、Claude Code 长任务等）。目标的**达成标准**由调用方的 goal 文本定义；本节是过程约束——**违反红线视为目标未达成**。

### 阅读顺序（写代码前读完）

1. 本文件（仓库根 `AGENTS.md`）——行为准则、技术栈决议、工作约定、算法参考红线
2. `docs/AGENTS.md` ——工作流规则、`@spec`/`@prd` 注解格式、PRD 变更同步清单
3. `docs/INDEX.md` ——6 个 SPEC 状态表、依赖图、FR↔SPEC↔文件映射
4. `docs/specs/SPEC-AG-001~006/` 各自的 prd.md + design.md + tasks.md ——**唯一需求权威**；产品背景查 `docs/product/agentgauge-prd.md`（重点 §5 CLI 契约、FR-AG-2 残差归因、FR-AG-4 检测器表）

文档间冲突：SPEC 之间矛盾以 PRD 为准并停下报告；本节与 SPEC 矛盾以 SPEC 为准。

### 实施顺序（严格按依赖图，每个 SPEC 三个质量门全绿后再进下一个）

```
0. 脚手架：pnpm + tsup + biome + vitest + citty；tsconfig strict + noUncheckedIndexedAccess；
   ESM 主、tsup 双发 CJS；engines.node >= 18
1. SPEC-AG-001 claude-code-parser   ← 地基，含 examples/ fixture 制作
2. SPEC-AG-006 agent-identify       ← 小，且 003 的 D1 依赖它
3. SPEC-AG-002 token-attribution
4. SPEC-AG-003 detectors-d0-d5
5. SPEC-AG-004 report-rendering
6. SPEC-AG-005 cli-interface        ← 编排收口
```

### 每个 SPEC 的工作循环

1. 读三件套；design.md "现有实现参考"表指向本地竞品仓库——读懂算法后 **TypeScript 重写**，禁止逐行翻译，commit 注明"算法参考自 X"
2. 测试先行：用 `examples/` 真实 fixture，不用 mock
3. 实现；关键导出函数加 `@spec SPEC-AG-XXX, R<N>` 注解
4. 质量门：`pnpm test` + `pnpm biome check .` + `pnpm tsc --noEmit` 全绿
5. 勾掉 tasks.md（附日期）；SPEC 完成时 INDEX.md 状态改 `implemented` 并回填映射表文件列
6. 每 SPEC ≥ 1 个 commit（`<type>: <description>`，无 AI 署名），body 概述实现了哪些 R

### 红线（违反 = 返工）

- **价格刷新**：`update-pricing` 默认从 LiteLLM 拉取价格表；其他路径不应依赖网络。
- **永不 crash**：parsers / attribution / detectors 对畸形输入降级返回；损坏 JSONL 行 = 跳过 + 计数
- **fixture 隐私**：制作 fixture 时可读本机 `~/.claude/projects/**/*.jsonl` 验证字段结构，但**落盘进仓库的 fixture 必须合成或彻底脱敏**（路径、项目名、对话内容全换占位值；usage 数字保持真实形状）。SPEC-AG-001 数据表中标"本机 fixture 待复核"的两项（重复计费记录、AgentProgress 包装），制作 fixture 时顺手验证并把结论更新回该表
- **RTK 致谢**：`src/detectors/d0-noise.ts` 文件头必须含 `noise detection adapted from RTK (https://github.com/rtk-ai/rtk, MIT)`
- **不复制 synrouter 内部命名**；竞品代码只读不抄
- **usage 是 ground truth**：归因各段之和恒等于 API usage 总量（SPEC-AG-002 R1 是属性测试，不是注释）

### 已知决策（已定，别重新发明）

- 时间窗口 flag 是 `--last [7d|24h]`（不是 `--last-7d`）；T-AG-005.1 要求把该语法回写 PRD §5.4.1，改后按 `docs/AGENTS.md` 同步清单核对联动文件
- tokenizer 用 js-tiktoken，只算相对比例再按 usage 缩放
- 残差估算两段（system_prompt / tool_definitions）输出永远带 `~` / `estimated: true`
- JSONL 去重（SPEC-AG-001 R4）是 P0
- HTML 报告 < 80KB 单文件；JSON `schema_version: 1` 只增不删（契约测试锁定）

### 卡住时

- SPEC 矛盾或数据假设被实测推翻：**停下**，写清矛盾点与建议解法再继续，不静默改需求
- 阈值 / 文案级小决策自己定，commit body 说明
- 每完成一个 SPEC 汇报：质量门结果、勾掉的任务、下一个 SPEC

---

## 规则引用

- 默认继承 `~/.claude/rules/common/*` + TypeScript / Node 语言规则；若做 TUI（Ink），叠加 `~/.claude/rules/web/*`（React 通用规则适用 Ink）。
- 项目级 > 全局级，本文件优先。
