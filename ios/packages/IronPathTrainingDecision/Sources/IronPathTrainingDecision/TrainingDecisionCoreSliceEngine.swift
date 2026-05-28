// iOS-4B2 TrainingDecision Core Rule Skeleton V1 — engine entry + clean input.
//
// The FIRST TrainingDecision engine slice. Ports:
//   * the Clean Input Contract (src/engines/trainingDecisionCleanInput.ts):
//     CleanTrainingDecisionInput + createCleanTrainingDecisionInput, which takes
//     a CleanAppDataView (IronPathDataHealth) so RAW AppData can never reach the
//     engine. The brand is a compile-time guarantee (fileprivate init) — strictly
//     stronger than the TS runtime `Symbol.for(...)` throw.
//   * buildTrainingDecisionFromCleanInput (trainingDecisionCleanInput.ts:232).
//   * sessionIntentFor (trainingDecisionEngine.ts:196) — full 5-branch order, but
//     with e1rmTrendUp / recoveryHigh hard-wired false (readiness + e1RM trend are
//     iOS-4B3). It returns a NARROW TrainingDecisionCoreSlice — NOT a full
//     TrainingDecision — so nothing it does not compute is fabricated.
//
// OUT OF SCOPE (iOS-4B3+): exercise prescription, readiness, adaptive deload,
// finalVolumeMultiplier, riskLevel, volume/intensity/progression modes, the full
// weeklyAdjustment object, userFacing text, and the full arbitrationTrace. This
// file MUST NOT reference applyStatusRules / buildTodayReadiness /
// buildAdaptiveDeloadDecision / isE1rmTrendUp / clampMultiplier / the mode-or
// helpers / the buildXxxUserFacing presenters.

import Foundation
import IronPathDomain
import IronPathDataHealth

// MARK: - Forward-compat surfaces placeholder

/// Placeholder for the userFacing surface inputs the full engine accepts
/// (TrainingDecisionSurfaceInputs in trainingDecisionEngine.ts:1861). Kept so the
/// public entry signature is stable; iOS-4B2 ignores it (userFacing is iOS-4B5).
public struct TrainingDecisionSurfaceInputs: Sendable {
    public init() {}
}

// MARK: - Clean Input metadata

/// The non-AppData metadata the clean-input factory needs. Mirrors
/// CleanTrainingDecisionInputMetadata (trainingDecisionCleanInput.ts:82). The
/// iOS-4B2 core slice reads only nowIso + the three severe flags +
/// explicitDeloadAssigned; the rest are carried for forward-compat.
public struct CleanTrainingDecisionInputMetadata: Sendable {
    public var nowIso: String?
    public var trainingMode: String?
    public var acutePainReported: Bool?
    public var injuryFlag: Bool?
    public var illnessFlag: Bool?
    public var explicitDeloadAssigned: Bool?
    public var useHealthDataForReadiness: Bool?

    public init(
        nowIso: String? = nil,
        trainingMode: String? = nil,
        acutePainReported: Bool? = nil,
        injuryFlag: Bool? = nil,
        illnessFlag: Bool? = nil,
        explicitDeloadAssigned: Bool? = nil,
        useHealthDataForReadiness: Bool? = nil
    ) {
        self.nowIso = nowIso
        self.trainingMode = trainingMode
        self.acutePainReported = acutePainReported
        self.injuryFlag = injuryFlag
        self.illnessFlag = illnessFlag
        self.explicitDeloadAssigned = explicitDeloadAssigned
        self.useHealthDataForReadiness = useHealthDataForReadiness
    }
}

// MARK: - Branded Clean Input

