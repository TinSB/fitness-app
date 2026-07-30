# 交接件：训练现场编辑（FR-TR14 S2）——临时加动作 / 移除动作 / 改剩余组数

> 日期：2026-07-30 ｜ 来源：开发路径盘点第四档「训练现场只开了一半」，owner 拍板云端暂缓后转此批
> 性质：会话状态机（TrainFlowState reducer）新事件 + 训练页任务型编辑面 + 落盘 open-bag 留痕
> 执行：Codex（专家档 gpt-5.6-sol + ultra）｜验收：Claude 主会话（多 lens + 对抗核验）
> 分支：`codex/0730-session-edit`（基线最新 origin/main）

## 为什么

FR-TR14 S1 只做了「后续动作现在练」。用户在训练现场的真实需求 PRD 早已写明（:140）：「后续独立切片再开放**完整动作库增删、剩余组次调整**与训练结束后显式保存到计划；任何已完成事实不得被静默改名、删除或重排」。本批做前两样；**「练完存回计划」明确不做**（牵计划页写闸与 FR-PL7/FR-TR6 permanent 语义交互，独立下一批）。

## 现场事实（已核实，勿重查）

| 环节 | 现状 |
|---|---|
| 事件模型 | `TrainFlowState.swift`（423 行，引擎包内）`SessionEvent` 11 个 case（logSet/restFinished/skipSet/skipExercise/replaceExercise/moveExerciseToCurrent/reportPain/toggleHold/requestFinish/keepTraining/confirmEnd）；apply switch :390-400 |
| S1 稳定移动 | `moveExerciseToCurrent`（:327）+ `moveToCurrentCandidates`（:160）：仅 activeSet、当前动作零事实、候选须全计划唯一 id；durable draft barrier 杀进程恢复已在（2026-07-19） |
| **加动作目标生成素材** | `replaceCurrentExercise`（:280-324）已有完整目标重算：LoadGrid 步长跟动作、assisted/bodyweight-plus 用 `startWeightKg` 对齐步长重置（下限守护）、bodyweight/band 归 0（防脏历史，审计 MAJOR 教训）、external→external 沿用 |
| 换动作候选 | `ExerciseReplacementEngine.candidates`（SessionIntentModels:23）：同 substitutionGroup + 器械白名单 + 排除当日已排 + prescribableLoadTypes 守卫 |
| 落盘对计划外动作 | `CompletedSessionBuilder`（引擎包）:45-47 已写 `originalExerciseId/actualExerciseId`；skippedSets :69 用 finalId 映射——**落盘层早已容忍计划外动作名** |
| 加动作选择器先例 | FR-PL6 计划编辑器任务型 add picker（钩子 `-autoOpenAddPicker`）；PRD :142 边界：**不得把 Plan 编辑器或目录浏览器搬进 Train**，任务型窄选择器是许可的窄例外 |
| 移除撤销先例 | FR-PL7 `PlanDayEditUndoModel`（LIFO 撤销条，14 上限假成功教训在案） |
| 快速调整 | 训练中已有组级重量/次数暂存调整（quickAdjust/clearAdjustment，TrainTabView :1687-1755）；**没有组数调整** |
| 训练页钩子 | -autoStartSession/-autoAdvanceExercises/-autoCompleteSession/-autoPartialSession/-skipOnboarding 等（RootTabView） |
| PRD | FR-TR14 :140（S2 验收形状已写）；FR-TR6 :131（换动作二选一范围）；「存回计划」全库无既有拍板（grep 空） |

## 裁定 A：统一入口 =「本次训练」编辑面（S1 sheet 演进）

- S1 的 session-order sheet 升级为本次训练编辑面：每个后续动作行保留「现在练」，**新增「移除」**；底部**「加一个动作」**入口 → 任务型选择器（FR-PL6 picker 形态复用：按肌群分组紧凑列表、器械白名单过滤、排除当日已排；**不是**目录浏览器——无详情、无搜索、无图片）。
- 不新增 tab、不弹窗。**2026-07-30 S2 有意演进**：统一开放行在任意 `activeSet` 都保持可点，避免用户练完第一组后必须改走 More 的第二入口；sheet 内「现在练」仍沿 S1 既有守卫做**行级降级**，当前动作已有事实时该行不可点。
- sheet 保留只读的当前动作身份行与剩余组数控件，为 stepper 提供明确上下文；当前动作仍不可移除，「跳过 / 换动作」继续走既有出口。触感/动画与既有 sheet 一致。

