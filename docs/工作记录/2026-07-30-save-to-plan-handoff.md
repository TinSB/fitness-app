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
| **既有编辑器写入 API / 本批新增窄能力** | 原编辑器继续使用 `applyCustomDayPlan`（整日全量覆盖）/ `removeCustomDayPlan`（恢复默认），均走 `performGatedMutation`。阻断 3/4 经 owner 显式解除后，本批另在同一 `CanonicalSessionWriter` 新增窄 `compareAndApplyCompletedSessionPlan` / `restoreCompletedSessionPlanDayRaw`，只服务最新 canonical 原子复核与 raw 撤销；既有四 writer 的签名和语义不变。 |
| 现役编辑器只写 id | `PlanDayEditorView.swift:507`：`exerciseIds.map { CustomExerciseItem(exerciseId: $0) }`——**从不写 sets/reps/rest 覆盖**（本批同口径，见裁定 B） |
| 收敛语义 | `PlanDayEditRules.applyResolution`（`PlanDayEditModel.swift:204`）仍负责普通 `.writeCustom/.clearCustom/.noop`；阻断 5 后，默认等价目标需先用现役引擎投影「清除该日 custom 后的真实有效构成」：仍等于目标才 clear/noop，sticky/substitution 会把它拉走则写必要的 `userPinned` 默认 IDs |
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

- `CompletedSessionBuilder` 新落 **open-bag `finalExerciseOrder: [String]`** = 保存时对 `flow.plan.exercises.map(\.exerciseId)` **保序去重、保留首次**（本场最终队列的单日动作合同）。不 bump schema；无编辑的场同样落（它是本场事实，不是编辑审计）。
- **2026-07-30 owner 修正：**原文「自由日序允许重复 id」引用错误并作废。FR-PL7 允许重复的是训练日序中的 **dayCode occurrence**，不是单个 dayPlan 内的 exerciseId；现役 `customSlots`、计划编辑器、`addExercise` 与替换候选均守单日 exerciseId 唯一。落盘即按 `customSlots` 同口径保留首次，保证写入构成 == 下场消费构成；occurrence-aware 计划消费继续留案，本批不做，引擎零改动红线不变。
- ⚠️ 但**零回归红线**：既有 golden 字节 fixture 会因新字段变化——本批允许 golden 基线随该字段更新，但必须：①明确在回执写出哪些 fixture 因此重捕获 ②新字段之外的字节零差异（逐字段 diff 证明）。
- 存回读取：仿 `loadCompletedFacts`（`SessionStore.swift:321-332`）按 sessionId 直读 storage key，取 `finalExerciseOrder` + `templateId`（dayCode）+ `sessionEdits`；`sessionEdits` **仅作为 add/remove 文案素材**，不参与入口资格、不作为构成真源。
- **occurrence identity 选项 1（#720 裁定 C 留的提案）不开**：本批要的是「最终构成是什么」的状态，不是逐 occurrence 差分对账，`finalExerciseOrder` 直接给出答案。该提案继续留案。

## 裁定 D：写入语义

1. **目标构成** = `finalExerciseOrder`（builder 已保序去重、保留首次）去掉「本场零事实且被移除」的动作（移除的本就不在最终队列里，天然满足）。
2. **条件收敛（2026-07-30 阻断 5 修正）：**比较基准与 no-op 守卫一律使用现役 `TodayPrescriptionEngine.plan` 从 clean input 投影的**真实有效构成**（即下次练该 `templateId` 日实际会拿到的 exerciseId 顺序，含 sticky 与永久 `exerciseSubstitutions`），不再把 raw 默认模板冒充当前有效构成。普通非默认目标仍复用 `PlanDayEditRules.applyResolution`。当 `target == defaults` 时，额外投影「只移除该 dayCode custom、保留全部 overlay」后的真实构成：若仍等于 target，已有 custom → `.clearCustom`、无 custom → `.noop`；若 sticky/substitution 会把默认拉走，则把这些默认 exerciseId 写成必要的 `userPinned` custom day。后者在做真实覆盖，不是冗余；绝不清除/改写 substitution 或 sticky。
3. **no-op 不写不显示 / 入口资格**：Today 加载时，目标构成 == 上述真实有效构成则**入口整行不出现**；只要两者不同且条件收敛不是 noop 才显示，天然覆盖纯重排。`sessionEdits` 只决定 add/remove 文案；两者皆无但构成不同（纯重排或换动作）显示中性事实句「今天调整了动作顺序」/ `You adjusted today's exercise order`，零说教、无句号。**2026-07-30 owner 补充裁定：**展示候选只喂入口与文案；点击时必须在同一次 gated mutation 内基于最新 canonical 重算 target、真实有效构成与条件收敛结果。最新状态已等价 → 不写、不备份、不报成功并隐藏陈旧入口；仍有差异 → 以最新状态执行写入。
4. **失败如实**：走 `performPlanWrite` 既有错误面，失败在行内如实呈现，不假成功、不静默。
5. **撤销**：实际写入瞬间，在上述同一次 gated mutation 内捕获 `dayPlans[dayCode]` 的 **raw `JSONValue` 节点**（键不存在则 nil），并记录本次写入是否创建了 `dayPlans` 容器；成功后给 **5s 撤销条**（复用既有 `UndoBanner` idiom，不新造栈）。撤销把非 nil raw 节点原样写回，绝不 typed decode→encode；nil 只移除目标 dayCode，只有 provenance 证明该空 `dayPlans` 容器由本次写入创建时才清理它。写前已有的空 `dayPlans:{}`、空 `daySequence:[]`、未知 dayPlan sibling、未知 item 键与 typed getter 会跳过的脏 item 均须恢复。该窄 raw mutation 复刻 #717 `planAdjustmentHistory` 在同一写闸内直接操作 raw 节点的先例；过期后靠计划编辑器手动改。
6. **dayCode 取 `templateId`**（落盘值），绝不读 `oneTimeDayOverride`（已被消费清空）——时序陷阱写进注释。
7. 存回后 `loadToday()` + 计划页 projection 需按既有合同显式 reload（`SessionStore.swift:1102-1103`）。

