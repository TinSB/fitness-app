// SessionSummary — 完成流小结数据（M3-2）。纯函数：时长由调用方注入。
//
// PR 口径（保守）：顶组重量 > 该动作处方携带的上次工作重量（previousWeightKg）；
// 首练（无历史参考）不判 PR——校准期不发奖。e1RM = Epley w×(1+r/30)，
// 仅作展示口径；正式 e1RM 趋势归 M4 进展层。

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
        durationSeconds: Int
    ) -> SessionSummary {
        var volume = 0.0
        var count = 0
        var top: SessionSummary.TopSet?
        for (exerciseId, sets) in observations {
            for set in sets {
                volume += set.weightKg * Double(set.reps)
                count += 1
                if top == nil || set.weightKg > top!.weightKg
                    || (set.weightKg == top!.weightKg && set.reps > top!.reps) {
                    top = SessionSummary.TopSet(exerciseId: exerciseId, weightKg: set.weightKg, reps: set.reps)
                }
            }
        }

        var isPR = false
        if let top, let previous = prescription.exercises
            .first(where: { $0.exerciseId == top.exerciseId })?.previousWeightKg {
            isPR = top.weightKg > previous
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
