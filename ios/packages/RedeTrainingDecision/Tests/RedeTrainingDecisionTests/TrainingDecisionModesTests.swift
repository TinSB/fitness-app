// iOS-4B4 — clampMultiplier + volume/intensity/progression modeFor unit tests.
// Drives the pure mode primitives directly via @testable.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionModesTests: XCTestCase {

    private func ep(_ phase: ActivePhase, vol: Double) -> EffectiveTrainingPhase {
        EffectiveTrainingPhase(
            persistedPhase: phase, activePhase: phase, gapDays: 0, overridden: false,
            hasHistory: true, mode: .cont, severity: .none, effectiveWeekVolumeMultiplier: vol
        )
    }

    private func deload(_ level: DeloadLevel, _ vol: Double) -> DeloadDecision {
        DeloadDecision(level: level, triggered: level != .none, volumeMultiplier: vol, strategy: .none, reasons: [])
    }
    private var noDeload: DeloadDecision { deload(.none, 1) }

    // MARK: - clampMultiplier

    func test_clamp_severe_floors_to_0_3() {
        let r = TrainingDecisionModes.clampMultiplier(effectivePhase: ep(.base, vol: 0.9), deload: noDeload, severeFlag: true)
        XCTAssertEqual(r.multiplier, 0.3, accuracy: 1e-9)
        XCTAssertEqual(r.clampReasons, ["AR-1-severe-cut"])
    }

    func test_clamp_no_deload_passes_effectiveWeek_through() {
        XCTAssertEqual(TrainingDecisionModes.clampMultiplier(effectivePhase: ep(.base, vol: 0.9), deload: noDeload, severeFlag: false).multiplier, 0.9, accuracy: 1e-9)
        // restart effectiveWeek 0.5 passes through BELOW its 0.55 floor (no deload).
        let restart = TrainingDecisionModes.clampMultiplier(effectivePhase: ep(.restart, vol: 0.5), deload: noDeload, severeFlag: false)
        XCTAssertEqual(restart.multiplier, 0.5, accuracy: 1e-9)
        XCTAssertTrue(restart.clampReasons.isEmpty)
    }

    func test_clamp_watch_deload_at_base_is_min_unchanged() {
        // base 0.9 + watch deload 0.9 -> min(0.9, 0.9) = 0.9 (controlled-reload case).
        let r = TrainingDecisionModes.clampMultiplier(effectivePhase: ep(.base, vol: 0.9), deload: deload(.watch, 0.9), severeFlag: false)
        XCTAssertEqual(r.multiplier, 0.9, accuracy: 1e-9)
        XCTAssertEqual(r.clampReasons, ["AR-2-min-not-product"])
    }

    func test_clamp_yellow_deload_at_base_clamps_down() {
        // base 0.9 + yellow deload 0.75 -> min = 0.75.
        XCTAssertEqual(TrainingDecisionModes.clampMultiplier(effectivePhase: ep(.base, vol: 0.9), deload: deload(.yellow, 0.75), severeFlag: false).multiplier, 0.75, accuracy: 1e-9)
    }

    func test_clamp_reentry_with_deload_below_floor_clamps_up() {
        // reentry effectiveWeek 0.65; red deload 0.6 < floor 0.65 -> max(0.65, 0.65) = 0.65.
        let r = TrainingDecisionModes.clampMultiplier(effectivePhase: ep(.reentry, vol: 0.65), deload: deload(.red, 0.6), severeFlag: false)
        XCTAssertEqual(r.multiplier, 0.65, accuracy: 1e-9)
        XCTAssertTrue(r.clampReasons.first?.hasPrefix("AR-2-reentry-clamp-deload") ?? false)
    }

    func test_phaseToVolumeFloor() {
        XCTAssertEqual(TrainingDecisionModes.phaseToVolumeFloor(.restart), 0.55, accuracy: 1e-9)
        XCTAssertEqual(TrainingDecisionModes.phaseToVolumeFloor(.reentry), 0.65, accuracy: 1e-9)
        XCTAssertEqual(TrainingDecisionModes.phaseToVolumeFloor(.base), 1, accuracy: 1e-9)
        XCTAssertEqual(TrainingDecisionModes.phaseToVolumeFloor(.deload), 1, accuracy: 1e-9)
    }

    // MARK: - volumeModeFor

    func test_volumeModeFor_intent_routes_then_multiplier() {
        XCTAssertEqual(TrainingDecisionModes.volumeModeFor(intent: .severeRest, multiplier: 0.3), .severeCut)
        XCTAssertEqual(TrainingDecisionModes.volumeModeFor(intent: .reentryProductive, multiplier: 0.65), .reentryFloor)
        XCTAssertEqual(TrainingDecisionModes.volumeModeFor(intent: .deloadWeek, multiplier: 0.9), .trim)
        XCTAssertEqual(TrainingDecisionModes.volumeModeFor(intent: .normalSession, multiplier: 1.1), .expand)   // > 1.05
        XCTAssertEqual(TrainingDecisionModes.volumeModeFor(intent: .normalSession, multiplier: 0.9), .trim)    // < 0.95
        XCTAssertEqual(TrainingDecisionModes.volumeModeFor(intent: .normalSession, multiplier: 1.0), .hold)
        XCTAssertEqual(TrainingDecisionModes.volumeModeFor(intent: .controlledReload, multiplier: 0.9), .trim) // 0.9 < 0.95
    }

    // MARK: - intensityModeFor

    func test_intensityModeFor_intent_then_trainingAdjustment() {
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .severeRest, trainingAdjustment: .push), .cut)
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .reentryProductive, trainingAdjustment: .push), .cap)
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .controlledReload, trainingAdjustment: .push), .cap)
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .deloadWeek, trainingAdjustment: .push), .cap)
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .normalSession, trainingAdjustment: .push), .expand)
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .normalSession, trainingAdjustment: .conservative), .cap)
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .normalSession, trainingAdjustment: .recovery), .cap)
        XCTAssertEqual(TrainingDecisionModes.intensityModeFor(intent: .normalSession, trainingAdjustment: .normal), .hold)
    }

    // MARK: - progressionModeFor

    func test_progressionModeFor_intent_then_e1rmTrend() {
        XCTAssertEqual(TrainingDecisionModes.progressionModeFor(intent: .severeRest, e1rmTrendUp: true), .pullBack)
        XCTAssertEqual(TrainingDecisionModes.progressionModeFor(intent: .controlledReload, e1rmTrendUp: false), .reload)
        XCTAssertEqual(TrainingDecisionModes.progressionModeFor(intent: .reentryProductive, e1rmTrendUp: true), .hold)
        XCTAssertEqual(TrainingDecisionModes.progressionModeFor(intent: .deloadWeek, e1rmTrendUp: true), .hold)
        XCTAssertEqual(TrainingDecisionModes.progressionModeFor(intent: .normalSession, e1rmTrendUp: true), .progress)
        XCTAssertEqual(TrainingDecisionModes.progressionModeFor(intent: .normalSession, e1rmTrendUp: false), .hold)
    }
}
