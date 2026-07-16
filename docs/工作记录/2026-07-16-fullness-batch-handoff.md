# 去空虚化第一批交接件：K1-K5（2026-07-16）

> owner 反馈「一打开感觉没东西很空，不像完整的商业 app」→ 四 lens 并行诊断（空态盘点/
> 商业对照/埋没资产/PRD 积压，22 findings）→ owner 拍板第一批 K1-K5。
> 诊断结论：不是功能少，是「非训练时刻整屏枯竭 + 165 动作内容库无浏览入口（~88% 内容
> 永久不可见）」。三段式：本交接件 = 任务 prompt；串行实施 agent；主会话验收
> （门禁 + 三 lens 审查 + 实拍 + 规格写回 + PR）。

## Agent Contract

- **Role**：实施工程师（iOS/SwiftUI + L10n），只做本交接件范围
- **Scope**：K1 训练 tab 待机仪表 / K2 动作库浏览器（含训练中详情接线）/ K3 休息日今日页充实 / K4 练完态收尾 / K5 计划页收尾包；**引擎/裁决/持久化零改动**（全部是展示层 + 只读数据接线）
- **Inputs**：本文件 + 最新 main（≥ #699 合并后）
- **Outputs**：分支 `codex/2026-07-16-fullness-k1-k5`，按 K 编号 4 个 commit（K1 / K2 / K3 / K4+K5）+ 本文件底部「实施回执」补全
- **Budget**：一轮；同一问题修 3 次不过即停回报
- **Stop condition**：4 commit 全过门禁 + 自验实拍齐 → 停交主会话；红线冲突 → 停
- **Handoff target**：主会话

## 冲突裁定（主会话已拍板，不再开放讨论）

1. **动作库入口只放计划页，不进训练 tab**——系统逻辑 §7 明文「大型动作浏览禁入 Train」（诊断 lens 之间有分歧，此处以红线为准）。训练中只允许「当前动作」单点详情（K2c，非浏览）。
2. **训练 tab 待机态主按钮改为「开始训练」直启**（loadToday → startSession，路径与 -autoStartSession 钩子同源）——FR-T4「≤3 次点击开练」精神，少一次今日页折返。待机态内容 = 「训练准备」语义（预览+上次回执），不是 dashboard：零图表、零分析、零浏览入口。
3. **计数单位全线「天」**：任何新增「本周 N …」文案一律「N 天」（当前产品模型一天一场，天=场；「场/次」已在 #696/#697 两轮口径战争中出局）。周聚合一律 ISO 日历周 + `prefix(10)` 日期归一（#696 审查教训）+ `formatVolumeKg` 整数吨位。
4. **训练 tab 待机态不放周分段条**（今日页状态行已常驻，同信息不两处）。
5. **每屏 ember 唯一「下一步」**：训练 tab 待机 = 开始按钮；休息日今日页 = 「下一场」行；练完态 = 「下一场」行。其余新增内容全中性色。

## K1 · 训练 tab 待机仪表（commit 1）

**现状**：TrainTabView.swift ~939-952 `emptyState`——「今天还没开始训练」+「去今日页开始」按钮，85% 黑屏；6 个用户状态里 5 个落在此分支。

**改动**（保持 §12.5 空态语法：headline + 主按钮在顶，零新卡）：
1. 主按钮改「开始训练」直启（裁定 2）；无处方态（rest/休息日）不显示开始按钮——如实显示裁决语境。
2. 按钮下 RuleDivider + **「今天这场」预览区**：训练日名行 + 压缩动作清单（每行：动作名 + 目标 W×次，中性色，数据 = 今日页同一 prescription 投影——严禁重跑引擎，从 SessionStore/共享 model 取现成结果，批次 F 审查 M-1 教训）。
3. 尾部 **「上次」事实行**：「上次 · 7月13日　全身 C · 21,300 lb · 14 组」（ProgressSnapshot.HistoryEntry.first，加载与 loadCompletedDigest 同源；零历史时整行不渲染——不编数据）。
4. 休息日待机态：裁决一句 + 上次事实行 + 「下一场」预告行（PlanDayProjection）。
5. a11y：预览清单行合成读法；XXL 不挤压。

## K2 · 动作库浏览器（commit 2，本批唯一组件投资）

**现状**：165 条 exercises.json（93 条含双语技术要点/退阶进阶/安全注意/循证 URL）；动作详情 sheet 在 TodayTabView.swift ~1020（FR-EX2）只能从处方行/换动作/计划编辑器点进。

