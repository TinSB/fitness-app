// ImportedWorkoutSampleImportTests — HK-2 HealthKit Workout-History Import V1.
//
// REAL unit tests for the pure open-bag AppData.importedWorkoutSamples append used
// by the HK-2 gated import path. Run via `swift test`. Deterministic; never
// touches disk/network/HealthKit. Also pins the red line that imported workouts
// land in `importedWorkoutSamples` and NEVER in canonical `history`.

import XCTest
@testable import RedeDomain

final class ImportedWorkoutSampleImportTests: XCTestCase {

    private func workout(
        id: String? = "workout-abc",
        type: String = "TraditionalStrengthTraining",
        durationMin: Double = 45,
        kcal: Double = 320,
        startDate: String = "2026-05-27T06:30:00.000Z",
        endDate: String = "2026-05-27T07:15:00.000Z"
    ) -> ImportedWorkoutSample {
        ImportedWorkoutSample(
            id: id,
            source: "healthkit_import",
            workoutType: type,
            startDate: startDate,
            endDate: endDate,
            durationMin: .double(durationMin),
            activeEnergyKcal: .double(kcal),
            importedAt: "2026-05-27T08:00:00.000Z",
            dataFlag: "normal"
        )
    }

    // MARK: - Append to an empty base

    func testAppendingWorkoutToEmptyBase() throws {
        let appData = AppData.emptyCurrent().appendingImportedWorkoutSample(workout(durationMin: 50))
        XCTAssertEqual(appData.importedWorkoutSamples.count, 1)
        let w = try XCTUnwrap(appData.importedWorkoutSamples.first)
        XCTAssertEqual(w.workoutType, "TraditionalStrengthTraining")
        XCTAssertEqual(w.source, "healthkit_import")
        XCTAssertEqual(w.durationMin?.doubleValue ?? -1, 50, accuracy: 1e-9)
        XCTAssertEqual(w.activeEnergyKcal?.doubleValue ?? -1, 320, accuracy: 1e-9)
        // Round-trips through canonical bytes (SI values preserved).
        let reDecoded = try AppData(decoding: appData.canonicalJSONData())
        XCTAssertEqual(reDecoded.importedWorkoutSamples.count, 1)
        XCTAssertEqual(reDecoded.importedWorkoutSamples.first?.workoutType, "TraditionalStrengthTraining")
        XCTAssertEqual(reDecoded.importedWorkoutSamples.first?.durationMin?.doubleValue ?? -1, 50, accuracy: 1e-9)
    }

    // MARK: - Imported workouts are NOT canonical history (red line)

    func testImportedWorkoutNeverLandsInHistory() {
        // Appending a workout grows ONLY importedWorkoutSamples; history stays empty
        // (an imported Apple-Health workout is derived/external, never a canonical
        // native TrainingSession that the engine would consume).
        let appData = AppData.emptyCurrent().appendingImportedWorkoutSample(workout())
        XCTAssertEqual(appData.importedWorkoutSamples.count, 1)
        XCTAssertEqual(appData.history.count, 0, "imported workouts must never enter canonical history")
        XCTAssertNil(appData.activeSession)
    }

    // MARK: - Open-bag + existing samples preserved

    func testAppendingPreservesOpenBagAndExistingWorkouts() throws {
        let json = """
        {"schemaVersion":8,\
        "importedWorkoutSamples":[{"id":"old-1","workoutType":"Running","durationMin":30}],\
        "history":[],"settings":{"weightUnit":"kg"},"futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        let next = appData.appendingImportedWorkoutSample(workout(id: "new-1"))
        // Workouts grew by exactly one; old retained, new appended last.
        XCTAssertEqual(next.importedWorkoutSamples.count, 2)
        XCTAssertEqual(next.importedWorkoutSamples.first?.id, "old-1")
        XCTAssertEqual(next.importedWorkoutSamples.last?.id, "new-1")
        // schemaVersion unchanged (append is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // Open bag preserved: unknown key + settings survive verbatim.
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "unknown key dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"settings\":{\"weightUnit\":\"kg\"}"), "settings lost: \(canonical)")
        // Re-decodes cleanly.
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(reDecoded.importedWorkoutSamples.count, 2)
    }

    // MARK: - Dedup by content id (idempotent re-import)

    func testDedupByIdIsIdempotent() {
        let base = AppData.emptyCurrent().appendingImportedWorkoutSample(workout(id: "workout-x"))
        // Re-importing the SAME id (same workout) is a no-op.
        let again = base.appendingImportedWorkoutSample(workout(id: "workout-x"))
        XCTAssertEqual(again.importedWorkoutSamples.count, 1, "same-id re-import must not duplicate")
        // A genuinely different workout (different id) DOES append.
        let two = base.appendingImportedWorkoutSample(workout(id: "workout-y", type: "Running"))
        XCTAssertEqual(two.importedWorkoutSamples.count, 2)
        XCTAssertEqual(two.importedWorkoutSamples.last?.id, "workout-y")
        XCTAssertEqual(two.importedWorkoutSamples.last?.workoutType, "Running")
    }

    func testNilIdAlwaysAppends() {
        let once = AppData.emptyCurrent().appendingImportedWorkoutSample(workout(id: nil))
        let twice = once.appendingImportedWorkoutSample(workout(id: nil))
        XCTAssertEqual(twice.importedWorkoutSamples.count, 2)
    }

    // MARK: - Value semantics

    func testAppendingDoesNotMutateReceiver() {
        let base = AppData.emptyCurrent()
        _ = base.appendingImportedWorkoutSample(workout())
        XCTAssertTrue(base.importedWorkoutSamples.isEmpty, "receiver must be untouched (value semantics)")
    }
}
