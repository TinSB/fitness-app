// ExerciseReplacementEditTests — SR-4 Smart-Replacement Integration V1.
//
// REAL unit tests for the pure exercise-replacement identity helpers used by the
// SR-4 native canonical-AppData EDIT write path (reusing the §8.3 edit-write boundary):
//   * ExercisePrescription.withReplacedIdentity — replaces ONLY the three user-override
//     identity fields (actualExerciseId / displayExerciseId / recordExerciseId),
//     preserving the prescription body (id / exerciseId / name / sets / prescription),
//     the engine-opened originalExerciseId, and the exercise's own open bag (_unknown)
//   * AppData.withUpdatedExerciseReplacement — APPLY sets the three identity fields on
//     the matched exercise inside ONLY the `history` key; RESTORE (nil) clears them.
//     Preserves every OTHER exercise / set / session, every level's unknown fields,
//     never bumps schemaVersion, never writes originalExerciseId, never touches an
//     engine output (mesocyclePlan weeks / program strategies / advice / sets), and
//     round-trips through canonical bytes. Apply→restore is byte-identical to the
//     pre-replacement document.
//
// Run via `swift test`. Deterministic; never touches disk/network.

import XCTest
@testable import IronPathDomain

final class ExerciseReplacementEditTests: XCTestCase {

