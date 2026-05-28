// TrainingSetLog — iOS-2B AppData Swift Models V1.
//
// Placeholder surface for the TypeScript `TrainingSetLog` interface
// (~25 fields, `src/models/training-model.ts:255`). Storage unit for
// weight is kilograms — see Contract Freeze §8. Display formatting
// is the iOS-5+ UI layer's job.

import Foundation

public struct TrainingSetLog: Equatable, Hashable, Sendable {
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
