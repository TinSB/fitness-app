import Foundation
import XCTest
@testable import Rede
import RedeTrainingDecision

@MainActor
final class SessionStoreDraftTests: XCTestCase {
    private let startedAt = Date(timeIntervalSince1970: 1_784_000_000)
    private let targetId = "pec-deck"

    func testAcceptedDurableMoveSavesExactlyOnceBeforeReportingSuccess() throws {
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = makeSessionStore(draftStore: draftStore)

        let accepted = sessionStore.applyDurably(.moveExerciseToCurrent(targetId))

        XCTAssertTrue(accepted)
        XCTAssertEqual(draftStore.saveKinds, [.durable])
        XCTAssertEqual(draftStore.attemptedDrafts.first?.events, [.moveExerciseToCurrent(targetId)])
        XCTAssertEqual(sessionStore.flow?.currentExercise?.exerciseId, targetId)
        XCTAssertEqual(
            sessionStore.flow?.plan.exercises.map(\.exerciseId),
            [targetId, "bench-press", "incline-db-press"]
        )
    }

    func testDurableMoveRollsFlowBackExactlyWhenDraftSaveFails() throws {
        let draftStore = FakeTrainSessionDraftStore(saveResult: false)
        let sessionStore = makeSessionStore(draftStore: draftStore)
        let before = try XCTUnwrap(sessionStore.flow)

        let accepted = sessionStore.applyDurably(.moveExerciseToCurrent(targetId))

        XCTAssertFalse(accepted)
        XCTAssertEqual(draftStore.saveKinds, [.durable])
        XCTAssertEqual(draftStore.attemptedDrafts.first?.events, [.moveExerciseToCurrent(targetId)])
        XCTAssertEqual(sessionStore.flow, before)
        XCTAssertFalse(sessionStore.flow?.events.contains(.moveExerciseToCurrent(targetId)) ?? true)
    }

    func testRejectedDurableMoveDoesNotSaveOrMutateFlow() throws {
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = makeSessionStore(draftStore: draftStore)
        let before = try XCTUnwrap(sessionStore.flow)

        let accepted = sessionStore.applyDurably(.moveExerciseToCurrent("not-in-todays-plan"))

        XCTAssertFalse(accepted)
        XCTAssertTrue(draftStore.saveKinds.isEmpty)
        XCTAssertEqual(sessionStore.flow, before)
    }

    func testDurableMoveQueuesOrdinaryThenSynchronouslySavesCompleteOrderedLog() throws {
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = makeSessionStore(draftStore: draftStore)

        sessionStore.apply(.toggleHold)
        let accepted = sessionStore.applyDurably(.moveExerciseToCurrent(targetId))

        XCTAssertTrue(accepted)
        XCTAssertEqual(draftStore.saveKinds, [.ordinary, .durable])
        XCTAssertEqual(draftStore.attemptedDrafts.map(\.events), [
            [.toggleHold],
            [.toggleHold, .moveExerciseToCurrent(targetId)],
        ])
        XCTAssertEqual(draftStore.attemptedDrafts.last?.events, sessionStore.flow?.events)
    }

    func testFileStoreDrainsOrdinaryWriteBeforeDurableAndClearCannotBeOverwritten() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-session-draft-tests-\(UUID().uuidString)", isDirectory: true)
        let fileURL = directory.appendingPathComponent("active-session-draft.json", isDirectory: false)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileTrainSessionDraftStore(url: fileURL)
        let ordinary = makeDraft(events: [.toggleHold])
        let final = makeDraft(events: [.toggleHold, .moveExerciseToCurrent(targetId)])

        store.enqueueSave(ordinary)
        XCTAssertTrue(store.saveDurably(final), "durable save must wait behind the queued ordinary write")
        XCTAssertEqual(store.load(), final)

        store.enqueueSave(ordinary)
        store.clear()
        XCTAssertNil(store.load(), "clear must drain a still-queued write before deleting the draft")
    }

    private func makeSessionStore(draftStore: FakeTrainSessionDraftStore) -> SessionStore {
        let sessionStore = SessionStore(draftStore: draftStore)
        sessionStore.flow = TrainFlowState(prescription: makePrescription())
        sessionStore.sessionStartedAt = startedAt
        return sessionStore
    }

    private func makePrescription() -> TodayPrescription {
        TodayPrescription(
            dayCode: "push-a",
            exercises: [
                makeExercise(id: "bench-press", weightKg: 60),
                makeExercise(id: "incline-db-press", weightKg: 22.5),
                makeExercise(id: targetId, weightKg: 30),
            ],
            dayReasons: []
        )
    }

    private func makeDraft(events: [TrainFlowEvent]) -> TrainSessionDraft {
        TrainSessionDraft(
            dateISO: "2026-07-19",
            startedAt: startedAt,
            prescription: makePrescription(),
            events: events,
            catalogVersion: ExerciseCatalog.minimal.catalogVersion
        )
    }

    private func makeExercise(id: String, weightKg: Double) -> ExercisePrescriptionPlan {
        ExercisePrescriptionPlan(
            exerciseId: id,
            sets: 3,
            restSeconds: 90,
            repLowerBound: 8,
            repUpperBound: 12,
            targetReps: 10,
            targetWeightKg: weightKg,
            targetRir: 2,
            previousWeightKg: nil,
            previousTopReps: nil,
            nextProjectedWeightKg: weightKg,
            progressionStepKg: 2.5,
            change: .start,
            reason: .firstExposure
        )
    }
}

private enum DraftSaveKind: Equatable {
    case ordinary
    case durable
}

private final class FakeTrainSessionDraftStore: TrainSessionDraftStoring {
    private let saveResult: Bool
    private(set) var clearCallCount = 0
    private(set) var saveKinds: [DraftSaveKind] = []
    private(set) var attemptedDrafts: [TrainSessionDraft] = []
    var loadedDraft: TrainSessionDraft?

    init(saveResult: Bool = true) {
        self.saveResult = saveResult
    }

    func load() -> TrainSessionDraft? {
        loadedDraft
    }

    func enqueueSave(_ draft: TrainSessionDraft) {
        saveKinds.append(.ordinary)
        attemptedDrafts.append(draft)
    }

    func saveDurably(_ draft: TrainSessionDraft) -> Bool {
        saveKinds.append(.durable)
        attemptedDrafts.append(draft)
        return saveResult
    }

    func clear() {
        clearCallCount += 1
    }
}
