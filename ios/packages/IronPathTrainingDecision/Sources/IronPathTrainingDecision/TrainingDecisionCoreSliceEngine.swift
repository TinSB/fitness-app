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
// iOS-4B4 added the deload + clamp + modes slice (finalVolumeMultiplier + modes).
// iOS-4B5 adds the exercise prescription / volume-floor slice: roleOf + role floors +
// the prescribeExercise/applyStatusRules set pipeline + the adaptive conservativeLevel
// cut -> perExercise / allTargetSets / minTargetSets / exerciseRoleFloors. The clean
// input now carries the full template exercises (the engine enriches them via the
// bounded knowledge map). See TrainingDecisionExercisePrescription.swift.
//
// iOS-17e-5 wires the history-driven weekly progression projection: the weeklyAdjustment
// object (direction/magnitudePct/blockedBy/appliesFromIsoDate) is now produced from the
// recorded performed sets via the SAME branch order as TS (e1rmTrendUp -> increase),
// closing the loop the 17e-0 history goldens pinned. See TrainingDecisionModes.buildWeeklyAdjustment.
//
// OUT OF SCOPE (iOS-4B6+ / deferred): the support plan object, userFacing text, and the
// full ordered arbitrationTrace. This file MUST NOT reference the supportPlan engine /
// the buildXxxUserFacing presenters / the full arbitrationTrace builder /
// buildHealthSummary aggregation / buildTrainingLapseSignal.

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
/// CleanTrainingDecisionInputMetadata (trainingDecisionCleanInput.ts:82). The TS
/// metadata carries the full `template`; iOS-4B4 needs only `template.duration` (for
/// the readiness time-gap penalty), so `templateDurationMin` is carried — the full
/// template arrives with the prescription slice (iOS-4B5).
public struct CleanTrainingDecisionInputMetadata: Sendable {
    public var nowIso: String?
    public var trainingMode: String?
    public var acutePainReported: Bool?
    public var injuryFlag: Bool?
    public var illnessFlag: Bool?
    public var explicitDeloadAssigned: Bool?
    public var useHealthDataForReadiness: Bool?
    /// `template.duration` — the planned session minutes, for the readiness time-gap
    /// penalty (readinessEngine.ts:68). nil -> no penalty.
    public var templateDurationMin: Double?
    /// `template.exercises` — the raw template exercises the iOS-4B5 prescription
    /// slice consumes (the engine enriches them). Empty -> no perExercise output.
    public var templateExercises: [TrainingDecisionTemplateExercise]

    public init(
        nowIso: String? = nil,
        trainingMode: String? = nil,
        acutePainReported: Bool? = nil,
        injuryFlag: Bool? = nil,
        illnessFlag: Bool? = nil,
        explicitDeloadAssigned: Bool? = nil,
        useHealthDataForReadiness: Bool? = nil,
        templateDurationMin: Double? = nil,
        templateExercises: [TrainingDecisionTemplateExercise] = []
    ) {
        self.nowIso = nowIso
        self.trainingMode = trainingMode
        self.acutePainReported = acutePainReported
        self.injuryFlag = injuryFlag
        self.illnessFlag = illnessFlag
        self.explicitDeloadAssigned = explicitDeloadAssigned
        self.useHealthDataForReadiness = useHealthDataForReadiness
        self.templateDurationMin = templateDurationMin
        self.templateExercises = templateExercises
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
    // --- Consumed by the core slice (4B2 phase, 4B3 readiness/e1RM, 4B4 deload/modes) ---
    public let history: [TrainingSession]
    public let mesocyclePlan: MesocyclePlan?
    public let nowIso: String?
    public let acutePainReported: Bool?
    public let injuryFlag: Bool?
    public let illnessFlag: Bool?
    public let explicitDeloadAssigned: Bool?
    public let todayStatus: TodayStatus
    public let screening: ScreeningProfile
    public let useHealthDataForReadiness: Bool?
    /// `template.duration` for the readiness time-gap penalty (iOS-4B4).
    public let templateDurationMin: Double?
    /// `template.exercises` for the iOS-4B5 prescription slice.
    public let templateExercises: [TrainingDecisionTemplateExercise]

    // --- Carried for forward-compat / signature stability; NOT read yet ---
    public let trainingMode: String?

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
        useHealthDataForReadiness: Bool?,
        templateDurationMin: Double?,
        templateExercises: [TrainingDecisionTemplateExercise]
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
        self.templateDurationMin = templateDurationMin
        self.templateExercises = templateExercises
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
    // Resolve useHealthDataForReadiness mirroring TS resolveUseHealthDataForReadiness
    // (trainingDecisionCleanInput.ts:147): an explicit metadata override wins;
    // otherwise a stale-for-readiness health signal forces false (e.g.
    // stale-health-data-v1's 30-day-old sample > 14d threshold), else the clean
    // view's raw setting flag is used.
    let resolvedUseHealth = metadata.useHealthDataForReadiness
        ?? (cleanView.healthData.staleForReadiness ? false : cleanView.healthData.useHealthDataForReadiness)
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
        useHealthDataForReadiness: resolvedUseHealth,
        templateDurationMin: metadata.templateDurationMin,
        templateExercises: metadata.templateExercises
    )
}

