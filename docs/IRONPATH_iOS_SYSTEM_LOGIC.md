# IronPath iOS — 系统逻辑全景

> **活文档 · 系统逻辑主文档**。本文定义 IronPath 当前 Swift/iOS 代码开发基线。架构边界、source-of-truth、平台权限和禁用系统以 `docs/IRONPATH_MASTER_TECHNICAL_ARCHITECTURE.md` 为最高契约。

## 0. 当前基线

IronPath 是 native iOS SwiftUI app。旧 Web/PWA、Node/Vite、浏览器测试、旧 Supabase/Vercel 实现候选、TypeScript 源和 `IronPathCloudSync` stub 已删除。

iOS 原生账号、云同步、CRDT/watchOS 的已拍板方向保留在 `docs/IRONPATH_REBUILD_00_IRONRULES_AND_CLOUD.md` 与 `docs/CLOUD_DECISIONS_ARCHIVE.md`。这些是未来原生架构输入，不是当前 runtime。

当前代码开发只看：

- `ios/IronPath`
- `ios/IronPathWidget`
- `ios/packages`
- `ios/ParityFixtures`
- living docs

`ios/ParityFixtures` 是 Swift 测试资产，不是生成链路，不授权恢复旧 Web 实现。

## 1. 铁律

1. **核心纯净**：SwiftUI app 层只做渲染与 IO seam 接线；业务逻辑在 Swift packages。
2. **数据必净化**：raw AppData 永不进训练引擎；当前读路径必须先经 DataHealth clean view / clean input。
3. **唯一写闸**：canonical AppData 改动必须经 `CanonicalSessionWriter`，backup → atomic save → honest failure。
4. **单一权威本地源**：当前权威源是本地 JSON AppData；LocalSnapshot、Widget、HealthKit export、UI view model 都不是真相。
5. **Swift-only 当前实现**：当前仓库没有 Web runtime、Node runtime、cloud sync、account auth、remote API、browser storage 或 browser tests。
6. **未来平台需另批**：watchOS、WatchConnectivity、CRDT、remote sync、account/auth、cloud backup、subscription entitlement infrastructure 必须基于已拍板决策另走 Master-approved implementation slice。

## 2. 商业化信息架构

底部 tab 目标只保留高频、能形成训练闭环的页面：

| Tab | 页面使命 | 当前规则 |
|---|---|---|
| 今日 | 告诉用户今天该不该练、练什么、从哪里开始 | 不做 dashboard；只回答今日决策和入口。 |
| 训练 | 只承载专注训练 | 没有完整训练页、训练浏览页或训练 dashboard。 |
| 进展 | 证明训练有没有效果 | 合并历史、PR/e1RM、训练量、日历和数据可信度。 |
| 计划 | 管未来几周怎么练 | 展示周期、周计划、调整建议和可回滚计划决策。 |

Profile / Settings 是低频入口，不占底部 tab。它拥有个人资料、单位、筛查、HealthKit 权限、数据导出/备份和订阅表面。账号或同步控制当前 runtime 不存在，未来实现必须走原生云/账号决策链路。

## 3. 当前 iOS 实况

| 模块 | 当前状态 |
|---|---|
| SwiftUI app | `ios/IronPath`，薄 app 层。 |
| Widget | `ios/IronPathWidget`，只读 readiness widget。 |
| Packages | 11 个 local Swift packages。 |
| AppData | `IronPathDomain.AppData`，本地 JSON 持久化。 |
| Write path | `CanonicalSessionWriter` 统一写闸。 |
| Training | Focus 专注训练为训练中唯一一等页面。 |
| Today | 读 canonical AppData，经 DataHealth 和 TrainingDecision 渲染今日状态。 |
| History/Profile/Plan | 当前仍有 transitional iOS surface，目标会逐步收敛到 Progress / Settings 责任划分。 |
| HealthKit | 体重导入、训练历史导入、native workout export，均在 `IronPathHealthKit` 边界内。 |
| Notifications | 本地 rest timer 和 weekly training reminder。 |
| Test fixtures | `ios/ParityFixtures`，供 Swift package tests 读取。 |