## 裁定 B：临时加动作

1. **插入位置 = 当前动作之后**（练完当前就到它）；同一动作不可重复加（当日已排排除）。
2. **目标生成（写死，按优先级）**：
   - canonical 有该动作历史 → 最近一场该动作的工作组重量（同日多场按 canonical append 顺序取最后，与 lastPerformance 口径一致）；
   - 无历史 → 复用 replace 的保守公式：`startWeightKg` 对齐 LoadGrid 步长（下限守护）；bodyweight/band 归 0；assisted 同 replace 语义。
   - 组数固定 3；`targetReps` / `targetRir` / `restSeconds` 只走以下**借值链**，全部来自今天引擎已经产出的真实 `ExerciseSetPlan`，不读目录不存在的字段、不发明默认数字：
     1. 当日会话存在同 `primaryMuscle` 的已排动作 → 按当日队列顺序借第一个同主肌群动作的首组 `targetReps` / `targetRir` 与该动作 `restSeconds`；
     2. 无同主肌群动作 → `targetReps` 取当日全部已排动作首组值的众数（平票取更小值），`restSeconds` 同法取众数（平票取更大值），`targetRir` 取当前动作首组值；
     3. 理论兜底 → 取当前动作首组 `targetReps` / `targetRir` 与 `restSeconds`（当前动作永存在，链条必然终止）。
   - rep 区间同样零发明：同主肌群分支与当前动作兜底分支借各自 donor 的完整 `repLowerBound` / `repUpperBound`；众数分支先按上条规则求 `targetReps` 众数，再取当日队列中第一个“首组 `targetReps` 等于该众数”的动作作为区间 donor，借其完整上下限。
   - `addExercise` typed event 在创建时一次性携带按上述重量与借值链解析完成的完整 `ExerciseSetPlan` payload；draft replay 只重放 payload，不重查 canonical 历史。
   - 器械白名单与重量单位在开训时冻结为 session-scoped 配置；picker、payload planner、reducer 与 draft restore 必须读取同一份 `TrainFlowState` / draft 捕获值，训练中 Settings 变化只影响下一场训练。
   - ⛔ 禁止任何无出处的魔法数字出现在处方行。
3. **落盘**：以既有 exercises 元素字段正常落盘（真实事实进统计/MLE/引擎，replace 先例已证明下游容忍）；另加 open-bag 标记留痕（如元素内 `"adHocAdded": true` 或 storage 级 `sessionEdits`——形态你定，**不 bump schema**，回执写明）。审计口径：临时加的动作不参与轮转/verdict/计划对账的任何「计划 vs 实际」偏差告警（如有）。
4. 引擎处方逻辑零改动——加动作是会话内事实，下次处方由引擎照常从 clean sessions 读取。

## 裁定 C：移除动作

1. **语义 = 中性移除**，与跳过按事件严格区分：remove event 不问四码原因、**不产生 skip event、不进疼痛信号**、不算完成也不算跳过。同一 `exerciseId` 的另一个 occurrence 可合法进入 `skippedExercises`；`sessionEdits.removed.position` 只审计移除发生的位置，不承诺跨数组仅凭 id 唯一归因。严格 occurrence identity 留给未来「存回计划」切片。
2. 仅可移除**尚无任何事实**（零完成组、零跳过、零疼痛登记）的**后续**动作；当前动作不可移除（跳过/换动作已覆盖）；按**位置**移除（自由日序可有重复 id，不得整 id 误删）。
3. 落盘 open-bag 留痕（如 `sessionEdits.removed`：exerciseId + 原位置），供统计诚实与将来「存回计划」批使用；被移除 occurrence 不出现在 exercises 数组，remove event 本身不写 `skippedExercises`。
4. **sheet 内单层撤销**：错删立即可撤（轻量 local state 即可，不必上 PlanDayEditUndoModel 全栈）；关 sheet 后不再提供撤销（重新加回即可）。**进程终止等同关闭 sheet**：恢复队列与移除事实，不恢复撤销入口。
5. 全部移除后剩余动作数下限 = 1？——**不设专门下限**：只能移除后续动作，当前动作永在，天然 ≥1。

