# DOCS_MANIFEST — 文档约束清单(活文档系统)

> 本仓库文档遵循「小固定活文档集」纪律:**只维护下面登记的 canonical 活文档,禁止新建顶层 .md 文档**。
> 目的:文档 = **约束项目的活规格**。在 clean rewrite 阶段,文档驱动新实现;旧代码只作参考库存,不反向覆盖产品真相。
> 要加一份新文档?——先在本清单登记(写清职责 + 为何现有的容不下),否则不许建。

## 一、Canonical 活文档(唯一真源 · 相关改动必须同步更新)

| 角色 | 文件 | 职责 | 何时必须更新 |
|---|---|---|---|
| **架构契约** | `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` | 铁律 · 包结构 · source-of-truth · 平台边界 · 禁用系统 · 验证和分支规则 | 任何架构 / 写路径 / 包边界改动 |
| **系统逻辑** | `docs/REDE_iOS_SYSTEM_LOGIC.md` | 全部功能 + 决策回路 + 干净重写目标 / reference inventory / 缺口状态 | 任何引擎 / 决策逻辑 / 功能改动 |
| **决策日志** | `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` · `docs/CLOUD_DECISIONS_ARCHIVE.md` | iOS 原生账号 / 云 / 同步 / CRDT / watchOS 的未来决策记录;不授权第一版干净 runtime | 任何架构 / 产品决策拍板 |
| **产品文案** | `docs/REDE_PRODUCT_COPY_BASELINE.md` | 产品定位 · 双语 voice/tone · UI / paywall / App Store / v0 文案基底 · 风险禁区 | 任何用户可见文案 / 双语 locale / onboarding / paywall / App Store 素材 / 原型生成文案变更 |
| **产品设计语言** | `docs/REDE_PRODUCT_DESIGN_LANGUAGE.md` | 视觉品牌 · 色彩 / 字体 / 形状 / 动效 · 核心组件隐喻 · App / landing / widget / v0 视觉生成基底；文案文档只管语言,视觉系统单独成文 | 任何用户可见 UI 视觉方向 / 原型生成 / App Store 截图 / landing page / widget 设计变更 |
| **路线图** | `COMMERCIALIZATION_ROADMAP.md` | 商业化 + 外部付费意向验证 + 干净重写路线 + 待办优先级 | 任何阶段 / 优先级变化 |
| **变更日志** | `CHANGELOG.md` | 逐次改动记录 | 每次 PR |

## 二、参考文档(留存 · 非每次更新)
- `docs/REDE_PRODUCT_OVERVIEW_CN.md` — 面向用户的功能说明
- `docs/US_MARKET_CONSUMER_ANALYSIS.md` — Diet Companion / Larder 饮食市场消费者研究;不是 Rede strength-training 的功能、定价或 GTM 证据
- `docs/REDE_iOS_DECISION_CIRCUIT.html` — 系统回路视觉参考,不得覆盖 `docs/REDE_iOS_SYSTEM_LOGIC.md` 或 Master Architecture
- **饮食子项目**:`docs/DIET_COMPANION_*.md` + `docs/diet-companion-*.html` + `docs/larder-*.html` + `docs/LARDER_ICON_EXPRESSION_GUIDE.md` + `docs/BLENDER_CLAY_*.md`(Blender 黏土图标构建简报) + `docs/competitor-food-visual-spectrum.html`(竞品食物视觉光谱分析)(成型后另立自己的 manifest)
- **Agent 支撑文档**:`docs/agents/domain.md` · `docs/agents/issue-tracker.md` · `docs/agents/triage-labels.md` — 只服务 agent 工作流和 issue triage,不覆盖产品/架构真源

## 三、仓库元(标准,不在约束内)
`README.md` · `AGENTS.md` · `CONTRIBUTING.md` · `SECURITY.md`

## 四、硬规则(同步写入 AGENTS.md,所有 agent / PR 遵守)
1. **改代码 → 必同步更新**受影响的 canonical 活文档(架构 / 系统逻辑 / 决策 / 路线图 / 变更)。clean rewrite 阶段以文档为目标真源;旧代码与文档不一致时,不得把旧代码当作必须保留的事实。
2. **禁止新建顶层 .md 文档。** 要加先改本 manifest 登记,否则 PR 拒收。
3. **超期 / 被取代内容**:归档进对应 canonical 文档或删除,**绝不另起新文件**。
4. **临时产物**(分析 / 审计 / headless prompt / 一次性调研)→ 放 `_scratch/`、`.ai-tmp/`(本地 gitignored scratch)或 outputs,**不进仓库文档树**。
5. 任何"现状盘点 / 系统逻辑 / 重写缺口"类描述,只允许更新到「系统逻辑」那份,不另写。

## 五、为什么有这份
本仓库曾累积大量散乱 .md(旧 Web 文档 + 迁移切片 + 一次性审计),边迭代边长草、互相过时、无法根治。本 manifest 把文档收敛成上面这一小撮活规格 + 硬规则,从根上挡住再次散乱。**新会话 / 新 agent 进来,先读本 manifest。**
