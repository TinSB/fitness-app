// HistorySetEditTests — DEEP-EDIT-1 Logged Set Correction V1.
//
// REAL unit tests for the pure logged-set-correction helpers used by the fifth
// native canonical-AppData EDIT write path (reusing the §8.3 edit-write boundary):
//   * TrainingSetLog.withCorrectedMetrics — replaces ONLY 重量 weight / 次数 reps /
//     rir, preserving identity, the other weight columns, completedAt, done, and the
//     set's own open bag (_unknown)
//   * ExercisePrescription.withUpdatedSets / TrainingSession.withUpdatedExercises —
//     replace ONLY the nested array, preserving every sibling field + open bag
//   * AppData.withUpdatedHistorySet — rewrites ONLY the matched set inside ONLY the
//     `history` key; preserves every OTHER set / exercise / session, every level's
//     unknown fields, never bumps schemaVersion, never touches an engine output
//     (mesocyclePlan weeks / program strategies / advice), and round-trips through
//     canonical bytes
//
// Run via `swift test`. Deterministic; never touches disk/network.

import XCTest
@testable import RedeDomain

final class HistorySetEditTests: XCTestCase {

    // A document with: two history sessions (s1 with two exercises, the first
    // carrying three sets; s2 untouched), engine-output structures (mesocyclePlan
    // weeks + program correctionStrategy), and unknown keys at the top level and at
    // the session / exercise / set levels.
    private let json = """
    {"schemaVersion":8,\
    "history":[\
    {"id":"s1","completed":true,"finishedAt":"2026-05-27T10:00:00.000Z","sessionNote":"keep-session",\
    "exercises":[\
    {"id":"bench","exerciseId":"bench","name":"平板卧推","exerciseNote":"keep-ex","prescription":{"target":"5x5"},\
    "sets":[\
    {"setIndex":0,"weight":60,"reps":8,"rir":2,"completedAt":"2026-05-27T10:01:00.000Z","done":true,"setNote":"keep-set0"},\
    {"setIndex":1,"weight":62.5,"reps":6,"rir":1,"completedAt":"2026-05-27T10:03:00.000Z","done":true,"setNote":"keep-set1"},\
    {"setIndex":2,"weight":62.5,"reps":5,"rir":0,"completedAt":"2026-05-27T10:05:00.000Z","done":true}\
    ]},\
    {"id":"squat","exerciseId":"squat","name":"深蹲","sets":[{"setIndex":0,"weight":100,"reps":5,"rir":2,"done":true}]}\
    ]},\
    {"id":"s2","completed":true,"exercises":[{"id":"row","exerciseId":"row","sets":[{"setIndex":0,"weight":50,"reps":10,"rir":3,"done":true}]}]}\
    ],\
    "programTemplate":{"id":"p1","primaryGoal":"增肌","correctionStrategy":{"hingePriority":true}},\
    "mesocyclePlan":{"id":"m1","phase":"积累期","weeks":[{"index":1},{"index":2}]},\
    "futureUnknownKey":{"nested":[1,2,3]}}
    """

    private func appData() throws -> AppData {
        try AppData(decoding: Data(json.utf8))
    }

    private func set(
        _ data: AppData, session: String, exercise: String, setIndex: Int
    ) -> TrainingSetLog? {
        data.history.first(where: { $0.id == session })?
            .exercises?.first(where: { $0.id == exercise || $0.exerciseId == exercise })?
            .sets?.first(where: { $0.setIndex?.intValue == setIndex })
    }

    // MARK: - TrainingSetLog.withCorrectedMetrics

    func testWithCorrectedMetricsReplacesOnlyMetricsAndPreservesEverythingElse() throws {
        let original = try TrainingSetLog(decoding: JSONValue(decoding: Data("""
        {"id":"set-uuid","setIndex":1,"exerciseId":"bench","weight":62.5,"reps":6,"rir":1,\
        "displayUnit":"kg","completedAt":"2026-05-27T10:03:00.000Z","done":true,"setNote":"keep"}
        """.utf8)))

        let edited = original.withCorrectedMetrics(
            weight: .double(65), reps: .integer(7), rir: .number(.integer(2))
        )

        // The three metrics are replaced.
        XCTAssertEqual(edited.weight?.doubleValue, 65)
        XCTAssertEqual(edited.reps?.intValue, 7)
        XCTAssertEqual(edited.rir?.intValue, 2)
        // Everything else preserved verbatim — identity, completedAt timestamp, done,
        // displayUnit, and the set's own open bag.
        XCTAssertEqual(edited.id, "set-uuid")
        XCTAssertEqual(edited.setIndex?.intValue, 1)
        XCTAssertEqual(edited.exerciseId, "bench")
        XCTAssertEqual(edited.displayUnit, .kg)
        XCTAssertEqual(edited.completedAt, "2026-05-27T10:03:00.000Z")
        XCTAssertEqual(edited.done, true)
        XCTAssertEqual(edited._unknown["setNote"]?.stringValue, "keep")
    }

    func testWithCorrectedMetricsNilWritesHonestUnset() throws {
        let original = try TrainingSetLog(decoding: JSONValue(decoding: Data("""
        {"setIndex":0,"weight":60,"reps":8,"rir":2,"done":true}
        """.utf8)))
        let edited = original.withCorrectedMetrics(weight: nil, reps: nil, rir: nil)
        XCTAssertNil(edited.weight)
        XCTAssertNil(edited.reps)
        XCTAssertNil(edited.rir)
        // Identity + done preserved even when every metric clears.
        XCTAssertEqual(edited.setIndex?.intValue, 0)
        XCTAssertEqual(edited.done, true)
        // Encoded form omits the now-nil metrics (honest "not entered").
        guard case .object(let obj) = edited.encoded() else { return XCTFail("expected object") }
        XCTAssertNil(obj["weight"])
        XCTAssertNil(obj["reps"])
        XCTAssertNil(obj["rir"])
    }

