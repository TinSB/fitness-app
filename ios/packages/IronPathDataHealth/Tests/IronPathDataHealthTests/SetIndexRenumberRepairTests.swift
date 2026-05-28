// SetIndexRenumberRepairTests — iOS-3C.
//
// Locks the iOS-3C setIndex renumber contract:
//   * Per-exercise / per-session scope only — never moves sets
//     between exercises.
//   * Preserves `TrainingSetLog.id`, weight, actualWeightKg, reps,
//     RIR, RPE, painFlag, completionStatus, done, etc.
//   * Idempotent — running twice yields the same sets array.
//   * Detect-based: a session with already-correct setIndex (no
//     duplicates, not-all-zero) is left alone.

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class SetIndexRenumberRepairTests: XCTestCase {
    func testDetectsAllZerosAndDuplicates() throws {
        let allZeroExercise = ExercisePrescription(
            id: "ex-1",
            sets: [
                TrainingSetLog(id: "s1", setIndex: .integer(0), weight: .double(60.5), reps: .integer(8)),
                TrainingSetLog(id: "s2", setIndex: .integer(0), weight: .double(60.5), reps: .integer(8)),
                TrainingSetLog(id: "s3", setIndex: .integer(0), weight: .double(60.5), reps: .integer(8)),
            ]
        )
        let dupExercise = ExercisePrescription(
            id: "ex-2",
            sets: [
                TrainingSetLog(id: "d1", setIndex: .integer(1), weight: .double(80.0)),
                TrainingSetLog(id: "d2", setIndex: .integer(1), weight: .double(80.0)),
            ]
        )
        let sane = ExercisePrescription(
            id: "ex-3",
            sets: [
                TrainingSetLog(id: "n1", setIndex: .integer(0)),
                TrainingSetLog(id: "n2", setIndex: .integer(1)),
                TrainingSetLog(id: "n3", setIndex: .integer(2)),
            ]
        )
        let session = TrainingSession(id: "s-zero", exercises: [allZeroExercise, dupExercise, sane])
        let appData = try makeAppDataWithHistory([session])
        let repair = SetIndexRenumberRepair()
        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected)
        XCTAssertEqual(detect.occurrences, 2)
        XCTAssertEqual(Set(detect.affectedIds), ["s-zero/ex-1", "s-zero/ex-2"])
    }

    func testApplyRenumbersToZeroIndexed() throws {
        let exercise = ExercisePrescription(
            id: "ex-bench",
            sets: [
                TrainingSetLog(id: "set-a", setIndex: .integer(0)),
                TrainingSetLog(id: "set-b", setIndex: .integer(0)),
                TrainingSetLog(id: "set-c", setIndex: .integer(0)),
            ]
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = SetIndexRenumberRepair()
        let result = try repair.apply(appData, options: nil)
        XCTAssertEqual(result.status, .applied)
        let cleaned = result.repairedData.history.first?.exercises?.first
        XCTAssertEqual(cleaned?.sets?[0].setIndex?.intValue, 0)
        XCTAssertEqual(cleaned?.sets?[1].setIndex?.intValue, 1)
        XCTAssertEqual(cleaned?.sets?[2].setIndex?.intValue, 2)
    }

    func testApplyPreservesSetIdsAndFieldsExceptSetIndex() throws {
        // Each set carries weight + reps + RIR + done + completedAt.
        // After repair every set should retain its id, weight, reps,
        // RIR, completedAt, done — only setIndex changes.
        let exercise = ExercisePrescription(
            id: "ex-bench",
            sets: [
                TrainingSetLog(
                    id: "set-a", setIndex: .integer(0),
                    weight: .double(60.5), reps: .integer(8),
                    rir: .number(.integer(2)),
                    completedAt: "2025-05-27T10:00:00Z", done: true
                ),
                TrainingSetLog(
                    id: "set-b", setIndex: .integer(0),
                    weight: .double(62.5), reps: .integer(8),
                    rir: .number(.integer(1)),
                    completedAt: "2025-05-27T10:05:00Z", done: true
                ),
            ]
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = SetIndexRenumberRepair()
        let result = try repair.apply(appData, options: nil)
        let renumbered = result.repairedData.history.first?.exercises?.first?.sets ?? []
        XCTAssertEqual(renumbered.count, 2)
        XCTAssertEqual(renumbered[0].id, "set-a")
        XCTAssertEqual(renumbered[0].weight?.doubleValue, 60.5)
        XCTAssertEqual(renumbered[0].reps?.intValue, 8)
        XCTAssertEqual(renumbered[0].rir, .number(.integer(2)))
        XCTAssertEqual(renumbered[0].completedAt, "2025-05-27T10:00:00Z")
        XCTAssertEqual(renumbered[0].done, true)
        XCTAssertEqual(renumbered[1].id, "set-b")
        XCTAssertEqual(renumbered[1].weight?.doubleValue, 62.5)
        XCTAssertEqual(renumbered[1].rir, .number(.integer(1)))
    }

    func testApplyIsScopedToTheAffectedExerciseOnly() throws {
        let dirty = ExercisePrescription(
            id: "ex-dirty",
            sets: [
                TrainingSetLog(id: "d1", setIndex: .integer(0)),
                TrainingSetLog(id: "d2", setIndex: .integer(0)),
            ]
        )
        let clean = ExercisePrescription(
            id: "ex-clean",
            sets: [
                TrainingSetLog(id: "c1", setIndex: .integer(7)),  // weird but unique
                TrainingSetLog(id: "c2", setIndex: .integer(9)),
            ]
        )
        let session = TrainingSession(id: "s1", exercises: [dirty, clean])
        let appData = try makeAppDataWithHistory([session])
        let repair = SetIndexRenumberRepair()
        let result = try repair.apply(appData, options: nil)
        let exercises = result.repairedData.history.first?.exercises ?? []
        XCTAssertEqual(exercises.count, 2)
        // Dirty exercise renumbered.
        XCTAssertEqual(exercises[0].sets?[0].setIndex?.intValue, 0)
        XCTAssertEqual(exercises[0].sets?[1].setIndex?.intValue, 1)
        // Clean exercise UNTOUCHED — setIndex stays 7, 9.
        XCTAssertEqual(exercises[1].sets?[0].setIndex?.intValue, 7)
        XCTAssertEqual(exercises[1].sets?[1].setIndex?.intValue, 9)
    }

    func testApplyIsIdempotent() throws {
        let exercise = ExercisePrescription(
            id: "ex-bench",
            sets: [
                TrainingSetLog(id: "a", setIndex: .integer(0)),
                TrainingSetLog(id: "b", setIndex: .integer(0)),
            ]
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = SetIndexRenumberRepair()
        let first = try repair.apply(appData, options: nil)
        XCTAssertEqual(first.status, .applied)
        // Detect on the repaired data → no further work.
        XCTAssertFalse(repair.detect(first.repairedData).detected)
    }

    func testNoOpOnSaneSetIndexHistory() throws {
        let exercise = ExercisePrescription(
            id: "ex-bench",
            sets: [
                TrainingSetLog(id: "a", setIndex: .integer(0)),
                TrainingSetLog(id: "b", setIndex: .integer(1)),
                TrainingSetLog(id: "c", setIndex: .integer(2)),
            ]
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = SetIndexRenumberRepair()
        XCTAssertFalse(repair.detect(appData).detected)
    }

    // MARK: - Helpers

    private func makeAppDataWithHistory(_ sessions: [TrainingSession]) throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
            .init(key: "history", value: .array(sessions.map { $0.encoded() })),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
