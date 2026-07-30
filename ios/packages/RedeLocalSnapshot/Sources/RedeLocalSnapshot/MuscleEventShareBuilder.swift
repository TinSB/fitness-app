// MuscleEventShareBuilder — pending MLE 事实到当天分享卡的纯消费策略。
// 不清 pending、不写 canonical、不读取时钟；调用方显式传日期与近期训练天数。

public enum MuscleEventShareBuilder {
    public static func snapshots(
        pending: [LevelBreakthrough],
        profile: MuscleDevelopmentProfile,
        generatedDateISO: String,
        recentTrainingDays: Int
    ) -> [ShareSnapshot] {
        let todaysEvents = pending.filter { $0.achievedAtIso == generatedDateISO }
        var snapshots: [ShareSnapshot] = []

        let levelChanges = todaysEvents.compactMap { event in
            shareableLevelChange(event, profile: profile)
        }
        if !levelChanges.isEmpty {
            snapshots.append(SharePrivacyFilter.levelUp(
                generatedDateISO: generatedDateISO,
                changes: levelChanges,
                totalChangeCount: levelChanges.count,
                recentTrainingDays: recentTrainingDays
            ))
        }

        if let event = todaysEvents.last(where: { $0.kind == .balanceMilestone }),
           let from = event.fromLevel,
           let to = event.toLevel {
            let evidenceDirections = event.evidence.compactMap { evidence -> String? in
                guard evidence.code == "balanceImproved" else { return nil }
                return evidence.muscleId?.rawValue
            }
            let fallback = MuscleGroupID(rawValue: event.targetId).map { [$0.rawValue] } ?? []
            snapshots.append(SharePrivacyFilter.balanceImprovement(
                generatedDateISO: generatedDateISO,
                fromScore: Double(from),
                toScore: Double(to),
                improvingMuscleRaws: evidenceDirections.isEmpty ? fallback : evidenceDirections
            ))
        }

        return snapshots
    }

    /// 近 4 周 = 截止日及向前 27 个 civil day；同日多场只算一个训练日。
    public static func recentTrainingDayCount(
        dateISOs: [String],
        throughISO: String
    ) -> Int {
        guard let throughDay = SnapshotDayMath.dayNumber(of: throughISO) else { return 0 }
        let uniqueDays = Set(dateISOs.compactMap { raw -> Int? in
            let dateISO = String(raw.prefix(10))
            guard let day = SnapshotDayMath.dayNumber(of: dateISO) else { return nil }
            let age = throughDay - day
            return (0...27).contains(age) ? day : nil
        })
        return uniqueDays.count
    }

    private static func shareableLevelChange(
        _ event: LevelBreakthrough,
        profile: MuscleDevelopmentProfile
    ) -> ShareSnapshot.LevelUp.Change? {
        switch event.kind {
        case .muscleLevel:
            guard let muscle = MuscleGroupID(rawValue: event.targetId),
                  let from = event.fromLevel,
                  let to = event.toLevel,
                  to > from,
                  let estimate = profile.estimates.first(where: {
                      $0.muscleId == muscle && $0.decision != .insufficientData
                  }),
                  confidenceRank(estimate.confidence) >= confidenceRank(.medium)
            else { return nil }
            return .init(
                muscleRaw: muscle.rawValue,
                fromLevel: from,
                toLevel: to,
                fromTierRaw: nil,
                toTierRaw: nil
            )
        case .trainingTier:
            guard let from = event.fromTier,
                  let to = event.toTier,
                  from != to,
                  medianConfidence(profile.estimates) != .low
            else { return nil }
            return .init(
                muscleRaw: nil,
                fromLevel: nil,
                toLevel: nil,
                fromTierRaw: from.rawValue,
                toTierRaw: to.rawValue
            )
        case .strengthMilestone, .balanceMilestone, .consistencyMilestone:
            return nil
        }
    }

    /// 与 MuscleProfileAssembler tier 惯例一致：只看已解锁 contributor，
    /// 排序后偶数取低侧中位（保守）。
    private static func medianConfidence(
        _ estimates: [MuscleLevelEstimate]
    ) -> EstimateConfidence {
        let ranks = estimates
            .filter { $0.decision != .insufficientData }
            .map { confidenceRank($0.confidence) }
            .sorted()
        guard !ranks.isEmpty else { return .low }
        switch ranks[(ranks.count - 1) / 2] {
        case 2: return .high
        case 1: return .medium
        default: return .low
        }
    }

    private static func confidenceRank(_ confidence: EstimateConfidence) -> Int {
        switch confidence {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        }
    }
}
