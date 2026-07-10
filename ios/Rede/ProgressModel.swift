import Foundation
import RedeDataHealth
import RedeDomain
import RedeHealthKit
import RedeLocalSnapshot
import RedePersistence
import RedeTrainingDecision

// ProgressModel — 进展页组合层（M4-3）：读 canonical → DataHealth 投影 →
// clean view 映射为快照输入 → ProgressSnapshot + DataQualityReport。
// 全部判断在包内（投影/趋势/周对比/质量规则），app 层只接线渲染。
// Master 合同：RedeLocalSnapshot 与 RedeDomain 解耦——映射就发生在这里。

/// 数据质量报告的**单一组装真源**：从动作目录投影合理上限（起步值×6、下限 60、全局 400 兜底），
/// 再交 DataQualityReportBuilder。今日页「修数据」教练卡（FR-T5）与进展页数据质量区**同口径同计数**
/// 都走这里——绝不各算各的、避免卡说 N 条而进展页显示 M 条。
enum DataQualityComposer {
    static func report(cleanView: CleanAppDataView, catalog: ExerciseCatalog = .minimal) -> DataQualityReport {
        var ceilings: [String: Double] = [:]
        for entry in catalog.entries {
            ceilings[entry.id] = max(60, entry.startWeightKg * 6) // 待校准启发值，留痕 2026-06-11
        }
        return DataQualityReportBuilder.build(view: cleanView, plausibleCeilingByExercise: ceilings)
    }
}

struct ProgressModel {
    enum LoadOutcome {
        case ready(ProgressModel)
        case unreadable
    }

    let snapshot: ProgressSnapshot
    let quality: DataQualityReport
    /// 未过滤原貌（FR-PR1 明细 sheet 用——用户记了什么就显示什么）。
    let records: [SnapshotSessionRecord]
    /// 剔除可疑组的统计口径（柱图等展示组装用，与 snapshot 同源）。
    let statsRecords: [SnapshotSessionRecord]
    /// 判断先行素材（M1 红线：判断在包内算好，视图只读字段）。
    let keyTrend: ProgressSnapshot.ExerciseTrend?
    let trendAssessment: TrendAssessment?
    let weeklyComparison: WeeklyComparison?
    /// FR-PR5 当月训练连续性月历（中性呈现；history 非空时必有，否则 nil）。
    let continuity: ContinuityCalendar.Month?
    /// FR-PR7 力量里程碑（杠铃大项配片阈值）：实测 isEstimated=false；估算更高档时追加 isEstimated=true。
    let milestones: [StrengthMilestone]
    /// MLE 肌群发展画像（B1 接线；Development 块唯一读点）。全部计算在包内
    /// MuscleProfileComposer（已测），此处只做目录翻译薄胶水。previous* 记忆接线=B2。
    let muscleProfile: MuscleDevelopmentProfile
    /// 子肌群等级（钻取层 2026-07-09；详情页读——back/shoulders 有值，其余空）。
    let subLevelsByMuscle: [RedeLocalSnapshot.MuscleGroupID: [MuscleSubLevel]]

    static func loadOutcomeAsync(now: Date = Date()) async -> LoadOutcome? {
        // 批次 D：HealthKit 体重静默读（async 边界在此；未授权/无数据返回 nil 不弹框），
        // 取好值喂同步组装——组装层保持免并发可测。
        let healthKitWeightKg = await HKBodyWeightReader().latestBodyWeight()?.kg
        return await Task.detached(priority: .userInitiated) {
            loadOutcome(now: now, healthKitWeightKg: healthKitWeightKg)
        }.value
    }

    /// MLE 记忆落点（B2）：canonical 同目录的 derived-only JSON（不进 App Group——
    /// widget 暂不显示等级；禁写 canonical 红线由类型隔离保证：store 只认 MuscleLevelMemory）。
    static func muscleLevelMemoryFileURL() -> URL {
        TodayModel.canonicalFileURL().deletingLastPathComponent()
            .appendingPathComponent("muscle-level-memory.json")
    }