## 裁定 D：改剩余组数

1. 范围 = **当前动作的剩余组** +1/−1；typed event（如 `adjustRemainingSets(Int)`）。
2. 边界：已完成组不可动；**减**的下限 = 剩余 1 组（减到 0 = 「跳过剩余」语义，与跳过动作重叠，不做——想跳就用跳过）；**加**的上限 = 该动作总组数 ≤ 8（防手滑，超出静默不响应或按钮置灰，零弹窗）。
3. UI：当前动作卡组数区或 more sheet，44pt，零弹窗；组数变化立即反映在组列表（未完成组按当前目标复制/裁剪尾部）。
4. 落盘：真实完成事实照常（做了几组记几组）；组数调整本身不需要独立留痕（事实自明）。
5. 与 quickAdjust 暂存的交互：加减组不清空当前组的暂存调整；被裁掉的尾组若有暂存一并作废。

## 红线（违反即返工）

1. ⛔ **已完成事实不可变**：任何编辑不得改名、删除、重排已完成/已跳过的组或动作（PRD 原文红线）。
2. ⛔ 处方引擎（TodayPrescriptionEngine）、轮转、verdict、周口径、自动均衡、疼痛保守态零改动；TrainFlowState 属会话状态机可改。
3. ⛔ 三类新事件必须全走既有 durable draft barrier：杀进程恢复后**队列、完整目标 payload、组数与移除事实**一致；撤销入口属于编辑面单次呈现生命周期，进程终止/关 sheet 即失效。
   - 开训时捕获的器械白名单与重量单位属于该 draft/flow 的会话配置；picker、payload planner 与 reducer 不得改读训练中变化的实时 Settings。
4. ⛔ 不搬计划编辑器/目录浏览器进 Train（任务型窄选择器）；「练完存回计划」本批不做。
5. ⛔ 零弹窗、零确认框、零说教；新串走 RedeL10n + 精确断言 + 无句号红线。
6. ⛔ 不 bump schema；落盘只加 open-bag 字段。版本号不动。不 push、不开 PR。

## 验收标准（owner 大白话）

1. 训练中打开编排面 → 能移除一个还没练的动作；手滑删错能立刻撤回
2. 「加一个动作」→ 选个哑铃弯举 → 它排在当前动作后面，重量是我上次练它的重量（没练过就是保守起步值），能正常练正常记
3. 当前动作练到一半觉得今天状态好 → 加一组；状态差 → 减一组（至少留一组）
4. 全程强杀 App 重开 → 加的/删的/改的组数全都还在（撤销条本身不恢复）
5. 练完落盘：加的动作在历史里、删的动作不算跳过；下次处方不因为我临时编辑就变魔怔
6. 不用这些功能的用户一切照旧

## 验证与证据

1. **测试先红后绿**：三个新事件的 reducer 全矩阵（守卫边界：有事实不可移除/当前不可移除/重复 id 按位置/组数上下限/暂存交互）、draft 杀进程恢复（三类事件各自+组合）、加动作目标生成三分支（有历史/无历史/bodyweight 归 0）正反例、落盘留痕与 skippedExercises 互斥。
2. **golden 零回归**：不使用编辑功能时 SessionSetPlanner.expand 与落盘输出必须对照 `origin/main` 冻结字节基线逐字节等价；禁止用同源结果删字段后自比较。
3. **canonical 实证**：加动作落盘元素 + 留痕字段实读；移除留痕实读且 skippedExercises 不含它。
4. **模拟器实拍**（装前真 build、前台确认、md5 互异）：①编辑面（移除+加入口）②任务型选择器 ③加入后的动作卡（目标可见）④组数调整前后 ⑤强杀恢复后的队列。PNG 前缀 `2026-07-30-sessionedit-`。新钩子（如 -autoOpenSessionEdit）自定并写回执。
5. 仓库根 `.claude/quality-gate.cmd` exit 0。
6. **规格写回**：PRD FR-TR14（S2 状态）+ 边界注；系统逻辑 §6.0.3/§7 + 写入合同（open-bag 新字段）；文案基线新串；TestFlight 清单 N14；CHANGELOG/DEV_LOG。

