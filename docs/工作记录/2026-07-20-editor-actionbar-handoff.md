# 交接件：计划编辑器操作区重构 + 交互质感 + 双编辑器统一（owner 实机反馈批）

> 日期：2026-07-20 ｜ 来源：owner「按钮位置放的不好，交互也很单调」（计划日编辑器底部操作区）
> 性质：ROUTE-MAINTENANCE（UX 缺口）+ 上批遗留统一（日序编辑器恢复默认旧语义）
> 上游：#708（撤销/恢复默认暂存化）；现场 = PlanDayEditorView.swift + PlanDaySequenceEditorView.swift

## Agent Contract

- **Role**：iOS 实施工程师（SwiftUI 视觉/交互）
- **Scope**：两个编辑器的操作区结构与交互反馈 + 日序编辑器恢复默认语义统一；禁碰引擎判定/写闸/撤销栈纯模型语义
- **Outputs**：代码 + 测试 + 双编辑器模拟器实拍 + 回执（**必须回填本文件**）
- **Budget**：单 agent 串行；同一问题修 3 次不过即停
- **Handoff target**：主会话验收；不 push 不开 PR

## 裁定 A：日编辑器操作区重构（PlanDayEditorView）

现状：actionRow = 左「采纳修改」（body 字号文字钮）+ 右「恢复默认」「取消」（caption 文字钮）——主操作无主操作形态，三钮挤一行。

目标结构（自上而下）：
1. 列表 / 添加动作 / 影响预览 / 撤销条（均不动）
2. **「恢复默认」安静文字行**：右对齐 caption（置灰规则与 #708 一致——列表==教练默认时 disabled `redeT4.opacity(0.4)`）
3. **「采纳修改」品牌主按钮**：EmbButton 全宽（同 What's New「继续」/今日页「开始训练」idiom；图标可用 checkmark 或不用，对照两个先例定）；`exerciseIds.isEmpty || isSaving` 时 disabled；**新增：工作副本 == 打开时初始列表（无改动）时也 disabled**（无改动没有「采纳」可言——这是行为微变，写回时注明）
4. **「取消」上移 sheet 顶部右上 ✕**：同 AppUpdateWhatsNewSheet 先例（xmark + redePressable + a11y label「取消」）；底部不再有取消文字钮。sheet 本身的下滑关闭 = 取消语义照旧（暂存不落盘天然安全）
5. sheet 头部现状是标题+副句——✕ 放右上与标题同行，对照 What's New sheet 的 header 结构实现

## 裁定 B：触感与动效（克制，不花哨）

1. **系统触感**：移除（light）、撤销还原（light）、恢复默认（medium）、采纳成功（success notification）——先 grep 全仓找现成 haptic 先例/wrapper（如有沿用；没有则 UIKit generator 就地封一个小 helper，DEBUG 下零成本）。禁止给每次滚动/普通点按加震。
2. **动效**：行移除/还原的 easeInOut 位移已有、撤销条淡入淡出 #708 已修——本批只需保证新按钮结构下这些仍顺滑；主按钮用既有 redePressable 按压态即可，不加自定义弹跳。

## 裁定 C：日序编辑器统一（PlanDaySequenceEditorView，上批遗留收口）

1. 底部操作区采用与裁定 A 相同结构（主按钮 + 恢复默认文字行 + 顶部 ✕）。
2. **恢复默认语义统一为暂存化**：常驻显示（序列==默认时置灰）；点击只重置工作副本、留在面板；采纳才落盘；序列==默认且已自定义时采纳走清除自定义（对照 #708 的 applyResolution 三分支模式，若该编辑器有对应写闸接口则同构实现；纯逻辑若可复用 PlanDayEditRules 泛化之，不可复用则新小纯模型 + 测试）。
3. 该编辑器若无撤销栈需求（重排没有「删除」动作）则**不加撤销条**——不为对称而对称。

## 验收标准（owner 大白话）

1. 编辑面板底部是一个全宽大按钮「采纳修改」，一眼就是主操作；没改过时它是灰的
2. 取消在右上角 ✕，和 What's New 弹层一个位置；下滑关面板照样等于取消
3. 移除/撤销/恢复默认/采纳时手上有轻微震感，动画顺滑
4. 改训练日先后的面板（日序编辑器）长一个样、规矩一致——恢复默认也是点了先预览、采纳才生效
5. 功能零减少：撤销栈/置灰/影响预览/拖动重排全部照旧