## 4. Package 分工

| Package | 责任 |
|---|---|
| `IronPathDomain` | AppData / domain model / open-bag preserving values。 |
| `IronPathDataHealth` | clean view、repair、runtime guards。 |
| `IronPathTrainingDecision` | readiness、scheduler、progression、coach actions、insights。 |
| `IronPathPersistence` | local JSON store 和 canonical write orchestration。 |
| `IronPathLocalSnapshot` | Focus/history 派生快照；不得触碰 canonical AppData。 |
| `IronPathHealthKit` | 已批准 HealthKit adapters。 |
| `IronPathNotifications` | 本地通知 policy + adapter。 |
| `IronPathWidgetShared` | widget snapshot model + read-only App Group handoff。 |
| `IronPathL10n` | 术语与格式化。 |
| `IronPathBackup` | placeholder；不授权真实备份系统。 |
| `IronPathUIKit` | placeholder；不授权共享 UI framework 迁移。 |

当前没有 active cloud/sync package。任何同步、云、账号或远程服务实现都必须从原生决策文档出发，经 Master-approved implementation slice 落地。

## 5. 写入合同

当前 canonical AppData 写入只允许通过 `CanonicalSessionWriter`。

已批准的用户/外部事实写入类别：

- 完成训练 append。
- HealthKit body weight sample append。
- HealthKit imported workout sample append 到 display-only derived storage。
- Profile scalar edit。
- Unit setting edit。
- Screening list edit。
- Program config scalar edit。
- History set correction。
- Saved-session exercise replacement。
- Coach-action dismiss intent。

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

HealthKit 数据当前用于展示、Progress/data quality 和本地导入/导出边界。若未来要影响 Today/Scheduler 的建议，必须新增 Master-approved engine-input slice。

### 6.1 肌群发展等级模型

IronPath 保留用户可理解、可分享、可用于训练决策的肌群等级系统。等级不是用户手填标签,不是绝对力量排行榜,也不是 LLM 主观判断;等级由 `IronPathTrainingDecision` 内的本地纯函数派生模型估计,服务 Progress、Plan、CoachAction 和 Share / Growth System。

等级系统的工程目标:

- 给用户一个清晰成长符号: 胸部 Lv.10、背部 Lv.8、腿部 Lv.15。
- 把旧的 beginner / intermediate / advanced 训练水平并入同一等级系统,不保留第二套平行判断。
- 把卧推 100kg / 225lb 等公认重量突破纳入等级突破和级别晋升,形成可解释、可分享的 milestone。
- 给训练引擎一个可解释的均衡发展信号: 哪些肌群补足、维持、减少或恢复受限。
- 给分享系统一个强传播资产: level up、均衡度改善、PR/e1RM 置信提升。
- 保持 source-of-truth 纯净: 等级永远可重算,不写回 canonical AppData。

#### 6.1.1 模块边界

等级系统属于 `IronPathTrainingDecision`,不是新 package、不是 persistence 层、不是 app view model 逻辑。

目标文件/符号边界:

| 层 | 目标职责 |
|---|---|
| `IronPathDomain` | 继续承载 canonical AppData、`TrainingSession`、`TrainingSetLog`、`EstimateConfidence` 等基础值。除非未来需要持久化用户目标偏好,否则不新增等级 truth 字段。 |
| `IronPathDataHealth` | 继续生成 `CleanAppDataView` / clean projections,保证 raw AppData 不进等级模型。 |
| `IronPathTrainingDecision` | 新增 `MuscleLevelEstimator`、`MuscleDevelopmentProfileBuilder`、`TrainingTierProjector`、`StrengthMilestoneCatalog`、`MuscleLevelProjection`、`MuscleLevelShareProjection` 等纯派生 API。 |
| SwiftUI app | 只读取 projection 渲染 Progress / Plan / Share Card,不自己计算等级。 |
| Persistence | 不保存等级结果;若保存用户目标偏好,必须走 `CanonicalSessionWriter` 已批准的 profile/program scalar edit 或新增明确写入类别。 |

禁止:

