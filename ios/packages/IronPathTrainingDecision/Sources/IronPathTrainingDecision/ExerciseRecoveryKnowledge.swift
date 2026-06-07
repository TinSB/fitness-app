// SC-0 — exercise-recovery knowledge (pure data port, scheduling-track foundation).
//
// The recovery-conflict engines (DEFERRED to a later SC slice per the SC-1 §27 note)
// merge each exercise with EXERCISE_KNOWLEDGE_OVERRIDES and read a muscle-metadata
// slice WIDER than the smart/replacement ports captured:
//   exerciseRecoveryConflictEngine.ts:163  meta.secondaryMuscles  (scoreExerciseForSource)
//   exerciseRecoveryConflictEngine.ts:166  meta.muscleContribution
//   recoveryAwareScheduler.ts:178          meta.secondaryMuscles  (scoreExerciseForArea)
//   recoveryAwareScheduler.ts:181          meta.muscleContribution
//
// SR-3 (SmartReplacementKnowledge) already ported movementPattern / primaryMuscles /
// skillDemand / kind / contraindications and SR-2 (ReplacementEngineKnowledge) ported
// fatigueCost — and SR-3's header states `secondaryMuscles` + `muscleContribution` are
// "NOT read by the smart engine → intentionally NOT ported". This file ports ONLY those
// two genuinely-missing fields (the recovery engines, when ported, read primaryMuscles /
// skillDemand / movementPattern from SmartReplacementKnowledge and fatigueCost from
// ReplacementEngineKnowledge — none re-ported here). `muscle` is read from the exercise
// TEMPLATE, never the override (0 overrides define a top-level `muscle`), so it is not a
// field here.
//
// Entries are in EXACT legacy web schema source order (exerciseLibrary.ts:486-1497), the same order as
// SmartReplacementKnowledge.overrideEntries — the parity test asserts the id universe of
// the two tables is identical (one 63-id override universe, not two). EVERY override
// defines both fields (the golden counts withSecondaryMuscles == withMuscleContribution ==
// 63); `secondaryMuscles` may be an empty array (a DEFINED `[]`, e.g. cable-fly). Values
// transcribed verbatim from the GENERATED `exercise-recovery/knowledge-snapshot-v1` golden
// (produced from the REAL retired-web-reference via retired fixture generator,
// never hand-authored — §22); the `ExerciseRecoveryKnowledgeParityTests` compute-assert
// reconciles every entry item-by-item, so no value can drift in transcription. No IO, no
// clock, zero `: Date`, deterministic.

import Foundation

/// The recovery-engine-used ADDITIONAL slice of one EXERCISE_KNOWLEDGE_OVERRIDES value
/// (the two muscle-metadata fields SR-2/SR-3 left out). Both fields are present on every
/// override (`secondaryMuscles` may be empty); `muscleContribution` is keyed by the
/// single-char muscle labels (胸/背/腿/肩/手臂) the legacy web schema data carries verbatim.
struct RecoveryOverride: Equatable, Sendable {
    let secondaryMuscles: [String]
    let muscleContribution: [String: Double]
}

