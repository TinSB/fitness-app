// SessionSummary — 完成流小结数据（M3-2）。纯函数：时长由调用方注入。
//
// PR 口径（保守）：顶组重量 > 该动作的上次工作重量——处方携带的
// previousWeightKg，或（换动作场景，§6.2 修复 2026-06-11）调用方注入的
// 该动作自身历史（previousWeightOverrides）。换入动作只和它自己的历史比，
// 绝不和被换走动作的历史比；无历史参考不判 PR——校准期不发奖。
// 吨位（owner 拍板 B 案 2026-06-11）：Σ 重量×次数×loadFactor（目录系数，
// 双哑铃=2 修正单只口径低估）；e1RM = Epley w×(1+r/30)，仅作展示口径。

public struct SessionSummary: Equatable, Sendable {
    public struct TopSet: Equatable, Sendable {
        public let exerciseId: String
        public let weightKg: Double
        public let reps: Int
    }

    public let totalVolumeKg: Double
    public let completedSetCount: Int
    public let topSet: TopSet?
    public let isPersonalRecord: Bool
    public let durationSeconds: Int

    /// 顶组 Epley e1RM；无顶组为 nil。
    public var topSetE1RmKg: Double? {
        guard let top = topSet else { return nil }
        return top.weightKg * (1 + Double(top.reps) / 30)
    }
}

public enum SessionSummaryBuilder {
    public static func build(
        prescription: TodayPrescription,
        observations: [String: [CompletedSetObservation]],
        durationSeconds: Int,
        catalog: ExerciseCatalog = .minimal,
        previousWeightOverrides: [String: Double] = [:]
    ) -> SessionSummary {
        var volume = 0.0
        var count = 0
        var top: SessionSummary.TopSet?
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
        }

        var isPR = false
        if let top {
            // 换入动作的 observation id 不在处方里——用注入的自身历史兜底（§6.2）
            let previous = prescription.exercises
                .first(where: { $0.exerciseId == top.exerciseId })?.previousWeightKg
                ?? previousWeightOverrides[top.exerciseId]
            if let previous { isPR = top.weightKg > previous }
        }

        return SessionSummary(
            totalVolumeKg: volume,
            completedSetCount: count,
            topSet: top,
            isPersonalRecord: isPR,
            durationSeconds: durationSeconds
        )
    }
}
