// SR-2 — Replacement Engine knowledge (pure data port).
//
// Faithful Swift transcription of the TWO "engine knowledge" tables that
// src/engines/replacementEngine.ts actually reads:
//
//   src/data/exerciseLibrary.ts:420  EXERCISE_EQUIVALENCE_CHAINS   -> equivalenceChainEntries
//   src/data/exerciseLibrary.ts:485  EXERCISE_KNOWLEDGE_OVERRIDES  -> knowledge (engine-used fields only)
//
// SCOPE — this ports ONLY the fields replacementEngine consumes; nothing else.
//   • From each equivalence chain, only `id` + `members` are read by
//     buildReplacementOptions (exerciseLibrary.ts:412-418 also carries
//     label/primaryMuscle/pattern — pure descriptive metadata the replacement
//     engine never touches, so they are intentionally NOT ported here).
//   • From each EXERCISE_KNOWLEDGE_OVERRIDES value, the replacement engine reads
//     exactly: fatigueCost, equivalenceChainId, alternativeIds,
//     alternativePriorities, regressionIds, progressionIds, equipmentTags
//     (replacementEngine.ts:73, 307-318, 185). The override objects ALSO carry
//     movementPattern / primaryMuscles / muscleContribution / orderPriority /
//     contraindications / kind / … — those are OTHER engines' knowledge (volume,
//     readiness, screening; SR-3+ and beyond) and are deliberately NOT ported
//     into the replacement engine. `knowledgeOverrideIds` (the KEY SET) was
//     ported in SR-1 (ExerciseLibrary.knowledgeOverrideIds).
//
// No override currently carries `equipmentTags`, so equipmentTagsFor() always
// falls through to ExerciseLibrary.equipmentTags — but the field is modelled
// (always nil) so the Swift equipmentTagsFor() is a 1:1 mirror of the TS
// `EXERCISE_KNOWLEDGE_OVERRIDES[id]?.equipmentTags ?? EXERCISE_EQUIPMENT_TAGS[id]`.
//
// Every entry is reconciled item-by-item against the generated
// `replacement-engine/knowledge-snapshot-v1` parity golden
// (ReplacementEngineParityTests) — a dropped or altered value fails that test.
// No IO, no clock, no `: Date`, deterministic.

import Foundation

/// One EXERCISE_EQUIVALENCE_CHAINS value, restricted to the fields the
/// replacement engine reads (exerciseLibrary.ts:412-418 `id` + `members`).
struct ReplacementEquivalenceChain: Equatable, Sendable {
    let id: String
    let members: [String]
}

/// The replacement-engine-used subset of one EXERCISE_KNOWLEDGE_OVERRIDES value.
/// A field is `nil` exactly when the TS override omits it.
struct ReplacementKnowledgeEntry: Equatable, Sendable {
    let fatigueCost: String?
    let equivalenceChainId: String?
    let alternativeIds: [String]?
    let alternativePriorities: [String: String]?
    let regressionIds: [String]?
    let progressionIds: [String]?
    let equipmentTags: [ExerciseEquipmentTag]?

    init(
        fatigueCost: String? = nil,
        equivalenceChainId: String? = nil,
        alternativeIds: [String]? = nil,
        alternativePriorities: [String: String]? = nil,
        regressionIds: [String]? = nil,
        progressionIds: [String]? = nil,
        equipmentTags: [ExerciseEquipmentTag]? = nil
    ) {
        self.fatigueCost = fatigueCost
        self.equivalenceChainId = equivalenceChainId
        self.alternativeIds = alternativeIds
        self.alternativePriorities = alternativePriorities
        self.regressionIds = regressionIds
        self.progressionIds = progressionIds
        self.equipmentTags = equipmentTags
    }
}

