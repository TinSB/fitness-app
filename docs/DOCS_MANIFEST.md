# DOCS_MANIFEST — 文档约束清单(活文档系统)

> 本仓库文档遵循「小固定活文档集」纪律:**只维护下面登记的 canonical 活文档,禁止新建顶层 .md 文档**。
> 目的:文档 = **约束项目的活规格**,跟代码同步演进,不再散乱过时。
> 要加一份新文档?——先在本清单登记(写清职责 + 为何现有的容不下),否则不许建。

## 一、Canonical 活文档(唯一真源 · 相关改动必须同步更新)

| 角色 | 文件 | 职责 | 何时必须更新 |
|---|---|---|---|
| **架构契约** | `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` | 铁律 · 包结构 · §-章节 · §27 里程碑日志 | 任何架构 / 写路径 / 包边界改动 |
| **系统逻辑** | `docs/IRONPATH_iOS_SYSTEM_LOGIC.md` + `IRONPATH_iOS_DECISION_CIRCUIT.html` | 全部功能 + 决策回路 + 现状真相 | 任何引擎 / 决策逻辑 / 功能改动 |
| **决策日志** | `docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md` · `docs/CLOUD_DECISIONS_ARCHIVE.md` | 重做铁律 + 云/账号/同步已定决策 | 任何架构 / 产品决策拍板 |
| **路线图** | `COMMERCIALIZATION_ROADMAP.md` | 商业化 + 重做路线 + 待办优先级 | 任何阶段 / 优先级变化 |
| **变更日志** | `CHANGELOG.md` | 逐次改动记录 | 每次 PR |

## 二、参考文档(留存 · 非每次更新)
- `docs/IRONPATH_PRODUCT_OVERVIEW_CN.md` — 面向用户的功能说明
- `docs/US_MARKET_CONSUMER_ANALYSIS.md` — 美国市场消费者研究
- **饮食子项目**:`docs/DIET_COMPANION_*.md` + `docs/diet-companion-*.html` + `docs/larder-*.html` + `docs/LARDER_ICON_EXPRESSION_GUIDE.md` + `docs/BLENDER_CLAY_*.md`(Blender 黏土图标构建简报) + `docs/competitor-food-visual-spectrum.html`(竞品食物视觉光谱分析)(成型后另立自己的 manifest)

## 三、仓库元(标准,不在约束内)
`README.md` · `AGENTS.md` · `CONTRIBUTING.md` · `SECURITY.md`

## 四、硬规则(同步写入 AGENTS.md,所有 agent / PR 遵守)
1. **改代码 → 必同步更新**受影响的 canonical 活文档(架构 / 系统逻辑 / 决策 / 路线图 / 变更)。文档与代码不一致 = 未完成。
2. **禁止新建顶层 .md 文档。** 要加先改本 manifest 登记,否则 PR 拒收。
3. **超期 / 被取代内容**:归档进对应 canonical 文档或删除,**绝不另起新文件**。
4. **临时产物**(分析 / 审计 / headless prompt / 一次性调研)→ 放 `_scratch/`(已 gitignore)或 outputs,**不进仓库文档树**。
5. 任何"现状盘点 / 系统逻辑"类描述,只允许更新到「系统逻辑」那份,不另写。

## 五、为什么有这份
本仓库曾累积 520+ 散乱 .md(PWA 死文档 + 迁移切片 + 一次性审计),边迭代边长草、互相过时、无法根治。本 manifest 把文档收敛成上面这一小撮活规格 + 硬规则,从根上挡住再次散乱。**新会话 / 新 agent 进来,先读本 manifest。**
