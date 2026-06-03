// AdjustmentChangeType — PA-S1 PA Domain Types V1.
//
// Mirrors the TypeScript `AdjustmentChangeType` union at
// `src/models/training-model.ts:1139`. The closed set of program-
// adjustment change kinds the PA (Plan-Adaptive) engines emit on an
// `AdjustmentChange` / `ProgramAdjustmentDiff` row.
//
// Closed enum (same paradigm as `WeightUnit`). Decoded as a FIELD via
// the lossless "extracted-set" pattern (see `EstimateConfidence`):
// an unknown future token stays in the owner's `_unknown` open bag and
// round-trips verbatim rather than being dropped.

import Foundation

public enum AdjustmentChangeType: String, Codable, CaseIterable, Equatable, Hashable, Sendable {
    case addSets = "add_sets"
    case removeSets = "remove_sets"
    case addNewExercise = "add_new_exercise"
    case swapExercise = "swap_exercise"
    case reduceSupport = "reduce_support"
    case increaseSupport = "increase_support"
    case keep
}