## Git 纪律

- `git fetch` 后从最新 `origin/main` 拉 `codex/0730-session-edit`；commit 前 `git status`；明确 pathspec，禁 `-A`；小步提交（reducer/UI/落盘/文档可分）。

## 停止条件

- 同一问题修 3 次不过即停回报。
- 触红线、行为歧义（尤其：落盘留痕形态若与 CompletedSessionBuilder 既有对账逻辑冲突、draft 恢复与新事件互斥、组数裁剪与暂存交互产生未定义态）→ **立即停下回报，不自行改裁定**。

## 实施回执模板（收尾必填**回填本文件末尾**）

```
## 实施回执
- 分支与 commit 清单：[hash + 一句话]
- A 编辑面：[入口/行为/与 S1 共存]
- B 加动作：[选择器形态 + 目标生成实现与测试 + 落盘留痕形态]
- C 移除：[守卫 + 撤销 + 留痕]
- D 组数：[事件 + 边界 + 暂存交互]
- draft 恢复：[覆盖方式与测试]
- golden：[证明方式]
- 规格写回：[逐处]
- gate：[exit code + 尾部原文]
- 实拍：[文件名 + md5 + 新钩子]
- 未尽事项：[如实列]
```

## 停止回报（owner 已裁定解除）

- 时间：2026-07-30
- 状态：**STOP，未进入 RED 测试或实现。** 当前分支仍为 `codex/0730-session-edit`，基线 `origin/main@420a8d6`；本轮未修改 runtime、测试、引擎、schema、版本号或处方逻辑。
- 解除：owner 随后明确选择确定性“借值链”，并裁定“进程终止等同关闭编辑面”；上述裁定已写回 B/C、红线与验收标准，实施可继续。
- 阻断 1——加动作的次数与休息真值不存在：裁定 B 要求“目标次数 = 目录 rep 区间下界”，并在当日动作没有多数休息值时回退“目录/全局默认”；但当前 `ExerciseCatalogEntry` 与 `Resources/exercises.json` 均没有 rep range 或 rest 字段，`TodayPrescriptionEngine` 的 rep/rest 只存在于私有日程 slot 中，任务型全库 picker 又不对应唯一 slot。另有多个休息值并列时也未写平票规则。实施方若自行按动作 kind、movement pattern、当前动作或固定数字推导，都会新增未获裁定的处方行为，违反“裁定写死 / 处方逻辑零改动 / 禁止无出处魔法数字”。
  - 建议 owner 二选一并写回裁定：A. 给动作目录补充明确的 session-edit rep/rest 事实及迁移/默认规则；B. 明确一套仅供临时加动作使用的确定性映射（含每个分支的具体值、休息多数值平票规则与全局 fallback）。在裁定前不建议复用私有 slot 或凭实现方经验猜值。
- 阻断 2——“sheet-local 单层撤销”与“强杀后撤销状态一致”不能同时由现有 draft 表达：当前 `TrainSessionDraft` 只保存原处方与 `TrainFlowEvent`；sheet 是否关闭、local undo 是否仍有效都不在 draft/event 中。若撤销只放 `@State`，强杀后必丢；若从最后一次 remove event 自动恢复，实施方又无法知道 sheet 是否已关闭，会违反“关 sheet 后不再提供撤销”。
  - 建议 owner 二选一并写回裁定：A. 把 remove/undo/关闭编辑面清除 undo 的生命周期都定义为可重放、durable 的 typed state/event（并明确这是否允许超过当前“三类新事件”的字面范围）；B. 明确“强杀等同关闭 sheet”，允许恢复队列与移除事实但不恢复撤销入口，同时相应收窄“撤销状态一致”红线。
