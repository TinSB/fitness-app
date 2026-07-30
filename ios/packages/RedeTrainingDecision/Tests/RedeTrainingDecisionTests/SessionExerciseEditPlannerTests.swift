import XCTest
import RedeDataHealth
@testable import RedeTrainingDecision

final class SessionExerciseEditPlannerTests: XCTestCase {
    func testSamePrimaryMuscleBorrowsFirstQueuedTargetsAndFullRepRange() throws {
        let catalog = makeCatalog([
            entry("chest-first", muscle: "chest", start: 20),
            entry("arms-second", muscle: "biceps", start: 10),
            entry("chest-new", muscle: "chest", start: 12.5),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("chest-first", reps: 6, rir: 1, rest: 180, lower: 5, upper: 8, weight: 40),
            plan("arms-second", reps: 12, rir: 3, rest: 60, lower: 10, upper: 15, weight: 10),
        ])

        let result = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "chest-new",
            sessionPlan: sessionPlan,
            currentExerciseIndex: 0,
            sessions: [],
            catalog: catalog,
            allowedEquipment: nil,
            loadUnit: .kg
        ))

        XCTAssertEqual(result.exerciseId, "chest-new")
        XCTAssertEqual(result.restSeconds, 180)
        XCTAssertEqual(result.repLowerBound, 5)
        XCTAssertEqual(result.repUpperBound, 8)
        XCTAssertEqual(result.sets.count, 3)
        XCTAssertEqual(result.sets.map(\.targetReps), [6, 6, 6])
        XCTAssertEqual(result.sets.map(\.targetRir), [1, 1, 1])
        XCTAssertEqual(result.sets.map(\.targetWeightKg), [12.5, 12.5, 12.5])
    }

    func testNoPrimaryMuscleMatchUsesConservativeModesAndFirstMatchingRepDonor() throws {
        let catalog = makeCatalog([
            entry("first-eight", muscle: "chest", start: 20),
            entry("first-ten", muscle: "back", start: 20),
            entry("second-ten", muscle: "shoulders", start: 20),
            entry("second-eight", muscle: "biceps", start: 20),
            entry("legs-new", muscle: "quads", start: 30),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("first-eight", reps: 8, rir: 3, rest: 60, lower: 6, upper: 9),
            plan("first-ten", reps: 10, rir: 1, rest: 90, lower: 8, upper: 12),
            plan("second-ten", reps: 10, rir: 2, rest: 60, lower: 10, upper: 15),
            plan("second-eight", reps: 8, rir: 2, rest: 90, lower: 7, upper: 10),
        ])

        let result = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "legs-new",
            sessionPlan: sessionPlan,
            currentExerciseIndex: 0,
            sessions: [],
            catalog: catalog,
            allowedEquipment: nil,
            loadUnit: .kg
        ))

        XCTAssertEqual(result.sets.map(\.targetReps), [8, 8, 8],
                       "target reps mode tie must choose the smaller value")
        XCTAssertEqual(result.restSeconds, 90,
                       "rest mode tie must choose the larger value")
        XCTAssertEqual(result.sets.map(\.targetRir), [3, 3, 3],
                       "RIR must come from the current exercise")
        XCTAssertEqual(result.repLowerBound, 6)
        XCTAssertEqual(result.repUpperBound, 9,
                       "rep bounds must come from the first queued plan matching the winning target reps")
    }

    func testHistoryUsesLatestCanonicalSessionAndNoHistoryRespectsLoadSemantics() throws {
        let catalog = makeCatalog([
            entry("external-new", muscle: "chest", start: 11),
            entry("bodyweight-new", muscle: "chest", equipment: "bodyweight", start: 0, loadType: "bodyweight"),
            entry("assisted-new", muscle: "back", equipment: "selectorized", start: 35, loadType: "assisted"),
            entry("donor", muscle: "arms", start: 10),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("donor", reps: 10, rir: 2, rest: 75, lower: 8, upper: 12),
        ])
        let sessions = [
            session("older", date: "2026-07-01", exerciseId: "external-new", weights: [15, 17.5]),
            session("same-day-first", date: "2026-07-02", exerciseId: "external-new", weights: [20]),
            session("same-day-last", date: "2026-07-02", exerciseId: "external-new", weights: [22.5, 25]),
        ]

        let historical = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "external-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: sessions, catalog: catalog, allowedEquipment: nil, loadUnit: .kg
        ))
        XCTAssertEqual(historical.sets.map(\.targetWeightKg), [25, 25, 25])

        let bodyweight = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "bodyweight-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: [], catalog: catalog, allowedEquipment: nil, loadUnit: .kg
        ))
        XCTAssertEqual(bodyweight.sets.map(\.targetWeightKg), [0, 0, 0])

        let assisted = try XCTUnwrap(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "assisted-new", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: [], catalog: catalog, allowedEquipment: nil, loadUnit: .kg
        ))
        XCTAssertEqual(assisted.stepKg, 5)
        XCTAssertEqual(assisted.sets.map(\.targetWeightKg), [35, 35, 35])
    }

    func testCandidatesExcludeScheduledUnsupportedDeprecatedAndUnavailableEquipment() {
        let catalog = makeCatalog([
            entry("scheduled", muscle: "chest", start: 20),
            entry("allowed", muscle: "biceps", start: 10),
            entry("wrong-equipment", muscle: "back", equipment: "barbell", start: 40),
            entry("deprecated", muscle: "quads", start: 30, deprecated: true),
            entry("unsupported", muscle: "shoulders", start: 10, loadType: "future-load"),
        ])
        let sessionPlan = SessionSetPlan(dayCode: "test", exercises: [
            plan("scheduled", reps: 8, rir: 2, rest: 90, lower: 6, upper: 10),
        ])

        XCTAssertEqual(
            SessionExerciseEditPlanner.availableExercises(
                sessionPlan: sessionPlan,
                catalog: catalog,
                allowedEquipment: ["dumbbell"]
            ).map(\.id),
            ["allowed"]
        )
        XCTAssertNil(SessionExerciseEditPlanner.makeAdHocPlan(
            exerciseId: "scheduled", sessionPlan: sessionPlan, currentExerciseIndex: 0,
            sessions: [], catalog: catalog, allowedEquipment: ["dumbbell"], loadUnit: .kg
        ))
    }

    private func makeCatalog(_ entries: [ExerciseCatalogEntry]) -> ExerciseCatalog {
        ExerciseCatalog(catalogVersion: "session-edit-test", entries: entries)
    }

    private func entry(
        _ id: String,
        muscle: String,
        equipment: String = "dumbbell",
        start: Double,
        loadType: String = "external",
        deprecated: Bool = false
    ) -> ExerciseCatalogEntry {
        ExerciseCatalogEntry(
            id: id,
            movementPattern: "test-pattern",
            primaryMuscle: muscle,
            equipment: equipment,
            kind: "accessory",
            substitutionGroups: ["test-\(muscle)"],
            startWeightKg: start,
            loadType: loadType,
            rank: 10,
            deprecated: deprecated
        )
    }

    private func plan(
        _ id: String,
        reps: Int,
        rir: Double,
        rest: Int,
        lower: Int,
        upper: Int,
        weight: Double = 20
    ) -> ExerciseSetPlan {
        ExerciseSetPlan(
            exerciseId: id,
            restSeconds: rest,
            repLowerBound: lower,
            repUpperBound: upper,
            stepKg: 2.5,
            loadType: "external",
            sets: (1...3).map {
                PlannedSet(index: $0, targetWeightKg: weight, targetReps: reps, targetRir: rir)
            }
        )
    }

    private func session(
        _ id: String,
        date: String,
        exerciseId: String,
        weights: [Double]
    ) -> CleanTrainingSession {
        CleanTrainingSession(
            id: id,
            date: date,
            exercises: [
                CleanExercise(
                    exerciseId: exerciseId,
                    sets: weights.map { CleanLoggedSet(weight: $0, reps: 8, rir: 2) }
                ),
            ]
        )
    }
}