// MARK: - Core slice result

/// The TrainingDecision engine output so far — ONLY what the ported slices
/// compute. A narrow type (not a full TrainingDecision) so no unported field is
/// fabricated. iOS-4B3 adds the readiness + e1RM + riskLevel fields.
public struct TrainingDecisionCoreSlice: Equatable, Sendable {
    public let sessionIntent: SessionIntent
    public let activePhase: ActivePhase
    public let effectivePhase: EffectiveTrainingPhase
    // --- iOS-4B3 readiness + e1RM ---
    public let readinessLevel: ReadinessLevel
    /// `readiness.level == .low` (trainingDecisionEngine.ts:1918) — the
    /// controlled-reload driver alongside e1rmTrendUp.
    public let recoveryHigh: Bool
    public let e1rmTrendUp: Bool
    public let riskLevel: RiskLevel
    /// Resolved clean-input contract gate (false when health data is stale).
    public let useHealthDataForReadiness: Bool?
    // --- iOS-4B4 deload + clamp + modes ---
    /// `readiness.trainingAdjustment` — feeds intensityMode (trainingDecisionEngine.ts:1998).
    public let trainingAdjustment: ReadinessTrainingAdjustment
    /// clampMultiplier over the adaptive deload (trainingDecisionEngine.ts:1930).
    public let finalVolumeMultiplier: Double
    public let volumeMode: VolumeMode
    public let intensityMode: IntensityMode
    public let progressionMode: ProgressionMode
    /// iOS-17e-5: the history-driven weekly progression projection
    /// (trainingDecisionEngine.ts:2079-2087). direction/magnitudePct/blockedBy/
    /// appliesFromIsoDate are produced by the SAME branch order as TS — a rising
    /// e1RM trend over performed sets yields direction='increase', a flat/too-short
    /// history holds. Golden-parity-asserted (closed loop: engine now consumes the
    /// recorded sets to adapt the weekly recommendation).
    public let weeklyAdjustment: WeeklyAdjustment
    /// iOS-8: the adaptive deload decision (level/strategy/triggered/volumeMultiplier/
    /// reasons) that already feeds clampMultiplier (line ~300). Exposed verbatim so the
    /// native Focus surface can show the real deload level/strategy instead of "—".
    /// This is the engine's own computed value wired through 1:1 — NOT recomputed or
    /// fabricated, and NOT golden-parity-asserted (no golden carries a deload field).
    public let deload: DeloadDecision
    // --- iOS-4B5 exercise prescription + volume floor ---
    /// workingSetTargets (trainingDecisionEngine.ts:1968) — the golden `perExercise`
    /// projection (exerciseId / role / targetSets). Empty when no template is supplied.
    public let perExercise: [WorkingSetTarget]
    /// allTargetSets / minTargetSets (parityGoldensEntry.ts:654-655).
    public let allTargetSets: [Int]
    public let minTargetSets: Int?
    /// exerciseRoleFloors (trainingDecisionEngine.ts:1937) — the 4-key role floor map.
    public let exerciseRoleFloors: [ExerciseRole: Int]
    /// The AR codes the core slice can legitimately emit (AR-1 / AR-2 / AR-5 only).
    /// The golden's FULL ordered arbitrationTrace is deferred to iOS-4B6 and is NOT
    /// compared against this. (clampMultiplier's clampReasons are computed but not
    /// folded into this partial trace yet — full assembly is iOS-4B6.)
    public let arbitrationTrace: [String]
}

// MARK: - sessionIntent

/// sessionIntentFor (trainingDecisionEngine.ts:196). Branch ORDER is contractual:
/// severeFlag wins over phase, phase over explicitDeload, etc. Branch 4
/// (controlled-reload) fires on e1rmTrendUp && recoveryHigh — both now wired by
/// iOS-4B3's readiness + e1RM slices.
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