- 已确认的非阻断边界：Master Architecture 允许把改动限制在 `RedeTrainingDecision` 会话 reducer、非 canonical draft 与 `CompletedSessionBuilder` 顶层 `sessionEdits` open-bag；无需修改 `CanonicalSessionWriter`、AppData schema 或 `TodayPrescriptionEngine`。未来继续时，加动作 event 应携带已解析的完整会话计划 payload，draft replay 不应再次查询可能变化的历史。

### 二次停止回报（owner 已裁定解除）

- 状态：**STOP，仍未进入 RED 测试或 runtime 实现。**
- 解除：owner 批准下述 donor 建议原文；规则已并入裁定 B，实施继续。
- 新阻断——完整 `ExerciseSetPlan` 还必须包含 `repLowerBound` / `repUpperBound`，但解除裁定只定义了 `targetReps` / `targetRir` / `restSeconds` 的借值链。该字段不是无害填充：`NextSetEngine` 真实使用 `repLowerBound` 判断“低于次数下限”并触发下一组保守降重；实施方若自行令上下限等于 `targetReps`、借某一动作区间或另设固定范围，都会改变组内安全行为。
  - 建议 owner 明确采用：同主肌群与当前动作兜底分支直接借 donor 的完整 `repLowerBound` / `repUpperBound`；众数分支先按已裁定规则求 `targetReps`，再从当日队列中取**第一个首组 `targetReps` 等于该众数**的动作作为区间 donor，借其完整上下限。这样所有值仍来自今天引擎真实输出、零发明，且平票规则不变。若不采用，请给出另一条完整上下限规则。

### 三次停止回报（owner 已裁定解除）

- 时间：2026-07-30
- 状态：**STOP，停在最终独立审查；不回填完成回执。** 当前已完成并提交 reducer / 借值链 / draft barrier / UI / L10n / canonical 规格写回；权威 `.claude/quality-gate.cmd` 已 exit 0，尾部为 `** TEST SUCCEEDED ** / Testing started / QUALITY GATE: PASS`，真实 Simulator 的增删/撤销/组数/新增目标/强杀恢复也已通过。独立 reviewer 给出 0 P0、0 P1、6 P2；以下三项会实质改变用户结果或既有裁定，实施方未猜值继续。
- 解除：owner 裁定 **①2 事件级互斥、②1 冻结开训时配置、③2 S2 统一入口有意演进**；原文已并入裁定 A/B/C、红线与 golden 验证口径。严格 occurrence identity 留给未来「存回计划」切片；训练中 Settings 变化下场生效；统一开放行任意 `activeSet` 可点而「现在练」只做行级降级。

#### 阻断 1——重复 exercise id 的 occurrence 审计口径未定义

- 现状：裁定 C 要求按**位置 + 快照**移除，`sessionEdits.removed[]` 也保存 `exerciseId + position`；但既有 `skippedExercises[]` 只保存 `exerciseId + reason`。若队列为 `[A, A, B]`，移除后一个 A、再跳过前一个 A，canonical 会同时出现 `removed=A@1` 与 `skippedExercises=A`。事件语义本身没有把被移除 occurrence 当跳过，但 storage 只按 id 看无法证明两者互斥。
- 请 owner 二选一：
  1. **严格 occurrence 可审计**：批准给会话动作 / skip / edit 引入稳定 occurrence identity 或 skip position（open-bag、无 schema bump，但会扩既有 skip 落盘合同与测试面）。
  2. **事件级互斥**：明确“中性移除不产生 skip event”即满足互斥；同 id 的另一个 occurrence 可以合法出现在 `skippedExercises`，`sessionEdits.removed.position` 只审计移除发生的位置，不承诺跨数组仅凭 id 唯一归因。
- 实施建议：若未来「存回计划」需要可靠逐 occurrence 对账，选 1；若本批只要求统计不把 remove event 计作 skip，选 2，并同步收窄验收与文档措辞。

#### 阻断 2——进行中会话的器械白名单 / 单位取哪个时点

