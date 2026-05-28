// iOS-4B3 Readiness + e1RM Slice V1 — readiness engine (subjective subset).
//
// Swift port of the SUBJECTIVE part of src/engines/readinessEngine.ts
// (buildReadinessResult / mapTodayStatusToReadinessInput / buildTodayReadiness /
// collectPainAreasFromHistory). PURE — reads only todayStatus + history; no clock,
// no AppData mutation.
//
// DEFERRED (documented, no golden exercises them in iOS-4B3):
//   * the health-data delta — buildHealthSummary / healthSummaryEngine. No fixture
//     supplies live (non-stale) health data: controlled-reload-v1 has none, and
//     stale-health-data-v1's sample is stale so the clean view resolves
//     useHealthDataForReadiness=false (the health branch is skipped anyway). The
//     full health-summary port lands in a later slice.
//   * the available-vs-planned time-gap penalty — needs `template.duration`, which
//     the clean input does not carry (template arrives with prescription, iOS-4B5).
//     This penalty DOES fire in TS for the fixtures: push-a duration=70 > default
//     time=60 -> gap 10 -> -4. So the TS source-of-truth scores are 64 (defaults)
//     and 40 (controlled-reload), whereas this deferred port computes 68 and 44.
//     Both still land in the same LEVEL bucket (64/68 -> medium; 40/44 -> low) with
//     >=14 points of headroom to the <50 cutoff, so no fixture's level flips. NOTE:
//     the -4 DOES change `trainingAdjustment` for the 4 push-a default fixtures
//     (TS 64 -> conservative via the `<65` rule; this port 68 -> normal), but
//     `trainingAdjustment` feeds only `intensityMode` (iOS-4B4) — no iOS-4B3 golden
//     field consumes it. iOS-4B4 must add this penalty (+ the health delta + the
//     Math.round, currently a no-op since every subjective delta is an integer)
//     before asserting intensityMode / trainingAdjustment parity.
//
// iOS-4B3 asserts readiness LEVEL (drives recoveryHigh + riskLevel), not the raw
// score, against the goldens — the deferred deltas above do not change any level.

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

    /// buildReadinessResult (readinessEngine.ts:30) — SUBJECTIVE part only.
    /// `useHealthDataForReadiness` is accepted to document the contract gate, but
    /// the health-summary delta is deferred (see file header), so it does not
    /// change the score here.
    static func buildReadinessResult(
        sleep: String?,
        energy: String?,
        sorenessAreas: [String],
        painAreas: [String],
        useHealthDataForReadiness: Bool?
    ) -> ReadinessResult {
        var score = 82
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

        // (time-gap penalty + health-summary delta deferred — see file header)

        score = max(0, min(100, score))
        let level: ReadinessLevel
        var trainingAdjustment: ReadinessTrainingAdjustment

        if score < 50 {
            level = .low
            trainingAdjustment = painAreas.isEmpty ? .conservative : .recovery
        } else if score < 75 {
            level = .medium
            trainingAdjustment = .normal
        } else {
            level = .high
            trainingAdjustment = .normal // adherenceHigh/push path deferred (not in clean input)
        }

        if score < 65 && trainingAdjustment == .normal { trainingAdjustment = .conservative }

        return ReadinessResult(score: score, level: level, trainingAdjustment: trainingAdjustment, reasons: reasons)
    }

    /// buildTodayReadiness (readinessEngine.ts:122) — maps todayStatus then scores.
    static func buildTodayReadiness(
        todayStatus: TodayStatus,
        history: [TrainingSession],
        useHealthDataForReadiness: Bool?
    ) -> ReadinessResult {
        let painAreas = collectPainAreasFromHistory(history)
        return buildReadinessResult(
            sleep: mappedSleep(todayStatus.sleep),
            energy: mappedEnergy(todayStatus.energy),
            sorenessAreas: actionableSorenessAreas(todayStatus.soreness),
            painAreas: painAreas,
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