/// The replacement engine's pure knowledge base. A namespace enum (no instances).
enum ReplacementEngineKnowledge {
    // MARK: - EXERCISE_EQUIVALENCE_CHAINS (exerciseLibrary.ts:420-481)
    //
    // ORDERED — TS `Record` insertion order preserved verbatim (60 keys). The
    // engine does `Object.values(EXERCISE_EQUIVALENCE_CHAINS).find(...)`
    // (replacementEngine.ts:309), which iterates VALUES in insertion order and
    // returns the FIRST match; `equivalenceChainEntries` is iterated the same way
    // so the find result is byte-faithful (each exercise id appears in exactly one
    // chain's members, and all keys sharing a chain id carry identical members, so
    // the result is order-stable either way — order is preserved regardless).
    static let equivalenceChainEntries: KeyValuePairs<String, ReplacementEquivalenceChain> = [
        "bench-press": ReplacementEquivalenceChain(id: "horizontal-press", members: ["bench-press", "machine-chest-press", "db-bench-press", "push-up"]),
        "machine-chest-press": ReplacementEquivalenceChain(id: "horizontal-press", members: ["bench-press", "machine-chest-press", "db-bench-press", "push-up"]),
        "db-bench-press": ReplacementEquivalenceChain(id: "horizontal-press", members: ["bench-press", "machine-chest-press", "db-bench-press", "push-up"]),
        "push-up": ReplacementEquivalenceChain(id: "horizontal-press", members: ["bench-press", "machine-chest-press", "db-bench-press", "push-up"]),
        "incline-db-press": ReplacementEquivalenceChain(id: "incline-press", members: ["incline-db-press", "smith-incline-press", "machine-incline-chest-press"]),
        "smith-incline-press": ReplacementEquivalenceChain(id: "incline-press", members: ["incline-db-press", "smith-incline-press", "machine-incline-chest-press"]),
        "machine-incline-chest-press": ReplacementEquivalenceChain(id: "incline-press", members: ["incline-db-press", "smith-incline-press", "machine-incline-chest-press"]),
        "cable-fly": ReplacementEquivalenceChain(id: "fly", members: ["cable-fly", "pec-deck-fly", "db-fly"]),
        "pec-deck-fly": ReplacementEquivalenceChain(id: "fly", members: ["cable-fly", "pec-deck-fly", "db-fly"]),
        "db-fly": ReplacementEquivalenceChain(id: "fly", members: ["cable-fly", "pec-deck-fly", "db-fly"]),
        "squat": ReplacementEquivalenceChain(id: "squat-pattern", members: ["squat", "hack-squat", "smith-squat", "leg-press", "belt-squat", "goblet-squat"]),
        "hack-squat": ReplacementEquivalenceChain(id: "squat-pattern", members: ["squat", "hack-squat", "smith-squat", "leg-press", "belt-squat", "goblet-squat"]),
        "smith-squat": ReplacementEquivalenceChain(id: "squat-pattern", members: ["squat", "hack-squat", "smith-squat", "leg-press", "belt-squat", "goblet-squat"]),
        "leg-press": ReplacementEquivalenceChain(id: "squat-pattern", members: ["squat", "hack-squat", "smith-squat", "leg-press", "belt-squat", "goblet-squat"]),
        "belt-squat": ReplacementEquivalenceChain(id: "squat-pattern", members: ["squat", "hack-squat", "smith-squat", "leg-press", "belt-squat", "goblet-squat"]),
        "goblet-squat": ReplacementEquivalenceChain(id: "squat-pattern", members: ["squat", "hack-squat", "smith-squat", "leg-press", "belt-squat", "goblet-squat"]),
        "romanian-deadlift": ReplacementEquivalenceChain(id: "hinge-pattern", members: ["romanian-deadlift", "db-rdl", "hip-thrust"]),
        "db-rdl": ReplacementEquivalenceChain(id: "hinge-pattern", members: ["romanian-deadlift", "db-rdl", "hip-thrust"]),
        "deadlift": ReplacementEquivalenceChain(id: "deadlift-pattern", members: ["deadlift"]),
        "hip-thrust": ReplacementEquivalenceChain(id: "hinge-pattern", members: ["romanian-deadlift", "db-rdl", "hip-thrust"]),
        "leg-curl": ReplacementEquivalenceChain(id: "leg-curl", members: ["leg-curl", "seated-leg-curl", "lying-leg-curl", "nordic-curl"]),
        "seated-leg-curl": ReplacementEquivalenceChain(id: "leg-curl", members: ["leg-curl", "seated-leg-curl", "lying-leg-curl", "nordic-curl"]),
        "lying-leg-curl": ReplacementEquivalenceChain(id: "leg-curl", members: ["leg-curl", "seated-leg-curl", "lying-leg-curl", "nordic-curl"]),
        "nordic-curl": ReplacementEquivalenceChain(id: "leg-curl", members: ["leg-curl", "seated-leg-curl", "lying-leg-curl", "nordic-curl"]),
        "calf-raise": ReplacementEquivalenceChain(id: "calf-raise", members: ["calf-raise", "seated-calf-raise", "standing-calf-raise", "leg-press-calf-raise"]),
        "seated-calf-raise": ReplacementEquivalenceChain(id: "calf-raise", members: ["calf-raise", "seated-calf-raise", "standing-calf-raise", "leg-press-calf-raise"]),
        "standing-calf-raise": ReplacementEquivalenceChain(id: "calf-raise", members: ["calf-raise", "seated-calf-raise", "standing-calf-raise", "leg-press-calf-raise"]),
        "leg-press-calf-raise": ReplacementEquivalenceChain(id: "calf-raise", members: ["calf-raise", "seated-calf-raise", "standing-calf-raise", "leg-press-calf-raise"]),
        "lat-pulldown": ReplacementEquivalenceChain(id: "vertical-pull", members: ["lat-pulldown", "pull-up", "assisted-pull-up", "single-arm-lat-pulldown"]),
        "pull-up": ReplacementEquivalenceChain(id: "vertical-pull", members: ["lat-pulldown", "pull-up", "assisted-pull-up", "single-arm-lat-pulldown"]),
        "assisted-pull-up": ReplacementEquivalenceChain(id: "vertical-pull", members: ["lat-pulldown", "pull-up", "assisted-pull-up", "single-arm-lat-pulldown"]),
        "single-arm-lat-pulldown": ReplacementEquivalenceChain(id: "vertical-pull", members: ["lat-pulldown", "pull-up", "assisted-pull-up", "single-arm-lat-pulldown"]),
        "seated-row": ReplacementEquivalenceChain(id: "horizontal-pull", members: ["seated-row", "machine-row", "chest-supported-row", "barbell-row", "t-bar-row", "one-arm-db-row"]),
        "machine-row": ReplacementEquivalenceChain(id: "horizontal-pull", members: ["seated-row", "machine-row", "chest-supported-row", "barbell-row", "t-bar-row", "one-arm-db-row"]),
        "chest-supported-row": ReplacementEquivalenceChain(id: "horizontal-pull", members: ["seated-row", "machine-row", "chest-supported-row", "barbell-row", "t-bar-row", "one-arm-db-row"]),
        "barbell-row": ReplacementEquivalenceChain(id: "horizontal-pull", members: ["seated-row", "machine-row", "chest-supported-row", "barbell-row", "t-bar-row", "one-arm-db-row"]),
        "t-bar-row": ReplacementEquivalenceChain(id: "horizontal-pull", members: ["seated-row", "machine-row", "chest-supported-row", "barbell-row", "t-bar-row", "one-arm-db-row"]),
        "one-arm-db-row": ReplacementEquivalenceChain(id: "horizontal-pull", members: ["seated-row", "machine-row", "chest-supported-row", "barbell-row", "t-bar-row", "one-arm-db-row"]),
        "face-pull": ReplacementEquivalenceChain(id: "rear-delt", members: ["face-pull", "reverse-pec-deck", "cable-rear-delt-fly", "rear-delt-raise"]),
        "reverse-pec-deck": ReplacementEquivalenceChain(id: "rear-delt", members: ["face-pull", "reverse-pec-deck", "cable-rear-delt-fly", "rear-delt-raise"]),
        "cable-rear-delt-fly": ReplacementEquivalenceChain(id: "rear-delt", members: ["face-pull", "reverse-pec-deck", "cable-rear-delt-fly", "rear-delt-raise"]),
        "rear-delt-raise": ReplacementEquivalenceChain(id: "rear-delt", members: ["face-pull", "reverse-pec-deck", "cable-rear-delt-fly", "rear-delt-raise"]),
        "shoulder-press": ReplacementEquivalenceChain(id: "vertical-press", members: ["shoulder-press", "machine-shoulder-press", "smith-shoulder-press", "landmine-press"]),
        "machine-shoulder-press": ReplacementEquivalenceChain(id: "vertical-press", members: ["shoulder-press", "machine-shoulder-press", "smith-shoulder-press", "landmine-press"]),
        "smith-shoulder-press": ReplacementEquivalenceChain(id: "vertical-press", members: ["shoulder-press", "machine-shoulder-press", "smith-shoulder-press", "landmine-press"]),
        "landmine-press": ReplacementEquivalenceChain(id: "vertical-press", members: ["shoulder-press", "machine-shoulder-press", "smith-shoulder-press", "landmine-press"]),
        "lateral-raise": ReplacementEquivalenceChain(id: "lateral-raise", members: ["lateral-raise", "cable-lateral-raise", "machine-lateral-raise"]),
        "cable-lateral-raise": ReplacementEquivalenceChain(id: "lateral-raise", members: ["lateral-raise", "cable-lateral-raise", "machine-lateral-raise"]),
        "machine-lateral-raise": ReplacementEquivalenceChain(id: "lateral-raise", members: ["lateral-raise", "cable-lateral-raise", "machine-lateral-raise"]),
        "db-curl": ReplacementEquivalenceChain(id: "biceps-curl", members: ["db-curl", "ez-bar-curl", "preacher-curl", "cable-curl", "incline-db-curl"]),
        "ez-bar-curl": ReplacementEquivalenceChain(id: "biceps-curl", members: ["db-curl", "ez-bar-curl", "preacher-curl", "cable-curl", "incline-db-curl"]),
        "preacher-curl": ReplacementEquivalenceChain(id: "biceps-curl", members: ["db-curl", "ez-bar-curl", "preacher-curl", "cable-curl", "incline-db-curl"]),
        "cable-curl": ReplacementEquivalenceChain(id: "biceps-curl", members: ["db-curl", "ez-bar-curl", "preacher-curl", "cable-curl", "incline-db-curl"]),
        "incline-db-curl": ReplacementEquivalenceChain(id: "biceps-curl", members: ["db-curl", "ez-bar-curl", "preacher-curl", "cable-curl", "incline-db-curl"]),
        "hammer-curl": ReplacementEquivalenceChain(id: "hammer-curl", members: ["hammer-curl", "rope-hammer-curl"]),
        "rope-hammer-curl": ReplacementEquivalenceChain(id: "hammer-curl", members: ["hammer-curl", "rope-hammer-curl"]),
        "triceps-pushdown": ReplacementEquivalenceChain(id: "triceps-extension", members: ["triceps-pushdown", "straight-bar-pushdown", "overhead-cable-triceps-extension", "skull-crusher"]),
        "straight-bar-pushdown": ReplacementEquivalenceChain(id: "triceps-extension", members: ["triceps-pushdown", "straight-bar-pushdown", "overhead-cable-triceps-extension", "skull-crusher"]),
        "overhead-cable-triceps-extension": ReplacementEquivalenceChain(id: "triceps-extension", members: ["triceps-pushdown", "straight-bar-pushdown", "overhead-cable-triceps-extension", "skull-crusher"]),
        "skull-crusher": ReplacementEquivalenceChain(id: "triceps-extension", members: ["triceps-pushdown", "straight-bar-pushdown", "overhead-cable-triceps-extension", "skull-crusher"]),
    ]

