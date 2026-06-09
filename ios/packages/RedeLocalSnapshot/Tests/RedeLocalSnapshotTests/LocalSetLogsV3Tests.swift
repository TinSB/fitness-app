// LocalSetLogsV3Tests — iOS-17A Native Per-Set Logging Mega V1 (iOS-17d).
//
// REAL unit tests for the v3 schema addition: the DERIVED per-set `setLogs`
// display copy (weight kg / reps / RIR), forward migration of v1/v2 files (which
// have no per-set detail), v3 round-trip, and validation of the optional field.
// Run via `swift test`. Local-only; never touches the network or app sandbox.
//
// These guard the §12 invariant that `setLogs` is a DERIVED display record: it is
// written alongside the canonical AppData performed sets and validated here, but
// RedeLocalSnapshot never reads it back as a source of truth.

import XCTest
@testable import RedeLocalSnapshot

final class LocalSetLogsV3Tests: XCTestCase {

    // MARK: - Builders (v3, with optional per-set detail)

    private func exercise(
        _ id: String, completed: Int, target: Int,
        setLogs: [LocalCompletedSetEntrySnapshot]? = nil
    ) -> LocalCompletedExerciseSnapshot {
        LocalCompletedExerciseSnapshot(
            exerciseId: id, name: id, role: "accessory",
            progress: LocalCompletedSetProgressSnapshot(completedSets: completed, targetSets: target),
            setLogs: setLogs
        )
    }

    private func snapshot(
        exercises: [LocalCompletedExerciseSnapshot],
        schemaVersion: Int = LocalCompletedSessionSnapshot.currentSchemaVersion
    ) -> LocalCompletedSessionSnapshot {
        let totalC = exercises.reduce(0) { $0 + $1.completedSets }
        let totalT = exercises.reduce(0) { $0 + $1.targetSets }
        return LocalCompletedSessionSnapshot(
            snapshotId: "focus-normal-1", createdAtIso: "2026-05-27T10:00:00.000Z",
            scenarioId: "normal", scenarioLabel: "普通", sessionIntent: "normal-session",
            activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: totalC, totalTargetSets: totalT,
            exercises: exercises, resumeExerciseIndex: 0, schemaVersion: schemaVersion
        )
    }

    // MARK: - currentSchemaVersion is v3

    func testCurrentSchemaVersionIsThree() {
        XCTAssertEqual(LocalCompletedSessionSnapshot.currentSchemaVersion, 3)
        XCTAssertTrue(LocalSnapshotValidator.acceptedSchemaVersions.contains(3))
    }

    // MARK: - v3 round trip with per-set detail

    func testV3RoundTripWithSetLogs() throws {
        let logs = [
            LocalCompletedSetEntrySnapshot(setIndex: 0, weightKg: 60, reps: 8, rir: 2),
            LocalCompletedSetEntrySnapshot(setIndex: 1, weightKg: 62.5, reps: 6, rir: 1),
        ]
        let snap = snapshot(exercises: [exercise("bench", completed: 2, target: 3, setLogs: logs)])
        let data = try JSONEncoder().encode(snap)
        let decoded = try JSONDecoder().decode(LocalCompletedSessionSnapshot.self, from: data)
        XCTAssertEqual(decoded, snap)
        XCTAssertEqual(decoded.exercises.first?.setLogs?.count, 2)
        XCTAssertEqual(decoded.exercises.first?.setLogs?.first?.weightKg, 60)
        XCTAssertEqual(decoded.exercises.first?.setLogs?.last?.weightKg, 62.5)
        XCTAssertEqual(decoded.exercises.first?.setLogs?.last?.reps, 6)
        XCTAssertEqual(decoded.exercises.first?.setLogs?.last?.rir, 1)
    }

