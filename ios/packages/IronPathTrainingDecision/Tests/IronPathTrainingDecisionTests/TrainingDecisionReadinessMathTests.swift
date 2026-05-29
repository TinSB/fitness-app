// iOS-4B4 — readiness math completion: time-gap penalty + health-summary delta +
// Math.round (jsRound). Drives buildReadinessResult directly via @testable. These
// pin the exact TS bucket behaviour the iOS-4B4 intensityMode parity relies on.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingDecisionReadinessMathTests: XCTestCase {

    private func score(
        sleep: String? = "一般",
        energy: String? = "中",
        soreness: [String] = ["无"],
        pain: [String] = [],
        available: Double? = nil,
        planned: Double? = nil,
        health: HealthSummary? = nil,
        useHealth: Bool? = nil
    ) -> ReadinessResult {
        TrainingDecisionReadiness.buildReadinessResult(
            sleep: TrainingDecisionReadiness.mappedSleep(sleep),
            energy: TrainingDecisionReadiness.mappedEnergy(energy),
            sorenessAreas: TrainingDecisionReadiness.actionableSorenessAreas(soreness),
            painAreas: pain,
            availableTimeMin: available,
            plannedTimeMin: planned,
            healthSummary: health,
            useHealthDataForReadiness: useHealth
        )
    }

    // MARK: - time-gap penalty (readinessEngine.ts:68-72)

    func test_timeGap_penalty_buckets() {
        // 一般/中 base = 82-8-6 = 68. gap 10 (<15) -> -4 -> 64 (the parity-fixture case).
        XCTAssertEqual(score(available: 60, planned: 70).score, 64)
        // gap 15 (>=15, <30) -> -8 -> 60.
        XCTAssertEqual(score(available: 60, planned: 75).score, 60)
        // gap 30 (>=30) -> -15 -> 53.
        XCTAssertEqual(score(available: 60, planned: 90).score, 53)
        // gap exactly 14 -> still -4 (boundary just below 15).
        XCTAssertEqual(score(available: 60, planned: 74).score, 64)
        // gap exactly 29 -> -8 (boundary just below 30).
        XCTAssertEqual(score(available: 60, planned: 89).score, 60)
    }

    func test_timeGap_no_penalty_paths() {
        XCTAssertEqual(score(available: 60, planned: 60).score, 68)  // available == planned (not <)
        XCTAssertEqual(score(available: 80, planned: 70).score, 68)  // available > planned
        XCTAssertEqual(score(available: 60, planned: nil).score, 68) // no planned -> truthy check fails
        XCTAssertEqual(score(available: nil, planned: 70).score, 68) // no available (NaN) -> no penalty
        XCTAssertEqual(score(available: 60, planned: 0).score, 68)   // planned 0 is falsy in TS
    }

    func test_timeGap_flips_trainingAdjustment_to_conservative() {
        // The crux of iOS-4B4: 68 (no gap) is medium/normal; 64 (gap -4) is medium but
        // <65 -> conservative -> intensityMode cap for normal-session.
        XCTAssertEqual(score(planned: nil).trainingAdjustment, .normal)
        let withGap = score(available: 60, planned: 70)
        XCTAssertEqual(withGap.score, 64)
        XCTAssertEqual(withGap.level, .medium)            // still medium (no level flip)
        XCTAssertEqual(withGap.trainingAdjustment, .conservative)
    }

    func test_controlledReload_score_with_timeGap_is_40_low() {
        // 差/低 = 82-20-18 = 44; gap -4 -> 40 -> low (the controlled-reload readiness).
        let r = score(sleep: "差", energy: "低", available: 60, planned: 70)
        XCTAssertEqual(r.score, 40)
        XCTAssertEqual(r.level, .low)
    }

    // MARK: - health-summary delta (readinessEngine.ts:74-100)

    func test_health_latestSleepHours_under6() {
        // confidence high -> -4; confidence low -> -2.
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, latestSleepHours: 5)).score, 64)
        XCTAssertEqual(score(health: HealthSummary(confidence: .low, latestSleepHours: 5)).score, 66)
        // >= 6 hours -> no penalty.
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, latestSleepHours: 7)).score, 68)
    }

    func test_health_rhr_or_hrv_note() {
        // RHR/HRV note -> -3 when confidence != low; no score change when low.
        XCTAssertEqual(score(health: HealthSummary(confidence: .medium, notes: ["静息心率高于基线"])).score, 65)
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, notes: ["HRV 低于基线"])).score, 65)
        XCTAssertEqual(score(health: HealthSummary(confidence: .low, notes: ["静息心率高于基线"])).score, 68)
    }

    func test_health_activityLoad_chain() {
        // previous24h -> -4 (wins the if/else-if chain).
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, activityLoad: HealthActivityLoad(previous24hHighActivity: true))).score, 64)
        // previous48h -> -2.
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, activityLoad: HealthActivityLoad(previous48hHighActivity: true))).score, 66)
        // recent7d >= 240 (no 24/48) -> note only, no score change.
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, activityLoad: HealthActivityLoad(recent7dWorkoutMinutes: 240))).score, 68)
        // recentHighActivityDays > 0 (no activityLoad), confidence != low -> -2.
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, recentHighActivityDays: 1)).score, 66)
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, recentWorkoutMinutes: 120)).score, 66)
        // confidence low gates the recentHighActivity branch off.
        XCTAssertEqual(score(health: HealthSummary(confidence: .low, recentHighActivityDays: 1)).score, 68)
    }

    func test_health_delta_gated_off_when_useHealthDataForReadiness_false() {
        // useHealthDataForReadiness == false -> healthSummary ignored entirely.
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, latestSleepHours: 5), useHealth: false).score, 68)
        // nil / true -> delta applies.
        XCTAssertEqual(score(health: HealthSummary(confidence: .high, latestSleepHours: 5), useHealth: true).score, 64)
    }

    // MARK: - Math.round (jsRound) — half-up toward +Infinity

    func test_jsRound_half_up_semantics() {
        XCTAssertEqual(TrainingDecisionReadiness.jsRound(2.5), 3)
        XCTAssertEqual(TrainingDecisionReadiness.jsRound(2.4), 2)
        XCTAssertEqual(TrainingDecisionReadiness.jsRound(2.6), 3)
        XCTAssertEqual(TrainingDecisionReadiness.jsRound(3.0), 3)
        XCTAssertEqual(TrainingDecisionReadiness.jsRound(-0.5), 0)   // JS Math.round(-0.5) == -0 == 0
        XCTAssertEqual(TrainingDecisionReadiness.jsRound(-1.5), -1)  // JS Math.round(-1.5) == -1
    }

    func test_score_is_exact_integer_round_is_structural_noop() {
        // Every subjective + time-gap + health delta is an integer literal, so the
        // readiness score is always integer-valued and Math.round is a no-op.
        for r in [score(), score(available: 60, planned: 70), score(sleep: "差", energy: "低")] {
            XCTAssertEqual(Double(r.score), Double(TrainingDecisionReadiness.jsRound(Double(r.score))), accuracy: 0)
        }
    }
}
