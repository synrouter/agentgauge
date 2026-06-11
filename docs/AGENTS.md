# agentgauge — Agent 指南

> AI 编码 Agent 在此仓库上工作的入口。**轻量 Spec-Driven 流程** —— 只为真正复杂的改动写 SPEC，简单任务直接动手。

## 任务分类（先判断，再行动）

| 任务类型 | 处理方式 | 示例 |
|---------|---------|------|
| **简单任务** | 直接编码，跳过 SPEC 探索 | bug fix、文案修改、小功能追加、单文件改动、用户给出了具体文件路径 |
| **复杂任务** | 走规范驱动流程 | 新检测器、新 parser、跨层改动、报告格式重构、需要理解产品需求的改动 |

**快速通道**：用户给出了明确的目标 + 文件路径/具体改动 → 直接读源码开干，不要再读 prd/design/tasks。

**判断标准**：如果不确定属于哪类，默认走简单路径——最多先快速 search 定位到相关文件，而不是逐层加载 SPEC 文档。

> agentgauge 是一个紧凑的 CLI 工具，比 synrouter 那种 monorepo 简单一个数量级。**绝大多数改动都是简单任务**。SPEC 流程只用于：新增检测器、新增 parser、引入代理/TUI 等模式型功能。

## 规范驱动开发（仅复杂任务）

此仓库使用稳定的需求 ID，用于跨文档追溯。

1. 在 `docs/INDEX.md` 中找到相关 SPEC。
2. 按需读 `prd.md` / `design.md` / `tasks.md`，不要求全都读完。
3. 关键函数加 `@spec SPEC-AG-XXX, FR-Y.Z` 注解。
4. 完成后更新 `tasks.md`。

### Spec 注解格式（TypeScript）

```typescript
/** @spec SPEC-AG-002, FR-2.1 — 7 类语义角色 token 归因 */
export function attribute(turn: Turn): Attribution { /* ... */ }
```

也接受单行紧凑注解：

```typescript
// @spec SPEC-AG-004, FR-4.3
const detectors = [d1ToolBloat, d2CacheBreak, /* ... */];
```

## 创建新规范

如需新增 SPEC：

1. 从 `docs/specs/_template/` 复制三件套（`prd.md` + `design.md` + `tasks.md`）到 `docs/specs/SPEC-AG-XXX-<kebab-name>/`
2. 分配下一个未使用的 SPEC ID（见 `docs/INDEX.md` 表）
3. 在 `docs/INDEX.md` 注册一行
4. PRD 里相关章节如果存在对应需求，在文末加 "对应 SPEC: SPEC-AG-XXX"

**SPEC 粒度建议**：一个 SPEC 对应一个相对独立的功能模块或一类改动，约 3-10 个 FR。不要为单一函数立 SPEC，也不要把整个 v0.1 塞进一个 SPEC。

## 仓库布局

```
src/
├── cli.ts                  # 入口（citty）：analyze / sessions / doctor / update-pricing
├── parsers/                # session 文件解析（Claude Code / Codex / ...）
├── attribution/            # 7 类 token 归因 + 定价 + 成本计算
├── detectors/              # D1-D5 检测器 + 注册表
├── identify/               # Agent 指纹识别
├── render/                 # terminal / html / json 输出
├── tui/                    # v0.3：Ink components
└── lib/                    # glob / fs / log / time 工具

tests/                      # vitest（与 src/ 同名 *.test.ts）
examples/                   # 脱敏样例请求体
assets/pricing.json         # 内置定价快照

docs/
├── INDEX.md                # 本文件索引 + SPEC 状态表
├── AGENTS.md               # AI Agent 工作流规则（本文件）
├── product/                # 产品战略、PRD（agentgauge-prd.md 主文档）
├── specs/                  # 功能规范 SPEC-AG-001+（轻量 Spec-Driven）
├── growth/                 # 增长、HN/Reddit launch 文案（按需创建）
└── competitive/            # 竞品分析（按需创建）
```

## 文档存储规则

新文档必须放入对应的子目录，**禁止直接在 `docs/` 根目录创建文件**：

| 文件类型 | 存放位置 | 命名规范 |
|---------|---------|---------|
| 功能规范（PRD/Design/Tasks） | `docs/specs/SPEC-AG-XXX-name/` | `SPEC-AG-XXX-{kebab-case}/` |
| 产品战略/调研/术语 | `docs/product/` | `{topic}.md` |
| 增长/SEO/launch 文案 | `docs/growth/` | `{topic}.md` |
| 竞品分析 | `docs/competitive/` | `{topic}.md` |
| 归档（已废弃但需保留） | `docs/archive/` | 原文件名保持不变 |

`docs/` 根目录仅保留 2 个文件：`INDEX.md`、`AGENTS.md`。

> **战略性 / 增长向 / HN 帖子草稿**：参考 `agentgauge` 仓库根 `AGENTS.md` 的约定 — 这类未定型的文档留在 obsidian，**不进本仓**。仓内文档面向开发者和未来贡献者。
