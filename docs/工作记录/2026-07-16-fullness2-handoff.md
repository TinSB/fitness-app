# 去空虚化第二批交接件：K6-K8（2026-07-16）

> owner 拍板「第二批候选也同步进入，专业 prompt 执行，企业级规格」。承接 #700 第一批
> （四 lens 诊断产物）。三段式：本交接件 = 任务 prompt；串行实施 agent；主会话验收
> （门禁 + 三 lens 审查 + 实拍 + 规格写回 + PR）。

## Agent Contract

- **Role**：实施工程师（iOS/SwiftUI + ActivityKit + L10n）
- **Scope**：K7 数据导出兑现 / K8 周一「上周收官」行 / K6 休息计时 Live Activity；引擎/裁决零改动；持久化只有 K7 的**只读导出**（零写入）
- **Inputs**：本文件 + 最新 main（≥ #700 = 3727c0f）
- **Outputs**：分支 `codex/2026-07-16-fullness2-k6-k8`，三个 commit 按 **K7 → K8 → K6** 从简到繁；回执补全本文件底部
- **Budget**：一轮；同一问题修 3 次不过即停回报
- **Stop condition**：3 commit 全过门禁 + 自验证据齐 → 停交主会话；红线冲突 → 停
- **Handoff target**：主会话

## 设计裁定（主会话已拍板）

1. **K6 职责分离**：Live Activity 是**视觉层**（锁屏/灵动岛看倒计时），到点提醒仍由既有 G1 休息通知负责——Live Activity 不发声不通知，两者并存不重复。
2. **K6 不建 app 内开关**：iOS 系统设置已有 per-app Live Activities 开关（YAGNI）；`NSSupportsLiveActivities` 进 app Info.plist（实体文件，非生成）。
3. **K7 导出 = canonical 原样**：用户的全部数据一个 JSON（诚实——不做挑选性「导出格式」），文件名 `rede-export-yyyy-MM-dd.json`，系统 share sheet；零网络零写入；读失败如实 alert 不假成功。
4. **K8 只在周一、单行、零交互**：本地日历周一全天显示一行中性判断句，不做收起状态持久化（一行不构成打扰——YAGNI）；上周零训练不显示（不恐吓，回归语境归 verdict）；零 ember（回顾不是下一步）。
5. **口径纪律沿第一批裁定 3**：单位=天、ISO 周、prefix(10) 归一、formatVolumeKg 整数吨位；K8 的数字与分段条/进展页周量图同账。

## K7 · 数据导出兑现（commit 1，S）

**背景**：FR-SE6（PRD §5）立项已久未兑现——「可导出带走」是产品原则承诺。先 grep 设置页现状（可能有占位行或什么都没有），对齐 PRD FR-SE6 验收原文。

**改动**：
1. 设置页「数据」区（HealthKit 行附近）加「导出训练数据」行 → 读 canonical `app-data.json`（`TodayModel.canonicalFileURL()` 同源、只读不经写闸）→ 临时目录落 `rede-export-yyyy-MM-dd.json` → 系统 share sheet（ShareLink 或 UIActivityViewController，取项目 iOS 17 下最顺的）。
2. 读失败/文件缺失：如实 alert（「暂时读不出数据」风格，沿 dataUnreadable 文案家族），绝不产出空文件假成功。
3. 导出动作本身零写入 canonical；临时文件用系统 tmp（分享完系统回收）。
4. L10n：行标题/失败 alert zh/en + 测试；PRD FR-SE6 状态改 ✅ 的写回留主会话。

## K8 · 周一「上周收官」行（commit 2，M）

**背景**：诊断 PRD-4——周初打开时刻没有叙事；付费深度版留 FR-SUB1，本条只做 free 单行雏形。

**改动**：
1. 今日页 `contextLine` 之下、判断行之上，**仅当今天是本地日历周一**时插一行（caption 级、中性色、hairline 不加）：
   - 有前周对比：「上周练 3 天 · 合计 12,400 kg · 较前一周 +8%」
   - 前周（上上周）无数据：「上周练 3 天 · 合计 12,400 kg」（只报事实不硬造对比）
   - 上周零训练：整行不显示
2. 数据 = `snapshot.weeklyVolume` 完整周桶（上周 vs 上上周——FR-PR3 周对比同口径；天数从 cleanView 上周日期去重，单位=天）。与今日页现有加载链同批取出，禁新增独立 IO 链路。
3. a11y 单行自读；XXL 不挤压；周二起自动消失（无残留状态）。
4. **截图钩子** `-forceWeekReview`（沿 -expandTodayReason 先例）：非周一也渲染该行供实拍/审计（真实用户无感）。
5. L10n：zh/en + 单复数 + 正负号（较前一周 −12% 用 −）+ 测试；文案观察式零评价（不写「不错/加油」）。

