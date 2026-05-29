// iOS-4B3/4B4 Readiness — readiness engine (subjective + time-gap + health delta).
//
// Swift port of src/engines/readinessEngine.ts (buildReadinessResult /
// mapTodayStatusToReadinessInput / buildTodayReadiness / collectPainAreasFromHistory).
// PURE — reads only todayStatus + history + the caller-supplied template duration /
// health summary; no clock, no AppData mutation.
//
// iOS-4B3 ported the SUBJECTIVE subset (sleep/energy/soreness/pain). iOS-4B4 closes
// the readiness math that `intensityMode` parity needs:
//   * the available-vs-planned TIME-GAP penalty (readinessEngine.ts:68-72). The
//     clean input now carries `templateDurationMin` (= template.duration). For the
//     parity fixtures push-a duration=70 > default time=60 -> gap 10 -> -4, so the
//     default fixtures score 64 (was 68) and controlled-reload scores 40 (was 44).
//     The -4 flips `trainingAdjustment` for the default fixtures from normal to
//     `conservative` (the `<65` rule), which is exactly what makes the golden's
//     normal-session `intensityMode` == `cap` (iOS-4B4 asserts it).
//   * the HEALTH-SUMMARY delta (readinessEngine.ts:74-100), consuming a caller-
//     supplied `HealthSummary`. The sample->summary aggregation (`buildHealthSummary`)
//     stays DEFERRED (iOS-4B5): NO iOS-4B4 golden exercises the delta — every fixture
//     has 0 health samples, and stale-health-data-v1 resolves
//     useHealthDataForReadiness=false (the delta is gated off). So the engine passes
//     `healthSummary: nil`; the delta is exercised only by unit tests.
//   * `Math.round` of the score (readinessEngine.ts:102) via `jsRound`. Every score
//     delta is an integer literal so the round is a structural no-op today, but the
//     TS source rounds, so the port rounds (and a unit test pins the half-up rule).
//
// Level/sessionIntent/riskLevel from iOS-4B3 are unchanged by the -4: 64 stays
// medium, 40 stays low, with >=14 points of headroom to the <50 cutoff.

import Foundation
import IronPathDomain

/// `readiness.level` (readinessEngine.ts:103).
public enum ReadinessLevel: String, Equatable, Sendable {
    case low
    case medium
    case high
}

/// `readiness.trainingAdjustment` (readinessEngine.ts:104). Computed without the
/// deferred time-gap penalty, so it is not asserted against any iOS-4B3 golden
/// (only iOS-4B4 `intensityMode` will consume it).
public enum ReadinessTrainingAdjustment: String, Equatable, Sendable {
    case push
    case normal
    case conservative
    case recovery
}

/// Result of the subjective readiness computation.
public struct ReadinessResult: Equatable, Sendable {
    public let score: Int
    public let level: ReadinessLevel
    public let trainingAdjustment: ReadinessTrainingAdjustment
    public let reasons: [String]
}

/// `HealthSummary.confidence` (healthSummaryEngine.ts).
public enum HealthSummaryConfidence: String, Equatable, Sendable {
    case low, medium, high
}

/// The `activityLoad` block of a HealthSummary — only the fields the readiness
/// delta reads (readinessEngine.ts:88-95).
public struct HealthActivityLoad: Equatable, Sendable {
    public let previous24hHighActivity: Bool
    public let previous48hHighActivity: Bool
    public let recent7dWorkoutMinutes: Double

    public init(
        previous24hHighActivity: Bool = false,
        previous48hHighActivity: Bool = false,
        recent7dWorkoutMinutes: Double = 0
    ) {
        self.previous24hHighActivity = previous24hHighActivity
        self.previous48hHighActivity = previous48hHighActivity
        self.recent7dWorkoutMinutes = recent7dWorkoutMinutes
    }
}

/// The subset of `HealthSummary` (healthSummaryEngine.ts) the readiness DELTA
/// consumes. The sample->summary aggregation (`buildHealthSummary`) is NOT ported in
/// iOS-4B4 (deferred to iOS-4B5; no golden exercises it) — this is a value the caller
/// constructs. NOT Codable (it is computed, never decoded from a golden).
public struct HealthSummary: Equatable, Sendable {
    public let confidence: HealthSummaryConfidence
    public let notes: [String]
    public let latestSleepHours: Double?
    public let activityLoad: HealthActivityLoad?
    public let recentHighActivityDays: Int
    public let recentWorkoutMinutes: Double

