import Foundation
import XCTest
import RedeDataHealth
import RedeDomain
@testable import RedeTrainingDecision

final class ProgressionGateTests: XCTestCase {
    private struct LoggedSet {
        let weightKg: Double
        let reps: Int
        let rir: Double?
        let painReported: Bool
    }

    private struct Session {
        let id: String
        let date: String
        let exerciseId: String
        let sets: [LoggedSet]
        var painDiscomfort = false
    }

    private let trainVerdict = TodayVerdict(
        call: .train,
        reason: .normalProgression,
        signals: []
    )

    private var machineFortyPoundsKg: Double {
        LoadGrid.snapKg(
            40 / 2.204_622_621_8,
            equipment: "selectorized",
            unit: .lb
        )
    }

    private func uniformSets(
        weightKg: Double,
        reps: [Int],
        rir: Double? = 2
    ) -> [LoggedSet] {
        reps.map { LoggedSet(weightKg: weightKg, reps: $0, rir: rir, painReported: false) }
    }

    private func session(
        _ id: String,
        _ date: String,
        exerciseId: String,
        weightKg: Double,
        reps: [Int],
        rir: Double? = 2,
        painDiscomfort: Bool = false
    ) -> Session {
        Session(
            id: id,
            date: date,
            exerciseId: exerciseId,
            sets: uniformSets(weightKg: weightKg, reps: reps, rir: rir),
            painDiscomfort: painDiscomfort
        )
    }

    private func session(
        _ id: String,
        _ date: String,
        exerciseId: String,
        weightsKg: [Double],
        reps: [Int],
        rir: Double? = 2,
        painReported: [Bool] = []
    ) -> Session {
        XCTAssertEqual(weightsKg.count, reps.count, "test fixture weights/reps must align")
        XCTAssertTrue(
            painReported.isEmpty || painReported.count == reps.count,
            "test fixture pain flags/reps must align"
        )
        return Session(
            id: id,
            date: date,
            exerciseId: exerciseId,
            sets: weightsKg.indices.map { index in
                LoggedSet(
                    weightKg: weightsKg[index],
                    reps: reps[index],
                    rir: rir,
                    painReported: painReported.isEmpty ? false : painReported[index]
                )
            }
        )
    }

