# MLE 批次 B 执行 prompt（2026-07-07）

> 交接件：肌群等级引擎（批次 A #659-#666 已全合并）的 app 层接线批次。引擎在 RedeLocalSnapshot、
> 翻译层在 RedeTrainingDecision，全部纯函数已测试锁死；本批次把它接进真实数据、持久化、进度页 UI
> 和分享卡。owner 已授权按推荐自主执行（「开批次 B 吧」）。
> 对应契约切片：§6.5.13 的 MLE-5（Progress 接入）、MLE-7（Share）；MLE-6（Plan/CoachAction 提案式）本批次降维，见拍板③。

## 批次级拍板（写回规格归收口片）

1. **FR-PL5 降维为展示级**：均衡建议 V1 = Development 块的 decision 语义行（`背部 Lv.8 · 正在补足` / `腿部 Lv.15 · 维持即可`，§6.5.11 明列样式）。PlanAdjustmentEngine 提案式增源（预览/采纳/回滚）推批次 C——理由：采纳动作在处方引擎无「肌群偏好」消费点之前是假开关（采纳后什么都不变），违诚实红线。PRD FR-PL5 状态收口时标「部分落地：展示级建议」。
2. **分享卡 V1 仅 Muscle Level 卡**：Level Up 卡（依赖跨次等级对比+confidence≥medium 触发）、Balance Improvement 卡（依赖跨次均衡对比）推后观察真实数据节奏；一次加三种卡=体量异常（宪法 §8）。
3. **e1RM 归主肌群**：`MuscleObservations.e1rmPoints` 只挂动作的 primaryMuscle 归并后的肌群；次肌群只吃 fractional 容量（0.5），不吃性能信号——副贡献动作的 e1RM 不能代表该肌群可比强度。
4. **movementFamiliesTouched = substitutionGroups 主族**：同族变体不算多样性（比 movementPattern 大类更细、比 exerciseId 更粗，最贴「动作族」契约语义）。
5. **持久化落点 = 本地 derived-only JSON**（Application Support/RedeData/muscle-level-memory.json）：复刻 AppGroupWidgetSnapshotStore 教义（atomic、schema 版本化、decode 失败=当无记忆、绝不读写 canonical），但不进 App Group——widget 暂不显示等级（YAGNI）。
6. **e1RM 置信门槛（批次 A 遗留注意事项）**：喂给 MuscleMilestoneCatalog 的 bestE1RmKgByExercise 用 snapshot 的 bestE1RmKg（可疑组已剔、statsRecords 口径）——与 FR-PR7 现行口径完全一致，不额外设卡（同源同信）。

## 现场地图（采证结论，均已核对 file:line）

- **喂数入口**：`ProgressModel.loadOutcome`（ios/Rede/ProgressModel.swift:51）内扩 MLE 装配分支——statsRecords（可疑组已剔）、snapshot.exerciseTrends[].points（现成 e1RM 时序 {sessionId,dateISO,e1RmKg}）、ExerciseCatalog.minimal、cleanView.profile.unitSystem 全在同一作用域。**不另开 canonical 链**。
- **翻译函数**（app 层目前零调用，B1 首接）：`MuscleGroupMapping.group(forCatalogMuscle:)`（RedeTrainingDecision/MuscleGroupMapping.swift:28）、`MuscleContributionTable.contributions(exerciseId:catalog:)`（同包 MuscleContributionTable.swift:18，primary 1.0/secondary 0.5、同桶 max）。
- **聚合→组装**：ContributionRow(dateISO/muscleRaw/weight/setCount) → MuscleVolumeAggregator.weeklyFractionalSets → MuscleObservations(weeklyFractionalSets/sessionsTouched/movementFamiliesTouched/e1rmPoints) → MuscleLevelEstimator.compute（config .v1）→ MuscleProfileAssembler.assemble(computations/observations/previous*/generatedAtIso/config/milestones)。
- **里程碑喂数**：bestByExercise/estByExercise 字典 ProgressModel.swift:103-111 现成；MuscleMilestoneCatalog.achievements(bestActualKgByExercise:bestE1RmKgByExercise:unitSystem:atIso:)。
- **持久化先例**：AppGroupWidgetSnapshotStore.write（RedeLocalSnapshot，atomic+schema guard）+ ReadinessWidgetSnapshotCodec.encode/decode（schema 版本化样板）；写时机样板 SessionStore.refreshWidgetSnapshot（loadToday 后、仅 .ready 才写、失败静默）。
- **UI 封印**：ProgressTabView.swift 头注「Development 肌群等级块（FR-PR6 FF）不上——不给用户看编造数据」——引擎已真，可诚实点亮。
- **L10n 模式**：新建 MuscleLevelCopy.swift（extension RedeStrings 双语 property/func）；跨包枚举（TrainingTier/MuscleDevelopmentDecision/MuscleGroupID）在 RedeL10n 建本地镜像枚举 + app 层映射（ShareDurationBandLabel 样板，ShareCard.swift:94-102）+ parity 测试。
- **分享卡加卡五处**：ShareSnapshot.Content case+struct+SharePrivacyFilter 工厂（RedeLocalSnapshot）→ ShareCardModel.Kind+make+ShareCardView 分支（app）→ ShareCardCopy key 群（RedeL10n）→ ShareCardPreviewView.tabTitle → 入口。
- **跨包红线**：RedeTrainingDecision 不依赖 RedeLocalSnapshot（Master §5）——任何跨包传值走 rawValue 字符串（ContributionRow.muscleRaw 先例）。
- **legacy 区分**：onboarding/设置页自报 trainingLevel 是输入 prior 非系统判定；Development 块上线后文案区分「自报背景」vs「系统评估」，不得出现两套等级打架（§6.5.14 legacy merge 锚）。V1 引擎不读自报 → self-report override blocked 天然满足。

