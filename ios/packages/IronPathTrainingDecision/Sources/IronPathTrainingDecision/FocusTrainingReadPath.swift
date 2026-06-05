// FocusTrainingReadPath — FU-1 Focus live "today's training" read path.
//
// Until FU-1 the native Focus (做训练) surface ran the engine over a fixed
// deterministic SAMPLE (`FocusModePreviewData` + a scenario picker). This file adds
// the pure, testable orchestration that turns an already-cleaned canonical view into
// the SAME `TrainingDecisionCoreSlice` the Focus surface renders — but computed from
// the user's REAL on-device data. It does NOT write, does NOT change any engine, and
// touches no parity golden (additive presentation/orchestration — master §19.2, the
// same shape as `resolveTodayReadinessState` / `resolveNextWorkoutScheduleState`).
//
// It is pure COMPOSITION of already-ported pieces (no new engine, no new write path):
//   1. `decodeTrainingTemplates` (NextWorkoutReadPath, FU-1-seeded empty→
//      DefaultTrainingData.initialTemplates) — the user's day templates.
//   2. `TodayStateEngine.buildTodayTrainingState` (SC-B) — the rotation anchor.
//   3. `NextWorkoutScheduler.buildNextWorkoutRecommendation` (SC-C) — resolves WHICH
//      template is today's training (its `templateId`). The scheduler already handles
//      the no-history case (anchorSession == nil → the first ordered template), so a
//      fresh user lands on the default program's first day rather than an empty Focus.
//   4. The resolved template's `exercises` → the engine input DTO
//      `TrainingDecisionTemplateExercise` (a thin field projection; the engine itself
//      enriches orderPriority / contraindications via its bounded knowledge map).
//   5. `createCleanTrainingDecisionInput` + `buildTrainingDecisionFromCleanInput`
//      (iOS-4B2/4B5) — the SAME branded clean-input engine entry the sample path uses.
//
// HARD CONTRACT (master §10/§11): raw AppData never reaches the engine — the app-layer
// loader builds the clean view via DataHealth `buildCleanAppDataView` (the §10
// chokepoint, which this package may not perform itself) and hands the resolver the
// resulting `CleanAppDataView`; the resolver only plucks individual clean fields and
// the CONFIG `templates` slot (the precedent set by `createCleanTrainingDecisionInput`
// / the SC read path). Determinism is preserved (§11.2): the instant is INJECTED
// (`now`) — both the engine `nowIso` and the scheduler anchor derive from it, never an
// ambient `Date()` here.
//
// Honesty (master §15.4): `.missing` (no canonical file / first launch / no live
// source) → `.empty`; `.unreadable` (a present but unparseable document) →
// `.unavailable` (degrade, never crash, never overwrite). A loaded view ALWAYS resolves
// a today's-training plan (the empty-templates seed + the scheduler's no-history branch
// guarantee one) — empty/unavailable are reserved for genuinely absent/unreadable data,
// never for "has data but no template".

import Foundation
import IronPathDomain
import IronPathDataHealth

/// The resolved Focus "today's training" plan the thin SwiftUI layer renders. Carries the
/// engine slice the summary/status surface reads AND the template exercises the today-list
/// rows are built from (the same pair the sample path supplied via
/// `FocusModePreviewData.sampleCoreSlice` + `sampleTemplateExercises`).
public struct FocusTrainingPlan: Equatable, Sendable {
    /// The TrainingDecision engine output for today's resolved template (real data).
    public let slice: TrainingDecisionCoreSlice
    /// Today's resolved template exercises, projected to the engine input DTO — the
    /// `rows.templates` source (joined with `slice.perExercise` by exercise id).
    public let templateExercises: [TrainingDecisionTemplateExercise]
    /// The resolved template's id (the scheduler's recommended/planned day), if any.
    public let templateId: String?
    /// The scheduler's localized day name (read-only display).
    public let templateName: String

    public init(
        slice: TrainingDecisionCoreSlice,
        templateExercises: [TrainingDecisionTemplateExercise],
        templateId: String?,
        templateName: String
    ) {
        self.slice = slice
        self.templateExercises = templateExercises
        self.templateId = templateId
        self.templateName = templateName
    }
}

/// The resolved Focus state the thin SwiftUI layer renders verbatim. Mirrors
/// `TodayReadinessState` / `NextWorkoutScheduleState`.
public enum FocusTrainingState: Equatable, Sendable {
    /// A real today's-training plan computed from the user's cleaned canonical AppData.
    case ready(FocusTrainingPlan)
    /// No usable canonical data yet (missing file / first launch / no live source) — show an
    /// honest empty state, never a fabricated session.
    case empty
    /// A canonical document exists but is unreadable — honest degrade. The document is left
    /// untouched (read-only path; never overwritten).
    case unavailable
}