    private func plan(
        exerciseId: String,
        sessions: [Session],
        today: String = "2026-03-10",
        unitSystem: String = "kg",
        sets: Int,
        repMin: Int,
        repMax: Int,
        verdict: TodayVerdict? = nil
    ) throws -> ExercisePrescriptionPlan {
        let history: [[String: Any]] = sessions.map { session in
            let loggedSets: [[String: Any]] = session.sets.map { set in
                var object: [String: Any] = [
                    "weight": set.weightKg,
                    "reps": set.reps,
                ]
                if let rir = set.rir {
                    object["rir"] = rir
                }
                if set.painReported {
                    object["painFlag"] = true
                }
                return object
            }
            var object: [String: Any] = [
                "id": session.id,
                "date": session.date,
                "completed": true,
                "exercises": [[
                    "exerciseId": session.exerciseId,
                    "sets": loggedSets,
                ]],
            ]
            if session.painDiscomfort {
                object["skippedSets"] = [[
                    "exerciseId": session.exerciseId,
                    "setIndex": 1,
                    "reason": "painDiscomfort",
                ]]
            }
            return object
        }
        let appData: [String: Any] = [
            "schemaVersion": 8,
            "userProfile": ["unitSystem": unitSystem],
            "programTemplate": [
                "splitType": "upper-lower",
                "daysPerWeek": 4,
            ],
            "history": history,
        ]
        let data = try JSONSerialization.data(withJSONObject: appData, options: [.sortedKeys])
        let json = try XCTUnwrap(String(data: data, encoding: .utf8))
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: today)
        let customization = PlanCustomizationInput(dayPlans: [
            "upper": [
                .init(
                    exerciseId: exerciseId,
                    sets: sets,
                    repMin: repMin,
                    repMax: repMax
                ),
            ],
        ])
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: verdict ?? trainVerdict,
            customization: customization,
            dayCodeOverride: "upper"
        ))
        return try XCTUnwrap(prescription.exercises.first { $0.exerciseId == exerciseId })
    }

    /// Storage → clean input → prescription integration seam. Set observations remain
    /// hand-authored; the production flow/builder verifies their persisted shape, but this helper
    /// deliberately does not claim to exercise NextSetEngine's in-session recommendation seam.
    private func completedSession(
        from facts: Session,
        repMin: Int,
        repMax: Int,
        equipment: String,
        unit: LoadUnit
    ) throws -> TrainingSession {
        let targetWeight = try XCTUnwrap(facts.sets.first?.weightKg)
        let step = LoadGrid.stepKg(equipment: equipment, unit: unit)
        let exercise = ExercisePrescriptionPlan(
            exerciseId: facts.exerciseId,
            sets: facts.sets.count,
            restSeconds: 60,
            repLowerBound: repMin,
            repUpperBound: repMax,
            targetReps: repMax,
            targetWeightKg: targetWeight,
            targetRir: 2,
            previousWeightKg: nil,
            previousTopReps: nil,
            nextProjectedWeightKg: LoadGrid.nextRungKg(
                targetWeight,
                equipment: equipment,
                unit: unit,
                up: true
            ),
            progressionStepKg: step,
            change: .hold,
            reason: .holdProgressing,
            loadType: "external",
            equipment: equipment
        )
        var flow = TrainFlowState(
            prescription: TodayPrescription(
                dayCode: "upper",
                exercises: [exercise],
                dayReasons: []
            ),
            loadUnit: unit
        )
        for (index, set) in facts.sets.enumerated() {
            flow.logSet(CompletedSetObservation(
                weightKg: set.weightKg,
                reps: set.reps,
                rir: set.rir,
                painReported: set.painReported
            ))
            if index < facts.sets.index(before: facts.sets.endIndex) {
                flow.restFinished()
            }
        }
        let built = CompletedSessionBuilder.build(
            from: flow,
            sessionId: facts.id,
            dateISO: facts.date,
            startedAtISO: "\(facts.date)T10:00:00Z",
            finishedAtISO: "\(facts.date)T10:30:00Z",
            durationMinutes: 30
        )
        let builtSets = try XCTUnwrap(built.exercises.first?.sets)
        XCTAssertEqual(builtSets.count, facts.sets.count)
        XCTAssertEqual(builtSets.compactMap(\.reps), facts.sets.map(\.reps))
        return built
    }

    private func productionHistoryPlan(
        exerciseId: String,
        history: [TrainingSession],
        today: String,
        unitSystem: String,
        sets: Int,
        repMin: Int,
        repMax: Int
    ) throws -> ExercisePrescriptionPlan {
        let appData = try AppData(decoding: .object([
            "schemaVersion": .int(8),
            "userProfile": .object(["unitSystem": .string(unitSystem)]),
            "programTemplate": .object([
                "splitType": .string("upper-lower"),
                "daysPerWeek": .int(4),
            ]),
            "history": .array(history.map { .object($0.storage) }),
        ]))
        let cleanView = CleanAppDataViewBuilder.build(from: appData)
        XCTAssertTrue(
            cleanView.issues.isEmpty,
            "CompletedSessionBuilder output must survive DataHealth cleanly: \(cleanView.issues)"
        )
        XCTAssertEqual(cleanView.sessions.count, history.count)
        let input = try CleanTrainingDecisionInput.make(from: cleanView, todayISO: today)
        let customization = PlanCustomizationInput(dayPlans: [
            "upper": [
                .init(
                    exerciseId: exerciseId,
                    sets: sets,
                    repMin: repMin,
                    repMax: repMax
                ),
            ],
        ])
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            customization: customization,
            dayCodeOverride: "upper"
        ))
        return try XCTUnwrap(prescription.exercises.first { $0.exerciseId == exerciseId })
    }

    private func machinePlan(
        sessions: [Session],
        today: String = "2026-03-10",
        repMin: Int = 12,
        repMax: Int = 20
    ) throws -> ExercisePrescriptionPlan {
        try plan(
            exerciseId: "machine-lateral-raise",
            sessions: sessions,
            today: today,
            unitSystem: "lb",
            sets: 4,
            repMin: repMin,
            repMax: repMax
        )
    }

    private func benchPlan(
        sessions: [Session],
        today: String = "2026-03-10",
        verdict: TodayVerdict? = nil
    ) throws -> ExercisePrescriptionPlan {
        try plan(
            exerciseId: "bench-press",
            sessions: sessions,
            today: today,
            sets: 3,
            repMin: 6,
            repMax: 8,
            verdict: verdict
        )
    }

    // MARK: - S1a: top set + floor + unrounded mean + RIR gate

    func testS1aMachineLateralRaisesAfterTwentyEighteenSixteenFifteen() throws {
        let weight = machineFortyPoundsKg
        let next = LoadGrid.nextRungKg(weight, equipment: "selectorized", unit: .lb, up: true)
        let result = try machinePlan(sessions: [
            session("s1", "2026-03-01", exerciseId: "machine-lateral-raise", weightKg: weight, reps: [20, 18, 16, 15]),
        ])

        XCTAssertEqual(result.targetWeightKg, next, accuracy: 0.000_000_001)
        XCTAssertEqual(result.targetReps, 12)
        XCTAssertEqual(result.change, .increase)
        XCTAssertEqual(result.reason, .repCeilingReached)
    }

    func testS1aMachineLateralHoldsWhenOnlyFirstSetHitsCeiling() throws {
        let weight = machineFortyPoundsKg
        let result = try machinePlan(sessions: [
            session("s1", "2026-03-01", exerciseId: "machine-lateral-raise", weightKg: weight, reps: [20, 12, 12, 12]),
        ])

        XCTAssertEqual(result.targetWeightKg, weight, accuracy: 0.000_000_001)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.reason, .holdProgressing)
    }

    func testS1aBenchRaisesAfterEightEightSeven() throws {
        let result = try benchPlan(sessions: [
            session("s1", "2026-03-01", exerciseId: "bench-press", weightKg: 100, reps: [8, 8, 7]),
        ])

        XCTAssertEqual(result.targetWeightKg, 102.5)
        XCTAssertEqual(result.change, .increase)
    }

    func testS1aBenchHoldsAfterEightSixSixUsingUnroundedMean() throws {
        let result = try benchPlan(sessions: [
            session("s1", "2026-03-01", exerciseId: "bench-press", weightKg: 100, reps: [8, 6, 6]),
        ])

        XCTAssertEqual(result.targetWeightKg, 100)
        XCTAssertEqual(result.change, .hold)
    }

    func testS1aMachineLateralHoldsWhenAnySetFallsBelowFloor() throws {
        let weight = machineFortyPoundsKg
        let result = try machinePlan(sessions: [
            session("s1", "2026-03-01", exerciseId: "machine-lateral-raise", weightKg: weight, reps: [20, 18, 10]),
        ])

        XCTAssertEqual(result.targetWeightKg, weight, accuracy: 0.000_000_001)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.reason, .holdProgressing)
    }

    func testS1aMixedTopAndBackoffLoadsCannotRaiseTheTopWeight() throws {
        let result = try benchPlan(sessions: [
            session(
                "mixed-top-backoff",
                "2026-03-01",
                exerciseId: "bench-press",
                weightsKg: [100, 90, 90],
                reps: [6, 8, 8]
            ),
        ])

        XCTAssertEqual(result.targetWeightKg, 100)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.reason, .holdProgressing)
    }

    func testS1aMixedLoadWithPainFlagCannotRaiseThePainfulTopWeight() throws {
        let result = try plan(
            exerciseId: "machine-lateral-raise",
            sessions: [
                session(
                    "painful-mixed-load",
                    "2026-03-01",
                    exerciseId: "machine-lateral-raise",
                    weightsKg: [40, 40, 30, 30],
                    reps: [20, 18, 20, 20],
                    painReported: [false, true, false, false]
                ),
            ],
            sets: 4,
            repMin: 12,
            repMax: 20
        )

        XCTAssertEqual(result.targetWeightKg, 40)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.reason, .holdProgressing)
    }

    func testS1aStillRequiresMinimumRirOfOne() throws {
        let weight = machineFortyPoundsKg
        let result = try machinePlan(sessions: [
            session(
                "s1",
                "2026-03-01",
                exerciseId: "machine-lateral-raise",
                weightKg: weight,
                reps: [20, 18, 16, 15],
                rir: 0.75
            ),
        ])

        XCTAssertEqual(result.targetWeightKg, weight, accuracy: 0.000_000_001)
        XCTAssertEqual(result.change, .hold)
    }

    func testS1aMeanDoesNotOverflowForLargeCleanReps() throws {
        let result = try benchPlan(sessions: [
            session(
                "large-reps",
                "2026-03-01",
                exerciseId: "bench-press",
                weightKg: 100,
                reps: [Int.max, Int.max, Int.max]
            ),
        ])

        XCTAssertEqual(result.targetWeightKg, 102.5)
        XCTAssertEqual(result.change, .increase)
    }

    // MARK: - S1b: one retry only after a just-raised failed rung

    func testS1bFirstBelowFloorAttemptAfterRaiseHoldsCurrentRung() throws {
        let result = try benchPlan(sessions: [
            session("w", "2026-03-01", exerciseId: "bench-press", weightKg: 100, reps: [8, 8, 8]),
            session("h-first", "2026-03-08", exerciseId: "bench-press", weightKg: 102.5, reps: [5, 5, 5]),
        ])

        XCTAssertEqual(result.targetWeightKg, 102.5)
        XCTAssertEqual(result.targetReps, 8)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.reason, .holdProgressing)
    }

    func testS1bSecondBelowFloorAttemptAtSameRungEases() throws {
        let result = try benchPlan(sessions: [
            session("w", "2026-03-01", exerciseId: "bench-press", weightKg: 100, reps: [8, 8, 8]),
            session("h-first", "2026-03-08", exerciseId: "bench-press", weightKg: 102.5, reps: [5, 5, 5]),
            session("h-second", "2026-03-15", exerciseId: "bench-press", weightKg: 102.5, reps: [5, 5, 5]),
        ], today: "2026-03-16")

        XCTAssertEqual(result.targetWeightKg, 100)
        XCTAssertEqual(result.targetReps, 6)
        XCTAssertEqual(result.change, .ease)
        XCTAssertEqual(result.reason, .belowRepFloor)
    }

    func testS1bNearFailureAtNewRungStillEasesImmediately() throws {
        let result = try benchPlan(sessions: [
            session("w", "2026-03-01", exerciseId: "bench-press", weightKg: 100, reps: [8, 8, 8]),
            session("h", "2026-03-08", exerciseId: "bench-press", weightKg: 102.5, reps: [5, 5, 5], rir: 0.5),
        ])

        XCTAssertEqual(result.targetWeightKg, 100)
        XCTAssertEqual(result.change, .ease)
        XCTAssertEqual(result.reason, .nearFailureLastTime)
    }

    func testS1bLongGapSuppressesTheFailedNewRungRetry() throws {
        let verdict = TodayVerdict(
            call: .light,
            reason: .longGapReentry(days: 20),
            signals: []
        )
        let result = try benchPlan(
            sessions: [
                session("w", "2026-03-01", exerciseId: "bench-press", weightKg: 100, reps: [8, 8, 8]),
                session("h-failed", "2026-03-08", exerciseId: "bench-press", weightKg: 102.5, reps: [5, 5, 5]),
            ],
            today: "2026-03-28",
            verdict: verdict
        )

        XCTAssertEqual(result.targetWeightKg, 90)
        XCTAssertEqual(result.targetReps, 6)
        XCTAssertEqual(result.change, .ease)
        XCTAssertEqual(result.reason, .belowRepFloor)
    }

    func testOriginalRepRangeRemainsCatalogBoundAfterFailedHigherRung() throws {
        let weight = machineFortyPoundsKg
        let next = LoadGrid.nextRungKg(weight, equipment: "selectorized", unit: .lb, up: true)
        let result = try machinePlan(sessions: [
            session("w-before", "2026-01-01", exerciseId: "machine-lateral-raise", weightKg: weight, reps: [20, 18, 16, 15]),
            session("h-failed", "2026-01-08", exerciseId: "machine-lateral-raise", weightKg: next, reps: [11, 10, 9, 8]),
            session("w-return", "2026-01-15", exerciseId: "machine-lateral-raise", weightKg: weight, reps: [18, 18, 18, 18]),
        ])

        XCTAssertEqual(result.repUpperBound, 20)
        XCTAssertEqual(result.targetReps, 20)
    }

    // MARK: - Existing outer safety priorities

    func testPainPauseStillWinsOverNewS1aIncrease() throws {
        let result = try benchPlan(sessions: [
            session(
                "pain-1",
                "2026-03-01",
                exerciseId: "bench-press",
                weightKg: 100,
                reps: [8, 8, 7],
                painDiscomfort: true
            ),
            session(
                "pain-2",
                "2026-03-08",
                exerciseId: "bench-press",
                weightKg: 100,
                reps: [8, 8, 7],
                painDiscomfort: true
            ),
        ])

        XCTAssertEqual(result.targetWeightKg, 100)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.reason, .repCeilingReached)
        XCTAssertEqual(result.progressionPauseReason, .painDiscomfort)
    }

    func testLongGapStillSuppressesAnOtherwiseQualifiedIncrease() throws {
        let verdict = TodayVerdict(
            call: .light,
            reason: .longGapReentry(days: 20),
            signals: []
        )
        let result = try benchPlan(
            sessions: [
                session("old", "2026-01-01", exerciseId: "bench-press", weightKg: 100, reps: [8, 8, 8]),
            ],
            today: "2026-01-21",
            verdict: verdict
        )

        XCTAssertEqual(result.targetWeightKg, 90)
        XCTAssertEqual(result.targetReps, 8)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.reason, .holdProgressing)
    }

    // MARK: - Hand-authored observations -> builder -> clean input -> plan integrations

    func testMachineLateralEightWeekTimelineKeepsCatalogRangeAndRetryCadence() throws {
        let weight = machineFortyPoundsKg
        let next = LoadGrid.nextRungKg(weight, equipment: "selectorized", unit: .lb, up: true)
        let afterNext = LoadGrid.nextRungKg(next, equipment: "selectorized", unit: .lb, up: true)
        let sessionDates = [
            "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26",
            "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23",
        ]
        let planDates = [
            "2026-01-06", "2026-01-13", "2026-01-20", "2026-01-27",
            "2026-02-03", "2026-02-10", "2026-02-17", "2026-02-24",
        ]
        let performances: [(Double, [Int])] = [
            (weight, [20, 18, 16, 15]),
            (next, [11, 10, 9, 8]),
            (next, [11, 10, 9, 8]),
            (weight, [20, 18, 16, 15]),
            (next, [11, 10, 9, 8]),
            (next, [11, 10, 9, 8]),
            (weight, [20, 18, 16, 15]),
            (next, [20, 18, 16, 15]),
        ]
        var history: [TrainingSession] = []
        var plans: [ExercisePrescriptionPlan] = []
        for index in performances.indices {
            let facts = session(
                "week-\(index + 1)",
                sessionDates[index],
                exerciseId: "machine-lateral-raise",
                weightKg: performances[index].0,
                reps: performances[index].1
            )
            history.append(try completedSession(
                from: facts,
                repMin: 12,
                repMax: 20,
                equipment: "selectorized",
                unit: .lb
            ))
            plans.append(try productionHistoryPlan(
                exerciseId: "machine-lateral-raise",
                history: history,
                today: planDates[index],
                unitSystem: "lb",
                sets: 4,
                repMin: 12,
                repMax: 20
            ))
        }

        XCTAssertEqual(plans.map(\.repUpperBound), Array(repeating: 20, count: 8))
        XCTAssertEqual(plans[0].targetWeightKg, next, accuracy: 0.000_000_001, "week 1 uniform drop-off earns the first raise")
        XCTAssertEqual(plans[0].change, .increase)
        XCTAssertEqual(plans[1].targetWeightKg, next, accuracy: 0.000_000_001, "first failed new rung gets one retry")
        XCTAssertEqual(plans[1].change, .hold)
        XCTAssertEqual(plans[2].targetWeightKg, weight, accuracy: 0.000_000_001, "second failed attempt returns to W")
        XCTAssertEqual(plans[2].change, .ease)
        XCTAssertEqual(plans[3].targetWeightKg, next, accuracy: 0.000_000_001, "qualified W can earn H again without extending reps")
        XCTAssertEqual(plans[3].change, .increase)
        XCTAssertEqual(plans[4].targetWeightKg, next, accuracy: 0.000_000_001)
        XCTAssertEqual(plans[4].change, .hold)
        XCTAssertEqual(plans[5].targetWeightKg, weight, accuracy: 0.000_000_001)
        XCTAssertEqual(plans[5].change, .ease)
        XCTAssertEqual(plans[6].targetWeightKg, next, accuracy: 0.000_000_001)
        XCTAssertEqual(plans[6].change, .increase)
        XCTAssertEqual(plans[7].targetWeightKg, afterNext, accuracy: 0.000_000_001, "once H itself qualifies, ordinary progression continues")
        XCTAssertEqual(plans[7].change, .increase)
    }

    func testBenchNormalUserKeepsExistingEightWeekProgressionCadence() throws {
        let sessionDates = [
            "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26",
            "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23",
        ]
        let planDates = [
            "2026-01-06", "2026-01-13", "2026-01-20", "2026-01-27",
            "2026-02-03", "2026-02-10", "2026-02-17", "2026-02-24",
        ]
        let performances: [(Double, [Int])] = [
            (100, [6, 6, 6]),
            (100, [7, 7, 7]),
            (100, [8, 8, 8]),
            (102.5, [6, 6, 6]),
            (102.5, [7, 7, 7]),
            (102.5, [8, 8, 8]),
            (105, [6, 6, 6]),
            (105, [7, 7, 7]),
        ]
        var history: [TrainingSession] = []
        var plans: [ExercisePrescriptionPlan] = []
        for index in performances.indices {
            let facts = session(
                "week-\(index + 1)",
                sessionDates[index],
                exerciseId: "bench-press",
                weightKg: performances[index].0,
                reps: performances[index].1
            )
            history.append(try completedSession(
                from: facts,
                repMin: 6,
                repMax: 8,
                equipment: "barbell",
                unit: .kg
            ))
            plans.append(try productionHistoryPlan(
                exerciseId: "bench-press",
                history: history,
                today: planDates[index],
                unitSystem: "kg",
                sets: 3,
                repMin: 6,
                repMax: 8
            ))
        }

        XCTAssertEqual(plans.map(\.repUpperBound), Array(repeating: 8, count: 8), "catalog rep range remains unchanged")
        XCTAssertEqual(plans[0].targetWeightKg, 100)
        XCTAssertEqual(plans[1].targetWeightKg, 100)
        XCTAssertEqual(plans[2].targetWeightKg, 102.5, "first old-style all-eight week still raises")
        XCTAssertEqual(plans[2].change, .increase)
        XCTAssertEqual(plans[5].targetWeightKg, 105, "second old-style all-eight week still raises")
        XCTAssertEqual(plans[5].change, .increase)
        XCTAssertEqual(plans[7].targetWeightKg, 105)
        XCTAssertEqual(plans[7].change, .hold)
    }
}