## 切片（每片独立分支独立 PR：失败测试先行 → 全量门禁 → 独立 code-reviewer → auto-merge）

### B1 喂数管线：clean history → MuscleDevelopmentProfile 组合层
新建 `MuscleProfileComposer`（app 目标内纯静态函数，输入全显式、可单测）：
statsRecords + catalog + unitSystem + previous*(B2 前传空) + nowISO → 翻译（contributions × 完成组数 → ContributionRow）→ 聚合 → 观察组装（拍板③④口径）→ compute×肌群 → milestones → assemble → MuscleDevelopmentProfile。
ProgressModel 挂 `muscleProfile` 字段（Development UI 的唯一读点）。
**测试锚**：非空历史→非空聚合完整性断言（批次 A 注意事项①）；已知种子历史的端到端快照（肌群数/等级/校准态确定性）；孤立动作（secondaryMuscles 空）只进主肌群桶；forearm-only 动作如实不进任何桶；输出排序确定性（rawValue，批次 A 注意事项②）。

### B2 previous* 持久化合同（禁写 canonical）
新建 `MuscleLevelMemoryStore`（拍板⑤落点；结构 {schemaVersion, levels:[String:Int], peaks:[String:Int], tierRaw:String?, updatedAtIso}）。
读：loadOutcome 装配前读入 previous*；写：assemble 后有变化才写（levels/peaks/tier 任一变）。
**测试锚**：decode 失败/缺文件=空记忆不崩；peak max 单调跨次生效（种子两轮：升→降，peak 保留）；breakthrough 首解锁不触发、真升级触发；写失败静默不阻断渲染。

### B3 Development 块 UI 解封（FR-PR6 + FR-PL5 展示级）
ProgressTabView 新 Development 区块（0 卡公理：RoundedRectangle 面）：
- 校准态：灰阶行 +「正在校准肌群等级 · 再练 N 场解锁」（§6.5.9 #3）；逐肌群独立解锁（有的亮有的灰）。
- 解锁态：肌群名 + Lv.N + 进度条 + decision 语义行（prioritize=·正在补足 / maintain 强项=·维持即可 / recover=·恢复优先；insufficientData 不出语义行）+ trend 箭头。
- 整体级别行（TrainingTier 中文/英文标签）+ 均衡度（nil 时整行不出，不编数）+ 里程碑徽标（actual 实心/estimated 标「估算」）。
- 轻量解释展开：点肌群行展开 evidence/limitation 人话翻译（为什么是这个等级）。
- **红线**：置信度零 UI 读数（行为表达）；禁止文案清单（§6.5.11：你的背很弱/腿过强不用练/等级低=身材差…）逐条对照；milestoneFloorApplied 时进度条 0 需自然（「刚进入此级」文案）；自报背景在设置页文案改「训练背景（自报）」区分。
- L10n：MuscleLevelCopy.swift + 镜像枚举 + parity 测试。
**验收**：simctl 截图（种子历史法）×4：校准态 zh、解锁态 zh、解锁态 en（显式 -locale en！）、里程碑达成态；Dynamic Type XL 抽验一张。

### B5 分享卡：Muscle Level 卡（V1 仅此一种）
MuscleLevelShareProjection（§6.5.12 struct 照落）+ SharePrivacyFilter.muscleLevel 工厂（结构性缺失红线：禁用字段不存在于类型）+ Content/Kind 加 case + 卡面（复用 ForgedGrain/RegMark/360×450）+ Copy key 群 + 预览分类 + Development 块「分享发展画像」入口。
**测试锚**：share privacy（§6.5.14：projection 无禁用字段）；milestone 徽标 actual/estimated 区分；calibrating 肌群不进卡（只分享已解锁）；分享卡宽度契约测试同 FR-SH1 口径。
**验收**：-autoOpenSharePreview 实拍 zh/en。

### B6 收口
DEV_LOG 战报 + CHANGELOG + 规格写回：PRD FR-PR6 状态、FR-PL5「部分落地：展示级」、FR-SH 新卡登记；系统逻辑 §6.5.10「未落地」措辞清理、§6.5.12 落地状态、§6.5.13 slice 表与实际排片对照更新（批次 A+B 全景）、§9.2 分享卡表 Muscle Level 上线；文案基线新增 key 群登记。模拟器种子数据清理。

## 总控纪律（沿批次 A）
- 开分支前 fetch 且确认依赖 PR 已合并；python patch 必 assert count==1；补丁脚本用绝对路径。
- pathspec 隔离提交（owner 并行会话在跑）；iPhone 17 Pro 被 Larder 占用 → 用 Pro Max（AD365E87）。
- 截 en 必须显式 -locale en；-skipOnboarding 不写 profile（需要 profile 的流程走 -forceOnboarding 或种子）。
- 全量门禁 .claude/quality-gate.cmd；每片独立 code-reviewer；auto-merge 门禁绿+无 MAJOR+纯低风险。
- 三振出局；体量异常先停（B3 UI 片最可能超——发现区块超 ~300 行先停下拆）。
