// SR-3 — Smart Replacement Engine knowledge (pure data port).
//
// The top-level smart-replacement engine (src/engines/smartReplacementEngine.ts)
// builds its candidate library from `Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES)`
// (smartReplacementEngine.ts:120) and reads, off every merged exercise, a WIDER
// slice of EXERCISE_KNOWLEDGE_OVERRIDES than the replacement engine does.
//
// SR-2 (ReplacementEngineKnowledge) already ported the replacement-engine-used
// subset of each override — `fatigueCost`, `equivalenceChainId`, `alternativeIds`,
// `alternativePriorities` (+ regression/progression, unused here) — and the
// EXERCISE_EQUIVALENCE_CHAINS table. SR-3 CONSUMES those (it does NOT re-port
// them). This file ports ONLY the ADDITIONAL override fields the smart engine
// reads that SR-2 deliberately left out (ReplacementEngineKnowledge.swift header):
//
//   exerciseLibrary.ts (EXERCISE_KNOWLEDGE_OVERRIDES, :485-1498)
//     movementPattern   -> samePattern        (smartReplacementEngine.ts:161-162)
//     primaryMuscles    -> getPrimaryMuscles   (smartReplacementEngine.ts:149-153)
//     skillDemand       -> getSkillDemand      (smartReplacementEngine.ts:144-147, :377)
//     kind              -> getEquipmentType / too_heavy machine branch
//                          (smartReplacementEngine.ts:184-192, :355)
//     contraindications -> painMatchesExercise (smartReplacementEngine.ts:240-247)
//
// The remaining override keys (secondaryMuscles / muscleContribution /
// orderPriority / goalBias / romPriority / canonicalExerciseId / regressionIds /
// progressionIds / targetRir / recommendedLoadRange) are NOT read by the smart
// engine after the merge (getExerciseId only ever runs on the raw param, never on
// a merged library exercise — smartReplacementEngine.ts:481, 126), so they are
// intentionally NOT ported. A field is `nil` exactly when the TS override omits it
// (e.g. `kind` is absent on the free-weight barbell/dumbbell entries).
//
// Entries are kept in EXACT TS source order (exerciseLibrary.ts:486-1497). The
// engine's library scan iterates `Object.keys(...)` in that order
// (smartReplacementEngine.ts:120, :296) — the order is reproduced verbatim even
// though the final recommendation list is re-sorted by (priority, fatigue, name),
// so output order does not actually depend on it (display names are unique). No
// IO, no clock, no `: Date`, deterministic.

import Foundation

/// The smart-replacement-engine-used ADDITIONAL slice of one
/// EXERCISE_KNOWLEDGE_OVERRIDES value (the fields SR-2 did not port). A field is
/// `nil` exactly when the TS override omits it.
struct SmartReplacementOverride: Equatable, Sendable {
    let movementPattern: String?
    let primaryMuscles: [String]?
    let skillDemand: String?
    let kind: String?
    let contraindications: [String]?

    init(
        movementPattern: String? = nil,
        primaryMuscles: [String]? = nil,
        skillDemand: String? = nil,
        kind: String? = nil,
        contraindications: [String]? = nil
    ) {
        self.movementPattern = movementPattern
        self.primaryMuscles = primaryMuscles
        self.skillDemand = skillDemand
        self.kind = kind
        self.contraindications = contraindications
    }
}

