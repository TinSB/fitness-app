# Rede iOS — 系统逻辑全景

> **活文档 · 系统逻辑主文档**。本文定义 Rede 干净重写的产品、系统逻辑和工程合同。干净 iOS 实现(`ios/Rede` + 10 个干净包)已是活跃实现并 shipping 到 M6，订阅基础设施以 fail-closed 形态在开发版中存在，首个 post-1.8 Paid Coach 能力“每周教练复盘”与下一公开版本的更新感知均已完成本地实现和 Simulator 验收。已退役的旧 IronPath/PWA 代码仅作参考。架构边界、source-of-truth、平台权限和禁用系统以 `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md` 为最高契约。

## 0. 干净重写基线

Rede 的目标实现是 native iOS SwiftUI app。旧 Web/PWA、Node/Vite、浏览器测试、旧 Supabase/Vercel 实现候选、TypeScript 源和 `RedeCloudSync` stub 已删除,不得恢复成仓库 runtime。

iOS 原生账号、云同步、CRDT/watchOS 的已拍板方向保留在 `docs/REDE_REBUILD_00_IRONRULES_AND_CLOUD.md` 与 `docs/CLOUD_DECISIONS_ARCHIVE.md`。这些是未来原生架构输入,不是第一版干净实现 runtime。

干净重写只以这些材料为真源:

- `docs/REDE_MASTER_TECHNICAL_ARCHITECTURE.md`
- `docs/REDE_iOS_SYSTEM_LOGIC.md`
- `docs/DOCS_MANIFEST.md`
- `docs/REDE_PRODUCT_COPY_BASELINE.md`
- `docs/REDE_PRODUCT_DESIGN_LANGUAGE.md`
- `COMMERCIALIZATION_ROADMAP.md`

legacy/reference inventory 处置状态(2026-06-09 M1-0 起):