- raw AppData 直接进入等级模型。
- 把 `currentLevel`、`peakLevel`、`levelPoints`、`confidence` 写入 canonical AppData。
- app 层用 UI 状态、分享次数、外部社交反馈反向修改等级。
- 用 HealthKit 原始数据、体重、疼痛/伤病数据直接提高等级。
- 为等级系统引入网络、账号、云、SQLite/CoreData/SwiftData 或第三方 ML runtime。
- 继续维护一套独立于 `MuscleDevelopmentProfile` 的 beginner / intermediate / advanced 训练水平模型。

#### 6.1.2 输入合同

等级模型只接受 clean / typed 输入。目标输入形态:

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

缺少关键输入时必须降级:

- 没有动作肌群贡献表: 只输出 `insufficientCatalog` limitation,不得估计该动作贡献。
- 没有足够历史: 输出 calibration 状态,显示“正在校准”,不得硬给高置信等级。
- 器械未校准: 允许使用 reps/RIR/完成趋势,但负重强度贡献降权。
- 疼痛/不适/技术差: 优先降低训练决策 aggressiveness,不得为了升级继续加量。

#### 6.1.3 输出合同

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
    public let balanceScore: Double
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

#### 6.1.4 等级尺度

用户可见等级采用整数等级:

- V1 使用 `Lv.1...Lv.20` 作为主展示尺度。
- `TrainingTier` 使用 `calibrating / beginner / novicePlus / intermediate / advanced / elite`。产品文案可以显示为“校准中 / 初级 / 进阶初期 / 中级 / 高级 / 精英”,但它必须来自等级系统,不再来自独立的旧 `AutoTrainingLevel`。
- 同一用户身上的不同肌群可以并排显示,但解释必须写清: 这是“个人肌群发展画像”,不是跨人、跨性别、跨体重、跨器械的绝对排名。
- 高级用户达到上限后,后续可通过 tier / prestige 扩展,但不得在 V1 先做复杂体系。

内部计算使用 `levelPoints` / `developmentScore`:

- `developmentScore`: `0...100` 的模型分数,不直接暴露给普通用户。
- `currentLevel`: 由 `developmentScore` 经每肌群校准阈值映射。
- `levelProgress`: 当前分数到下一等级阈值的比例。
- `peakLevel`: 由历史已确认 `currentLevel` 派生;没有持久化前可在 projection 内从历史窗口重算,未来若要做长期成就账本必须先定义独立写入合同。
- `overallTier`: 由多个肌群等级、训练一致性、关键动作 milestone、balanceScore、confidence 和 safety limitation 推导;不能由用户 profile 的 trainingLevel 直接决定。

等级降级规则:

- 单次训练差、单周少练、一次跳过,不得直接降级。
- 连续 detraining、训练覆盖长期缺失、恢复/疼痛长期限制,可以让 `currentLevel` 下降或进入 `declining` / `detraining`。
- `peakLevel` 不随下降而消失,用于保护用户成就感和分享资产。

旧训练水平模型合并规则:

- 现有 `TrainingLevelEngine.AutoTrainingLevel` / `TrainingLevelAssessment` 不再作为独立产品模型演进。实现时应迁移为 `TrainingTierProjector` 或 compatibility adapter,其输出写入 `MuscleDevelopmentProfile.overallTier`。
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

#### 6.1.5 公认重量里程碑与级别突破

重量 milestone 是等级系统的一等输入和分享资产,但不是万能强度标准。V1 里程碑只作为 product milestone / cultural milestone,用于“突破某级、进入某级别”的可解释事件;它不能替代完整肌群发展画像。

`StrengthMilestoneCatalog` 必须满足:

- 目录集中定义在 `IronPathTrainingDecision`,带 `modelVersion`。
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
- milestone 不替代体重相对强度。V1 不做复杂体重/性别/年龄排名;未来如引入相对强度或 public benchmark,必须是 optional reference,并写清隐私与公平性边界。

#### 6.1.6 计算 pipeline

`MuscleLevelEstimator` 的标准 pipeline:

1. **Build clean set events**: 从 clean history 展平 completed sets,解析 exercise identity、actual exercise、weight/reps/RIR、technique、pain、time。
2. **Attach exercise contribution**: 通过 `ExerciseCatalogSnapshot` 给每个 set 绑定 muscle contribution weights。
3. **Normalize load evidence**: 对 free weight、plate-loaded machine、selectorized machine 使用不同置信策略;未校准机器不参与跨器械强度比较,只参与本器械趋势。
4. **Detect strength milestones**: 从 actual completed set 和 high-confidence e1RM 中识别 `StrengthMilestoneAchievement`,区分真实完成和估算突破。
5. **Compute muscle exposure**: 按 muscle contribution 汇总 effective sets、weekly frequency、recent coverage、movement pattern coverage。
6. **Compute performance signal**: 复用 `E1RMEngine` 的 e1RM 概念,按动作族和肌群汇总可比强度趋势;RIR 缺失或技术差时降权。
7. **Compute progression signal**: 计算同肌群/同动作族在 recent window 和 baseline window 的趋势,避免只看单次 PR。
8. **Compute recovery/safety adjustment**: 疼痛、poor technique、support safety lock、长期跳过纠偏/功能性动作会降低 aggressiveness。
9. **Apply user goal weights**: 默认 balanced;用户选择专项目标时只调整目标 gap,不改事实分数。
10. **Apply milestone floors**: 对相关肌群 / movement family 应用 milestone level floor 和 tier candidate,但受 confidence、balance 和 safety 限制。
11. **Map score to level**: 每肌群独立阈值映射为 `currentLevel`、`levelProgress` 和 `trend`。
12. **Project overall tier**: 用 `TrainingTierProjector` 生成 `overallTier`,替代旧 `AutoTrainingLevel` 独立模型。
13. **Build decision semantics**: 输出 prioritize / maintain / reduce / recover / insufficientData。
14. **Build explanation**: 生成 evidence / limitation / user-facing summary,供 Progress、Plan、CoachAction、Share Card 使用。

初始窗口建议:

- `recentWindow`: 最近 6 周,用于趋势和当前计划建议。
- `baselineWindow`: 最近 24 周,用于个人基线和等级稳定性。
- `minimumCalibration`: 至少 3 次相关训练或 8 个有效工作组才允许显示 low-confidence level。
- `mediumConfidence`: 至少 6 次相关训练、18 个有效工作组、覆盖 2 个动作族。
- `highConfidence`: 至少 12 次相关训练、36 个有效工作组、覆盖 2 个以上动作族且关键动作 identity 稳定。

这些阈值是 V1 模型常量,必须集中定义、带 `modelVersion`,并由 fixtures 覆盖;不得散落在 UI 或多个 engine 文件里。

#### 6.1.7 分数构成

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

#### 6.1.8 个体校准

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

#### 6.1.9 冷启动和低数据状态

新用户不能被迫回答大量问题。等级系统冷启动策略:

1. 默认 balanced development。
2. Onboarding 最多只问训练目标和训练背景;训练背景只成为 `selfReportedTrainingBackground`,不再成为独立 training-level 真相。
3. 前 2-4 次训练以校准为主,展示“正在校准肌群等级”。
4. 有低置信结果时可显示等级,但必须带 confidence 和 limitation。
5. Progress 可以显示“数据还少,先用接下来几次训练提高判断准确度”。
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

#### 6.1.10 决策接入

等级模型的输出进入决策系统时必须经过语义层:

| 消费方 | 读取内容 | 不允许 |
|---|---|---|
| Progress | `currentLevel`、`peakLevel`、trend、confidence、evidence、limitations、balanceScore | 展示原始敏感数据或羞辱式弱项文案。 |
| PlanAdjustment | `decision`、priorityMuscleIds、recoverMuscleIds、goal gap | 只因 level 低就机械加训练量。 |
| Scheduler | 肌群优先级、恢复限制、覆盖缺口 | 忽略 safety lock 或 recovery signal。 |
| CoachAction | 可执行建议和解释,例如“本周多补 2-4 组水平拉” | 生成无法执行、不可回滚或强迫用户的建议。 |
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

#### 6.1.11 UI 和文案边界