- 现状：`TrainFlowState` 在开训时捕获 `allowedEquipment` / `loadUnit`，reducer 按这份会话配置校验；当前 picker 与 payload planner 却从可随 `loadToday()` 刷新的 `todayModel` 读取实时 Settings。训练中若改器械，picker 可能展示 reducer 会拒绝的新器械，或隐藏本场开训时合法的动作；改单位也可能让新动作目标按新单位档位生成、而会话仍以旧单位配置重放。
- 请 owner 二选一：
  1. **冻结到开训时（建议）**：picker、payload planner、reducer 全部读取 draft/flow 的 session-scoped 器械与单位；Settings 变化只影响下次训练。
  2. **实时迁移**：Settings 变化要原子迁移进行中 flow、完整 payload 与 draft，并明确旧事件如何重放；这会显著扩大本批。

#### 阻断 3——裁定 A 的入口与当前动作行，和当前实现冲突

- 裁定 A 原文要求“入口可达性沿 S1 既有规则”且“当前动作行不在编辑面出现”；当前实现把「本次训练」开放行在任意 `activeSet` 都保持可点，并在 sheet 显示只读当前动作名 + 剩余组数控件。TestFlight N1 同时仍要求当前动作产生正式事实后 S1 入口退为静态。
- 请 owner 二选一：
  1. **严格沿原裁定（建议按字面）**：S1 开放行继续按原守卫退静态；半程 S2 从既有 More →「本次训练」进入；sheet 不显示当前动作身份行，只保留获批的剩余组数控件。
  2. **批准当前统一入口**：任意 activeSet 都可从开放行进入，sheet 保留只读当前动作身份 + 组数控件；同步改裁定 A、PRD / 系统逻辑与 TestFlight N1。

#### owner 要求解除后全部补完的验收缺口

- 「移除」「撤销」目前只有 `minHeight: 44`，没有明确 `minWidth: 44` / `contentShape`；中文两字按钮可能小于 44pt。解除后须补命中框与窄屏 / 最大 Dynamic Type / VoiceOver 验收。
- PRD 当前写“增删不改推荐学习”，与裁定“新增动作真实完成事实正常进入统计/MLE/引擎”矛盾；应改成“不改推荐算法或长期计划，新增动作的真实完成事实仍按普通历史参与后续处方”。
- `testNoSessionEditLeaves...ByteEquivalent` 目前是同源结果删去不存在字段后的比较，不是真正的 `origin/main` byte golden；解除后须用冻结基线补强。
- 仍应补 remove → durable undo 的成功/失败回滚/编码重放、重复 id occurrence、训练中 Settings 漂移、quickAdjust 在 ±组后保留，以及 320pt / 最大 Dynamic Type / VoiceOver 命中与焦点测试。
- 交接件属于 owner 明确要求回填的工作记录，本轮不擅自移动或删除；若 owner 要求在完成后迁出 `docs/工作记录/`，请同时指定最终归宿。

## 实施回执

- 分支与 commit 清单：分支 `codex/0730-session-edit`，基线 `origin/main@420a8d60816a8624bde9e26341ae85f7fef6698a`。
  - `8b5916d` `docs: 训练现场编辑批交接件（FR-TR14 S2）`
  - `2872c2c` `docs: resolve session edit implementation rulings`
  - `63943d9` `docs: resolve session edit rep range donor`
  - `a89a991` `feat: add durable session edit reducer`
  - `1d6230a` `feat: route session edits through draft barrier`
  - `9a8da61` `feat: add in-session workout editor`
  - `560858a` `docs: record in-session workout editing`
  - `8216f95` `docs: report session edit review blockers`
  - `5415458` `docs: resolve session edit review rulings`
  - `80a658a` `fix: close session edit review gaps`
  - `b6f5519` `fix: harden session edit accessibility`
  - `b4fed09` `fix: reject stale session removal callbacks`
  - 本节与最终规格收口由当前回执提交承载（hash 见本分支最终 `HEAD`）。