**改动**：
1. **抽共享详情 sheet**：把 FR-EX2 详情 sheet 从 TodayTabView 抽成独立可复用视图（优先挪 RedeComponents.swift；若体量放不下则新建 ExerciseDetailSheet.swift + ExerciseLibraryView.swift——**新建文件必须按 MuscleHeatmapView 先例手动登记 pbxproj 四处**，回执里写明登记 hash）。行为逐字节不变（现有消费点全部改指共享件后实拍回归）。
2. **分组清单浏览页**：按主肌群（10 契约组）分组的行式清单——分组 Overline 标题 + 行（动作名 + 器械 + 主肌群），行点开详情 sheet；组件语法复用 FR-PL6 加动作 picker 的分组列表。**纯清单非卡片墙**；支持 165 全量（懒加载 List/LazyVStack）。
3. **入口 = 计划页**：「调整训练日顺序」行之下加同款行式入口「动作库 · 165 个动作 ›」（chevron 披露语法，非按钮非卡）。
4. **K2c 训练中接线**：训练页当前动作名可点 → 打开共享详情 sheet（点击区与完成组按钮分离，勿碰组操作手势）。
5. L10n：入口串/分组标题复用 muscleGroupName；新串 zh/en + 测试。

## K3 · 休息日今日页充实（commit 3）

**现状**：TodayTabView ~370-382 无处方分支只渲染 restBlock 单句；3 练/周用户一周 4 天见此屏。

**改动**：
1. **「上一场」摘要块**：loadCompletedDigest 的 today-only 门槛放宽为「最近一场」（TodayCompletedDigestBuilder 从 history.first 派生；区头改「上一场 · 7月14日」——日期用 s.shortDate）。练完态语义不变（今天有场仍显「今天这场」）；休息日/回归日显最近一场。几何完全沿用现有总结卡（含 sparkline 规则 <2 场不渲染）。零历史新用户：不渲染（现状单句保留——新用户首练引导已有）。
2. **「下一场」预告行**：「下一场　全身 B · 6 个动作」（PlanDayProjection/PlanScheduleDigest 现成投影，ember 标此行，点击跳计划页 tab）。
3. 停练回归日（rest 裁决时）同分支自动受益。

## K4 · 练完态收尾 + K5 · 计划页收尾包（commit 4）

**K4**（TodayTabView 练完分支 completedSummaryBlock 之下，hairline 分隔零新卡）：
1. 「下一场」预告行（与 K3② 同组件同数据源，ember 标此行）。
2. 「本周」合计行：「本周练 3 天 · 合计 58,400 lb」（cleanView.sessions 按 ISO 周聚合 + prefix(10) 归一 + 整数吨位；与顶部分段条严格同源同单位——裁定 3）。

**K5**（PlanTabView）：
1. 「训练日构成」每行右侧补「上次 · 7/12」（canonical sessions 的 storage["templateId"] 按日 code 取最近 date，并入现有 reload() 的后台读；从未练过的日不显示该列——不编数据）。
2. 摘要区下补一行累计事实：「已练 5 周 · 14 天」（cleanView.sessions 去重天数 + 首场日期派生；单位=天，裁定 3）。
3. 动作库入口行（K2③ 在此 commit 前已可用，本 commit 只确认位置与 footer 关系）。

## 共同红线（违反即停）

- 引擎/裁决/持久化零改动；所有数据 = 已有投影/快照的只读消费（禁主线程重跑引擎）
- 零新增教学小字/鼓励语/营销语；文案观察式（copy baseline §3.4/3.5，中西混排空格，zh 无句号）
- 不堆卡片（今日页 0-ForgedCard 预算不变；新增内容全部行式清单 + hairline）
- ember 纪律见裁定 5；「密而干净」§13
- 口径：裁定 3（天/ISO 周/prefix(10)/整数吨位）——**任何与分段条同屏的数字必须能对上账**
- 每 commit 门禁 `.claude/quality-gate.cmd` 真实 exit 0
- 新建文件必须 pbxproj 手动登记并在回执写明；能塞已有文件优先

## 验证与自验证据（存 scratchpad `…/2eac2909-…/scratchpad/fullness/`）

- 模拟器 5346FC17（与 Larder 共用，截图前确认前台 Rede）；install 前先真 build（showBuildSettings 不编译）；种子动态 get_app_container + 真实动作 id
- 实拍清单（每张标注种子场景）：
  1. 训练 tab 待机·训练日（预览清单 + 上次行 + 开始按钮）
  2. 训练 tab 待机·休息日（裁决句 + 上次行 + 下一场行）
  3. 训练 tab 待机·零历史新用户（不编数据的克制态）
  4. 动作库浏览器（分组清单全量滚动一屏 + 点开一个 93 条内容动作的详情 sheet）
  5. 计划页全景（上次列 + 累计行 + 动作库入口）
  6. 休息日今日页（上一场摘要 + 下一场行）
  7. 练完态今日页（总结卡 + 下一场 + 本周合计——合计与分段条对账）
  8. 训练中点动作名开详情
  9. XXL 大字号：训练 tab 待机 + 计划页
- 每屏与分段条同屏的数字自查对账（裁定 3）

## 实施回执（agent 2026-07-16 填写）

