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
- 不新增 tab、不弹窗、当前动作行不在编辑面出现（当前动作的语义出口=跳过/换动作，已有）。
- 入口可达性沿 S1 既有规则；触感/动画与既有 sheet 一致。

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
   - ⛔ 禁止任何无出处的魔法数字出现在处方行。
3. **落盘**：以既有 exercises 元素字段正常落盘（真实事实进统计/MLE/引擎，replace 先例已证明下游容忍）；另加 open-bag 标记留痕（如元素内 `"adHocAdded": true` 或 storage 级 `sessionEdits`——形态你定，**不 bump schema**，回执写明）。审计口径：临时加的动作不参与轮转/verdict/计划对账的任何「计划 vs 实际」偏差告警（如有）。
4. 引擎处方逻辑零改动——加动作是会话内事实，下次处方由引擎照常从 clean sessions 读取。

## 裁定 C：移除动作

1. **语义 = 中性移除**，与跳过严格区分：不问四码原因、**不写 skippedExercises、不进疼痛信号**、不算完成也不算跳过。
2. 仅可移除**尚无任何事实**（零完成组、零跳过、零疼痛登记）的**后续**动作；当前动作不可移除（跳过/换动作已覆盖）；按**位置**移除（自由日序可有重复 id，不得整 id 误删）。
3. 落盘 open-bag 留痕（如 `sessionEdits.removed`：exerciseId + 原位置），供统计诚实与将来「存回计划」批使用；移除的动作不出现在 exercises 数组。
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
2. **golden 零回归**：不使用编辑功能时 SessionSetPlanner.expand 与落盘输出逐字节等价现状。
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
