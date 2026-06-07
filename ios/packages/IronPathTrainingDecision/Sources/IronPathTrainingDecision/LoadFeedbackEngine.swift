// LoadFeedbackEngine — iOS-17e-4 load-feedback port.
//
// Faithful line-by-line Swift port of the PURE per-exercise load-feedback
// functions from `retired web reference`:
//   - collectLoadFeedback        (loadFeedbackEngine.ts:49)
//   - upsertLoadFeedback         (loadFeedbackEngine.ts:27)
//   - buildLoadFeedbackSummary   (loadFeedbackEngine.ts:57)
//   - getLoadFeedbackAdjustment  (loadFeedbackEngine.ts:77)
// + the private `sortRecent` / `normalizePoolId` helpers and the
//   `LoadFeedback` / `LoadFeedbackValue` / `LoadFeedbackAdjustment` /
//   `LoadFeedbackSummary` types (loadFeedbackEngine.ts:3-25).
//
// Domain shape note: neither `session.loadFeedback` nor `session.dataFlag` is a
// documented typed field on the Swift `TrainingSession` (they ride in the
// `_unknown` open bag, exactly like the legacy web app's free-form session keys). The port
// reads them out of `_unknown` and `upsertLoadFeedback` writes the updated array
// back into `_unknown`, mirroring the legacy web schema object spread `{...session, loadFeedback}`.
//
// `feedback` is kept as a raw `String` (LoadFeedbackValue) rather than a closed
// enum because the legacy web schema functions read whatever string the history carries without
// validating it; the three canonical values ('too_light' / 'good' / 'too_heavy')
// are the only ones the §11 clean input ever produces.
//
// PURE: consumes `history: [TrainingSession]` (already a §11 clean input); no IO,
// no clock, no randomness, no `: Date`. `upsertLoadFeedback` returns a NEW
// TrainingSession value (an immutable transform) — it does NOT write through any
// store / CanonicalSessionWriter. It is NOT wired into the decision output here
// (that is 17e-5); this slice only adds the load-feedback functions and
// parity-pins them function-by-function.

import Foundation
import IronPathDomain

public enum LoadFeedbackEngine {

    // MARK: - Types

    /// `LoadFeedbackValue` (loadFeedbackEngine.ts / training-model.ts:165).
    /// 'too_light' | 'good' | 'too_heavy'. Modelled as a raw String — see the
    /// file header for why the port does not close it into an enum.
    public typealias LoadFeedbackValue = String

    public static let tooLight: LoadFeedbackValue = "too_light"
    public static let good: LoadFeedbackValue = "good"
    public static let tooHeavy: LoadFeedbackValue = "too_heavy"

    /// `LoadFeedback` (training-model.ts:540). `note` is optional (absent when the
    /// legacy web app stored none — JSON `undefined`/missing).
    public struct LoadFeedback: Equatable, Sendable {
        public let exerciseId: String
        public let sessionId: String
        public let date: String
        public let feedback: LoadFeedbackValue
        public let note: String?

        public init(exerciseId: String, sessionId: String, date: String, feedback: LoadFeedbackValue, note: String? = nil) {
            self.exerciseId = exerciseId
            self.sessionId = sessionId
            self.date = date
            self.feedback = feedback
            self.note = note
        }
    }

    /// `Record<LoadFeedbackValue, number>` (loadFeedbackEngine.ts:11/17). The three
    /// canonical buckets, every one initialised to 0 (`EMPTY_COUNTS`).
    public struct Counts: Equatable, Sendable {
        public var tooLight: Int
        public var good: Int
        public var tooHeavy: Int
        public init(tooLight: Int = 0, good: Int = 0, tooHeavy: Int = 0) {
            self.tooLight = tooLight
            self.good = good
            self.tooHeavy = tooHeavy
        }
    }

    /// `LoadFeedbackAdjustment` (loadFeedbackEngine.ts:3).
    public struct LoadFeedbackAdjustment: Equatable, Sendable {
        /// 'normal' | 'conservative' | 'slightly_aggressive'.
        public let direction: String
        public let dominantFeedback: LoadFeedbackValue?
        public let reasons: [String]
        public init(direction: String, dominantFeedback: LoadFeedbackValue? = nil, reasons: [String]) {
            self.direction = direction
            self.dominantFeedback = dominantFeedback
            self.reasons = reasons
        }
    }

    /// `LoadFeedbackSummary` (loadFeedbackEngine.ts:9).
    public struct LoadFeedbackSummary: Equatable, Sendable {
        public let exerciseId: String?
        public let total: Int
        public let counts: Counts
        public let dominantFeedback: LoadFeedbackValue?
        public let adjustment: LoadFeedbackAdjustment
    }

    // MARK: - Helpers

