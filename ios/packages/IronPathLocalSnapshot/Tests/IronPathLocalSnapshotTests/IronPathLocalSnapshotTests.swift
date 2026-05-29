// IronPathLocalSnapshotTests — iOS-12 Native Local Restore + History +
// Testability Mega Bundle V1.
//
// REAL unit tests for the local snapshot model / validation / migration / stats
// / store / restore-draft planner. Run via `swift test --package-path
// ios/packages/IronPathLocalSnapshot`. Local-only; the store tests use a fresh
// temp directory and never touch the app sandbox, iCloud, or the network.

import XCTest
@testable import IronPathLocalSnapshot

final class IronPathLocalSnapshotTests: XCTestCase {

    // MARK: - Builders

    private func exercise(_ id: String, completed: Int, target: Int) -> LocalCompletedExerciseSnapshot {
        LocalCompletedExerciseSnapshot(
            exerciseId: id, name: id, role: "accessory",
            progress: LocalCompletedSetProgressSnapshot(completedSets: completed, targetSets: target)
        )
    }

    /// A valid v2 snapshot whose aggregates equal the per-exercise sums.
    private func validSnapshot(
        id: String = "focus-normal-1",
        scenario: String = "normal",
        label: String = "普通",
        createdAtIso: String = "2026-05-27T10:00:00.000Z",
        exercises: [LocalCompletedExerciseSnapshot]? = nil,
        resume: Int? = 0,
        schemaVersion: Int = LocalCompletedSessionSnapshot.currentSchemaVersion
    ) -> LocalCompletedSessionSnapshot {
        let ex = exercises ?? [exercise("bench", completed: 2, target: 3), exercise("row", completed: 3, target: 3)]
        let totalC = ex.reduce(0) { $0 + $1.completedSets }
        let totalT = ex.reduce(0) { $0 + $1.targetSets }
        return LocalCompletedSessionSnapshot(
            snapshotId: id, createdAtIso: createdAtIso,
            scenarioId: scenario, scenarioLabel: label, sessionIntent: "normal-session",
            activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: totalC, totalTargetSets: totalT,
            exercises: ex, resumeExerciseIndex: resume, schemaVersion: schemaVersion
        )
    }

    private func tempDir() -> URL {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("IronPathLocalSnapshotTests-\(UUID().uuidString)", isDirectory: true)
        return dir
    }

    // MARK: - Model encode/decode round trip

    func testEncodeDecodeRoundTrip() throws {
        let snapshot = validSnapshot()
        let data = try JSONEncoder().encode(snapshot)
        let decoded = try JSONDecoder().decode(LocalCompletedSessionSnapshot.self, from: data)
        XCTAssertEqual(decoded, snapshot)
    }

    func testV1JsonDecodesWithoutResumeIndex() throws {
        // A v1 file has no `resumeExerciseIndex` key.
        let json = """
        {"schemaVersion":1,"snapshotId":"focus-normal-1","createdAtIso":"2026-05-27T10:00:00.000Z",
        "scenarioId":"normal","scenarioLabel":"普通","sessionIntent":"normal-session","activePhase":"base",
        "deloadLevel":"none","deloadStrategy":"maintain","totalCompletedSets":2,"totalTargetSets":3,
        "source":"local-ios-focus-mvp",
        "exercises":[{"exerciseId":"bench","name":"bench","role":"accessory","progress":{"completedSets":2,"targetSets":3}}]}
        """
        let decoded = try JSONDecoder().decode(LocalCompletedSessionSnapshot.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.schemaVersion, 1)
        XCTAssertNil(decoded.resumeExerciseIndex)
    }

    // MARK: - Validation (v1/v2 + rejections)

    func testValidSnapshotsPass() {
        XCTAssertTrue(LocalSnapshotValidator.isValid(validSnapshot()))
        XCTAssertTrue(LocalSnapshotValidator.isValid(validSnapshot(resume: nil)))
        XCTAssertTrue(LocalSnapshotValidator.isValid(validSnapshot(schemaVersion: 1)))
    }

    func testRejectsUnsupportedFutureSchema() {
        let s = validSnapshot(schemaVersion: 3)
        XCTAssertTrue(LocalSnapshotValidator.validate(s).issues.contains(.unsupportedSchemaVersion(3)))
    }

