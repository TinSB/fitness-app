// NativeCompletedSessionTests — iOS-17A Native Per-Set Logging Mega V1 (iOS-17c).
//
// REAL unit tests for the pure canonical-session builder + AppData history
// append used by the first native canonical-AppData write path. Run via
// `swift test`. Deterministic; never touches disk/network.

import XCTest
@testable import RedeDomain

final class NativeCompletedSessionTests: XCTestCase {

    // MARK: - Draft -> TrainingSetLog promotion

    func testSetLogCarriesKilogramWeightRepsRirAndMarksDone() throws {
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 0, weightKg: 62.5, reps: 8, rir: 2,
            exerciseId: "bench", source: "local-ios-focus-capture",
            completedAtIso: "2026-05-27T10:00:00.000Z"
        )
        let log = NativeCompletedSessionBuilder.setLog(from: draft, fallbackIndex: 0)
        XCTAssertEqual(try XCTUnwrap(log.weight).doubleValue, 62.5, accuracy: 1e-9)
        XCTAssertEqual(log.reps?.intValue, 8)
        XCTAssertEqual(log.rir, .number(.integer(2)))
        XCTAssertEqual(log.setIndex?.intValue, 0)
        XCTAssertEqual(log.exerciseId, "bench")
        XCTAssertEqual(log.completedAt, "2026-05-27T10:00:00.000Z")
        XCTAssertEqual(log.done, true)
        // Storage stays kg only — no display unit leaks into the canonical log.
        XCTAssertNil(log.displayWeight)
        XCTAssertNil(log.displayUnit)
    }

    func testSetLogBlankFieldsStayNilHonestly() {
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 1, weightKg: nil, reps: nil, rir: nil,
            exerciseId: "row", source: "s", completedAtIso: "t"
        )
        let log = NativeCompletedSessionBuilder.setLog(from: draft, fallbackIndex: 5)
        XCTAssertNil(log.weight)
        XCTAssertNil(log.reps)
        XCTAssertNil(log.rir)
        // Draft already carried setIndex 1 — fallback is only used when absent.
        XCTAssertEqual(log.setIndex?.intValue, 1)
        XCTAssertEqual(log.done, true)
    }

    func testSetLogFallbackIndexUsedWhenDraftHasNone() {
        let draft = ActualSetDraft(weight: .integer(40), reps: .integer(10), exerciseId: "x")
        let log = NativeCompletedSessionBuilder.setLog(from: draft, fallbackIndex: 3)
        XCTAssertEqual(log.setIndex?.intValue, 3)
    }

    // MARK: - Per-exercise aggregation

    func testExerciseAggregatesDraftsInOrder() {
        let drafts = (0..<3).map { i in
            ActualSetDraftFactory.capturedDraft(
                priorCompletedCount: i, weightKg: Double(50 + i * 5), reps: 5, rir: 1,
                exerciseId: "squat", source: "s", completedAtIso: "t"
            )
        }
        let ex = NativeCompletedSessionBuilder.exercise(
            from: NativePerformedExercise(exerciseId: "squat", name: "深蹲", drafts: drafts)
        )
        XCTAssertEqual(ex.id, "squat")
        XCTAssertEqual(ex.exerciseId, "squat")
        XCTAssertEqual(ex.name, "深蹲")
        XCTAssertEqual(ex.sets?.count, 3)
        XCTAssertEqual(ex.sets?.compactMap { $0.setIndex?.intValue }, [0, 1, 2])
        XCTAssertEqual(ex.sets?.first?.weight?.doubleValue, 50)
        // A performed record carries no engine advice fields.
        XCTAssertNil(ex.suggestion)
        XCTAssertNil(ex.prescription)
    }

    // MARK: - Completed session shape

    func testCompletedSessionShapeAndLifecycleSafety() {
        let drafts = [ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: 0, weightKg: 60, reps: 5, rir: 2,
            exerciseId: "bench", source: "s", completedAtIso: "2026-05-27T10:00:00.000Z"
        )]
        let session = NativeCompletedSessionBuilder.completedSession(
            id: "focus-session-normal-1",
            dateIso: "2026-05-27",
            finishedAtIso: "2026-05-27T10:00:00.000Z",
            performed: [NativePerformedExercise(exerciseId: "bench", name: "平板卧推", drafts: drafts)]
        )
        XCTAssertEqual(session.id, "focus-session-normal-1")
        XCTAssertEqual(session.completed, true)
        XCTAssertEqual(session.focusSessionComplete, true)
        XCTAssertEqual(session.finishedAt, "2026-05-27T10:00:00.000Z")
        XCTAssertEqual(session.date, "2026-05-27")
        XCTAssertEqual(session.exercises?.count, 1)
        XCTAssertEqual(session.exercises?.first?.sets?.count, 1)
        // Data-safety: the in-progress draft buffer + lifecycle residue fields are
        // NEVER set on the canonical completed session, so the DataHealth
        // lifecycle guard finds nothing to strip (no data loss on reload).
        XCTAssertNil(session.focusActualSetDrafts)
        XCTAssertNil(session.currentExerciseId)
        XCTAssertNil(session.currentSetIndex)
        XCTAssertNil(session.restTimerState)
    }

    func testCompletedSessionOmitsExercisesWithNoPerformedSets() {
        let withSets = NativePerformedExercise(
            exerciseId: "bench", name: "平板卧推",
            drafts: [ActualSetDraftFactory.capturedDraft(
                priorCompletedCount: 0, weightKg: 60, reps: 5, rir: 2,
                exerciseId: "bench", source: "s", completedAtIso: "t"
            )]
        )
        let untouched = NativePerformedExercise(exerciseId: "fly", name: "飞鸟", drafts: [])
        let session = NativeCompletedSessionBuilder.completedSession(
            id: "s1", dateIso: nil, finishedAtIso: "t",
            performed: [withSets, untouched]
        )
        XCTAssertEqual(session.exercises?.count, 1)
        XCTAssertEqual(session.exercises?.first?.id, "bench")
    }

    // MARK: - AppData history append (open-bag preserving)

    func testEmptyCurrentRoundTrips() throws {
        let base = AppData.emptyCurrent()
        XCTAssertEqual(base.schemaVersion, .current)
        XCTAssertTrue(base.history.isEmpty)
        // Canonical bytes must re-decode cleanly (valid first-write base).
        let reDecoded = try AppData(decoding: base.canonicalJSONData())
        XCTAssertEqual(reDecoded.schemaVersion, .current)
        XCTAssertTrue(reDecoded.history.isEmpty)
    }

    func testAppendingSessionToEmptyBase() throws {
        let session = NativeCompletedSessionBuilder.completedSession(
            id: "s1", dateIso: nil, finishedAtIso: "2026-05-27T10:00:00.000Z",
            performed: [NativePerformedExercise(
                exerciseId: "bench", name: "平板卧推",
                drafts: [ActualSetDraftFactory.capturedDraft(
                    priorCompletedCount: 0, weightKg: 60, reps: 5, rir: 2,
                    exerciseId: "bench", source: "s", completedAtIso: "t"
                )]
            )]
        )
        let appData = AppData.emptyCurrent().appendingHistorySession(session)
        XCTAssertEqual(appData.history.count, 1)
        XCTAssertEqual(appData.history.first?.id, "s1")
        XCTAssertEqual(appData.history.first?.exercises?.first?.sets?.first?.weight?.doubleValue, 60)
        // Round-trips through canonical bytes.
        let reDecoded = try AppData(decoding: appData.canonicalJSONData())
        XCTAssertEqual(reDecoded.history.count, 1)
        XCTAssertEqual(reDecoded.history.first?.exercises?.first?.sets?.first?.reps?.intValue, 5)
    }

    func testAppendingSessionPreservesOpenBagAndExistingHistory() throws {
        // AppData with an EXISTING session, plus unknown top-level keys + settings.
        let json = """
        {"schemaVersion":8,"history":[{"id":"old","completed":true}],\
        "settings":{"weightUnit":"kg"},"futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        let session = NativeCompletedSessionBuilder.completedSession(
            id: "new", dateIso: nil, finishedAtIso: "t",
            performed: [NativePerformedExercise(
                exerciseId: "bench", name: "平板卧推",
                drafts: [ActualSetDraftFactory.capturedDraft(
                    priorCompletedCount: 0, weightKg: 60, reps: 5, rir: nil,
                    exerciseId: "bench", source: "s", completedAtIso: "t"
                )]
            )]
        )
        let next = appData.appendingHistorySession(session)
        // History grew by exactly one, old entry retained, new appended last.
        XCTAssertEqual(next.history.count, 2)
        XCTAssertEqual(next.history.first?.id, "old")
        XCTAssertEqual(next.history.last?.id, "new")
        // schemaVersion unchanged (append is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // Open bag preserved: unknown key + settings survive verbatim.
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "unknown key dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"settings\":{\"weightUnit\":\"kg\"}"), "settings lost: \(canonical)")
        // Re-decodes cleanly.
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(reDecoded.history.count, 2)
    }

    func testAppendingDoesNotMutateReceiver() {
        let base = AppData.emptyCurrent()
        let session = NativeCompletedSessionBuilder.completedSession(
            id: "s1", dateIso: nil, finishedAtIso: "t", performed: []
        )
        _ = base.appendingHistorySession(session)
        // Value semantics: the original is untouched.
        XCTAssertTrue(base.history.isEmpty)
    }
}