    /// `normalizePoolId` (loadFeedbackEngine.ts:23): identity for now.
    private static func normalizePoolId(_ exerciseId: String) -> String { exerciseId }

    /// Decode one `loadFeedback` array item out of the `_unknown` bag. Mirrors the
    /// legacy web app object shape `{ exerciseId, sessionId, date, feedback, note? }`. Missing
    /// strings decode to "" so the JS `item.exerciseId === ...` comparisons line up
    /// (JS reads `undefined`, which only ever matches an explicit `undefined` filter
    /// — never one of the canonical id strings the fixtures use).
    private static func decodeItem(_ value: JSONValue) -> LoadFeedback {
        let o = value.objectValue
        return LoadFeedback(
            exerciseId: o?["exerciseId"]?.stringValue ?? "",
            sessionId: o?["sessionId"]?.stringValue ?? "",
            date: o?["date"]?.stringValue ?? "",
            feedback: o?["feedback"]?.stringValue ?? "",
            note: o?["note"]?.stringValue
        )
    }

    /// Re-encode a `LoadFeedback` for `upsertLoadFeedback`'s `{...}` array. `note`
    /// is omitted when nil (JS `undefined` properties drop on serialization).
    private static func encodeItem(_ item: LoadFeedback) -> JSONValue {
        var entries: [OrderedJSONObject.Entry] = [
            .init(key: "exerciseId", value: .string(item.exerciseId)),
            .init(key: "sessionId", value: .string(item.sessionId)),
            .init(key: "date", value: .string(item.date)),
            .init(key: "feedback", value: .string(item.feedback)),
        ]
        if let note = item.note { entries.append(.init(key: "note", value: .string(note))) }
        return .object(OrderedJSONObject(entries: entries))
    }

    /// `session.dataFlag` out of the `_unknown` open bag (training-model.ts:795).
    private static func dataFlag(_ session: TrainingSession) -> String? {
        session._unknown["dataFlag"]?.stringValue
    }

    /// `Array.isArray(session.loadFeedback) ? session.loadFeedback : []`
    /// (loadFeedbackEngine.ts:41) over the `_unknown` open bag.
    private static func loadFeedbackArray(_ session: TrainingSession) -> [JSONValue] {
        session._unknown["loadFeedback"]?.arrayValue ?? []
    }

    /// `sortRecent` (loadFeedbackEngine.ts:25): `[...items].sort((l, r) =>
    /// r.date.localeCompare(l.date))` — DESCENDING by date string, V8-stable.
    /// For the ISO `YYYY-MM-DD` dates the §11 input carries, `localeCompare` over
    /// equal-length ASCII strings is plain lexicographic, so Swift `>` matches it;
    /// the explicit original-index tiebreak reproduces V8's stable-sort guarantee
    /// for equal dates (kept in flatMap/history order).
    private static func sortRecent(_ items: [LoadFeedback]) -> [LoadFeedback] {
        items.enumerated()
            .sorted { a, b in
                if a.element.date != b.element.date { return a.element.date > b.element.date }
                return a.offset < b.offset
            }
            .map { $0.element }
    }

    // MARK: - collectLoadFeedback (loadFeedbackEngine.ts:49)

    public static func collectLoadFeedback(_ history: [TrainingSession], _ exerciseId: String? = nil) -> [LoadFeedback] {
        let collected = history
            .filter { dataFlag($0) != "test" && dataFlag($0) != "excluded" }
            .flatMap { session in loadFeedbackArray(session).map { decodeItem($0) } }
            .filter { exerciseId == nil || $0.exerciseId == exerciseId }
        return sortRecent(collected)
    }

    // MARK: - upsertLoadFeedback (loadFeedbackEngine.ts:27)

    /// Returns a NEW session with `loadFeedback` replaced — the existing entry for
    /// `poolId` (if any) is dropped, then the new feedback is appended at the END,
    /// exactly mirroring `{...session, loadFeedback: [...withoutCurrent, next]}`.
    public static func upsertLoadFeedback(
        _ session: TrainingSession,
        _ exerciseId: String,
        _ feedback: LoadFeedbackValue,
        _ note: String? = nil
    ) -> TrainingSession {
        let poolId = normalizePoolId(exerciseId)
        let nextFeedback = LoadFeedback(
            exerciseId: poolId,
            sessionId: session.id ?? "",
            date: session.date ?? "",
            feedback: feedback,
            note: note
        )
        let previous = loadFeedbackArray(session)
        let withoutCurrent = previous.filter { decodeItem($0).exerciseId != poolId }
        let nextArray = withoutCurrent + [encodeItem(nextFeedback)]

        // Mirror `{...session, loadFeedback}` — replace the open-bag key, preserve
        // every other field unchanged.
        let updatedUnknown = session._unknown
            .withoutKeys(["loadFeedback"])
            .appending([.init(key: "loadFeedback", value: .array(nextArray))])
        return TrainingSession(
            id: session.id,
            date: session.date,
            startedAt: session.startedAt,
            finishedAt: session.finishedAt,
            durationMin: session.durationMin,
            completed: session.completed,
            earlyEndReason: session.earlyEndReason,
            restTimerState: session.restTimerState,
            currentExerciseId: session.currentExerciseId,
            currentFocusStepId: session.currentFocusStepId,
            currentSetIndex: session.currentSetIndex,
            focusSessionComplete: session.focusSessionComplete,
            focusCompletedStepIds: session.focusCompletedStepIds,
            focusActualSetDrafts: session.focusActualSetDrafts,
            focusWarmupSetLogs: session.focusWarmupSetLogs,
            exercises: session.exercises,
            _unknown: updatedUnknown
        )
    }