    static func loadOutcome(now: Date = Date(), healthKitWeightKg: Double? = nil) -> LoadOutcome? {
        let store = JSONFileAppDataStore(fileURL: TodayModel.canonicalFileURL())
        let appData: AppData
        do {
            if let existing = try store.load() {
                appData = existing
            } else if let empty = try? AppData(decoding: .object(["schemaVersion": .int(Int64(SchemaVersion.current))])) {
                appData = empty
            } else {
                return nil
            }
        } catch {
            return .unreadable // 同 TodayModel 三态口径：绝不当新用户渲染
        }

        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        // §6.2 目录只读投影：吨位系数/复合标记进统计层；合理上限进可疑组判定
        let catalog = ExerciseCatalog.minimal
        var facts: [String: ExerciseStatsFacts] = [:]
        for entry in catalog.entries {
            facts[entry.id] = ExerciseStatsFacts(
                loadFactor: entry.loadFactor, isCompound: entry.kind == "compound",
                isAssisted: entry.loadType == "assisted"
            )
        }
        // 数据质量报告走单一组装真源（与今日页修数据卡同口径），见 DataQualityComposer。
        let quality = DataQualityComposer.report(cleanView: cleanView, catalog: catalog)
        // 可疑组不进统计（趋势/PR/判断句）——可信度的行为表达（§3.4：判断更保守），
        // 数据区仍如实列出（FR-PR4 标记不隐藏）。canonical 原样不动。
        let records = mapToRecords(cleanView)
        let statsRecords = mapToRecords(cleanView, excluding: quality.suspectSets)
        let snapshot = ProgressSnapshotBuilder.build(sessions: statsRecords, facts: facts)
        let keyTrend = TrendInsight.keyExercise(of: snapshot, facts: facts)
        // FR-PR5 连续性月历：训练日 = 有 session 的本地日（含被质量标记的场——那天确实练了，
        // 故用未过滤 records 而非 statsRecords）；当月网格在包内纯算（civil-days，无时区坑）。
        let dayFormatter = DateFormatter()
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.timeZone = .current
        dayFormatter.dateFormat = "yyyy-MM-dd"
        let todayISO = dayFormatter.string(from: now)
        let trainedDates = Set(records.map { String($0.dateISO.prefix(10)) })
        let continuity = ContinuityCalendar.month(containing: todayISO, todayISO: todayISO, trainedDatesISO: trainedDates)
        // FR-PR7 力量里程碑：公认大项实测最佳顶组跨过的配片阈值。eligible = 具体 id 白名单（不按
        // pattern 宽匹配，避免窄距卧推/臀推/早安/前蹲等稀释成就感，审查 m-1）；与目录交集且排
        // deprecated（审查 M-1，防日后下线动作仍触发）。扩里程碑动作走此清单——校准项。本包与目录
        // 解耦，故 eligible 在 app 层注入。实测用 snapshot 的 bestWeightKg；估算用 bestE1RmKg（FR-PR7 收尾，明确标注）。
        let milestoneLiftIds: Set<String> = ["bench-press", "squat", "deadlift", "overhead-press"]
        let milestoneEligible = Set(
            catalog.entries
                .filter { milestoneLiftIds.contains($0.id) && !$0.deprecated }
                .map(\.id)
        )
        let bestByExercise = Dictionary(
            snapshot.exerciseTrends.map { ($0.exerciseId, $0.bestWeightKg) },
            uniquingKeysWith: { first, _ in first }  // trends 已按 id 去重；防御重复 key 不崩
        )
        // FR-PR7 收尾：估算里程碑用 bestE1RmKg（估算峰值）；可疑组已排除（statsRecords），不被坏数据带偏。
        let estByExercise = Dictionary(
            snapshot.exerciseTrends.map { ($0.exerciseId, $0.bestE1RmKg) },
            uniquingKeysWith: { first, _ in first }
        )
        let milestones = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: bestByExercise,
            estimatedE1RmKgByExercise: estByExercise,
            eligibleExerciseIds: milestoneEligible,
            unitSystem: cleanView.profile.unitSystem
        )
        // MLE 喂数胶水（B1）：目录翻译是唯一不可单测面，刻意最薄——逐动作调
        // RedeTrainingDecision 翻译函数拼 rawValue 行类型，跨包不传枚举（Master §5）；
        // 聚合/计分/组装全在 RedeLocalSnapshot.MuscleProfileComposer（包内已测）。
        // statsRecords 口径（可疑组已剔）与 FR-PR7 里程碑同源同信（交接件拍板⑥）。
        var contributionRows: [MuscleVolumeAggregator.ContributionRow] = []
        var touchRows: [MuscleTouchRow] = []
        for record in statsRecords {
            for exercise in record.exercises {
                let doneSets = exercise.sets.count
                guard doneSets > 0 else { continue }
                let family = catalog.entry(id: exercise.exerciseId)?.substitutionGroup ?? exercise.exerciseId
                for contribution in MuscleContributionTable.contributions(
                    exerciseId: exercise.exerciseId, catalog: catalog) {
                    contributionRows.append(MuscleVolumeAggregator.ContributionRow(
                        dateISO: record.dateISO, muscleRaw: contribution.muscle.rawValue,
                        weight: contribution.weight, setCount: doneSets))
                    touchRows.append(MuscleTouchRow(
                        muscleRaw: contribution.muscle.rawValue, sessionId: record.id, familyId: family))
                }
            }
        }
        // 子肌群钻取（2026-07-09）：归并前的细粒度行（entry 原始 primary/secondary 值，
        // 同 1.0/0.5 权重）——10 块层的归并是主动选择，子层按原始粒度直接聚合。
        var fineRows: [MuscleVolumeAggregator.ContributionRow] = []
        for record in statsRecords {
            for exercise in record.exercises {
                let doneSets = exercise.sets.count
                guard doneSets > 0, let entry = catalog.entry(id: exercise.exerciseId) else { continue }
                fineRows.append(MuscleVolumeAggregator.ContributionRow(
                    dateISO: record.dateISO, muscleRaw: entry.primaryMuscle,
                    weight: 1.0, setCount: doneSets))
                for secondary in entry.secondaryMuscles {
                    fineRows.append(MuscleVolumeAggregator.ContributionRow(
                        dateISO: record.dateISO, muscleRaw: secondary,
                        weight: 0.5, setCount: doneSets))
                }
            }
        }
        // e1RM 只挂主肌群（拍板③：副贡献动作的 e1RM 不代表该肌群可比强度）
        var e1rmRows: [MuscleE1RMRow] = []
        for trend in snapshot.exerciseTrends {
            guard let group = MuscleGroupMapping.primaryGroup(
                forExerciseId: trend.exerciseId, catalog: catalog) else { continue }
            for point in trend.points {
                e1rmRows.append(MuscleE1RMRow(
                    muscleRaw: group.rawValue, dateISO: point.dateISO, e1RmKg: point.e1RmKg))
            }
        }
        // MLE 跨次记忆（B2）：peak 只升不降 / breakthrough 对比 / previousTier 的持久侧。
        // derived-only（canonical 同目录、非 gated、坏文件=如实从零校准）；内容变才写，
        // 写失败静默不阻断渲染（同 widget 快照 best-effort 教义）。
        let memoryStore = MuscleLevelMemoryStore(fileURL: muscleLevelMemoryFileURL())
        let previousMemory = memoryStore.load()
        // 批次 D 相对力量标准输入：体重 HealthKit 最新优先（调用侧 async 读好传入）
        // → profile.weightKg 兜底 → nil 如实退化；性别只从档案读（设置页可填）。
        let bodyweightKg = healthKitWeightKg ?? cleanView.profile.weightKg
        let muscleProfile = MuscleProfileComposer.compose(MuscleProfileComposer.Input(
            rows: contributionRows, touches: touchRows, e1rmRows: e1rmRows,
            bestActualKgByExercise: bestByExercise, bestE1RmKgByExercise: estByExercise,
            unitSystem: cleanView.profile.unitSystem,
            sexRaw: cleanView.profile.sex,
            bodyweightKg: bodyweightKg,
            previousLevels: previousMemory?.levels ?? [:],
            previousPeaks: previousMemory?.peaks ?? [:],
            previousTierRaw: previousMemory?.tierRaw,
            nowISO: todayISO))
        // 子肌群等级：只算已解锁且有 children 的大块（back/shoulders）
        var subLevelsByMuscle: [RedeLocalSnapshot.MuscleGroupID: [MuscleSubLevel]] = [:]
        for estimate in muscleProfile.estimates where estimate.decision != .insufficientData {
            guard MuscleSubLevelBuilder.children(of: estimate.muscleId) != nil else { continue }
            subLevelsByMuscle[estimate.muscleId] = MuscleSubLevelBuilder.subLevels(
                parent: estimate.muscleId, fineRows: fineRows,
                parentPerformanceScore: estimate.score.performanceScore,
                parentConfidence: estimate.confidence,
                nowISO: todayISO, config: .current)
        }
        let nextMemory = MuscleLevelMemory.extract(from: muscleProfile, atIso: todayISO)
        if MuscleLevelMemory.shouldPersist(previous: previousMemory, next: nextMemory) {
            try? memoryStore.saveReconciling(nextMemory)   // 写前 peaks max 合并（并发竞写对策）
        }
        return .ready(ProgressModel(
            snapshot: snapshot,
            quality: quality,
            records: records,
            statsRecords: statsRecords,
            keyTrend: keyTrend,
            trendAssessment: keyTrend.map(TrendInsight.assess),
            weeklyComparison: snapshot.weeklyVolume.first.map {
                WeeklyInsight.compare(latest: $0, weeks: snapshot.weeklyVolume, todayISO: todayISO)
            },
            continuity: continuity,
            milestones: milestones,
            muscleProfile: muscleProfile,
            subLevelsByMuscle: subLevelsByMuscle
        ))
    }

    /// clean view → 快照自有输入类型（时长不在 clean view 内，本片不显示——留痕）。
    /// 过滤键含 weight/reps：同场同动作重复条目下 setIndex 可能撞号——但撞号
    /// 要求两组数值完全相同，而质量规则对相同数值的判定也相同（基准场内不更新），
    /// 即撞号的组要么同被标记要么同不被标记，多删/漏删不可能发生。
    static func mapToRecords(
        _ view: CleanAppDataView,
        excluding suspects: [DataQualityReport.SuspectSet] = []
    ) -> [SnapshotSessionRecord] {
        var suspectKeys = Set<String>()
        for suspect in suspects {
            suspectKeys.insert("\(suspect.sessionId)|\(suspect.exerciseId)|\(suspect.setIndex)|\(suspect.weightKg)|\(suspect.reps)")
        }
        return view.sessions.map { session in
            SnapshotSessionRecord(
                id: session.id,
                dateISO: session.date,
                exercises: session.exercises.map { exercise in
                    SnapshotExerciseRecord(
                        exerciseId: exercise.exerciseId,
                        sets: exercise.sets.enumerated().compactMap { index, set in
                            let key = "\(session.id)|\(exercise.exerciseId)|\(index + 1)|\(set.weight)|\(set.reps)"
                            return suspectKeys.contains(key)
                                ? nil
                                : SnapshotSetRecord(weightKg: set.weight, reps: set.reps)
                        }
                    )
                },
                durationMinutes: nil
            )
        }
    }
}