- A 编辑面：S1 sheet 已演进为统一「本次训练」编辑面；任意正式组 `activeSet`（含当前已有事实、当前为最后一个动作）都可从稳定开放行进入，More 入口仍指向同一 sheet。只读当前动作身份与剩余组 stepper 保留；当前已有事实时只让各「现在练」行按原 S1 守卫降级，移除、加动作、改组数继续可用。移除/撤销/现在练的完整文字 label 均有 `minWidth: 44`、`minHeight: 44` 与矩形 `contentShape`；accessibility Dynamic Type 下动作区改为纵向。终审发现的陈旧位置回调已以 RED→GREEN 关闭：按钮捕获渲染时的完整 `ExerciseSetPlan + position`，提交前复核快照，remove/undo 在下一主队列轮次前禁用重复操作，旧回调不能误删移入同位置的下一动作。
- B 加动作：任务型 picker 按 `primaryMuscle` 分组，仅列开训时会话器械配置允许、可处方、未废弃且本场未排的目录动作；没有搜索、详情、图片或「存回计划」。插入位置固定为当前动作后，组数固定 3。重量走最近 canonical 工作历史（最近日、同日最后 append、场内最高工作重量）→ 无历史复用 replace 的 LoadGrid 保守起步；bodyweight/band 为 0。reps/RIR/rest 与完整 rep range 只走裁定借值链：首个同主肌群 donor；否则 reps 众数平票取小、rest 众数平票取大、RIR 当前动作、区间取首个命中 reps 众数 donor；理论兜底为当前动作。创建时一次性生成完整 `ExerciseSetPlan` event payload，replay 不重查历史或实时 Settings。完成落盘以普通 `exercises[]` 事实写入，并在顶层可选 `sessionEdits.added[{exerciseId,position}]` 留痕；未编辑时不出字段。
- C 移除：只有 `activeSet` 中位于当前索引之后、且位置与完整快照同时匹配的 occurrence 可移除；当前动作、已完成前缀、错位/陈旧快照及非 active phase 都 fail closed。remove 不产生 skip event、不问原因、不进疼痛；同 id 的另一 occurrence 可按自身行为合法进入 `skippedExercises`。最终移除写 `sessionEdits.removed[{exerciseId,position}]`，`position` 只审计移除发生位置。sheet 内保留最后一次移除的单层撤销；撤销同样走 typed restore event + durable barrier，关闭 sheet/进程终止后入口失效。成功、失败回滚、编码重放、重复 id 位置语义及陈旧快速回调均有测试。
- D 组数：`adjustRemainingSets(-1/+1)` 是 typed reducer event；只裁剪/复制当前动作未完成尾部，已完成/已跳过前缀不动；至少保留 1 个剩余组，总组数最多 8。视图在 durable 成功后显式恢复原 `TrainQuickAdjustmentState`，重量/次数/RIR 暂存对 −/+ 两个方向逐字段不变。
- draft 恢复：S1 移动与 S2 add/remove/restore/adjust 全走既有串行 draft store 的 durable barrier；先排空普通写，再同步确认最终 draft，失败把完整 flow 回滚到事件前。`TrainSessionDraft` 以私有、加性 `sessionConfiguration` 保存排序后的器械集合（显式 unrestricted `nil` 与旧字段缺失可区分）和开训单位；新 draft 恢复用捕获值，旧 draft 才回退当前 profile。完整 payload、队列、组数、移除审计与会话配置随事件重放；撤销入口不恢复。app-hosted `SessionStoreDraftTests` 最终 32/32。
- golden：不是同源删字段自比较。使用真实临时 `origin/main@420a8d60816a8624bde9e26341ae85f7fef6698a` checkout 生成并冻结四个 fixture：`session-set-plan-no-edits.origin-main.{input,expected}.json` 与 `completed-session-no-edits.origin-main.{input,expected}.json`。当前分支分别重建完整 `SessionSetPlan` surface 与 completed-session storage，按 `.sortedKeys` 编码后逐字节比较；无编辑 completed 输出还显式断言没有 `sessionEdits`。
- 规格写回：
  - `docs/REDE_PRD.md` FR-TR14：统一入口、行级降级、冻结配置、事件级 occurrence 语义、quick-adjust 与“真实完成事实进入普通历史但不改算法/长期计划”。
  - `docs/REDE_iOS_SYSTEM_LOGIC.md` §6.0.3 / §7：双层真相、借值链、session configuration、durable/落盘 open-bag、UI 与 44pt 合同。
  - `docs/REDE_PRODUCT_COPY_BASELINE.md`：本次训练、移除/撤销、加动作与双语无障碍文案。
  - `docs/工作记录/2026-07-10-testflight-acceptance-checklist.md` N1/N14：S2 有意入口演进、冻结语义、重复 id、quick-adjust、窄屏/最大字号/VoiceOver 真机项。
  - `CHANGELOG.md`、`DEV_LOG.md`：用户可见结果、测试/运行证据、独立审查修复与真实残余风险。
