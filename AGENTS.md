# agentgauge

> 开源 CLI + 常驻客户端：看清你的编码 Agent 把 token 花在哪了。
> 读取本地 Agent 日志/请求体，按轮次·工具拆解 token 去向，指纹识别 Agent，估算工具输出中可压缩的噪声。
> 公开仓库（MIT）：`github.com/synrouter/agentgauge`。策略/规划文档留在 obsidian，不进本仓。

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
- **产品形态**：CLI（一次性分析）+ 常驻客户端（tail 本地日志，菜单栏/TUI 近实时展示），对标 ccusage + codexbar 的使用体验，但占据它们没占的位：**token 浪费在哪个工具、有多少可压缩**。
- **核心能力三件套**：
  1. **identify** — 三层 Agent 识别（header > 工具签名 > 提示词），输出 agent + confidence。
  2. **breakdown** — token 归因：per-section（system/tools/message/tool结果）+ per-tool 排序。
  3. **noise** — L0 噪声估算（ANSI/进度条/重复行），衡量工具输出"可压缩"比例。
- **隐私承诺**：纯本地、零网络、零数据库、零上传。这是相对竞品的硬差异，也是 HN 信任基础。
- **与 Synrouter 的边界**：agentgauge 只**测量**不**改写**。在途压缩/缓存/计量归因/飞轮全部留在闭源 Synrouter。

完整设计文档（不进本仓，留在 obsidian）：
- `市场/Hacker News/agentgauge-产品设计文档.md`

---

## 仓库结构（规划）

```
agentgauge/
├── agentgauge/
│   ├── __init__.py          # 版本号 + 包级 docstring（含 RTK 致谢）
│   ├── cli.py               # CLI 入口：analyze / savings / agents
│   ├── tool_index.py        # 双格式 tool_use_id → (name, input) 索引（纯函数）
│   ├── profiles.py          # 16 Agent 指纹库 + 三层 identify()
│   ├── breakdown.py         # token 归因：per-section + per-tool
│   ├── noise.py             # L0 噪声估算（adapted from RTK）
│   ├── logs.py              # [v0.2] 本地 Agent 日志读取
│   └── daemon/              # [v0.3+] 常驻后台：tail 日志 + 增量聚合 + IPC
├── examples/                # 脱敏样例请求体
├── tests/                   # pytest 单测
├── pyproject.toml
└── README.md                # 含 Credits & Prior Art + 16 Agent 表 + quickstart
```

> 语言/形态最终选型见设计文档 Q1。核心库语言与常驻 GUI 客户端语言可不同（库一种、客户端一种）。

---

## 工作约定

- **包管理**：Python 侧统一用 `uv`（与 synrouter 一致）。
- **文档位置**：策略/PRD 文档留在 obsidian，**不进本仓**；仓内只放面向用户的 README 与开发者 docs。
- **commit 格式**：`<type>: <description>`（feat / fix / refactor / docs / test / chore / perf / ci）。不加 AI 协作署名（全局 `~/.claude/settings.json` 已禁用）。
- **macOS AppleDouble**：`._*` 文件不要 commit；安装 wheel 前若被干扰，先 `find . -name "._*" -delete`。
- **任何提交前**：至少跑 `pytest -q` 与 `ruff check`。
- **Python 版本**：兼容 3.9+（本机系统 python 是 3.9.6）。从 synrouter 移植的代码用 3.10+ 语法（`tuple[...]` / `X | None`），移植时**必须降级为 3.9 兼容**（`Tuple`/`Optional`，`from __future__ import annotations`）。

---

## 从 Synrouter 移植代码的脱敏红线（CRITICAL）

> 本仓为公开 MIT 仓库。任何从私有 monorepo 抽取的代码，发布前必须脱敏。

| 源（私有 monorepo） | 处理 |
|---|---|
| `transform/tool_compress/tool_index.py` | 直接搬（纯函数，无敏感信息），降级 3.9 语法 |
| `transform/session_fingerprint.py` 的三层 identify + 工具签名 | 抽出 → profiles.py；**改 `x-synrouter-agent` → `x-agent-hint`**；去掉 fingerprint compute / mode 推断中的内部字段 |
| `transform/tool_compress/agent_registry.py` 的 quirk 注释 | 抽出 quirk 文字 → profiles.py 的 notes；**去掉 trim_head_tokens / l1_filter_set / protected_tools 等内部调参** |
| `transform/tool_compress/l0_noise.py` | 抽出 L0 五阶段 → noise.py；**`[synrouter: ...]` 标记改中性文案**；保留 RTK 致谢 |
| 任何 `sk-sr-*` / Supabase URL / LiteLLM / DB / fly / 内部域名引用 | ❌ 一律删除，不得出现 |

**发布前红线 grep（必须 0 命中）**：

```bash
grep -rEi 'synrouter|sk-sr|supabase|litellm|mggworks|fly\.io|x-synrouter' . \
  --include='*.py' --include='*.md' --include='*.toml'
```

**RTK 致谢三处，缺一不可**：
1. README 顶部 `Credits & Prior Art` 段落（RTK + MIT + 链接 + "they pioneered this at the CLI layer; we measure it at the API/log layer"）。
2. `noise.py` 文件头注释保留 "adapted from RTK"。
3. HN 帖正文主动提 RTK。

---

## 测试与质量门

- `pytest -q`，覆盖率目标参考 `~/.claude/rules/common/testing.md` 的 80%。
- 关键模块（tool_index / profiles / noise / breakdown）开 `mypy --strict`。
- **永不抛异常**：所有 analyze 路径对畸形输入返回空/降级结果，不得 crash（移植自 synrouter 的 `build_index` 已遵循此约定）。
- 提交前至少跑 `pytest -q` 与 `ruff check`。

---

## 规则引用

- 默认继承 `~/.claude/rules/common/*` + Python 语言规则；若做 GUI/前端，叠加 `~/.claude/rules/web/*`。
- 项目级 > 全局级，本文件优先。
