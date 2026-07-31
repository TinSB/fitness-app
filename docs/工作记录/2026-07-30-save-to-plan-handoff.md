# 交接件：练完存回计划（FR-TR14 收官件）

> 日期：2026-07-30 ｜ 来源：FR-TR14 S2（#720）明确切出的最后一块，owner 拍板「下一批」
> 性质：**新写闸消费面**——把本场真实训练构成显式写进长期计划（planCustomization）
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话（多 lens + 对抗核验）
> 分支：`codex/0730-save-to-plan`（基线最新 origin/main `267188d`）

## 为什么

FR-TR14 S1/S2 让用户能在训练现场调整今天怎么练，但**所有调整都只活一场**。PRD :140 早写明第三块：「训练结束后显式保存到长期计划」。用户在健身房发现「面拉这器械总被占，换成绳索后束更顺手」「该加个二头了」——这是关于计划的真实意见，现在每次都要练完再去计划页手动重做一遍。

## 现场事实（已核实，勿重查）

| 环节 | 现状 |
|---|---|
| 计划自定义存储 | canonical open-bag `planCustomization.dayPlans[dayCode].exercises[{exerciseId,...}]`；域视图 `AppData.swift:156-190`（结构防御读） |
| **写入 API（可直接复用）** | `CanonicalSessionWriter.applyCustomDayPlan(dayCode:exercises:)`（:588，**整日全量覆盖**，走 performGatedMutation）/ `removeCustomDayPlan(dayCode:)`（:607，= 恢复默认，键消失；容器全空则整段置 nil）。App 层 `SessionStore.swift:1113/1119` 走 `performPlanWrite`（:1080，isSaving 互斥 + planSaveErrorText） |
| 现役编辑器只写 id | `PlanDayEditorView.swift:507`：`exerciseIds.map { CustomExerciseItem(exerciseId: $0) }`——**从不写 sets/reps/rest 覆盖**（本批同口径，见裁定 B） |
| 收敛语义 | `PlanDayEditRules.applyResolution`（`PlanDayEditModel.swift:204`）→ `.writeCustom/.clearCustom/.noop`：与默认模板等价的构成不留冗余覆盖 |
| sessionEdits 留痕 | `CompletedSessionBuilder.swift:122-141` 落 `{added:[{exerciseId,position}], removed:[...]}`；**全仓零读取方**（本批是首个消费者） |
| 会话最终队列 | 权威真源 = `flow.plan.exercises`（保存时的最终有序队列）；**落盘里没有它**——落盘 exercises[] 在 #721 后含 occurrence 拆分元素（A,B,A 三段），直接拿它当构成会重复 |
| dayCode 时序陷阱 | `appendCompletedSession` 在同一事务里**消费并清掉 oneTimeDayOverride**（`CanonicalSessionWriter.swift:124-136`）。保存后取 dayCode **必须**读落盘 `storage["templateId"]`（`loadCompletedFacts` :321-332 已是这条路），绝不能读 appData.oneTimeDayOverride |
| 练完态行先例 | #719 MLE 升级行（`TodayTabView.swift:1074-1109` + `TodayBreakthroughPresentation.rows` :6-37）：`.shareable`=Button+图标+chevron / `.factOnly`=无按钮同构行；数据在 `loadCompletedDigest()` :931-960 一次取 |
| 撤销条基础设施 | `UndoBanner`（TodayTabView.swift:1402-1412）+ 根 overlay :183-188 + `undoBannerView`——FR-TR6 永久换已用它做 5s 撤销 |
| 引擎消费自定义 | `customSlots`（`TodayPrescriptionEngine.swift:370-413`）：每个自定义动作 → `userPinned:true` 槽（优先级最高，高于 sticky/substitutions）；槽参数取同 pattern base 槽，**查不到用确定性兜底 8/12/90s/RIR2.0**；全被过滤空则回退默认模板 |
| 存回后下次目标 | 本场真做过组 → 正常进阶分支（有 lastPerformance）；本场零事实 → 首练分支（ColdStartPrior，`change=.start`） |
| PRD 边界原文 | :140「存回计划保持关闭」；:142「不得把 Plan 编辑器、目录浏览器或**存回计划写闸**搬进 Train」；:172 非目标「不给某 dayCode 增加默认模板没有的全新 pattern 槽（后置，单独立项）」；系统逻辑 :230/:1154「未实现前不得出现假入口」 |
| L10n | `存回/saveToPlan` 全仓零命中，全部新串 |
| 钩子缺口 | 无 summary-phase 专用钩子；Today 练完态需新增 `-autoSaveSessionToPlan` 类钩子（Simulator 无法交互点 sheet 内行） |

## 裁定 A：入口 = 今日页练完态块的一行（不在训练小结 sheet）

盘点后**改判**（初始倾向是小结页）——理由写死，防实施方摇摆：