## 验证与证据

1. 有可测纯逻辑（无改动判定、日序 applyResolution）先红后绿；既有 PlanDayEditModelTests 391+ 全绿不动语义
2. 模拟器实拍（装前真 build；前台确认 Rede；PNG 前缀 `2026-07-20-actionbar-`）：日编辑器新操作区（默认置灰态+有改动态）、✕ 关闭、日序编辑器统一后对照、恢复默认暂存中间态
3. 每 commit 仓库根 gate exit 0（freeze-once 两冻结点可）
4. 规格写回：PRD FR-PL6（操作区形态+无改动禁采纳）与 FR-PL7（日序恢复默认暂存化——行为变更）；系统逻辑 §8.2 对应段；设计语言若有 sheet 操作区通例（grep 定位，无则 N/A 说明）
5. 不 push 不开 PR

## 红线

- 撤销栈纯模型语义不动（PlanDayEditUndoModel 测试一条不改）；引擎/写闸只走既有接口
- ember 单焦点纪律：主按钮是该面板唯一大 ember 面；恢复默认/✕ 保持中性
- RedeL10n 改动走精确断言；版本号不动（1.9/26 已归档，本批进下个 bump）

## 实施回执模板（收尾必填回本文件）

```
## 实施回执
- commit 清单：[hash + 一句话]
- A 日编辑器操作区：[结构确认 + 无改动禁采纳实现 + 实拍]
- B 触感动效：[haptic 先例查证结果 + 四动作接线 + 克制边界]
- C 日序编辑器：[结构统一 + 暂存化三分支 + 测试 + 实拍]
- 规格写回：[逐处]
- gate：[exit + 尾部原文]
- 未尽事项：[如实列]
```

## 实施回执（2026-07-21 回填）

- **commit 清单**（分支 `codex/0720-editor-actionbar`，基线 = 最新 origin/main c384b4b；不 push 不开 PR）：
  - `0622374` 纯模型：无改动判定 hasChanges + 日序复用 applyResolution 合同（TDD 先红后绿，+5 测 → RedeTrainingDecision 396 全绿）
  - `51fb1dd` 日编辑器操作区重构（裁定 A）+ 四动作系统触感（裁定 B）
  - `f4a1baf` 日序编辑器统一操作区 + 恢复默认暂存化（裁定 C）
  - 后续一条：规格写回 + 证据 PNG + DEV_LOG + 本回执（即本文件所在提交）
