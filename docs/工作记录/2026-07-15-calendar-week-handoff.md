# 周口径迁移批次交接件：引擎周计划窗口 滚动 7 天 → 日历周（2026-07-15）

> owner 拍板「单独立项」（N3+N4 批次遗留决策）。背景：#696 给今日页上了日历周分段条，
> 展示层已统一日历周口径，但引擎的「周计划」判断（轻练裁决 + 教练补量卡）仍是滚动
> 7 天窗口——文案被迫写成「近 7 天」。本批把判断逻辑本体迁到日历周（周一重置），
> 文案随之改回自然的「本周」措辞。三段式：本交接件 = 任务 prompt；串行实施 agent；
> 主会话验收（门禁 + 独立审查 + 实拍 + 规格写回 + PR）。

## Agent Contract

- **Role**：实施工程师（Swift 引擎 + L10n），改已上线核心裁决逻辑——code-regression-guard 纪律
- **Scope**：TodayVerdictEngine 周窗口迁移 + CoachActionEngine 喂数跟随 + 文案回迁「本周」+ 测试/goldens 更新；**不碰** WeeklyAdherence（已是日历周）、MLE、通知、UI 布局
- **Inputs**：本文件 + main @ 795c243 之后
- **Outputs**：分支 `codex/2026-07-15-calendar-week` 上 1-2 个 commit + 本文件底部「实施回执」补全
- **Budget**：一轮；同一问题修 3 次不过即停
- **Stop condition**：门禁 exit 0 + 行为对照表齐 → 停交主会话；语义歧义 → 停下回报
- **Handoff target**：主会话

## 现状（影响面已勘）

- `TodayVerdictEngine.swift:85` `last7 = trainedDays.filter { $0 > today - 7 }.count` → 信号 `.sessionsInLast7Days(last7)`；`:118` `last7 >= planned → .light(.weeklyPlanReached)`
- `CoachActionEngine` 输入 `sessionsLast7`（补量卡 `belowWeeklyPlan`，count = planned − sessionsLast7）；其抑制键 `volumeBoost:<weekStartISO>` **已经是日历周**——同一张卡两种口径混用（#696 审查 MINOR 实锤）
- `WeeklyAdherence`：已日历周（WeekAnchor.isoWeekStart，排除进行中本周）——**不动**
- 展示层：分段条/「本周练 N 天」已日历周（#696）；「近 7 天」措辞是临时桥（本批终点=删桥）

## 目标语义（迁移设计）

1. **新窗口**：`trainedDaysThisWeek` = 今天所在 ISO 周（周一始）内 **周一..今天** 的去重训练天数（含今天；future 天然不可能有记录）。day-number 数学就地实现 `mondayOf(day:)`（与 RedeLocalSnapshot.SnapshotDayMath 的 (z+3) mod 7 同款；RedeTrainingDecision 不新增包依赖），TDD：周一/周三/周日锚点 + 跨周边界测试。
2. **信号替换**：`.sessionsInLast7Days` 退役 → 新信号 `.trainedDaysThisWeek(Int)`（enum case 命名以实际语义为准）。全库 grep 消费者一并迁移；不保留双信号（单一真源，防再分叉）。
3. **裁决**：`trainedDaysThisWeek >= planned → .light(.weeklyPlanReached)`。reason payload 命名如涉「sessions」酌情改「days」（诚实命名），波及处同步。
   - **语义变化点（有意，声明非回归）**：周日练满计划 → 下周一起重新计 train（原滚动窗会 light 到周中）。周初连续高频的保护由既有 `consecutiveDaysNeedRest` 与 `sustainedLoad` 裁决承担，无保护真空。
4. **CoachActionEngine**：输入改喂 `trainedDaysThisWeek`（字段名跟随），`belowWeeklyPlan` 的 count = planned − trainedDaysThisWeek；至此该卡「计数口径」与「按周抑制键」终于同源。
5. **文案回迁**（L10n）：
   - weeklyPlanReached：zh「今天轻练　本周量已够，留有余力」/ en "Go light today. Weekly volume is in, keep some in reserve"（恢复原文案——现在口径真是本周了）
   - belowWeeklyPlan：zh「本周还差 N 天就到计划　有空补一次就好」/ en 对应（**单位=天**，与分段条/weekStripCount 合流；不要回到「次」）
   - **删除 #696 加的反向防回潮断言**（en 禁说 week/本周——前提已消失），替换为正向断言（文案含「本周/this week」+ 数据源注释更新）
6. **回归防护（code-regression-guard）**：先跑全量测试建基线；weeklyPlanReached/coach 相关 fixtures 从滚动语义翻译到日历周语义（fixture 日期选择让 case 语义不变——参考 #693 平移手法）；新增「周日练满→周一 train」的行为变化锁测试（防有人无意改回）。

## 红线

- WeeklyAdherence / MLE / 通知 / 回归协议 / 轮换逻辑零改动（grep 确认无连带）
- 信号是公共类型：改动后全库编译零 warning、无临时兼容层（不留 deprecated case）
- 中西混排空格；文案观察式（copy baseline §3.4/3.5）
- 每个 commit 门禁 exit 0（真实 exit code）

## 验收证据（agent 自验，主会话复验）

- 行为对照表（写进回执）：至少 4 行——周一（上周日练满）/ 周三练满 planned / 周三未满 / 周日练满，各给「迁移前 call → 迁移后 call」
- 模拟器实拍 ×2：①种子「本周已练满 planned」→ 今日页轻练态 +「本周量已够」新文案与分段条同屏一致；②教练补量卡「本周还差 N 天」（种子低于计划且 call=train）
- 钩子/种子基建沿 N3N4 交接件（动态 get_app_container、真实动作 id、前台确认 Rede）
- 实拍存 scratchpad `…/2eac2909-…/scratchpad/calweek/`

