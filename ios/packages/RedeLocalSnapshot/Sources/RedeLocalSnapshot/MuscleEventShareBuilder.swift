// MuscleEventShareBuilder — pending MLE 事实到当天分享卡的纯消费策略。
// 不清 pending、不写 canonical、不读取时钟；调用方显式传日期与近期训练天数。

public enum MuscleEventShareBuilder {
    public static func snapshots(
        pending: [LevelBreakthrough],
        generatedDateISO: String,
        recentTrainingDays: Int
    ) -> [ShareSnapshot] {
        let todaysEvents = todayEvents(
            pending: pending,
            generatedDateISO: generatedDateISO
        )
        var snapshots: [ShareSnapshot] = []

        let levelChanges = todaysEvents.compactMap { event in
            shareableLevelChange(event)
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

    /// 当天事实面与分享资格分离：此处只做日期/支持种类过滤，绝不拿资格删事实。
    public static func todayEvents(
        pending: [LevelBreakthrough],
        generatedDateISO: String
    ) -> [LevelBreakthrough] {
        pending.filter {
            guard $0.achievedAtIso == generatedDateISO else { return false }
            switch $0.kind {
            case .muscleLevel, .trainingTier, .balanceMilestone:
                return true
            case .strengthMilestone, .consistencyMilestone:
                return false
            }
        }
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
        _ event: LevelBreakthrough
    ) -> ShareSnapshot.LevelUp.Change? {
        guard LevelBreakthroughShareEligibility.isEligible(event) else { return nil }
        switch event.kind {
        case .muscleLevel:
            guard let muscle = MuscleGroupID(rawValue: event.targetId),
                  let from = event.fromLevel,
                  let to = event.toLevel,
                  to > from
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
                  from != to
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
}

/// B1 资格只由首次 append 时落盘的 raw facts 纯推导；nil/未知值一律 fail closed。
public enum LevelBreakthroughShareEligibility {
    private static let eligibleDecisionRaws: Set<String> = [
        MuscleDevelopmentDecision.maintain.rawValue,
        MuscleDevelopmentDecision.prioritize.rawValue,
    ]
    private static let nonSafetyLimitationCodes: Set<String> = [
        "shortHistory",
        "noStrengthSignal",
        "noRecentWindow",
        "noBaselineWindow",
    ]

    public static func isEligible(_ event: LevelBreakthrough) -> Bool {
        switch event.kind {
        case .muscleLevel:
            guard let from = event.fromLevel,
                  let to = event.toLevel,
                  to > from,
                  MuscleGroupID(rawValue: event.targetId) != nil
            else { return false }
            return factsPass(event.eventFacts)
        case .trainingTier:
            guard let from = event.fromTier,
                  let to = event.toTier,
                  tierRank(to) > tierRank(from)
            else { return false }
            return factsPass(event.eventFacts)
        case .balanceMilestone:
            guard let from = event.fromLevel,
                  let to = event.toLevel
            else { return false }
            return to > from
        case .strengthMilestone, .consistencyMilestone:
            return false
        }
    }

    private static func factsPass(_ facts: LevelBreakthroughEventFacts?) -> Bool {
        guard let facts,
              let confidence = EstimateConfidence(
                  rawValue: facts.confidenceAtEventRaw
              ),
              confidenceRank(confidence) >= confidenceRank(.medium),
              facts.recoveryPenaltyAtEvent.isFinite,
              facts.recoveryPenaltyAtEvent == 0,
              !facts.decisionRawsAtEvent.isEmpty,
              facts.decisionRawsAtEvent.allSatisfy(
                  eligibleDecisionRaws.contains
              ),
              facts.limitationCodesAtEvent.allSatisfy(
                  nonSafetyLimitationCodes.contains
              )
        else { return false }
        return true
    }

    private static func confidenceRank(_ confidence: EstimateConfidence) -> Int {
        switch confidence {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        }
    }

    private static func tierRank(_ tier: TrainingTier) -> Int {
        switch tier {
        case .calibrating: return 0
        case .beginner: return 1
        case .novicePlus: return 2
        case .intermediate: return 3
        case .advanced: return 4
        case .elite: return 5
        }
    }
}
