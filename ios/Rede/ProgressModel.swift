import Foundation
import RedeDataHealth
import RedeDomain
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

    static func loadOutcomeAsync(now: Date = Date()) async -> LoadOutcome? {
        await Task.detached(priority: .userInitiated) { loadOutcome(now: now) }.value
    }

    static func loadOutcome(now: Date = Date()) -> LoadOutcome? {
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
            milestones: milestones
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
