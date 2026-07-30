import Foundation
import XCTest
import RedeDataHealth
import RedeDomain
@testable import RedeTrainingDecision

final class OccurrenceCompatibilityIntegrationTests: XCTestCase {
    private let trainVerdict = TodayVerdict(
        call: .train,
        reason: .normalProgression,
        signals: []
    )

    private func pushFlow() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion":8,"programTemplate":{"splitType":"push-pull-legs"}}"#,
            todayISO: "2026-07-24"
        )
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "push-a"
        ))
        XCTAssertEqual(prescription.exercises.first?.exerciseId, "bench-press")
        return TrainFlowState(prescription: prescription)
    }

    private func completedSession(
        from flow: TrainFlowState,
        id: String,
        dateISO: String
    ) -> TrainingSession {
        CompletedSessionBuilder.build(
            from: flow,
            sessionId: id,
            dateISO: dateISO,
            startedAtISO: "\(dateISO)T10:00:00Z",
            finishedAtISO: "\(dateISO)T10:30:00Z",
            durationMinutes: 30
        )
    }

    private func decisionInput(
        history: [JSONValue],
        todayISO: String,
        splitType: String = "full-body"
    ) throws -> CleanTrainingDecisionInput {
        let appData = try AppData(decoding: .object([
            "schemaVersion": .int(8),
            "programTemplate": .object(["splitType": .string(splitType)]),
            "history": .array(history),
        ]))
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        XCTAssertTrue(cleanView.issues.isEmpty, "cross-layer fixture must remain clean: \(cleanView.issues)")
        return try CleanTrainingDecisionInput.make(from: cleanView, todayISO: todayISO)
    }

    private func singleExerciseSession(
        id: String,
        dateISO: String,
        exerciseId: String,
        weightKg: Int,
        reps: Int,
        painSkip: Bool = false
    ) -> JSONValue {
        let sets: [JSONValue] = (1...3).map { setIndex in
            .object([
                "setIndex": .int(Int64(setIndex)),
                "weight": .int(Int64(weightKg)),
                "reps": .int(Int64(reps)),
                "rir": .int(2),
            ])
        }
        var session: [String: JSONValue] = [
            "id": .string(id),
            "date": .string(dateISO),
            "completed": .bool(true),
            "exercises": .array([
                .object([
                    "exerciseId": .string(exerciseId),
                    "sets": .array(sets),
                ]),
            ]),
        ]
        if painSkip {
            session["skippedSets"] = .array([
                .object([
                    "exerciseId": .string(exerciseId),
                    "setIndex": .int(1),
                    "reason": .string("painDiscomfort"),
                ]),
            ])
        }
        return .object(session)
    }

    func testMidExerciseSwapFeedsFinalPatternOccurrenceIntoNextPrescriptionSticky() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.logSet(CompletedSetObservation(
            weightKg: 30, reps: 10, rir: 2, painReported: false
        ))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(from: flow, id: "sticky-split", dateISO: "2026-07-24")
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press"],
            "builder must expose the occurrence order consumed downstream"
        )

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        let cleanOccurrences = input.sessions.first?.exercises.map(\.exerciseId)
        XCTAssertEqual(cleanOccurrences, ["bench-press", "db-bench-press"])
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern == "horizontal-press"
        })

        XCTAssertEqual(
            horizontalPress.exerciseId,
            "db-bench-press",
            "the next same-pattern slot must retain the action actually used last in the session"
        )
    }

    func testPainFlagAcrossRepeatedOccurrenceDoesNotClearActivePainConservativeState() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 10, rir: 2, painReported: true
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.logSet(CompletedSetObservation(
            weightKg: 30, reps: 10, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "bench-press")
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 10, rir: 2, painReported: false
        ))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let splitSession = completedSession(
            from: flow,
            id: "pain-split",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(
            splitSession.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press", "bench-press"]
        )
        XCTAssertEqual(
            splitSession.exercises
                .filter { $0.exerciseId == "bench-press" }
                .flatMap(\.sets)
                .map { $0.painFlag == true },
            [true, false]
        )

        let input = try decisionInput(
            history: [
                singleExerciseSession(
                    id: "pain-1", dateISO: "2026-07-20",
                    exerciseId: "bench-press", weightKg: 50, reps: 8, painSkip: true
                ),
                singleExerciseSession(
                    id: "pain-2", dateISO: "2026-07-22",
                    exerciseId: "bench-press", weightKg: 55, reps: 8, painSkip: true
                ),
                .object(splitSession.storage),
            ],
            todayISO: "2026-07-29"
        )
        XCTAssertEqual(
            input.sessions.last?.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press", "bench-press"],
            "DataHealth must preserve repeated occurrence order before plan() consumes it"
        )
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let bench = try XCTUnwrap(next.exercises.first { $0.exerciseId == "bench-press" })

        XCTAssertEqual(bench.targetWeightKg, 60)
        XCTAssertEqual(bench.change, .hold)
        XCTAssertEqual(bench.progressionPauseReason, .painDiscomfort)
    }

    func testSingleOccurrenceHistoryKeepsExactPreOccurrencePrescription() throws {
        let input = try decisionInput(
            history: [
                singleExerciseSession(
                    id: "pain-1", dateISO: "2026-07-20",
                    exerciseId: "db-bench-press", weightKg: 30, reps: 10, painSkip: true
                ),
                singleExerciseSession(
                    id: "pain-2", dateISO: "2026-07-22",
                    exerciseId: "db-bench-press", weightKg: 30, reps: 10, painSkip: true
                ),
                singleExerciseSession(
                    id: "normal-recovery", dateISO: "2026-07-24",
                    exerciseId: "db-bench-press", weightKg: 30, reps: 10
                ),
            ],
            todayISO: "2026-07-29"
        )
        let bench = try XCTUnwrap(ExerciseCatalog.minimal.entry(id: "bench-press"))
        let dumbbellBench = try XCTUnwrap(ExerciseCatalog.minimal.entry(id: "db-bench-press"))
        let catalog = ExerciseCatalog(
            catalogVersion: "single-occurrence-compatibility",
            entries: [bench, dumbbellBench]
        )
        let actual = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            catalog: catalog,
            dayCodeOverride: "full-a"
        ))
        let expected = TodayPrescription(
            dayCode: "full-a",
            exercises: [
                ExercisePrescriptionPlan(
                    exerciseId: "db-bench-press",
                    sets: 3,
                    restSeconds: 150,
                    repLowerBound: 6,
                    repUpperBound: 10,
                    targetReps: 6,
                    targetWeightKg: 32.5,
                    targetRir: 2,
                    previousWeightKg: 30,
                    previousTopReps: 10,
                    nextProjectedWeightKg: 35,
                    progressionStepKg: 2.5,
                    change: .increase,
                    reason: .repCeilingReached,
                    loadType: "external",
                    equipment: "dumbbell"
                ),
            ],
            dayReasons: [
                .slotUnfilled(pattern: "squat-pattern"),
                .slotUnfilled(pattern: "vertical-pull"),
                .slotUnfilled(pattern: "hinge"),
                .slotUnfilled(pattern: "vertical-press"),
                .slotUnfilled(pattern: "curl"),
            ]
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        XCTAssertEqual(actual, expected)
        XCTAssertEqual(
            try encoder.encode(actual),
            try encoder.encode(expected),
            "single-element histories must remain byte-identical across the compatibility change"
        )
    }
}