/// The ONLY value type `buildTrainingDecisionFromCleanInput` accepts.
///
/// Construction is LOCKED: the memberwise initializer is `fileprivate`, so the
/// only way any other module (app surface, cloud, test) can mint one is the
/// `createCleanTrainingDecisionInput(cleanView:metadata:)` factory below, which
/// requires a CleanAppDataView. This is the Swift analogue of the TS
/// `Symbol.for('ironpath.trainingDecision.cleanInput.v1')` brand — but enforced
/// at COMPILE TIME, not by a runtime throw. Deliberately NOT Codable: a
/// synthesized `init(from:)` would re-open raw construction from arbitrary JSON
/// and defeat the lock.
public struct CleanTrainingDecisionInput: Sendable {
    // --- Consumed by the iOS-4B2 core slice ---
    public let history: [TrainingSession]
    public let mesocyclePlan: MesocyclePlan?
    public let nowIso: String?
    public let acutePainReported: Bool?
    public let injuryFlag: Bool?
    public let illnessFlag: Bool?
    public let explicitDeloadAssigned: Bool?

    // --- Carried for forward-compat / signature stability; NOT read in 4B2 ---
    public let trainingMode: String?
    public let todayStatus: TodayStatus
    public let screening: ScreeningProfile
    public let useHealthDataForReadiness: Bool?

    /// Brand: only `createCleanTrainingDecisionInput` (same file) can call this.
    fileprivate init(
        history: [TrainingSession],
        mesocyclePlan: MesocyclePlan?,
        nowIso: String?,
        acutePainReported: Bool?,
        injuryFlag: Bool?,
        illnessFlag: Bool?,
        explicitDeloadAssigned: Bool?,
        trainingMode: String?,
        todayStatus: TodayStatus,
        screening: ScreeningProfile,
        useHealthDataForReadiness: Bool?
    ) {
        self.history = history
        self.mesocyclePlan = mesocyclePlan
        self.nowIso = nowIso
        self.acutePainReported = acutePainReported
        self.injuryFlag = injuryFlag
        self.illnessFlag = illnessFlag
        self.explicitDeloadAssigned = explicitDeloadAssigned
        self.trainingMode = trainingMode
        self.todayStatus = todayStatus
        self.screening = screening
        self.useHealthDataForReadiness = useHealthDataForReadiness
    }
}

/// Mints a branded CleanTrainingDecisionInput from a CleanAppDataView. Mirrors
/// createCleanTrainingDecisionInput (trainingDecisionCleanInput.ts:158). History
/// is sourced from the CLEANED projection (`cleanView.cleanedHistory`) and
/// screening from `cleanView.cleanedScreening`; mesocyclePlan + todayStatus come
/// from `cleanView.raw` (the data-health guards do not clean those, and the 4B2
/// slice never reads todayStatus). An absent/empty plan maps to nil so the engine
/// falls back to the default week-0 'base' (mirrors TS `cleaned.mesocyclePlan ??
/// null`). No raw AppData value escapes into the engine — only these fields.
public func createCleanTrainingDecisionInput(
    cleanView: CleanAppDataView,
    metadata: CleanTrainingDecisionInputMetadata
) -> CleanTrainingDecisionInput {
    let rawPlan = cleanView.raw.mesocyclePlan
    let plan: MesocyclePlan? = (rawPlan.startDate == nil && rawPlan.weeks == nil) ? nil : rawPlan
    return CleanTrainingDecisionInput(
        history: cleanView.cleanedHistory,
        mesocyclePlan: plan,
        nowIso: metadata.nowIso,
        acutePainReported: metadata.acutePainReported,
        injuryFlag: metadata.injuryFlag,
        illnessFlag: metadata.illnessFlag,
        explicitDeloadAssigned: metadata.explicitDeloadAssigned,
        trainingMode: metadata.trainingMode,
        todayStatus: cleanView.raw.todayStatus,
        screening: cleanView.cleanedScreening,
        useHealthDataForReadiness: metadata.useHealthDataForReadiness
    )
}

// MARK: - Core slice result

/// The iOS-4B2 engine output — ONLY what the core slice computes. A narrow type
/// (not a full TrainingDecision) so no unported field is fabricated.
public struct TrainingDecisionCoreSlice: Equatable, Sendable {
    public let sessionIntent: SessionIntent
    public let activePhase: ActivePhase
    public let effectivePhase: EffectiveTrainingPhase
    /// The AR codes the core slice can legitimately emit (AR-1 / AR-2 only).
    /// The golden's FULL arbitrationTrace is deferred to iOS-4B3+ and is NOT
    /// compared against this.
    public let arbitrationTrace: [String]
}

