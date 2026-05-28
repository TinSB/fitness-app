// ExercisePrescription — iOS-2B AppData Swift Models V1.
//
// Placeholder for the TypeScript `ExercisePrescription` interface at
// `src/models/training-model.ts:378` (~30 fields including `sets:
// TrainingSetLog[]`, `warmupSets: TrainingSetLog[]`, `startWeight`,
// `targetRir`, etc.). Weights are kilograms storage; lb is display
// only. See Contract Freeze §8.

import Foundation

public struct ExercisePrescription: Equatable, Hashable, Sendable {
    public let _unknown: OrderedJSONObject

    public init(_unknown: OrderedJSONObject = OrderedJSONObject()) {
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self._unknown = obj
    }
}
