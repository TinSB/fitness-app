// SessionSummary — 完成流小结数据（M3-2）。纯函数：时长由调用方注入。
//
// PR 口径（2026-10-18 与进展页 / 今日页对齐，ProgressSnapshotBuilder 同一规则）：
// 本场任一动作的顶组重量 **严格大于该动作全部已存历史的最重一组**。此前只和「上次」
// 工作重量比——三周前 75、上次 65、今天 70 会在小结里报 PR，存完进展页却没有。
// 每个动作只和它自己的历史比（换入动作同样）；从没练过的动作不判 PR（校准期不发奖）；
// 辅助器械不参与（辅助量越多越轻）。PR 铭牌 / PR 分享卡写的是**破纪录那个动作**的最重一组
//（prTopSet）——任一动作都能破纪录后，全场最重一组常常是另一个动作（审查 2026-10-18）；
// 非 PR 时的顶组展示仍取全场最重一组。可疑组（手滑多打一位之类）不参与 PR，判定与进展页同一条规则；
// 同一重量留 1e-6 kg 容差（磅用户手输与格子值差一个最低位，2026-10-19）。
// 吨位（owner 拍板 B 案 2026-06-11）：Σ 重量×次数×loadFactor（目录系数，
// 双哑铃=2 修正单只口径低估）；e1RM = Epley w×(1+r/30)，仅作展示口径。

import RedeDataHealth

public struct SessionSummary: Equatable, Sendable {
    public struct TopSet: Equatable, Sendable {
        public let exerciseId: String
        public let weightKg: Double
        public let reps: Int
    }

    public let totalVolumeKg: Double
    public let completedSetCount: Int
    public let topSet: TopSet?
    /// 破纪录的动作里最重的一组；没有 PR 为 nil。
    public let prTopSet: TopSet?
    public var isPersonalRecord: Bool { prTopSet != nil }
    public let durationSeconds: Int

    /// 顶组 Epley e1RM；无顶组为 nil。
    public var topSetE1RmKg: Double? {
        guard let top = topSet else { return nil }
        return top.weightKg * (1 + Double(top.reps) / 30)
    }
}

public enum SessionSummaryBuilder {
    /// 已存历史里每个动作的最重一组（PR 基线）。辅助器械不收录；数据质量报告标出的可疑组
    ///（手滑多打一位之类）不收录——进展页的 PR 也是在剔除它们之后算的（ProgressModel.mapToRecords
    /// 同一把键：场次 id | 动作 id | 组序号(1 起) | 重量 | 次数）。
    public static func previousBestWeights(
        sessions: [CleanTrainingSession],
        excluding suspects: [DataQualityReport.SuspectSet] = [],
        catalog: ExerciseCatalog = .minimal
    ) -> [String: Double] {
        let suspectKeys = Set(suspects.map { "\($0.sessionId)|\($0.exerciseId)|\($0.setIndex)|\($0.weightKg)|\($0.reps)" })
        var best: [String: Double] = [:]
        for session in sessions {
            for exercise in session.exercises where catalog.entry(id: exercise.exerciseId)?.loadType != "assisted" {
                let weights = exercise.sets.enumerated().compactMap { index, set -> Double? in
                    suspectKeys.contains("\(session.id)|\(exercise.exerciseId)|\(index + 1)|\(set.weight)|\(set.reps)")
                        ? nil : set.weight
                }
                guard let top = weights.max() else { continue }
                best[exercise.exerciseId] = max(best[exercise.exerciseId] ?? top, top)
            }
        }
        return best
    }

    /// 「同一重量」的容差：磅用户手输的 65 lb（65 ÷ 2.2046…）与引擎格子上的 65 lb（13 × 5 ÷ 2.2046…）
    /// 在双精度里会差 1 个最低位，不留容差就把同一重量当成「更重」报 PR（审查 2026-10-19）。
    static let sameWeightToleranceKg = 1e-6

    public static func build(
        observations: [String: [CompletedSetObservation]],
        durationSeconds: Int,
        catalog: ExerciseCatalog = .minimal,
        previousBestWeightKg: [String: Double] = [:],
        plausibleCeilingByExercise: [String: Double] = [:]
    ) -> SessionSummary {
        var volume = 0.0
        var count = 0
        var top: SessionSummary.TopSet?
        var prTop: SessionSummary.TopSet?
        for (exerciseId, sets) in observations {
            let entry = catalog.entry(id: exerciseId)
            let factor = entry?.loadFactor ?? 1.0
            // 辅助器械不进吨位/顶组/PR（wave-9）：重量轴是辅助量（越多越轻），裸加进
            // 吨位 = 把帮助当成举起的负重，且辅助越多吨位越高 = 方向反。组数仍如实计。
            let countsTowardLoad = entry?.loadType != "assisted"
            for set in sets {
                count += 1
                guard countsTowardLoad else { continue }
                volume += set.weightKg * Double(set.reps) * factor
                if top == nil || set.weightKg > top!.weightKg
                    || (set.weightKg == top!.weightKg && set.reps > top!.reps) {
                    top = SessionSummary.TopSet(exerciseId: exerciseId, weightKg: set.weightKg, reps: set.reps)
                }
            }
            // PR 候选不含可疑组（与进展页同一条规则：DataQualityReportBuilder.suspectReason）。
            let plausible = sets.filter {
                DataQualityReportBuilder.suspectReason(
                    weightKg: $0.weightKg, reps: $0.reps,
                    previousBestKg: previousBestWeightKg[exerciseId],
                    ceilingKg: plausibleCeilingByExercise[exerciseId]) == nil
            }
            if countsTowardLoad, let best = previousBestWeightKg[exerciseId],
               let exerciseTop = plausible.max(by: { ($0.weightKg, $0.reps) < ($1.weightKg, $1.reps) }),
               exerciseTop.weightKg > best + sameWeightToleranceKg,
               prTop.map({ (exerciseTop.weightKg, exerciseTop.reps) > ($0.weightKg, $0.reps) }) ?? true {
                prTop = SessionSummary.TopSet(exerciseId: exerciseId, weightKg: exerciseTop.weightKg, reps: exerciseTop.reps)
            }
        }

        return SessionSummary(
            totalVolumeKg: volume,
            completedSetCount: count,
            topSet: top,
            prTopSet: prTop,
            durationSeconds: durationSeconds
        )
    }
}