// MARK: - sessionIntent

/// sessionIntentFor (trainingDecisionEngine.ts:196). Branch ORDER is contractual:
/// severeFlag wins over phase, phase over explicitDeload, etc. Branch 4
/// (controlled-reload) needs e1rmTrendUp && recoveryHigh, which iOS-4B2 supplies
/// as false — so it never fires here (deferred to iOS-4B3).
func sessionIntentFor(
    effectivePhase: EffectiveTrainingPhase,
    severeFlag: Bool,
    explicitDeload: Bool,
    e1rmTrendUp: Bool,
    recoveryHigh: Bool
) -> SessionIntent {
    if severeFlag { return .severeRest }
    if effectivePhase.activePhase == .reentry || effectivePhase.activePhase == .restart {
        return .reentryProductive
    }
    if explicitDeload || effectivePhase.activePhase == .deload { return .deloadWeek }
    if e1rmTrendUp && recoveryHigh { return .controlledReload }
    return .normalSession
}

// MARK: - Public entry

/// iOS-4B2 core slice entry. Mirrors buildTrainingDecisionFromCleanInput
/// (trainingDecisionCleanInput.ts:232) but computes ONLY effectivePhase +
/// sessionIntent and returns a narrow TrainingDecisionCoreSlice. The brand is a
/// compile-time guarantee (CleanTrainingDecisionInput has no public init), so no
/// runtime brand-assert is needed. `surfaces` is accepted for forward-compat and
/// ignored in 4B2.
public func buildTrainingDecisionFromCleanInput(
    _ input: CleanTrainingDecisionInput,
    surfaces: TrainingDecisionSurfaceInputs? = nil
) -> TrainingDecisionCoreSlice {
    // referenceDate is the injected clock: nowIso.slice(0,10). NO system clock.
    let referenceDate = input.nowIso.map { String($0.prefix(10)) } ?? ""

    let effectivePhase = EffectiveTrainingPhaseEngine.getEffectiveTrainingPhase(
        mesocyclePlan: input.mesocyclePlan,
        history: input.history,
        referenceDate: referenceDate
    )

    // severeFlag (trainingDecisionEngine.ts:1914) — metadata flags only.
    let severeFlag = (input.acutePainReported ?? false)
        || (input.injuryFlag ?? false)
        || (input.illnessFlag ?? false)

    // DEFERRED to iOS-4B3 (Readiness + e1RM Slice): the controlled-reload branch
    // of sessionIntentFor needs e1rmTrendUp = isE1rmTrendUp(history) AND
    // recoveryHigh = (readiness.level == "low"). readinessEngine and the e1RM
    // trend are OUT of iOS-4B2 scope, so both are hard-wired false here. This is
    // intentional, not an omission: controlled-reload-v1 therefore computes
    // 'normal-session' in 4B2, and its golden sessionIntent is NOT matched until
    // iOS-4B3 wires readiness.
    let e1rmTrendUp = false
    let recoveryHigh = false

    let intent = sessionIntentFor(
        effectivePhase: effectivePhase,
        severeFlag: severeFlag,
        explicitDeload: input.explicitDeloadAssigned ?? false,
        e1rmTrendUp: e1rmTrendUp,
        recoveryHigh: recoveryHigh
    )

    // The partial AR trace this slice owns (trainingDecisionEngine.ts:1915, 1927).
    // The full ordered trace (clamp/deload/prescription/progress codes) is 4B3+.
    var arbitrationTrace: [String] = []
    if severeFlag { arbitrationTrace.append("AR-1-severe-override") }
    if intent == .reentryProductive { arbitrationTrace.append("AR-2-reentry-override") }

    return TrainingDecisionCoreSlice(
        sessionIntent: intent,
        activePhase: effectivePhase.activePhase,
        effectivePhase: effectivePhase,
        arbitrationTrace: arbitrationTrace
    )
}
