// PA-S3 — DEFAULT_PROGRAM_TEMPLATE data port (pure data, read-only).
//
// Faithful 1:1 Swift transcription of `retired web reference` and the THREE private helpers it reads:
//   retired-web-reference   unique                  -> DefaultTrainingData.uniqueStable
//   retired-web-reference   focusMusclesForTemplate -> DefaultTrainingData.focusMusclesForTemplate
//   retired-web-reference   defaultCorrectionBlocks -> DefaultTrainingData.defaultCorrectionBlocks
//   retired-web-reference  defaultFunctionalBlocks -> DefaultTrainingData.defaultFunctionalBlocks
//
// The legacy web schema `ProgramTemplate` is RICH; the Swift `ProgramTemplate` (PA-S1) is the
// THIN persisted struct whose rich fields (`weeklyMuscleTargets` / `dayTemplates`)
// ride the `_unknown` open bag and are read back via the `ProgramTemplate+PARich`
// projections. So this constant sets the seven thin typed scalars and carries the
// two rich fields through `_unknown` — byte-faithful to the rich legacy web schema JSON shape
// (the parity golden reconciles the full projection).
//
// `DEFAULT_MESOCYCLE_PLAN` (defaults.ts:114) is OUT OF SCOPE — it carries
// `new Date().toISOString()` (a wall clock) and is referenced by NONE of this
// slice's six constants; DEFAULT_PROGRAM_TEMPLATE does not depend on it.
//
// Pure data: no runtime logic beyond the deterministic projection, no write path,
// no `: Date`, no clock.

import Foundation
import RedeDomain

extension DefaultTrainingData {

    // MARK: - DEFAULT_PROGRAM_TEMPLATE (defaults.ts:83-112)

    public static let defaultProgramTemplate: ProgramTemplate = ProgramTemplate(
        id: "program-hypertrophy-support",
        userId: "local-user",
        primaryGoal: "hypertrophy",
        splitType: "upper_lower",
        daysPerWeek: .integer(4),
        correctionStrategy: .string("moderate"),
        functionalStrategy: .string("standard"),
        // The two RICH PA fields ride the open bag (PA-S1 thin/rich reconciliation).
        _unknown: OrderedJSONObject(entries: [
            // weeklyMuscleTargets (defaults.ts:91-102)
            .init(key: "weeklyMuscleTargets", value: .object(OrderedJSONObject(entries: [
                .init(key: "chest", value: .number(.integer(12))),
                .init(key: "back", value: .number(.integer(14))),
                .init(key: "quads", value: .number(.integer(10))),
                .init(key: "hamstrings", value: .number(.integer(8))),
                .init(key: "glutes", value: .number(.integer(8))),
                .init(key: "shoulders", value: .number(.integer(10))),
                .init(key: "biceps", value: .number(.integer(8))),
                .init(key: "triceps", value: .number(.integer(8))),
                .init(key: "calves", value: .number(.integer(6))),
                .init(key: "abs", value: .number(.integer(6))),
            ]))),
            // dayTemplates = INITIAL_TEMPLATES.map(...) (defaults.ts:103-111)
            .init(key: "dayTemplates", value: .array(dayTemplates.map { $0.encoded() })),
        ])
    )

    /// `DEFAULT_PROGRAM_TEMPLATE.dayTemplates` (defaults.ts:103-111) as typed
    /// `DayTemplate`s, projected from `initialTemplates`.
    static let dayTemplates: [DayTemplate] = initialTemplates.map { template in
        DayTemplate(
            id: template.id,
            name: template.name,
            focusMuscles: focusMusclesForTemplate(template),
            correctionBlockIds: defaultCorrectionBlocks(template.id ?? ""),
            mainExerciseIds: template.exercises?.compactMap { $0.id } ?? [],
            functionalBlockIds: defaultFunctionalBlocks(template.id ?? ""),
            estimatedDurationMin: template.duration
        )
    }

    // MARK: - Private helpers (defaults.ts:4-21)

    /// `unique` (defaults.ts:4) — `[...new Set(values)]`, order-preserving.
    static func uniqueStable(_ values: [String]) -> [String] {
        orderPreservingUnique(values)
    }

    /// `focusMusclesForTemplate` (defaults.ts:6) —
    /// `unique(template.exercises.map(e => e.muscle).filter(Boolean))`.
    static func focusMusclesForTemplate(_ template: TrainingTemplate) -> [String] {
        let muscles = (template.exercises ?? []).compactMap { $0.muscle }.filter { !$0.isEmpty }
        return uniqueStable(muscles)
    }

    /// `defaultCorrectionBlocks` (defaults.ts:9-14). Branch ORDER is load-bearing
    /// (first match returns) — mirror the legacy web schema if-chain verbatim.
    static func defaultCorrectionBlocks(_ templateId: String) -> [String] {
        if templateId.contains("push") || templateId.contains("upper") {
            return ["corr_upper_crossed_01", "corr_scapular_control_01"]
        }
        if templateId.contains("pull") {
            return ["corr_scapular_control_01", "corr_thoracic_rotation_01"]
        }
        if templateId.contains("leg") || templateId.contains("lower") {
            return ["corr_ankle_mobility_01", "corr_core_control_01"]
        }
        return []
    }

    /// `defaultFunctionalBlocks` (defaults.ts:16-21). Branch ORDER is load-bearing
    /// (first match returns); the fallback is the carry block — mirror verbatim.
    static func defaultFunctionalBlocks(_ templateId: String) -> [String] {
        if templateId.contains("push") || templateId.contains("upper") {
            return ["func_overhead_stability_01"]
        }
        if templateId.contains("pull") {
            return ["func_core_anti_rotation_01"]
        }
        if templateId.contains("leg") || templateId.contains("lower") {
            return ["func_single_leg_01"]
        }
        return ["func_carry_capacity_01"]
    }
}