## K6 · 休息计时 Live Activity（commit 3，M，本批唯一新系统表面）

**现状勘察**：休息倒计时单一真相 = `SessionStore.restCountdown`（RedeTrainingDecision.RestCountdown，墙钟锚点）；接线点恰两处——`restCountdown.begin(seconds:)`（SessionStore.swift ~1049、~1106 附近）与 `restCountdown.clear()`；并行有 `scheduleRestNotification`（裁定 1：通知照旧）。RedeWidgetShared 包 = app/extension 共享层；widget extension target = RedeWidget。

**改动**：
1. **ActivityAttributes** 放 `RedeWidgetShared` 新文件（如 `RestActivityAttributes.swift`）：静态 = 动作名 + 下一组目标串（「60 kg × 5」，app 侧用既有 LoadDisplay/L10n 格式化后传入，extension 不算数）；动态 ContentState = `restEndsAt: Date`。
2. **Live Activity UI** 放 RedeWidget target 新文件（如 `RestLiveActivity.swift`），挂进 `RedeWidgetBundle`：
   - 锁屏面：动作名 + 目标 + `Text(timerInterval:)` 原生倒计时（零推送零轮询自更新）
   - 灵动岛：compact = 倒计时；expanded = 动作 + 目标 + 倒计时；minimal = 计时图标
   - 视觉：锻铁暗底 + ember 只标倒计时数字（品牌一致）；**零营销文案零 wordmark**（纯数据）
3. **App 侧管理器**（app target，可塞 SessionStore 或独立小文件）：`begin` 处 start/update（已有活动则 update 不重复 start）、`clear`/组完成/训练结束/App 杀前处 end；`ActivityAuthorizationInfo().areActivitiesEnabled` 守门；所有 ActivityKit 调用 iOS 17 直接可用。防呆：end 要覆盖「训练异常中断」路径（endSession/discard 全部端点 grep 齐）。
4. **工程配置**：app Info.plist 加 `NSSupportsLiveActivities = YES`（实体 plist 直接编辑）；新文件 pbxproj 登记——**注意 RedeWidget 的文件登记进 widget target 的 Sources phase，不是 app target**（与 MuscleHeatmapView 先例不同处，回执写明）；RedeWidgetShared 的文件是 SPM 包内免登记。
5. 红线：extension 侧零业务计算（只渲染传入值）；不碰 App Group 快照管线既有语义。

## 共同红线（违反即停）

- 引擎/裁决零改动；K7 零写入、K6 只在既有接线点挂钩（不改 RestCountdown 本体）
- 文案观察式零鼓励语零句号（zh）、中西混排空格、en 单复数；新串全部 zh/en + 测试
- ember 纪律：K8 行零 ember；K6 Live Activity 内 ember 只标倒计时（下一步语义成立）
- 每 commit 门禁 `.claude/quality-gate.cmd` 真实 exit 0；先真 build 再 install
- 口径裁定 5；新建文件 pbxproj 登记情况回执写明

## 验证与自验证据（存 scratchpad `…/2eac2909-…/scratchpad/fullness2/`）

- 模拟器 5346FC17（与 Larder 共用，确认前台）；种子基建沿前批
- 实拍/证据清单：
  1. K7：设置页导出行 + share sheet 实拍；导出文件内容与 canonical `diff` 一致的命令输出
  2. K8：`-forceWeekReview` 实拍（有对比/无对比两种种子）+ 上周零训练不渲染的证据（截图或探针）+ XXL
  3. K6：灵动岛 compact 倒计时实拍（iPhone 17 Pro 模拟器有灵动岛）+ expanded（长按不可自动化则如实报备）+ start/end 探针日志（休息开始/记组结束/训练结束三个端点各一条）；锁屏面模拟器不可达则标注真机项
- K8 数字与进展页周量图对账自查

## 实施回执（agent 完成后填写，2026-07-16）