1. **事务干净**：训练已落盘成功，存回是**独立的第二次显式写**，失败面独立（绝不会出现「训练没存上但计划已改」）。挂小结页则两次 canonical 写耦合在一个按钮里，失败态组合爆炸。
2. **不动小结页唯一出口结构**（`interactiveDismissDisabled(true)` + 440pt detent 已满）。
3. **行先例现成**：与 #719 MLE 升级行同构（同一个块、同样的 44pt 行、同样的一次性数据加载）。
4. **产品时刻正确**：练完回今日页是回顾时刻；小结页那一刻用户还在喘气，只想点保存。
5. 过天自然消失（练完态块本来只当天存在），**天然一次性、不需要已读回执**。

行形态：`ForEach` 之后、分享行之前；文案两段式——**事实句 + 动作**，如「今天加了 哑铃弯举，去掉了 面拉」+「存进计划」（chevron 形态沿 MLE 行）。多项时按「加 N 个、去掉 N 个」概括，不逐条列超过 2 个。

## 裁定 B：存回什么（范围写死）

**进计划**：本场最终的**动作构成与顺序**（exerciseId 有序数组）。加的、删的、换的（换入动作）自然体现在最终队列里。

**不进计划**（逐条写死，防扩大）：
- ❌ **组数**：今天状态好加一组 ≠ 以后每次多一组。本批**只写 exerciseId**，与现役编辑器完全同口径（不写 sets/repMin/repMax/rest 覆盖）。
- ❌ **重量/次数快速调整**：本来就是引擎按历史学习，写死进计划反而伤进阶。
- ❌ **临时换天（FR-TR12）**：换天有自己的二选一语义（只换今天/以后都按这个顺序），不由本批承载。
- ❌ **不碰 `exerciseSubstitutions`**（FR-TR6「以后都换」的表）：两套机制独立共存；存回写 planCustomization 后 userPinned 优先级最高，行为一致无冲突。

## 裁定 C：数据来源 = 新增 open-bag `finalExerciseOrder`

⚠️ 不要从落盘 `exercises[]` 重建最终构成——#721 已证明 occurrence 拆分后按元素重建极易出错（A→B→A 会重复、skip-only/零 sets carrier 会混入）。

- `CompletedSessionBuilder` 新落 **open-bag `finalExerciseOrder: [String]`** = 保存时 `flow.plan.exercises.map(\.exerciseId)`（本场最终队列，**保序、不去重**——自由日序允许重复 id）。不 bump schema；无编辑的场同样落（它是本场事实，不是编辑审计）。
- ⚠️ 但**零回归红线**：既有 golden 字节 fixture 会因新字段变化——本批允许 golden 基线随该字段更新，但必须：①明确在回执写出哪些 fixture 因此重捕获 ②新字段之外的字节零差异（逐字段 diff 证明）。
- 存回读取：仿 `loadCompletedFacts`（`SessionStore.swift:321-332`）按 sessionId 直读 storage key，取 `finalExerciseOrder` + `templateId`（dayCode）+ `sessionEdits`（仅用于**判断是否显示入口**与文案措辞，不作为构成真源）。
- **occurrence identity 选项 1（#720 裁定 C 留的提案）不开**：本批要的是「最终构成是什么」的状态，不是逐 occurrence 差分对账，`finalExerciseOrder` 直接给出答案。该提案继续留案。

## 裁定 D：写入语义

1. **目标构成** = `finalExerciseOrder` 去掉「本场零事实且被移除」的动作（移除的本就不在最终队列里，天然满足）；保序、允许重复 id（自由日序先例）。
2. **收敛**：复用 `PlanDayEditRules.applyResolution` 口径——目标构成与该 dayCode 的**默认模板**等价 → 调 `removeCustomDayPlan`（回归默认，不留冗余覆盖）；否则 `applyCustomDayPlan`。
3. **no-op 不写不显示**：目标构成 == 当前有效构成时，**入口整行不出现**（沿 FR-TR6 永久换的诚实校验先例：不做无效果的假动作）。
4. **失败如实**：走 `performPlanWrite` 既有错误面，失败在行内如实呈现，不假成功、不静默。
5. **撤销**：写前取旧 dayPlan 快照（可能是 nil=当时无自定义），成功后给 **5s 撤销条**（复用既有 `UndoBanner` idiom，不新造栈）；撤销 = 写回快照（nil → `removeCustomDayPlan`）。过期后靠计划编辑器手动改（FR-PL6 已有完整增删改与恢复默认）。
6. **dayCode 取 `templateId`**（落盘值），绝不读 `oneTimeDayOverride`（已被消费清空）——时序陷阱写进注释。
7. 存回后 `loadToday()` + 计划页 projection 需按既有合同显式 reload（`SessionStore.swift:1102-1103`）。

## 裁定 E：pattern 越界——允许，同批解除 PRD :172 对本路径的限制

会话 picker 只受器械白名单约束，用户可能加了该日默认模板没有的 pattern（推日加二头）。

- **允许存回**：用户在健身房**实际练了**这个动作，这是最强的意图证据；`customSlots` 对未知 pattern 已有确定性兜底（8/12/90s/RIR 2.0），不是未定义行为。
- PRD :172 非目标同批**精确改写**（不是删除）：保持「计划编辑器不提供新 pattern 槽入口」，新增「存回计划因基于真实训练事实，允许承载新 pattern；其槽参数走 customSlots 既有兜底」。理由写进 PRD 与系统逻辑。
- ⛔ 不为此改 `customSlots` 的任何塑形逻辑（引擎零改动）。