/// Pure resolver: maps a load outcome to the Focus state. The loaded view has already passed
/// through DataHealth (master §10); the resolver only feeds already-ported engines clean-derived
/// input and reads their output (master §11). `now` is the injected instant — it MUST match the
/// instant the loader used to build the clean view's guard clock, so the result is reproducible
/// for a given (`outcome`, `now`). Reuses `NextWorkoutAppDataLoadOutcome` (same load shape as the
/// SC read path — no new outcome type).
public func resolveFocusTrainingState(
    _ outcome: NextWorkoutAppDataLoadOutcome,
    now: Date
) -> FocusTrainingState {
    switch outcome {
    case .missing:
        return .empty
    case .unreadable:
        return .unavailable
    case .loaded(let cleanView):
        let nowIso = focusReferenceIso8601UTC(now)

        // CONFIG slots from the gated view's raw document (not history), exactly as the SC read
        // path reads them; `templates` rides un-promoted in `root["templates"]` (the PWA's
        // `data.templates`) and is FU-1-seeded (empty → DefaultTrainingData.initialTemplates) by
        // the shared `decodeTrainingTemplates`, so a fresh user gets the default program.
        let templates = decodeTrainingTemplates(cleanView)
        let programTemplate = cleanView.raw.programTemplate
        // trainingMode comes from the user's real settings (honest default nil when unset). It is
        // carried for forward-compat in the slice and used by the scheduler's reason label only —
        // it does not change the prescription (trainingDecisionCleanInput.ts forward-compat field).
        let trainingMode = cleanView.raw.settings.trainingMode

        // SC-B today state — the scheduler's rotation anchor, from the CLEANED history + active
        // session + the injected instant (never a wall clock here).
        let todayState = TodayStateEngine.buildTodayTrainingState(
            activeSession: cleanView.cleanedActiveSession,
            history: cleanView.cleanedHistory,
            plannedTemplateId: cleanView.raw.settings.selectedTemplateId,
            nowIso: nowIso
        )

        // SC-C — WHICH template is today's training. The un-ported context inputs (pain /
        // readiness / weekly volume) stay at their honest defaults; trainingMode rides through for
        // the reason label. Handles no-history internally (anchorSession == nil → first template).
        let recommendation = NextWorkoutScheduler.buildNextWorkoutRecommendation(
            history: cleanView.cleanedHistory,
            activeSession: cleanView.cleanedActiveSession,
            programTemplate: programTemplate,
            templates: templates,
            todayState: todayState,
            trainingMode: trainingMode
        )

        // Resolve the recommended day to a concrete template (then its exercises). Precedence:
        // the recommendation's own templateId (train / modified_train), else the recovery-chosen
        // recommendedTemplateId, else the planned day — finally the first ordered template. Post
        // empty-seed there is always at least one template, so the guard is purely defensive.
        let resolvedId = firstNonEmptyId([
            recommendation.templateId,
            recommendation.recommendedTemplateId,
            recommendation.plannedTemplateId,
        ])
        guard let template = templates.first(where: { $0.id == resolvedId }) ?? templates.first else {
            return .empty
        }
        let templateExercises = (template.exercises ?? []).compactMap(focusTemplateExercise(from:))

        // Mint the SAME branded clean input the sample path uses, now with the REAL resolved
        // template's exercises / duration. acutePainReported / explicitDeloadAssigned have no real
        // check-in source yet, so they stay nil (honest V1 scope — NEVER scenario-derived).
        let metadata = CleanTrainingDecisionInputMetadata(
            nowIso: nowIso,
            trainingMode: trainingMode,
            acutePainReported: nil,
            explicitDeloadAssigned: nil,
            templateDurationMin: template.duration?.doubleValue,
            templateExercises: templateExercises
        )
        let input = createCleanTrainingDecisionInput(cleanView: cleanView, metadata: metadata)
        let slice = buildTrainingDecisionFromCleanInput(input)
        return .ready(FocusTrainingPlan(
            slice: slice,
            templateExercises: templateExercises,
            templateId: template.id,
            templateName: recommendation.templateName
        ))
    }
}

/// Project a Domain `ExerciseTemplate` to the engine input DTO `TrainingDecisionTemplateExercise`.
/// A pure field projection (the same fields the sample `FocusModePreviewData.pushATemplateExercises`
/// hard-codes) — NOT template sanitization: the engine enriches orderPriority / contraindications /
/// linkedIssues internally. An entry with no usable id is skipped (never fabricated). Missing
/// optional fields fall back to neutral defaults (the engine clamps set counts to its role floors).
private func focusTemplateExercise(from exercise: ExerciseTemplate) -> TrainingDecisionTemplateExercise? {
    guard let id = exercise.id, !id.isEmpty else { return nil }
    return TrainingDecisionTemplateExercise(
        id: id,
        name: exercise.name ?? id,
        muscle: exercise.muscle ?? "",
        kind: exercise.kind ?? "",
        sets: exercise.sets?.intValue ?? 0,
        repMin: exercise.repMin?.intValue ?? 0,
        repMax: exercise.repMax?.intValue ?? 0
    )
}

/// First present, non-empty string in `candidates`, else nil (JS truthy `||` chain).
private func firstNonEmptyId(_ candidates: [String?]) -> String? {
    for candidate in candidates {
        if let candidate, !candidate.isEmpty { return candidate }
    }
    return nil
}

/// UTC ISO-8601 with fractional seconds (the engines' parity-clock format). Same helper shape as
/// the Today / Insights / SC read paths (each carries its own local copy).
private func focusReferenceIso8601UTC(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
}