/// The recovery engines' ADDITIONAL pure knowledge base. A namespace enum (no instances).
/// Consumes the SR-3 / SR-2 ports for the other override fields; ports ONLY
/// secondaryMuscles + muscleContribution.
enum ExerciseRecoveryKnowledge {
    // MARK: - EXERCISE_KNOWLEDGE_OVERRIDES recovery fields (exerciseLibrary.ts:485-1498)
    //
    // 63 ids, EXACT legacy web schema source order (== SmartReplacementKnowledge.overrideEntries order).
    static let overrideEntries: KeyValuePairs<String, RecoveryOverride> = [
        "bench-press": RecoveryOverride(secondaryMuscles: ["肩", "手臂"], muscleContribution: ["胸": 1, "手臂": 0.5, "肩": 0.4]),
        "incline-db-press": RecoveryOverride(secondaryMuscles: ["肩", "手臂"], muscleContribution: ["胸": 1, "肩": 0.5, "手臂": 0.4]),
        "smith-incline-press": RecoveryOverride(secondaryMuscles: ["肩", "手臂"], muscleContribution: ["胸": 1, "肩": 0.5, "手臂": 0.4]),
        "machine-incline-chest-press": RecoveryOverride(secondaryMuscles: ["肩", "手臂"], muscleContribution: ["胸": 1, "肩": 0.45, "手臂": 0.35]),
        "machine-chest-press": RecoveryOverride(secondaryMuscles: ["肩", "手臂"], muscleContribution: ["胸": 1, "肩": 0.4, "手臂": 0.4]),
        "cable-fly": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["胸": 1]),
        "pec-deck-fly": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["胸": 1]),
        "db-fly": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["胸": 1]),
        "lateral-raise": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["肩": 1]),
        "triceps-pushdown": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "lat-pulldown": RecoveryOverride(secondaryMuscles: ["手臂"], muscleContribution: ["背": 1, "手臂": 0.4]),
        "single-arm-lat-pulldown": RecoveryOverride(secondaryMuscles: ["手臂"], muscleContribution: ["背": 1, "手臂": 0.4]),
        "seated-row": RecoveryOverride(secondaryMuscles: ["手臂", "肩"], muscleContribution: ["背": 1, "手臂": 0.4, "肩": 0.3]),
        "machine-row": RecoveryOverride(secondaryMuscles: ["手臂"], muscleContribution: ["背": 1, "手臂": 0.4]),
        "chest-supported-row": RecoveryOverride(secondaryMuscles: ["手臂", "肩"], muscleContribution: ["背": 1, "手臂": 0.4, "肩": 0.25]),
        "barbell-row": RecoveryOverride(secondaryMuscles: ["腿", "手臂"], muscleContribution: ["背": 1, "手臂": 0.4, "腿": 0.2]),
        "t-bar-row": RecoveryOverride(secondaryMuscles: ["手臂", "腿"], muscleContribution: ["背": 1, "手臂": 0.4, "腿": 0.2]),
        "face-pull": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["肩": 0.8, "背": 0.25]),
        "reverse-pec-deck": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["肩": 0.85, "背": 0.2]),
        "cable-rear-delt-fly": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["肩": 0.85, "背": 0.2]),
        "rear-delt-raise": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["肩": 0.85, "背": 0.2]),
        "db-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "hammer-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "ez-bar-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "cable-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "incline-db-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "rope-hammer-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "squat": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["腿": 1, "背": 0.4]),
        "hack-squat": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "smith-squat": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["腿": 1, "背": 0.25]),
        "leg-press": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "belt-squat": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "romanian-deadlift": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["腿": 1, "背": 0.5]),
        "db-rdl": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["腿": 1, "背": 0.4]),
        "leg-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "seated-leg-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "lying-leg-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "nordic-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "calf-raise": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 0.8]),
        "seated-calf-raise": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 0.8]),
        "standing-calf-raise": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 0.8]),
        "leg-press-calf-raise": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 0.8]),
        "shoulder-press": RecoveryOverride(secondaryMuscles: ["手臂", "胸"], muscleContribution: ["肩": 1, "手臂": 0.5, "胸": 0.2]),
        "machine-shoulder-press": RecoveryOverride(secondaryMuscles: ["手臂", "胸"], muscleContribution: ["肩": 1, "手臂": 0.4, "胸": 0.15]),
        "smith-shoulder-press": RecoveryOverride(secondaryMuscles: ["手臂", "胸"], muscleContribution: ["肩": 1, "手臂": 0.45, "胸": 0.15]),
        "cable-lateral-raise": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["肩": 1]),
        "machine-lateral-raise": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["肩": 1]),
        "close-grip-bench": RecoveryOverride(secondaryMuscles: ["胸", "肩"], muscleContribution: ["手臂": 1, "胸": 0.6, "肩": 0.3]),
        "preacher-curl": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "straight-bar-pushdown": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "overhead-cable-triceps-extension": RecoveryOverride(secondaryMuscles: ["肩"], muscleContribution: ["手臂": 1, "肩": 0.15]),
        "skull-crusher": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["手臂": 1]),
        "assisted-dip": RecoveryOverride(secondaryMuscles: ["手臂", "肩"], muscleContribution: ["胸": 1, "手臂": 0.6, "肩": 0.3]),
        "db-bench-press": RecoveryOverride(secondaryMuscles: ["肩", "手臂"], muscleContribution: ["胸": 1, "手臂": 0.5, "肩": 0.4]),
        "one-arm-db-row": RecoveryOverride(secondaryMuscles: ["手臂"], muscleContribution: ["背": 1, "手臂": 0.4]),
        "goblet-squat": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["腿": 1, "背": 0.2]),
        "push-up": RecoveryOverride(secondaryMuscles: ["肩", "手臂"], muscleContribution: ["胸": 1, "手臂": 0.45, "肩": 0.35]),
        "pull-up": RecoveryOverride(secondaryMuscles: ["手臂"], muscleContribution: ["背": 1, "手臂": 0.5]),
        "assisted-pull-up": RecoveryOverride(secondaryMuscles: ["手臂"], muscleContribution: ["背": 1, "手臂": 0.45]),
        "deadlift": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["腿": 1, "背": 0.6]),
        "hip-thrust": RecoveryOverride(secondaryMuscles: ["背"], muscleContribution: ["腿": 1, "背": 0.2]),
        "leg-extension": RecoveryOverride(secondaryMuscles: [], muscleContribution: ["腿": 1]),
        "landmine-press": RecoveryOverride(secondaryMuscles: ["胸", "手臂"], muscleContribution: ["肩": 1, "手臂": 0.35, "胸": 0.35]),
    ]

    // MARK: - Derived lookups

    /// O(1) override lookup by id, derived from the ordered table.
    static let overrides: [String: RecoveryOverride] = {
        var dict = [String: RecoveryOverride](minimumCapacity: overrideEntries.count)
        for (key, value) in overrideEntries { dict[key] = value }
        return dict
    }()

    /// The override id universe in EXACT legacy web schema `Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES)`
    /// source order — identical to SmartReplacementKnowledge.overrideIds (asserted by the
    /// parity test: one override universe, not two).
    static let overrideIds: [String] = overrideEntries.map { $0.key }
}
