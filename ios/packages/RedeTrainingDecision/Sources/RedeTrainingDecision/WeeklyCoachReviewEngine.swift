// Weekly Coach Review — FR-SUB3 每周教练复盘的纯决策核心。
//
// 上层只注入已清洗、已截断到“上一完整 ISO 周”的窄输入；本文件不读时钟、计划、
// entitlement、StoreKit、AppData 或持久化。输出只有 typed 状态、事实依据和导航动作，
// 不生成文案、不作因果推断，也不把训练量单独解释为进步。

import Foundation

public enum WeeklyCoachLiftCall: Equatable, Sendable {
    case up
    case flat
    case down
    case calibrating
}

public struct WeeklyCoachLiftSignal: Equatable, Sendable {
    public let exerciseId: String
    public let call: WeeklyCoachLiftCall
    public let deltaKg: Double?

    public init(exerciseId: String, call: WeeklyCoachLiftCall, deltaKg: Double?) {
        self.exerciseId = exerciseId
        self.call = call
        self.deltaKg = deltaKg
    }
}

public struct WeeklyCoachReviewInput: Equatable, Sendable {
    public let reviewWeekStartISO: String
    public let trainingDayCount: Int
    public let sessionCount: Int
    public let cleanVolumeKg: Double
    /// Review week 之前最近完整周的训练日中位数；nil 表示没有可比较历史。
    public let recentMedianTrainingDays: Double?
    public let keyLift: WeeklyCoachLiftSignal?
    public let dataFindingCount: Int

    public init(
        reviewWeekStartISO: String,
        trainingDayCount: Int,
        sessionCount: Int,
        cleanVolumeKg: Double,
        recentMedianTrainingDays: Double?,
        keyLift: WeeklyCoachLiftSignal?,
        dataFindingCount: Int
    ) {
        self.reviewWeekStartISO = reviewWeekStartISO
        self.trainingDayCount = trainingDayCount
        self.sessionCount = sessionCount
        self.cleanVolumeKg = cleanVolumeKg
        self.recentMedianTrainingDays = recentMedianTrainingDays
        self.keyLift = keyLift
        self.dataFindingCount = dataFindingCount
    }
}

public enum WeeklyCoachReviewVerdict: Equatable, Sendable {
    case dataNeedsReview
    case rebuildRhythm
    case progressing
    case holding
    case easing
    case calibrating
}

public enum WeeklyCoachReviewEvidence: Equatable, Sendable {
    case dataFindings(count: Int)
    case trainingDays(count: Int)
    case recentMedianTrainingDays(count: Double)
    case sessions(count: Int)
    case keyLift(exerciseId: String, call: WeeklyCoachLiftCall, deltaKg: Double?)
    case cleanVolumeKg(Double)
}

public enum WeeklyCoachReviewAction: Equatable, Sendable {
    case reviewData
    case openToday
    case viewProgress
}

public struct WeeklyCoachReview: Equatable, Sendable {
    public let reviewWeekStartISO: String
    public let verdict: WeeklyCoachReviewVerdict
    public let evidence: [WeeklyCoachReviewEvidence]
    public let action: WeeklyCoachReviewAction

    public init(
        reviewWeekStartISO: String,
        verdict: WeeklyCoachReviewVerdict,
        evidence: [WeeklyCoachReviewEvidence],
        action: WeeklyCoachReviewAction
    ) {
        self.reviewWeekStartISO = reviewWeekStartISO
        self.verdict = verdict
        self.evidence = Array(evidence.prefix(3))
        self.action = action
    }
}

public enum WeeklyCoachReviewEmptyState: Equatable, Sendable {
    case noCompletedTraining
}

public enum WeeklyCoachReviewUnavailableReason: Equatable, Sendable {
    case invalidInput
}

public enum WeeklyCoachReviewOutcome: Equatable, Sendable {
    case review(WeeklyCoachReview)
    case empty(WeeklyCoachReviewEmptyState)
    case unavailable(WeeklyCoachReviewUnavailableReason)
}