    // MARK: - AppData.withUpdatedHistorySet (nested open-bag preserving)

    func testEditsTargetSetOnlyAndPreservesEveryOtherLevel() throws {
        let next = try appData().withUpdatedHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 1,
            weightKg: 65, reps: 7, rir: 2
        )

        // The target set's three metrics changed.
        let edited = set(next, session: "s1", exercise: "bench", setIndex: 1)
        XCTAssertEqual(edited?.weight?.doubleValue, 65)
        XCTAssertEqual(edited?.reps?.intValue, 7)
        XCTAssertEqual(edited?.rir?.intValue, 2)
        // The target set's identity + timestamp + done + its own open bag survive.
        XCTAssertEqual(edited?.completedAt, "2026-05-27T10:03:00.000Z")
        XCTAssertEqual(edited?.done, true)
        XCTAssertEqual(edited?._unknown["setNote"]?.stringValue, "keep-set1")

        // Every OTHER set in the same exercise is untouched.
        let set0 = set(next, session: "s1", exercise: "bench", setIndex: 0)
        XCTAssertEqual(set0?.weight?.doubleValue, 60)
        XCTAssertEqual(set0?.reps?.intValue, 8)
        XCTAssertEqual(set0?._unknown["setNote"]?.stringValue, "keep-set0")
        let set2 = set(next, session: "s1", exercise: "bench", setIndex: 2)
        XCTAssertEqual(set2?.weight?.doubleValue, 62.5)
        XCTAssertEqual(set2?.reps?.intValue, 5)
        XCTAssertEqual(set2?.rir?.intValue, 0)

        // Every OTHER exercise + OTHER session is untouched.
        XCTAssertEqual(set(next, session: "s1", exercise: "squat", setIndex: 0)?.weight?.doubleValue, 100)
        XCTAssertEqual(set(next, session: "s2", exercise: "row", setIndex: 0)?.weight?.doubleValue, 50)

        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)

        // Unknown keys at the session / exercise levels + the top level survive, and
        // the engine outputs (mesocycle weeks + program strategy) are untouched.
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"sessionNote\":\"keep-session\""), "session open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"exerciseNote\":\"keep-ex\""), "exercise open-bag lost")
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"weeks\":[{\"index\":1},{\"index\":2}]"), "engine mesocycle weeks lost")
        XCTAssertTrue(canonical.contains("\"correctionStrategy\":{\"hingePriority\":true}"), "engine strategy lost")
        // The exercise-level engine advice blob survives verbatim.
        XCTAssertTrue(canonical.contains("\"prescription\":{\"target\":\"5x5\"}"), "engine advice lost")

        // Re-decodes cleanly (valid canonical document).
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(set(reDecoded, session: "s1", exercise: "bench", setIndex: 1)?.weight?.doubleValue, 65)
    }

    func testWholeWeightStaysIntegerFractionalStaysDouble() throws {
        // Whole kg → integer text (no "65.0").
        let whole = try appData().withUpdatedHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 0, weightKg: 65, reps: 8, rir: 2
        )
        XCTAssertTrue(try whole.canonicalJSONString().contains("\"weight\":65"))
        // Fractional kg → double text.
        let frac = try appData().withUpdatedHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 0, weightKg: 67.5, reps: 8, rir: 2
        )
        XCTAssertTrue(try frac.canonicalJSONString().contains("\"weight\":67.5"))
    }

    func testNilMetricsClearTargetSetMetricsHonestly() throws {
        let next = try appData().withUpdatedHistorySet(
            sessionId: "s1", exerciseId: "bench", setIndex: 1,
            weightKg: nil, reps: nil, rir: nil
        )
        let edited = set(next, session: "s1", exercise: "bench", setIndex: 1)
        XCTAssertNil(edited?.weight)
        XCTAssertNil(edited?.reps)
        XCTAssertNil(edited?.rir)
        // The set still exists with its identity + done + open bag.
        XCTAssertEqual(edited?.setIndex?.intValue, 1)
        XCTAssertEqual(edited?.done, true)
        XCTAssertEqual(edited?._unknown["setNote"]?.stringValue, "keep-set1")
    }

    func testMissingTargetIsByteIdenticalNoOp() throws {
        let base = try appData()
        let original = try base.canonicalJSONData()
        // Wrong session id, wrong exercise id, and out-of-range set index each no-op.
        let a = base.withUpdatedHistorySet(sessionId: "nope", exerciseId: "bench", setIndex: 1, weightKg: 99, reps: 9, rir: 9)
        let b = base.withUpdatedHistorySet(sessionId: "s1", exerciseId: "nope", setIndex: 1, weightKg: 99, reps: 9, rir: 9)
        let c = base.withUpdatedHistorySet(sessionId: "s1", exerciseId: "bench", setIndex: 99, weightKg: 99, reps: 9, rir: 9)
        XCTAssertEqual(try a.canonicalJSONData(), original)
        XCTAssertEqual(try b.canonicalJSONData(), original)
        XCTAssertEqual(try c.canonicalJSONData(), original)
    }

    func testDoesNotMutateReceiver() throws {
        let base = try appData()
        _ = base.withUpdatedHistorySet(sessionId: "s1", exerciseId: "bench", setIndex: 1, weightKg: 65, reps: 7, rir: 2)
        // Value semantics: the original set is unchanged.
        XCTAssertEqual(set(base, session: "s1", exercise: "bench", setIndex: 1)?.weight?.doubleValue, 62.5)
        XCTAssertEqual(set(base, session: "s1", exercise: "bench", setIndex: 1)?.reps?.intValue, 6)
    }
}