    func testV3RoundTripWithBlankMetrics() throws {
        // A set completed with no weight/reps/rir entered → all nil (honest), still
        // a real recorded set (its setIndex is present).
        let logs = [LocalCompletedSetEntrySnapshot(setIndex: 0)]
        let snap = snapshot(exercises: [exercise("row", completed: 1, target: 1, setLogs: logs)])
        let decoded = try JSONDecoder().decode(
            LocalCompletedSessionSnapshot.self, from: try JSONEncoder().encode(snap))
        let entry = try XCTUnwrap(decoded.exercises.first?.setLogs?.first)
        XCTAssertEqual(entry.setIndex, 0)
        XCTAssertNil(entry.weightKg)
        XCTAssertNil(entry.reps)
        XCTAssertNil(entry.rir)
    }

    // MARK: - Optional field: nil and empty both valid

    func testNilAndEmptySetLogsAreValid() {
        XCTAssertTrue(LocalSnapshotValidator.isValid(
            snapshot(exercises: [exercise("a", completed: 1, target: 1, setLogs: nil)])))
        XCTAssertTrue(LocalSnapshotValidator.isValid(
            snapshot(exercises: [exercise("a", completed: 1, target: 1, setLogs: [])])))
        XCTAssertTrue(LocalSnapshotValidator.isValid(
            snapshot(exercises: [exercise("a", completed: 1, target: 1,
                setLogs: [LocalCompletedSetEntrySnapshot(setIndex: 0, weightKg: 60, reps: 8, rir: 2)])])))
    }

    // MARK: - Corrupt per-set detail is rejected

    func testNegativeSetLogMetricsRejected() {
        let badWeight = snapshot(exercises: [exercise("a", completed: 1, target: 1,
            setLogs: [LocalCompletedSetEntrySnapshot(setIndex: 0, weightKg: -5)])])
        XCTAssertTrue(LocalSnapshotValidator.validate(badWeight).issues.contains(.negativeSetCount))

        let badReps = snapshot(exercises: [exercise("a", completed: 1, target: 1,
            setLogs: [LocalCompletedSetEntrySnapshot(setIndex: 0, reps: -1)])])
        XCTAssertTrue(LocalSnapshotValidator.validate(badReps).issues.contains(.negativeSetCount))

        let badIndex = snapshot(exercises: [exercise("a", completed: 1, target: 1,
            setLogs: [LocalCompletedSetEntrySnapshot(setIndex: -1, weightKg: 60)])])
        XCTAssertTrue(LocalSnapshotValidator.validate(badIndex).issues.contains(.negativeSetCount))
    }

    // MARK: - v1/v2 forward migration leaves setLogs nil

    func testV1FileDecodesWithoutSetLogsAndMigratesForward() throws {
        // A v1 file has no `setLogs` key anywhere.
        let v1Json = """
        {"schemaVersion":1,"snapshotId":"focus-normal-1","createdAtIso":"2026-05-27T10:00:00.000Z",
        "scenarioId":"normal","scenarioLabel":"普通","sessionIntent":"normal-session","activePhase":"base",
        "deloadLevel":"none","deloadStrategy":"maintain","totalCompletedSets":2,"totalTargetSets":3,
        "source":"local-ios-focus-mvp",
        "exercises":[{"exerciseId":"bench","name":"bench","role":"accessory","progress":{"completedSets":2,"targetSets":3}}]}
        """
        let decoded = try JSONDecoder().decode(LocalCompletedSessionSnapshot.self, from: Data(v1Json.utf8))
        XCTAssertNil(decoded.exercises.first?.setLogs, "v1 has no per-set detail")

        let migrated = LocalSnapshotMigration.migrate(decoded)
        XCTAssertTrue(migrated.didMigrate)
        XCTAssertEqual(migrated.originalSchemaVersion, 1)
        XCTAssertEqual(migrated.snapshot.schemaVersion, 3)
        XCTAssertNil(migrated.snapshot.exercises.first?.setLogs,
                     "a migrated legacy session honestly shows no per-set detail")
        XCTAssertTrue(LocalSnapshotValidator.isValid(migrated.snapshot))
    }
}