- **A 日编辑器操作区**：结构（自上而下）=「恢复默认」右对齐安静文字行（caption 常驻，置灰 `redeT4.opacity(0.4)` 口径不变）→「采纳修改」EmbButton 全宽 →取消上移右上 ✕ 与标题同行（xmark 13 semibold / t2 / controlHeight² / redePressable / a11y「取消」/ identifier `plan-day-editor-close`），底部取消钮移除、下滑关面板=同一取消语义。图标对照两先例定：What's New「继续」用 arrow.right 是**前进**语义，设置保存 `EmbButton(icon:"checkmark")` + `.opacity(0.45)` 禁用是**保存**语义——采纳=保存 → checkmark + 同款 0.45 禁用透明。无改动禁采纳=新增 `initialIds` 基线（load 去重后快照）+ `PlanDayEditRules.hasChanges` 纯函数（先红后绿）；关键协同路径有测试锁：已自定义日恢复默认→列表==默认但≠initial→采纳仍可点、落盘走 clearCustom。实拍：`2026-07-20-actionbar-01-dayeditor-default-disabled.png`（无改动：采纳灰+恢复默认灰+✕ 在位）、`02-dayeditor-changed-enabled.png`（移除 1 行：撤销条+恢复默认亮+采纳全亮，对比明显）。
- **B 触感动效**：先例查证=全仓统一 SwiftUI `.sensoryFeedback` + 单调自增 pulse 计数器（TodayTabView 采纳=.success、TrainTabView `.impact(weight:)` 分档、设计语言 §14.2 词汇表 + pulse 纪律），无 UIKit wrapper——直接沿用，零新助手。四动作接线：移除=`.impact(.light)`、撤销还原=`.impact(.light)`（无可还原不震）、恢复默认=`.impact(.medium)`、采纳成功=`.success`（三收敛分支均先于 dismiss 触发）。克制边界：滚动/普通点按/✕ 取消不加震；既有 lift/move 拖动触感、easeInOut 移除动画、撤销条 transition 全部未动（undoModel 变更仍在动画事务内）；主按钮按压态=EmbButton 内建 redePressable，无自定义弹跳。
- **C 日序编辑器**：结构与 A 完全同构（✕ identifier `plan-seq-editor-close`；重排无「删除」动作→不加撤销条，不为对称而对称）。暂存化三分支=**复用** `PlanDayEditRules.applyResolution`（形参本就是 `[String]`，泛化零改动；新增日序合同测试锁 writeCustom/clearCustom/noop）；恢复默认点击只 `dayCodes = defaultOrder` 留面板、「下一个训练日」预览实时跟随；`DaySequenceContext` 新增 `defaultDayCodes`（load 侧本就计算 defaultDaySequence，单一来源防复算漂移）。canonical 实测（写闸真走）：`-autoSeqMoveFirstDown` + `-autoApplySeqEdit` → `daySequence=['pull-a','push-a','legs-a','upper','lower']`；再 `-autoSeqRestoreDefault` + `-autoApplySeqEdit` → `daySequence=null` 且既存 upper 日 dayPlans 原样保留（clearCustom 生效 + 模拟器数据还原进场前状态）。实拍：`03-seqeditor-default-unified.png`（统一对照：恢复默认常驻置灰——旧版此态根本不显示）、`04-seqeditor-changed-enabled.png`（首行下移：预览实时变「拉 A」+双钮亮）、`05-seqeditor-restore-staged.png`（暂存中间态：序回默认+恢复默认转灰+采纳仍亮+仍在面板）。
- **规格写回**：PRD FR-PL6（行为句：全宽主按钮/无改动置灰/右上 ✕；状态列注明**行为微变**）、FR-PL7（日序操作区同构+暂存化，状态列注明**行为变更**）、FR-PL6.2/6.3（状态列补日序复用 applyResolution→removeCustomDaySequence）；系统逻辑 §8.2 编辑器 UI 段（操作区重构+hasChanges/initialIds+触感分档）、日序编辑器段（同构+暂存化+defaultDayCodes+不加撤销条理由）、诚实红线段钩子清单（补 `-autoSeqMoveFirstDown` / `-autoSeqRestoreDefault` / `-autoApplySeqEdit`）；设计语言 §12.3 弹层规范（新增**编辑类 sheet 操作区通例**——该节存在，非 N/A）+ §14.2 触感词汇表（新增 `.impact(.light)` 行、`.success` / `.impact(.medium)` 用例扩展）。
- **gate**：两冻结点均 exit 0，尾部原文 `QUALITY GATE: PASS`（冻结 1=三个代码提交后；冻结 2=文档/证据提交后）。新测试全在 RedeTrainingDecision 包内（gate 本就全量跑包测试）→ app-hosted 白名单不变。
- **未尽事项（如实）**：
  1. 实拍为钩子驱动（驱动真实 move/remove/undo/restore/apply 代码路径），非真手指点击——✕ 点击关闭与四档触感的真实手感无法在截图里证明，留 TestFlight/真机顺手一验（同上批先例；开拍时段避免再触 computer-use 干扰 owner）。
  2. 行为微变风险报备：无改动禁采纳后，「打开→什么都不改→点采纳」这条旧路径消失（旧行为等价于关面板，无落盘损失）；极端遗留态「存了与默认等值的自定义记录」（更早版本可能写出）现在因无改动而不能借直接点采纳触发清理——但 #708 起收敛逻辑已不会再写出该状态，且「恢复默认→采纳」路径仍可清理，判为可接受。
  3. 范围外疑点报备：日编辑器实拍中「推 A」日默认清单含高位下拉/单臂哑铃划船/哑铃弯举/杠铃耸肩（推日出现拉类动作）——属引擎默认模板/动作目录域，与本批操作区无关，一行未动；owner 如认为异常可另立调查。
  4. 版本号未动（1.9/26 已归档，本批进下个 bump）；撤销栈纯模型既有 12 测一条未改。