- [x] **3 个 commit hash + 改动面摘要**
  1. `e3260e2` K7 数据导出：SettingsSheet（数据区 = 导出行 + 事实陈述，原背板「数据」
     折叠行上移合并避免双标题；ExportFile/ExportActivityView 载体；`-autoExportData`
     与 `-settingsScrollTo` 钩子）+ RedeStrings（settingsExportAction/FailedTitle/
     FailedBody/FailedConfirm；settingsExportNote 去「后续版本」）+ 测试
  2. `595b15e` K8 周一收官行：TodayTabView（WeekReview 状态 + computeWeekReview +
     渲染行 + `-forceWeekReview` 钩子；训练分支挂主 .task、休息/练完分支挂
     loadCompletedDigest 同批 snapshot）+ TodayEngineCopy.weekReviewLine + 测试
  3. 本 commit（K6）：RestActivityAttributes（RedeWidgetShared）/ RestLiveActivity
     （RedeWidget）/ RestLiveActivityController + SessionStore 接线 / Info.plist
     `NSSupportsLiveActivities` / pbxproj 双 target 登记 / 本回执
- [x] **K6 新文件登记明细**
  - `ios/packages/RedeWidgetShared/Sources/RedeWidgetShared/RestActivityAttributes.swift`
    —— SPM 包内免 pbxproj 登记（`#if os(iOS)`，host swift test 不编译）
  - `ios/RedeWidget/RestLiveActivity.swift` —— pbxproj 登记进 **RedeWidgetExtension
    target 的 Sources phase**（`EE…D5`，PBXBuildFile `EE…AA` / FileRef `EE…A9`）+
    RedeWidget group（`EE…B4`）；**与 MuscleHeatmapView 先例不同：不进 app target**
  - `ios/Rede/RestLiveActivityController.swift` —— app target Sources phase（`AA…D1`，
    PBXBuildFile `CARL…02` / FileRef `CARL…01`）+ Rede group
  - 挂 RedeWidgetBundle（body 增 `RestLiveActivity()`）
- [x] **门禁 exit codes**：K7 = 0，K8 = 0，K6 = 0（`.claude/quality-gate.cmd` 每 commit
  前真实跑通：9 包 swift test + forged-card 预算 + xcodebuild）
- [x] **证据路径清单**（`…/2eac2909-…/scratchpad/fullness2/`）
  - K7：`k7-export-row.png`（设置页导出行）、`k7-share-sheet.png`（share sheet，
    rede-export-2026-07-16 · JSON · 21KB）、`k7-diff-output.txt`（导出 vs canonical
    diff exit 0 逐字节一致）
  - K8：`k8-with-delta.png`（3 days · 9,923 kg · +5%）、`k8-no-delta.png`（无上上周
    只报事实）、`k8-zero-lastweek-hidden.png`（上周零训练 + -forceWeekReview 仍不渲染）、
    `k8-xxl.png`（XXL 两行优雅换行）、`k8-progress-crosscheck.png` +
    `k8-crosscheck-calc.txt`（独立重算 9922/+5% 与屏显同源对账，底层 9922.5）
  - K6：`k6-island-compact.png`（灵动岛 compact：timer 图标 + ember 倒计时 1:52）、
    `k6-lockscreen.png`（锁屏面：Leg press / 70 kg × 10 + ember 0:37 活跳）、
    `k6-probe-log.txt`（rest-begin ×21 / rest-finished ×20 / session-summary +
    session-end / draft-discard / launch-cleanup ×3 / session-start）
  - 模拟器数据已还原实施前状态（app-data-backup.json / draft-backup.json 回写）
- [x] **偏离决策**
  1. K7 交接件说「数据区（HealthKit 行附近）」——实施为 Apple 健康区之下新增独立
     「数据」Overline 区，并把背板原「数据」折叠行（事实陈述）上移合并，避免同页
     两个「数据」标题（少即是多；隐私/关于留背板不动）
  2. 新增 `-settingsScrollTo <锚点>` 截图钩子（沿 -progressScrollTo 先例）——导出行在
     设置页折叠线以下，simctl 无法滚动，交接件未列此钩子
  3. K6 暂停语义：Live Activity 原生 Text(timerInterval:) 无冻结态——暂停时 end、
     继续时按新锚点重挂（不显示还在走的假倒计时；交接件未细化暂停，按诚实原则处理）
  4. 灵动岛 expanded 长按不可自动化（交接件已预许可）：**如实报备未实拍**，UI 代码
     已含 expanded 三区；锁屏面模拟器可达已实拍。锁屏截图含系统首次「Allow Live
     Activities from Rede?」弹窗（模拟器点击不可自动化，倒计时活跳可见）→ 真机项：
     长按 expanded + Allow 后纯净锁屏面，建议下次 TestFlight 顺手验