/// TrainingDecision engine entry. Mirrors buildTrainingDecisionFromCleanInput
/// (trainingDecisionCleanInput.ts:232). As of iOS-4B3 it computes effectivePhase +
/// readiness + e1RM trend + sessionIntent + riskLevel, returning a narrow
/// TrainingDecisionCoreSlice (prescription / deload / modes / userFacing remain
/// iOS-4B4+). The brand is a compile-time guarantee (CleanTrainingDecisionInput has
/// no public init), so no runtime brand-assert is needed. `surfaces` is accepted
/// for forward-compat and ignored.
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

    // iOS-4B3/4B4 readiness: subjective + time-gap penalty (templateDurationMin) +
    // health-summary delta. The engine passes healthSummary: nil — buildHealthSummary
    // aggregation is deferred (iOS-4B5) and no golden supplies usable non-stale health
    // data. recoveryHigh = readiness.level == .low (trainingDecisionEngine.ts:1918);
    // e1rmTrendUp = isE1rmTrendUp(history) (line 1917).
    let readiness = TrainingDecisionReadiness.buildTodayReadiness(
        todayStatus: input.todayStatus,
        history: input.history,
        templateDurationMin: input.templateDurationMin,
        healthSummary: nil,
        useHealthDataForReadiness: input.useHealthDataForReadiness
    )
    let recoveryHigh = readiness.level == .low
    let e1rmTrendUp = TrainingDecisionE1RMTrend.isE1rmTrendUp(history: input.history)
    let painCount = TrainingDecisionReadiness.collectPainAreasFromHistory(input.history).count
    let riskLevel = TrainingDecisionReadiness.riskLevelFor(
        severeFlag: severeFlag,
        readinessLevel: readiness.level,
        painCount: painCount
    )

    // Adaptive deload (subset) feeds clampMultiplier (trainingDecisionEngine.ts:1900-1934).
    let deload = TrainingDecisionDeload.buildAdaptiveDeloadDecision(
        history: input.history,
        todayStatus: input.todayStatus,
        screening: input.screening
    )

    let intent = sessionIntentFor(
        effectivePhase: effectivePhase,
        severeFlag: severeFlag,
        explicitDeload: input.explicitDeloadAssigned ?? false,
        e1rmTrendUp: e1rmTrendUp,
        recoveryHigh: recoveryHigh
    )

    // finalVolumeMultiplier + the three modes (trainingDecisionEngine.ts:1930-1999).
    let clamp = TrainingDecisionModes.clampMultiplier(
        effectivePhase: effectivePhase,
        deload: deload,
        severeFlag: severeFlag
    )
    let finalVolumeMultiplier = clamp.multiplier
    let volumeMode = TrainingDecisionModes.volumeModeFor(intent: intent, multiplier: finalVolumeMultiplier)
    let intensityMode = TrainingDecisionModes.intensityModeFor(intent: intent, trainingAdjustment: readiness.trainingAdjustment)
    let progressionMode = TrainingDecisionModes.progressionModeFor(intent: intent, e1rmTrendUp: e1rmTrendUp)

    // iOS-17e-5 weekly progression projection (trainingDecisionEngine.ts:1985-1995,
    // 2079-2087). Closed loop: e1rmTrendUp is derived from the recorded performed sets
    // (TrainingDecisionE1RMTrend over history), so a rising trend drives an 'increase'
    // weekly recommendation while a flat / too-short history holds. nowIso supplies
    // appliesFromIsoDate (the injected clock — no system time).
    let weekly = TrainingDecisionModes.buildWeeklyAdjustment(
        intent: intent,
        severeFlag: severeFlag,
        explicitDeloadAssigned: input.explicitDeloadAssigned ?? false,
        e1rmTrendUp: e1rmTrendUp,
        nowIso: input.nowIso
    )

    // iOS-4B5 exercise prescription: roleOf + role floors + the applyStatusRules set
    // pipeline + the adaptive conservativeLevel cut -> workingSetTargets. Consumes the
    // already-computed readiness (trainingAdjustment + level) + deload.level +
    // finalVolumeMultiplier + intent. correctionPriority from the cleaned screening.
    let prescription = TrainingDecisionExercisePrescription.buildWorkingSetTargets(
        templateExercises: input.templateExercises,
        todayStatus: input.todayStatus,
        readiness: readiness,
        deloadLevel: deload.level,
        finalVolumeMultiplier: finalVolumeMultiplier,
        intent: intent,
        correctionPriority: input.screening.correctionPriority ?? []
    )
    let perExercise = prescription.targets
    let allTargetSets = perExercise.map { $0.targetSets }
    let minTargetSets = allTargetSets.min()

    // The partial AR trace this slice owns (trainingDecisionEngine.ts:1915, 1927,
    // 1928). clampMultiplier's clampReasons are NOT folded in yet — the full ordered
    // trace (clamp/prescription/weekly/progress codes) is iOS-4B6.
    var arbitrationTrace: [String] = []
    if severeFlag { arbitrationTrace.append("AR-1-severe-override") }
    if intent == .reentryProductive { arbitrationTrace.append("AR-2-reentry-override") }
    if intent == .controlledReload { arbitrationTrace.append("AR-5-controlled-reload") }

    return TrainingDecisionCoreSlice(
        sessionIntent: intent,
        activePhase: effectivePhase.activePhase,
        effectivePhase: effectivePhase,
        readinessLevel: readiness.level,
        recoveryHigh: recoveryHigh,
        e1rmTrendUp: e1rmTrendUp,
        riskLevel: riskLevel,
        useHealthDataForReadiness: input.useHealthDataForReadiness,
        trainingAdjustment: readiness.trainingAdjustment,
        finalVolumeMultiplier: finalVolumeMultiplier,
        volumeMode: volumeMode,
        intensityMode: intensityMode,
        progressionMode: progressionMode,
        weeklyAdjustment: weekly.adjustment,
        deload: deload,
        perExercise: perExercise,
        allTargetSets: allTargetSets,
        minTargetSets: minTargetSets,
        exerciseRoleFloors: prescription.exerciseRoleFloors,
        arbitrationTrace: arbitrationTrace
    )
}