    public init(
        confidence: HealthSummaryConfidence,
        notes: [String] = [],
        latestSleepHours: Double? = nil,
        activityLoad: HealthActivityLoad? = nil,
        recentHighActivityDays: Int = 0,
        recentWorkoutMinutes: Double = 0
    ) {
        self.confidence = confidence
        self.notes = notes
        self.latestSleepHours = latestSleepHours
        self.activityLoad = activityLoad
        self.recentHighActivityDays = recentHighActivityDays
        self.recentWorkoutMinutes = recentWorkoutMinutes
    }
}

enum TrainingDecisionReadiness {
    // sleepMap / energyMap (readinessEngine.ts:5-15). Unmapped/nil falls through to
    // the "good"/"high" (+4) branch in buildReadinessResult, mirroring the TS
    // `sleepMap[status.sleep]` -> undefined -> else-branch behaviour.
    static func mappedSleep(_ raw: String?) -> String? {
        switch raw {
        case "差": return "poor"
        case "一般": return "ok"
        case "好": return "good"
        default: return nil
        }
    }

    static func mappedEnergy(_ raw: String?) -> String? {
        switch raw {
        case "低": return "low"
        case "中": return "medium"
        case "高": return "high"
        default: return nil
        }
    }

    /// actionableSorenessAreas (engineUtils.ts:229) — drop the "no soreness" marker
    /// ('无') and blanks. Fixtures only ever carry ['无'] or none, so this resolves
    /// to []; the broader soreness-normalisation table is not needed here.
    static func actionableSorenessAreas(_ soreness: [String]?) -> [String] {
        (soreness ?? []).filter { !$0.isEmpty && $0 != "无" && $0 != "none" }
    }

    /// collectPainAreasFromHistory (readinessEngine.ts:140) — first 6 sessions,
    /// each exercise's sets where painFlag, mapped to painArea (or exercise name).
    static func collectPainAreasFromHistory(_ history: [TrainingSession]) -> [String] {
        history.prefix(6).flatMap { session -> [String] in
            (session.exercises ?? []).flatMap { exercise -> [String] in
                (exercise.sets ?? [])
                    .filter { $0.painFlag == true }
                    .compactMap { set in set.painArea ?? exercise.name }
            }
        }
    }

    /// JS `Math.round` semantics: round half toward +Infinity == `floor(x + 0.5)`
    /// (readinessEngine.ts:102). For the integer-valued readiness score this is a
    /// structural no-op, but the TS source rounds, so the port rounds.
    static func jsRound(_ x: Double) -> Int { Int((x + 0.5).rounded(.down)) }

