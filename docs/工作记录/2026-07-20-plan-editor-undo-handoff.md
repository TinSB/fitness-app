# 交接件：计划日编辑器 撤销移除 + 恢复默认常驻/暂存化（owner 实机反馈批）

> 日期：2026-07-20 ｜ 来源：owner 实机反馈「点击移除后没有一键撤回功能，也没有一键恢复默认功能」
> 性质：ROUTE-MAINTENANCE（UX 缺口）+ 小型行为变更（恢复默认语义暂存化，owner 授权代决已裁定）
> 上游：FR-PL6 自定义训练计划（#600-606）；现场 = ios/Rede/PlanDayEditorView.swift（396 行）

## Agent Contract

- **Role**：iOS 实施工程师（SwiftUI + 纯逻辑抽取）
- **Scope**：PlanDayEditorView 及其直接依赖（文案/纯模型/SessionStore 只读接口）；禁碰处方引擎判定、写闸语义、canonical schema
- **Outputs**：代码 + 测试 + 模拟器实拍 + 回执（模板文末，**收尾必须回填本文件**——上两批都因未回填吃过审查 MINOR）
- **Budget**：单 agent 串行；同一问题修 3 次不过即停
- **Handoff target**：主会话验收；**不 push 不开 PR**

## 现场事实（已核实）

- `exerciseIds: [String]` 是暂存工作副本；`remove(id)` 纯删数组无撤回；`apply()` → `applyCustomDayPlan` 落盘；`restore()` → `removeCustomDayPlan` **立即落盘并 dismiss**，且按钮仅 `wasCustomized == true` 时渲染（actionRow，~184 行）。
- 教练默认日序有现成来源：TodayPrescriptionEngine ~97/152 行注释明示「纯模板默认，不含自定义——恢复默认的目标」；`SessionStore.loadDayEditorContext` 已回 `currentExerciseIds/isCustomized`，默认列表若未随 context 返回则加一个只读字段带回（磁盘读保持 off-main 惯例）。
- 撤销浮条品牌先例：今日页换动作/换天练的撤销条语言；sheet 内实现可用轻量行内条（不必复用跨页 toast 基建）。
- 截图钩子：`-autoOpenPlanEditor`（现成）。

## 裁定 A：移除撤销（逐步撤回栈）

1. `remove(id)` 时压栈 `(id, 原 index)`；出**sheet 内撤销条**（actionRow 之上、影响预览之下的位置自定，离线/实机迭代看呼吸感）：「已移除「动作名」· 撤销」——动作名=最近一次移除；撤销=pop 栈顶，动作还原到 `min(原 index, 当前 count)`；栈非空条常驻，逐次点击逐个还原；栈空条消失。
2. 防呆：还原前 guard `!exerciseIds.contains(id)`（期间经添加器重新加入过则跳过该条继续 pop）；换动作（swap）不入栈（已有原位替换语义）；恢复默认/采纳/取消后栈清空。
3. 视觉纪律：条上唯一 ember 是「撤销」动作词；其余 t3；不加图标不加小字。a11y label 完整（「已移除 哑铃卧推，撤销」）。
4. **纯逻辑抽取**：撤栈/还原/清栈规则做成可单测纯模型（优先进 RedeTrainingDecision 或 app 内 internal struct + app-hosted 测试二选一——若选 app-hosted，新测试类必须同批加进 `.claude/quality-gate.cmd` 与 `rede-ci.yml` 白名单，两处同一份清单）。

## 裁定 B：恢复默认 常驻 + 暂存化

1. 按钮**常驻显示**（去掉 `wasCustomized` 条件）；当 `exerciseIds == 教练默认日序` 时 **disabled 置灰**（不隐藏，防布局跳动）。
2. 语义改暂存：点击 → `exerciseIds = 默认日序` + `recomputeImpact()` + **留在 sheet**；不再直接落盘不再 dismiss。落盘仍走「采纳修改」。
3. `apply()` 增加收敛：暂存列表 == 默认日序且 `wasCustomized` 时，落盘走 `removeCustomDayPlan`（清掉自定义记录）而非写一份与默认等值的自定义——canonical 不留冗余覆盖；`wasCustomized == false` 且列表==默认时采纳等价于无操作（可直接 dismiss，不写盘）。
4. 行为变更写回：这是既有行为变更（原「恢复默认=立即落盘」），PRD FR-PL6 验收句与系统逻辑对应节（grep 定位）同批改写；设计语言若记载编辑器动作行也同步。

