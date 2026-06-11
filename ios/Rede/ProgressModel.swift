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

    static func loadOutcomeAsync() async -> LoadOutcome? {
        await Task.detached(priority: .userInitiated) { loadOutcome() }.value
    }

    static func loadOutcome() -> LoadOutcome? {
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
        // （上限 = 起步值×6、下限 60、全局 400 兜底——待校准启发值，留痕 2026-06-11）
        let catalog = ExerciseCatalog.minimal
        var facts: [String: ExerciseStatsFacts] = [:]
        var ceilings: [String: Double] = [:]
        for entry in catalog.entries {
            facts[entry.id] = ExerciseStatsFacts(
                loadFactor: entry.loadFactor, isCompound: entry.kind == "compound"
            )
            ceilings[entry.id] = max(60, entry.startWeightKg * 6)
        }
        let quality = DataQualityReportBuilder.build(view: cleanView, plausibleCeilingByExercise: ceilings)
        // 可疑组不进统计（趋势/PR/判断句）——可信度的行为表达（§3.4：判断更保守），
        // 数据区仍如实列出（FR-PR4 标记不隐藏）。canonical 原样不动。
        let records = mapToRecords(cleanView)
        let statsRecords = mapToRecords(cleanView, excluding: quality.suspectSets)
        let snapshot = ProgressSnapshotBuilder.build(sessions: statsRecords, facts: facts)
        let keyTrend = TrendInsight.keyExercise(of: snapshot, facts: facts)
        return .ready(ProgressModel(
            snapshot: snapshot,
            quality: quality,
            records: records,
            statsRecords: statsRecords,
            keyTrend: keyTrend,
            trendAssessment: keyTrend.map(TrendInsight.assess),
            weeklyComparison: snapshot.weeklyVolume.first.map {
                WeeklyInsight.compare(latest: $0, weeks: snapshot.weeklyVolume)
            }
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
