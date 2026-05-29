// iOS-4B4 Deload + Clamp + Modes V1 — volume clamp + the three output modes.
//
// Swift port of the arbitration primitives in src/engines/trainingDecisionEngine.ts:
//   * clampMultiplier      (line 163) -> finalVolumeMultiplier
//   * volumeModeFor        (line 212)
//   * intensityModeFor     (line 221)
//   * progressionModeFor   (line 234)
// plus the phase-floor constants (phaseToVolumeFloor line 121; the *_VOLUME_FLOOR
// constants lines 96-98). PURE — no clock, no AppData, no userFacing.
//
// clampMultiplier reads `effectivePhase.effectiveWeekVolumeMultiplier` (the resolved
// effectiveWeek.volumeMultiplier added to EffectiveTrainingPhase in iOS-4B4) and a
// DeloadDecision (TrainingDecisionDeload). Its `clampReasons` are returned for
// fidelity but the FULL ordered arbitrationTrace is still iOS-4B6 — the core slice
// does not assemble it. intensityModeFor consumes readiness.trainingAdjustment.

import Foundation
import IronPathDomain

enum TrainingDecisionModes {
    // Volume floors (trainingDecisionEngine.ts:96-98).
    static let reentryVolumeFloor: Double = 0.65
    static let restartVolumeFloor: Double = 0.55
    static let severeVolumeFloor: Double = 0.3

    /// phaseToVolumeFloor (trainingDecisionEngine.ts:121). restart 0.55 / reentry
    /// 0.65 / everything else 1.
    static func phaseToVolumeFloor(_ phase: ActivePhase) -> Double {
        if phase == .restart { return restartVolumeFloor }
        if phase == .reentry { return reentryVolumeFloor }
        return 1
    }

    /// Result of clampMultiplier — the final volume multiplier + the AR clamp codes
    /// (a PARTIAL trace; the full ordered arbitrationTrace is iOS-4B6).
    struct ClampResult: Equatable {
        let multiplier: Double
        let clampReasons: [String]
    }

    /// clampMultiplier (trainingDecisionEngine.ts:163). Severe floors to 0.3; else a
    /// triggered deload either clamps DOWN to the deload multiplier (normal phases) or,
    /// for reentry/restart, clamps UP to the phase floor (never below it). When no
    /// deload triggers the effectiveWeek multiplier passes through unchanged — which is
    /// why restart's 0.5 (effectiveWeek) is below its 0.55 floor.
    static func clampMultiplier(
        effectivePhase: EffectiveTrainingPhase,
        deload: DeloadDecision,
        severeFlag: Bool
    ) -> ClampResult {
        var reasons: [String] = []
        var multiplier = effectivePhase.effectiveWeekVolumeMultiplier

        if severeFlag {
            multiplier = min(multiplier, severeVolumeFloor)
            reasons.append("AR-1-severe-cut")
            return ClampResult(multiplier: multiplier, clampReasons: reasons)
        }

        let phaseFloor = phaseToVolumeFloor(effectivePhase.activePhase)
        if deload.triggered && deload.volumeMultiplier < phaseFloor && effectivePhase.activePhase != .deload {
            if effectivePhase.activePhase == .reentry || effectivePhase.activePhase == .restart {
                reasons.append("AR-2-reentry-clamp-deload(\(fmt2(deload.volumeMultiplier))->\(fmt2(phaseFloor)))")
                multiplier = max(multiplier, phaseFloor)
            } else {
                multiplier = min(multiplier, deload.volumeMultiplier)
                reasons.append("AR-2-min-not-product")
            }
        } else if deload.triggered {
            multiplier = min(multiplier, deload.volumeMultiplier)
            reasons.append("AR-2-min-not-product")
        }

        return ClampResult(multiplier: multiplier, clampReasons: reasons)
    }

    /// volumeModeFor (trainingDecisionEngine.ts:212).
    static func volumeModeFor(intent: SessionIntent, multiplier: Double) -> VolumeMode {
        if intent == .severeRest { return .severeCut }
        if intent == .reentryProductive { return .reentryFloor }
        if intent == .deloadWeek { return .trim }
        if multiplier > 1.05 { return .expand }
        if multiplier < 0.95 { return .trim }
        return .hold
    }

    /// intensityModeFor (trainingDecisionEngine.ts:221).
    static func intensityModeFor(
        intent: SessionIntent,
        trainingAdjustment: ReadinessTrainingAdjustment
    ) -> IntensityMode {
        if intent == .severeRest { return .cut }
        if intent == .reentryProductive { return .cap }
        if intent == .controlledReload { return .cap }
        if intent == .deloadWeek { return .cap }
        if trainingAdjustment == .push { return .expand }
        if trainingAdjustment == .conservative || trainingAdjustment == .recovery { return .cap }
        return .hold
    }

    /// progressionModeFor (trainingDecisionEngine.ts:234).
    static func progressionModeFor(intent: SessionIntent, e1rmTrendUp: Bool) -> ProgressionMode {
        if intent == .severeRest { return .pullBack }
        if intent == .controlledReload { return .reload }
        if intent == .reentryProductive { return .hold }
        if intent == .deloadWeek { return .hold }
        if e1rmTrendUp { return .progress }
        return .hold
    }

    /// `Number.toFixed(2)` for the AR-2-reentry-clamp-deload reason string. This trace
    /// code is never exercised by a golden (no fixture triggers the reentry/restart
    /// deload-clamp), but the format mirrors the TS `.toFixed(2)` exactly.
    private static func fmt2(_ value: Double) -> String {
        String(format: "%.2f", value)
    }
}