用户可见表达:

- “胸部 Lv.10”
- “背部 Lv.8 · 正在补足”
- “腿部 Lv.15 · 维持即可”
- “整体级别: 中级”
- “卧推 100kg 突破 · 水平推进入 Lv.10”
- “整体均衡度 76”
- “本月背部升级 Lv.8 -> Lv.9”

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

#### 6.1.12 与分享系统的连接

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

#### 6.1.13 工程实现顺序

等级系统必须小步实现:

| Slice | 内容 | 验收 |
|---|---|---|
| MLE-0 Contract | 本节工程合同、测试计划、fixtures 目录约定 | 文档通过 diff check,不改 runtime。 |
| MLE-1 Types + Pure Estimator | 在 `IronPathTrainingDecision` 新增 public types、`MuscleLevelEstimator`、`MuscleLevelModelConfig`、`TrainingTier` | `swift test` 覆盖空历史、低/中/高置信、无 NaN、确定性输出。 |
| MLE-2 Legacy TrainingLevel Merge | 将旧 `TrainingLevelEngine.AutoTrainingLevel` 迁为 `TrainingTierProjector` / compatibility adapter | 不再有第二套用户可见 training level;旧消费者改读 semantic capability。 |
| MLE-3 Exercise Contribution Snapshot | 将动作库肌群贡献、movement pattern、equipment tags 接成 typed snapshot | 缺贡献时输出 limitation,不猜测。 |
| MLE-4 Strength Milestone Catalog | 新增 `StrengthMilestoneCatalog`,覆盖卧推 100kg / 225lb 等 milestone | actual/e1RM 区分,机器不得冒充杠铃 milestone。 |
| MLE-5 Progress Projection | Progress read path 接入等级、整体级别、milestone、趋势、置信度、证据 | UI 只读,不写 AppData。 |
| MLE-6 Plan / CoachAction Integration | PlanAdjustment / CoachAction 读取 decision semantics | Safety/recovery 覆盖等级补足,用户拒绝可回滚。 |
| MLE-7 Share Projection | 生成 `MuscleLevelShareProjection`,接 `ShareSnapshot` | 分享 projection 不含禁用字段,milestone 标明 actual/estimated。 |
| MLE-8 Calibration Refinement | beta 数据后调整模型权重和阈值 | 递增 `modelVersion`,更新 goldens 和 changelog。 |

#### 6.1.14 测试要求

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

验证命令:

```bash
cd ios/packages/IronPathTrainingDecision
swift test
```

若等级模型影响 `PlanAdjustment`、`CoachAction` 或 app UI,还必须跑全 package 测试和 iOS build。

LLM 可用于解释、总结和生成自然语言提醒;不得由 LLM 单独判定肌群等级。等级估计必须能由本地可审计模型复算。

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

Plan：

- 未来几周训练结构。
- 当前 program template/config。
- proposed changes。
- rollbackable plan decisions。
- 基于肌群发展等级的均衡发展建议:补足、维持、减少或暂不判断。
- 从已确认计划派生的计划/动作分享入口。

Settings：

- Profile。
- Units。
- Screening。
- HealthKit permissions。
- Data export/backup UI。
- Subscription surfaces。

Account/sync/cloud settings 当前 runtime 不存在，不得做成无能力的 UI placeholder。

## 9. Share / Growth System

分享系统是 IronPath 的商业化增长回路,负责把训练成果、肌群等级、PR、均衡发展和可执行计划转化为用户愿意主动传播的隐私安全资产。它不是第一版社交网络,也不是公开排行榜。当前 runtime 的可实现边界是本地生成分享卡、调用 iOS Share Sheet、附带通用 App Store / landing link;账号、云端个人页、公开 feed、归因链接、远程模板库和好友关系都属于后续 Master-approved implementation slice。

### 9.1 产品目标

分享系统必须同时服务四个目标:

- **用户成就感**: 用户能把一次训练、一次 PR、一次肌群升级或一段连续训练表达成好看、可信、不会尴尬的卡片。
- **产品差异化**: 分享内容必须体现 IronPath 的智能训练价值,例如肌群等级、均衡度、计划调整和证据解释,不能只是普通 workout screenshot。
- **低成本获客**: 每张分享卡都要带清晰 IronPath 品牌和通用下载/落地页入口,让外部平台流量能回流。
- **隐私可信**: 分享默认不暴露敏感训练事实,用户必须在预览页明确选择要公开的内容。

### 9.2 可分享资产

| 资产 | 触发时机 | 默认内容 | 增长价值 | 隐私默认 |
|---|---|---|---|---|
| Workout Summary Card | 完成训练后 | 训练类型、完成动作数、总组数、训练时长区间、当日亮点 | 高频、低门槛、让用户形成分享习惯 | 隐藏健身房、精确时间、疼痛、notes、RIR 细节 |
| Muscle Level Card | Progress 中肌群等级稳定后 | 肌群 Lv、趋势、置信度、均衡度、下一步方向 | IronPath 差异化最高,适合身份表达和复访 | 不显示原始重量和身体数据 |
| Level Up Card | 某肌群升级时 | `Back Lv.8 -> Lv.9`、升级原因摘要、近期训练一致性 | 强成就感,最适合 Story/Reels/短视频封面 | 不显示完整训练记录 |
| PR / e1RM Card | PR 或 e1RM 置信提升时 | 动作、PR/e1RM 摘要、进步幅度、置信度 | 美国力量训练用户容易理解 | 重量默认可见但可隐藏 |
| Balance Improvement Card | 推/拉、上下肢或肌群均衡度改善时 | 均衡度变化、补足方向、计划执行度 | 比单纯晒重量更专业,降低羞辱感 | 不显示低等级羞辱式文案 |
| Plan / Routine Card | 用户确认计划后 | 训练天数、目标、核心动作模式、适合人群 | 能带来导入和转化,是下一阶段增长资产 | 不包含用户历史表现和私人 notes |

### 9.3 ShareSnapshot 合同

`ShareSnapshot` 是分享系统的唯一输入合同。它是派生展示对象,不是 canonical AppData,不得写回真相。

`ShareSnapshot` 只能来自:

- DataHealth clean view。
- `IronPathTrainingDecision` 派生的 Progress / Plan projection。
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

当前 MVP 不写 share event 到 canonical AppData。若未来需要本地分享历史、远程归因、referral、公开主页或社交互动,必须新增明确写入类别和 architecture gate。

### 9.4 用户流程

分享动作必须由用户主动触发:

1. 系统在完成训练、Progress 里程碑、肌群升级或计划确认后展示轻量分享入口。
2. 用户进入分享预览页,选择卡片类型、显示/隐藏字段、单位和视觉样式。
3. 系统本地生成图片或可分享 payload。
4. iOS Share Sheet 打开,用户自行选择 Instagram、TikTok、iMessage、WhatsApp、Reddit、Discord、AirDrop 或保存图片。
5. 分享后回到 IronPath,系统可提示继续训练、查看计划或邀请朋友;当前 runtime 不承诺真实外部发布成功。

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

当前只有通用下载/落地页 URL。per-user link、referral code、deferred deep link、share attribution、public profile 和 remote import link 都需要账号/云/analytics 架构批准。

### 9.6 分阶段实现

| 阶段 | 能力 | 架构边界 | 验收 |
|---|---|---|---|
| S0 Local Share Cards | 本地生成 Workout / Muscle Level / Level Up / PR / Balance 卡片,用 iOS Share Sheet 分享 | 不联网、不建账号、不写 canonical AppData、不做归因 | 用户完成训练或打开 Progress 后,能预览并分享隐私安全图片。 |
| S1 Importable Plan Payload | 从已确认计划生成脱敏 plan/routine payload,朋友可导入后按自己水平适配 | 只能使用脱敏计划结构;若通过远程链接传播,必须先过 Master gate | 接收者不需要看到原用户历史,也能生成自己的可执行计划。 |
| S2 Referral / Attribution | 分享链接、安装归因、landing conversion、referral reward | 需要 cloud/account/deep link/analytics gate | 能量化 share -> install -> first workout -> paid conversion。 |
| S3 Community Layer | 公开主页、好友、feed、挑战、评论、排行榜 | 需要账号、云同步、审核/举报、隐私和 moderation 体系 | 只有在 S0-S2 证明分享带来有效留存和付费后才进入。 |