    // A document with: two history sessions. s1 carries two exercises — "bench"
    // (a plain native-logged exercise with NO identity fields, two logged sets,
    // engine-advice `prescription`, and unknown keys at exercise + set level) and
    // "ohp" (which ALREADY carries an engine-opened `originalExerciseId`, to prove an
    // apply never rewrites it). s2 is untouched. Engine-output structures
    // (mesocyclePlan weeks + program correctionStrategy) and unknown keys ride along.
    private let json = """
    {"schemaVersion":8,\
    "history":[\
    {"id":"s1","completed":true,"finishedAt":"2026-05-27T10:00:00.000Z","sessionNote":"keep-session",\
    "exercises":[\
    {"id":"bench","exerciseId":"bench","name":"平板卧推","exerciseNote":"keep-ex","prescription":{"target":"5x5"},\
    "sets":[\
    {"setIndex":0,"weight":60,"reps":8,"rir":2,"completedAt":"2026-05-27T10:01:00.000Z","done":true,"setNote":"keep-set0"},\
    {"setIndex":1,"weight":62.5,"reps":6,"rir":1,"completedAt":"2026-05-27T10:03:00.000Z","done":true}\
    ]},\
    {"id":"ohp","exerciseId":"ohp","name":"站姿推举","originalExerciseId":"ohp-planned",\
    "sets":[{"setIndex":0,"weight":40,"reps":8,"rir":2,"done":true}]}\
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

    private func exercise(
        _ data: AppData, session: String, exercise: String
    ) -> ExercisePrescription? {
        data.history.first(where: { $0.id == session })?
            .exercises?.first(where: { $0.id == exercise || $0.exerciseId == exercise })
    }

    // MARK: - ExercisePrescription.withReplacedIdentity

    func testWithReplacedIdentityReplacesOnlyThreeFieldsAndPreservesEverythingElse() throws {
        let original = try ExercisePrescription(decoding: JSONValue(decoding: Data("""
        {"id":"bench","exerciseId":"bench","name":"平板卧推","originalExerciseId":"bench-planned",\
        "plannedSets":3,"prescription":{"target":"5x5"},"suggestion":"keep-sug","explanations":["a"],\
        "sets":[{"setIndex":0,"weight":60,"reps":8,"rir":2,"done":true}],"exerciseNote":"keep"}
        """.utf8)))

        let edited = original.withReplacedIdentity(
            actualExerciseId: "db-bench-press",
            displayExerciseId: "db-bench-press",
            recordExerciseId: "db-bench-press"
        )

        // The three user-override identity fields are set.
        XCTAssertEqual(edited.actualExerciseId, "db-bench-press")
        XCTAssertEqual(edited.displayExerciseId, "db-bench-press")
        XCTAssertEqual(edited.recordExerciseId, "db-bench-press")
        // The engine-opened originalExerciseId + the prescription body + advice + sets +
        // the exercise's own open bag are all preserved verbatim.
        XCTAssertEqual(edited.originalExerciseId, "bench-planned")
        XCTAssertEqual(edited.id, "bench")
        XCTAssertEqual(edited.exerciseId, "bench")
        XCTAssertEqual(edited.name, "平板卧推")
        XCTAssertEqual(edited.plannedSets?.intValue, 3)
        XCTAssertEqual(edited.suggestion, "keep-sug")
        XCTAssertEqual(edited.explanations, ["a"])
        XCTAssertEqual(edited.sets?.count, 1)
        XCTAssertEqual(edited.sets?.first?.weight?.doubleValue, 60)
        XCTAssertEqual(edited._unknown["exerciseNote"]?.stringValue, "keep")
        guard case .object(let presc)? = edited.prescription else { return XCTFail("prescription lost") }
        XCTAssertEqual(presc["target"]?.stringValue, "5x5")
    }

    func testWithReplacedIdentityNilClearsAllThreeHonestly() throws {
        let replaced = try ExercisePrescription(decoding: JSONValue(decoding: Data("""
        {"id":"bench","exerciseId":"bench","actualExerciseId":"db-bench-press",\
        "displayExerciseId":"db-bench-press","recordExerciseId":"db-bench-press"}
        """.utf8)))
        let restored = replaced.withReplacedIdentity(
            actualExerciseId: nil, displayExerciseId: nil, recordExerciseId: nil
        )
        XCTAssertNil(restored.actualExerciseId)
        XCTAssertNil(restored.displayExerciseId)
        XCTAssertNil(restored.recordExerciseId)
        // Encoded form omits the now-nil identity fields (honest "cleared").
        guard case .object(let obj) = restored.encoded() else { return XCTFail("expected object") }
        XCTAssertNil(obj["actualExerciseId"])
        XCTAssertNil(obj["displayExerciseId"])
        XCTAssertNil(obj["recordExerciseId"])
        // Identity anchor (id/exerciseId) survives, so the original is still locatable.
        XCTAssertEqual(restored.id, "bench")
        XCTAssertEqual(restored.exerciseId, "bench")
    }

    // MARK: - AppData.withUpdatedExerciseReplacement — APPLY

    func testApplySetsThreeIdentityFieldsAndPreservesEveryOtherLevel() throws {
        let next = try appData().withUpdatedExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        )

        // The target exercise's three user-override identity fields are set.
        let edited = exercise(next, session: "s1", exercise: "bench")
        XCTAssertEqual(edited?.actualExerciseId, "db-bench-press")
        XCTAssertEqual(edited?.displayExerciseId, "db-bench-press")
        XCTAssertEqual(edited?.recordExerciseId, "db-bench-press")
        // The target exercise's body, sets, and open bag survive verbatim — the planned
        // id/exerciseId/name are UNCHANGED (so the original stays locatable for restore).
        XCTAssertEqual(edited?.id, "bench")
        XCTAssertEqual(edited?.exerciseId, "bench")
        XCTAssertEqual(edited?.name, "平板卧推")
        XCTAssertEqual(edited?.sets?.count, 2)
        XCTAssertEqual(edited?.sets?.first?.weight?.doubleValue, 60)
        XCTAssertNil(edited?.originalExerciseId, "apply must never open originalExerciseId on a native-logged exercise")
        XCTAssertEqual(edited?._unknown["exerciseNote"]?.stringValue, "keep-ex")

        // Every OTHER exercise + OTHER session is untouched (no identity leaked onto them).
        let ohp = exercise(next, session: "s1", exercise: "ohp")
        XCTAssertNil(ohp?.actualExerciseId)
        XCTAssertEqual(ohp?.originalExerciseId, "ohp-planned")
        XCTAssertEqual(exercise(next, session: "s2", exercise: "row")?.sets?.first?.weight?.doubleValue, 50)

        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)

        // Unknown keys at every level + the engine outputs survive verbatim.
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"sessionNote\":\"keep-session\""), "session open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"exerciseNote\":\"keep-ex\""), "exercise open-bag lost")
        XCTAssertTrue(canonical.contains("\"setNote\":\"keep-set0\""), "set open-bag lost")
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped")
        XCTAssertTrue(canonical.contains("\"weeks\":[{\"index\":1},{\"index\":2}]"), "engine mesocycle weeks lost")
        XCTAssertTrue(canonical.contains("\"correctionStrategy\":{\"hingePriority\":true}"), "engine strategy lost")
        XCTAssertTrue(canonical.contains("\"prescription\":{\"target\":\"5x5\"}"), "engine advice lost")

        // Re-decodes cleanly (valid canonical document) with the replacement intact.
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(exercise(reDecoded, session: "s1", exercise: "bench")?.actualExerciseId, "db-bench-press")
    }

    func testApplyNeverRewritesAnEngineOpenedOriginalExerciseId() throws {
        // "ohp" already carries originalExerciseId == "ohp-planned" (engine-opened).
        let next = try appData().withUpdatedExerciseReplacement(
            sessionId: "s1", exerciseId: "ohp", replacementExerciseId: "db-shoulder-press"
        )
        let edited = exercise(next, session: "s1", exercise: "ohp")
        XCTAssertEqual(edited?.actualExerciseId, "db-shoulder-press")
        XCTAssertEqual(edited?.displayExerciseId, "db-shoulder-press")
        XCTAssertEqual(edited?.recordExerciseId, "db-shoulder-press")
        // originalExerciseId is carried through UNTOUCHED (never written by this edit).
        XCTAssertEqual(edited?.originalExerciseId, "ohp-planned")
    }

    // MARK: - AppData.withUpdatedExerciseReplacement — RESTORE

    func testRestoreClearsTheThreeIdentityFields() throws {
        let applied = try appData().withUpdatedExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press"
        )
        let restored = applied.withUpdatedExerciseReplacement(
            sessionId: "s1", exerciseId: "bench", replacementExerciseId: nil
        )
        let edited = exercise(restored, session: "s1", exercise: "bench")
        XCTAssertNil(edited?.actualExerciseId)
        XCTAssertNil(edited?.displayExerciseId)
        XCTAssertNil(edited?.recordExerciseId)
        // The body + sets survive; the original is identified by the untouched id/exerciseId.
        XCTAssertEqual(edited?.id, "bench")
        XCTAssertEqual(edited?.exerciseId, "bench")
        XCTAssertEqual(edited?.sets?.count, 2)
    }

    func testApplyThenRestoreIsByteIdenticalToOriginal() throws {
        let base = try appData()
        let original = try base.canonicalJSONData()
        let roundTripped = base
            .withUpdatedExerciseReplacement(sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press")
            .withUpdatedExerciseReplacement(sessionId: "s1", exerciseId: "bench", replacementExerciseId: nil)
        // A native-logged exercise had no identity fields, so apply-then-restore returns
        // the document to byte-identical (no residue, no originalExerciseId invented).
        XCTAssertEqual(try roundTripped.canonicalJSONData(), original)
    }

    // MARK: - No-op + value semantics

    func testMissingTargetIsByteIdenticalNoOp() throws {
        let base = try appData()
        let original = try base.canonicalJSONData()
        let a = base.withUpdatedExerciseReplacement(sessionId: "nope", exerciseId: "bench", replacementExerciseId: "x")
        let b = base.withUpdatedExerciseReplacement(sessionId: "s1", exerciseId: "nope", replacementExerciseId: "x")
        XCTAssertEqual(try a.canonicalJSONData(), original)
        XCTAssertEqual(try b.canonicalJSONData(), original)
    }

    func testDoesNotMutateReceiver() throws {
        let base = try appData()
        _ = base.withUpdatedExerciseReplacement(sessionId: "s1", exerciseId: "bench", replacementExerciseId: "db-bench-press")
        // Value semantics: the original exercise is unchanged (no identity leaked).
        XCTAssertNil(exercise(base, session: "s1", exercise: "bench")?.actualExerciseId)
    }
}