## 实施回执（agent 完成后填写，2026-07-15）

- [x] **commit**：`63afad2`（迁移本体，10 files +125/−62）。**信号迁移清单**：
  - 删：`VerdictSignal.sessionsInLast7Days(Int)`；`CoachActionInput.sessionsLast7`
  - 加：`VerdictSignal.trainedDaysThisWeek(Int)`（日历周周一..今天去重训练天数）；`CoachActionInput.trainedDaysThisWeek`
  - reason payload 诚实命名：`weeklyPlanReached(sessions:planned:)` → `(days:planned:)`（code 串 "weeklyPlanReached" 不变 → goldens 零漂移，L10n key 挂点不动）
  - 窗口：`TodayVerdictEngine` 复用既有 `TrainingDay.isoWeekStartDay(of:)`（2026-07-08 已就地存在，含周一/周三/周日+跨周锚点测试 WeeklyCycleModeTests.testIsoWeekStartAnchors——未重复造 mondayOf）
  - 消费者全库迁移 5 处：TodayVerdictEngine（产出点）/ CoachActionEngine（守门+count）/ ios/Rede/TodayModel.swift（app 层唯一信号消费者）/ TodayEngineCopy（weeklyPlanReached 回迁「本周量已够」）/ CoachActionCopy（belowWeeklyPlan 回迁「本周还差 N 天」，单位=天，en 单复数分流）
  - 测试：fixtures 平移到日历周内（#693 手法，2 处）；新增 4 个引擎测试（周日练满→周一 train 行为锁 / 周中练满 / 周中未满 / 信号断言）；#696 两处反向防回潮断言换正向（文案必须含「本周/week」+ 单位=天断言）
  - 零改动确认（红线）：WeeklyAdherence / MLE / RedeNotifications / 回归协议（longGapDays）/ 轮换（rotationBase）——全库 grep 无 `sessionsInLast7Days|sessionsLast7` 残留（唯一残留 = TodayVerdict.swift 注释中的退役历史指称）
- [x] **行为对照表**（planned / 训练日 / 今天 → 迁移前 call → 迁移后 call）：

  | 场景 | 输入 | 迁移前（滚动 7 天） | 迁移后（日历周） |
  |---|---|---|---|
  | 周一·上周三/五/日练满 | 3；06-03/05/07；今天 06-08 周一 | light·weeklyPlanReached（窗内 3≥3） | **train·normalProgression**（本周 0）——有意变化，行为锁测试 |
  | 周三练满 | 2；06-08/09；今天 06-10 周三 | light·weeklyPlanReached | light·weeklyPlanReached(days:2)（同判，payload 单位改天） |
  | 周三未满 | 3；06-08；今天 06-10 周三 | train·normalProgression（1<3） | train·normalProgression（本周 1<3，同判） |
  | 周日练满 | 3；06-08/10/12；今天 06-14 周日 | light·weeklyPlanReached（3≥3） | light·weeklyPlanReached（本周 3≥3，同判） |
  | 跨周残影·上周四/六/日 3 场本周 0 | 3；07-09/11/12；今天 07-15 周三 | light·weeklyPlanReached（窗内 3≥3） | **train·normalProgression**（本周 0）——实拍 ③ |

- [x] **门禁 exit code**：commit 1 前 `.claude/quality-gate.cmd` = **0**（QUALITY GATE: PASS；基线 run 亦 0，零真实编译 warning——12 处 "warning" 匹配均为 swiftc `-suppress-warnings` 旗标，与基线相同）；commit 2（回执文档）前再跑 = **0**（QUALITY GATE: PASS；RedeTrainingDecision 357→360 tests，0 failures）
- [x] **实拍路径**（scratchpad `…/2eac2909-…/scratchpad/calweek/`，模拟器 iPhone 17 Pro 5346FC17，前台逐张目检为 Rede，真实日期 2026-07-15 周三）：
  1. `1-light-weeklyplan-thisweek.png` — 种子本周一/二练满计划 2 → 「今天轻练」pill + 分段条 ●●＋今日描边 + 「本周练 2 天」同屏同口径
  2. `2-coachcard-top.png` — 种子本周 1/4 → 「可以训练」+ 教练卡「本周还能再练／本周还差 3 天就到计划　有空补一次就好」与分段条「本周练 1 天」同屏（1+3=4=计划，计数与按周抑制键同源）
  3. `3-newweek-reset-train.png` — 行为变化对照：上周四/六/日 3 场（全在滚动 7 天窗内，旧语义必 light「近 7 天量已够」）→ 新语义「可以训练」+「本周练 0 天」+ 补量卡还差 3 天
- [x] **偏离决策**：
  1. 「本周量已够」判断句未实拍上屏：`verdictHeadline` 仅在无处方态（restBlock）与 Widget 无处方分支渲染，而 light 恒有处方——迁移前的「近 7 天量已够」同样不在今日页处方态出现（非本批改动造成的既有渲染结构）。文案由 L10n 正向断言锁定（zh 含「本周」/en 含 week），验收意图由实拍 ①（轻练态+分段条同口径）与 ③（行为对照）覆盖。
  2. mondayOf 未新增实现：`TrainingDay.isoWeekStartDay(of:)` 已存在且有完整锚点测试，直接复用（少即是多，不重复造）。
  3. 实拍 3 张而非 2 张：多补一张行为变化对照照（③），直观证明「滚动窗→日历周」的裁决差异。
