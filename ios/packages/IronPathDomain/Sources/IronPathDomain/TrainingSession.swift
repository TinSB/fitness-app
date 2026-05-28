// TrainingSession — iOS-2B AppData Swift Models V1.
//
// Placeholder surface for the TypeScript `TrainingSession` interface
// at `src/models/training-model.ts:775` (~55 fields). iOS-2B holds the
// entire session JSON inside `_unknown`; future iOS-N PRs will
// promote typed fields (id, date, templateId, restTimerState, …).
// Note: timestamp-bearing fields (date, startedAt, finishedAt,
// editedAt, restTimerState.startedAt, …) will be declared as `String`
// when promoted — never `Date`. See Agent 2 §7 and Agent 5 §3.3.

import Foundation

public struct TrainingSession: Equatable, Hashable, Sendable {
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
