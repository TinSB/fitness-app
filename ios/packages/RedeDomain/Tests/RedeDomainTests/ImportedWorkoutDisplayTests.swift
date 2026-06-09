// ImportedWorkoutDisplayTests — 记录 imported-workout detail projection V1.
//
// Pure projection coverage (no IO, no ambient clock, NO Date): the metres → km
// conversion, full values, the all-missing honest-omission case, a partial case, a
// genuinely-recorded 0 (present, NOT omitted), and the additive entry accessor
// (native → nil; imported → projects, while `source` / `searchableText` are
// unchanged). Every numeric field is a `Double` — the projection never types a Date.

import XCTest
@testable import RedeDomain

final class ImportedWorkoutDisplayTests: XCTestCase {

    // MARK: - Fixtures

    /// An imported workout carrying only the rich fields under test (all NumberRepr,
    /// all defaulted to nil so each case opts in to exactly what it records).
    private func sample(
        durationMin: NumberRepr? = nil,
        distanceMeters: NumberRepr? = nil,
        activeEnergyKcal: NumberRepr? = nil,
        avgHeartRate: NumberRepr? = nil,
        maxHeartRate: NumberRepr? = nil
    ) -> ImportedWorkoutSample {
        ImportedWorkoutSample(
            source: "healthkit_import",
            workoutType: "running",
            durationMin: durationMin,
            activeEnergyKcal: activeEnergyKcal,
            avgHeartRate: avgHeartRate,
            maxHeartRate: maxHeartRate,
            distanceMeters: distanceMeters
        )
    }

    // MARK: - metres → kilometres (pure Double conversion, never a Date)

    func test_kilometresFromMetres_convertsExactly() {
        XCTAssertEqual(ImportedWorkoutDisplayFields.kilometresFromMetres(5000), 5.0, accuracy: 1e-9)
        XCTAssertEqual(ImportedWorkoutDisplayFields.kilometresFromMetres(500), 0.5, accuracy: 1e-9)
        XCTAssertEqual(ImportedWorkoutDisplayFields.kilometresFromMetres(5200), 5.2, accuracy: 1e-9)
        XCTAssertEqual(ImportedWorkoutDisplayFields.kilometresFromMetres(0), 0.0, accuracy: 1e-9)
    }

    // MARK: - full values (every field present, distance converted to km)

    func test_projection_fullValues_carriesEveryFieldAndConvertsDistance() throws {
        let fields = ImportedWorkoutDisplayFields(sample(
            durationMin: .integer(32),
            distanceMeters: .decimal(Decimal(5200)),
            activeEnergyKcal: .decimal(Decimal(280)),
            avgHeartRate: .integer(150),
            maxHeartRate: .integer(172)
        ))
        XCTAssertEqual(try XCTUnwrap(fields.durationMin), 32, accuracy: 1e-9)
        XCTAssertEqual(try XCTUnwrap(fields.distanceKm), 5.2, accuracy: 1e-9)
        XCTAssertEqual(try XCTUnwrap(fields.activeEnergyKcal), 280, accuracy: 1e-9)
        XCTAssertEqual(try XCTUnwrap(fields.avgHeartRate), 150, accuracy: 1e-9)
        XCTAssertEqual(try XCTUnwrap(fields.maxHeartRate), 172, accuracy: 1e-9)
        XCTAssertFalse(fields.isEmpty)
    }

    // MARK: - all missing (honest omission — every field nil, isEmpty true)

    func test_projection_allMissing_isEmptyAndEveryFieldNil() {
        let fields = ImportedWorkoutDisplayFields(sample())
        XCTAssertNil(fields.durationMin)
        XCTAssertNil(fields.distanceKm)
        XCTAssertNil(fields.activeEnergyKcal)
        XCTAssertNil(fields.avgHeartRate)
        XCTAssertNil(fields.maxHeartRate)
        XCTAssertTrue(fields.isEmpty)
    }

    // MARK: - partial (recorded fields pass through; missing stay nil)

    func test_projection_partial_keepsRecordedDropsMissing() throws {
        let fields = ImportedWorkoutDisplayFields(sample(
            durationMin: .integer(45),
            avgHeartRate: .integer(138)
        ))
        XCTAssertEqual(try XCTUnwrap(fields.durationMin), 45, accuracy: 1e-9)
        XCTAssertEqual(try XCTUnwrap(fields.avgHeartRate), 138, accuracy: 1e-9)
        XCTAssertNil(fields.distanceKm)
        XCTAssertNil(fields.activeEnergyKcal)
        XCTAssertNil(fields.maxHeartRate)
        XCTAssertFalse(fields.isEmpty)
    }

    // MARK: - a genuinely-recorded 0 is REAL data (present, NOT omitted)

    func test_projection_recordedZeroDistance_isPresentNotOmitted() throws {
        let fields = ImportedWorkoutDisplayFields(sample(distanceMeters: .integer(0)))
        // Honest omission applies ONLY to a field the import never recorded. A real
        // recorded 0 m projects to 0 km — present, NOT nil — so the surface may show it.
        XCTAssertEqual(try XCTUnwrap(fields.distanceKm), 0.0, accuracy: 1e-9)
        XCTAssertFalse(fields.isEmpty)
    }

    // MARK: - entry accessor is ADDITIVE (native → nil; imported → projects)

    func test_entryAccessor_nativeReturnsNil() {
        let native = CompletedTrainingEntry.native(NativeCompletedTraining(
            id: "s1",
            occurredAtIso: "2026-05-28T10:00:00.000Z",
            exerciseCount: 2,
            performedSetCount: 5
        ))
        XCTAssertNil(native.importedDisplayFields)
    }

    func test_entryAccessor_importedProjects_andLeavesSourceAndSearchUnchanged() throws {
        let workout = sample(durationMin: .integer(20), distanceMeters: .decimal(Decimal(3000)))
        let entry = CompletedTrainingEntry.imported(workout)

        let fields = try XCTUnwrap(entry.importedDisplayFields)
        XCTAssertEqual(try XCTUnwrap(fields.durationMin), 20, accuracy: 1e-9)
        XCTAssertEqual(try XCTUnwrap(fields.distanceKm), 3.0, accuracy: 1e-9)

        // Additive: the #446 source tag + search target are untouched by the projection.
        XCTAssertEqual(entry.source, .appleHealth)
        XCTAssertTrue(entry.searchableText.contains("running"))
        XCTAssertTrue(entry.searchableText.contains("来自 Apple 健康"))
    }
}