## 验收标准（owner 大白话）

1. 误删一个动作 → 底部出现「已移除「X」· 撤销」→ 点撤销回到原位置。连删三个可以连撤三次。
2. 「恢复默认」一直可见；没改过时是灰的；点了列表变回教练默认，还要按「采纳修改」才真生效；点「取消」一切不变。
3. 已自定义过的天恢复默认并采纳后，再开面板「恢复默认」是灰的（自定义记录已清干净）。
4. 影响预览随撤销/恢复实时更新；训练页/今日页处方与采纳结果一致。

## 验证与证据

1. 纯模型测试先红后绿（撤栈还原顺序/重复 id 跳过/清栈时机/默认等值判断）。
2. 模拟器实拍（`-autoOpenPlanEditor`；装前真 build；前台确认 Rede）：移除后撤销条、撤销还原、恢复默认置灰→可用→列表重置、采纳后再开面板置灰。证据 PNG 前缀 `2026-07-20-planundo-`。
3. 每 commit 仓库根 gate exit 0（freeze-once 两冻结点即可）；受影响包定向测试。
4. **不 push 不开 PR**（等下一个实质批次或主会话决定）；git status 干净后 pathspec 提交。

## 红线

- 不动处方引擎判定/写闸/schema；不动拖动重排与换动作既有交互；RedeL10n 新串走 PlanCustomizationCopy + 精确断言；版本号不动。

## 实施回执模板（收尾必填回本文件）

```
## 实施回执
- commit 清单：[hash + 一句话]
- A 撤销栈：[实现位置 + 测试数 + 实拍文件名]
- B 恢复默认：[常驻/暂存/收敛落盘三点确认 + 实拍]
- 规格写回：[PRD/系统逻辑/设计语言 逐处]
- gate：[exit + 尾部原文；若新增 app-hosted 测试：白名单前后条数]
- 未尽事项：[如实列]
```

## 实施回执（2026-07-20 回填）

- **commit 清单**（分支 `codex/0720-plan-editor-undo`，基线 = 最新 origin/main 7b40f6b；不 push 不开 PR）：
  - `2b177e9` 纯模型 PlanDayEditUndoModel + PlanDayEditRules（TDD 先红后绿，11 测；验收批补 1 条重排×撤销语义锁 → 现 12）
  - `2517642` 撤销条双语文案 planEditRemovedLine + a11y 整读（精确断言；撤销词复用 coachUndoLabel）
  - `6b539aa` PlanDayEditorView 撤销条 + 恢复默认常驻/暂存化 + 采纳收敛；DayEditorContext 加 defaultExerciseIds
  - 后续一条：规格写回 + 证据 PNG + DEV_LOG + 本回执（即本文件所在提交）