    /// buildReadinessResult (readinessEngine.ts:30). Subjective deltas + the
    /// iOS-4B4 time-gap penalty + health-summary delta. `availableTimeMin` /
    /// `plannedTimeMin` / `healthSummary` default to nil so the 4B3 subjective-only
    /// call sites keep computing the subjective score. The health delta is gated by
    /// `useHealthDataForReadiness != false` (readinessEngine.ts:74).
    static func buildReadinessResult(
        sleep: String?,
        energy: String?,
        sorenessAreas: [String],
        painAreas: [String],
        availableTimeMin: Double? = nil,
        plannedTimeMin: Double? = nil,
        healthSummary: HealthSummary? = nil,
        useHealthDataForReadiness: Bool?
    ) -> ReadinessResult {
        // Accumulate as Double to mirror the TS `number` + the trailing Math.round.
        var score = 82.0
        var reasons: [String] = []

        if sleep == "poor" {
            score -= 20
            reasons.append("睡眠偏差")
        } else if sleep == "ok" {
            score -= 8
        } else {
            score += 4
        }

        if energy == "low" {
            score -= 18
            reasons.append("精力偏低")
        } else if energy == "medium" {
            score -= 6
        } else {
            score += 4
        }

        if sorenessAreas.count >= 2 {
            score -= 15
            reasons.append("多肌群酸痛")
        } else if sorenessAreas.count == 1 {
            score -= 8
            reasons.append("局部酸痛")
        }

        if !painAreas.isEmpty {
            score -= 20
            reasons.append("存在疼痛区域")
        }

        // time-gap penalty (readinessEngine.ts:68-72). `plannedTimeMin` must be
        // truthy (> 0); a nil/NaN availableTimeMin yields no penalty (NaN < x is false).
        if let planned = plannedTimeMin, planned > 0, let available = availableTimeMin, available < planned {
            let gap = planned - available
            score -= gap >= 30 ? 15 : (gap >= 15 ? 8 : 4)
            reasons.append("可用时间低于计划时长")
        }

        // health-summary delta (readinessEngine.ts:74-100). Gated off when
        // useHealthDataForReadiness == false. buildHealthSummary aggregation is
        // deferred (iOS-4B5); the engine passes nil, so this runs only in unit tests.
        let effectiveHealthSummary = (useHealthDataForReadiness == false) ? nil : healthSummary
        if let hs = effectiveHealthSummary {
            if hs.confidence == .low {
                reasons.append("健康数据不足，本次准备度主要依据主观状态。")
            }
            let healthNotes = hs.notes.joined(separator: " ")
            if let sleepHours = hs.latestSleepHours, sleepHours < 6 {
                score -= hs.confidence == .low ? 2 : 4
                reasons.append("导入健康数据提示睡眠偏少，因此今天建议略保守。")
            }
            if healthNotes.contains("静息心率高于") || healthNotes.contains("HRV 低于") {
                if hs.confidence != .low { score -= 3 }
                reasons.append("导入健康数据提示恢复可能偏低，系统仅作轻度训练提醒，不作为医疗判断。")
            }
            if hs.activityLoad?.previous24hHighActivity == true {
                score -= 4
                reasons.append("过去 24 小时外部活动量较高，今天训练建议略保守。")
            } else if hs.activityLoad?.previous48hHighActivity == true {
                score -= 2
                reasons.append("过去 48 小时外部活动量偏高，今天作为轻度恢复提醒。")
            } else if let al = hs.activityLoad, al.recent7dWorkoutMinutes >= 240 {
                reasons.append("最近 7 天外部活动量较高，但 24/48 小时负荷正常，因此只作为趋势参考。")
            } else if hs.confidence != .low && (hs.recentHighActivityDays > 0 || hs.recentWorkoutMinutes >= 120) {
                score -= 2
                reasons.append("导入健康数据提示近期活动负荷偏高。")
            }
        }

        let rounded = max(0, min(100, jsRound(score)))
        let level: ReadinessLevel
        var trainingAdjustment: ReadinessTrainingAdjustment

        if rounded < 50 {
            level = .low
            trainingAdjustment = painAreas.isEmpty ? .conservative : .recovery
        } else if rounded < 75 {
            level = .medium
            trainingAdjustment = .normal
        } else {
            level = .high
            trainingAdjustment = .normal // adherenceHigh/push path deferred (not in clean input)
        }

        if rounded < 65 && trainingAdjustment == .normal { trainingAdjustment = .conservative }

        return ReadinessResult(score: rounded, level: level, trainingAdjustment: trainingAdjustment, reasons: reasons)
    }

    /// buildTodayReadiness (readinessEngine.ts:122) — maps todayStatus then scores.
    /// `availableTimeMin` mirrors `Number(status.time)`; `plannedTimeMin` is the
    /// caller-supplied `template.duration`. `healthSummary` defaults to nil (the
    /// engine does not aggregate one — see file header).
    static func buildTodayReadiness(
        todayStatus: TodayStatus,
        history: [TrainingSession],
        templateDurationMin: Double?,
        healthSummary: HealthSummary? = nil,
        useHealthDataForReadiness: Bool?
    ) -> ReadinessResult {
        let painAreas = collectPainAreasFromHistory(history)
        // Number(status.time): a non-numeric/absent time -> nil -> no time-gap penalty.
        let availableTimeMin = todayStatus.time.flatMap { Double($0) }
        return buildReadinessResult(
            sleep: mappedSleep(todayStatus.sleep),
            energy: mappedEnergy(todayStatus.energy),
            sorenessAreas: actionableSorenessAreas(todayStatus.soreness),
            painAreas: painAreas,
            availableTimeMin: availableTimeMin,
            plannedTimeMin: templateDurationMin,
            healthSummary: healthSummary,
            useHealthDataForReadiness: useHealthDataForReadiness
        )
    }

    /// riskLevelFor (trainingDecisionEngine.ts:246).
    static func riskLevelFor(severeFlag: Bool, readinessLevel: ReadinessLevel, painCount: Int) -> RiskLevel {
        if severeFlag { return .severe }
        if painCount > 0 && readinessLevel == .low { return .high }
        if readinessLevel == .low { return .moderate }
        if painCount > 0 { return .low }
        return .none
    }
}