public enum WeeklyCoachReviewEngine {
    /// 决策优先级：非法输入失败关闭 > 数据问题 > 空历史 > 节奏下降 > 关键动作趋势 > 校准事实。
    public static func evaluate(_ input: WeeklyCoachReviewInput) -> WeeklyCoachReviewOutcome {
        guard isValid(input) else { return .unavailable(.invalidInput) }

        if input.dataFindingCount > 0 {
            return review(
                input,
                verdict: .dataNeedsReview,
                evidence: [
                    .dataFindings(count: input.dataFindingCount),
                    .trainingDays(count: input.trainingDayCount),
                    .cleanVolumeKg(input.cleanVolumeKg),
                ],
                action: .reviewData
            )
        }

        if input.sessionCount == 0 {
            return .empty(.noCompletedTraining)
        }

        // 一场训练只够陈述事实，不足以支持周趋势；即使历史中位数或关键动作
        // 信号存在，也先失败关闭为校准态。
        if input.sessionCount == 1 {
            return review(
                input,
                verdict: .calibrating,
                evidence: [
                    .trainingDays(count: input.trainingDayCount),
                    .sessions(count: input.sessionCount),
                    .cleanVolumeKg(input.cleanVolumeKg),
                ],
                action: .viewProgress
            )
        }

        if input.trainingDayCount == 0 || isMeaningfullyBelowRecentRhythm(input) {
            var evidence: [WeeklyCoachReviewEvidence] = [
                .trainingDays(count: input.trainingDayCount),
            ]
            if let median = input.recentMedianTrainingDays {
                evidence.append(.recentMedianTrainingDays(count: median))
            }
            evidence.append(.cleanVolumeKg(input.cleanVolumeKg))
            return review(input, verdict: .rebuildRhythm, evidence: evidence, action: .openToday)
        }

        // 首个完整训练周只有当周事实，没有前一完整周可比；即使上层误传了 up/down，
        // 这里也失败关闭为校准态，避免把单周内部波动包装成跨周趋势。
        if input.recentMedianTrainingDays == nil {
            return review(
                input,
                verdict: .calibrating,
                evidence: [
                    .trainingDays(count: input.trainingDayCount),
                    .sessions(count: input.sessionCount),
                    .cleanVolumeKg(input.cleanVolumeKg),
                ],
                action: .viewProgress
            )
        }

        if let lift = input.keyLift {
            let verdict: WeeklyCoachReviewVerdict
            switch lift.call {
            case .up: verdict = .progressing
            case .flat: verdict = .holding
            case .down: verdict = .easing
            case .calibrating: verdict = .calibrating
            }
            return review(
                input,
                verdict: verdict,
                evidence: [
                    .trainingDays(count: input.trainingDayCount),
                    .keyLift(exerciseId: lift.exerciseId, call: lift.call, deltaKg: lift.deltaKg),
                    .cleanVolumeKg(input.cleanVolumeKg),
                ],
                action: .viewProgress
            )
        }

        return review(
            input,
            verdict: .calibrating,
            evidence: [
                .trainingDays(count: input.trainingDayCount),
                .sessions(count: input.sessionCount),
                .cleanVolumeKg(input.cleanVolumeKg),
            ],
            action: .viewProgress
        )
    }

    private static func review(
        _ input: WeeklyCoachReviewInput,
        verdict: WeeklyCoachReviewVerdict,
        evidence: [WeeklyCoachReviewEvidence],
        action: WeeklyCoachReviewAction
    ) -> WeeklyCoachReviewOutcome {
        .review(WeeklyCoachReview(
            reviewWeekStartISO: input.reviewWeekStartISO,
            verdict: verdict,
            evidence: evidence,
            action: action
        ))
    }

    private static func isMeaningfullyBelowRecentRhythm(_ input: WeeklyCoachReviewInput) -> Bool {
        guard let median = input.recentMedianTrainingDays else { return false }
        return Double(input.trainingDayCount) + 1 <= median
    }

    private static func isValid(_ input: WeeklyCoachReviewInput) -> Bool {
        guard isISOWeekStart(input.reviewWeekStartISO),
              (0...7).contains(input.trainingDayCount),
              input.sessionCount >= input.trainingDayCount,
              (input.sessionCount == 0) == (input.trainingDayCount == 0),
              input.cleanVolumeKg.isFinite,
              input.cleanVolumeKg >= 0,
              input.dataFindingCount >= 0 else {
            return false
        }

        if let median = input.recentMedianTrainingDays,
           !median.isFinite || median < 0 || median > 7 {
            return false
        }

        if let lift = input.keyLift {
            guard !lift.exerciseId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return false
            }
            if let deltaKg = lift.deltaKg, !deltaKg.isFinite { return false }
        }

        return true
    }

    private static func isISOWeekStart(_ value: String) -> Bool {
        guard value.count == 10 else { return false }
        let parts = value.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              parts[0].count == 4,
              parts[1].count == 2,
              parts[2].count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2]) else {
            return false
        }

        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        var components = DateComponents()
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        components.year = year
        components.month = month
        components.day = day
        guard let date = calendar.date(from: components) else { return false }
        let roundTrip = calendar.dateComponents([.year, .month, .day, .weekday], from: date)
        return roundTrip.year == year
            && roundTrip.month == month
            && roundTrip.day == day
            && roundTrip.weekday == 2
    }
}
