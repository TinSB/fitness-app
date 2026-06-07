// iOS-4B2 TrainingDecision Core Rule Skeleton V1 — effectivePhase engine.
//
// Swift port of retired-web-reference (the Training Cycle
// Gap Auto Re-entry State Machine): getDaysSinceLastTraining + deriveDecision +
// getEffectiveTrainingPhase. PURE — the clock is injected via `referenceDate`
// (never `Date()`), and it reads ONLY history + mesocyclePlan. No readiness,
// prescription, deload, modes, riskLevel, or userFacing.
//
// Output is a non-optional engine value type, distinct from the all-optional
// golden-decode `EffectivePhaseSummary` (TrainingDecisionHiddenDebug.swift). The
// parity test maps this engine output onto the golden's effectivePhase fields.

import Foundation
import IronPathDomain

/// Internal processing mode (effectiveTrainingPhaseEngine.ts:34). `cont` carries
/// the rawValue "continue" (a Swift keyword) to match the golden string.
public enum EffectivePhaseMode: String, Equatable, Sendable {
    case cont = "continue"
    case reentry
    case restart
}

/// Internal severity (effectiveTrainingPhaseEngine.ts:35).
public enum EffectivePhaseSeverity: String, Equatable, Sendable {
    case none
    case mild
    case reentry
    case restart
}

/// Computed effective training phase — the 6 fields the parity goldens carry
/// (activePhase/gapDays/mode/severity/overridden/hasHistory) plus persistedPhase
/// for context. iOS-4B4 adds `effectiveWeekVolumeMultiplier` — the resolved
/// `effectiveWeek.volumeMultiplier` (effectiveTrainingPhaseEngine.ts:209) — because
/// clampMultiplier (trainingDecisionEngine.ts:169) reads exactly that field. The
/// remaining downstream-only effectiveWeek fields (intensityBias /
/// phaseForCompatibility) are still NOT modelled (no ported consumer reads them).
public struct EffectiveTrainingPhase: Equatable, Sendable {
    public let persistedPhase: ActivePhase
    public let activePhase: ActivePhase
    public let gapDays: Int
    public let overridden: Bool
    public let hasHistory: Bool
    public let mode: EffectivePhaseMode
    public let severity: EffectivePhaseSeverity
    /// `effectiveWeek.volumeMultiplier` — the persisted-week multiplier, OR the
    /// reentry/restart override (0.65 / 0.5 / 0.75), consumed by clampMultiplier.
    public let effectiveWeekVolumeMultiplier: Double
}

enum EffectiveTrainingPhaseEngine {
    /// isAnalyticsSession (effectiveTrainingPhaseEngine.ts:102):
    /// `completed !== false && dataFlag not in {test, excluded}`. `dataFlag` is
    /// not a typed field on the Swift TrainingSession, so it is read from the
    /// `_unknown` carrier — faithful for real-export data even though no current
    /// fixture exercises it.
    static func isAnalyticsSession(_ session: TrainingSession) -> Bool {
        if session.completed == false { return false }
        let dataFlag = session._unknown["dataFlag"]?.stringValue
        if dataFlag == "test" || dataFlag == "excluded" { return false }
        return true
    }

    /// sessionTimestamp (effectiveTrainingPhaseEngine.ts:105):
    /// `finishedAt ?? startedAt ?? date`, each noon-anchored.
    static func sessionTimestamp(_ session: TrainingSession) -> Double? {
        if let f = session.finishedAt, let t = TDDateMath.noonAnchoredMillis(f) { return t }
        if let s = session.startedAt, let t = TDDateMath.noonAnchoredMillis(s) { return t }
        if let d = session.date, let t = TDDateMath.noonAnchoredMillis(d) { return t }
        return nil
    }

    /// getDaysSinceLastTraining (effectiveTrainingPhaseEngine.ts:114). Returns nil
    /// when no analytics session has a parseable timestamp (the caller treats nil
    /// as "no history"). Day diff uses `Math.round` half-up, clamped to >= 0.
    static func daysSinceLastTraining(history: [TrainingSession], referenceDate: String) -> Int? {
        guard let reference = TDDateMath.noonAnchoredMillis(referenceDate) else { return nil }
        var latest: Double?
        for session in history {
            guard isAnalyticsSession(session), let ts = sessionTimestamp(session) else { continue }
            if let current = latest {
                if ts > current { latest = ts }
            } else {
                latest = ts
            }
        }
        guard let last = latest else { return nil }
        // Math.round (half toward +Infinity) == floor(x + 0.5), then max(0, ...).
        let diffDays = (reference - last) / TDDateMath.msPerDay
        let rounded = Int((diffDays + 0.5).rounded(.down))
        return max(0, rounded)
    }