/// The smart-replacement engine's ADDITIONAL pure knowledge base. A namespace
/// enum (no instances). Consumes SR-2 ReplacementEngineKnowledge for the
/// fatigueCost / equivalenceChainId / alternativeIds / alternativePriorities
/// slice and SR-2 equivalenceChainEntries for the chains.
enum SmartReplacementKnowledge {
    // MARK: - EXERCISE_KNOWLEDGE_OVERRIDES additional fields (exerciseLibrary.ts:485-1498)
    //
    // 63 ids, EXACT TS source order. `primaryMuscles` values are the single-char
    // muscle labels (胸/背/腿/肩/手臂) the TS data carries verbatim.
    static let overrideEntries: KeyValuePairs<String, SmartReplacementOverride> = [
        "bench-press": SmartReplacementOverride(movementPattern: "水平推", primaryMuscles: ["胸"], skillDemand: "high", contraindications: ["upper_crossed", "scapular_control", "breathing_ribcage"]),
        "incline-db-press": SmartReplacementOverride(movementPattern: "上斜推", primaryMuscles: ["胸"], skillDemand: "medium", contraindications: ["upper_crossed", "scapular_control"]),
        "smith-incline-press": SmartReplacementOverride(movementPattern: "上斜推", primaryMuscles: ["胸"], skillDemand: "medium", kind: "machine", contraindications: ["upper_crossed", "scapular_control"]),
        "machine-incline-chest-press": SmartReplacementOverride(movementPattern: "上斜推", primaryMuscles: ["胸"], skillDemand: "low", kind: "machine", contraindications: ["upper_crossed", "scapular_control"]),
        "machine-chest-press": SmartReplacementOverride(movementPattern: "水平推", primaryMuscles: ["胸"], skillDemand: "low", contraindications: ["upper_crossed", "scapular_control"]),
        "cable-fly": SmartReplacementOverride(movementPattern: "飞鸟", primaryMuscles: ["胸"], skillDemand: "low", kind: "isolation"),
        "pec-deck-fly": SmartReplacementOverride(movementPattern: "飞鸟", primaryMuscles: ["胸"], skillDemand: "low", kind: "machine"),
        "db-fly": SmartReplacementOverride(movementPattern: "飞鸟", primaryMuscles: ["胸"], skillDemand: "medium", kind: "isolation"),
        "lateral-raise": SmartReplacementOverride(movementPattern: "肩外展", primaryMuscles: ["肩"], skillDemand: "low", kind: "isolation"),
        "triceps-pushdown": SmartReplacementOverride(movementPattern: "肘伸", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "lat-pulldown": SmartReplacementOverride(movementPattern: "垂直拉", primaryMuscles: ["背"], skillDemand: "medium", kind: "machine", contraindications: ["scapular_control", "thoracic_rotation"]),
        "single-arm-lat-pulldown": SmartReplacementOverride(movementPattern: "垂直拉", primaryMuscles: ["背"], skillDemand: "medium", kind: "machine", contraindications: ["scapular_control", "thoracic_rotation"]),
        "seated-row": SmartReplacementOverride(movementPattern: "水平拉", primaryMuscles: ["背"], skillDemand: "medium", kind: "machine", contraindications: ["thoracic_rotation", "scapular_control"]),
        "machine-row": SmartReplacementOverride(movementPattern: "水平拉", primaryMuscles: ["背"], skillDemand: "low", kind: "machine", contraindications: ["thoracic_rotation", "scapular_control"]),
        "chest-supported-row": SmartReplacementOverride(movementPattern: "水平拉", primaryMuscles: ["背"], skillDemand: "medium", kind: "machine", contraindications: ["thoracic_rotation", "scapular_control"]),
        "barbell-row": SmartReplacementOverride(movementPattern: "水平拉", primaryMuscles: ["背"], skillDemand: "high", kind: "compound", contraindications: ["lumbar_compensation", "thoracic_rotation"]),
        "t-bar-row": SmartReplacementOverride(movementPattern: "水平拉", primaryMuscles: ["背"], skillDemand: "medium", kind: "compound", contraindications: ["lumbar_compensation", "thoracic_rotation"]),
        "face-pull": SmartReplacementOverride(movementPattern: "肩胛控制", primaryMuscles: ["肩"], skillDemand: "low", kind: "isolation"),
        "reverse-pec-deck": SmartReplacementOverride(movementPattern: "后束飞鸟", primaryMuscles: ["肩"], skillDemand: "low", kind: "machine", contraindications: ["scapular_control"]),
        "cable-rear-delt-fly": SmartReplacementOverride(movementPattern: "后束飞鸟", primaryMuscles: ["肩"], skillDemand: "low", kind: "isolation", contraindications: ["scapular_control"]),
        "rear-delt-raise": SmartReplacementOverride(movementPattern: "后束飞鸟", primaryMuscles: ["肩"], skillDemand: "medium", kind: "isolation", contraindications: ["scapular_control"]),
        "db-curl": SmartReplacementOverride(movementPattern: "肘屈", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "hammer-curl": SmartReplacementOverride(movementPattern: "肘屈", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "ez-bar-curl": SmartReplacementOverride(movementPattern: "肘屈", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "cable-curl": SmartReplacementOverride(movementPattern: "肘屈", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "incline-db-curl": SmartReplacementOverride(movementPattern: "肘屈", primaryMuscles: ["手臂"], skillDemand: "medium", kind: "isolation"),
        "rope-hammer-curl": SmartReplacementOverride(movementPattern: "肘屈", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "squat": SmartReplacementOverride(movementPattern: "深蹲", primaryMuscles: ["腿"], skillDemand: "high", kind: "compound", contraindications: ["ankle_mobility", "squat_lean_forward", "hip_stability", "core_control"]),
        "hack-squat": SmartReplacementOverride(movementPattern: "深蹲", primaryMuscles: ["腿"], skillDemand: "medium", kind: "machine", contraindications: ["ankle_mobility", "squat_lean_forward"]),
        "smith-squat": SmartReplacementOverride(movementPattern: "深蹲", primaryMuscles: ["腿"], skillDemand: "medium", kind: "machine", contraindications: ["ankle_mobility", "squat_lean_forward"]),
        "leg-press": SmartReplacementOverride(movementPattern: "腿举", primaryMuscles: ["腿"], skillDemand: "low", kind: "machine", contraindications: ["hip_stability"]),
        "belt-squat": SmartReplacementOverride(movementPattern: "深蹲", primaryMuscles: ["腿"], skillDemand: "low", kind: "machine", contraindications: ["ankle_mobility", "hip_stability"]),
        "romanian-deadlift": SmartReplacementOverride(movementPattern: "髋铰链", primaryMuscles: ["腿"], skillDemand: "high", kind: "compound", contraindications: ["lumbar_compensation", "core_control", "hip_flexor_tightness"]),
        "db-rdl": SmartReplacementOverride(movementPattern: "髋铰链", primaryMuscles: ["腿"], skillDemand: "medium", kind: "compound", contraindications: ["lumbar_compensation", "core_control"]),
        "leg-curl": SmartReplacementOverride(movementPattern: "膝屈", primaryMuscles: ["腿"], skillDemand: "low", kind: "isolation"),
        "seated-leg-curl": SmartReplacementOverride(movementPattern: "膝屈", primaryMuscles: ["腿"], skillDemand: "low", kind: "machine"),
        "lying-leg-curl": SmartReplacementOverride(movementPattern: "膝屈", primaryMuscles: ["腿"], skillDemand: "low", kind: "machine"),
        "nordic-curl": SmartReplacementOverride(movementPattern: "膝屈", primaryMuscles: ["腿"], skillDemand: "high", kind: "isolation"),
        "calf-raise": SmartReplacementOverride(movementPattern: "跖屈", primaryMuscles: ["腿"], skillDemand: "low", kind: "isolation"),
        "seated-calf-raise": SmartReplacementOverride(movementPattern: "跖屈", primaryMuscles: ["腿"], skillDemand: "low", kind: "machine"),
        "standing-calf-raise": SmartReplacementOverride(movementPattern: "跖屈", primaryMuscles: ["腿"], skillDemand: "low", kind: "machine"),
        "leg-press-calf-raise": SmartReplacementOverride(movementPattern: "跖屈", primaryMuscles: ["腿"], skillDemand: "low", kind: "machine"),
        "shoulder-press": SmartReplacementOverride(movementPattern: "垂直推", primaryMuscles: ["肩"], skillDemand: "medium", kind: "compound", contraindications: ["overhead_press_restriction", "scapular_control", "breathing_ribcage"]),
        "machine-shoulder-press": SmartReplacementOverride(movementPattern: "垂直推", primaryMuscles: ["肩"], skillDemand: "low", kind: "machine", contraindications: ["overhead_press_restriction"]),
        "smith-shoulder-press": SmartReplacementOverride(movementPattern: "垂直推", primaryMuscles: ["肩"], skillDemand: "medium", kind: "machine", contraindications: ["overhead_press_restriction", "scapular_control"]),
        "cable-lateral-raise": SmartReplacementOverride(movementPattern: "肩外展", primaryMuscles: ["肩"], skillDemand: "low", kind: "isolation"),
        "machine-lateral-raise": SmartReplacementOverride(movementPattern: "肩外展", primaryMuscles: ["肩"], skillDemand: "low", kind: "machine"),
        "close-grip-bench": SmartReplacementOverride(movementPattern: "水平推", primaryMuscles: ["手臂"], skillDemand: "medium", kind: "compound", contraindications: ["upper_crossed", "scapular_control"]),
        "preacher-curl": SmartReplacementOverride(movementPattern: "肘屈", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "straight-bar-pushdown": SmartReplacementOverride(movementPattern: "肘伸", primaryMuscles: ["手臂"], skillDemand: "low", kind: "isolation"),
        "overhead-cable-triceps-extension": SmartReplacementOverride(movementPattern: "肘伸", primaryMuscles: ["手臂"], skillDemand: "medium", kind: "isolation"),
        "skull-crusher": SmartReplacementOverride(movementPattern: "肘伸", primaryMuscles: ["手臂"], skillDemand: "medium", kind: "isolation"),
        "assisted-dip": SmartReplacementOverride(movementPattern: "下斜推", primaryMuscles: ["胸"], skillDemand: "medium", kind: "machine", contraindications: ["shoulder_extension_restriction", "scapular_control"]),
        "db-bench-press": SmartReplacementOverride(movementPattern: "水平推", primaryMuscles: ["胸"], skillDemand: "medium", contraindications: ["upper_crossed", "scapular_control"]),
        "one-arm-db-row": SmartReplacementOverride(movementPattern: "单侧水平拉", primaryMuscles: ["背"], skillDemand: "medium", contraindications: ["thoracic_rotation"]),
        "goblet-squat": SmartReplacementOverride(movementPattern: "深蹲", primaryMuscles: ["腿"], skillDemand: "medium", kind: "compound", contraindications: ["ankle_mobility", "hip_stability"]),
        "push-up": SmartReplacementOverride(movementPattern: "水平推", primaryMuscles: ["胸"], skillDemand: "low", contraindications: ["upper_crossed", "scapular_control"]),
        "pull-up": SmartReplacementOverride(movementPattern: "垂直拉", primaryMuscles: ["背"], skillDemand: "high", kind: "compound", contraindications: ["scapular_control"]),
        "assisted-pull-up": SmartReplacementOverride(movementPattern: "垂直拉", primaryMuscles: ["背"], skillDemand: "medium", kind: "machine", contraindications: ["scapular_control"]),
        "deadlift": SmartReplacementOverride(movementPattern: "髋铰链", primaryMuscles: ["腿"], skillDemand: "high", contraindications: ["lumbar_compensation", "core_control"]),
        "hip-thrust": SmartReplacementOverride(movementPattern: "髋伸", primaryMuscles: ["腿"], skillDemand: "medium", kind: "compound", contraindications: ["hip_flexor_tightness"]),
        "leg-extension": SmartReplacementOverride(movementPattern: "膝伸", primaryMuscles: ["腿"], skillDemand: "low"),
        "landmine-press": SmartReplacementOverride(movementPattern: "斜向推", primaryMuscles: ["肩"], skillDemand: "medium", kind: "compound", contraindications: ["overhead_press_restriction"]),
    ]

    // MARK: - Derived lookups

    /// O(1) override lookup by id, derived from the ordered table.
    static let overrides: [String: SmartReplacementOverride] = {
        var dict = [String: SmartReplacementOverride](minimumCapacity: overrideEntries.count)
        for (key, value) in overrideEntries { dict[key] = value }
        return dict
    }()

    /// The override id universe in EXACT TS `Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES)`
    /// source order — the seed for buildLibraryMap (smartReplacementEngine.ts:120).
    static let overrideIds: [String] = overrideEntries.map { $0.key }
}