    /// The resulting `loadFeedback` array of an `upsertLoadFeedback`, decoded back
    /// into `[LoadFeedback]` — the single observable change the upsert makes.
    public static func upsertedLoadFeedback(
        _ session: TrainingSession,
        _ exerciseId: String,
        _ feedback: LoadFeedbackValue,
        _ note: String? = nil
    ) -> [LoadFeedback] {
        let next = upsertLoadFeedback(session, exerciseId, feedback, note)
        return loadFeedbackArray(next).map { decodeItem($0) }
    }

    // MARK: - count helpers

    /// `items.reduce(acc[item.feedback] += 1, EMPTY_COUNTS)` — count the three
    /// canonical buckets. A non-canonical feedback string is ignored (the §11 clean
    /// input never emits one; in JS it would spawn a NaN key the goldens never hit).
    private static func tally(_ items: [LoadFeedback]) -> Counts {
        var counts = Counts()
        for item in items {
            switch item.feedback {
            case tooLight: counts.tooLight += 1
            case good: counts.good += 1
            case tooHeavy: counts.tooHeavy += 1
            default: break
            }
        }
        return counts
    }

    /// `Object.entries(counts).sort((l, r) => r[1] - l[1])[0]?.[0]`
    /// (loadFeedbackEngine.ts:66). V8 `Array.sort` is stable, so on a tie the
    /// insertion order of `EMPTY_COUNTS` wins: too_light > good > too_heavy. We
    /// reproduce that by scanning in that fixed order and only replacing the leader
    /// on a STRICTLY greater count.
    private static func dominant(_ counts: Counts) -> LoadFeedbackValue {
        var bestKey = tooLight
        var bestCount = counts.tooLight
        if counts.good > bestCount { bestKey = good; bestCount = counts.good }
        if counts.tooHeavy > bestCount { bestKey = tooHeavy; bestCount = counts.tooHeavy }
        return bestKey
    }

    // MARK: - buildLoadFeedbackSummary (loadFeedbackEngine.ts:57)

    public static func buildLoadFeedbackSummary(_ history: [TrainingSession], _ exerciseId: String? = nil) -> LoadFeedbackSummary {
        let limit = exerciseId != nil ? 5 : 20
        let items = Array(collectLoadFeedback(history, exerciseId).prefix(limit))
        let counts = tally(items)
        let dominantFeedback = dominant(counts)
        let adjustment = getLoadFeedbackAdjustment(history, exerciseId)
        return LoadFeedbackSummary(
            exerciseId: exerciseId,
            total: items.count,
            counts: counts,
            dominantFeedback: items.isEmpty ? nil : dominantFeedback,
            adjustment: adjustment
        )
    }

    // MARK: - getLoadFeedbackAdjustment (loadFeedbackEngine.ts:77)

    public static func getLoadFeedbackAdjustment(_ history: [TrainingSession], _ exerciseId: String? = nil) -> LoadFeedbackAdjustment {
        let recent = Array(collectLoadFeedback(history, exerciseId).prefix(3))
        let counts = tally(recent)

        if counts.tooHeavy >= 2 {
            return LoadFeedbackAdjustment(
                direction: "conservative",
                dominantFeedback: tooHeavy,
                reasons: ["最近多次反馈推荐重量偏重，本次建议采用更保守的重量推进。"]
            )
        }

        if counts.tooLight >= 2 {
            return LoadFeedbackAdjustment(
                direction: "slightly_aggressive",
                dominantFeedback: tooLight,
                reasons: ["最近多次反馈推荐重量偏轻；若动作质量良好，可允许小幅积极推进。"]
            )
        }

        if counts.good > 0 {
            return LoadFeedbackAdjustment(
                direction: "normal",
                dominantFeedback: good,
                reasons: ["最近反馈显示推荐重量基本合适，继续按当前规则推进。"]
            )
        }

        return LoadFeedbackAdjustment(
            direction: "normal",
            reasons: ["暂无推荐重量反馈，继续使用训练表现和动作质量校准。"]
        )
    }
}