    struct Decision: Equatable {
        let kind: ActivePhase
        let mode: EffectivePhaseMode
        let severity: EffectivePhaseSeverity
        let overridden: Bool
        /// `decision.weekOverride.volumeMultiplier` (effectiveTrainingPhaseEngine.ts:137).
        /// nil when no override (effectiveWeek == persistedWeek). reentry/restart pin
        /// a conservative multiplier (0.65 / 0.5; 0.75 for an 8–13d overload/deload gap).
        let weekVolumeOverride: Double?

        init(
            kind: ActivePhase,
            mode: EffectivePhaseMode,
            severity: EffectivePhaseSeverity,
            overridden: Bool,
            weekVolumeOverride: Double? = nil
        ) {
            self.kind = kind
            self.mode = mode
            self.severity = severity
            self.overridden = overridden
            self.weekVolumeOverride = weekVolumeOverride
        }
    }

    /// deriveDecision (effectiveTrainingPhaseEngine.ts:140). `gapDays == nil`
    /// means no history. Note the 8–13d non-overload/deload branch returns
    /// mode `.cont` but severity `.reentry` — an intentional divergence with no
    /// golden coverage, locked by the gap-table unit tests. iOS-4B4: each branch
    /// now also carries `weekVolumeOverride` (the effectiveTrainingPhaseEngine.ts
    /// weekOverride.volumeMultiplier) so clampMultiplier can read effectiveWeek.
    static func deriveDecision(persistedPhase: ActivePhase, gapDays: Int?) -> Decision {
        guard let days = gapDays else {
            return Decision(kind: persistedPhase, mode: .cont, severity: .none, overridden: false)
        }
        if days >= 28 {
            return Decision(kind: .restart, mode: .restart, severity: .restart, overridden: true, weekVolumeOverride: 0.5)
        }
        if days >= 14 {
            return Decision(kind: .reentry, mode: .reentry, severity: .reentry, overridden: true, weekVolumeOverride: 0.65)
        }
        if days >= 8 {
            if persistedPhase == .overload || persistedPhase == .deload {
                return Decision(kind: .reentry, mode: .reentry, severity: .reentry, overridden: true, weekVolumeOverride: 0.75)
            }
            return Decision(kind: persistedPhase, mode: .cont, severity: .reentry, overridden: false)
        }
        if days >= 4 {
            return Decision(kind: persistedPhase, mode: .cont, severity: .mild, overridden: false)
        }
        return Decision(kind: persistedPhase, mode: .cont, severity: .none, overridden: false)
    }

    /// getEffectiveTrainingPhase (effectiveTrainingPhaseEngine.ts:199). PURE.
    /// `referenceDate` is the injected clock (`nowIso.slice(0,10)` upstream); no
    /// `Date()` / `todayKey()` fallback is reached on this path.
    static func getEffectiveTrainingPhase(
        mesocyclePlan: MesocyclePlan?,
        history: [TrainingSession],
        referenceDate: String
    ) -> EffectiveTrainingPhase {
        let persistedWeek = MesocycleWeekResolver.currentWeek(plan: mesocyclePlan, referenceDate: referenceDate)
        let persistedPhase = persistedWeek.phase
        let gap = daysSinceLastTraining(history: history, referenceDate: referenceDate)
        let decision = deriveDecision(persistedPhase: persistedPhase, gapDays: gap)
        // effectiveWeek = weekOverride ? {…persistedWeek, volumeMultiplier: override} :
        // persistedWeek (effectiveTrainingPhaseEngine.ts:209-216).
        let effectiveWeekVolumeMultiplier = decision.weekVolumeOverride ?? persistedWeek.volumeMultiplier
        return EffectiveTrainingPhase(
            persistedPhase: persistedPhase,
            activePhase: decision.kind,
            gapDays: gap ?? 0,
            overridden: decision.overridden,
            hasHistory: gap != nil,
            mode: decision.mode,
            severity: decision.severity,
            effectiveWeekVolumeMultiplier: effectiveWeekVolumeMultiplier
        )
    }
}