### 9.7 商业化规则

- 基础分享卡不应重度 paywall,否则会压低传播。免费用户也应能分享带 IronPath 品牌的核心训练/PR/等级卡。
- 付费权益可以包含更深的历史对比、长期趋势卡、高级肌群等级解释、计划导入适配和更丰富视觉样式,但不能移除必要隐私控制。
- 分享卡必须保留适度 IronPath 品牌和下载入口;付费用户可以减少视觉水印强度,但不应完全切断增长回流。
- 分享系统的成功指标不是分享次数本身,而是外部触达后的 first workout、plan import、D7 retention 和 paid conversion。

### 9.8 指标与观测

当前本地 MVP 只能记录或估计本地行为;远程归因必须等 analytics / cloud gate。

应定义的事件语义:

- `share_entry_shown`
- `share_preview_opened`
- `share_card_generated`
- `share_sheet_presented`
- `share_payload_exported`
- `shared_plan_imported`
- `first_workout_from_shared_plan`
- `share_referral_install`
- `share_referral_trial_started`
- `share_referral_paid`

S0 只要求本地可验证分享链路。S2 以后才允许把外部安装和付费归因纳入增长仪表盘。

### 9.9 合规与安全

分享系统默认把 IronPath 定位在 fitness / training support,不得暗示医疗诊断、治疗或身体缺陷评估。任何使用 HealthKit、体重、疼痛、伤病、恢复或敏感身体数据的分享场景都必须默认关闭,且需要用户逐项选择公开。

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

## 10. 当前缺口索引

| 缺口 | 当前状态 | 下一步 |
|---|---|---|
| 四 tab 商业化 IA | 当前仍有 transitional History/Profile naming | 用小切片迁移，不改 source-of-truth。 |
| Progress 信息结构 | 历史/进展/数据质量仍需收敛 | 先做 read-only projection，再做 UI。 |
| Focus 训练摩擦 | 已有 Focus shell 和 set logging | 继续围绕一屏完成训练优化。 |
| Support allocation | 尚未成为完整 native typed facts | 先补 planned/completed/skipped/reason/safety lock 等事实。 |
| Equipment calibration | 尚未 typed | 先做 gym equipment pack / machine profile / load calibration fact model。 |
| Muscle level estimator | 产品逻辑和工程合同已定义,旧训练水平模型已并入目标等级系统,尚未成为 native typed derived model | 先按 MLE-1/MLE-2/MLE-4 做 `MuscleLevelEstimator`、`TrainingTierProjector` 和 `StrengthMilestoneCatalog`,再接 Progress / Plan / CoachAction / ShareProjection。 |
| Share / growth system | 产品逻辑已定义,尚未成为 native share snapshot / card renderer | 先做本地 `ShareSnapshot` + `SharePrivacyFilter` + iOS Share Sheet,不得引入账号、云或 feed。 |
| Backup/export | `IronPathBackup` 仍是 placeholder | 先做本地导出/备份 SPEC，再 amend architecture。 |
| Cloud/account/sync | 当前代码中不存在；未来方向已在决策文档中保留 | 先产出 Master-approved implementation slice，再写 runtime。 |
| watchOS/CRDT | 当前代码中不存在；未来方向已在决策文档中保留 | 先产出 Master-approved implementation slice，再写 runtime。 |

## 11. 验证

Swift package change:

```bash
cd ios/packages/<PackageName>
swift test
```

全 package 回归：

```bash
for package in ios/packages/*; do
  if [ -f "$package/Package.swift" ]; then
    (cd "$package" && swift test) || exit 1
  fi
done
```

iOS app build:

```bash
xcodebuild \
  -project ios/IronPath.xcodeproj \
  -scheme IronPath \
  -destination 'generic/platform=iOS Simulator' \
  build
```

没有 Node/Vite/npm/Vitest 质量门禁。
