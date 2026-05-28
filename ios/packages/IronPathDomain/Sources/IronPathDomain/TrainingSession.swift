// TrainingSession — iOS-2C AppData Typed Field Activation V1.
//
// Promotes the documented fields out of `_unknown` into real typed
// Swift properties so iOS-3 Data Health can read session lifecycle
// state without parsing JSONValue trees by hand. The unknown bag
// continues to preserve every key not in the documented set.
//
// Decode separates typed fields from unknown; encode re-merges them
// exactly once. AppData round-trip parity is unaffected — AppData
// continues to hold the full top-level object in `root` and never
// re-emits via per-type encode; the snapshot hash test in
// AppDataCodableRoundTripTests still drives the same canonical bytes.

import Foundation

public struct TrainingSession: Equatable, Hashable, Sendable {
    public let id: String?
    public let date: String?
    public let startedAt: String?
    public let finishedAt: String?
    public let durationMin: NumberRepr?
    public let completed: Bool?
    public let earlyEndReason: String?
    /// Opaque object; not refined into a typed `RestTimerState` until
    /// iOS-2D / iOS-3 needs the inner fields beyond `isRunning`.
    public let restTimerState: JSONValue?
    public let currentExerciseId: String?
    public let currentFocusStepId: String?
    public let currentSetIndex: NumberRepr?
    public let focusSessionComplete: Bool?
    public let focusCompletedStepIds: [String]?
    public let focusActualSetDrafts: [ActualSetDraft]?
    public let focusWarmupSetLogs: [TrainingSetLog]?
    public let exercises: [ExercisePrescription]?

    /// Every JSON key not in `documentedKeys`. Preserves forward
    /// compatibility — future PWA writes that add a new top-level
    /// session key are preserved verbatim.
    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "date", "startedAt", "finishedAt", "durationMin",
        "completed", "earlyEndReason", "restTimerState",
        "currentExerciseId", "currentFocusStepId", "currentSetIndex",
        "focusSessionComplete", "focusCompletedStepIds",
        "focusActualSetDrafts", "focusWarmupSetLogs", "exercises",
    ]

    public init(
        id: String? = nil,
        date: String? = nil,
        startedAt: String? = nil,
        finishedAt: String? = nil,
        durationMin: NumberRepr? = nil,
        completed: Bool? = nil,
        earlyEndReason: String? = nil,
        restTimerState: JSONValue? = nil,
        currentExerciseId: String? = nil,
        currentFocusStepId: String? = nil,
        currentSetIndex: NumberRepr? = nil,
        focusSessionComplete: Bool? = nil,
        focusCompletedStepIds: [String]? = nil,
        focusActualSetDrafts: [ActualSetDraft]? = nil,
        focusWarmupSetLogs: [TrainingSetLog]? = nil,
        exercises: [ExercisePrescription]? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.date = date
        self.startedAt = startedAt
        self.finishedAt = finishedAt
        self.durationMin = durationMin
        self.completed = completed
        self.earlyEndReason = earlyEndReason
        self.restTimerState = restTimerState
        self.currentExerciseId = currentExerciseId
        self.currentFocusStepId = currentFocusStepId
        self.currentSetIndex = currentSetIndex
        self.focusSessionComplete = focusSessionComplete
        self.focusCompletedStepIds = focusCompletedStepIds
        self.focusActualSetDrafts = focusActualSetDrafts
        self.focusWarmupSetLogs = focusWarmupSetLogs
        self.exercises = exercises
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.id = obj["id"]?.stringValue
        self.date = obj["date"]?.stringValue
        self.startedAt = obj["startedAt"]?.stringValue
        self.finishedAt = obj["finishedAt"]?.stringValue
        self.durationMin = obj["durationMin"]?.numberValue
        self.completed = obj["completed"]?.boolValue
        self.earlyEndReason = obj["earlyEndReason"]?.stringValue
        self.restTimerState = obj["restTimerState"]
        self.currentExerciseId = obj["currentExerciseId"]?.stringValue
        self.currentFocusStepId = obj["currentFocusStepId"]?.stringValue
        self.currentSetIndex = obj["currentSetIndex"]?.numberValue
        self.focusSessionComplete = obj["focusSessionComplete"]?.boolValue
        if let arr = obj["focusCompletedStepIds"]?.arrayValue {
            self.focusCompletedStepIds = arr.compactMap { $0.stringValue }
        } else {
            self.focusCompletedStepIds = nil
        }
        if let arr = obj["focusActualSetDrafts"]?.arrayValue {
            self.focusActualSetDrafts = try arr.map { try ActualSetDraft(decoding: $0) }
        } else {
            self.focusActualSetDrafts = nil
        }
        if let arr = obj["focusWarmupSetLogs"]?.arrayValue {
            self.focusWarmupSetLogs = try arr.map { try TrainingSetLog(decoding: $0) }
        } else {
            self.focusWarmupSetLogs = nil
        }
        if let arr = obj["exercises"]?.arrayValue {
            self.exercises = try arr.map { try ExercisePrescription(decoding: $0) }
        } else {
            self.exercises = nil
        }
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    /// Re-encodes the session as a `JSONValue`, merging typed fields
    /// and the `_unknown` carrier exactly once. The output preserves
    /// the documented value shapes; unknown keys pass through verbatim.
    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let id = id { typed.append(.init(key: "id", value: .string(id))) }
        if let date = date { typed.append(.init(key: "date", value: .string(date))) }
        if let s = startedAt { typed.append(.init(key: "startedAt", value: .string(s))) }
        if let f = finishedAt { typed.append(.init(key: "finishedAt", value: .string(f))) }
        if let d = durationMin { typed.append(.init(key: "durationMin", value: .number(d))) }
        if let c = completed { typed.append(.init(key: "completed", value: .bool(c))) }
        if let e = earlyEndReason { typed.append(.init(key: "earlyEndReason", value: .string(e))) }
        if let r = restTimerState { typed.append(.init(key: "restTimerState", value: r)) }
        if let s = currentExerciseId { typed.append(.init(key: "currentExerciseId", value: .string(s))) }
        if let s = currentFocusStepId { typed.append(.init(key: "currentFocusStepId", value: .string(s))) }
        if let n = currentSetIndex { typed.append(.init(key: "currentSetIndex", value: .number(n))) }
        if let b = focusSessionComplete { typed.append(.init(key: "focusSessionComplete", value: .bool(b))) }
        if let ids = focusCompletedStepIds {
            typed.append(.init(key: "focusCompletedStepIds", value: .array(ids.map { .string($0) })))
        }
        if let drafts = focusActualSetDrafts {
            typed.append(.init(key: "focusActualSetDrafts", value: .array(drafts.map { $0.encoded() })))
        }
        if let warmups = focusWarmupSetLogs {
            typed.append(.init(key: "focusWarmupSetLogs", value: .array(warmups.map { $0.encoded() })))
        }
        if let ex = exercises {
            typed.append(.init(key: "exercises", value: .array(ex.map { $0.encoded() })))
        }
        return .object(_unknown.appending(typed))
    }
}
