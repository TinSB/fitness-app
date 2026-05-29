// iOS-4B5 Exercise Prescription + Volume Floor V1 — BOUNDED exercise knowledge.
//
// The TS prescription chain enriches each raw template exercise via
// buildExerciseMetadata (engineUtils.ts:135-193) reading EXERCISE_KNOWLEDGE_OVERRIDES
// (exerciseLibrary.ts:485, ~1000-line knowledge base) for orderPriority +
// contraindications, and issuesForExercise (adaptiveFeedbackEngine.ts:90) reading
// ISSUE_FROM_PATTERN for linkedIssues.
//
// BOUNDED-FAITHFUL SCOPE (user-approved): the ALGORITHM is ported faithfully (see
// buildExerciseMetadata defaults below + TrainingDecisionExercisePrescription); the
// DATA is scoped to the 6 push-a exercises the 9 goldens actually exercise. The rest
// of the knowledge base + pattern rules are DEFERRED (no other golden touches them).
// Each entry was extracted by running the real TS enrich path (verified by the
// iOS-4B5 scoped scan). If a template exercise is not in the map the defaults apply.

import Foundation

enum TrainingDecisionExerciseKnowledge {
    struct Entry: Equatable {
        let orderPriority: Int?
        let contraindications: [String]
        /// issuesForExercise(exercise) = ISSUE_FROM_PATTERN matches (screening-independent).
        let linkedIssues: [String]
    }

    /// The chest press/fly issue set (ISSUE_FROM_PATTERN chest rule).
    private static let chestPressIssues = ["upper_crossed", "scapular_control", "breathing_ribcage"]

    /// The fixture-exercised subset of EXERCISE_KNOWLEDGE_OVERRIDES + ISSUE_FROM_PATTERN.
    private static let entries: [String: Entry] = [
        "bench-press": Entry(orderPriority: 1, contraindications: ["upper_crossed", "scapular_control", "breathing_ribcage"], linkedIssues: chestPressIssues),
        "incline-db-press": Entry(orderPriority: 2, contraindications: ["upper_crossed", "scapular_control"], linkedIssues: chestPressIssues),
        "machine-chest-press": Entry(orderPriority: 3, contraindications: ["upper_crossed", "scapular_control"], linkedIssues: chestPressIssues),
        "cable-fly": Entry(orderPriority: 6, contraindications: [], linkedIssues: chestPressIssues),
        "lateral-raise": Entry(orderPriority: 7, contraindications: [], linkedIssues: []),
        "triceps-pushdown": Entry(orderPriority: 7, contraindications: [], linkedIssues: []),
    ]

    /// orderPriority = override.orderPriority || (compound ? 3 : 6) (engineUtils.ts:159).
    /// `||` falsy-fallback (a 0 override would use the default — none occur). `compound`
    /// here = kind compound OR machine (buildExerciseMetadata's `compound` flag).
    static func orderPriority(id: String, kind: String?) -> Int {
        if let op = entries[id]?.orderPriority, op != 0 { return op }
        let isCompoundOrMachine = kind == "compound" || kind == "machine"
        return isCompoundOrMachine ? 3 : 6
    }

    /// contraindications = override.contraindications || [] (engineUtils.ts:185).
    static func contraindications(id: String) -> [String] {
        entries[id]?.contraindications ?? []
    }

    /// issuesForExercise(exercise) (adaptiveFeedbackEngine.ts:90), bounded to fixtures.
    static func linkedIssues(id: String) -> [String] {
        entries[id]?.linkedIssues ?? []
    }
}