    func testRejectsEmptyIdAndTimestamp() {
        let noId = LocalCompletedSessionSnapshot(
            snapshotId: "", createdAtIso: "", scenarioId: "normal", scenarioLabel: "普通",
            sessionIntent: "x", activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: 0, totalTargetSets: 0, exercises: [exercise("a", completed: 0, target: 0)])
        let issues = LocalSnapshotValidator.validate(noId).issues
        XCTAssertTrue(issues.contains(.emptySnapshotId))
        XCTAssertTrue(issues.contains(.emptyCreatedAtIso))
    }

    func testRejectsNegativeAndOverTargetAndTotalsMismatchAndEmptyAndBadResume() {
        XCTAssertTrue(LocalSnapshotValidator.validate(
            validSnapshot(exercises: [exercise("a", completed: -1, target: 3)])
        ).issues.contains(.negativeSetCount))

        XCTAssertTrue(LocalSnapshotValidator.validate(
            validSnapshot(exercises: [exercise("a", completed: 5, target: 3)])
        ).issues.contains(.completedExceedsTarget))

        // totals that disagree with per-exercise sums
        let mismatch = LocalCompletedSessionSnapshot(
            snapshotId: "id", createdAtIso: "t", scenarioId: "normal", scenarioLabel: "普通",
            sessionIntent: "x", activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: 99, totalTargetSets: 99, exercises: [exercise("a", completed: 2, target: 3)])
        XCTAssertTrue(LocalSnapshotValidator.validate(mismatch).issues.contains(.totalsMismatch))

        let empty = LocalCompletedSessionSnapshot(
            snapshotId: "id", createdAtIso: "t", scenarioId: "normal", scenarioLabel: "普通",
            sessionIntent: "x", activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: 0, totalTargetSets: 0, exercises: [])
        XCTAssertTrue(LocalSnapshotValidator.validate(empty).issues.contains(.emptyExercises))

        XCTAssertTrue(LocalSnapshotValidator.validate(
            validSnapshot(exercises: [exercise("a", completed: 1, target: 3)], resume: 7)
        ).issues.contains(.invalidResumeIndex))
    }

    // MARK: - Migration

    func testMigrateV1ToCurrentFillsResumeAndBumpsVersion() {
        let v1 = validSnapshot(resume: nil, schemaVersion: 1)
        let result = LocalSnapshotMigration.migrate(v1)
        XCTAssertTrue(result.didMigrate)
        XCTAssertEqual(result.originalSchemaVersion, 1)
        XCTAssertEqual(result.snapshot.schemaVersion, LocalCompletedSessionSnapshot.currentSchemaVersion)
        XCTAssertEqual(result.snapshot.resumeExerciseIndex, 0)
        XCTAssertFalse(result.isUnsupportedFutureVersion)
    }

    func testMigrateDoesNotMutateSource() {
        let v1 = validSnapshot(resume: nil, schemaVersion: 1)
        let before = v1
        _ = LocalSnapshotMigration.migrate(v1)
        XCTAssertEqual(v1, before, "migration must be non-destructive (value type unchanged)")
        XCTAssertEqual(v1.schemaVersion, 1)
        XCTAssertNil(v1.resumeExerciseIndex)
    }

    func testMigrateCurrentIsNoop() {
        let v2 = validSnapshot()
        let result = LocalSnapshotMigration.migrate(v2)
        XCTAssertFalse(result.didMigrate)
        XCTAssertEqual(result.snapshot, v2)
    }

    func testFutureVersionNotDowngraded() {
        let v3 = validSnapshot(schemaVersion: 3)
        let result = LocalSnapshotMigration.migrate(v3)
        XCTAssertTrue(result.isUnsupportedFutureVersion)
        XCTAssertFalse(result.didMigrate)
        XCTAssertEqual(result.snapshot.schemaVersion, 3, "must not be downgraded")
    }

    func testBelowMinimumVersionNotPromoted() {
        let v0 = validSnapshot(schemaVersion: 0)
        let result = LocalSnapshotMigration.migrate(v0)
        XCTAssertFalse(result.didMigrate)
        XCTAssertEqual(result.snapshot.schemaVersion, 0, "corrupt sub-v1 must not be promoted to valid")
        XCTAssertFalse(LocalSnapshotValidator.isValid(result.snapshot))
    }

    // MARK: - Stats