- gate：最终代码输入上运行仓库根 `.claude/quality-gate.cmd`，exit `0`；10 个 Swift 包、8 个 ForgedCard 预算、通用 iOS Simulator build 与白名单 app-hosted 测试全部通过。`RedeTrainingDecision` 完整包 461/461；最终白名单 53/53，其中 `SessionStoreDraftTests` 32/32。xcresult：`~/Library/Developer/Xcode/DerivedData/Rede-fehbzdcxewzuvxgixmetankthjqd/Logs/Test/Test-Rede-2026.07.30_09-32-07--0400.xcresult`。尾部原文：

  ```text
  ** TEST SUCCEEDED **

  Testing started
  QUALITY GATE: PASS
  ```

- 实拍：全部 PNG 在 `.ai-tmp/session-edit/`，MD5 互异；失败态最大字号截图已清理，只保留最终证据。
  - `2026-07-30-sessionedit-editor.png` — `08732167b07cedcfa060baf3df910791`
  - `2026-07-30-sessionedit-picker.png` — `32a22639eedc744d2cacf23465757f76`
  - `2026-07-30-sessionedit-remove-undo.png` — `4161f5fb95d3807ea7df62b41b1c390e`
  - `2026-07-30-sessionedit-sets-plus.png` — `1009778835068c0b5fcd5ced2dfb1fdd`
  - `2026-07-30-sessionedit-added-queue.png` — `9402314971c4ec8c0b2b63c220974811`
  - `2026-07-30-sessionedit-added-card.png` — `cd81c732a9de0c129da0deef68fb8501`
  - `2026-07-30-sessionedit-restored.png` — `64ae668b19856c8acf39eff8bfae67bd`
  - `2026-07-30-sessionedit-review-normal.png` — `d4f97321ed218ddbaebc8f61f21fa7c8`
  - `2026-07-30-sessionedit-review-max-dynamic-type-green.png` — `f9e1f96d7586af0d00d331c561722423`
  - `2026-07-30-sessionedit-review-narrow-se3.png` — `d2fb503954ce60a6fa9a065632406161`
  - 启动/呈现复用 `-skipOnboarding -initialTab train -autoStartSession`、`-autoOpenSessionEdit`、`-autoOpenSessionEditPicker` 与 `-autoAdvanceExercises`；强杀用 Simulator 进程终止/重启走真实 draft 恢复，不新增自动写入事实的生产入口。
- 未尽事项：
  - 代码层独立终审最终 `P0/P1/P2 = 0`；处方引擎、轮转、verdict、周口径、自动均衡、疼痛保守态、schema/version、`project.pbxproj` 与全部 `Package.swift` 相对基线零改。
  - iPhone 17 Pro 与最窄可运行 iOS 26.5 机型 iPhone SE 3（375pt）已真 Simulator 通过；旧 320pt iPhone SE 1 设备型与本机唯一 iOS 26.5 runtime 不兼容，CoreSimulator 在创建设备前以 code 403 拒绝，因此没有把 320pt 冒充实测。
  - Apple 不在 Simulator 提供 VoiceOver；本轮两台登记 iPhone 均离线。因此 VoiceOver 实听/焦点、真手空白命中、触感及长列表滚动手感仍保留在 TestFlight N14，未伪报通过。代码已有稳定 identifier、完整双语 label/hint、成功 announcement、44pt 几何与最大字号布局。
  - 训练结束后显式「存回计划」仍是后续独立批；本批没有入口。
  - 主 Simulator 字号已恢复 `large`；本轮临时 iPhone SE 3 Simulator 与临时 checkout/build 目录已按精确目标删除。未 push、未开 PR。