## 裁定 E：pattern 越界——允许，同批解除 PRD :172 对本路径的限制

会话 picker 只受器械白名单约束，用户可能加了该日默认模板没有的 pattern（推日加二头）。

- **允许存回**：用户在健身房**实际练了**这个动作，这是最强的意图证据；`customSlots` 对未知 pattern 已有确定性兜底（8/12/90s/RIR 2.0），不是未定义行为。
- PRD :172 非目标同批**精确改写**（不是删除）：保持「计划编辑器不提供新 pattern 槽入口」，新增「存回计划因基于真实训练事实，允许承载新 pattern；其槽参数走 customSlots 既有兜底」。理由写进 PRD 与系统逻辑。
- ⛔ 不为此改 `customSlots` 的任何塑形逻辑（引擎零改动）。

## 红线

1. ⛔ **引擎零改动**：TodayPrescriptionEngine（含 customSlots/塑形/优先级）、轮转、verdict、周口径、疼痛保守态、sticky/替换链（#721 刚定）一律不碰。
2. ⛔ 不 bump schema；只加 open-bag `finalExerciseOrder`；planCustomization 结构与既有四 writer 的**现有语义、现有签名**不变。**2026-07-30 owner 对阻断 3 的唯一显式例外：**允许为本功能新增窄的原子 compare-and-apply / raw-restore 写闸能力；不得借此改四个既有 writer 或扩写其他 planCustomization 语义。
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

