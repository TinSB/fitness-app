// iOS-4B4 Deload + Clamp + Modes V1 — adaptive deload decision (subset).
//
// Swift port of the SCORING SUBSET of buildAdaptiveDeloadDecision
// (retired-web-reference). Produces the level / triggered /
// volumeMultiplier / strategy that clampMultiplier (TrainingDecisionModes) consumes.
// PURE — reads history + todayStatus + the cleaned screening's adaptiveState; no
// clock, no AppData mutation.
//
// DEFERRED (documented; PROVEN not to change any golden):
//   * The lapse-reset early return (`if (lapse.resetFatigue) return level:none`,
//     adaptiveFeedbackEngine.ts:480-491) — needs buildTrainingLapseSignal. The only
//     long-gap fixture (restart-28d-gap, gap 30) has neutral recent sessions + a
//     default todayStatus, so its deload score is 0 (level none) WHETHER OR NOT
//     resetFatigue fires; its finalVolumeMultiplier (0.5) comes from the restart
//     effectiveWeek, not the deload. So omitting the reset is golden-neutral.
//   * `recoveryTemplate` / `autoSwitchTemplateId` (adaptiveFeedbackEngine.ts:547-572)
//     — only set at level == red, which NO fixture reaches (max is controlled-reload
//     at watch). So `title` / `options` / `autoSwitchTemplateId` are not modelled.
// Both land with the prescription / userFacing surfaces (iOS-4B5/4B6).

import Foundation
import RedeDomain

/// `DeloadDecision['level']` (training-model.ts:494 / DeloadLevel).
public enum DeloadLevel: String, Equatable, Sendable {
    case none, watch, yellow, red
}

/// `DeloadDecision['strategy']` (DeloadStrategy).
public enum DeloadStrategy: String, Equatable, Sendable {
    case none
    case reduceAccessories = "reduce_accessories"
    case reduceVolume = "reduce_volume"
    case recoveryTemplate = "recovery_template"
}

/// The deload decision SUBSET clampMultiplier needs. `title` / `options` /
/// `autoSwitchTemplateId` (userFacing copy + red-only template switch) are deferred.
public struct DeloadDecision: Equatable, Sendable {
    public let level: DeloadLevel
    public let triggered: Bool
    public let volumeMultiplier: Double
    public let strategy: DeloadStrategy
    public let reasons: [String]
}

enum TrainingDecisionDeload {
    /// buildAdaptiveDeloadDecision (adaptiveFeedbackEngine.ts:472), scoring subset.
    static func buildAdaptiveDeloadDecision(
        history: [TrainingSession],
        todayStatus: TodayStatus,
        screening: ScreeningProfile
    ) -> DeloadDecision {
        // (lapse.resetFatigue early return DEFERRED — see file header; golden-neutral.)
        let recentSessions = Array(history.prefix(4))
        let adaptive = screening.adaptiveState?.objectValue
        var score = 0
        var reasons: [String] = []

        let poorRecoveryCount = recentSessions.filter { sessionHasPoorRecovery($0) }.count
        let repeatedPainCount = countValues(adaptive?["painByExercise"], atLeast: 2)
        let performanceDropCount = (adaptive?["performanceDrops"]?.arrayValue ?? []).count
        let highIssueCount = countValues(adaptive?["issueScores"], atLeast: 4)
        let currentSorenessCount = TrainingDecisionReadiness.actionableSorenessAreas(todayStatus.soreness).count

        if performanceDropCount >= 2 {
            score += 2
            reasons.append("最近多个动作表现下滑")
        } else if performanceDropCount == 1 {
            score += 1
            reasons.append("最近有主动作表现回落")
        }

        if repeatedPainCount >= 2 {
            score += 2
            reasons.append("pain flag 累积偏多")
        } else if repeatedPainCount == 1 {
            score += 1
            reasons.append("已有动作进入疼痛观察")
        }

        if poorRecoveryCount >= 2 {
            score += 1
            reasons.append("最近恢复信号偏差")
        }

        if todayStatus.sleep == "差" && todayStatus.energy == "低" {
            score += 2
            reasons.append("今天睡眠和精力都偏差")
        } else if todayStatus.sleep == "差" || todayStatus.energy == "低" {
            score += 1
            reasons.append("今天恢复状态一般")
        }

        if currentSorenessCount >= 2 {
            score += 1
            reasons.append("今日多肌群酸痛")
        }

        if highIssueCount >= 2 {
            score += 1
            reasons.append("纠偏问题分值在上升")
        }

        let level: DeloadLevel = score >= 5 ? .red : (score >= 3 ? .yellow : (score >= 1 ? .watch : .none))
        let strategy: DeloadStrategy = level == .red ? .recoveryTemplate
            : (level == .yellow ? .reduceVolume : (level == .watch ? .reduceAccessories : .none))
        let volumeMultiplier: Double = level == .red ? 0.6
            : (level == .yellow ? 0.75 : (level == .watch ? 0.9 : 1))

        return DeloadDecision(
            level: level,
            triggered: level != .none,
            volumeMultiplier: volumeMultiplier,
            strategy: strategy,
            reasons: reasons
        )
    }

    /// `session.status?.sleep === '差' || session.status?.energy === '低'`
    /// (adaptiveFeedbackEngine.ts:498). `status` is not a typed field on the Swift
    /// TrainingSession, so it is read from the `_unknown` carrier (faithful for real
    /// data; the synthetic fixtures carry no session status -> count 0).
    private static func sessionHasPoorRecovery(_ session: TrainingSession) -> Bool {
        guard let status = session._unknown["status"]?.objectValue else { return false }
        return status["sleep"]?.stringValue == "差" || status["energy"]?.stringValue == "低"
    }

    /// `Object.values(map).filter(v => number(v) >= threshold).length`
    /// (adaptiveFeedbackEngine.ts:499/501). Default screening's maps are empty -> 0.
    private static func countValues(_ value: JSONValue?, atLeast threshold: Double) -> Int {
        guard let obj = value?.objectValue else { return 0 }
        return obj.keys.reduce(0) { acc, key in
            acc + ((obj[key]?.doubleValue ?? 0) >= threshold ? 1 : 0)
        }
    }
}