    func testStatsDerivation() {
        // Distinct labels so the newest-first contract is actually pinned (the
        // most-recent fields must read the FIRST element, not just any element).
        let a = validSnapshot(id: "a", label: "普通", createdAtIso: "2026-05-26T10:00:00.000Z",
                              exercises: [exercise("x", completed: 2, target: 4)], resume: 0)
        let b = validSnapshot(id: "b", scenario: "deloadWeek", label: "减载周",
                              createdAtIso: "2026-05-27T10:00:00.000Z",
                              exercises: [exercise("y", completed: 3, target: 3)], resume: 0)
        let stats = LocalSnapshotStats.derive(from: [b, a])   // newest-first
        XCTAssertEqual(stats.totalSessions, 2)
        XCTAssertEqual(stats.totalCompletedSets, 5)
        XCTAssertEqual(stats.totalTargetSets, 7)
        XCTAssertEqual(stats.mostRecentScenarioLabel, "减载周", "most-recent must be the FIRST (newest) element")
        XCTAssertEqual(stats.lastSavedIso, "2026-05-27T10:00:00.000Z")
        XCTAssertEqual(stats.completionPercentText, "71%")
        XCTAssertEqual(LocalSnapshotStats.derive(from: []), .empty)
    }

    // MARK: - Restore-to-draft planner

    func testRestorePlanPreservesOrderAndCounts() throws {
        let ex = [exercise("a", completed: 1, target: 3), exercise("b", completed: 0, target: 2), exercise("c", completed: 2, target: 2)]
        let snapshot = validSnapshot(exercises: ex, resume: 1)
        let plan = try XCTUnwrap(try? LocalDraftRestorePlanner.plan(from: snapshot).get())
        XCTAssertEqual(plan.orderedExerciseIds, ["a", "b", "c"])   // order preserved
        XCTAssertEqual(plan.completedSetsByExerciseId, ["a": 1, "b": 0, "c": 2])   // counts preserved
        XCTAssertEqual(plan.resumeExerciseIndex, 1)
    }

    func testRestorePlanClampsResumeCursor() throws {
        let ex = [exercise("a", completed: 1, target: 3), exercise("b", completed: 0, target: 2)]
        let plan = try LocalDraftRestorePlanner.plan(from: validSnapshot(exercises: ex, resume: 99)).get()
        XCTAssertEqual(plan.resumeExerciseIndex, 1)   // clamped to count-1
    }

    func testRestorePlanRejectsImpossibleAndEmpty() {
        let impossible = LocalCompletedSessionSnapshot(
            snapshotId: "id", createdAtIso: "t", scenarioId: "normal", scenarioLabel: "普通",
            sessionIntent: "x", activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: 9, totalTargetSets: 1, exercises: [exercise("a", completed: 9, target: 1)])
        XCTAssertEqual(LocalDraftRestorePlanner.plan(from: impossible), .failure(.impossibleProgress))

        let empty = LocalCompletedSessionSnapshot(
            snapshotId: "id", createdAtIso: "t", scenarioId: "normal", scenarioLabel: "普通",
            sessionIntent: "x", activePhase: "base", deloadLevel: "none", deloadStrategy: "maintain",
            totalCompletedSets: 0, totalTargetSets: 0, exercises: [])
        XCTAssertEqual(LocalDraftRestorePlanner.plan(from: empty), .failure(.emptyExercises))
    }

    // MARK: - Store round trip (temp dir)

    func testStoreSaveLoadRoundTrip() throws {
        let store = LocalSessionSnapshotStore(directory: tempDir())
        let snapshot = validSnapshot()
        try store.save(snapshot)
        let loaded = try XCTUnwrap(try store.loadLatest())
        XCTAssertEqual(loaded, snapshot)
        let scan = try store.scanSnapshots()
        XCTAssertEqual(scan.valid.count, 1)
        XCTAssertEqual(scan.invalidCount, 0)
    }

    func testStoreAppendsRatherThanOverwrites() throws {
        let store = LocalSessionSnapshotStore(directory: tempDir())
        try store.save(validSnapshot(id: "a"))
        try store.save(validSnapshot(id: "b"))
        try store.save(validSnapshot(id: "c"))
        let scan = try store.scanSnapshots()
        XCTAssertEqual(scan.valid.count, 3, "completing more sessions appends new snapshots, never overwrites")
    }