1. **测试先红后绿**：`finalExerciseOrder` 落盘（含 A→B→A occurrence 不污染构成、加/删组合、无编辑场、重复输入保序留首次）；存回构成计算；入口资格覆盖 add / remove / add+remove / 纯重排四类文案；永久 substitution 与 sticky 已使下场真实同构时不显示；永久 A→B 下本场 B→默认 A 时写 `userPinned A` 且下场真实为 A；无 overlay 时默认目标仍 clear/noop；dayCode 取 templateId（**FR-TR12 换天场专测**）；raw 撤销覆盖未知 dayPlan sibling、未知 item 键、typed getter 跳过的脏 item、写前空 `daySequence:[]` 与空 `dayPlans:{}`，并按确定性 JSON 编码逐字节一致（含 nil→remove + 容器 provenance）；入口出现后外部编辑再点击覆盖三种走向：有效构成已等价 no-op、仍有差异且以最新 raw 前值为撤销基线、目标已被其他入口写成同值时 no-op；失败态；pattern 越界动作可存回且下场处方走 customSlots 兜底（builder→clean→plan 跨层集成）。
2. **golden**：明确列出因 `finalExerciseOrder` 重捕获的 fixture，并逐字段证明其余字节零差异；不使用编辑功能的用户全链行为不变。
3. **canonical 实证**：存回后实读 `planCustomization.dayPlans[dayCode].exercises`；撤销后对写入瞬间前后的 raw dayPlan 作确定性 JSON bytes 比较，未知 sibling / 未知 item key / 脏 item 必须逐字节恢复；nil 时实读键消失；点击时最新状态已等价则确认 canonical 原 bytes 不动且无成功。
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
- D 写入：[最新 canonical 原子 compare-and-apply / 收敛 / 0 gate-backup-save no-op / 失败 / 写入瞬间 raw 前值 / raw 撤销与 nil remove / stale-click 三路 / dayCode 时序]
- E pattern：[越界处理 + 规格改写]
- 跨层集成：[存回后下场处方证据]
- gate / 实拍 / 规格写回 / 顺带项 / 未尽事项
```

## 实施阻断回报（2026-07-30）

- **状态：STOP / NO-GO，未进入正式实现。** 已触发本交接件「`finalExerciseOrder` 与消费面冲突 / 行为歧义即停」条件；实施方未自行修改裁定。
- **分支：** `codex/0730-save-to-plan`；本轮试验性 builder / test / golden 改动已全部撤回，未提交、未 push、未开 PR。本段是当前唯一保留改动。

### 阻断 1：重复 exerciseId 裁定与现役消费面冲突

裁定 C 要求 `finalExerciseOrder` **保序、不去重**，并以「自由日序允许重复 id」作为依据；验收又要求存回后下场构成与本场一致。但当前真实代码合同是：

1. `TodayPrescriptionEngine.customSlots` 用 `seenIds.insert(ex.id).inserted` 明确丢弃同一 `exerciseId` 的后续 occurrence（注释也写死「同动作重复，只保首次」）。
2. `PlanDayEditorView.load()` 对 `currentExerciseIds` 去重保序，重复动作无法在现役编辑器中同构显示或继续编辑。
3. `PlanDayEditModel.swift` 所说「重复合法」明确指 **训练日序中的重复 dayCode occurrence**，不是单个 dayPlan 内重复 exerciseId。
4. 训练中 `addExercise` 也明确禁止加入当前队列已有的同一 exerciseId。

因此，若把 `[A, B, A]` 原样写入 `planCustomization`，raw 存储可以保留，但下场 `customSlots` 会消费成 `[A, B]`，无法满足「存回后构成跟本场一样」。在“引擎零改动”红线下没有同时满足两边合同的实现。

**需 owner 裁定（任选其一）：**

- **方案 1（建议，保持本批引擎零改动）：** 把裁定 C 改为 dayPlan 的 `finalExerciseOrder` 采用「有序唯一 exerciseId」合同；明确自由日序允许重复的是 dayCode，不是 exerciseId。
- **方案 2（保守 fail-closed）：** raw `finalExerciseOrder` 仍保留重复，但一旦目标含重复 exerciseId，本批不显示存回入口；另立 occurrence-aware 计划消费切片。该方案不满足当前验收 #4，需同步改验收。
- **方案 3（扩大范围）：** 批准 occurrence-aware 的 `customSlots`、计划编辑器 identity 与相关投影改造，并解除本批“引擎零改动”红线；这已不是当前小切片。

### 阻断 2：纯重排不会产生 sessionEdits，入口显示合同不完整

裁定 B 要保存最终**构成与顺序**；裁定 C 又指定 `sessionEdits` 用于「判断是否显示入口与文案措辞」。但当前真实代码中：

1. `TrainFlowState.moveExerciseToCurrent` 只改变 `flow.plan.exercises` 并记录 `.moveExerciseToCurrent` event，不写 `addedExercises` / `removedExercises`。
2. `CompletedSessionBuilder` 仅在 added / removed 非空时生成 `sessionEdits`，其结构也只有 `added` / `removed`。

所以纯重排会让 `finalExerciseOrder != 当前有效构成`，却没有 `sessionEdits`。严格按当前裁定会完全不显示入口；若改为按最终队列差异显示，又缺少已拍板的顺序变更事实文案，且改变了「sessionEdits 判断显示」的裁定。

**需 owner 裁定（任选其一）：**

- **方案 A（建议，最小且不改引擎）：** 入口资格改为「`finalExerciseOrder` 与当前有效构成不同」；`sessionEdits` 只负责 add/remove 文案。纯重排新增一条双语事实句（例如「今天调整了动作顺序」），仍保存最终有序构成。
- **方案 B（收窄承诺）：** 保持 `sessionEdits` 为唯一入口资格，明确纯重排本批不提供存回；把“保存顺序”限定为伴随 add/remove 的场次。
- **方案 C（扩充审计）：** 给 `sessionEdits` 增加 moved/order 审计并同步 golden / 读取合同；这会修改本交接件写死的数据合同，必须先拍板。

### 已执行到停止点的证据

- 先按 TDD 写了 `finalExerciseOrder` 的无编辑、A→B→A、加删、重复 id RED；聚焦测试共 15 条，5 条因字段缺失按预期失败。
- 最小 builder 写入后，上述新行为转绿，只剩交接已预告的 2 条内联 byte golden + 1 个 fixture 失败。
- 在继续消费面实现前，Sol Ultra 只读审查发现上述两处合同冲突；实施方随即停止，并撤回全部试验性 runtime / test / fixture 改动。未重捕获任何 golden，未产生实施 commit。

### Owner 裁定解除（2026-07-30）

- **阻断 1 选方案 1：** `finalExerciseOrder` 改为单日 exerciseId **保序去重、保留首次**；原「自由日序允许重复 exerciseId」依据作废并已在裁定 C 修正。引擎零改动，occurrence-aware 计划消费留案。
- **阻断 2 选方案 A：** 入口资格改为 `finalExerciseOrder != dayCode 当前有效构成`；`sessionEdits` 只喂 add/remove 文案。纯重排或换动作且无 add/remove 时使用中性顺序事实句，四类文案均需精确断言。
- 上述两项由主会话代 owner 明确拍板；STOP / NO-GO 解除，实施方恢复 RED → GREEN。其余裁定、红线、验收与停止条件不变。

## 实施阻断回报（二次，2026-07-30）

- **状态：STOP / NO-GO，禁止提交。** 独立只读审查发现两处 P1，已触发本交接件「存回构成与 `planCustomization` 结构防御读冲突 / 撤销快照语义歧义即停」条件。实施方未自行修改裁定。
- **分支：** `codex/0730-save-to-plan`。当前 runtime、测试、golden 与 living-doc 写回均仍是**未提交工作区改动**；未 push、未开 PR。停止前已跑出的 GREEN、Simulator 与 canonical 证据不能覆盖下述数据保全问题，因此不得作为最终 GO 回执。

### 阻断 3：typed 撤销快照不能恢复写前 raw open-bag dayPlan

当前候选把写前状态保存为 `CustomDayPlan?`，撤销再调用既有 `applyCustomDayPlan`：

1. `AppData.planCustomization` 的 typed getter 只解码 `exerciseId/sets/repMin/repMax/rest/crossFamily`，会丢弃 dayPlan 与 item 上的未知 open-bag 键，并跳过结构脏 item。
2. 首次「存进计划」会按裁定只写 exerciseId，整日覆盖原 dayPlan；随后撤销只能把 typed 已知字段重新编码，无法恢复写前未知 sibling、未知 item key 或被 typed getter 跳过的 raw item。
3. 现有测试只断言 typed 等价，因而会把 raw 字节丢失误判为“完整快照已恢复”。这与 Master §7「No overwrite of unreadable user data」以及本交接件“写前旧 dayPlan 快照 / 撤销写回快照”的合同冲突。

**建议 owner 裁定：**

- **方案 1（建议）：** 明确“完整快照”是该 `dayPlans[dayCode]` 的 raw `JSONValue` 节点，并批准一个仍走唯一 gated mutation 的窄 raw-restore 能力；保存/撤销测试必须覆盖未知 dayPlan sibling、未知 item key 与脏 item 原样恢复。此方案不改 schema、引擎或现有 plan 结构，但会新增或调整 writer 能力，需显式解除“writer 签名不变”红线的相应部分。
- **方案 2（保持现有 writer 签名）：** 对 raw dayPlan 不是 typed 可无损往返的场景 fail-closed，不显示入口；需补精确 representable 判定与测试，并接受部分已有自定义计划不能存回。
- **方案 3（收窄撤销承诺）：** 明确撤销只恢复 typed 已知字段。此方案会主动接受未知用户数据丢失，不符合当前 Master 红线，实施方不建议。

### 阻断 4：候选与“写前快照”在 Today 加载时冻结，点击时可能已经过期

当前 `completedSessionPlanCandidate` 在 Today 加载时一次性计算 `current/resolution/previousDayPlan`；用户点击后，`saveCompletedSessionPlan` 直接使用这份旧候选：

1. 若入口出现后，计划从其他现役入口被编辑，点击存回仍会用旧 `resolution` 覆盖最新计划；最新计划已经等于 target 时也可能继续写并假报成功。
2. 5 秒撤销恢复的是 Today 加载时的旧快照，不是实际写入瞬间的“写前状态”，可能二次抹掉入口出现后发生的合法计划编辑。
3. `performPlanWrite` 虽会在 writer 内重新 load canonical，但当前闭包没有在同一事务里重算当前有效构成、执行 no-op 守卫并返回精确写前 raw 节点，因此“点击前再读一次”仍有 TOCTOU 窗口，也不能解决阻断 3。

**建议 owner 裁定：**

- **方案 A（建议）：** 批准一次原子 compare-and-apply：在唯一 gated mutation 内按最新 canonical 重算资格，no-op 不写不报成功，同时捕获实际写入瞬间的 raw dayPlan 供 5 秒撤销；若当前状态已变化且仍有差异，以最新状态作为撤销基线。
- **方案 B（保守 fail-closed）：** 候选携带可比较的计划版本/原始节点，点击时只要当前节点与候选基线不同就拒绝并刷新入口，要求用户再次点击；撤销仍需结合阻断 3 的 raw 快照能力。
- **方案 C（仅点击前重读）：** 只能缩小竞态窗口，不能保证原子性，也不能满足 raw 快照恢复，不建议作为最终裁定。

### 停止点证据与未完成项

- 已有行为测试曾达到 `RedeTrainingDecision` 494/494、`RedeL10n` 143/143、App 定向 45/45；Simulator build、四张规定截图、保存与 nil 快照撤销的 canonical 实读也已跑出。但它们没有覆盖 raw 未知键保全与候选过期并发，故本轮结论仍是 **NO-GO**。
- golden 仅重捕获 `completed-session-no-edits.origin-main.expected.json`；删除 `finalExerciseOrder` 后，逐 scalar path/value 比较与规范化 SHA-256 均与 `origin/main` 一致（`fc82ff51f27d1c4c97b4098088d7a40e433cb3aa87cd953e20f54f3743dd4efa`），这项本身未发现额外差异。
- 在 owner 对阻断 3/4 拍板前，不得提交当前改动，也不得继续补实现、回填最终实施回执或把 living docs 的“已实现”表述视为已交付事实。

### Owner 裁定解除（二次，2026-07-30）

- **阻断 3 选方案 1：**写前快照改为实际写入瞬间 `dayPlans[dayCode]` 的 raw `JSONValue?`；撤销在唯一 gated mutation 内原样恢复，nil 只移除该日键。仅为这项显式解除「不新增/调整 writer 能力」限制，批准照抄 #717 的 raw mutation 技术；planCustomization 结构、既有四 writer 的签名与现有语义不变。
- **阻断 4 选方案 A：**点击时在同一次 gated mutation 内基于最新 canonical 重算 target、当前有效构成与收敛决定；等价则 0 gate / 0 backup / 0 save、不报成功并隐藏入口，仍有差异才写，并以实际写入瞬间的最新 raw 前值为撤销基线。Today 加载候选只供入口与文案，不再作为写入依据。
- 必测边界同批锁定：raw 未知 dayPlan sibling、未知 item key、typed getter 跳过的脏 item 按确定性 JSON 编码逐字节恢复；入口出现后外部编辑再点击的「默认等价 no-op / 仍有差异并捕获最新前值 / 已由别处写成目标同值 no-op」三路；撤销恢复写入瞬间而非 Today 加载时前值。
- 上述两项由主会话代 owner 明确拍板；二次 STOP / NO-GO 解除，实施方恢复 RED → GREEN。其余裁定与红线不变。

## 实施阻断回报（三次，2026-07-30）

- **状态：STOP / NO-GO，禁止提交。** 独立只读审查发现 1 个 owner 级合同冲突与 1 个 raw sibling 保全缺陷；实施方已停止，不自行改裁定。
- **分支：** `codex/0730-save-to-plan`。当前 runtime、测试、golden 与 living-doc 写回均仍是**未提交工作区改动**；未 push、未开 PR。停止前的聚焦 GREEN 仅是阶段证据，不构成最终 GO。

### 阻断 5：真实有效构成 overlay 与默认收敛合同冲突

裁定 C / 阻断 4 要求点击时以最新 canonical 的「当前有效构成」原子 compare-and-apply；验收又要求无变化时不显示入口、存回后下场构成与本场一致。但当前真实处方会在默认或自定义计划之上应用 sticky last-actual 与永久 `exerciseSubstitutions`，现实现与裁定 D 的组合无法同时覆盖两类场景：

1. 当前实现只用 typed `planCustomization` exerciseId 或该日默认 exerciseId 作为「当前有效构成」，没有纳入 sticky / substitution overlay。若已有永久 `A → B`、本场完全未编辑且最终也是 B，代码仍拿默认 A 比较，因而误显示入口，并误用「今天调整了动作顺序」文案；这违反「存回不会改变任何东西时不显示」。
2. 若把 compare 基准直接改成引擎真实有效构成，又出现反向冲突：永久 `A → B` 生效时，用户本场把 B 改回默认 A，目标等于 defaults、真实有效当前仍是 B；现有 `PlanDayEditRules` 按裁定 D 会给 `.noop`（无自定义）或 `.clearCustom`（有自定义）。两者都不会写入能压过 substitution 的 `userPinned A`，所以下场仍会回到 B，违反「存回后下场构成与本场一致」。
3. 直接清除或改写 `exerciseSubstitutions` 会触及本批红线，也破坏交接件写死的「不同机制不互相静默改写」边界，实施方不能自行采用。

**需 owner 裁定（任选其一）：**

- **方案 1（建议，保持 substitution 表零改动）：** 默认收敛改为基于**真实有效构成**的条件收敛。若 `target == defaults`，但 active sticky / substitution overlay 使当前有效构成不同，则允许把默认 exerciseId 以 `userPinned` custom day 写成非冗余覆盖；若没有 overlay 差异，仍按既有规则 clear / noop。补永久 substitution 与 sticky 的「无编辑不显示」测试，以及 `B → 默认 A` 存回后用 `userPinned A` 压过 overlay、下场同构测试。此方案需要显式修正裁定 D 中「目标等于默认即无条件 clear / noop」的部分。
- **方案 2（收窄承诺）：** 明确本批「存进计划」不负责覆盖 sticky / substitution；检测到 overlay 时抑制入口或引导用户回原机制处理，并同步为「存回后下场同构」增加例外。此方案会缩小当前验收。
- **方案 3（扩大写入范围，不建议）：** 允许存回同步清除或调整 `exerciseSubstitutions` / sticky 状态。该方案解除现有红线并扩大写入副作用，不属于当前小切片。

### 同批发现的 raw 恢复缺陷（owner 选定后必须修）

nil raw 撤销当前会把写入前已有的空 `daySequence: []` 当成不存在：若写前 `planCustomization` 只有该空数组，存回新增唯一 dayPlan 后再撤销，清理逻辑会删除整个 `planCustomization`，而不是只移除目标 dayCode。该行为违反阻断 3「nil 只移除该日键」与 raw sibling 原样保全合同。

这不是新的产品裁定歧义；恢复实施后必须把 raw restore 收窄为只移除目标 dayCode（最多清理本次产生的空 `dayPlans` 容器，不删除任何写前 sibling），并补 `daySequence: []` 的确定性逐字节回归测试。

### 停止点证据与未完成项

- 停止前阶段证据：`RedePersistence` 107/107、App 定向 48/48；独立审查结论仍为 **NO-GO**。
- golden 仍只重捕获 `completed-session-no-edits.origin-main.expected.json`。删除新增 `finalExerciseOrder` 后，规范化 compact JSON SHA-256 为 `fc82ff51f27d1c4c97b4098088d7a40e433cb3aa87cd953e20f54f3743dd4efa`，scalar path/value stream SHA-256 为 `f80463e144a5a5f9ea8bde9b0acacb18a4dc456e80833474f98a732937c58db3`；两项 baseline / current 均一致。
- 最终 TrainingDecision / L10n / Simulator build、阻断 5 与 raw 修复后的运行实拍、总门禁、分步 commit 和实施回执均未完成。
- 等待 owner 对阻断 5 选择方案；裁定前不得继续改实现、修缺陷、提交或回填最终实施回执。

### Owner 裁定解除（三次，2026-07-30）

- **阻断 5 选方案 1：**入口与同事务 no-op 一律比较现役引擎从 clean input 投影的真实有效构成，纳入 sticky 与永久 substitution；不再把 raw defaults 当成「下次真会拿到什么」。默认目标采用条件收敛：清除该日 custom 后的真实构成仍等于 target 才 clear/noop；overlay 仍会把它拉走时写必要的 `userPinned` 默认 exerciseId，由用户显式意图压过 overlay。
- **红线不变：**不清除或改写 `exerciseSubstitutions`，不改 sticky 状态，不改 `TodayPrescriptionEngine`；两套机制继续独立共存。
- **raw 缺陷确认修复：**nil undo 只移除目标 dayCode；compare-and-apply 同事务记录本次是否创建 `dayPlans` 容器，只有 provenance 为真且撤销后为空才清理。写前已存在的空 `daySequence:[]`、空 `dayPlans:{}` 与其他 sibling 均按确定性 JSON bytes 原样保留。
- 上述两项由主会话代 owner 明确拍板；三次 STOP / NO-GO 解除，实施方恢复并完成 RED → GREEN。其余裁定、红线与验收不变。

## 实施回执

### 分支与 commit 清单

- 分支：`codex/0730-save-to-plan`；基线 `origin/main@267188d`，交接件起始 commit `d8a7e2d`。
- `f9268c3 feat: 记录完成场最终动作顺序`：完成场 open-bag 数据、builder 测试、唯一 fixture 与跨层 pattern 消费测试。
- `ce94c65 feat: 原子存回完成场计划并支持原样撤销`：最新 canonical compare-and-apply、真实有效构成投影、条件收敛、raw snapshot/provenance/restore 及 app/Persistence 测试。
- `fe07d6d feat: 在今日练完态提供存进计划入口`：Today 入口、5 秒撤销条、Plan 显式刷新与双语文案。
- living docs、CHANGELOG、DEV_LOG 与本回执：本提交。按纪律未 push、未开 PR。

### A 入口

- 入口只在 `TodayTabView` 的已落盘练完态块中出现：既有 MLE 事实行之后、分享行之前；Train、本次训练编辑器、训练小结 sheet 与 `TrainTabView` 均为零改动、零入口。
- 显示条件只有一个：完成场 `finalExerciseOrder` 与该 `templateId` 训练日由现役引擎从 clean input 投影出的**下次真实有效构成**不同，且条件收敛不是 noop。永久 substitution 或 sticky 已让两者同构时不显示；纯重排虽无 `sessionEdits`，仍显示。
- 行形态为一条事实句 +「存进计划」动作；新增、移除、新增+移除、纯顺序四分支均有精确中英断言。它与 MLE 行使用同一练完态区域但互不替代；无候选时不占空位。
- 成功后原行刷新消失，并显示约 5 秒「已存进计划 / Saved to plan」+「撤销 / Undo」；写入或撤销失败只显示独立计划错误，不冒充训练保存失败。

### B/C 数据

- `CompletedSessionBuilder` 对最终 `flow.plan.exercises.map(\.exerciseId)` 做保序去重、保留首次，并在每条新完成场落 `finalExerciseOrder:[String]`；无 schema bump、旧历史不迁移。A→B→A occurrence 与重复输入测试锁定不会制造重复单日动作。
- 读取由 `SessionStore.loadCompletedFacts` 按 `sessionId` 直读同一 canonical 完成场的 `finalExerciseOrder`、`templateId` 与可选 `sessionEdits`。`finalExerciseOrder` 是目标构成真源，`templateId` 是唯一 dayCode 真源，`sessionEdits` 只喂 add/remove 文案，绝不参与资格或写入决定。
- **golden 重捕获清单只有一个：**`ios/packages/RedeTrainingDecision/Tests/RedeTrainingDecisionTests/Fixtures/completed-session-no-edits.origin-main.expected.json`。原始 diff 只新增：
  `finalExerciseOrder=["bench-press","incline-db-press","machine-chest-press","cable-fly","lateral-raise","triceps-pushdown"]`。
- 删除仅 `finalExerciseOrder` 后的逐字段零差异证明：
  - 规范化 sorted compact JSON SHA-256：baseline/current 均为 `fc82ff51f27d1c4c97b4098088d7a40e433cb3aa87cd953e20f54f3743dd4efa`。
  - sorted scalar path/value stream SHA-256：baseline/current 均为 `f80463e144a5a5f9ea8bde9b0acacb18a4dc456e80833474f98a732937c58db3`。
  - 因而新字段之外每个 scalar path/value 均相同；没有重捕获第二个 fixture。

### D 写入

- Today 加载候选只用于显示和文案。点击只传 `sessionId`；`CanonicalSessionWriter.compareAndApplyCompletedSessionPlan` 在同一次 gated mutation 刚 load 的最新 canonical 上，由 app 层只读 resolver 重建 clean input、target、真实有效构成与收敛决定，不使用 Today 加载时的陈旧 target/snapshot。
- 目标等于当前真实有效构成，或 writer 生成结果与当前 bytes 等价时，`skipSaveIfUnchanged` 保证 **0 gate / 0 backup / 0 save / 0 成功收据**；Today 随后刷新并移除陈旧入口。仍有差异才整日覆盖该 dayCode，且每个 item 只写 `exerciseId`。
- 普通非默认目标沿用 `PlanDayEditRules.applyResolution`。`target == defaults` 时先投影“只移除该日 custom、其余 overlay 不动”：投影仍等于 target 才 clear/noop；永久 substitution 或 sticky 会把默认拉走时写必要的 `userPinned` 默认 IDs。全程不清除/改写 `exerciseSubstitutions`，不改 sticky。
- 实际写入瞬间捕获 `dayPlans[dayCode]` 的 raw `JSONValue?` 及 `didCreateDayPlansContainer`。non-nil undo 原样放回节点；nil undo 只删目标 dayCode，仅当 provenance 证明本次创建了空 `dayPlans` 容器才清理它。未知 dayPlan sibling、未知 item key、typed getter 跳过的脏 item、写前空 `dayPlans:{}` 与空 `daySequence:[]` 均有 deterministic JSON bytes 断言。
- 终审额外抓到 `.clearCustom` 唯一日 + 写前 `daySequence:[]` 会丢 sibling：先得到 1 项测试 2 个真实 RED（恢复后 91 bytes ≠ 写前 108 bytes，且 clear 中间态错误为 nil），再把 FR-TR14 clear cleanup 收窄为只清空 `dayPlans`，GREEN 1/1、相邻 14/14、Persistence 110/110；non-nil raw undo 后整个 `planCustomization` bytes 与写前相同。
- stale-click 三路均已锁定：外部编辑后真实构成已等价 → no-op；仍不同 → 写入并以那份最新 raw 前值作为撤销基线；别处已写成目标同值 → no-op。写失败 canonical bytes 不动且有诚实错误。
- dayCode 始终取完成场已经落盘的 `templateId`；绝不回读已在 append 同事务消费清空的 `oneTimeDayOverride`。真实写入/撤销后 Today `loadToday()` 与 Plan revision 均显式刷新。

### E pattern

- 计划编辑器继续不能凭空增加默认模板没有的新 pattern；只有“本场已真实完成并落盘 → 用户从 Today 明确存回”可越过该入口限制。
- builder→clean→plan 测试覆盖新 pattern 有完成事实时读取正常历史进阶、无完成事实时走既有 8/12/90 秒/RIR 2.0 cold-start 槽兜底。`TodayPrescriptionEngine.customSlots` 与所有处方塑形代码零改动。
- PRD FR-TR14/:142/:172、系统逻辑 §5/§6.0.3/§7 与 Master writer 类别均已同步这一窄例外和边界。

### 跨层集成

- 永久 A→B 已生效、本场零编辑时，候选与点击时最新复核均无入口/无写；sticky 已同构路径同样无入口。
- 永久 A→B 下把本场 B 改回默认 A：`CompletedSessionBuilder` 落最终 A → clean view/input → compare-and-apply 写 `userPinned A` → 再经现役 `TodayPrescriptionEngine.plan` 投影仍为 A；永久 substitution 表保持原样。该 builder→clean→plan 链由 `testSaveCompletedSessionPlanPinsDefaultAgainstPermanentSubstitutionAcrossBuilderCleanPlan` 锁定。
- Simulator canonical 实读：完成场
  `finalExerciseOrder=["db-bench-press","hip-adduction","lat-pulldown","shoulder-press","one-arm-db-row","lateral-raise","triceps-pushdown","db-curl","barbell-shrug"]`；
  `planCustomization.dayPlans.upper.exercises` 的顺序逐项相同，且每项只有 `exerciseId`，没有组数/重量/次数/RIR/休息覆盖。

### gate / 实拍 / 规格写回 / 顺带项 / 未尽事项

- RED→GREEN 关键节点：builder 新字段聚焦测试先有 5 个预期失败；raw nil/provenance 聚焦 13 项先有 2 个失败；overlay 收敛 App 52 项先有 4 个失败；终审 clear sibling 回归先有 1 项 2 个失败。最终 `RedeTrainingDecision` 494/494、`RedeL10n` 143/143、`RedePersistence` 110/110、App `SessionStoreDraftTests` 52/52。
- 最终 writer 修复后重新运行 `.claude/quality-gate.cmd`，exit 0：全部 10 个 Swift 包、通用 Simulator build、App 宿主 73/73；末行 `QUALITY GATE: PASS`。
- 专用 Simulator：`Rede-SaveToPlan-QA`，iPhone 17 Pro / iOS 26.5，UUID `AC85A53F-349B-40A3-B772-3EBF99A8476B`。四张最终图均为 1206×2622 且 MD5 互异：
  - `.ai-tmp/save-to-plan/2026-07-30-savetoplan-entry.png` → `e09e22bb1360d28cb504c013195201a3`
  - `.ai-tmp/save-to-plan/2026-07-30-savetoplan-undo-banner.png` → `907c4f7f81296ac0fa4f0aa797c3d9df`
  - `.ai-tmp/save-to-plan/2026-07-30-savetoplan-plan-editor.png` → `d1206e6108e7807734fa7b6c4628c563`
  - `.ai-tmp/save-to-plan/2026-07-30-savetoplan-noop.png` → `773e51163df7b3d629b27acb7c0d106f`
- living-doc 写回：Master、PRD、系统逻辑、产品文案基线、TestFlight N14/N16、CHANGELOG、DEV_LOG 与本交接件。`git diff --check` 通过；独立 Sol Ultra 终审在关闭上述 clear sibling finding 后结论为**无 P0–P2**。
- 顺带 P3「同场同 id 多 occurrence 的数据质量提示重复显示第 1 组」未夹带；它需要独立的 occurrence 展示消歧，不影响本批验收，原样留案。
- 未尽事项只有真实设备发布验收：TestFlight N16 仍保持 `[ ]`；不以本地自动化或 Simulator 冒充真机。旧历史不迁移，只有带 `finalExerciseOrder` 的新完成场可出现入口；即时撤销约 5 秒，过期后仍可去计划编辑器修改。无 schema/version/manifest/project 变化，无 push、无 PR。