- [x] **4 个 commit**（分支 `codex/2026-07-16-fullness-k1-k5`，基线 4f47fdd = #699）：
  - `5514879` K1 训练 tab 待机仪表：训练日 = headline + 「开始训练」直启（startSessionLoadingIfNeeded，与 -autoStartSession 同源）+ 「今天这场」处方预览（LoadDisplay 吸附同今日页）+ 「上次」事实行（ProgressSnapshot.HistoryEntry.first）；休息日 = 裁决句 + 上次行 + 下一场行；零历史不渲染上次行；新增 SessionStore.loadCompletedFacts(sessionId:)；L10n standbyLastLine/nextSessionLabel + 测试
  - `89628bb` K2 动作库：共享 ExerciseDetailSheet 抽取（headerAccessory/alternativesSection 双注入槽，今日页行为逐字节保留）+ ExerciseLibraryView（10 契约组分组行式清单，LazyVStack 全量）+ 计划页入口行 + K2c 训练中动作名点开详情；L10n exerciseLibraryTitle/Entry + 测试
  - `14968ef` K3 休息日今日页：TodayCompletedDigestBuilder 放宽 today-only（带 dateISO、分享快照日期=场次真实日期；锁测试改写）；区头「今天这场/上一场 · 日期」分流；「下一场」ember 行（onGoPlan 跳计划页）；loadTodayCompletedFacts 并入 by-sessionId 版（删>加）
  - 第 4 个 = 本回执所在 commit（HEAD；amend 含实拍修复与钩子）K4+K5：练完态「本周练 N 天 · 合计 X」行（天=分段条同源 weekStatuses，吨位=snapshot.weeklyVolume 当前 ISO 周桶）；计划页训练日「上次 · 日期」列 + 「已练 N 周 · M 天」累计行 + 库入口位置确认；SessionStore loadDayLastTrainedDates/loadTrainingTenure；L10n weekTotalLine（复用 weekStripCount 合流）/planDayLastTrained/planTenureLine + 测试；另含实拍抓获的 restStandby 左对齐修复 + 截图钩子 -autoOpenLibrary/-autoOpenLibraryDetail
- [x] **新建文件与 pbxproj 登记**：`ios/Rede/ExerciseDetailSheet.swift` + `ios/Rede/ExerciseLibraryView.swift`，按 MuscleHeatmapView 先例手动登记四处（PBXBuildFile CAED…0002/CAEB…0002、PBXFileReference CAED…0001/CAEB…0001、PBXGroup children、Sources build phase），登记于 commit `89628bb`
- [x] **门禁**：`.claude/quality-gate.cmd` 每 commit 真实运行（9 包 swift test + xcodebuild），5 次全部 exit 0（K1 / K2 / K3 / K4+K5 / amend 终验）
- [x] **实拍**（`…/2eac2909-…/scratchpad/fullness/`，模拟器 5346FC17 iPhone 17 Pro，均确认前台 Rede，-locale zh）：
  1. `01-train-standby-trainday.png` — 待机·训练日（预览 7 动作 + 上次行 + 开始按钮）
  2. `02-train-standby-restday.png` — 待机·休息日（连练 3 天裁决句 + 上次 + 下一场）
  3. `03-train-standby-zerohistory.png` — 待机·零历史（首练目标预览、无上次行）
  4. `04a-library-groups.png` / `04b-library-detail.png` — 动作库分组清单（165 个动作）+ 平板卧推详情（93 条内容动作）
  5. `05-plan-panorama.png` — 计划页全景（上次列 7月10/13/15日 + 已练 5 周 · 14 天 + 库入口）
  6. `06-today-restday.png` — 休息日今日页（上一场 · 7月15日 摘要 + 下一场 ember 行）
  7. `07-today-completed.png` — 练完态（总结卡 3,450 + 下一场 + 本周练 3 天 · 合计 10,350 kg——与分段条 3 格、种子预期 3×3,450 全对账）
  8. `08-train-detail-insession.png` — 训练中点动作名开详情（腿举技术要点）
  9. `09a-xxl-train-standby.png` / `09b-xxl-plan.png` — XXL 大字号（无挤压截断）
- [x] **偏离决策**：
  1. 库分组「10 契约组」与「165 全量」在前臂类 2 个动作上冲突（MuscleGroupMapping 如实排除 forearm）——按原始肌群码「前臂」尾部单列，不硬塞不丢弃（全量优先）
  2. K4 本周合计吨位用 snapshot.weeklyVolume（非交接件字面的 cleanView 原始聚合）：同屏「总量」数字来自 snapshot（loadFactor/可疑组口径），cleanView 裸聚合在两口径分叉时会与总结卡对不上账——对账红线优先；天数仍 = cleanView 派生的分段条同源 weekStatuses
  3. K3「下一场」行在整个无处方分支渲染（含练完态）——K4① 与 K3② 同组件同数据源同分支，拆开渲染是人为分叉
  4. trainRestDayNote 串保留未删（新休息待机改用裁决句后零消费者，但其在 TrainEngineCopyTests 禁词样本内，删除属测试面变更，留主会话拍板）
  5. 实拍新增两枚截图钩子 -autoOpenLibrary / -autoOpenLibraryDetail（simctl 无法点击 sheet 入口；同 -autoOpenPlanEditor 先例），并入 commit 4 amend