- **旧包退役 + 干净重建**:9 个旧 IronPath/PWA 时代 Swift 包(`RedeDomain`、`RedeDataHealth`、`RedePersistence`、`RedeHealthKit`、`RedeTrainingDecision`、`RedeBackup`、`RedeUIKit`、`RedeLocalSnapshot`、`RedeNotifications`)于 M1-0 整体移出编译面,旧实现参考走 git 历史(tag `legacy-parity-final`),其 PWA parity golden 测试随旧包退役。**随后 5 个名字以干净包重建并现役**(M1-1 起,带全新测试):`RedeDomain`、`RedeDataHealth`、`RedePersistence`、`RedeTrainingDecision`、`RedeLocalSnapshot`——它们是 §6/§8 描述的"已实现"引擎的承载包,当前在 `ios/packages/` 中、在 CI 测试面内(连同一直在树的 `RedeWidgetShared`、`RedeL10n`,共 7 个;FR-NT1/2 批准后新建 `RedeNotifications`(本地通知 policy + #if os(iOS) adapter);FR-PR8 范围 A 批准后新建 `RedeHealthKit`(只读体重 policy seam + #if os(iOS) HKBodyWeightReader),截至该切片共 **9 个**在 CI 测试面内)。**未重建、当前不存在**的 2 个:`RedeBackup`、`RedeUIKit`(目标包名,待未来 amend 后才创建)。
- **仍在树内的 legacy/参考材料**:`ios/packages/RedeL10n` 内的 legacy Terms/Formatters parity 文件(与 M0-3 新代码并存,待后续 slice 清退)、`ios/RedeWidget`(旧 widget,仅参考)、`ios/ParityFixtures`(冻结参考输入;RedeL10n parity 测试仍在消费,并保留为未来老数据迁移的验收素材——是否做迁移为待定产品决策,新模型按开门设计:open-bag + 沿用 legacy 字段词汇表)。`ios/Rede` 自 M0-1 起已是 clean shell,不再属于 legacy。
- **2026-07-18 新增现役包**：`RedeEntitlements` 已按 §8.3 的批准切片创建，现共 **10 个**包进入 CI 测试面。该包只承载纯权益 policy、StoreKit 2 adapter、生命周期 model 与 StoreKit UI wrapper；生产商品配置仍为空，购买入口 fail-closed。
- **通用规则不变**:legacy 材料可以帮助理解曾经的命名、测试和局部算法,但不得作为“已完成实现”的证明,也不得被整包搬运。任何复用都必须进入明确 rewrite slice,先审查输入输出、source-of-truth 和测试合同。

## 1. 铁律

1. **核心纯净**：SwiftUI app 层只做渲染与 IO seam 接线；业务逻辑在 Swift packages。
2. **数据必净化**：raw AppData 永不进训练引擎；目标读路径必须先经 DataHealth clean view / clean input。
3. **唯一写闸**：canonical AppData 改动必须经明确的 gated writer,backup → atomic save → honest failure。`CanonicalSessionWriter` 可作参考命名,不是必须逐行继承的旧实现。
4. **单一权威本地源**：目标权威源是本地 JSON AppData；LocalSnapshot、Widget、HealthKit export、UI view model 都不是真相。
5. **Swift-only 干净实现**：干净重写不得引入 Web runtime、Node runtime、cloud sync、account auth、通用 remote API、browser storage 或 browser tests。唯一现役网络例外是 Master v3.5 明确限定的 Apple 公共 App Store 版本查询；它不是业务 API，也不得扩成 Rede remote runtime。
6. **未来平台需另批**：watchOS、WatchConnectivity、CRDT、remote sync、account/auth、cloud backup 必须基于已拍板决策另走 Master-approved implementation slice。订阅的 StoreKit 2 边界已按 §8.3 落地为 production-disabled 基础 runtime；RevenueCat、服务端权益与远程分析仍未获授权。

## 2. 商业化信息架构

底部 tab 目标只保留高频、能形成训练闭环的页面：

| Tab | 页面使命 | 新实现规则 |
|---|---|---|
| 今日 | 告诉用户今天该不该练、练什么、从哪里开始 | 不做 dashboard；只回答今日决策和入口。 |
| 训练 | 只承载专注训练 | 没有完整训练页、训练浏览页或训练 dashboard。**待机态（未开训，2026-07-16 K1）= 「训练准备」语义**：开始训练直启（与今日页同链 loadToday→startSession）+ 今日处方只读预览 + 上次一场事实行——零图表零分析零浏览入口，不构成 dashboard；§7 禁入清单不变（大型动作浏览仍禁入，动作库入口在计划页）。 |
| 进展 | 证明训练有没有效果 | 合并历史、PR/e1RM、训练量、日历和数据可信度。 |
| 计划 | 管未来几周怎么练 | 展示周期、周计划、调整建议和可回滚计划决策。 |

Profile / Settings 是低频入口，不占底部 tab。它拥有个人资料、单位、筛查、HealthKit 权限、数据导出/备份、版本与更新感知和订阅表面。账号或同步控制不进入第一版干净实现,未来实现必须走原生云/账号决策链路。

## 3. 新实现目标与旧代码边界

| 模块 | 干净重写目标 |
|---|---|
| SwiftUI app | 新建薄 app 层,只渲染 state、接 IO seam,不承载业务判断。旧 `ios/Rede` 仅作参考。 |
| Widget | 第一版可选;若实现,只能是只读 readiness snapshot。旧 widget 不能证明目标已完成。 |
| Packages | 按目标 package boundary 重建纯逻辑。旧 packages 的符号名和测试可参考,不得默认继承旧结构。 |
| AppData | `RedeDomain.AppData` 语义保持本地 JSON canonical source of truth。具体类型可重写,但必须保留 open-bag preserving 和 schema honesty。 |
| Write path | 统一 gated writer,具备验证、backup、atomic save、honest failure。旧 `CanonicalSessionWriter` 可作合同参考。 |
| Training | 专注训练是训练中唯一一等页面;不恢复完整训练 dashboard。 |
| Today | 读 canonical AppData,经 DataHealth 和 TrainingDecision 渲染今日状态。 |
| Progress / Settings / Plan | 直接实现目标职责,不继承旧 History/Profile transitional IA。 |
| HealthKit | 体重导入、训练历史导入、native workout export,均在 `RedeHealthKit` 边界内。 |
| Notifications | 本地 rest timer 和 weekly training reminder;不做 remote push。 |
| Test fixtures | 建立干净 rewrite fixtures/goldens。旧 `ios/ParityFixtures` 可作参考输入,不得锁死新实现。 |

## 4. 目标 Package 分工

| Package | 责任 |
|---|---|
| `RedeDomain` | AppData / domain model / open-bag preserving values，以及不依赖平台的版本比较、检查节流与提示策略。 |
| `RedeDataHealth` | clean view、repair、runtime guards。 |
| `RedeTrainingDecision` | readiness、scheduler、progression、coach actions、insights。 |
| `RedePersistence` | local JSON store 和 canonical write orchestration。 |
| `RedeLocalSnapshot` | Focus/session projection 派生快照；不得触碰 canonical AppData。 |
| `RedeHealthKit` | 已批准 HealthKit adapters（FR-PR8 范围 A：只读体重 `BodyWeightReading` seam + #if os(iOS) `HKBodyWeightReader`；纯展示，不写 canonical、不进引擎）。 |
| `RedeNotifications` | 本地通知 policy + adapter。 |
| `RedeWidgetShared` | widget snapshot model + read-only App Group handoff。 |
| `RedeL10n` | 术语与格式化。 |
| `RedeBackup` | 未来可选的自动备份/恢复编排包；1.8 已有 canonical JSON 直接导出不依赖此包，也不授权第二份备份 store。 |
| `RedeUIKit` | 未来可选共享 UI 包;不因旧 placeholder 授权共享 UI framework 迁移。 |
| `RedeEntitlements` | **已创建（2026-07-18）**；纯权益 policy + 唯一 StoreKit 2 adapter + 生命周期 model + StoreKit UI wrapper。生产购买配置为空且 fail-closed；不得承载训练逻辑、canonical 数据或第三方订阅 SDK。 |

第一版干净实现没有 active cloud/sync package。任何同步、云、账号或远程服务实现都必须从原生决策文档出发,经 Master-approved implementation slice 落地。

## 5. 写入合同

目标 canonical AppData 写入只允许通过明确的 gated writer。旧 `CanonicalSessionWriter` 是参考合同名,不是旧代码继承要求。

已批准的用户/外部事实写入类别：

- 完成训练 append。
- HealthKit body weight sample append。
- HealthKit imported workout sample append 到 display-only derived storage。
- Profile scalar edit。
- Unit setting edit。
- Screening list edit。
- Program config scalar edit。
- History set correction。
- Saved-session exercise replacement（换动作前瞻覆盖，FR-T5）。
- One-time exercise replacement（FR-TR6「只换这次」，2026-06-26）。
- Coach-action dismiss intent（暂不处理，喂降频计数，FR-T5）。
- Coach-action volume-boost intent（补量承认，频率维度；不加训练不改处方，FR-T5）。
- Notification preference edit（FR-NT1/2 通知开关；open-bag 加性、缺=关、无 schema bump）。

> **FR-TR6「只换这次」临时换动作（2026-06-26）。** 点替代项后二选一：「以后都换」= 永久（写 `exerciseSubstitutions`，FR-T5 原路径）；「只换这次」= 临时（写 `oneTimeSubstitutions[原]={换成,dateISO}`，**只今天有效、次日自动失效**）。两表均 open-bag 加性、**无 schema bump**。**引擎零改动**是关键：在 app 层（`TodayModel`）把「永久 + 今天的临时（按 todayISO 过滤）」**合并成一张 substitutions 表再喂 `plan()`（临时优先）**，引擎不区分二者 → golden 零回归；临时项只今天混入、绝不落进永久表。写闸 `applyOneTimeSubstitution` 顺手清掉非今天的陈旧项（容器永远只留当天，自动 GC）。撤销同 FR-T5（单步即时反向写 `removeOneTimeSubstitution`）。诚实：换后若 `plan()` 因替代非本槽合法候选优雅回退（处方没变），honest-check 清掉死覆盖、不假报成功（同 FR-T5）。UI：处方行微标「今天换」（vs 永久「已换」）、detail sheet 撤销入口文案标明次日自动恢复。

> 本地通知（FR-NT1 休息结束 + FR-NT2 每周）由 `RedeNotifications` 纯策略 + `#if os(iOS)` UNUserNotificationCenter 适配器调度：**派生临时、绝不落 canonical**（只把开关偏好当只读输入）；无 remote push（Master §9）；策略产 typed code、文案归 RedeL10n（§7.3 中性、禁断签/羞辱/施压）。FR-NT1 在休息生命周期 schedule/cancel（rest-begin 排、rest-finished/收尾/放弃取消）；FR-NT2 固定 2 条（周一上午「新周」/周四傍晚「保持节奏」，UNCalendarTrigger repeats，幂等重注册，可关）。授权价值先行（首次开开关时请求），被拒不影响核心功能。阶梯外的频率/时间为 MVP 起步值待校准；按 daysPerWeek 缩放 + 用户自选时间后置。
>
> **送达正确性（2026-06-20 真机 bug 修复，关键契约）**：① **前台必须显式呈现**——App 设 `UNUserNotificationCenter` delegate（启动即接管）+ `willPresent` 返回 banner/sound，否则 iOS 在前台静默丢弃本地通知（"开了权限却没收到"的根因）。② **取消只清待发（pending），不动已送达（delivered）**——否则锁屏期间已弹出、解锁回 App 时会把已送达那条也抹掉。③ **休息自然到点（倒计时归零）不取消通知**——它正该此刻送达（`apply(.restFinished, restCompletedNaturally:)` 区分：自然到点不取消 / 手动「下一组」提前结束或收尾才取消）；后台锁屏时 `runRestTimer` 不运行、`finishRest` 不触发，故通知不被取消、由系统按 time-interval 触发器送达。④ **加时（+30）/ 暂停-继续必须按新剩余重排**（暂停撤回、继续/加时重排），否则 time-interval 触发器仍按原时点弹、早于实际结束。⑤ scheduleRest 排程前清同 id 已送达历史（离触发尚远、不误删新条），避免通知中心堆叠。⑥ **休息 + 每周提醒都用 `.timeSensitive` 抢占级别**（需 `com.apple.developer.usernotifications.time-sensitive` entitlement）——默认 `.active` 在用户忙于别的 App / 开专注模式时会被降级成"静默进通知中心、不弹横幅"；改时效性后在别的 App 前台 / 专注模式时也强弹（owner 2026-06-20 拍板休息+每周都要弹）。文案仍中性（§7.3 管语气、本条管送达）；如每周觉太扰可单独降回 `.active`。**这些是 iOS 运行时行为，host SPM 单测覆盖不到——靠真机 TestFlight 验收。**

> 教练动作的采纳、暂不处理及撤销都经同一 gated writer，撤销 = 单步即时反向写（不另起 undo 栈）。**UI 撤销入口只接了换动作 / 补量两类**（`removeExerciseSubstitution` / `removeVolumeBoost`）；「暂不处理」是单向降频信号——写闸层有反向口（`removeCoachActionDismissal`）但不暴露 UI 撤销，卡按降频策略自然再现。引擎契约见 §6.4a。

写入必须满足：

- 不 fake success。
- 不覆盖 unreadable user data。
- 写前 DataHealth gate。
- 写前 backup。
- atomic save。
- 不把 engine output 写回真相。
- 不新增第二条 store。

## 6. Engine 输入

训练决策、计划调整、进展分析必须从 clean data 或 typed clean input 进入。

禁止：

- raw AppData 直接进 engine。
- UI 派生状态写回 AppData。
- HealthKit/import/widget/local snapshot 直接影响训练建议。
- placeholder package 偷偷实现业务逻辑。

第一版 HealthKit 数据只用于展示、Progress/data quality 和本地导入/导出边界。若未来要影响 Today/Scheduler 的建议,必须新增 Master-approved engine-input slice。

### 6.0 今日裁决引擎（TodayVerdict · M2-1 已实现）

**入口合同**：引擎唯一入口是 `CleanTrainingDecisionInput`（init 私有,只能经 `make(from: CleanAppDataView, todayISO:)` 铸造——raw AppData 在类型系统上进不了引擎）；「今天」由调用方注入,引擎无 clock、无 IO、输出永不写回 AppData。输入面按 PRD 开放决策 #2 拍板（2026-06-09）：仅已记录训练历史（负荷/间隔/上次表现）+ 计划结构；主观自报（酸痛/疲劳/睡眠）放 FF。

**输出合同**：四态 `TodayCall`（train 练 / light 轻 / rest 休 / deload 减载）+ typed 主理由 `VerdictReason` + 可观察事实 `VerdictSignal`。引擎不产任何用户文案——理由是结构化 code,由 UI 层经 RedeL10n 双语模板渲染成「信号 + 影响 + 决策」句（FR-T3 禁词约束因此结构化成立）。

**瀑布仲裁（先命中先裁决,顺序即合同）**：

| 序 | 条件 | 裁决 | 产品理由 |
|---|---|---|---|
| 1 | 今天已有完成训练 | rest | 不重复消耗 |
| 2 | 零训练历史 | train | 校准期,不伪造 readiness 分数 |
| 3 | 距上次训练 ≥14 天 | light | 回归保底,先轻后重。**回归协议 v1（2026-07-08）**: 14-20 天=轻练 ×0.9 循环不动;**≥21 天=重启**(循环回序列头+×0.85);**≥42 天=深回退**(×0.75)——阈值与 MLE detraining 窗(21 天)/强度失窗(42 天)同源;回归期渐进压制(上次打满也不加档/不减辅助/不加负重,external+assisted+bodyweight-plus 三类;bodyweight/band 次数进阶未压制——无负重伤害小,留观察);收据句分档专属文案(告别通用「降一档」)。 |
| 4 | 21 天窗口训练日 ≥3×周计划频次且最长间隔 ≤2 天 | deload | 结构性超量;**优先级高于规则 5**——连练数周需要的是减载周,不只是歇一天 |
| 5 | 连续 ≥3 天训练 | rest | 短窗口恢复 |
| 6 | **本日历周**（ISO 周一始，周一..今天）训练天数 ≥ 周计划频次 | light | 本周量已到。**周口径迁移（2026-07-15，owner 立项）**：原滚动 7 天窗改日历周——与今日页周分段条/教练补量卡/WeeklyAdherence 全线同口径（一屏一种周口径终态收口）；信号 `.sessionsInLast7Days` 退役 → `.trainedDaysThisWeek`。**有意行为变化**：周日练满 → 下周一重新计 train（原滚动窗会 light 到周中）；周初连续高频保护由规则 4/5 承担，无保护真空 |
| 7 | 昨日（gap≤1）训练 RIR 均值 ≤0.5 | light | 上次练到力竭,降一档 |
| 8 | 兜底 | train | 常规推进 |

周计划频次取值链：`program.daysPerWeek` → `profile.weeklyTrainingDays` → 默认 6（宽松,避免无计划时规则 6 误触发）。无 RIR 数据时规则 7 不触发（不猜）。未来日期/非法格式的 session 不参与 recency 计算。

**阈值地位**：14 天/21 天/连续 3 天/RIR 0.5/默认 6 是 MVP 起步值,非经验校准结果;由 RedeTrainingDecision 的 goldens 锁定——调阈值 = 调产品行为,必须显式改 golden 留痕,待 TestFlight 真实反馈后校准。

**当日/上一场总结（FR-T6，2026-07-05 #652；K3 推广 2026-07-16）。** 整个无处方分支（练完态 + 休息日 + 回归日）渲染总结块：数据从**已落盘**历史派生（`TodayCompletedDigestBuilder`，RedeLocalSnapshot 纯函数，**「最近一场」语义**——K3 放宽原 today-only 门槛）——组数/总量取 snapshot 链（与进展页同口径、可疑组已清洗）、动作数取完成落盘数、训练日码与时长档从 canonical 直读补给（`SessionStore.loadCompletedFacts(sessionId:)` 只读、按快照 sessionId 直查）。区头按 `digest.dateISO`（**prefix(10) 归一**）分流：今天 =「今天这场」、否则「上一场 · 日期」；分享快照日期 = 场次真实日期（旧场分享卡不再冒充今天）。总结块下接「下一场」预告行（PlanDayProjection，ember，跳计划页）；练完态再接「本周练 N 天 · 合计 X」行（天=分段条同源 weekStatuses、吨位=snapshot 周桶——同屏对账口径）。record 缺失/零历史 → nil 退回裁决句（不编数据）；时长缺失不编时长档。视图加载绑 `.task(id: showsRestBranch)`。

### 6.0.1 今日处方引擎（TodayPrescription · M2-2 已实现）

**入口合同**：吃 `CleanTrainingDecisionInput` + M2-1 的 `TodayVerdict`（处方不重复判断练不练）；rest 裁决 → 无处方。纯函数、无 clock/IO、输出永不写回 AppData。

**输出合同**：`TodayPrescription{dayCode, exercises[], dayReasons[]}`；每动作 `{exerciseId, sets, restSeconds, rep 区间, targetReps, targetWeightKg(kg 口径), targetRir(增肌默认 2；力量目标复合主项 1，见 §6.0.1a), previousWeightKg, previousTopReps, nextProjectedWeightKg, change(start/increase/hold/ease), reason}`。全 typed 零文案：dayCode/reason code 是 RedeL10n 模板挂点；**lb 换算归渲染层（FR-SE1），但渲染层不是裸换算——必须把每个可配重量吸附到「器械×当前单位」真实梯子的最近格再显示（见 `REDE_EXERCISE_CONTENT_SYSTEM` §8 LoadGrid 显示吸附契约）；禁止 ×2.2046 直转。**previous→target→change 三元组同时喂 Receipt Change 行、训练页 why 行与 Rail。**里程摘要（wave-12，owner 拍板 B）**：今日页 Receipt Change 行只渲染**头牌动作**（exercises.first）；非头牌动作的**转折性 `reason`**（bandCeilingReached 换带 / bodyweightCeilingReached 加配重 / assistedGraduated 毕业 / bodyweightPlusDegraded 回退）另由今日页**里程摘要**扫全表单列于头牌行下方（配件类如弹力带永远排不到首位，否则其里程提示被吞）；只列转折性 reason、不列普通进阶（高信号），复用同一 `changeLine(for:)` 文案，纯文本不占卡预算。

**生成规则（FR-ON3：不锁死硬编码模板，可重算）**：日计划 = 槽位规则 × catalog（`ExerciseCatalog.minimal` 现已解码整本 `exercises.json` 目录，当前 165 条（catalogVersion wave-18）、随内容 wave 增长；开放决策 #1 已拍板。新增动作均纯加性、Golden 处方/裁决守零行为变化，但**两条防线机制不同**：wave-17 引入的 hip-abduction/hip-adduction/front-raise/upright-row/wrist-curl 是**无模板槽引用的惰性 pattern**（任何 rank 都进不了处方）；wave-18 的 11 个动作**沿用现有 pattern（这些 pattern 有模板槽）**，零行为变化**纯靠高 rank**（1550–1650 > 全部现役 max rank 1540，按 (rank,id) 升序永排末位、不被选中）——故改模板槽前必须核 rank 顺序，不能假设这些动作"天然进不了处方"）按 (rank,id) 升序取第一个未用且匹配（pattern + 可选 kind/equipment）；槽位无法匹配时记 `slotUnfilled` 留痕，不静默。轮转 = **自最近重启点的** session 数对 split 日序列取模（重启点=与前一场日期差 ≥21 天的场,无状态从历史扫描;无重启点=全量场次数,等价旧口径。今天本身停练 ≥21 天时直接出序列头,用户「今天换一天练」仍最优先——回归协议 v1 2026-07-08）。**每周循环模式（2026-07-08 owner 拍板「两个都做,设置里切换」）**: 设置 opt-in「每周重新开始循环」——开启后轮换 index = 本 ISO 周完成场次 % 长度（跨周自动回序列头,忽略 rotationOffset——换天补偿是顺延型概念）;默认关 = 顺延（序列型,现状）。顺延模式下「新周 + 上周未练满 + 指针非序列头」时今日页出透明化副句「上周的 X 顺延到今天　想重新开一轮可以换一天练」（carriedOverFromLastWeek dayReason,决策仍在用户）。**轮换基数单一真源** `rotationBase()`: 今日页/Plan 排期投影/日序编辑器预览/提案预览共用（审查 S2: 投影曾用旧总场次公式与今日页分叉;防再分叉测试锁第一位一致）（见 §6.0.1a）。

**FR-PL6/PL7 用户自定义计划覆盖（引擎 seam，2026-06-23 切片 S2/S3）**：`plan()` / `PlanWeekProjection.weeks()` 新增默认空 `customization: PlanCustomizationInput`（**默认空 ≡ 现状，逐字段等价 → golden 零变化**，同 substitutions 先例）。① **当日动作覆盖**：`customization.dayPlans[dayCode]` 存在时，把用户有序动作清单转成「钉死 exerciseId 的 `userPinned` 槽」（pattern/kind 取 catalog 事实，`preferredId=该动作`）——**动作与顺序由用户定，重量/次数/进阶/裁决仍由引擎算（决策在前不破坏）**；可选 sets/reps/rest 用户覆盖优先、否则该 pattern 默认槽参数。userPinned 槽**优先级最高（高于 sticky/FR-T5 覆盖）**，放不下（已用过/越场景）则如实 `slotUnfilled`、绝不替换。catalog 查不到/弃用/非可处方/越场景的动作优雅丢弃；当日全空→回退默认模板。② **日序覆盖**：`customization.daySequence` 须为默认 `daySequence` 的**排列**（同集合同长度、只重排不造新日）才采用，否则回退默认（`resolvedDaySequence` 守卫）。日序重排 × "按完成场次轮转"会使"下一个训练日"跳变（开放决策#1：可接受，UI 预览明示）。③ 自定义来源：raw `AppData.planCustomization` 经 app/clean 层校验后构造 `PlanCustomizationInput`（Master §8：raw 不直接进引擎）；引擎对输入仍防御消费。

### 6.0.1a 分化模板系统（天数→模式→日序列 · 循证频率映射，2026-06-16 owner 拍板）

> 目标契约：每肌群尽量 **2×/周**（Schoenfeld 频率 meta：容量等值下 2× 优于 1×；RP 容量地标 10-20 组/肌群·周）。`OnboardingPlanInit.template(for:)` 按天数选 `splitType`，`TodayPrescriptionEngine.daySequence(splitType:)` 把 splitType 映成**日序列**（轮转长度=序列长，`dayCode = 序列[(已练场数 + rotationOffset) % 序列长]`）。

> **FR-TR12「今天换一天练」临时训练日覆盖（2026-06-27）。** 今日页可临时把今天的训练日换成本分化的另一天（动机：整组器械满/整个部位还酸/当天没心情练腿——循证：弹性周期化 FDUP，当天自选先做哪个 session 不损增益、提升坚持度）。二选一：① **只换今天**（默认）= 写 date-scoped `oneTimeDayOverride{dayCode,dateISO}`，引擎 `plan()` 今天用它（`dayCodeOverride ?? 轮转`，非法成员回退轮转）；② **以后都按这个顺序** = 打开顺序编辑器永久重排（不在今日页猜意图）。**「明天补回被跳过的日」靠 `rotationOffset`**：临时换天那场**完成时**（`appendCompletedSession` 同一原子写内，若覆盖 dateISO==该场 date）`rotationOffset −1` + 清覆盖，抵消本场对「场次数 % 长度」轮转的推进 → 被跳过的日下一场自动排第一。**关键性质**：offset 只在完成时消费（没练就不动轮转、撤销只清覆盖）；**与回归协议的写闸交互（2026-07-08）**: 重启场（与历史最后场差 ≥21 天)完成时 rotationOffset 只清**写前残值**、同次写内 TR12 刚产生的 −1 保留（重启日换天,被跳过的序列头下一场仍补回——审查 M3 组合场景测试锁定）；**每周循环模式交互（2026-07-08）**: weekly 开启时换天完成**不产生 −1 补偿**（周重开心智下跳过的日子随周翻篇）,换天弹窗与撤销条文案按模式分流——weekly 下不承诺「顺延到下次/明天补回」（审查 S1 诚实红线）;weekly 期间的换天在切回顺延后不追溯补偿（已知取舍留痕）；`count+offset = 非临时换天场次数 ≥ 0`（不越界）；默认 `dayCodeOverride=nil / rotationOffset=0` 逐字节等价现状（golden 零回归）。两字段均 open-bag 加性、无 schema bump。临时换天不改序列/不动每周频率，故**不触发** A/B 频率护栏。

| 天数 | splitType | 日序列 | 每肌群频率 |
|---|---|---|---|
| 2-3 | `full-body` | full-a / full-b / full-c（三均衡变式轮换，每日覆盖全身） | 主要肌群 2-3×、臂/小腿较少 |
| 4 | `upper-lower` | upper / lower | 2× |
| 5 | `ppl-ul` | push-a / pull-a / legs-a / upper / lower（**复用现有槽位**，腿 2×） | 上肢 2×、腿 2× |
| 6 | `push-pull-legs` | push-a / pull-a / legs-a / **push-b / pull-b / legs-b** | 全肌群 2× |

- **A/B 区分（6 天）**：A 日 = 强度/自由重量主项；B 日 = 容量/变式（换器械·角度·握法）。B 日靠槽位 `equipment`/`kind` 约束 + **`preferredId` 点名**选到与 A 不同的动作（推B 补垂直推；拉B 点名宽握下拉 + 俯身支撑划船 + lat 孤立；腿B 哈克蹲 + 点名硬拉 + 保加利亚）；器械受限时优雅软化。
- **点名主项（`Slot.preferredId`，2026-06-16）**：模板可指定具体动作 id（突破「同 pattern 取 rank 最小」限制，如硬拉 vs RDL、宽握 vs 高位下拉）。选材优先级：**sticky（用户上次换的）> preferredId（模板点名）> rank 最小默认**；点名须通过候选过滤（器械白名单/未弃用/可处方），否则优雅回退 rank（器械受限不会卡空）。
- **全身 A/B/C（2-3 天）**：每变式 6-7 槽覆盖 股四/后链/胸/背/肩 全身一遍，三变式靠 pattern 顺序+equipment 换不同主项（A 深蹲+平板+下拉 / B 哈克蹲+上斜+杠铃划船 / C 腿举+哑铃平板+坐姿划船+小腿）。**频率口径（审查 M-1 校正）**：主要肌群（腿/胸/背/肩）每日命中 → 2-3×/周；**小肌群（二头/三头/小腿）以复合间接 + 单变式直接为主（约 1× 直接）**——6-7 槽全身日的合理取舍，非每肌群都 2×。
- **力量/增肌两套（primaryGoal）**：默认增肌（§6.0.1 渐进口径不变）；`primaryGoal=strength` 时 `strengthShaped` 只重塑**显式复合主项**（kind=="compound"）→ 3-6 次 / RIR 1 / 休息 ≥180s（孤立与二级保持增肌区间——「重主项+增肌辅助」结构，循证可接受）。
- **sticky（粘住上次换的动作）当前为 pattern 全局**：同 pattern 跨 A/B 且换入动作满足两天约束时会跨日粘住；新用户无换动作时 A/B 由槽位约束天然区分。dayCode 级精确化需会话存 dayCode 真值（templateId），留作后续。
- 日名（dayCode→双语）：`RedeL10n.trainingDayName`（A 日/upper/lower 复用 legacy parity map；新 push-b/pull-b/legs-b/full-a/b/c 就近映射，不污染 parity-locked `Formatters.templateNameMap`）。

**最小渐进（goldens 锁定）**：双重渐进三分支，RIR 一律取 **min 口径**（最差一组；任何一组打到力竭就不加重——安全优先于抗噪，2026-06-09 审查后显式拍板）——全组打满 repMax 且 min RIR ≥1.0(含 1.0；无 RIR 数据视为有余力) → +2.5kg、次数重置 repMin；上次力竭(min RIR≤0.5) 或最高组未到 repMin → −2.5kg；否则持平冲 repMax。加重无上限（有意为之）。裁决调制在渐进后：light ×0.9；deload ×0.8 且组数 −1(下限 2)。**重量按「器械×用户单位」真实梯子取整**（§8 LoadGrid：公斤自由重量 2.5kg 等距、磅哑铃分段 2.5/5/10lb 梯子等），下限一档；**调制后若取整弹回原重量且原重量 > 一档，强制下调一格**（轻练/减载必须真减，小重量动作不得被取整吃掉）。**重量口径**：哑铃/单边动作 = 单只哑铃重量；杠铃 = 总杠重（含杆）；plate-loaded = 配重片读数；cable = 配重栈读数（美国习惯，引擎内部按手上有效推进）——**渲染层据此口径吸附梯子最近格显示，非裸换算**（§8 显示吸附契约）。

**catalog limitation（§6.1 红线如实声明）**：MVP catalog 缺**肌群贡献权重**——肌群级高置信分析（肌群等级/瓶颈识别）在补齐前不得基于本 catalog 产出；双语展示名归 RedeL10n。**注意事项（原"禁忌提示"）已落地为展示层**（FR-EX2：`safetyNoteZh/En`，按 §7.1 fitness≠medical 措辞——保守训练注意 + 条件句 +「咨询专业人士」，绝不诊断/治疗/防伤承诺；只给有风险动作、低风险诚实不加；经安全合规对抗审查）——它是**展示提示、不是引擎输入**，不参与处方/降级决策（疼痛驱动的保守调整仍走 §6.4 实时信号，与本字段独立）。组形（top/backoff）归 M3-1 后续学习层；restSeconds 已在 M3-1 落地（slot 生成参数）。

### 6.0.2 逐组处方与下一组建议（M3-1 已实现 · §6.3 的确定性最小子集）

**逐组序列**：`SessionSetPlanner.expand(TodayPrescription) → SessionSetPlan`，MVP 组形 = straight sets（每组同重同次同 RIR 目标 + 动作级 restSeconds）；组形学习（ascending/top-backoff/wave、SetExecutionModel）按 §6.3 后置;热身生成已实现（FR-TR10——流内临时引导、不落库，见 §6.3 + `WarmupLadderEngine`，不改本 straight-sets 展开）。确定性展开，固定场景测试锁定。

**下一组建议**：`NextSetEngine.recommend(plan, completed[]) → NextSetRecommendation?`。原则 = 尊重 session 内执行事实：上一组实际重量是下一组基线（用户第一组完成 85 → 第二组建议继续 85；完全按计划执行 → 保持计划形状）。安全瀑布（先命中先裁决）：疼痛上报 → safety flag + −2.5kg；上组 RIR ≤0.5 → −2.5kg；上组次数 < 区间下限 → −2.5kg；否则延续基线。减重下限 2.5kg；无 RIR 数据不猜不触发力竭规则；全部计划组完成 → nil。输出全 typed（reason/safety code），文案归 RedeL10n。

**跳过/替换/收尾模型**：`SetSkipReason`（equipmentBusy/painDiscomfort/fatigue/timeShort/other）、`SessionEndReason`（completedAll/timeUp/fatigue/pain/other）——rawValue 即留痕 code；`ExerciseReplacementEngine.candidates(for:)` = catalog 同替代族按声明顺序排除自身（FR-TR6 地基）。这些是引擎输入事实，M3-3 已经唯一写闸落盘：`CompletedSessionBuilder` 只记录用户事实（实际组/跳过/替换审计/收尾原因，engine 输出不落盘），写前 gate 的真实现为 `RedeDataHealth.CanonicalWriteValidation`（clean 视图不丢 session + 新 session 必须通过净化）。

### 6.0.3 本次训练编排（FR-TR14）

**产品边界。** 自动处方是默认起点，不是训练中的锁。用户临时调整默认只影响当前 session；不改 `PlanCustomization`、不形成长期偏好、不训练推荐系统。训练结束后显式保存到长期计划属于后续独立写闸切片，未实现前不得出现假入口。「本次顺序」是 Train 内的任务型窄编辑器，不等于永久计划编辑或大型动作浏览器。

**双层真相。** `prescription` 保持不可变，保存系统原建议及来源；`TrainFlowState.plan` 是本次会话可变执行队列。最终历史只记录实际完成事实，移动队列本身不生成 replacement、skip 或完成组，也不把系统目标值写入 canonical。所有队列变化必须是 typed `TrainFlowEvent`，经 `SessionStore` 的 reducer 接线进入事件日志并随 draft 重放；UI 禁止直接改 `plan`。普通训练事件在单一串行后台队列 best-effort 保存；S1 移动必须走 durable barrier：先等待此前普通写，再同步确认包含新事件的 draft 已原子落盘，之后 UI 才能宣布成功。durable 写失败须把内存 flow 精确回滚、保留尚未提交的本地快改并如实报错；读取和清除也在同一队列，清除后旧写不得倒灌。恢复仍以 `state.events == events` fail-closed，S1 不改 canonical AppData / `TrainingSession` schema，也不提升 draft 版本。

**S1「后续动作现在练」合同。** 仅当 phase=`activeSet`，且当前动作尚无完成组、跳过组或待提交疼痛标记时，用户可从当前索引之后选择一个唯一已排动作并「现在练」。稳定移动语义：`[A,B,C,D]` 当前 A、选择 C → `[C,A,B,D]`；已完成前缀和其他动作相对顺序不变，`exerciseIndex` 与动作总数不变，目标动作自身的组数、重量、次数、RIR、休息和器械事实原样保留。移动后重置本动作的 warm-up pointer 与 Hold；热身按新的当前动作重新派生。当前/更早/不存在/重复目标、resting/confirm/summary、当前动作已有正式事实时必须拒绝且不追加事件。

**S1 UI。** 热身与正式组画面都提供可点击的「接下来」开放行，进入「本次顺序」sheet；顶部静态显示当前动作，下方列出今天稍后的已排动作，每行单一操作「现在练」。点选在 durable commit 成功后回到新的 Hero，不弹确认、不依赖可见教学小字；失败则留在 sheet、显示即时错误并用 VoiceOver announcement 主动播报。已有正式事实后「接下来」退为不可点击静态行。完整替换继续走 FR-TR6 的「换一个动作」，两种语义不得再混用。Dynamic Type、VoiceOver、Reduce Motion 与稳定 accessibility identifier 必须覆盖。后续的完整目录增删、剩余组次修改、自定义热身、部分完成动作暂停/恢复与保存到计划，均不在 S1。

### 6.1 动作库、模板生成与动作事实权威

训练计划不能依赖一组锁死的默认模板。Rede 的训练内容必须拆成三层:

| 层 | 权威职责 | 不允许 |
|---|---|---|
| Exercise Catalog | 动作事实:动作名、movement pattern、主/次肌群贡献、器械类型、可替代关系、技术风险、训练目的标签 | 把 UI 文案、模板默认值或用户历史当作动作事实来源 |
| Template Generator | 根据目标、频率、器械、经验、恢复、肌群等级和用户偏好生成训练结构 | 硬编码一组永远不变的默认训练计划 |
| Session Prescription | 在训练中根据当天执行表现、器械可用性和安全信号生成下一组建议 | 把一次训练中的临时推荐写成长期事实 |

动作库目标:

- 覆盖美国商业健身房常见动作:barbell、dumbbell、cable、plate-loaded machine、selectorized machine、bodyweight、assisted machine、band、kettlebell。
- 每个动作必须有稳定 `exerciseId`、本地化展示名、movement pattern、primary/secondary muscle contribution、equipment requirement、substitution group、contraindication hint 和 evidence/confidence tag。
- FR-EX2 展示内容（加性、零引擎影响、缺则不显示）：`techniqueCuesZh/En`（技术要点）、`evidenceTag/evidenceUrl`（真实循证）、`regressionZh/En`+`progressionZh/En`（退阶/进阶）、`safetyNoteZh/En`（§7.1 保守注意，取代旧单语 `contraindicationHint`）。均 decodeIfPresent、nil 默认、不参与匹配/处方/吨位、不 bump catalogVersion。
- 动作事实由 curated catalog 和版本化 migration 管理。LLM 可以帮助生成候选解释或缺口清单,但不得成为动作事实的最终来源。
- catalog 缺失贡献权重时,引擎必须输出 limitation,不能猜肌群或把动作强行归类。
- UI 默认只展示用户需要的训练信息;完整动作元数据只在详情/调试/专业解释里出现。

模板生成目标:

- `TemplateGenerator` 消费 clean profile、训练目标、每周可练天数、可用器械、训练历史、肌群等级、support allocation 和 safety/recovery 语义。
- 默认是 balanced development,不是固定 push/pull/legs 常量表。push/pull/legs、upper/lower、full-body、specialization 都是生成策略,不是唯一真相。
- 新用户冷启动只问最少问题:目标、每周训练天数、可用健身房/器械、训练背景。其余通过训练日志、跳过记录、替换记录和完成质量学习。
- 生成器必须可解释:每个训练日为什么有这些 movement pattern,每个动作为什么出现,每个替代动作为什么合理。
- 生成结果是计划建议或 program config,需要用户确认后才进入 canonical AppData。未确认的 engine output 不写回真相。

目标工程边界:

```swift
public struct ExerciseCatalogSnapshot: Equatable, Sendable {
    public let catalogVersion: String
    public let exercises: [ExerciseCatalogEntry]
    public let substitutionGroups: [ExerciseSubstitutionGroup]
    public let contributionModelVersion: String
}

public struct TemplateGenerationInput: Equatable, Sendable {
    public let cleanProfile: CleanProfileSummary
    public let trainingGoal: TrainingGoal
    public let weeklyAvailability: WeeklyAvailability
    public let equipmentContext: EquipmentContextSnapshot
    public let muscleDevelopment: MuscleDevelopmentProfile?
    public let supportContext: SupportAllocationContext?
    public let recentExecution: RecentExecutionSummary
}

public struct TemplateGenerationOutput: Equatable, Sendable {
    public let proposedPlan: ProposedProgramTemplate
    public let rationale: [TemplateDecisionReason]
    public let limitations: [TemplateGenerationLimitation]
    public let modelVersion: String
}
```

验收要求:

- 没有动作贡献时不生成高置信肌群建议。
- 没有器械时不推荐必须器械动作,除非同时给出替代。
- 用户连续替换某动作后,下一轮生成应降低该动作优先级,但不能在安全必要时永久删除同类 movement pattern。
- 默认模板不得只靠一个硬编码数组;必须能从 catalog + generator 输入重算。

### 6.2 器械组件库与负重校准

美国健身房的器械差异是训练准确性的核心问题之一。Rede 不把“机器上显示的重量”直接等同于可跨健身房比较的真实负荷。

器械分类:

| 类型 | 示例 | 负重策略 |
|---|---|---|
| Free weight | barbell、dumbbell、kettlebell | 重量可跨地点比较,仍需单位和杠铃/哑铃语义。 |
| Plate-loaded machine | Hammer Strength chest press 等挂片器械 | 片重可知,但机器杠杆和起始阻力不同;可用于本机趋势,跨型号比较降权。 |
| Selectorized machine | 插销配重片器械 | 每档实际重量、起始阻力和 pulley ratio 差异大;未校准前不得跨品牌/型号比较。 |
| Cable stack | cable row、lat pulldown 等 | pulley ratio 与 stack 标注可能不同;按 machine profile 控制置信度。 |
| Assisted machine | assisted pull-up/dip | 辅助重量方向相反,必须独立建模,不得当作普通加重动作。 |

用户体验原则:

- 用户不需要手动配置整个健身房。默认流程是选择或确认健身房,系统加载本地/已批准的 `GymEquipmentPack`;找不到时只在用户第一次使用具体机器时询问最低必要信息。
- 选择健身房只能服务训练推荐和负重校准;不得默认写入分享卡,不得暴露精确位置。
- 对美国主流连锁健身房和常见品牌,可以维护 curated pack:品牌、器械类别、常见型号、重量档位、单位、plate/cable/selectorized 特征和置信等级。
- pack 的来源必须可审计:官方器械资料、用户确认、人工审核或已批准的数据流程。LLM 可以帮助识别品牌/型号候选,但最终必须由用户确认或权威资料确认。
- 没有 pack 时,系统仍然可用:训练记录照常保存,推荐使用保守负重和本机趋势,跨器械比较降权。

目标工程边界:

```swift
public struct GymEquipmentPack: Equatable, Sendable {
    public let gymId: String?
    public let displayName: String
    public let source: EquipmentPackSource
    public let confidence: EstimateConfidence
    public let machines: [MachineProfile]
    public let freeWeights: [FreeWeightProfile]
    public let updatedAtIso: String
}

public struct MachineProfile: Equatable, Sendable {
    public let machineId: String
    public let brand: String?
    public let model: String?
    public let movementPattern: MovementPattern
    public let loadType: MachineLoadType
    public let displayedIncrements: [Double]
    public let unit: UnitSystem
    public let comparability: LoadComparability
}

public struct EquipmentCalibrationSnapshot: Equatable, Sendable {
    public let activeGymId: String?
    public let machineProfiles: [MachineProfile]
    public let userConfirmedMappings: [ExerciseMachineMapping]
    public let unknownMachinePolicy: UnknownMachinePolicy
}
```

校准规则:

- free weight 可作为强度和 milestone 的高置信输入。
- plate-loaded machine 可记录绝对片重,但跨型号只给中/低置信比较。
- selectorized / cable 未校准时只用于同机器趋势和训练中递进,不用于跨器械 milestone。
- machine chest press 的 100kg 不触发 barbell bench 100kg milestone;只能触发 machine-local milestone,且必须标明机器语境。
- 用户换健身房或换型号后,历史负重不丢失,但比较置信度重新计算。

### 6.3 训练中处方、组形学习与热身

训练中推荐不是固定递增、固定递减或固定同重量。系统推荐一个起点,用户执行后,后续正式组和热身组都要根据 session 内事实动态更新。

正式组逻辑:

- `SessionPrescriptionEngine` 读取今日处方、最近表现、当前动作、已完成组、RIR、reps、跳过/疼痛/替换事实和器械校准。
- 如果推荐 80 lb x 6 @ RIR 2,用户第一组完成 85 lb 并记录,第二组建议必须重新计算:可能继续 85、微调到 82.5/80、上调、下调或保留,取决于完成质量、目标 RIR、历史掉速、用户 set-shape 偏好和安全边界。
- 如果用户完全按推荐执行且没有额外输入,系统默认保持计划处方形状;只有在已完成组、休息、RIR 或历史模型给出足够信号时才自动调整。
- 用户喜欢 ascending、descending、wave、straight sets 或 top-set/back-off,都由 `SetExecutionModel` 从历史执行中学习,不是硬编码偏好。
- 偏好只能改变处方形状,不能覆盖安全、疼痛、目标 RIR、训练块目标和 data quality。

目标工程边界:

```swift
public struct InSessionPrescriptionInput: Equatable, Sendable {
    public let plannedExercise: ExercisePrescription
    public let completedSets: [CompletedSetObservation]
    public let currentReadiness: ReadinessDecision
    public let equipmentCalibration: EquipmentCalibrationSnapshot?
    public let setExecutionProfile: SetExecutionProfile?
    public let supportContext: SupportAllocationContext?
}

public struct SetExecutionProfile: Equatable, Sendable {
    public let preferredShape: SetShapePreference
    public let fatigueDropModel: FatigueDropModel
    public let loadAdjustmentStep: LoadAdjustmentStep
    public let confidence: EstimateConfidence
}

public struct NextSetRecommendation: Equatable, Sendable {
    public let targetLoad: LoadPrescription
    public let targetReps: ClosedRange<Int>
    public let targetRir: ClosedRange<Int>
    public let restSeconds: Int
    public let rationale: [PrescriptionReason]
    public let safetyFlags: [PrescriptionSafetyFlag]
}
```

热身组逻辑（FR-TR10）:

- 热身组由 working set、动作风险、历史表现、用户经验、器械类型和当天状态生成。
- 新用户、重 compound lift、高强度 top set、长时间未练动作时,热身更保守;熟练用户、轻孤立动作、低风险动作时,热身更短。
- 用户跳过热身不等于系统永久取消热身。系统记录 tolerance 和 friction,逐步减少不必要热身,但在高风险场景仍保留最小安全 warm-up。
- 热身组也学习个人偏好:有人喜欢多级 ramp,有人只需要一两组。学习结果必须带 confidence,不得用一次跳过直接重写长期策略。

**契约（已实现口径）：热身是「流内临时引导、绝不落 canonical」**——`WarmupLadderEngine`（纯函数，归 `RedeTrainingDecision`）按工作组顶重 + 动作事实（loadType/equipment/kind/startWeight + 单位）产出确定性保守阶梯（`WarmupStep`：emptyBar/percent/movementPrep）；阶梯重量经 LoadGrid 吸附真实档位、单调不减、严格小于工作重;assisted 方向反转（更多辅助=更轻=更安全）。热身在 `TrainFlowState` 里是 `.activeSet` 上的**内存 overlay**（`warmupPointer` + `isWarmingUp`，**不新增 Phase**）——热身打勾/跳过**绝不进 `events`、绝不进 `observationsByExercise`/落库**,因此既不毒化 `NextSetEngine`、也不污染 PR/volume/e1RM/等级统计,且无需 schema 改动;中断恢复时热身按工作组指针重生（瞬态、不参与 draft replay）。落盘闸（`CompletedSessionBuilder` 只读工作组 `observationsByExercise`）天然排除热身。**契约由此分两层**：热身=临时引导态(不落库)，工作组=唯一 canonical 训练事实。

> **实现状态（2026-06-17）**：FR-TR10 已落地——引擎(#566) + 流 overlay(#567，既有 252 训练流测试零回归) + 专注训练热身卡 UI(#568，完成/跳过热身)。阶梯算法为**保守 MVP 起步值待 owner 真机校准**（空杆 20kg→45lb、compound 50/70/90% × 5/3/1、isolation 60/80% × 5/3、自重/弹力带 1 步动作模式预热）。**跳过偏好学习（friction/tolerance + confidence，上 4 条的"学习"部分）明示后置为独立 slice**——当前为静态保守阶梯 + 可跳过(跳过不落库)。真机外观/交互待 owner TestFlight 验收。

验收要求:

- ascending / descending / straight / wave 都有 fixture。
- 用户第一组超推荐完成时,下一组 recommendation 根据 RIR/完成质量动态变化。
- 第三组大幅掉速用户会学到更保守后段策略;多组稳定用户不会被强行降重。
- 热身跳过多次只降低 friction,不取消安全必要热身。
- unknown selectorized machine 不产生高置信跨器械进步结论。

### 6.4 纠偏、主训练、功能性分配自动化

Rede 保留纠偏、主训练、功能性三类训练状态,但不能让用户在 onboarding 里回答大量偏好问题。系统必须通过行为学习和安全边界动态分配。

定义:

| 状态 | 作用 | 默认商业逻辑 |
|---|---|---|
| 主训练 | 肌肥大/力量进步的主体刺激 | 用户最愿意做,必须保持低摩擦和高完成感。 |
| 纠偏 | 解决疼痛、动作受限、左右差、技术风险或长期失衡 | 只在有明确证据时出现,短、具体、可跳过。 |
| 功能性 | 维持关节活动度、核心稳定、心肺/运动能力和长期可练性 | 用少量高价值动作服务长期训练,不喧宾夺主。 |

自动化规则:

- 首次使用默认 balanced allocation,但主训练占主要时间。
- 系统记录 planned/completed/skipped/edited/replaced/reason/safetyLock,形成 `SupportAllocationContext`。
- 用户连续跳过纠偏或功能性,系统学习到“低偏好/高摩擦”,下一轮减少频率、压缩时长、换更贴近主训练的替代动作,而不是简单永久删除。
- 如果跳过发生在明确 pain/safety/technique 风险下,安全权重高于偏好,系统保留最小纠偏剂量并解释原因。
- 如果用户长期只做主训练且无安全风险,计划可以更偏主训练;但 Progress / Plan 必须提示长期覆盖缺口和可能影响,让用户可选择 balanced、performance-first 或 minimum-support。
- 问用户的问题必须延后到有证据时:例如“你连续 4 次跳过肩部预备,要把它压缩成 2 分钟版本吗?”而不是 onboarding 里问一堆偏好。

目标工程边界:

```swift
public struct SupportAllocationContext: Equatable, Sendable {
    public let windowStartIso: String
    public let windowEndIso: String
    public let mainTraining: SupportLaneStats
    public let corrective: SupportLaneStats
    public let functional: SupportLaneStats
    public let inferredPreference: SupportPreferenceProfile
    public let safetyLocks: [SupportSafetyLock]
}

public struct SupportAllocationDecision: Equatable, Sendable {
    public let nextAllocation: SupportLaneAllocation
    public let userChoice: SupportUserChoice?
    public let rationale: [SupportDecisionReason]
    public let mustKeepReasons: [SupportSafetyReason]
}
```

决策优先级:

1. Safety lock、疼痛和明确技术风险。
2. 用户明确目标和训练时间。
3. 历史完成/跳过/替换行为。
4. balanced development 默认目标。
5. 商业化体验:少问、少打断、解释清楚、允许用户覆盖。

禁止:

- 因为用户跳过一次纠偏/功能性,以后就只推荐主训练。
- 把纠偏/功能性做成冗长 checklist。
- 用羞辱式文案说用户“不均衡”“很弱”。
- 在训练中弹出长问卷。
- 把 safety 必要动作藏到付费墙后。

### 6.4a 教练动作引擎（CoachActionEngine · FR-T5）

今日页「教练动作」是把系统已知的可执行建议收敛成**每屏 ≤1 张**优先级最高的卡，用户可**采纳 / 暂不处理**，采纳可**单步撤销**。它是独立于 §6.4 support-allocation、也独立于 §6.5 等级模型的轻量 surface：当前实现只吃裁决信号 + 处方 reason + 数据质量计数，**不读肌群等级**（肌群级教练建议见 §6.5.10，依赖未落地的 MLE）。

**引擎契约（`CoachActionEngine`，归 `RedeTrainingDecision`，纯函数、零文案、不落 engine output）**：
- **输入（clean input contract，§8）**：app 组合层把信号摊平成 `CoachActionInput` primitives 注入——`call`（TodayCall 枚举）、`trainedDaysThisWeek`（本日历周周一..今天去重训练天数；2026-07-15 周口径迁移，原 `sessionsLast7` 退役）、`plannedDaysPerWeek`、`totalSessionCount`、`stalledExerciseIds`（当日处方里命中 4 个到顶/毕业 reason 的动作：自重到顶 / 弹力带到顶 / 辅助毕业 / 负重自重回退；**不含**有重量动作的次数到顶 `repCeilingReached`——那只是加重、非换动作场景）、`dataFindingCount`（§8.0.1 数据质量问题数）、本周锚点 `weekStartISO`、`dismissals`、`volumeBoostAdoptedThisWeek`。禁 raw AppData / 等级原始值进引擎。
- **输出**：优先级排序的 typed `CoachAction`（kind/reasonCode/exerciseId?/count?/actionKey）。**优先级 修数据 > 换动作 > 补量**（数据可信 > 动作 > 量）。UI 取首条渲染。
- **三类动作与采纳语义**：
  - **换动作（exerciseSwap · ceilingReached）**：某自重/弹力带动作练到次数上限、或辅助毕业 / 负重自重回退（上列 4 个 reason；有重量动作 `repCeilingReached` 只加重、不触发）。采纳 = 弹**同族替代列表**（同 substitution group、非自身、非退役、按 rank）让用户选 → `applyExerciseSubstitution(originalId,actualId)` → 由 §6.0.1 plan() 消费覆盖（覆盖 > sticky > preferredId > rank）真正替换处方该槽；目标非该槽合法候选时 plan() 优雅回退、处方不变。
  - **补量（volumeBoost · belowWeeklyPlan）= 频率维度**：`count = plannedDaysPerWeek − trainedDaysThisWeek`（本周还差几**天**，日历周口径——计数与按周抑制键 `volumeBoost:<weekStartISO>` 同源，2026-07-15 收口）。**红线（§6.5.2）：无肌群名、无组数**——肌群级「补 N 组某肌群」依赖未落地的 MLE/贡献权重，属 §6.5.10 的未来能力，不在此引擎。采纳 = **仅承认**（记录本周已承认、引擎本周抑制本卡），**不加训练、不改处方**——文案与写入都不得宣称替用户加了训练（诚实红线）。守门（全满足才出）：活跃日（train/light，绝不 rest/deload）、非新用户（totalSessionCount>0）、计划有效（plannedDaysPerWeek>0）、本周已练落后且非负（0 ≤ trainedDaysThisWeek < planned；下界防御非法负输入、不虚高 count）。
  - **修数据（dataReview · dataHasFindings）**：消费 §8.0.1 `DataQualityReport` 的问题计数，提示去进展页核对（只读导航）。
- **降频（温和政策）**：换动作/修数据同 `actionKey` **累计 ≥2** 次暂不处理后不再出（累计总数，无"中间采纳则重置"逻辑——一旦累计达标即对该 key 持久抑制）；补量本周已采纳或本周已暂不处理（**≥1**）后本周不再出（补量按周窗口抑制、1 次即够；换动作/修数据按 actionKey 累计、取 ≥2 更宽容）。`actionKey` 由引擎产出（`dataReview` / `exerciseSwap:<id>` / `volumeBoost:<weekStartISO>`），UI 暂不处理即落库该 key、引擎下次据 `dismissals[key]` 降频——闭环，UI 不手拼 key。
- **采纳 / 撤销写入**：采纳与撤销都走 §5 唯一写闸（写前 backup + atomic + 不 fake success）；撤销 = 单步即时反向写（`removeExerciseSubstitution` / `removeVolumeBoost`），不另起 undo 栈。换动作撤销有三入口：采纳后即时浮条（~5s）+ 处方行「已换」微标（读落库覆盖 map、长存）+ 动作详情页「换回原动作」；补量撤销仅采纳后即时浮条（采纳零可见后果，刻意不造常驻控件）。撤销写失败时浮条保留供重试（错误面如实呈现）；**已知限制**：补量浮条正常超时后无持久撤销入口（刻意接受——补量为轻操作；换动作有微标/详情页两条持久兜底）。「暂不处理」是单向降频信号：写闸层有反向口（`removeCoachActionDismissal`）但**不暴露 UI 撤销**，卡按降频策略自然再现。
- **UI/文案红线**：每屏 ≤1 卡；不羞辱；不出现算法名/「AI 判断」/「系统认为」/「最佳」；双语。

> **实现状态（2026-06-17）**：R1 FR-T5 切片 6a–6c 已落地换动作（采纳/撤销）+ 补量（采纳/撤销，频率维度）+ 温和降频，写入经 schema 11 三个 open-bag 容器（`exerciseSubstitutions{}` / `coachAdjustments.volumeBoosts[]` / `coachState.dismissed[]`，纯加性；`downMigrate 11→10` 删三容器=**best-effort 有损回退**：空容器往返恒等，已有用户意图数据则丢失，仅用于非生产备份对账、不用于生产回滚）。**修数据卡（R1 收尾 2026-06-20 已接线）**：今日页经 `DataQualityComposer`（与进展页**同口径同计数**的单一组装真源）算 `DataQualityReport`，`dataFindingCount = suspectSets.count`（可疑组数；静默净化的丢弃/忽略不算）喂引擎；可疑组 >0 出「修数据」卡，采纳「去核对」跨 tab 跳进展页数据质量区（不改状态、不假报；可疑数据修好后卡自然消失）。**遗留**：跳转目前落在进展页（数据质量区在页底），自动滚动定位是小跟进项。真机交互待 owner TestFlight 验收。

### 6.5 肌群发展等级模型

Rede 保留用户可理解、可分享、可用于训练决策的肌群等级系统。等级不是用户手填标签,不是绝对力量排行榜,也不是 LLM 主观判断;等级由本地纯函数派生模型估计(V1 落包拍板见 §6.5.1),服务 Progress、Plan、CoachAction 和 Share / Growth System。

等级系统的工程目标:

- 给用户一个清晰成长符号: 胸部 Lv.10、背部 Lv.8、腿部 Lv.15。
- 把旧的 beginner / intermediate / advanced 训练水平并入同一等级系统,不保留第二套平行判断。
- 把卧推 100kg / 225lb 等公认重量突破纳入等级突破和级别晋升,形成可解释、可分享的 milestone。
- 给训练引擎一个可解释的均衡发展信号: 哪些肌群补足、维持、减少或恢复受限。
- 给分享系统一个强传播资产: level up、均衡度改善、PR/e1RM 置信提升。
- 保持 source-of-truth 纯净: 等级永远可重算,不写回 canonical AppData。

#### 6.5.1 模块边界

等级系统不是新 package、不是 persistence 层、不是 app view model 逻辑。V1 落包拍板(2026-07-07 批次 A,替代本节旧「属于 RedeTrainingDecision」单包措辞):

- **引擎纯函数落 `RedeLocalSnapshot`**(MuscleLevelTypes / MuscleVolumeAggregator / MuscleLevelEstimator / MuscleProfileAssembler / MuscleMilestoneCatalog):该包 Foundation-only 零依赖(Master §5 硬合同),widget 与主 app 共享,等级最终要进 App Group 快照供 widget 展示,放这里避免跨包搬运。
- **目录→肌群翻译层留 `RedeTrainingDecision`**(MuscleGroupMapping,口径见 §6.5.2):它要读 ExerciseCatalog,而 RedeLocalSnapshot 禁止依赖目录包。
- 两包各持一份同值 `MuscleGroupID` 枚举(Master §5 禁跨包依赖),双侧文件锚句互指 + rawValue 契约测试防漂移;跨包传递用 rawValue 字符串。

目标文件/符号边界:

| 层 | 目标职责 |
|---|---|
| `RedeDomain` | 承载 canonical AppData、`TrainingSession`、`TrainingSetLog`、`EstimateConfidence` 等基础值。除非未来需要持久化用户目标偏好,否则不新增等级 truth 字段。旧符号名仅作参考。 |
| `RedeDataHealth` | 生成 `CleanAppDataView` / clean projections,保证 raw AppData 不进等级模型。 |
| `RedeTrainingDecision` | 目录→肌群翻译层: `MuscleGroupMapping`(17→10 归并)与 `MuscleContributionTable`(fractional 权重)——需读 ExerciseCatalog 故留本包;引擎全链在 RedeLocalSnapshot(§6.5.1 落包拍板,TrainingTierProjector 语义由 assembler 实现、无独立类型;share 载体 = ShareSnapshot.MuscleLevel)。 |
| SwiftUI app | 只读取 projection 渲染 Progress / Plan / Share Card,不自己计算等级。 |
| Persistence | 不保存等级结果;若保存用户目标偏好,必须走 `CanonicalSessionWriter` 已批准的 profile/program scalar edit 或新增明确写入类别。 |

禁止:

- raw AppData 直接进入等级模型。
- 把 `currentLevel`、`peakLevel`、`levelPoints`、`confidence` 写入 canonical AppData。
- app 层用 UI 状态、分享次数、外部社交反馈反向修改等级。
- 用 HealthKit 原始数据、体重、疼痛/伤病数据直接提高等级。
- 为等级系统引入网络、账号、云、SQLite/CoreData/SwiftData 或第三方 ML runtime。
- 继续维护一套独立于 `MuscleDevelopmentProfile` 的 beginner / intermediate / advanced 训练水平模型。

#### 6.5.2 输入合同

等级模型只接受 clean / typed 输入。目标输入形态(**契约目标,保留**;**V1 实际输入形态**见下注):

> V1 实现注(2026-07-08 对账): 实际输入 = `MuscleProfileComposer.Input`(rows/touches/e1rmRows 三种 rawValue 行类型 + bestActual/bestE1Rm 字典 + unitSystem + previous* 记忆 + nowISO)与每肌群 `MuscleObservations`;下方 struct 中 TrainingTemplate/ProgramGoalContext/MusclePriorityPreference/TrainingTierPrior/EquipmentCalibrationSnapshot/SupportAllocationContext 等输入 V1 未接(类型不存在),接入时机随对应能力(目标偏好/器械校准/support)排。



```swift
public struct MuscleLevelEstimatorInput: Equatable, Sendable {
    public let cleanHistory: [TrainingSession]
    public let cleanProgramTemplates: [TrainingTemplate]
    public let cleanProgramGoal: ProgramGoalContext?
    public let userGoalPreference: MusclePriorityPreference?
    public let selfReportedTrainingBackground: TrainingTierPrior?
    public let exerciseCatalog: ExerciseCatalogSnapshot
    public let equipmentCalibration: EquipmentCalibrationSnapshot?
    public let supportContext: SupportAllocationContext?
    public let strengthMilestoneCatalog: StrengthMilestoneCatalog
    public let nowIso: String
    public let modelVersion: String
}
```

输入来源:

- `cleanHistory`: DataHealth clean view 里的 completed / valid training history。
- `TrainingSetLog`: 使用 `weight` / `actualWeightKg`、`reps`、`rir`、`techniqueQuality`、`painFlag`、`completionStatus`、`done`、`completedAt`。
- `ExercisePrescription`: 使用 `id`、`exerciseId`、`actualExerciseId`、`originalExerciseId`、`recordExerciseId` 和 sets/warmup/planned sets。
- `ExerciseCatalogSnapshot`: 提供 exercise identity、movement pattern、primary muscle、secondary muscle、muscle contribution weights、equipment tags 和 substitution family。
- `EquipmentCalibrationSnapshot`: 只用于提高或降低负重可比性的置信度,不得把未校准机器重量当作跨器械真值。
- `SupportAllocationContext`: 提供纠偏/功能性/主训练完成、跳过和安全锁信号,用于解释训练覆盖和用户耐受度。
- `MusclePriorityPreference`: 用户目标偏好,只能影响目标权重,不能手动改等级。
- `selfReportedTrainingBackground`: 用户在 onboarding/profile 里选择的训练背景,只能作为冷启动 prior,真实训练记录足够后必须被模型证据覆盖。
- `strengthMilestoneCatalog`: 公认动作重量突破目录,例如卧推 100kg / 225lb、深蹲 140kg / 315lb、硬拉 180kg / 405lb;目录用于 milestone 和 level floor,不是外部权威排名。

V1 贡献口径拍板(2026-07-07 批次 A):

- **17→10 肌群归并映射**(MuscleGroupMapping,唯一翻译点):front/side/rear delt→shoulders;traps/upper-back→back;lower-back→core;adductors→glutes(独立审查修正:内收肌功能上随髋伸训练,归 glutes 比 quads 更不误导);**forearm 无归宿如实排除**(返回 nil,不硬塞)。目录其余 9 个肌群与 MuscleGroupID 同名直通。
- **fractional 计数**: primary 1.0 / secondary 0.5(Pelland 2025 meta 最优拟合,EVIDENCE_LEDGER E-03)。同动作多块肌肉归并后撞同一 MuscleGroupID 桶时取 max 权重,不累加。

缺少关键输入时必须降级:

- 没有动作肌群贡献表: 只输出 `insufficientCatalog` limitation,不得估计该动作贡献。(V1 现实: 无此 code——映射 nil/未知值在翻译与聚合层**静默跳过**、绝不猜,受影响肌群留校准态出 shortHistory;「不出等级」即 V1 的降级表达。)
- 没有足够历史: 输出 calibration 状态,显示“正在校准”,不得硬给高置信等级。
- 器械未校准: 允许使用 reps/RIR/完成趋势,但负重强度贡献降权。
- 疼痛/不适/技术差: 优先降低训练决策 aggressiveness,不得为了升级继续加量。

#### 6.5.3 输出合同

等级输出是 read-only projection。目标类型:

```swift
public enum MuscleGroupID: String, CaseIterable, Sendable {
    case chest
    case back
    case quads
    case hamstrings
    case glutes
    case shoulders
    case biceps
    case triceps
    case calves
    case core
}

public enum MuscleLevelTrend: String, Sendable {
    case rising
    case stable
    case declining
    case detraining
    case calibrating
}

public enum MuscleDevelopmentDecision: String, Sendable {
    case prioritize
    case maintain
    case reduce
    case recover
    case insufficientData
}

public enum TrainingTier: String, Sendable {
    case calibrating
    case beginner
    case novicePlus
    case intermediate
    case advanced
    case elite
}

public enum LevelBreakthroughKind: String, Sendable {
    case muscleLevel
    case trainingTier
    case strengthMilestone
    case balanceMilestone
    case consistencyMilestone
}

public struct StrengthMilestoneAchievement: Equatable, Sendable {
    public let milestoneId: String
    public let exerciseId: String
    public let displayName: String
    public let thresholdKg: Double
    public let thresholdLb: Double?
    public let achievedBy: StrengthMilestoneAchievementMethod
    public let sourceSetId: String?
    public let achievedAtIso: String
    public let linkedMuscleIds: [MuscleGroupID]
    public let levelFloor: Int?
    public let tierFloor: TrainingTier?
    public let confidence: EstimateConfidence
}

public enum StrengthMilestoneAchievementMethod: String, Sendable {
    case actualCompletedSet
    case estimatedOneRepMax
}

public struct LevelBreakthrough: Equatable, Sendable {
    public let kind: LevelBreakthroughKind
    public let targetId: String
    public let fromLevel: Int?
    public let toLevel: Int?
    public let fromTier: TrainingTier?
    public let toTier: TrainingTier?
    public let evidence: [MuscleLevelEvidence]
    public let achievedAtIso: String
}

public struct MuscleLevelEstimate: Equatable, Sendable {
    public let muscleId: MuscleGroupID
    public let currentLevel: Int
    public let peakLevel: Int
    public let levelProgress: Double
    public let trend: MuscleLevelTrend
    public let confidence: EstimateConfidence
    public let decision: MuscleDevelopmentDecision
    public let score: MuscleLevelScoreBreakdown
    public let evidence: [MuscleLevelEvidence]
    public let limitations: [MuscleLevelLimitation]
}

public struct MuscleDevelopmentProfile: Equatable, Sendable {
    public let estimates: [MuscleLevelEstimate]
    public let overallTier: TrainingTier
    public let balanceScore: Double?   // nil = 解锁肌群 <3,样本不足不装均衡(2026-07-07 批次 A 拍板)
    public let strongestMuscleIds: [MuscleGroupID]
    public let priorityMuscleIds: [MuscleGroupID]
    public let strengthMilestones: [StrengthMilestoneAchievement]
    public let breakthroughs: [LevelBreakthrough]
    public let generatedAtIso: String
    public let modelVersion: String
}
```

输出语义:

- `currentLevel`: 当前发展等级,用于 Progress / Plan / CoachAction。
- `peakLevel`: 历史最高等级,用于成就和分享;单日状态差不得降低 peak。
- `levelProgress`: 到下一级的进度,范围 `0...1`;不得显示为医学或体型诊断。
- `trend`: 最近趋势,必须经过平滑,不能因一次训练表现波动立即改变。
- `confidence`: 复用 `EstimateConfidence` 的 low / medium / high 语义。
- `decision`: 给计划引擎的动作语义,不是 UI 文案。
- `evidence`: 至少说明主要依据,例如“最近 6 周拉类有效组不足”“卧推 e1RM 置信提升”“腿部训练量高且恢复稳定”。
- `limitations`: 说明为什么不确定,例如历史不足、器械未校准、动作库缺肌群权重、疼痛信号存在。
- `overallTier`: 旧 beginner / intermediate / advanced 的替代输出,由肌群等级、训练一致性、关键动作 milestone、数据质量和安全限制共同推导。
- `strengthMilestones`: 已确认或高置信估算的公认重量突破;actual set 和 e1RM 估算必须明确区分。
- `breakthroughs`: 本次 projection 识别到的等级/级别突破,供 Progress、CoachAction 和 Share Card 使用。

#### 6.5.4 等级尺度

用户可见等级采用整数等级:

- V1 使用 `Lv.1...Lv.20` 作为主展示尺度。
- `TrainingTier` 使用 `calibrating / beginner / novicePlus / intermediate / advanced / elite`。产品文案可以显示为“校准中 / 初级 / 进阶初期 / 中级 / 高级 / 精英”,但它必须来自等级系统,不再来自独立的旧 `AutoTrainingLevel`。
- 同一用户身上的不同肌群可以并排显示,但解释必须写清: 这是“个人肌群发展画像”,不是跨人、跨性别、跨体重、跨器械的绝对排名。
- 高级用户达到上限后,后续可通过 tier / prestige 扩展,但不得在 V1 先做复杂体系。

内部计算使用 `developmentScore`(=breakdown.total):

- `developmentScore`: `0...100` 的模型分数,不直接暴露给普通用户。
- `currentLevel`: 由 `developmentScore` 经每肌群校准阈值映射。
- `levelProgress`: 当前分数到下一等级阈值的比例。
- `peakLevel`: 由历史已确认 `currentLevel` 派生。**写入合同已定义（2026-07-07 批次 B2）**: `MuscleLevelMemory`(RedeLocalSnapshot) derived-only JSON(canonical 同目录 muscle-level-memory.json,schema 版本化、未知版本拒读、decode 失败=如实「无记忆」从零校准、atomic 写);只记已解锁肌群;写侧 peaks 逐键 max 合并(并发竞写/回退校准两场景峰值都不丢);levels/tier 快照语义最后写者胜。绝不读写 canonical。
- `overallTier`: 由多个肌群等级、训练一致性、关键动作 milestone、balanceScore、confidence 和 safety limitation 推导;不能由用户 profile 的 trainingLevel 直接决定。

现役计分/曲线锚(全部集中在 `MuscleLevelModelConfig.current`;**mle-v2** = MLE-8 首轮校准 2026-07-08——owner 真机 E3 反馈「3 场 Lv.9 太快」,三项收紧):

- 等级阈值曲线 `T(n) = n + 0.2n²`(前快后慢,Lv.20 = 100 分);`level(forScore:)` bottom 桶 floor 恒 0,防低分区进度回跳。(曲线 v2 未动)
- 两个实打子分数: exposureScore(满分 60,有效组数 × 频率折减 `min(记录周数/6, 1)`,防单周暴量刷级;**满分锚 v2: 周均 15 → 20 有效组**——每周两练的扎实量才拿满)+ performanceScore(base 15,e1RM 每 +10% 加 7.5,满分 30;**新用户无基线 v2: base 15 → 0**——强度维度零证据不给分,推翻 v1「中性 base」拍板,此 0 非罚分、新用户保守表达由置信封顶承担;停练出窗 = 0 + noRecentWindow)。其余四个子分数（milestone/progression/recoveryPenalty/goalAdjustment）恒 0 占位;coverage/consistency 实打各 0-5 低权（满分 100 = 60+30+5+5）。breakdown 结构已按 §6.5.7 全量落型。
- **置信等级封顶(v2 新增,§3.4「低可信→判断更保守」的等级面)**: low 封 Lv.5(beginner 顶)、medium 封 Lv.10、high 放开;命中时 progress 顶格 1(分数已超、等数据解锁,非「刚进入此级」)+ `confidenceLevelCapApplied` evidence 供依据行解释(「数据量还撑不起更高等级」)。**milestone floor 在组装层后应用、胜过封顶**——实测成就(如卧推 100kg)不被数据量保守压制(有意排序,测试锁定)。校准后观感锚: 3 场 ≈ Lv.5、6 周稳定 ≈ Lv.10、12 周高置信高容量起分数说话。
- 校准解锁: 3 次相关训练**或** 8 个有效工作组(§6.5.6 minimumCalibration 的「或」口径,v2 未动)。
- milestone floor 抬底命中时 `levelProgress` 置 0 并打 `milestoneFloorApplied` evidence——曲线级进度对抬底后等级无意义,如实归零而非展示假进度。

等级降级规则:

- 单次训练差、单周少练、一次跳过,不得直接降级。
- 连续 detraining、训练覆盖长期缺失、恢复/疼痛长期限制,可以让 `currentLevel` 下降或进入 `declining` / `detraining`。
- `peakLevel` 不随下降而消失,用于保护用户成就感和分享资产。

旧训练水平模型合并规则:

- 旧 `TrainingLevelEngine.AutoTrainingLevel` / `TrainingLevelAssessment` 不再作为独立产品模型演进。干净重写直接实现 `TrainingTierProjector` 语义;只有在 review slice 证明必要时,才做 compatibility adapter。
- Profile 里的 `trainingLevel` 只能作为用户自报训练背景,用于冷启动 prior 和初始文案;当 clean history 足够时,真实训练记录、肌群等级和 milestone 证据覆盖 self-report。
- 旧模型里的 feature gate,例如 beginner 时保守推荐、advanced exercise selection、recommendation confidence,必须改读 `TrainingTier` + `confidence` + `safety/recovery` 组合语义,不得继续散落比较 raw string。
- UI 只能展示一个等级系统: 肌群 Lv + overall tier + milestone。不得同时出现“系统判定中级”和另一套不相关的“胸 Lv.10 / 背 Lv.8”解释。

整体级别推导原则:

| Tier | 语义 | 典型条件 |
|---|---|---|
| `calibrating` | 数据不足 | 历史不足、关键动作 identity 不稳定或 confidence low。 |
| `beginner` | 正在建立训练基础 | 多数核心肌群 Lv.1-Lv.5,训练频率/动作覆盖仍在稳定。 |
| `novicePlus` | 已能稳定执行基础训练 | 多数核心肌群 Lv.5-Lv.8,有基础一致性,但 milestone 或覆盖仍不足。 |
| `intermediate` | 可承受更明确的计划推进 | 多数核心肌群 Lv.8-Lv.12,至少一个关键动作族有中置信 milestone 或稳定 e1RM 进步。 |
| `advanced` | 可承受更复杂训练组织 | 多数核心肌群 Lv.12-Lv.16,多个动作族有高置信进步或重量突破,且 safety limitation 可控。 |
| `elite` | 极高训练发展水平 | Lv.16+ 肌群广泛存在,多个核心动作达到高阶 milestone,且长期一致性高。V1 只可作为展示,不得默认增加训练风险。 |

这些 level range 是 V1 起点,必须由 `MuscleLevelModelConfig` 集中管理。`overallTier` 必须可以被 balanceScore 和 safety/recovery 限制下调:例如卧推很强但背/腿长期缺口大,可显示“水平推已进入中级 milestone,整体仍在进阶初期”。

V1 tier 实现口径(2026-07-07 批次 A): 已解锁肌群**中位等级**落界 5/8/12/16(config 集中),等级输入用 milestone floor 抬底后值;无强度进步信号(e1rmRising evidence、milestoneScore>0、milestone tierCandidate 达成三者皆无)时封顶 novicePlus;balanceScore<40 下调一档;**中位置信**(偶数取低侧保守)为 low 或已解锁肌群 <3(复用 balance 门槛)时兜底 calibrating——用中位而非「任一 high」,防单个专项肌群绕过安全网。

#### 6.5.5 公认重量里程碑与级别突破

重量 milestone 是等级系统的一等输入和分享资产,但不是万能强度标准。V1 里程碑只作为 product milestone / cultural milestone,用于“突破某级、进入某级别”的可解释事件;它不能替代完整肌群发展画像。

`StrengthMilestoneCatalog` 必须满足:

- 目录集中定义在 `RedeTrainingDecision`,带 `modelVersion`。
- 每个 milestone 绑定 canonical exercise、movement family、linked muscle ids、threshold kg/lb、achievement method、level floor、tier floor、confidence rule 和 display copy。
- kg/lb 都要支持;美国市场默认显示 lb。`Bench 100kg` 与 `225 lb Bench` 属于同一 milestone family 的地区化表达,不是精确单位互换;catalog 必须分别保存 metric threshold 和 imperial threshold。
- barbell milestone、dumbbell milestone、machine milestone 分开。机器动作只有在 gym equipment / machine calibration 足够时才能生成机器本地 milestone,不得冒充 barbell milestone。
- milestone 分为 `actualCompletedSet` 和 `estimatedOneRepMax`。用户真实完成 100kg 卧推才是“Bench 100kg hit”;e1RM 跨过 100kg 只能显示“estimated 100kg bench strength”。
- 疼痛、poor technique、异常数据、未完成 set、身份不稳定或单位不可信时,不得触发正式 milestone。

V1 起始 milestone 示例:

| Milestone | 适用动作 | linked muscles | level / tier 影响 |
|---|---|---|---|
| Bench 60kg / 135lb | `bench-press` actual set 或 high-confidence e1RM | chest、triceps、shoulders | 水平推基础突破,可给 chest/horizontal press Lv.4 floor。 |
| Bench 80kg / 185lb | `bench-press` actual set 或 high-confidence e1RM | chest、triceps、shoulders | 水平推进阶突破,可给 Lv.7 floor。 |
| Bench 100kg / 225lb | `bench-press` actual completed set 优先 | chest、triceps、shoulders | 水平推中级突破,可给 chest/horizontal press Lv.10 floor,并触发 `intermediate` tier candidate。 |
| Bench 120kg / 265lb | `bench-press` actual completed set 优先 | chest、triceps、shoulders | 高中级突破,可给 Lv.13 floor。 |
| Bench 140kg / 315lb | `bench-press` actual completed set 优先 | chest、triceps、shoulders | 高级突破,可给 Lv.16 floor,并触发 `advanced` tier candidate。 |
| Squat 140kg / 315lb | `squat` actual completed set 优先 | quads、glutes、hamstrings、core | 下肢中级突破,可给 lower-body Lv.11 floor。 |
| Deadlift 180kg / 405lb | `deadlift` actual completed set 优先 | hamstrings、glutes、back、core | 后链高级前置突破,可给 posterior-chain Lv.14 floor。 |
| Overhead Press 60kg / 135lb | `overhead-press` actual completed set 优先 | shoulders、triceps、core | 垂直推中级突破,可给 shoulders Lv.10 floor。 |
| Weighted Pull-up +20kg / +45lb | `weighted-pull-up` actual completed set 优先 | back、biceps、core | 拉类中级突破,可给 back Lv.11 floor。 |

里程碑影响规则:

- milestone 可以给相关肌群 / movement family 设置 level floor,但不能直接把所有相关肌群拉到同一级。
- milestone 可以触发 `TrainingTier` candidate,但 overall tier 必须同时看 balanceScore、训练一致性、数据质量和 safety limitation。
- 如果 milestone 和日常训练覆盖冲突,UI 必须解释为“力量突破已达成,但整体发展仍需补足”,不能强行美化。
- milestone 不替代体重相对强度——绝对锚管 kg/lb 心理里程碑与分享资产;体重相对强度另见下方「相对体重力量标准」(2026-07-09 批次 D 落地,替代本行早前「V1 不做」措辞)。public benchmark/年龄系数仍不做。

**相对体重力量标准(2026-07-09 批次 D,`RelativeStrengthStandards`,standardsVersion `rel-standards-v1`)**:

owner 拍板背景:绝对锚三缺口——60kg 以下无档(卧推 40kg 与 20kg 新手同级)、back/biceps 无低门槛路径(weighted-pullup floor 11/deadlift floor 14 门槛过高)、锚不按体重/性别调(女 60kg 推 60kg 含金量≈男推 100kg 拿不到档位)。

- **口径**:相对比 = 全历史最好成绩(kg)÷ 当前体重(kg),无单位、不吃 unitSystem;按性别查五档表(beginner/novice/intermediate/advanced/elite)。五动作:bench-press/squat/deadlift/overhead-press/**barbell-row**(back/biceps 低门槛新覆盖);weighted-pull-up 不进表(「+X kg」与体重比语义冲突)。数值为 E1 专家判断锚(男 intermediate 卧推 1.0×体重等业界通识),全表契约测试锁死,调整须过 owner。
- **档位→floor/tier**:2/6/10/16/19;intermediate/advanced/elite 出 tierCandidate(与绝对锚 bench-100→10/.intermediate 同格)。elite=19 非 20:满级留给「elite 档+持续训练量」。
- **与绝对锚并存取 max**:两套 achievements 合并喂 assembler,floors 自动 max;绝对锚九条数值零改动。
- **低置信护栏(审查 S2)**:肌群置信 low 时相对 floor 封 intermediate(10)——3 场新人一次相对 elite 测验不直接 Lv.19,「数据量撑不起时先给中级起点,练出置信自动放开」;绝对锚不受此限(门槛硬、天花板 16)。
- **输入与退化**:性别 = `userProfile.sex`(male/female 白名单,写入口 `applySexPreference`,设置页训练背景铭牌可填/可清,「暂不设置」=移除键);体重 = HealthKit 最新 bodyMass(静默查询不弹框)→ `profile.weightKg` 兜底 → nil;**任一缺 = 相对标准整体不参与**(如实退化到绝对锚现状,不猜不用中间表)。体重合理区间 20-400kg 在引擎层再守一道(审查 S1:HealthKit 脏数据——秤错单位/家庭共享混数据——会经 peaks 只升不降永久污染记忆)。
- **sex 用途单一契约**:只进相对力量标准,不进处方/恢复/等级其他任何决策面;CleanProfile 投影同白名单(未知值 nil 留痕)。
- **evidence 分流**:相对锚单独把 floor 抬到生效高度时打 `relativeStrengthApplied`(「按体重的力量标准抬升了等级起点」);两套同高归 `milestoneFloorApplied`(传统里程碑语义优先)。
- **时点简化(已知边界)**:当前体重 × 全历史最好成绩判档——减重后档位可能上浮,V1 接受(体重变化缓慢,力量标准业界口径本就用当前体重)。年龄系数、体重档分段表、分享卡素材不做(YAGNI,等真机反馈)。

V1 实现拍板(2026-07-07 批次 A MLE-4,`MuscleMilestoneCatalog`,catalogVersion `mle-milestones-v1`):

- **落包**: 与引擎同置 `RedeLocalSnapshot`(§6.5.1 落包拍板的延伸,替代本节上文「集中定义在 RedeTrainingDecision」措辞);与既有 FR-PR7 简化版 `StrengthMilestoneCatalog` 并存不替换——简化版继续服务进度页里程碑区,契约版带 linkedMuscles/levelFloor/tierCandidate 服务等级抬底与 tier 信号。
- 上表九条即 V1 全量目录,id/双梯阈值/linkedMuscles/floor/tierCandidate 由全表契约测试锁死。
- **floor 只抬已解锁肌群**: 校准中不因一次达标出等级(冷启动灰屏语义优先)。
- **「不能直接拉到同一级」与「不能强行美化」的实现口径**: floor 是 max 抬底不是赋值;且 **balanceScore 用未抬底曲线级**——milestone 是强度成就不是训练覆盖证据,同一 floor 套满 linked muscles 会把「只练卧推」美化成「完美均衡」。tier/中位吃 floor、balance 不吃,语义拆分。
- **estimated 达标同样触发 floor 与 tier 信号**: confidence rule V1 = actual→high、estimated→medium;目录判定层不设置信卡。**V1 现实(批次 B 接线后如实注)**: 调用方唯一把关 = statsRecords 数据质量剔除(可疑组不进 e1RM),**无额外 e1RM 置信门槛**——任意干净 e1RM 达标即产 estimated 成就;是否补置信卡列批次 C 拍板。同一里程碑 actual 已达不再出估算条目(估算不冒充实测);lb 梯独立比较(102kg≈224.9lb 不过 225lb 档),同 FR-PR7 口径。

#### 6.5.6 计算 pipeline

`MuscleLevelEstimator` 的标准 pipeline:

1. **Build clean set events**: 从 clean history 展平 completed sets,解析 exercise identity、actual exercise、weight/reps/RIR、technique、pain、time。
2. **Attach exercise contribution**: 通过 `ExerciseCatalogSnapshot` 给每个 set 绑定 muscle contribution weights。
3. **Normalize load evidence**: 对 free weight、plate-loaded machine、selectorized machine 使用不同置信策略;未校准机器不参与跨器械强度比较,只参与本器械趋势。
4. **Detect strength milestones**: 从 actual completed set 和 high-confidence e1RM 中识别 `StrengthMilestoneAchievement`,区分真实完成和估算突破。
5. **Compute muscle exposure**: 按 muscle contribution 汇总 effective sets、weekly frequency、recent coverage、movement pattern coverage。
6. **Compute performance signal**: 复用 e1RM（Epley `w×(1+r/30)`,同 `SessionSummary`/`RedeLocalSnapshot.ProgressSnapshot`,无独立 `E1RMEngine` 类型）的概念,按动作族和肌群汇总可比强度趋势;RIR 缺失或技术差时降权。
7. **Compute progression signal**: 计算同肌群/同动作族在 recent window 和 baseline window 的趋势,避免只看单次 PR。
8. **Compute recovery/safety adjustment**: 疼痛、poor technique、support safety lock、长期跳过纠偏/功能性动作会降低 aggressiveness。
9. **Apply user goal weights**: 默认 balanced;用户选择专项目标时只调整目标 gap,不改事实分数。
10. **Apply milestone floors**: 对相关肌群 / movement family 应用 milestone level floor 和 tier candidate,但受 confidence、balance 和 safety 限制。
11. **Map score to level**: 每肌群独立阈值映射为 `currentLevel`、`levelProgress` 和 `trend`。
12. **Project overall tier**: 用 `TrainingTierProjector` 生成 `overallTier`,替代旧 `AutoTrainingLevel` 独立模型。
13. **Build decision semantics**: 输出 prioritize / maintain / reduce / recover / insufficientData。
14. **Build explanation**: 生成 evidence / limitation / user-facing summary,供 Progress、Plan、CoachAction、Share Card 使用。

V1 覆盖注(2026-07-08 对账): 步 1/2/4/5/6(比率部分)/10/11/12/13/14 已落地;**未实现**——步 3 负重归一化(无器械区分)、步 6 的 RIR 缺失/技术差降权、步 7 独立 progression(并入 performance 比率,progressionScore 恒 0)、步 8 recovery/safety、步 9 goal weights;步 11 的「每肌群独立阈值」V1 为全肌群共用同一条 T(n) 曲线(个体化阈值待真实数据)。

初始窗口建议:

- `recentWindow`: 最近 6 周,用于趋势和当前计划建议。
- `baselineWindow`: 最近 24 周,用于个人基线和等级稳定性。
- `minimumCalibration`: 至少 3 次相关训练或 8 个有效工作组才允许显示 low-confidence level。
- `mediumConfidence`: 至少 6 次相关训练、18 个有效工作组、覆盖 2 个动作族。
- `highConfidence`: 至少 12 次相关训练、36 个有效工作组、覆盖 2 个以上动作族且关键动作 identity 稳定。(V1 现实: 置信判定只实现前三维,identity 稳定维未实现——补齐列批次 C 拍板。)

这些阈值是 V1 模型常量,必须集中定义、带 `modelVersion`,并由 fixtures 覆盖;不得散落在 UI 或多个 engine 文件里。

V1 组装口径拍板(2026-07-07 批次 A MLE-3):

- **trend 日历锚定**: 窗口从 nowISO 回数 ISO 周,缺周记 0——不按「有数据的周」漂移,detraining 才可达(停练本身就是信号)。**窗口只含已完成周**(进度页审计 2026-07-13): 进行中的本周不计入——若计入会按部分量/零量拉低 recent 均值,周一早上全员 declining 的系统性误报(与回归协议治的「莫名降一档」同类病)。recent = 上 1..3 周、prior = 上 4..6 周。校准中 trend = calibrating(独立枚举值,UI 不渲染箭头);已解锁但 prior 窗全零(历史不满窗)= stable,不出 detraining 恐吓。
- `balanceScore` 公式: 已解锁肌群等级变异系数 cv 反向映射 `(1 - min(cv,1)) × 100`;解锁 <3 块时为 nil(样本不足不装均衡)——输出合同该字段为 `Double?`(§6.5.3 已同步)。mle-v2 起输入一律为修饰前曲线级(计算中间体 curveLevel):milestone floor 与置信封顶**都不吃**——floor 向上拉平、cap 向下压平,两个方向都会伪造均衡(#675 实拍抓获 cap 致假 100)。
- `peakLevel`: max 单调;previousLevels/previousPeaks/previousTier 由调用方提供(禁写 canonical,存储合同批次 B 定)。首次解锁不算 breakthrough(从校准中到出等级是「亮相」不是「升级」)。
- decision 四支 V1 实产三支(insufficientData/recover/prioritize/maintain);**reduce 永不产出**——依赖 MRV 超量判定,留白后置(组装层注释留痕)。

#### 6.5.7 分数构成

每个肌群的 `developmentScore` 由以下子分数组成:

| 子分数 | 作用 | 主要输入 | 工程要求 |
|---|---|---|---|
| `exposureScore` | 是否练够 | effective sets、训练频率、肌群贡献权重 | 动作贡献缺失时降置信,不得猜肌群。 |
| `performanceScore` | 是否具备可比强度 | e1RM、reps/RIR、同动作族表现 | 未校准机器只做本器械趋势,不跨器械比较。 |
| `milestoneScore` | 是否达到公认重量突破 | `StrengthMilestoneAchievement`、canonical lift identity、actual/e1RM method | milestone 只能影响相关肌群和 tier candidate,不能覆盖 safety 或 balance。 |
| `progressionScore` | 是否在进步 | recent vs baseline slope、PR/e1RM delta、完成质量 | 单次 PR 只能触发 evidence,不能独立决定等级。 |
| `coverageScore` | 是否练得全面 | movement pattern、primary/secondary muscle distribution | 胸/背/腿等肌群各自有覆盖规则。 |
| `consistencyScore` | 是否稳定训练 | 周频率、连续性、计划完成度 | 跳过记录影响趋势,但用户偏好不等于事实缺失。 |
| `recoveryPenalty` | 是否该降激进度 | painFlag、poor technique、support safety lock、恢复受限 | Safety/recovery 永远优先于升级。 |
| `goalAdjustment` | 是否符合当前目标 | balanced / specialization preference | 只改目标 gap,不改原始事实。 |

默认权重不写死在 UI。V1 可用规则模型,但必须满足:

- 所有权重集中在 `MuscleLevelModelConfig`。
- 输出带 score breakdown。
- 同一输入必须确定性输出同一等级。
- 不允许 NaN、无限值、负等级或空 muscle id。
- 模型变更必须递增 `modelVersion` 并更新 goldens。

#### 6.5.8 个体校准

每个用户、每个肌群必须独立校准:

- 胸、背、腿不能按绝对重量互相比较。
- 同一肌群内,barbell、dumbbell、plate-loaded、selectorized machine、bodyweight 也不能简单相加。
- 初期使用个人历史作为主要锚点;数据不足时只显示 calibrating / low confidence。
- 若未来引入外部 percentile 或 crowd benchmark,只能作为 optional reference,不得在无同意、无数据质量证明时参与核心训练决策。

个体差异要被显式建模:

- 肌耐力强的人: 多组表现下降小,trend / consistency 得分更稳定。
- 肌耐力弱的人: 后续组掉得多,但只要可重复且符合计划,不直接判差。
- 状态波动大的人: confidence 降低,计划调整更保守。
- 喜欢递增/递减/波浪组的人: 从 `SetExecutionModel` / set-shape learning 读取偏好,只影响同一训练中的处方形状,不直接提高肌群等级。

#### 6.5.9 冷启动和低数据状态

新用户不能被迫回答大量问题。等级系统冷启动策略:

1. 默认 balanced development。
2. Onboarding 最多只问训练目标和训练背景;训练背景只成为 `selfReportedTrainingBackground`,不再成为独立 training-level 真相。
3. 前 2-4 次训练以校准为主,展示“正在校准肌群等级”。
4. 有低置信结果时可显示等级,但必须带 confidence 和 limitation。
5. Progress 可以显示“数据还少,先用接下来几次训练提高判断准确度”。

V1 实现口径(2026-07-07 批次 B3): 全员校准 = 区块一句校准文案(两拍全角空格,不列 10 行灰——空态克制);部分解锁 = 解锁行亮 + 其余折叠一行「其余 N 个肌群正在校准」;逐肌群独立解锁(有的出等级有的校准中)。confidence 的 limitation 表达 = 展开依据行人话(shortHistory→「训练数据还不够」等),不出读数标签(§3.4)。
6. Plan 在 low confidence 下只做轻微补足建议,不做大幅计划重排。
7. 用户自报高级但历史证据不足时,显示“按你的背景先保守校准”,不得直接开启高级训练决策。

用户可以手动选择目标:

- balanced。
- upper emphasis。
- lower emphasis。
- posterior-chain / glute emphasis。
- push / pull balance。
- specific weak-point focus。

这些目标只影响计划偏好和 gap target,不得作为等级事实写入。

#### 6.5.10 决策接入

等级模型的输出进入决策系统时必须经过语义层:

| 消费方 | 读取内容 | 不允许 |
|---|---|---|
| Progress | `currentLevel`、`peakLevel`、trend、confidence、evidence、limitations、balanceScore。**已落地（2026-07-07 批次 B3，FR-PR6）**：进度页 Development 块——校准/解锁/折叠三态、依据展开（evidence/limitation 人话）、tier+均衡行；confidence 只作行为表达（§3.4）。 | 展示原始敏感数据或羞辱式弱项文案。 |
| PlanAdjustment | `decision`、priorityMuscleIds、recoverMuscleIds、goal gap。**自动式已落地（2026-07-10 批次 E，owner 拍板「不要建议直接自动改」）**：处方引擎「肌群偏好」消费点接通——`plan(priorityMuscles:)` 读 MLE 记忆的 priorityMuscleIds（assembler 真 decision 单一真源，已排除 detraining），弱肌群为主的动作 +1 组。**门控让位**：仅 train verdict（deload/light/comeback 优先）+ 周期平周（overreach 不叠/deload 不抵）+ 每场合计 ≤2 组；**瞬时调制**不写回自定义槽（渐进漂移红线）；负反馈收敛（量涨→等级追中位→名单摘除）。解释只在「查看依据」抽屉（musclePriorityBoosted 依据行），无提案卡无常驻小字——原提案式方案 owner 已否。展示级 decision 行（批次 B #670）与频率维度提案（FR-PL3/4，§8.1，不读肌群等级）并行不悖。 | **无门控无预算**的机械加量（让位与 cap 是本能力的红线本体）；提案卡形态（owner 已否）；把名单写回 canonical 或自定义槽。 |
| Scheduler | 肌群优先级、恢复限制、覆盖缺口 | 忽略 safety lock 或 recovery signal。 |
| CoachAction | 可执行建议和解释。**肌群级**建议（例如“本周多补 2-4 组水平拉”——带肌群名与组数）依赖等级模型/贡献权重,属未来能力,**未落地**;已落地的 §6.4a 教练动作引擎只做**频率维度**补量（“本周还差 N 次”,无肌群无组数,§6.5.2 红线）、换动作、修数据 | 生成无法执行、不可回滚或强迫用户的建议;无贡献权重时凭空猜肌群（§6.5.2）。 |
| Share / Growth | 脱敏后的 Muscle Level / Level Up / Balance projection | 读取 raw AppData、HealthKit 原始值或私人 notes。 |
| Legacy consumers | 需要 beginner/intermediate/advanced 的保守度或高级功能 gate | 不得继续读取旧 `AutoTrainingLevel` raw string 作为平行真相。 |

优先级规则:

1. SafetyLock / pain / recovery risk 高于等级升级。
2. 用户目标偏好高于默认 balanced,但低于安全和数据质量。
3. Level gap 高但 confidence low 时,只做观察或轻微建议。
4. Level gap 高且 confidence medium/high 时,Plan 可以提出补足。
5. 强项 level 高不等于完全不练;Plan 只能降低维持量,不得让强项长期归零。
6. 用户连续拒绝某肌群补足建议时,系统降低打扰频率,但保留可解释提醒。
7. milestone 可以提升相关动作族的信心和 level floor,但不能绕过 SafetyLock / pain / poor technique。

#### 6.5.11 UI 和文案边界

用户可见表达:

- “胸部 Lv.10”
- “背部 Lv.8 · 正在补足”
- “腿部 Lv.15 · 维持即可”
- “整体级别: 中级”
- “卧推 100kg 突破 · 水平推进入 Lv.10”
- “整体均衡度 76”
- “本月背部升级 Lv.8 -> Lv.9”

V1 实现收敛(2026-07-07 批次 B3,对上表示例样式的三处拍板,交接件同步留痕):

- **maintain 不出语义标签**(上表「维持即可」示例不落地): 多数肌群常态即 maintain,全员贴标签=标签噪音(去 AI 感批次同类清理先例);等级本身就是维持的表达。标签只给 prioritize(·正在补足)与 recover。
- **recover 按 trend 拆两条**: detraining(只是没练)=「先找回节奏」;「恢复优先」保留给未来 pain/safety 喂数接入后——V1 recover 全部由 detraining 触发,不得让用户误读成伤病/超量信号。
- **里程碑徽标不在 Development 块重复渲染**: 同页 FR-PR7 区块已是里程碑面;milestone floor 影响由展开依据行(milestoneFloorApplied=「力量突破抬升了等级起点」)表达;floor 命中时 levelProgress 置 0(「刚进入此级」如实从零,不显示旧曲线假进度)。
- 解释入口实现(2026-07-09 升级) = 点肌群行进**详情页 sheet**(行内展开退役):大块等级头部 + 部位构成 + 依据区(十个引擎 code 全量映射人话;漏配即依据行静默丢失——L10n 侧全量锚测试锁死);均衡度行简化为「均衡度 76」(同行已有「整体级别」前缀)。

**钻取层：子肌群等级(2026-07-09,owner 拍板「详情页承载,效果优先」)**:

- 两层结构:概览层 10 大块不动(人话,MLE 契约/tier/balance/记忆/分享零改);详情页「部位构成」区显示子肌群各自等级——children 表 V1 只 back=[背阔 lats/上背 upper-back/斜方 traps]、shoulders=[前束/中束/后束];胸腿等无子层(目录无该粒度,等真实需求)。
- **子层纯展示**:不进 tier/balance/决策/记忆/分享(防子块低置信污染整体判断)。
- 子分数口径:子暴露(满分锚 12 组/周——大块锚 20 的子块缩放)× 频率折减 + **有量才继承**大块 performance 分(强度是大块属性子块共享;0 量子块不吃——「斜方 Lv.6 · 每周 0 组」自相矛盾,如实落 Lv.1);曲线/置信封顶沿大块同款。
- 数据源 = 归并前的目录细粒度值(entry 原始 primary 1.0/secondary 0.5)——归并是 10 块层的主动选择,子层按原始粒度聚合。
- **目录修订(2026-07-09,owner 审定授权「直接进」)**:back 系 26 动作 primaryMuscle 细化——12 下拉/引体→lats、14 划船/架上拉→upper-back(健身惯例:下拉练宽、划船练厚);shoulder 系 10 推举→front-delt。secondary 零涉及(盘点确认)。lats 为映射新值(→.back,同归宿故 10 块等级数学恒等零扰动);计划编辑器频率护栏面归并回大块显示(「背部 2次/周」,细粒度归钻取层)。

必须同时提供解释入口:

- 为什么是这个等级。
- 置信度如何。
- 最近哪些训练影响了判断。
- 下一步建议是什么。
- 用户如何接受、忽略或调整目标。

禁止文案:

- “你的背很弱。”
- “你的腿过强所以不用练。”
- “等级低说明身材差。”
- “分享才能解锁训练建议。”
- “系统确定你有伤病/疾病。”
- “卧推 100kg 所以你全身都是高级。”

#### 6.5.12 与分享系统的连接

V1 落地状态(2026-07-07 批次 B5): **Muscle Level 卡已上线**——`ShareSnapshot.Content.muscleLevel` + `SharePrivacyFilter.muscleLevel` 唯一构造入口(等级降序/截断 6/balance 取整钳 0-100/tier 校准中不出卡);入口=Development 块「分享发展画像」(仅有已解锁肌群时出现,§9.4 用户主动触发)。对下方契约 projection 的 V1 收敛(交接件拍板②留痕): **confidenceLabel 结构性缺失**(字段不存在于卡类型,比契约 String? nil 更硬——§3.4 置信度零读数);levelProgress/safeEvidenceSummary/milestoneBadge V1 不进卡(版面克制,里程碑面归 PR 卡);trend 只映射 rising/declining 箭头(detraining 无箭头=不编信号)。Level Up / Balance Improvement 卡推后(依赖跨次数据节奏,观察真实使用后加)。

分享系统只消费脱敏 projection:

```swift
public struct MuscleLevelShareProjection: Equatable, Sendable {
    public let muscleId: MuscleGroupID
    public let displayLevel: Int
    public let levelProgress: Double?
    public let overallTierLabel: String?
    public let milestoneBadge: String?
    public let trendLabel: String
    public let confidenceLabel: String?
    public let safeEvidenceSummary: String
    public let generatedAtIso: String
}
```

分享卡默认可用:

- muscle name。
- level。
- overall tier。
- milestone badge,例如 `Bench 100kg` / `225 lb Bench`。
- trend。
- level-up delta。
- balance score。
- safe evidence summary。

分享卡默认禁用:

- 体重、HealthKit 原始数据、疼痛、伤病、失败组、RIR 明细、健身房位置、精确时间、私人 notes。

Level Up Card 触发条件:

- `currentLevel` 跨过新等级阈值。
- confidence 至少 medium,或用户明确允许 low-confidence 成就提示。
- 不是由单次异常数据造成。
- 没有 safety/recovery limitation 阻止庆祝式文案。
- milestone card 必须标明 actual 或 estimated,不得把 e1RM 估算写成真实完成。

#### 6.5.13 Rewrite Parity Slices

等级系统必须按可验收 rewrite slice 实现。每片先定义目标行为、输入输出、fixtures、Swift tests 和 UI 验收,再写 runtime;旧代码只作为参考,不作为完成证明。

实际排片对照(2026-07-07 批次 A #659-#666 + 批次 B #667-#671 收口): 下表 MLE-0/1 → 批次 A 的 D1+MLE-0~3(类型/config/映射/聚合/计分/组装,PR #660-#664);MLE-4(目录)→ 批次 A MLE-4(#665,契约版 MuscleMilestoneCatalog 与 FR-PR7 简化版并存);MLE-3(贡献 snapshot)→ 降维——目录已有 primary/secondary 字段,无需独立 snapshot 层;MLE-5(Progress 接入)→ 批次 B B1 喂数(#668)+B2 记忆(#669)+B3 UI(#670);MLE-2(tier 统一)→ 并入批次 A MLE-3 组装(TrainingTierProjector 语义由 assembler 实现,无独立类型;旧 AutoTrainingLevel 未再接新消费方,自报背景在设置页已改「自报背景」标签区分);MLE-6(Plan/CoachAction)→ **部分落地**(展示级 decision 语义行,提案式批次 C);MLE-7(Share)→ 批次 B B5(#671,仅 Muscle Level 卡);MLE-8(校准精修)→ 首轮已做(#675 mle-v2:无基线 0 分/暴露锚 20/置信封顶/balance 用 curveLevel;二轮等真实用户数据)。

| Slice | 内容 | 验收 |
|---|---|---|
| MLE-0 Contract | 本节工程合同、测试计划、fixtures 目录约定 | 文档通过 diff check,不改 runtime。 |
| MLE-1 Types + Pure Estimator | 在 `RedeTrainingDecision` 新增 public types、`MuscleLevelEstimator`、`MuscleLevelModelConfig`、`TrainingTier` | `swift test` 覆盖空历史、低/中/高置信、无 NaN、确定性输出。 |
| MLE-2 TrainingTier Unification | 实现 `TrainingTierProjector` / optional compatibility adapter,把 beginner / intermediate / advanced 并入肌群等级系统 | 不再有第二套用户可见 training level;所有消费者读 semantic capability。 |
| MLE-3 Exercise Contribution Snapshot | 将动作库肌群贡献、movement pattern、equipment tags 接成 typed snapshot | 缺贡献时输出 limitation,不猜测。 |
| MLE-4 Strength Milestone Catalog | 新增 `StrengthMilestoneCatalog`,覆盖卧推 100kg / 225lb 等 milestone | actual/e1RM 区分,机器不得冒充杠铃 milestone。 |
| MLE-5 Progress Projection | Progress read path 接入等级、整体级别、milestone、趋势、置信度、证据 | UI 只读,不写 AppData。 |
| MLE-6 Plan / CoachAction Integration | PlanAdjustment / CoachAction 读取 decision semantics | Safety/recovery 覆盖等级补足,用户拒绝可回滚。 |
| MLE-7 Share Projection | 生成 `MuscleLevelShareProjection`,接 `ShareSnapshot` | 分享 projection 不含禁用字段,milestone 标明 actual/estimated。 |
| MLE-8 Calibration Refinement | beta 数据后调整模型权重和阈值 | 递增 `modelVersion`,更新 goldens 和 changelog。 |

#### 6.5.14 测试要求

最低测试矩阵:

- cold start: 无历史时输出 calibrating / insufficientData。
- low confidence: 历史少但可显示 low-confidence level。
- balanced user: 多肌群训练均衡时不提出过度补弱。
- chest-strong/back-lagging: 推类多、拉类少时背部 prioritize,胸部 maintain。
- leg-strong-maintain: 腿部 level 高但仍保留维持量。
- pain/recovery override: 疼痛或 safety lock 时 decision 为 recover,不因低等级加量。
- machine calibration unknown: 机器重量参与本器械趋势,不参与跨器械强度比较。
- exercise catalog missing contribution: 输出 limitation,不得猜肌群。
- set-shape preference: 递增/递减组偏好不直接改变 level。
- detraining: 长期缺失训练后 currentLevel 可下降,peakLevel 保留。
- legacy merge: 旧 beginner/intermediate/advanced 不再产生第二套 UI;`overallTier` 是唯一输出。
- self-report override blocked: 用户自报 advanced 但训练历史不足时仍为 calibrating / low confidence。
- bench 100kg actual milestone: `bench-press` actual completed set 100kg 触发 `StrengthMilestoneAchievement`,给 chest/horizontal press Lv.10 floor 和 intermediate candidate。
- bench 100kg estimated milestone: e1RM 估算跨 100kg 时标记为 estimated,不得写成 actual hit。
- machine chest press blocked: 未校准 machine chest press 100kg 不触发 barbell bench milestone。
- imbalanced milestone: 卧推 100kg 但背/腿长期不足时,水平推可进 milestone,overallTier 不得强行 advanced。
- share privacy: `MuscleLevelShareProjection` 不含禁用字段。

验证命令(`RedeTrainingDecision` 是现役引擎包,M1-1 起重建,CI 每次运行):

```bash
# MLE 引擎/组装/记忆/分享主体(§6.5.1 落包拍板)
cd ios/packages/RedeLocalSnapshot && swift test
# 目录→肌群翻译层(映射/贡献表)
cd ios/packages/RedeTrainingDecision && swift test
```

若等级模型影响 `PlanAdjustment`、`CoachAction` 或 app UI,还必须跑全 package 测试和 iOS build。

LLM 可用于解释、总结和生成自然语言提醒;不得由 LLM 单独判定肌群等级。等级估计必须能由本地可审计模型复算。

## 6.5 周期化引擎（Mesocycle · FR-PL2）

> **实现状态（2026-06-15）:** owner 拍板做此功能（4 周块 + 主动过载）。5 步 slice **全部已实现**——S1 纯相位计算（`MesocyclePhase.swift` + golden）、S2 接处方调制、S3 与反应式减载合并、**S4 schema 8→9 落库**（迁移于 `AppData.init(decoding:)` 先于 validate、纯加性、可逆 down、读不改盘）、**S5 计划页周期条**（4 周块·当前周 ember·相位角色；FR-PL1 关闭/空历史退诚实占位）。**默认 `enabled=false` = 零行为回归**（设置页「训练周期」开关已上，opt-in；owner 2026-06-15「继续」拍板启用——经写闸 `applyMesocyclePreference` 落 `mesocycle.enabled`，开后今日页处方吃相位、计划页显示周期条）。本节是**目标契约**；进度/证据看 DEV_LOG。

**模型（owner 选「最权威/最专业/最符合人体生理」拍板）。** 一个 mesocycle = **4 个 ISO 周累积块（3:1 load:deload）**，4 个周角色 校准 / 构建 / **过载（主动）** / 减载。选 4 周而非 6 周：4 周（3:1）是 Helms/RP/NSCA meta 证据最强的默认中周期，且计划减载落第 4 周正好领先反应式规则 4 的 21 天（=3 周）窗口约一周——计划在前主动减、反应在后兜底减，节律天然对齐（6 周块会让安全网频繁抢跑）。块长 `blockLengthWeeks` 存进数据（=4），未来改 6 周只改数据 + 加一张角色表，不改引擎契约。

**相位调制（与 light×0.9 / deload×0.8 同款，正交叠乘）。** 每周角色产一个 `PhaseModulation{weightMultiplier, setDelta, rirTarget}`，叠在 verdict 调制**之前**（同 2026-06-10 拍板的「冷启动先验×裁决正交叠乘」模式）：

| 周 | 角色 | weightMul | setDelta | rirTarget |
|---|---|---|---|---|
| 1 | 校准 calibrate | 1.00 | 0 | 3 |
| 2 | 构建 build | 1.00 | 0 | 2 |
| 3 | **过载 overreach** | 1.00 | **+1** | **1** |
| 4 | 减载 deload | **0.85** | **−1**（下限 2） | 4 |

> **RIR 全整数（owner 拍板 2026-06-16）**：旧版校准 2.5 / 减载 3.5 是半档，但 RIR 用整数档选择器记录（训练页 —/0/1/2/3/4/5，无半档）、半档不可执行也不可记录。改为校准 3 / 减载 4——目标=显示=记录端到端取整；强度阶梯仍单调（校准 3 > 构建 2 > 过载 1，减载 4 最松）。

过载主动（+1 组、RIR 压到 1 = 功能性过载），重量仍交给现有双重渐进自然涨（phase 不主动加重，把"假过载"风险压最低）；减载主动卸量。四类 loadType（external / bodyweight / band / assisted / bodyweight-plus）沿各自已有的 light/deload 反转分支，phase 减载只是多触发一次现有 deload 形态，零新方向逻辑。

**相位推进（按 ISO 周，纯函数）。** `phase(blockStartISO, todayISO, blockLengthWeeks)`：weeksElapsed = (今日日号 − 块起日号) / 7；weekInBlock = weeksElapsed % 4 → 查角色。日期非法 / today<blockStart → 安全降级校准（不抛错、不画假进度）。**相位永远从真数据现算，零写死计数器**（FR-PL1）。

**块锚点（可从真历史重算，防腐烂）。** `blockStartISO` = 「最近一段连续训练序列」起点（从最新场往回，相邻 ≤ `restartGapDays`=10 即同块）；**停训 ≥10 天 → 软重置**锚到今日（疲劳已清，再算"过载周"是假的，诚实优先于连续性；与 verdict 的 longGapReentry≥14天→light 协同）。空历史 → nil（计划页退诚实占位）。

**与反应式减载共存（安全优先，S3 收口）。** 反应式规则 4（21 天高量 → deload 裁决）**一字不动、保留为安全网、永远优先**。计划式减载**不抢 TodayCall 四态、不产 deload 裁决**，只作 phase 调制层塑形重量/组数/RIR（call 仍如实反映恢复状态）。管线：先跑 verdict（不改）→ 再跑带 phase 的 prescribe。**合并规则（实现版，比 min/sum 更简更安全）：phase 仅 `verdict.call == .train` 时生效；verdict 非 train（light / deload / rest）时 phase 整体让位给反应式安全网**——从根上杜绝双重调制（0.85×0.80 之类砍过头），且 phase 的核心价值（在身体报警前主动减载）正是落在 train 态。block 周序照常推进（让位不停摆），故下个训练日仍落对相位。各 loadType 路径（external/bodyweight-plus 减外加负重；自重/弹力带按次数；assisted 反转）共用同一 `applyPhaseSetsRir`（组数/RIR），weightMultiplier 只在重量轴路径套（方向安全）。

**数据模型。** AppData 加顶层 `mesocycle{enabled, blockStartISO, blockLengthWeeks}`；**不存"当前第几周"**（永远现算）。schema 8→9 走 `schema-migration-guard`（迁移钩子**必须先于 validate**、纯加性、可逆 down-migrate、备份、dry-run、单独 PR 禁 auto-merge——这是唯一会静默毁数据的环节）。

**实现落点（2026-06-15·S4/S5 收口）。** 迁移落在 `AppData.init(decoding:)`——唯一反序列化边界，一处覆盖全 reader（store.load / 写闸 re-validate / 测试夹具）；`SchemaMigrator.migrate` 先于 `SchemaVersion.validate`（current=**11**）。8→9 = 抬版本 + 缺则补 `mesocycle{enabled:false, blockLengthWeeks:4}`（纯加性、幂等、不覆盖既有）；`downMigrate` 反向去 mesocycle、回落版本（9→8 单步可逆）。**后续迁移**（同一逐步范式）：9→10 = 5 天 PPL 日序重映（`ppl-ul`→`push-pull-legs`）；10→11 = FR-T5 教练动作三容器播种（见 §6.4a，纯加性；down 为 best-effort 有损）。**读路径纯内存升级、不改磁盘**——磁盘 canonical 只由已备份的写闸改写，原始 v8 文件始终可从备份恢复（= 备份/dry-run 要件，已由「读不改盘」测试钉死）。无迁移路径的旧版本（schema-7 及更早）仍如实 `upgradeRequired`、不静默升级；未来版本仍 `futureIncompatible`。`blockStartISO` 落库但消费侧仍从真历史现算（防腐烂，FR-PL1）；`blockLengthWeeks` 由今日页处方与计划页周期条**读同一份 `appData.mesocycle` 配置**透传，保证两页相位永不分叉（审查 MAJOR-1：结构保证，非「都恰好是 4」的巧合）。

## 7. Train 页面规则

Train 只有专注训练态。必须服务于：

- 当前动作。
- 目标组次、重量、reps、RIR。
- Complete Set。
- 快速编辑 weight/reps/RIR。
- Rest timer。
- Next/previous exercise。
- Swap exercise。
- Pain / discomfort。
- Skip set / skip exercise。
- Finish workout。
- Resume active session。

不进入 Train：

- 长期分析。
- 计划编辑。
- 设置。
- 营销卡片。
- 大型动作浏览。
- 与训练中低摩擦无关的按钮。

**快改入口教学提示两条消失线（T6 2026-07-05 #650）。** 「点重量可调整…」教学行显示条件 = 未用过快改入口（`@AppStorage hasUsedQuickAdjust`，用过永久消失）**且** 清洗后累计完成场数 < 3（与 CoachActionEngine `totalSessionCount` 同口径复用、不另设持久化计数器）——练三场都没点说明不需要教，说明书不永久驻留界面。「按计划目标开始」（firstSetWhy）为 why 行首组分支的多态状态信息（完成组后切 nextSetWhy），非教学文案、有意保留。

### 7.1 休息倒计时运行时合同

休息倒计时的「时间流逝」归 **app 层**（沿用 §核心纯净：引擎无时钟）。`TrainFlowState` 只存 `restSeconds` 计划值；倒计时锚点是 `SessionStore.restCountdown: RestCountdown`。

**休息 Live Activity（K6 2026-07-16 立项，FR-TR13；2026-07-16 修复+质感批更新）**：`restCountdown.begin/clear` 两个既有接线点挂 `RestLiveActivityController`（app target）——start/update/end 全生命周期**十三端点**（rest-begin/resume/draft-restore/draft-restore-nonresting/add-time/pause/flow-missing/rest-finished/session-summary/session-start/session-end/draft-discard/launch-cleanup 孤儿兜底；abandon 路径并入 session-end）+ staleDate（endsAt+60s）+ 串行 Task 链保序；attributes 在 RedeWidgetShared（静态=动作名+下一组目标串，app 侧格式化，extension 零业务计算）、UI 在 RedeWidget target（锁屏面 + 灵动岛 expanded/compact/minimal，`Text(timerInterval:)`/`ProgressView(timerInterval:)` 原生自更新零推送）。**ContentState = `restStartedAt` + `restEndsAt`**：起点是进度环/条的分母锚点（begin 挂点当下捕获，enqueue 外——排队延迟不改锚定）；`updateEnd`（+30 加时）从 `activity.content.state` 读回**原起点**，进度按新总长诚实回落不重置（与训练页 restFraction 的 totalSeconds 同步语义平行）。**渲染纪律**：compact 倒计时**固定宽 40pt**（`Text(timerInterval:)` 理想宽度贪婪测量，maxWidth 压不住会被系统整个丢弃——owner 真机 1.7(24) 胶囊空白 bug 根因）；`isStale` 数字/环/条/keyline 全灰化（视觉契约见设计语言 §7.1）。**纯视觉层**：到点提醒仍归休息通知（并存不重复）；暂停 = end、继续 = begin 新活动（起点=恢复时刻，原生倒计时无冻结态，不显假计时）；无 app 内开关（系统级开关已有）。

- **锚点形态**：`RestCountdown`（`RedeTrainingDecision` 包内纯值类型，`now` 注入故可单测）以**绝对结束时刻**记时——运行中存 `endDate`、暂停时冻结 `pausedRemaining`；任一帧的剩余秒数由「`endDate − 当下 Date`」求出，而非逐秒自减计数。
- **归属契约（why，owner 2026-06-15 反馈修复）**：剩余秒数**不得**放进 `TrainTabView` 的 `@State`。`RootTabView` 用 `switch selection` 渲染各 tab，切页会销毁整棵视图树 → 视图 `@State` 归 0 → 回到训练页倒计时显示 `0:00` 并立即结束。锚点必须放在根级常驻的 `SessionStore`（跨切页、跨切应用存活），且按墙钟求剩余 → 离屏（切 tab 或切出应用）期间真实时间照常流逝。
- **生命周期**：进入 `resting`（仅 `logSet` 一条路）由 `SessionStore.apply` 起锚；`restFinished` / 落到 `summary` / 结束·放弃·新开会话清空；`resting→confirmEnd→resting`（结束确认弹层取消后继续训练）折返期间**不动**锚点，剩余随墙钟延续不重置。跨进程恢复（FR-TR9）若落在 `resting` 按计划秒数重新起算（不留旧 deadline）。
- **显示与收尾分离**：倒计时显示由 `runRestTimer` 这个 `.task` 循环每秒递增 `restTick` 触发按墙钟重算重绘（**不用 `TimelineView`**——其在「切出应用再回前台」时不保证恢复逐秒刷新，owner 2026-06-15 二次反馈）；同一 `.task` 兼任「到点自动进下一组」（先判后睡，回来若已到点立即收尾、不闪 `0:00`）。`.task` 的 id（`restTaskKey`）含 `scenePhase`：**回前台时 key 变 → task 重启**（等价于切 tab 重建视图的效果），保证既追平离屏期间流逝、又续走逐秒刷新；后台不空转（`scenePhase != .active` 直接返回）。`+30` / 暂停 / 继续经 `SessionStore.addRestTime` / `toggleRestPause` 改锚点。
- **进度条与倒计时同步（owner 2026-06-15 三次反馈）**：进度条比例 = `RestCountdown.fraction()` = `剩余 / totalSeconds`，与倒计时数字同源 → 满格起步、`0:00` 精确归零。`totalSeconds` 是「本段休息总时长」，`+30` 时**同步增长**（`begin` 设值、`add` 累加、`clear` 归零）——故 `+30` 后进度条不会因 `剩余 > 初始计划` 卡在满格，而是按新总时长继续平滑下降。分母**不得**用 `restSecondsPlanned`（固定值会在 `+30` 后被 `min(1,·)` 钳成满格、与倒计时脱钩）。

## 8. Progress / Plan / Settings 边界

Progress：

- 历史训练。
- PR/e1RM。
- 训练量。
- 肌群发展等级、趋势、置信度和证据摘要。
- 日历连续性。
- 数据可信度。
- HealthKit/imported workout 的 display-only 证据。
- 从 Progress 派生的隐私安全分享卡入口。

### 8.0 进展派生投影（ProgressSnapshot · M4-1 已实现）

- **包边界**：`RedeLocalSnapshot` 重生为 Foundation-only 独立包（Master §5：与 `RedeDomain`/canonical AppData 强制解耦，永不读写真相）。输入是包内自有值类型 `SnapshotSessionRecord`（id + 本地日 dateISO + 动作/组 + 时长），由 app 组合层把 DataHealth clean view 映射进来（M4-3 接线）。
- **输出**：`ProgressSnapshotBuilder.build(sessions:)` 纯函数 → 历史（新→旧：volume/组数/顶组/PR 动作/时长）+ 每动作 e1RM 趋势（旧→新点列 + latest/best）+ 周训练量（ISO 周·周一起始，吨位/组数/场次）。
- **口径锁定**（与已落盘实现对齐，改动须过架构门）：e1RM = Epley `w×(1+r/30)` 取每场顶组（重量优先、同重比次数，同 `SessionSummary`）；PR = 顶组重量**严格大于**全部更早历史同动作顶组，首练不发奖（M3 保守口径）；volume = Σ 重量×次数；周键由纯整数日期数学（Hinnant civil-days）从 dateISO 推导，无 Calendar/时区依赖——固定输入产出固定结果。
- **防御**：非法日期条目整体跳过（上游 clean view 已保证合法）；legacy 的 median-e1RM/置信度门控不在本合同（置信度属数据质量层，且 §3.4 禁做 UI 读数）。

### 8.0.1 数据质量信号（DataQualityReport · M4-2 已实现）

- **合同**：`RedeDataHealth.DataQualityReportBuilder.build(view:)` 纯函数，输出 typed 最小信号：① 净化丢弃统计（聚合 `DataHealthIssue` 按 场/动作/组/字段 四类计数）；② 可疑组静默标记（通过合法性安检但不合常理的数字）。
- **可疑规则**（MVP 起步值，测试锁定待校准）：组重 > 1.5×本人**更早场**同动作最好顶组（基准 ≥30kg 防小重量噪声；首练无基准不标；被标组不进基准，防错值污染参照线）；绝对天花板 >400kg；次数 >50。一组一理由，优先级 天花板 > 相对 > 次数。
- **红线（结构化满足）**：只标记不丢弃不改数据（clean view 原样，有测试）；输出零文案——「置信度」在结构上不存在（§3.4 行为表达）；缺 RIR 类数据缺口刻意不进报告（§3.4 折进 Train 补记，不挂 Progress）。UI 标记与修正入口归 M4-3。
- **消费合同（M4-3 已接线）**：进展页统计（趋势/PR/判断句/历史合计）**排除可疑组**——可信度的行为表达（§3.4 判断更保守）；可疑组仍在数据区如实列出、canonical 原样不动；修正入口随 M5 编辑类写入。
- **已知边界（审查确认，刻意接受）**：被标组不进基准 ⇒ 单场真实暴涨 >1.5× 后基准不演化、持续被标——视为诚实行为（渐进超负荷不触发；一场跳 50%+ 几乎总是记错/换器械/单位混淆，应持续提示直到经 M4-3 修正入口处理）；有测试锁定该行为，阈值待真实反馈校准。
- **消费方（教练动作 dataReview，§6.4a；R1 收尾 2026-06-20 已接线）**：今日页与进展页都经 `DataQualityComposer`（app 层单一组装真源：目录投影 ceilings + `DataQualityReportBuilder.build`）算报告，**同口径同计数**。今日页取 `suspectSets.count` 喂 `dataFindingCount`，>0 出「修数据」卡 → 「去核对」跨 tab 跳进展页数据质量区。进展页可疑组列表超 3 条给「还有 N 条」溢出提示，与卡上总数对账。

Plan：

- 未来几周训练结构。
- 当前 program template/config。
- proposed changes。
- rollbackable plan decisions。
- 基于肌群发展等级的均衡发展建议:补足、维持、减少或暂不判断。
- 从已确认计划派生的计划/动作分享入口。

### 8.1 计划调整（PlanAdjustment · FR-PL3/4 频率提案已实现）

> **实现状态（2026-06-20）：** 路线 B 首个提案 = **频率/依从**已端到端落地（引擎 → 写入口 → 计划页 UI），用户可见。肌群级均衡（FR-PL5）仍**未落地**（依赖未实现的 MLE/贡献权重），后置接进同一框架。本节正文是**目标契约**；进度/证据看 DEV_LOG。

**分层（防混淆，呼应 §6.5.10）。** 「计划调整」是一个统一的**提案 → 预览 → 采纳 → 回滚**框架，提案可来自多个源：

- **频率/依从提案（FR-PL3/4，已实现）**：当用户**持续低于周计划**时，建议把周计划降到更可持续的频率。**纯频率维度**——只读「周计划天数 + 依从历史」，**不读肌群等级**（与今日页频率补量 §6.4a 同源，§6.5.2 红线：无肌群名、无组数）。
- **肌群级均衡提案（FR-PL5，未落地）**：补足/维持/减少某肌群，读 §6.5.10 等级语义；依赖未落地的 MLE，后置零返工接进同一框架。

**频率提案合同（FR-PL3）。**
- **依从信号（纯派生）**：`WeeklyAdherence.recentWeeklySessionCounts(sessionDatesISO:, todayISO:, timeZone:, maxWeeks:)` 把 clean 历史摊平成「最近若干**完整周**每周完成场次」。三条公平红线：① **排除进行中的本周**（半周完成数会低估、误判落后）；② **起点不早于首训周**（开训前的空周是「还没开始」、不计 0）；③ **中间空周计 0**（练过又停正是「持续落后」要捕捉的信号）。周锚点复用 `WeekAnchor.isoWeekStart`（与 §6.4a 按周抑制同源、不分叉）。
- **提案引擎（纯函数、零文案）**：`PlanAdjustmentEngine.frequencyProposal(plannedDaysPerWeek:, recentWeeklySessionCounts:)` → `PlanAdjustmentProposal(kind:.reduceFrequency, reasonCode:"belowPlanSustained", from, to)` 或 nil。**保守守门（起步值，待真机校准）**：planned > 下限 2、数据 ≥ 4 完整周、近况中位数 ≤ planned−1、`to = max(2, 中位数)` 且 to < planned。
- **预览**：用 `PlanWeekProjection.weeks(daysPerWeek: to, weeks:1)` 现算「调整后」的下一块训练日预览答「影响哪几天」（投影按每周场数分块、非日历周，UI 小标即「调整后 / After the change」，2026-07-04 Task 4 措辞修正）；提案前排期就在计划页同屏（2026-07-05 #651 起为折叠形态：分段 dayCode 序列 + 「训练日构成」每类型一次展开，`PlanScheduleDigestBuilder` 纯函数按首现去重、投影语义未动——类型行构成仍同屏可查），故不重复列 before。

**采纳 / 回滚合同（FR-PL3/4）。**
- **采纳**：经唯一写闸 `CanonicalSessionWriter.applyFrequencyAdjustment(from:to:)` 把 `programTemplate.daysPerWeek` 改成 to（= 已有的「程序配置编辑」写类别）**+ 落 open-bag 回滚记录** `planAdjustment{kind, fromDaysPerWeek, toDaysPerWeek}`（记原值供回滚）。**纯加性、不改 schema**（current=11 不变）。
- **回滚（单步即时）**：`rollbackPlanAdjustment()` 读记录里的原值恢复 daysPerWeek、删记录；**无记录幂等**（什么都不做）。
- **单记录无栈**：已有采纳记录时**抑制新提案**（避免二次采纳有损覆盖原始值）；UI 只显示「已调整 · 改回原计划」。
- **诚实红线**：写失败置**计划页专属** `planSaveErrorText`（与全局 `saveErrorText` / 教练 `coachSaveErrorText` **隔离**，防跨面错误污染）、UI 如实呈现，**绝不静默假成功**；文案（RedeL10n `PlanAdjustmentCopy`，§5.4/§7.3）中性、不羞辱、强调可逆，**不报具体观测频率数**（引擎只给 to=目标值、不等于真实频率，报了会虚高）。
- **会话级「暂不」**：`planProposalSnoozed`（不落库）——本次使用期间不再就同一提案复弹；回滚成功亦置位（尊重用户决定、不复推销）；重启后若仍符合条件可再温和提一次。
- **0 卡公理**：计划页调整卡用 `RoundedRectangle` 面（非 `ForgedCard`），守 PlanTabView 0 预算。

### 8.2 用户自定义训练计划（PlanCustomization · FR-PL6/PL7 已实现）

定位 = **「编辑教练给的计划」**（系统先生成 → 用户在此微调），非空白手搭——保「决策在前」：**用户决定练哪个动作 / 什么顺序 / 训练日先后，引擎仍决定多重 / 几次 / 进不进阶 / 今天该不该练**。引擎消费合同见 §8（上方 S2/S3 引擎 seam 段）：默认空覆盖 ≡ 现状（golden 零回归）。本节记 **app/UI/写闸/护栏** 层契约。

**数据与写闸（FR-PL6.2）。** open-bag 顶层 `planCustomization{dayPlans:{dayCode:{exercises:[{exerciseId,sets?,repMin?,repMax?,rest?,crossFamily}]}}, daySequence?:[dayCode]}`（纯加性、缺=nil=完全沿用引擎模板、**不改 schema**）。四个唯一写闸方法 `applyCustomDayPlan / removeCustomDayPlan / applyCustomDaySequence / removeCustomDaySequence`，全过 `performGatedMutation`（load→校验→备份→原子→诚实报错）。**回滚 = remove**（默认模板是确定性纯函数，无需存快照即可重建）；幂等。raw `planCustomization` 经 app/clean 层 catalog 校验（exerciseId 存在/未弃用/可处方/守器械场景）后才构造 `PlanCustomizationInput`（Master §8：raw 不直接进引擎）。

**编辑器 UI（FR-PL6/PL7①）。** 计划页排期行 → `PlanDayEditorView` sheet：动作开放行，每行**上移/下移**（同日重排=FR-PL7①）、**同族换**（`ExerciseReplacementEngine.candidates` 守器械白名单 FR-EQ1）、**移除**；**添加**（`TodayPrescriptionEngine.addCandidates`：该日已有 pattern 族内、未用、守白名单的候选，按 pattern→rank→id；不造新 pattern 槽）。编辑器起点 = `defaultDayExerciseIds`（与 plan() 共用 `slotCandidates` 口径，consistency 测试锁定）。**移除撤销（2026-07-20 owner 实机反馈批）**：`remove` 压栈 `(id, 原 index)` 进纯模型 `PlanDayEditUndoModel`（RedeTrainingDecision，`PlanDayEditModelTests` 锁定）；sheet 内撤销条（影响预览之下、actionRow 之上）「已移除「动作名」· 撤销」——撤销=pop 栈顶还原到 `min(原 index, 当前 count)`，id 已被添加器重新加入则跳过该条继续 pop；栈非空条常驻、逐次还原、栈空条消失；swap（原位替换）不入栈；恢复默认/采纳/取消清栈。条上唯一 ember=「撤销」动作词（复用 `coachUndoLabel`），正文 t3，零图标零小字。**恢复默认常驻+暂存化（同批）**：按钮常驻不随 `wasCustomized` 隐藏（防布局跳动），`exerciseIds == 默认日序` 时 disabled 置灰（显式换色 `redeT4.opacity(0.4)`，redePressable 不自带禁用变暗）；点击只 `exerciseIds = defaultExerciseIds` + 重算影响、**留在 sheet 不落盘不 dismiss**；落盘统一走「采纳修改」，采纳按 `PlanDayEditRules.applyResolution` 收敛——列表==默认 且已自定义 → `removeCustomDayPlan` 清记录（canonical 不留与默认等值的冗余自定义）、列表==默认 且未自定义 → 无操作直接关；`DayEditorContext` 新增 `defaultExerciseIds` 只读字段带回纯模板默认。

**日序编辑器 UI（FR-PL7②）。** 计划页「调整训练日顺序」入口 → `PlanDaySequenceEditorView` sheet：整周训练日**长按拖动重排**（2026-06-24 实机反馈：旧的上移/下移箭头手感笨，改为长按抬起+拖动，半行死区逐槽落位、阴影抬起、拖动手柄示意；VoiceOver 用户无法拖动，等价重排走每行 `accessibilityActions` 的上移/下移自定义动作——边界用 if 条件不用 `.disabled()`）；只重排不增删，保 A/B 分化与肌群 2×/周；起点 = `resolvedDaySequence`（自定义优先否则默认）；实时预览 `nextDayCode`「下一个训练日将变为 X」——**轮转锚定已完成场次（非日历），重排会使下一个训练日跳变，故须诚实预览**（开放决策#1 落地）。`isCustomized` 须 override 合法排列 **且 ≠ 默认序**（否则「恢复默认」会在已是默认时误显示成 no-op 入口）。

**改动预览与护栏（FR-PL6.1）。** `PlanCustomizationImpact.compute` 算采纳前后**肌群每周频率 delta**（按 `primaryMuscle` 统计每肌群出现在几个训练日 = 次/周）→ `droppedBelowTwice`（从 ≥2× 跌到 <2× 的肌群 = 核心护栏，也即 A/B 分化破坏度量）。**诚实限制**：基于 primaryMuscle 单值近似（贡献权重 P0 未落地），是「频率级」护栏非「容量精算」。**护栏 = 中性提示不强制**（采纳按钮始终可点；唯一例外=跨族换需 inline 确认），§5.4/§7.3 不羞辱不施压。

**诚实红线（FR-PL6.2/6.3）。** 写失败置计划页专属 `planSaveErrorText`（与全局/教练错误面隔离）、UI 如实呈现、绝不静默假成功；编辑器影响计算 off-main（不阻塞主线程）。**0 卡公理**：`PlanDayEditorView` / `PlanDaySequenceEditorView` 均 0 `ForgedCard`（全开放行 + 发丝线 + 单一 ember 主操作；门禁预算锁定）。截图验证钩子 `-autoOpenPlanEditor <dayCode>` / `-autoOpenDaySequenceEditor` / `-autoOpenAddPicker`，撤销/恢复批增 `-autoRemoveFirstExercise N` / `-autoUndoRemoval` / `-autoRestoreDefault` / `-autoApplyPlanEdit`（驱动真实 remove/undo/restore/apply 路径；仅带参激活，对正式使用零影响）。**遗留**：真手点连贯交互流程待 TestFlight 真机验收（引擎/写闸/护栏已单测 + 各屏模拟器实测）。

Settings：

- Profile。
- Units。
- Screening。
- HealthKit permissions。
- Data export/backup UI。
- Version / Check for Updates / What's New；更新提示只在安全时机出现，不挡训练。
- Subscription surfaces（Settings 中的 Rede Coach 品牌页始终可进入；生产购买控件保持 fail-closed）。

Account/sync/cloud settings 不进入第一版干净实现,不得做成无能力的 UI placeholder。

### 8.3 订阅与权益合同（2026-07-17 架构门禁）

**产品兼容底线（方案 A）。** Rede 1.8 在 2026-07-17 已经提供的全部能力继续属于 **Free Core**，包括现有的今日判断与理由、训练处方与记录、计划查看/调整/编辑、进展与肌群等级、数据质量提示、本地导出和现有分享卡。不得把 1.8 已有能力重新包装成付费权益，也不需要 grandfather 旧用户。**Paid Coach（用户名：Rede Coach）只能承接以后新增的深度教练能力**；每一项在实现前必须先在 PRD 明确标为 paid，不能由 UI 或工程层自行决定。安全行为、训练与记录、canonical 保存、数据读取/导出、隐私控制永远不设订阅门槛。

已落地的基础 runtime 遵守以下边界：

- 新建薄包 `RedeEntitlements`。纯层只声明 `AccessTier`、`EntitlementState`、`FeatureAccessPolicy` 与 `SubscriptionProviding` 等最小合同；只有包内窄 iOS platform/UI adapters 可 `import StoreKit`。若使用 `SubscriptionStoreView`，由包导出 wrapper 给 app 渲染，app 自身不 import StoreKit。训练引擎、DataHealth、Persistence、Domain、Widget 和 canonical `AppData` 均不得依赖权益。
- StoreKit 已验证的 current entitlement 是唯一付费真相：有效订阅或尚未越过已验证 grace deadline 的 billing grace period → `paidCoach`；退款、撤销、过期或无 current entitlement → `freeCore`；未验证、读取失败或暂不可用 → 立即 `unknown`，不得沿用上一次 paid。`unknown` 必须显示诚实的重试/错误状态，但 Free Core 继续工作，不能因为网络、商品目录或恢复失败挡住训练、保存或导出。
- 权益是派生平台状态，不写 canonical、不进备份/导出、不进 widget、不进引擎，也不自建第二份“已付费”缓存。离线时读取 StoreKit 在设备上可验证的 current entitlements；拿不到已验证结果就保持 `unknown`，不伪造 free/paid。
- App 生命周期持续监听 `Transaction.updates`，并在已验证 expiration/grace deadline 与每次回前台时重新核对。并发查询使用递增版本，只允许最新结果改写 entitlement，防止旧 paid 查询晚到后覆盖退款/撤销。购买成功后先验证交易并刷新本地 access state，再 finish 已验证 transaction；pending 保持等待态，user-cancelled 安静返回，unverified 立即降为 `unknown`。
- “恢复购买”只能由用户在订阅页主动触发 `AppStore.sync()`；不在启动时强制 sync，不把恢复失败解释成用户未购买。设置页同时提供“管理订阅”入口。
- 商品、价格、试用/优惠、续订条款和资格均来自 StoreKit 当前返回值；目录加载失败时不得显示硬编码价格，也不得撤销已从 current entitlements 独立验证出的 Paid Coach 权益。首版同一 subscription group 下提供月订与年订，权益等级相同；具体 product ID、价格、试用与 storefront 配置在实现/发布切片确认。
- **品牌页与购买面分离。** Settings 始终提供“查看 Rede Coach”入口。launch gate 被阻断时进入非交易预览态，只显示品牌名、当前方案和诚实状态；`.paidCapabilityNotReady` 显示“准备中 / 订阅尚未开放”，商品或政策配置异常显示“暂时不可用 / Free Core 仍可使用”。所有 StoreKit 交易相关入口（包括恢复、管理和政策链接）与购买面共用同一 gate；预览态不得显示价值承诺、价格、试用、恢复、管理、购买按钮或任何尚未实现的权益。只有 entitlement 已明确解析为 `freeCore` 且 gate `.ready` 时，同一页面才切换到 Apple StoreKit 购买面；`checking` / `unknown` 即使目录已 ready 也必须停留在核对或重试态，过期 `paidCoach` 的当前方案按 Free Core 展示。页面可见不等于 paywall 可发布。
- 首版优先采用 `RedeEntitlements` 导出的 Apple StoreKit subscription-view wrapper，由 Rede 风格外壳承载，减少自写购买状态；wrapper 必须配置可点击的 Privacy Policy / Terms of Use destinations（适用时使用 StoreKit policy destinations），具体 URL 属于发布配置且上线前验证，不写成架构常量；不得为首片引入账号、Rede server、远程收据、RevenueCat、远程 analytics 或 `appAccountToken`。

**未来 paid 候选，不是已批准功能清单。** 更长周期的教练洞察、新增的自动周行动、新的高级比较、计划适配或计划导入可在后续 PRD 切片中提案；只有真正新增且已验收的能力才能出现在 paywall。当前 1.8 的解释、自动调整、数据质量与肌群等级不能被这句话反向收费。

**实现验收。** 纯 seam/state 单测 + StoreKitTest 必须覆盖成功、取消、pending、验证失败、续订、过期、退款/撤销和恢复；Sandbox/TestFlight 再证明本地化商品、购买/续订、grace period（若配置）、恢复、重装/换设备、离线启动，以及 Privacy Policy / Terms of Use 两个目的地可打开且内容匹配当前产品。Xcode 本地测试不能替代真实 App Store 环境。商品目录不可用与权益 `unknown` 时，1.8 全部 Free Core 回归仍须通过。

**实现状态（2026-07-18）。** 纯合同、fake-provider 状态机、Free Core 不可阻断、商品/政策/paid-capability 四重 launch gate、入口内部二次门禁、已验证交易先投影后 finish、被新查询淘汰的旧 delivery 禁止 finish、重复 delivery 幂等、同 transaction ID 退款/撤销重算、混合 verified/unverified 强制 fail-closed、过期后 status unavailable/unverified 保持 unknown、查询竞态防护、到期/回前台复核、显式 restore、StoreKit 2 adapter/UI wrapper、Settings 双语状态与非交易 Rede Coach 页面壳均已实现。production Info 配置故意为空，因此 app 可进入 Rede Coach 预览页，但只显示当前 Free Core 与准备状态，不显示商品、价格、恢复、管理或购买控件；生产 `Rede` 与本地 `Rede-StoreKitTest` 已拆成两个 shared scheme，避免普通 Run 带入测试商品。包测试与纳入本地/CI 权威门禁的 production fail-closed app XCTest 持续守门。仓库还包含结构化本地 StoreKit v6.3 fixture 和覆盖取消、验证失败、grace 等完整场景的 `SKTestSession` XCTest；但当前 Xcode 26.6 + iOS 26.5 Simulator 在保存配置时返回 `SKInternalErrorDomain Code=3`，商品目录未加载。该失败不豁免，购买/续订/退款链与 Sandbox/TestFlight 仍为 No-Go 门禁。

### 8.4 每周教练复盘（Weekly Coach Review · FR-SUB3）

**用户结果。** Rede Coach 在新周只回答一个问题：上一完整训练周最值得关注的是什么。首屏固定为一个主判断、最多三条可核对依据和一个行动；不是聊天页，不把现有 Progress 图表换壳收费，也不在结论下堆算法说明、置信度标签或免责声明小字。现有 FR-T8 免费周一事实单行保持原样。

**纯决策合同。** `WeeklyCoachReviewEngine` 归 `RedeTrainingDecision`，沿 `CoachActionEngine` 模式保持纯函数、typed output、零文案、零 clock/IO、零 entitlement/StoreKit/import AppData。app 组合层只注入窄事实：`reviewWeekStartISO`、同日去重训练日数、场次数、剔除可疑组后的训练量、近期完整周训练日中位数、截至上周末的关键动作趋势（up/flat/down/calibrating）和上周数据问题数。引擎输出 `verdict + evidence[≤3] + action`；文案全部由 `RedeL10n` 按 reason code 渲染。

**周口径与可信输入。** 只分析 `[上周一, 本周一)`，当前周与未来记录全部排除；跨年、DST 和时区沿 `WeekAnchor` 的 civil-date/ISO Monday 口径。训练日从 clean session 日期去重；训练量、e1RM 和关键动作趋势从排除可疑组后的 `ProgressSnapshot` 重建。吨位可作依据，不能独立推出进步/退步。当前数据没有可追溯的 plan effective-date timeline，故 V1 禁止读取今天的计划评价上一周、禁止输出“完成 X/Y 次计划”；未来若要计划依从必须另走 schema/版本时间线 gate，不能补一个依赖周一开 App 的机会式快照。

**确定性优先级。** 上周数据问题抢占正向判断并行动到核对数据；上周零训练进入中性事实态并回今日；可靠数据不足进入校准/事实态；实际训练日较近期完整周中位数明显减少时只说节奏变化；其余才按关键动作趋势给 progressing/holding/easing。下降不写“退步”，减载、回归或疼痛不被催补量。V1 动作只有 `reviewData`、`openToday`、`viewProgress`，全部为导航且不写 canonical、不改计划。

**派生与权益边界。** V1 每次打开从 canonical 历史重算，不持久化复盘归档、已读状态、周初计划快照或输入摘要，不 bump schema；用户修正历史后结果随真实数据更新。Paid access 与 purchase launch gate 分离：有效 active/grace entitlement 可看复盘，即使商品目录/政策临时不可用；free/checking/unknown/expired/refunded 不得看到付费结论，页面加载期间 entitlement 变化要取消/清空结果。引擎永远不知道用户是否付费。

**验证。** 包测试覆盖零历史/仅本周、上周零场/一场、同日多场去重、长 ISO 日期归一、坏数据优先、up/flat/down、吨位升而主项持平、非法数值 fail-safe、依据数量与稳定顺序（包层是纯 civil-date 日期数学，无时区依赖；跨年周范围由 app-hosted 日期策略测试覆盖——2026-07-20 纠偏，原「跨年与时区」表述与测试归属不符）；app 测试覆盖 active/grace/free/checking/unknown/expired/refunded、已验证 Paid + catalog failure、Free Core 不可阻断、加载竞态、ISO week-year 跨年日期展示和 calibrating 态 0kg 假精度防线。Simulator 必须真走中英文 Rede Coach → 复盘 → 依据 → 行动，并覆盖数据不足/坏数据、Dynamic Type、VoiceOver、Reduce Motion、杀进程重开确定性；调试 fixture 只算本地 L3 UI 证据，StoreKitTest 与 Sandbox/TestFlight 仍是独立收费发布门禁。

**实现状态（2026-07-18）。** `WeeklyCoachReviewEngine`、上一完整周 `WeeklyReviewFactsBuilder`、双语 `RedeL10n` renderer、Rede Coach 页面与 Today/Progress/data-review 导航均已落地。零场固定进入无训练空态；只有一场时无论是否存在历史都只给事实并保持校准，绝不调用进步；训练量只作依据。`RedeDataHealth` 为 dropped session/exercise/set 保留可归周的日期，上一完整周内的 dropped data 与 suspect set 会抢占趋势；任一 dropped training issue 无法定位日期时，页面直接进入不可读态，不静默忽略后输出正向结论。有效 active/grace entitlement 与 purchase launch gate 已解耦，已验证用户在商品/政策不可用时仍可看复盘；checking/unknown 即使目录 ready 也不会露出购买面，过期状态按 Free Core 显示，其他权益态只看诚实的订阅状态页。

本地证据已通过全部包测试、5 条 app policy XCTest、权威 `.claude/quality-gate.cmd`、Release generic iOS Simulator build，以及 iPhone 17 Pro / iOS 26.5 真实点击：中文零训练 → “查看今天安排” → 今日；英文坏数据 → “Review Training Data” → Progress；生产 Free Core 只见准备态且无商品/价格/购买/恢复控件；最大 Dynamic Type 页头与行动可达；Simulator AX tree 可读完整 VoiceOver label/identifier；Reduce Motion 实际开启后复盘 → Progress 仍通过，并已恢复原设置。重复杀进程/重启同一 fixture 保持确定结果。上述只证明本地 L3 功能与 UX，不证明 StoreKit 交易；`SKInternalErrorDomain Code=3`、真实 App Store Connect 商品/政策地址、Sandbox/TestFlight 购买与恢复仍是 production No-Go。

### 8.5 版本与更新感知（App Update Awareness · FR-SE10）

**用户结果。** 已安装旧版且重新打开 Rede 的用户，不需要主动去 App Store 猜有没有更新；Rede 在安全时机发现公开商店版本更高后，于今日页显示一条非阻断更新信号，并在设置中长期提供“版本 / 检查更新 / 本次新增”。已经由系统自动更新的用户，会在首次打开新版本时看到一次随 App 打包的双语 What's New；首次安装不弹，之后可从设置重新查看。

**纯策略与平台边界。** `RedeDomain` 只接收 installed/store version、时间与 loss-tolerant receipt，按整数分段比较 1–3 段营销版本；`1.10 > 1.9`，`1.8 == 1.8.0`。空值、非数字、超过三段、商店版本相同或更旧均为“不提示”。app target 的窄 adapter 只向 Apple 公共 Lookup 目录发送 Rede 的公开 app ID，拒绝所有 3xx 跳转，并同时验证最终 URL、track ID、唯一记录与版本格式；预期 bundle ID 不上送，只在本地核对返回记录，之后只投影公开 marketing version。请求不携带训练、健康、设备标识、账号、凭据或分析事件；远端 release notes 不进 UI，所有可见文案归 `RedeL10n`。

**节流、并发与降级。** 自动检查在首屏可用后异步开始，并在回前台时复核；滚动 24 小时内最多自动请求一次，成功或失败都记为一次 attempt，重叠触发合并为一个 in-flight request。设置里的用户主动检查可越过自动节流，但同一时刻仍复用 in-flight request。自动失败完全静默；主动失败只显示即时“暂时无法检查”，不产生常驻说明。离线、超时、畸形响应、区域无结果全部 fail-open：启动、训练、保存、导出、订阅与任何 Free Core 行为继续工作。

**展示与本地 receipt。** 新版提示按 store version 隔离；“稍后”仅压住该版本七天，更高版本立即重新具备提示资格。今日页更新信号使用开放式刻线，不占 hero 铭牌、不在训练中弹 modal；“查看更新”只由用户动作打开 Rede 固定 App Store 页面，不做强更或 app 内下载。`lastAutomaticAttemptAt`、`snoozedVersion/snoozedUntil`、`lastSeenWhatsNewVersion` 是可丢弃的 namespaced `UserDefaults` UI receipt，不是 canonical AppData，不进写闸、备份、导出、Widget、引擎或订阅。首次安装把当前版本记为已看；升级后只有匹配当前内置 release catalog 时自动展示一次，关闭后记为已看。

**引导线限制。** 1.8 等未内置本能力的既有二进制不能被后续代码隔空唤醒；第一版包含 FR-SE10 的发布包只建立此后的更新链。当前那一批用户仍依靠 App Store 自动更新/系统通知与外部发布沟通。首装判定当前保守复用“仍需 onboarding”：极少数从旧版升级但从未完成 onboarding 的用户也会跳过一次自动 What's New，不过设置入口仍可重看；若未来产品要求严格区分，须增加独立于 canonical 数据的最小安装 receipt，而不能借训练资料猜测。

**验收。** package tests 覆盖版本顺序、非法输入、24h 边界、版本隔离七天 snooze 与更高版本绕过；app tests 用假 client/clock/store 覆盖精确响应身份、duplicate/redirect 拒绝、双向并发合并、自动/手动失败与状态代次、主动绕过自动节流、首次安装、当前发布版本内置文案守卫、升级一次性 What's New，以及 Later 后观察面立即失效，禁止依赖实时网络。iPhone 17 Pro / iOS 26.5 Simulator 已真实点击更新可用 → Later、已最新、主动失败、设置三行、What's New 和中英文流程；最大 Dynamic Type 下三条内容与两个更新动作仍可达，训练态启动未被打断；独立临时 Simulator 的首次安装只显示 onboarding、不弹 What's New。真实点击曾复现“Later 已写 receipt 但提示仍留在屏幕”的观察失效问题，失败测试与最小修复后同一路径确认提示立即消失。所有截图和 launch fixture 只算本地 L3 证据，不替代实时 Apple 目录、App Store 传播或 TestFlight 验收。

**展示收敛（2026-07-20）。** 今日页更新信号从 overline+headline+双动作三层块收敛为页底 receipt 区之后的**单行开放行**「新版本 X.Y · 查看 · 稍后」（caption/callout 级；仅「查看」用 ember2，其余中性——ember 只标训练下一步的唯一豁免动作）。七天稍后语义、两个动作、a11y label（完整「查看更新」）与 identifier 全部保留；低频运维信息不再压在训练判断上方，设置页「版本与更新」常驻入口保证可发现性。

### 8.6 App Store 评分请求（Review Prompt · FR-SE11）

**用户结果。** 用户在刚保存完一次训练——全程最高满意度时刻——可能看到一次系统「给 Rede 评分」弹窗；刚装的新用户绝不会被问，同一版本绝不重复问。弹窗是 Apple 系统面（无自定义文案、无自绘 UI），是否真正展示由系统决定（Apple 另限每 365 天 ≤3 次）。

**纯策略与副作用边界。** 何时该问归 `RedeDomain/ReviewPromptPolicy`（无依赖纯逻辑，`swift test` 9 条锁定）：① 清洗后累计完成场次 ≥3（`minimumCompletedSessions`，初始化钳制 ≥1）；② 每版本最多一次——`lastRequestedVersion != currentVersion` 才有资格，发新版本重新有资格；③ 当前版本读取失败（空串）绝不弹。副作用归 app 壳 `TrainTabView`：完成落盘成功后取值调用 `requestReview`；完成场数复用清洗后 `completedSessionCount`（与 CoachActionEngine 同口径，不另设持久化计数器）；只持久化 `reviewPrompt.lastRequestedVersion`（`UserDefaults`，可丢弃 UI receipt，不进 canonical/导出/引擎）。在请求「之前」即记录本版本已问——系统抑制弹窗也不会同版本重复打扰。

**验收。** 策略层 9 条单测覆盖阈值上下界、每版本一次、旧版本可再问、空版本不弹与初始化钳制；端到端门控（第 3 场从空翻成当前版本号且此后不变）因 app 壳无测试 target，登记为 1.9 提交前手动验收项（TestFlight 验收清单 M1）。

## 9. Share / Growth System

分享系统是 Rede 的商业化增长回路,负责把训练成果、肌群等级、PR、均衡发展和可执行计划转化为用户愿意主动传播的隐私安全资产。它不是第一版社交网络,也不是公开排行榜。第一版干净实现的 S0 边界是本地生成分享卡、调用 iOS Share Sheet、附带通用 App Store / landing link;账号、云端个人页、公开 feed、归因链接、远程模板库和好友关系都属于后续 Master-approved implementation slice。

> **实现状态（2026-07-07 更新，#611 S0 + #671 批次 B5）**：本节为目标契约;已落地 = **训练总结卡 + PR/里程碑卡 + Muscle Level 发展画像卡**三类（入口分别为练完态小结/同预览/Progress Development 块「分享发展画像」;Level Up / Balance Improvement 两卡依赖跨次数据节奏，推后观察真实使用）。隐私过滤（§9.3，SH2）落地方式 = **类型层结构性缺失**：`ShareSnapshot`(RedeLocalSnapshot) 只声明允许字段、禁止字段不存在;精确时长经 `ShareDurationBand` 有损分桶成区间。渲染 = app 层 `ShareCardView`(竖版 4:5) + `ImageRenderer`→UIImage,经 `SharePrivacyFilter` 唯一构造入口;触发 = 训练完成小结「分享」→ 预览 → `UIActivityViewController`(§9.4)。S0 不写 canonical、不联网、无埋点(§9.8 本地事件 deferred,守 FR-DT3)。下载 link = App Store(`ShareLinks.appStoreURL`,上架前回退搜索提示)。

### 9.1 产品目标

分享系统必须同时服务四个目标:

- **用户成就感**: 用户能把一次训练、一次 PR、一次肌群升级或一段连续训练表达成好看、可信、不会尴尬的卡片。
- **产品差异化**: 分享内容必须体现 Rede 的智能训练价值,例如肌群等级、均衡度、计划调整和证据解释,不能只是普通 workout screenshot。
- **低成本获客**: 每张分享卡都要带清晰 Rede 品牌和通用下载/落地页入口,让外部平台流量能回流。
- **隐私可信**: 分享默认不暴露敏感训练事实,用户必须在预览页明确选择要公开的内容。

### 9.2 可分享资产

| 资产 | 触发时机 | 默认内容 | 增长价值 | 隐私默认 |
|---|---|---|---|---|
| Workout Summary Card | 完成训练后 | 训练类型、完成动作数、总组数、训练时长区间、当日亮点 | 高频、低门槛、让用户形成分享习惯 | 隐藏健身房、精确时间、疼痛、notes、RIR 细节 |
| Muscle Level Card ✅#671 | Progress 中肌群等级解锁后（Development 块入口） | 肌群 Lv、趋势、整体级别、均衡度（置信度**不进卡**——结构性缺失,§3.4;「下一步方向」V1 不进卡） | Rede 差异化最高,适合身份表达和复访 | 不显示原始重量和身体数据 |
| Level Up Card | 某肌群升级时 | `Back Lv.8 -> Lv.9`、升级原因摘要、近期训练一致性 | 强成就感,最适合 Story/Reels/短视频封面 | 不显示完整训练记录 |
| PR / e1RM Card | PR 或 e1RM 置信提升时 | 动作、PR/e1RM 摘要、进步幅度、置信度 | 美国力量训练用户容易理解 | 重量默认可见但可隐藏 |
| Balance Improvement Card | 推/拉、上下肢或肌群均衡度改善时 | 均衡度变化、补足方向、计划执行度 | 比单纯晒重量更专业,降低羞辱感 | 不显示低等级羞辱式文案 |
| Plan / Routine Card | 用户确认计划后 | 训练天数、目标、核心动作模式、适合人群 | 能带来导入和转化,是下一阶段增长资产 | 不包含用户历史表现和私人 notes |

### 9.3 ShareSnapshot 合同

`ShareSnapshot` 是分享系统的唯一输入合同。它是派生展示对象,不是 canonical AppData,不得写回真相。

`ShareSnapshot` 只能来自:

- DataHealth clean view。
- `RedeTrainingDecision` 派生的 Progress / Plan projection。
- `MuscleLevelEstimate` / `MuscleDevelopmentProfile` 的只读结果。
- completed session summary 的隐私过滤摘要。
- 用户确认后的 program / plan display projection。

`ShareSnapshot` 必须经过 `SharePrivacyFilter` 后才能渲染。默认允许字段:

- app brand / card type / generated date。
- workout category、动作模式、完成组数、训练时长区间。
- PR/e1RM 摘要和用户选择公开的重量单位。
- 肌群等级、趋势、置信度、均衡度和行动摘要。
- 计划目标、训练天数、动作模式和导入提示。
- 通用下载/落地页 URL。

默认禁止字段:

- 健身房位置、设备品牌/型号的可识别细节、精确训练时间。
- HealthKit 原始数据、体重、疼痛/不适、伤病筛查、私人 notes。
- RIR 明细、失败组细节、被跳过动作的负面原因。
- 用户联系方式、账号标识、设备标识。
- 任何可让外部平台反推出个人健康状态的敏感组合。

S0 分享实现不写 share event 到 canonical AppData。若未来需要本地分享历史、远程归因、referral、公开主页或社交互动,必须新增明确写入类别和 architecture gate。

### 9.4 用户流程

分享动作必须由用户主动触发:

1. 系统在完成训练、Progress 里程碑、肌群升级或计划确认后展示轻量分享入口。
2. 用户进入分享预览页,选择卡片类型、显示/隐藏字段、单位和视觉样式。
3. 系统本地生成图片或可分享 payload。
4. iOS Share Sheet 打开,用户自行选择 Instagram、TikTok、iMessage、WhatsApp、Reddit、Discord、AirDrop 或保存图片。
5. 分享后回到 Rede,系统可提示继续训练、查看计划或邀请朋友;S0 本地实现不承诺真实外部发布成功。

禁止:

- 自动发布。
- 默认公开。
- 在训练中打断 Focus 专注训练。
- 用羞辱、比较、恐吓文案刺激分享。
- 用分享作为访问核心训练记录的强制条件。

### 9.5 渠道策略

第一版优先外部平台传播,不自建社交网络。

| 渠道 | 分享形态 | 产品要求 |
|---|---|---|
| Instagram / TikTok | 竖版卡片、透明 overlay、短标题 | 视觉强、字少、能一眼看出等级/升级/PR。 |
| iMessage / WhatsApp | 图片 + 简短文字 + 下载链接 | 适合朋友/训练搭子转化,不依赖公开传播。 |
| Reddit / Discord | 图片 + 可复制文本摘要 | 适合健身社区,文案必须专业、可解释、避免营销味太重。 |
| AirDrop / Files | 图片或本地计划 payload | 适合线下健身房和朋友之间分享。 |

第一版只有通用下载/落地页 URL。per-user link、referral code、deferred deep link、share attribution、public profile 和 remote import link 都需要账号/云/analytics 架构批准。

### 9.6 分阶段实现

| 阶段 | 能力 | 架构边界 | 验收 |
|---|---|---|---|
| S0 Local Share Cards | 本地生成 Workout / Muscle Level / Level Up / PR / Balance 卡片,用 iOS Share Sheet 分享 | 不联网、不建账号、不写 canonical AppData、不做归因 | 用户完成训练或打开 Progress 后,能预览并分享隐私安全图片。 |
| S1 Importable Plan Payload | 从已确认计划生成脱敏 plan/routine payload,朋友可导入后按自己水平适配 | 只能使用脱敏计划结构;若通过远程链接传播,必须先过 Master gate | 接收者不需要看到原用户历史,也能生成自己的可执行计划。 |
| S2 Referral / Attribution | 分享链接、安装归因、landing conversion、referral reward | 需要 cloud/account/deep link/analytics gate | 能量化 share -> install -> first workout -> paid conversion。 |
| S3 Community Layer | 公开主页、好友、feed、挑战、评论、排行榜 | 需要账号、云同步、审核/举报、隐私和 moderation 体系 | 只有在 S0-S2 证明分享带来有效留存和付费后才进入。 |

### 9.7 商业化规则

- Rede 1.8 已有的训练总结、PR/里程碑和发展画像分享卡属于 Free Core，不得加 paywall；这也保护传播回路。
- 未来新建的更长周期对比卡、全新计划导入适配或视觉模板只可作为 Paid Coach 候选，须先写入 PRD 并真实实现；现有肌群等级解释与必要隐私控制永久免费。
- 分享卡必须保留适度 Rede 品牌和下载入口;付费用户可以减少视觉水印强度,但不应完全切断增长回流。
- 分享系统的成功指标不是分享次数本身,而是外部触达后的 first workout、plan import、D7 retention 和 paid conversion。

### 9.8 指标与观测

S0 本地实现只能记录或估计本地行为;远程归因必须等 analytics / cloud gate。

S0 本地事件语义:

- `share_entry_shown`
- `share_preview_opened`
- `share_card_generated`
- `share_sheet_presented`
- `share_payload_exported`

S0 可用外部估计:

- landing page click 或 App Store product page click 的聚合趋势。
- beta 招募表单里用户自报来源。
- 用户访谈和社区反馈。

S2 以后才允许定义的归因事件:

- `shared_plan_imported`
- `first_workout_from_shared_plan`
- `share_referral_install`
- `share_referral_trial_started`
- `share_referral_paid`

S0 只要求本地可验证分享链路,不得为了归因引入账号、云端个人页、remote referral code 或跨 app tracking。S2 以后才允许把外部安装和付费归因纳入增长仪表盘。

### 9.9 合规与安全

分享系统默认把 Rede 定位在 fitness / training support,不得暗示医疗诊断、治疗或身体缺陷评估。任何使用 HealthKit、体重、疼痛、伤病、恢复或敏感身体数据的分享场景都必须默认关闭,且需要用户逐项选择公开。

不得把 HealthKit 或敏感健康数据用于广告定向、第三方营销或未披露 analytics。分享前必须有清楚预览,用户看见什么,外部平台就只得到什么。

### 9.10 非目标

第一版不做:

- 公开 feed。
- 好友关系和私信。
- 公开排行榜。
- 健身房/地区排名。
- 自动同步到 Strava / Hevy / Apple Fitness。
- 可公开访问的个人主页。
- 按分享次数解锁训练能力。
- 基于外部社交数据改变训练决策。

## 10. 干净重写缺口索引（实现状态）

> **状态图例**:✅ 已实现 · 🟡 部分实现 · ⬜ 未实现。已实现/部分项保留在此仅作回溯映射,完成程度真相以代码 + `CHANGELOG.md`（2026-06-16 MVP 达成记录）为准。**MVP/R0 已上 TestFlight（内部测试，2026-06-16）**——下表 ✅/🟡 即 R0 已交付范围,⬜ 项为 R1/R3 后续（见 PRD §8 发布映射 + Roadmap）。原 MVP 实现计划已按其 §11 收官删除（git 历史可恢复）。

| 缺口 | 实现状态 | 备注 / 剩余下一步 |
|---|---|---|
| 四 tab 商业化 IA | ✅ 已实现（M0-1） | Today / Train / Progress / Plan 已落地,Profile/Settings 为低频 sheet 非底部 tab。 |
| Progress 信息结构 | ✅ 已实现（M4-1/2/3） | 历史 + e1RM/PR 趋势 + 训练量 + 数据质量提示 + 肌群发展等级块（FR-PR6 #670）已 ship;可信度走行为表达（§3.4）无独立高级面。 |
| Focus 训练摩擦 | ✅ 已实现（M3-1/2/3 + M5-3） | 一屏完成训练、下一组建议、休息、跳过/替换/完成原因、刻度轨快改均已 ship。 |
| Exercise catalog | ✅ 已实现（内容 P0 + wave-1~18，目录 165 条） | 目录 JSON 化 + rank 匹配 + 覆盖矩阵 golden 已 ship;`TemplateGenerator`（肌群贡献权重生成）仍未做（FF）。 |
| Equipment 感知 / calibration | 🟡 部分（FR-EQ1 已实现 2026-06-11 + LoadGrid 档位） | 器械场景白名单过滤 + 真实档位已 ship;完整 `GymEquipmentPack`/`MachineProfile`/unknown-machine 校准仍未做。 |
| In-session prescription / warm-up | 🟡 部分（M3-1 + FR-TR10 已实现） | 逐组处方 + next-set recommendation 已 ship;warm-up generator 已 ship（FR-TR10 #566-568：流内临时引导、不落库、保守阶梯起步值待校准，§6.3）;skip-learning（friction/tolerance 偏好学习）仍后置。 |
| Support allocation | ⬜ 未实现 | 先补 planned/completed/skipped/reason/safety lock 和 `SupportAllocationDecision`。 |
| Muscle level estimator | ✅ 已实现（MLE 批次 A #659-666 + 批次 B #667-672 + mle-v2 校准 #675） | 两包引擎（types/estimator/assembler/composer/memory/milestone catalog）+ Development 块（FR-PR6）+ 发展画像分享卡全上线;剩余=FR-PL5 提案式/Level Up 卡/pain-safety 喂数/器械校准维（批次 C 候选）。 |
| Share / growth system | 🟡 部分（S0 #611 + Muscle Level 卡 #671） | 本地 `ShareSnapshot` + `SharePrivacyFilter` + Share Sheet 已 ship（训练总结/PR/发展画像三卡）;Level Up / Balance 卡与 §9.8 本地事件仍后置;无账号无云无 feed（红线不变）。 |
| Backup/export | 🟡 本地导出已实现（2026-07-16 K7）；独立备份未实现 | 设置页可原样导出 canonical JSON；自动/独立备份系统仍需单独 SPEC 与架构切片。 |
| App update awareness | ✅ 本地实现与 Simulator 验收完成（2026-07-18） | Apple 公共版本查询、24h 自动节流、七天按版本稍后、Today 非阻断提示、Settings 三入口与内置 What's New 已落地；无 push、强更、服务器或 analytics。实时 Apple 目录与 TestFlight 仍待发布链验证。 |
| Subscription entitlement | 🟡 企业级基础 runtime 已实现；生产收费 No-Go（2026-07-18） | `RedeEntitlements`、Settings 方案态、StoreKit 2 adapter/UI wrapper、到期/前台复核、查询竞态/混合信任/交易确认保护、显式恢复、入口级 fail-closed launch gate、独立测试 scheme、双语本地月/年 fixture 与 XCTest target 已落地；生产 product IDs / paid capability / 当前 Privacy+Terms 仍为空。25 项 policy/state/config 测试、generic build 与 production fail-closed app test 已进入权威门禁并通过；Xcode 26.6 + iOS 26.5 Simulator 的 `SKTestSession` 保存配置仍报 `SKInternalErrorDomain Code=3`，所以购买/续订/退款全链和 Sandbox/TestFlight 尚未验收，禁止提交收费版本。 |
| Cloud/account/sync | ⬜ 未实现 | 先产出 Master-approved implementation slice,再写 runtime。 |
| watchOS/CRDT | ⬜ 未实现 | 先产出 Master-approved implementation slice,再写 runtime。 |

## 11. 验证

文档 / 规格变更:

```bash
git diff --check
```

干净 rewrite runtime 出现后,按 touched slice 运行最小真实验证。Swift package change:

```bash
cd ios/packages/<PackageName>
swift test
```

全 package 回归（与 `.github/workflows/rede-ci.yml` 的显式包清单保持同步）：

```bash
bash .claude/quality-gate.cmd
```

iOS app build:

```bash
xcodebuild \
  -project ios/Rede.xcodeproj \
  -scheme Rede \
  -destination 'generic/platform=iOS Simulator' \
  build
```

没有 Node/Vite/npm/Vitest 质量门禁。