## 红线

1. ⛔ **引擎零改动**：TodayPrescriptionEngine（含 customSlots/塑形/优先级）、轮转、verdict、周口径、疼痛保守态、sticky/替换链（#721 刚定）一律不碰。
2. ⛔ 不 bump schema；只加 open-bag `finalExerciseOrder`；planCustomization 结构与四 writer 签名不变。
3. ⛔ 不把计划编辑器/目录浏览器搬进 Train（PRD :142）——本批入口在 **Today**，训练页零改动（连行都不加）。
4. ⛔ 零弹窗、零确认框、零说教、零逐条勾选表单（一句事实 + 一个动作；想精调去计划编辑器）。
5. ⛔ 不碰 exerciseSubstitutions、FR-TR12 换天语义、组数/重量任何写回。
6. ⛔ 已落盘历史不迁移；版本号不动；不 push、不开 PR。

## 验收标准（owner 大白话）

1. 训练中加了个哑铃弯举、去掉了面拉 → 练完回今日页看到「今天加了哑铃弯举，去掉了面拉」+「存进计划」；点一下，下次这天就按新构成练
2. 存错了 → 5 秒内能撤回；过了也能去计划页改
3. 什么都没改的训练 → 今日页完全看不到这一行（不打扰）
4. 存回后那天的动作顺序、构成跟我练的一样；重量还是引擎按我的历史给（没被写死）
5. 临时换天练的那场存回 → 存到我实际练的那天，不会存错天
6. 存回的动作如果本场练过 → 下次它有正常重量（不是从零开始）

## 验证与证据

1. **测试先红后绿**：`finalExerciseOrder` 落盘（含 A→B→A、加/删组合、无编辑场）；存回构成计算（去重语义/保序/重复 id）；收敛（等价默认 → clearCustom）；no-op 不显示；dayCode 取 templateId（**FR-TR12 换天场专测**）；撤销写回快照（含 nil→remove）；失败态；pattern 越界动作可存回且下场处方走 customSlots 兜底（builder→clean→plan 跨层集成）。
2. **golden**：明确列出因 `finalExerciseOrder` 重捕获的 fixture，并逐字段证明其余字节零差异；不使用编辑功能的用户全链行为不变。
3. **canonical 实证**：存回后实读 `planCustomization.dayPlans[dayCode].exercises`；撤销后实读恢复；等价默认时实读键消失。
4. **模拟器实拍**（装前真 build、前台确认、md5 互异）：①练完态存回行 ②点后撤销条 ③计划页/编辑器显示新构成 ④无改动场无此行。前缀 `2026-07-30-savetoplan-`。新钩子（如 `-autoSaveSessionToPlan`）自定并写回执。
5. 门禁 exit 0。
6. **规格写回**：PRD FR-TR14（存回计划从「保持关闭」改为已实现 + 边界注）、:142（入口在 Today 非 Train 的澄清）、:172（裁定 E 精确改写）；系统逻辑 §5 写入合同（finalExerciseOrder + 存回写闸）、§6.0.3（:230/:242 的「未实现」表述更新）、§7（:1154 反向断言更新）；TestFlight 清单 **N14 的反向断言「全程没有存回计划入口」必须改写**，新增 N16 存回验法；文案基线新串；CHANGELOG/DEV_LOG。

## 顺带项（可选，成本超 30 行就留案并报备）

数据质量提示在同场同 id 多 occurrence 时重复显示「第 1 组」定位（`ProgressEngineCopy.swift:231` suspectWeightLine/suspectRepsLine，#721 报备的 P3）：若能以低成本消歧（如同 id 多 occurrence 时补序数），顺手修；否则原样留案。

## Git 纪律

`git fetch` 后从 `origin/main`（267188d）拉 `codex/0730-save-to-plan`；commit 前 `git status`；明确 pathspec 禁 `-A`；落盘/读取/UI/文档分步提交。

## 停止条件

- 同一问题修 3 次不过即停。
- 触红线、行为歧义（尤其：`finalExerciseOrder` 与既有 golden/消费面冲突、存回构成与 planCustomization 结构防御读冲突、撤销快照语义与 planAdjustmentHistory 栈产生歧义）→ **立即停下回报，不自行改裁定**。

## 实施回执模板（收尾必填回填本文件末尾）

```
## 实施回执
- 分支与 commit 清单
- A 入口：[行形态 + 出现条件 + 与 MLE 行共存]
- B/C 数据：[finalExerciseOrder 落盘 + 读取路径 + golden 重捕获清单与零差异证明]
- D 写入：[收敛/no-op/失败/撤销/dayCode 时序]
- E pattern：[越界处理 + 规格改写]
- 跨层集成：[存回后下场处方证据]
- gate / 实拍 / 规格写回 / 顺带项 / 未尽事项
```
