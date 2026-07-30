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

    private func adHocExercisePlan(
        id: String = "db-bench-press",
        targetWeightKg: Double = 30
    ) -> ExerciseSetPlan {
        ExerciseSetPlan(
            exerciseId: id,
            restSeconds: 90,
            repLowerBound: 8,
            repUpperBound: 12,
            stepKg: 2.5,
            loadType: "external",
            sets: (1...3).map {
                PlannedSet(
                    index: $0,
                    targetWeightKg: targetWeightKg,
                    targetReps: 10,
                    targetRir: 2
                )
            }
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

    func testMidExerciseSwapFeedsReplacementChainTerminalIntoNextPrescriptionSticky() throws {
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

    func testFactBearingSwapFollowedByZeroFactSwapKeepsChainTerminalAndWarmupGate() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()

        flow.replaceCurrentExercise(with: "db-bench-press")
        XCTAssertFalse(flow.isWarmingUp, "the first fact-bearing replacement must not reopen warm-up")

        flow.replaceCurrentExercise(with: "smith-bench-press")
        XCTAssertFalse(
            flow.isWarmingUp,
            "a zero-fact follow-up replacement is still downstream of the slot's completed fact"
        )
        flow.logSet(CompletedSetObservation(
            weightKg: 55, reps: 10, rir: 2, painReported: false
        ))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: flow,
            id: "sticky-split-zero-fact-middle",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "smith-bench-press"],
            "the zero-fact middle action must not manufacture a completed occurrence"
        )

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern
                == "horizontal-press"
        })

        XCTAssertEqual(
            horizontalPress.exerciseId,
            "smith-bench-press",
            "FR-TR6 sticky must follow the A→B→C terminal even when B logged no fact"
        )
    }

    func testMultipleZeroFactHopsCollapseToOneStableSealedTerminalLink() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()

        for terminalId in ["db-bench-press", "smith-bench-press", "push-up"] {
            XCTAssertTrue(
                flow.replacementCandidates.contains(terminalId),
                "fixture requires \(terminalId) to be a legal same-family replacement"
            )
            flow.replaceCurrentExercise(with: terminalId)
            XCTAssertFalse(
                flow.isWarmingUp,
                "split context must survive every zero-fact transit hop"
            )
        }
        flow.logSet(CompletedSetObservation(
            weightKg: 0, reps: 12, rir: 2, painReported: false
        ))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: flow,
            id: "sticky-split-multiple-zero-fact-hops",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "push-up"],
            "B and C never produced facts and must not manufacture exercise occurrences"
        )
        let sealed = try XCTUnwrap(session.exercises.first)
        let terminal = try XCTUnwrap(session.exercises.last)
        for exercise in [sealed, terminal] {
            XCTAssertEqual(exercise.storage["originalExerciseId"], .string("bench-press"))
            XCTAssertEqual(exercise.storage["actualExerciseId"], .string("push-up"))
        }
        XCTAssertEqual(sealed.storage["replacementRole"], .string("original"))
        XCTAssertEqual(terminal.storage["replacementRole"], .string("actual"))

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        let cleanExercises = try XCTUnwrap(input.sessions.first?.exercises)
        let expectedOriginal = CleanExerciseReplacementLink(
            originalExerciseId: "bench-press",
            actualExerciseId: "push-up",
            role: .original
        )
        let expectedActual = CleanExerciseReplacementLink(
            originalExerciseId: "bench-press",
            actualExerciseId: "push-up",
            role: .actual
        )
        XCTAssertEqual(cleanExercises[0].replacementLinks, [expectedOriginal])
        XCTAssertEqual(cleanExercises[1].replacementLinks, [expectedActual])

        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern
                == "horizontal-press"
        })
        XCTAssertEqual(horizontalPress.exerciseId, "push-up")
    }

    func testReplacementTerminalWithOnlySkippedSetStillCarriesActualChainEndpoint() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.skipSet(reason: .equipmentBusy)
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: flow,
            id: "sticky-split-skip-only-terminal",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press"],
            "a skipped set is a real occurrence fact and must retain the actual chain endpoint"
        )
        let terminal = try XCTUnwrap(
            session.exercises.first { $0.exerciseId == "db-bench-press" }
        )
        XCTAssertTrue(terminal.sets.isEmpty)
        XCTAssertEqual(terminal.storage["originalExerciseId"], .string("bench-press"))
        XCTAssertEqual(terminal.storage["actualExerciseId"], .string("db-bench-press"))
        XCTAssertEqual(terminal.storage["replacementRole"], .string("actual"))

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern
                == "horizontal-press"
        })
        XCTAssertEqual(horizontalPress.exerciseId, "db-bench-press")
    }

    func testRemovingPendingTerminalDissolvesChainWithoutDanglingLink() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")

        let movedExerciseId = flow.plan.exercises[2].exerciseId
        flow.moveExerciseToCurrent(movedExerciseId)
        let replacementIndex = try XCTUnwrap(
            flow.plan.exercises.firstIndex { $0.exerciseId == "db-bench-press" }
        )
        let removal = try XCTUnwrap(flow.removal(at: replacementIndex))
        let totalBeforeRemoval = flow.overallSetTotal
        flow.removeExercise(removal)

        XCTAssertEqual(
            flow.overallSetTotal,
            totalBeforeRemoval - removal.exercise.sets.count,
            "removing future work must not erase A's already completed fact from total progress"
        )
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: flow,
            id: "removed-pending-terminal",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(session.exercises.map(\.exerciseId), ["bench-press"])
        let root = try XCTUnwrap(session.exercises.first)
        XCTAssertNil(root.storage["originalExerciseId"])
        XCTAssertNil(root.storage["actualExerciseId"])
        XCTAssertNil(root.storage["replacementRole"])
        XCTAssertNil(root.storage["replacementLinks"])

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        XCTAssertEqual(input.sessions.first?.exercises.first?.replacementLinks, [])
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern
                == "horizontal-press"
        })
        XCTAssertEqual(horizontalPress.exerciseId, "bench-press")
    }

    func testExactUndoRestoresDetachedReplacementChainAndDraftReplay() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")

        let movedExerciseId = flow.plan.exercises[2].exerciseId
        flow.moveExerciseToCurrent(movedExerciseId)
        let replacementIndex = try XCTUnwrap(
            flow.plan.exercises.firstIndex { $0.exerciseId == "db-bench-press" }
        )
        let removal = try XCTUnwrap(flow.removal(at: replacementIndex))
        flow.removeExercise(removal)

        let detached = completedSession(
            from: flow,
            id: "detached-before-undo",
            dateISO: "2026-07-24"
        )
        XCTAssertNil(detached.exercises.first?.storage["replacementRole"])

        flow.removeExercise(removal.restoring)
        XCTAssertEqual(flow.plan.exercises[removal.index], removal.exercise)
        flow.moveExerciseToCurrent("db-bench-press")
        XCTAssertFalse(
            flow.isWarmingUp,
            "exact Undo must restore the fact-bearing split warm-up gate"
        )

        let draft = TrainSessionDraft(
            dateISO: "2026-07-24",
            startedAt: Date(timeIntervalSince1970: 1_780_000_000),
            prescription: flow.prescription,
            events: flow.events
        )
        let draftBytes = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(TrainSessionDraft.self, from: draftBytes)
        var restored = try XCTUnwrap(decoded.restoreFlow())
        XCTAssertEqual(restored, flow)

        restored.logSet(CompletedSetObservation(
            weightKg: 30, reps: 10, rir: 2, painReported: false
        ))
        restored.requestFinish()
        restored.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: restored,
            id: "exact-undo-restored-chain",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press"]
        )
        XCTAssertEqual(session.exercises[0].storage["replacementRole"], .string("original"))
        XCTAssertEqual(session.exercises[1].storage["replacementRole"], .string("actual"))
        for exercise in session.exercises {
            XCTAssertEqual(exercise.storage["originalExerciseId"], .string("bench-press"))
            XCTAssertEqual(exercise.storage["actualExerciseId"], .string("db-bench-press"))
        }
    }

    func testRemovingPendingTerminalKeepsSkipOnlyRootAsOrdinaryFactOccurrence() throws {
        var flow = try pushFlow()
        flow.skipSet(reason: .equipmentBusy)
        flow.replaceCurrentExercise(with: "db-bench-press")

        let movedExerciseId = flow.plan.exercises[2].exerciseId
        flow.moveExerciseToCurrent(movedExerciseId)
        let replacementIndex = try XCTUnwrap(
            flow.plan.exercises.firstIndex { $0.exerciseId == "db-bench-press" }
        )
        let removal = try XCTUnwrap(flow.removal(at: replacementIndex))
        flow.removeExercise(removal)
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: flow,
            id: "removed-pending-terminal-skip-root",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(session.exercises.map(\.exerciseId), ["bench-press"])
        XCTAssertTrue(try XCTUnwrap(session.exercises.first).sets.isEmpty)
        XCTAssertNil(session.exercises.first?.storage["replacementRole"])
        XCTAssertNil(session.exercises.first?.storage["replacementLinks"])
        XCTAssertEqual(
            session.storage["skippedSets"]?.asArray?.first?.asObject?["exerciseId"],
            .string("bench-press")
        )
    }

    func testRemovedReplacementTerminalCannotLeakItsChainIntoReaddedAdHocOccurrence() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")

        let movedExerciseId = flow.plan.exercises[2].exerciseId
        flow.moveExerciseToCurrent(movedExerciseId)
        let replacementIndex = try XCTUnwrap(
            flow.plan.exercises.firstIndex { $0.exerciseId == "db-bench-press" }
        )
        let removal = try XCTUnwrap(flow.removal(at: replacementIndex))
        flow.removeExercise(removal)
        flow.addExercise(adHocExercisePlan(targetWeightKg: 40))
        flow.moveExerciseToCurrent("db-bench-press")

        XCTAssertEqual(flow.currentExercise?.exerciseId, "db-bench-press")
        XCTAssertFalse(flow.warmupStepsForCurrentExercise.isEmpty)
        XCTAssertTrue(
            flow.isWarmingUp,
            "remove + ad-hoc add is not an exact restore and must not inherit the removed terminal's split gate"
        )

        let draft = TrainSessionDraft(
            dateISO: "2026-07-24",
            startedAt: Date(timeIntervalSince1970: 1_780_000_000),
            prescription: flow.prescription,
            events: flow.events
        )
        let draftBytes = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(TrainSessionDraft.self, from: draftBytes)
        var restored = try XCTUnwrap(decoded.restoreFlow())
        XCTAssertEqual(restored, flow)
        XCTAssertTrue(
            restored.isWarmingUp,
            "typed-event replay must not resurrect the removed replacement terminal context"
        )

        restored.logSet(CompletedSetObservation(
            weightKg: 40, reps: 10, rir: 2, painReported: false
        ))
        restored.requestFinish()
        restored.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: restored,
            id: "removed-terminal-readded-ad-hoc",
            dateISO: "2026-07-24"
        )
        let readded = try XCTUnwrap(
            session.exercises.first { $0.exerciseId == "db-bench-press" }
        )
        XCTAssertNil(readded.storage["replacementRole"])
        XCTAssertNil(readded.storage["replacementLinks"])

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        let cleanReadded = try XCTUnwrap(
            input.sessions.first?.exercises.first { $0.exerciseId == "db-bench-press" }
        )
        XCTAssertTrue(
            cleanReadded.replacementLinks.isEmpty,
            "DataHealth must not expose the re-added ad-hoc occurrence as a replacement endpoint"
        )
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern
                == "horizontal-press"
        })
        XCTAssertEqual(
            horizontalPress.exerciseId,
            "bench-press",
            "FR-TR14 ad-hoc work must not impersonate the removed FR-TR6 replacement chain"
        )
    }

    func testAdHocSamePatternExerciseDoesNotTakeOverReplacementStickySlot() throws {
        var flow = try pushFlow()
        flow.addExercise(adHocExercisePlan())
        XCTAssertEqual(
            Array(flow.plan.exercises.prefix(2).map(\.exerciseId)),
            ["bench-press", "db-bench-press"],
            "fixture must add another same-pattern action without creating a replacement"
        )

        for _ in 0..<3 {
            flow.logSet(CompletedSetObservation(
                weightKg: 60, reps: 8, rir: 2, painReported: false
            ))
            flow.restFinished()
        }
        XCTAssertEqual(flow.currentExercise?.exerciseId, "db-bench-press")
        flow.logSet(CompletedSetObservation(
            weightKg: 30, reps: 10, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: flow,
            id: "same-pattern-ad-hoc",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press"]
        )
        XCTAssertTrue(
            session.exercises.allSatisfy {
                $0.storage["replacementRole"] == nil
                    && $0.storage["replacementLinks"] == nil
            },
            "FR-TR14 ad-hoc work must remain a non-replacement occurrence"
        )

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern
                == "horizontal-press"
        })

        XCTAssertEqual(
            horizontalPress.exerciseId,
            "bench-press",
            "same-pattern ad-hoc work is not FR-TR6 replacement memory and must not steal the slot"
        )
    }

    func testReplacementChainReturningToOriginalSticksToTerminalOriginal() throws {
        var flow = try pushFlow()
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 8, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.logSet(CompletedSetObservation(
            weightKg: 30, reps: 10, rir: 2, painReported: false
        ))
        flow.restFinished()
        flow.replaceCurrentExercise(with: "bench-press")
        flow.logSet(CompletedSetObservation(
            weightKg: 60, reps: 9, rir: 2, painReported: false
        ))
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)

        let session = completedSession(
            from: flow,
            id: "sticky-swap-back",
            dateISO: "2026-07-24"
        )
        XCTAssertEqual(
            session.exercises.map(\.exerciseId),
            ["bench-press", "db-bench-press", "bench-press"]
        )
        XCTAssertNotNil(
            session.exercises[1].storage["replacementLinks"],
            "the middle occurrence must retain both links needed to reconstruct A→B→A"
        )

        let input = try decisionInput(
            history: [.object(session.storage)],
            todayISO: "2026-07-29"
        )
        let next = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: trainVerdict,
            dayCodeOverride: "full-a"
        ))
        let horizontalPress = try XCTUnwrap(next.exercises.first {
            ExerciseCatalog.minimal.entry(id: $0.exerciseId)?.movementPattern
                == "horizontal-press"
        })

        XCTAssertEqual(horizontalPress.exerciseId, "bench-press")
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
