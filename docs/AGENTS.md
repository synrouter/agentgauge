# agentgauge — Agent 指南

> AI 编码 Agent 在此仓库上工作的入口。**轻量 Spec-Driven 流程** —— 只为真正复杂的改动写 SPEC，简单任务直接动手。

## 任务分类（先判断，再行动）

| 任务类型 | 处理方式 | 示例 |
|----------|----------|------|
| **简单任务** | 直接编码，跳过 SPEC 探索 | bug fix、文案修改、小功能追加、单文件改动、用户给出了具体文件路径 |
| **复杂任务** | 走规范驱动流程 | 新检测器、新 parser、跨层改动、报告格式重构、需要理解产品需求的改动 |

**快速通道**：用户给出了明确的目标 + 文件路径/具体改动 → 直接读源码开干，不要再读 prd/design/tasks。

**判断标准**：如果不确定属于哪类，默认走简单路径——最多先快速 search 定位到相关文件，而不是逐层加载 SPEC 文档。是否需要**新立** SPEC 的详细判据见 [docs/INDEX.md §何时立 SPEC](INDEX.md#何时立-spec)（单一权威，此处不重复）。

> agentgauge 是一个紧凑的 CLI 工具，比 synrouter 那种 monorepo 简单一个数量级。**绝大多数改动都是简单任务**。

## 规范驱动开发（仅复杂任务）

此仓库使用稳定的需求 ID，用于跨文档追溯。

1. 在 `docs/INDEX.md` 中找到相关 SPEC。
2. 按需读 `prd.md` / `design.md` / `tasks.md`，不要求全都读完。
3. 关键函数加 `@spec` 注解（格式见下）。
4. 完成后更新该 SPEC 的 `tasks.md` 与 `docs/INDEX.md` 状态表。

### 代码注解格式（TypeScript）

两种形式，按是否已有 SPEC 选择：

```typescript
/** @spec SPEC-AG-002, R3 — sidechain 维度聚合 */
export function aggregateSidechain(turns: Turn[]): SidechainSummary { /* ... */ }

// 紧凑单行也可：
// @spec SPEC-AG-003, R2
```

尚无对应 SPEC、直接依据产品 PRD 实现的代码，用 `@prd` 指向 PRD 的 FR：

```typescript
// @prd FR-AG-6 — 默认脱敏，HTML/JSON 不含 tool_result 原文
```

> 命名空间约定：PRD 的需求是 `FR-AG-<N>`（平铺编号）；SPEC 内部的需求是 `R<N>`（SPEC 内自增），全称引用写作 `SPEC-AG-XXX, R<N>`。两套编号不混用，避免 `FR-AG-2` 与 "SPEC-AG-002 的第 1 条需求" 互相污染。

## PRD 变更同步清单（强制）

`docs/product/agentgauge-prd.md` 是单一权威文档，它的变更最频繁、也最容易造成文档漂移。**每次修改 PRD 后，按下表核对**：

| 改了 PRD 的什么 | 必须同步的文件 |
|------------------|----------------|
| 新增 / 修改 / 删除 FR | `docs/INDEX.md` 的 FR ↔ SPEC ↔ 文件映射表；受影响 SPEC 的 `prd.md`（`relates` 与正文引用） |
| §15 待决问题 Q 有了决议 | 无需另行登记（INDEX 不设 ADR 表，PRD §15 即决策记录）；如决议推翻了某 SPEC 的设计，更新该 SPEC 的 `design.md` |
| §7.4 仓库结构变化 | 回写仓库根 `CLAUDE.md` 的"仓库结构（实施版）"（docs/AGENTS.md 不再持有目录树拷贝） |
| §5 CLI 接口契约变化 | SPEC-AG-005 的 `prd.md` / `tasks.md` |
| 检测器表（FR-AG-4 / §8）变化 | `docs/INDEX.md` 映射表；SPEC-AG-003 |

## 创建新规范

如需新增 SPEC：

1. 从 `docs/specs/_template/` 复制三件套（`prd.md` + `design.md` + `tasks.md`）到 `docs/specs/SPEC-AG-XXX-<kebab-name>/`
2. 分配下一个未使用的 SPEC ID（见 `docs/INDEX.md` 表）
3. 在 `docs/INDEX.md` 注册一行
4. PRD 里相关章节如果存在对应需求，在文末加 "对应 SPEC: SPEC-AG-XXX"
5. **模板中的"数据依赖与可行性验证"段为必填**：凡依赖外部数据格式（session 日志字段、API usage 结构等）的需求，先用真实数据验证字段存在，再写进 SPEC

**SPEC 粒度建议**：一个 SPEC 对应一个相对独立的功能模块或一类改动，约 3-10 个需求（R1…RN）。不要为单一函数立 SPEC，也不要把整个 v0.1 塞进一个 SPEC。

## 仓库布局

权威目录树见 [PRD §7.4 仓库结构](product/agentgauge-prd.md)（与仓库根 `CLAUDE.md` 同步维护）。速记：`src/{cli,parsers,attribution,detectors,identify,render,tui,lib}` + `tests/` + `examples/` + `assets/pricing.json`。

## 文档存储规则

新文档必须放入对应的子目录，**禁止直接在 `docs/` 根目录创建文件**：

| 文件类型 | 存放位置 | 命名规范 |
|----------|----------|----------|
| 功能规范（PRD/Design/Tasks） | `docs/specs/SPEC-AG-XXX-name/` | `SPEC-AG-XXX-{kebab-case}/` |
| 产品战略/调研/术语 | `docs/product/` | `{topic}.md` |
| 增长/SEO/launch 文案 | `docs/growth/` | `{topic}.md` |
| 竞品分析 | `docs/competitive/` | `{topic}.md` |
| 归档（已废弃但需保留） | `docs/archive/` | 原文件名保持不变 |

`docs/` 根目录仅保留 2 个文件：`INDEX.md`、`AGENTS.md`。

> **战略性 / 增长向 / HN 帖子草稿**：参考 `agentgauge` 仓库根 `AGENTS.md` 的约定 — 这类未定型的文档留在 obsidian，**不进本仓**。仓内文档面向开发者和未来贡献者。