    // MARK: - EXERCISE_KNOWLEDGE_OVERRIDES (exerciseLibrary.ts:485-1498)
    //
    // 63 ids; only the replacement-engine-used fields per id (see file header).
    // Insertion order is irrelevant — the engine looks up by id and the snapshot
    // reconciles as an unordered map — but entries are kept in TS source order for
    // diffability. `fatigueCost` is present on every TS override.
    static let knowledge: [String: ReplacementKnowledgeEntry] = [
        "bench-press": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "horizontal-press",
            alternativeIds: ["db-bench-press", "machine-chest-press", "push-up", "incline-db-press", "cable-fly", "triceps-pushdown", "shoulder-press", "machine-shoulder-press"],
            alternativePriorities: ["db-bench-press": "priority", "machine-chest-press": "priority", "push-up": "optional", "incline-db-press": "angle", "cable-fly": "not_recommended", "triceps-pushdown": "not_recommended", "shoulder-press": "not_recommended", "machine-shoulder-press": "not_recommended"],
            regressionIds: ["machine-chest-press", "db-bench-press"],
            progressionIds: ["close-grip-bench"]
        ),
        "incline-db-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "incline-press",
            alternativeIds: ["smith-incline-press", "machine-incline-chest-press", "machine-chest-press", "db-bench-press"],
            alternativePriorities: ["smith-incline-press": "priority", "machine-incline-chest-press": "priority", "machine-chest-press": "acceptable", "db-bench-press": "angle"],
            progressionIds: ["bench-press"]
        ),
        "smith-incline-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "incline-press",
            regressionIds: ["machine-incline-chest-press"],
            progressionIds: ["incline-db-press"]
        ),
        "machine-incline-chest-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "incline-press",
            progressionIds: ["smith-incline-press", "incline-db-press"]
        ),
        "machine-chest-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "horizontal-press",
            alternativeIds: ["db-bench-press", "bench-press", "push-up"],
            alternativePriorities: ["db-bench-press": "priority", "bench-press": "optional", "push-up": "optional"],
            progressionIds: ["db-bench-press", "bench-press"]
        ),
        "cable-fly": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "fly",
            alternativeIds: ["pec-deck-fly", "db-fly", "machine-chest-press", "assisted-dip"],
            alternativePriorities: ["pec-deck-fly": "priority", "db-fly": "acceptable", "machine-chest-press": "equipment_fallback", "assisted-dip": "compound_fallback"]
        ),
        "pec-deck-fly": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "fly",
            progressionIds: ["cable-fly"]
        ),
        "db-fly": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "fly",
            progressionIds: ["cable-fly"]
        ),
        "lateral-raise": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "lateral-raise",
            alternativeIds: ["cable-lateral-raise", "machine-lateral-raise", "rear-delt-raise", "shoulder-press"],
            alternativePriorities: ["cable-lateral-raise": "priority", "machine-lateral-raise": "priority", "rear-delt-raise": "not_recommended", "shoulder-press": "not_recommended"]
        ),
        "triceps-pushdown": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "triceps-extension",
            alternativeIds: ["straight-bar-pushdown", "overhead-cable-triceps-extension", "skull-crusher", "close-grip-bench", "assisted-dip", "bench-press", "shoulder-press", "cable-fly"],
            alternativePriorities: ["straight-bar-pushdown": "priority", "overhead-cable-triceps-extension": "acceptable", "skull-crusher": "optional", "close-grip-bench": "compound_fallback", "assisted-dip": "compound_fallback", "bench-press": "not_recommended", "shoulder-press": "not_recommended", "cable-fly": "not_recommended"]
        ),
        "lat-pulldown": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "vertical-pull",
            alternativeIds: ["assisted-pull-up", "pull-up", "single-arm-lat-pulldown", "machine-row", "seated-row", "triceps-pushdown", "cable-fly", "shoulder-press"],
            alternativePriorities: ["assisted-pull-up": "priority", "pull-up": "priority", "single-arm-lat-pulldown": "angle", "machine-row": "equipment_fallback", "seated-row": "optional", "triceps-pushdown": "not_recommended", "cable-fly": "not_recommended", "shoulder-press": "not_recommended"]
        ),
        "single-arm-lat-pulldown": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "vertical-pull",
            regressionIds: ["lat-pulldown"],
            progressionIds: ["assisted-pull-up", "pull-up"]
        ),
        "seated-row": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "horizontal-pull",
            alternativeIds: ["chest-supported-row", "machine-row", "one-arm-db-row", "barbell-row", "lat-pulldown"],
            alternativePriorities: ["chest-supported-row": "priority", "machine-row": "priority", "one-arm-db-row": "acceptable", "barbell-row": "optional", "lat-pulldown": "not_recommended"],
            regressionIds: ["one-arm-db-row"],
            progressionIds: ["barbell-row"]
        ),
        "machine-row": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "horizontal-pull",
            regressionIds: ["seated-row"],
            progressionIds: ["chest-supported-row", "barbell-row"]
        ),
        "chest-supported-row": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "horizontal-pull",
            regressionIds: ["machine-row", "seated-row"],
            progressionIds: ["barbell-row", "t-bar-row"]
        ),
        "barbell-row": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "horizontal-pull",
            alternativeIds: ["chest-supported-row", "t-bar-row", "one-arm-db-row", "seated-row", "machine-row"],
            alternativePriorities: ["chest-supported-row": "priority", "t-bar-row": "priority", "one-arm-db-row": "acceptable", "seated-row": "acceptable", "machine-row": "optional"],
            regressionIds: ["seated-row", "one-arm-db-row"]
        ),
        "t-bar-row": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "horizontal-pull",
            regressionIds: ["chest-supported-row", "seated-row", "machine-row"]
        ),
        "face-pull": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "rear-delt",
            alternativeIds: ["reverse-pec-deck", "cable-rear-delt-fly", "rear-delt-raise", "lateral-raise"],
            alternativePriorities: ["reverse-pec-deck": "priority", "cable-rear-delt-fly": "priority", "rear-delt-raise": "priority", "lateral-raise": "optional"]
        ),
        "reverse-pec-deck": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "rear-delt"),
        "cable-rear-delt-fly": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "rear-delt"),
        "rear-delt-raise": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "rear-delt"),
        "db-curl": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "biceps-curl",
            alternativeIds: ["ez-bar-curl", "preacher-curl", "cable-curl", "incline-db-curl", "hammer-curl"],
            alternativePriorities: ["ez-bar-curl": "priority", "preacher-curl": "priority", "cable-curl": "priority", "incline-db-curl": "acceptable", "hammer-curl": "optional"]
        ),
        "hammer-curl": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "hammer-curl",
            alternativeIds: ["rope-hammer-curl", "db-curl", "ez-bar-curl"],
            alternativePriorities: ["rope-hammer-curl": "priority", "db-curl": "acceptable", "ez-bar-curl": "optional"]
        ),
        "ez-bar-curl": ReplacementKnowledgeEntry(fatigueCost: "medium", equivalenceChainId: "biceps-curl"),
        "cable-curl": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "biceps-curl"),
        "incline-db-curl": ReplacementKnowledgeEntry(fatigueCost: "medium", equivalenceChainId: "biceps-curl"),
        "rope-hammer-curl": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "hammer-curl"),
        "squat": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "squat-pattern",
            alternativeIds: ["hack-squat", "smith-squat", "leg-press", "belt-squat", "goblet-squat", "leg-curl", "calf-raise", "seated-calf-raise"],
            alternativePriorities: ["hack-squat": "priority", "smith-squat": "priority", "leg-press": "acceptable", "belt-squat": "acceptable", "goblet-squat": "optional", "leg-curl": "not_recommended", "calf-raise": "not_recommended", "seated-calf-raise": "not_recommended"],
            regressionIds: ["hack-squat", "goblet-squat", "leg-press"]
        ),
        "hack-squat": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "squat-pattern",
            regressionIds: ["leg-press", "goblet-squat"],
            progressionIds: ["squat"]
        ),
        "smith-squat": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "squat-pattern",
            regressionIds: ["leg-press", "belt-squat", "goblet-squat"],
            progressionIds: ["squat"]
        ),
        "leg-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "squat-pattern",
            progressionIds: ["hack-squat", "squat"]
        ),
        "belt-squat": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "squat-pattern",
            regressionIds: ["leg-press", "goblet-squat"],
            progressionIds: ["hack-squat", "squat"]
        ),
        "romanian-deadlift": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "hinge-pattern",
            alternativeIds: ["db-rdl", "hip-thrust", "leg-curl", "seated-leg-curl", "lying-leg-curl", "calf-raise", "leg-extension"],
            alternativePriorities: ["db-rdl": "priority", "hip-thrust": "acceptable", "leg-curl": "optional", "seated-leg-curl": "optional", "lying-leg-curl": "optional", "calf-raise": "not_recommended", "leg-extension": "not_recommended"],
            regressionIds: ["db-rdl"]
        ),
        "db-rdl": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "hinge-pattern",
            progressionIds: ["romanian-deadlift"]
        ),
        "leg-curl": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "leg-curl",
            alternativeIds: ["seated-leg-curl", "lying-leg-curl", "nordic-curl", "romanian-deadlift"],
            alternativePriorities: ["seated-leg-curl": "priority", "lying-leg-curl": "priority", "nordic-curl": "acceptable", "romanian-deadlift": "optional"]
        ),
        "seated-leg-curl": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "leg-curl",
            progressionIds: ["nordic-curl"]
        ),
        "lying-leg-curl": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "leg-curl",
            progressionIds: ["nordic-curl"]
        ),
        "nordic-curl": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "leg-curl",
            regressionIds: ["seated-leg-curl", "lying-leg-curl", "leg-curl"]
        ),
        "calf-raise": ReplacementKnowledgeEntry(
            fatigueCost: "low",
            equivalenceChainId: "calf-raise",
            alternativeIds: ["seated-calf-raise", "standing-calf-raise", "leg-press-calf-raise"],
            alternativePriorities: ["seated-calf-raise": "priority", "standing-calf-raise": "priority", "leg-press-calf-raise": "acceptable"]
        ),
        "seated-calf-raise": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "calf-raise"),
        "standing-calf-raise": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "calf-raise"),
        "leg-press-calf-raise": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "calf-raise"),
        "shoulder-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "vertical-press",
            alternativeIds: ["machine-shoulder-press", "smith-shoulder-press", "landmine-press", "db-bench-press", "lateral-raise", "triceps-pushdown", "cable-fly"],
            alternativePriorities: ["machine-shoulder-press": "priority", "smith-shoulder-press": "priority", "landmine-press": "acceptable", "db-bench-press": "optional", "lateral-raise": "not_recommended", "triceps-pushdown": "not_recommended", "cable-fly": "not_recommended"],
            regressionIds: ["machine-shoulder-press"]
        ),
        "machine-shoulder-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "vertical-press",
            progressionIds: ["shoulder-press"]
        ),
        "smith-shoulder-press": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "vertical-press",
            regressionIds: ["machine-shoulder-press"],
            progressionIds: ["shoulder-press"]
        ),
        "cable-lateral-raise": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "lateral-raise"),
        "machine-lateral-raise": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "lateral-raise"),
        "close-grip-bench": ReplacementKnowledgeEntry(fatigueCost: "medium", equivalenceChainId: "horizontal-press"),
        "preacher-curl": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "biceps-curl"),
        "straight-bar-pushdown": ReplacementKnowledgeEntry(fatigueCost: "low", equivalenceChainId: "triceps-extension"),
        "overhead-cable-triceps-extension": ReplacementKnowledgeEntry(fatigueCost: "medium", equivalenceChainId: "triceps-extension"),
        "skull-crusher": ReplacementKnowledgeEntry(fatigueCost: "medium", equivalenceChainId: "triceps-extension"),
        "assisted-dip": ReplacementKnowledgeEntry(fatigueCost: "high", equivalenceChainId: "horizontal-press"),
        "db-bench-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "horizontal-press",
            alternativeIds: ["machine-chest-press", "bench-press", "push-up", "incline-db-press"],
            alternativePriorities: ["machine-chest-press": "priority", "bench-press": "optional", "push-up": "optional", "incline-db-press": "angle"],
            regressionIds: ["machine-chest-press"],
            progressionIds: ["bench-press"]
        ),
        "one-arm-db-row": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "horizontal-pull",
            progressionIds: ["seated-row", "barbell-row"]
        ),
        "goblet-squat": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "squat-pattern",
            progressionIds: ["hack-squat", "squat"]
        ),
        "push-up": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "horizontal-press",
            progressionIds: ["db-bench-press", "bench-press"]
        ),
        "pull-up": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "vertical-pull",
            regressionIds: ["lat-pulldown", "assisted-pull-up"]
        ),
        "assisted-pull-up": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "vertical-pull",
            progressionIds: ["pull-up"]
        ),
        "deadlift": ReplacementKnowledgeEntry(
            fatigueCost: "high",
            equivalenceChainId: "hinge-pattern",
            regressionIds: ["romanian-deadlift", "db-rdl"]
        ),
        "hip-thrust": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "hinge-pattern",
            regressionIds: ["db-rdl"]
        ),
        // leg-extension carries NO equivalenceChainId in TS (exerciseLibrary.ts:1474).
        "leg-extension": ReplacementKnowledgeEntry(fatigueCost: "low"),
        "landmine-press": ReplacementKnowledgeEntry(
            fatigueCost: "medium",
            equivalenceChainId: "vertical-press",
            progressionIds: ["shoulder-press"]
        ),
    ]
}