    func testStoreBackupBeforeOverwriteOfLatestPointer() throws {
        let dir = tempDir()
        let store = LocalSessionSnapshotStore(directory: dir)
        try store.save(validSnapshot(id: "a"))
        try store.save(validSnapshot(id: "b"))   // second save backs up the latest pointer
        let bak = dir.appendingPathComponent("focus-session-latest.json.bak")
        XCTAssertTrue(FileManager.default.fileExists(atPath: bak.path))
        // CONTENT check: the backup must hold the PRIOR-good latest ("a"), and
        // the live latest pointer must hold the new value ("b").
        let bakSnapshot = try JSONDecoder().decode(LocalCompletedSessionSnapshot.self, from: Data(contentsOf: bak))
        XCTAssertEqual(bakSnapshot.snapshotId, "a", "backup preserves the prior-good latest")
        let latest = try JSONDecoder().decode(
            LocalCompletedSessionSnapshot.self,
            from: Data(contentsOf: dir.appendingPathComponent("focus-session-latest.json")))
        XCTAssertEqual(latest.snapshotId, "b")
    }

    func testStoreSkipsDecodedButInvalidFutureVersionFile() throws {
        let dir = tempDir()
        let store = LocalSessionSnapshotStore(directory: dir)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        // A well-formed JSON history file with an unsupported FUTURE schema (3):
        // it decodes fine but fails validation, so it is counted invalid, not shown.
        let v3Json = """
        {"schemaVersion":3,"snapshotId":"focus-normal-1","createdAtIso":"2026-05-27T10:00:00.000Z",
        "scenarioId":"normal","scenarioLabel":"普通","sessionIntent":"normal-session","activePhase":"base",
        "deloadLevel":"none","deloadStrategy":"maintain","totalCompletedSets":2,"totalTargetSets":3,
        "source":"local-ios-focus-mvp",
        "exercises":[{"exerciseId":"bench","name":"bench","role":"accessory","progress":{"completedSets":2,"targetSets":3}}]}
        """
        try Data(v3Json.utf8).write(to: dir.appendingPathComponent("focus-session-0001-normal.json"))
        let scan = try store.scanSnapshots()
        XCTAssertEqual(scan.valid.count, 0)
        XCTAssertEqual(scan.invalidCount, 1, "decoded-but-unsupported future schema is rejected, not shown")
    }

    func testStoreSkipsCorruptFileAndCanQuarantineIt() throws {
        let dir = tempDir()
        let store = LocalSessionSnapshotStore(directory: dir)
        try store.save(validSnapshot(id: "a"))
        // drop a corrupt history file in the sanctioned dir
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try Data("{ not valid json".utf8).write(to: dir.appendingPathComponent("focus-session-0009-normal.json"))
        let scan = try store.scanSnapshots()
        XCTAssertEqual(scan.valid.count, 1, "valid entry still loads")
        XCTAssertEqual(scan.invalidCount, 1, "corrupt entry counted, not fatal")
        let moved = try store.quarantineInvalid()
        XCTAssertEqual(moved, 1)
        let after = try store.scanSnapshots()
        XCTAssertEqual(after.invalidCount, 0, "quarantined file no longer listed as history")
    }

    func testStoreMigratesV1FileOnDecode() throws {
        let dir = tempDir()
        let store = LocalSessionSnapshotStore(directory: dir)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let v1Json = """
        {"schemaVersion":1,"snapshotId":"focus-normal-1","createdAtIso":"2026-05-27T10:00:00.000Z",
        "scenarioId":"normal","scenarioLabel":"普通","sessionIntent":"normal-session","activePhase":"base",
        "deloadLevel":"none","deloadStrategy":"maintain","totalCompletedSets":2,"totalTargetSets":3,
        "source":"local-ios-focus-mvp",
        "exercises":[{"exerciseId":"bench","name":"bench","role":"accessory","progress":{"completedSets":2,"targetSets":3}}]}
        """
        try Data(v1Json.utf8).write(to: dir.appendingPathComponent("focus-session-0001-normal.json"))
        let scan = try store.scanSnapshots()
        XCTAssertEqual(scan.valid.count, 1)
        XCTAssertEqual(scan.migratedCount, 1, "v1 file migrated forward on decode")
        XCTAssertEqual(scan.versionCounts[1], 1)
        XCTAssertEqual(scan.valid.first?.schemaVersion, LocalCompletedSessionSnapshot.currentSchemaVersion)
    }

    func testStoreClearRemovesOnlyItsOwnFiles() throws {
        let dir = tempDir()
        let store = LocalSessionSnapshotStore(directory: dir)
        try store.save(validSnapshot(id: "a"))
        // an unrelated file in the same dir must NOT be deleted
        try Data("keep".utf8).write(to: dir.appendingPathComponent("unrelated.txt"))
        let removed = try store.clear()
        XCTAssertGreaterThanOrEqual(removed, 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent("unrelated.txt").path))
        XCTAssertEqual(try store.scanSnapshots().valid.count, 0)
    }
}