- **A 撤销栈**：纯逻辑在 `RedeTrainingDecision/Sources/RedeTrainingDecision/PlanDayEditModel.swift`（选了包内而非 app-hosted → 无需动 gate/CI 白名单）；`PlanDayEditModelTests` 11 条先红（cannot find 'PlanDayEditUndoModel'）后绿，覆盖：原位还原/三连删三连撤/index 夹取/重加入跳过继续 pop/全被跳过返 nil/空栈/清栈/收敛三分支/默认等值判断。包全量 391 测 0 失败。视图侧撤销条在影响预览之下、actionRow 之上，正文 t3 + 唯一 ember「撤销」，零图标零小字，a11y =「已移除 X，撤销」；swap 不入栈；恢复默认/采纳/取消清栈。实拍：`2026-07-20-planundo-02-removed-undo-bar.png`（移除后条出现）、`03b-multi-remove-no-undo.png`（连删 2 未撤：列表缺两项、条显最近移除——与 02 可区分的中间态）。
- **验收批证据勘误（2026-07-21 主会话）**：原 `03-undone-restored.png` 与 01、原 `03b` 与 02 **字节级相同**（端态像素本就重合：撤销还原后==置灰基线、连删 2 撤 1 终态==只删 1 终态——两对场景的确定性终态一致，非独立证据但也非造假）。处置：删除零增量的 03，重拍 03b 为可区分的「连删 2 未撤」中间态；**撤销还原的行为真相由纯模型测试锁定**（含验收批补的重排×撤销语义锁，现 12 条），实拍只证端态与条的存在。撤销条动效（transition 修复后）与真手感仍留 TestFlight 待验。
- **B 恢复默认**：①常驻——`wasCustomized` 渲染条件已去除，列表==教练默认时 disabled 置灰（发现 redePressable+硬设 foregroundStyle 不自带禁用变暗 → 显式换色 `redeT4.opacity(0.4)`，同 iconButton 口径，像素级对比过亮/暗两态）；②暂存——点击只 `exerciseIds = defaultIds` + recomputeImpact，留在 sheet 不落盘不 dismiss；③收敛落盘——采纳走 `PlanDayEditRules.applyResolution`：==默认且已自定义 → `removeCustomDayPlan`（实测 canonical `planCustomization` 采纳后 = null，容器整个清掉、零冗余自定义）；==默认且未自定义 → noop 不写盘直接关。实拍：`01-default-restore-disabled.png`（未改过置灰）、`04-customized-restore-enabled.png`（已自定义可用）、`05-restore-staged-in-sheet.png`（点击后列表变回默认、仍在 sheet、按钮转灰）、`06-reopen-after-apply-disabled.png`（采纳后再开面板置灰=记录已清干净）。
- **规格写回**：PRD FR-PL6 行为句（撤销条语义 + 常驻/暂存三点）与 FR-PL6.2/6.3（「单步恢复默认」改「先重置工作副本、采纳收敛落盘」+ applyResolution 三分支）；系统逻辑 §8.2 编辑器 UI 段（撤销栈/撤销条/置灰实现细节/DayEditorContext 新字段）+ 诚实红线段钩子清单（补 `-autoRemoveFirstExercise N` / `-autoUndoRemoval` / `-autoRestoreDefault` / `-autoApplyPlanEdit`）；设计语言 = N/A（grep 确认该文档未记载编辑器动作行，仅 FR-TR14 段提及不复制拖拽编辑器——无对应节可改）。
- **gate**：两冻结点均 exit 0，尾部原文 `QUALITY GATE: PASS`（冻结 1 = 代码三提交后；冻结 2 = 文档/证据提交后）。新测试全在 SPM 包内（RedeTrainingDecision + RedeL10n，gate 本就全量跑包测试）→ app-hosted 白名单不变（前后均 26 条）。
- **未尽事项（如实）**：
  1. 实拍交互为钩子驱动（`-autoRemoveFirstExercise` 等驱动**真实** remove/undo/restore/apply 函数），非手指点击——开拍时 owner 正在用这台 Mac，computer-use 点击三次被 user interrupt 中断，遂回退到仓内既定先例（`-autoOpenLibrary`「simctl 无法点击 UI」同款）。真手点连贯手感（含撤销条出现/消失动画）建议随下一次 TestFlight 顺手一验。
  2. 范围外疑点报备：`PlanDaySequenceEditorView`（FR-PL7② 日序编辑器）的「恢复默认」仍是旧语义（仅 isCustomized 时显示 + 立即落盘 dismiss）——与本批改后的动作编辑器语义不一致。handoff 划定 Scope=PlanDayEditorView，未动它；是否统一由 owner/主会话拍板。
  3. 模拟器数据已还原为进场前状态（scratchpad 备份 + 写闸自动备份都在）；采纳收敛的 null 证据来自流程中段的真实落盘读数。
  4. 影响预览在「恢复默认」后显示「没有明显下降」（护栏只报跌破 2× 的肌群；恢复默认通常是改善方向）——符合现有护栏语义，非缺陷，报备知悉。
