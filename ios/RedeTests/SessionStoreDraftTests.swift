import Foundation
import XCTest
@testable import Rede
import RedeDataHealth
import RedeDomain
import RedeL10n
import RedeLocalSnapshot
import RedePersistence
import RedeTrainingDecision
import RedeWidgetShared

private struct SessionStoreTestDataHealthGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {
        try CanonicalWriteValidation.validate(candidate: candidate, replacing: current)
    }
}

@MainActor
final class SessionStoreDraftTests: XCTestCase {
    private struct PlanAdjustmentSurfaceGoldenInput: Decodable {
        let baselineCommit: String
        let today: String
        let appData: JSONValue
    }

    private let startedAt = Date(timeIntervalSince1970: 1_784_000_000)
    private let targetId = "pec-deck"

    private func planAdjustmentFixtureURL(_ name: String) -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
            .appendingPathComponent(name)
    }

    private func expectedPlanAdjustmentGoldenBytes(_ name: String) throws -> Data {
        var data = try Data(contentsOf: planAdjustmentFixtureURL(name))
        while let last = data.last, last == 0x0A || last == 0x0D {
            data.removeLast()
        }
        return data
    }

    func testTodayBreakthroughPresentationSeparatesShareableAndFactOnlyRows() {
        let lowFacts = LevelBreakthroughEventFacts(
            confidenceAtEventRaw: "low",
            decisionRawsAtEvent: ["maintain"],
            limitationCodesAtEvent: [],
            recoveryPenaltyAtEvent: 0
        )
        let mediumFacts = LevelBreakthroughEventFacts(
            confidenceAtEventRaw: "medium",
            decisionRawsAtEvent: ["maintain"],
            limitationCodesAtEvent: ["noBaselineWindow"],
            recoveryPenaltyAtEvent: 0
        )
        let lowBack = LevelBreakthrough(
            kind: .muscleLevel,
            targetId: "back",
            fromLevel: 8,
            toLevel: 9,
            fromTier: nil,
            toTier: nil,
            evidence: [],
            achievedAtIso: "2026-07-30",
            eventFacts: lowFacts
        )
        let mediumChest = LevelBreakthrough(
            kind: .muscleLevel,
            targetId: "chest",
            fromLevel: 7,
            toLevel: 8,
            fromTier: nil,
            toTier: nil,
            evidence: [],
            achievedAtIso: "2026-07-30",
            eventFacts: mediumFacts
        )

        let rows = TodayBreakthroughPresentation.rows(
            events: [lowBack, mediumChest],
            strings: RedeStrings(locale: .zh)
        )

        XCTAssertEqual(rows, [
            .shareable("胸部 Lv.7 → Lv.8"),
            .factOnly("背部 Lv.8 → Lv.9"),
        ])
    }

    func testTodayBreakthroughPresentationTreatsLegacyMissingFactsAsFactOnly() {
        let legacy = LevelBreakthrough(
            kind: .muscleLevel,
            targetId: "back",
            fromLevel: 8,
            toLevel: 9,
            fromTier: nil,
            toTier: nil,
            evidence: [],
            achievedAtIso: "2026-07-30"
        )

        XCTAssertEqual(
            TodayBreakthroughPresentation.rows(
                events: [legacy],
                strings: RedeStrings(locale: .zh)
            ),
            [.factOnly("背部 Lv.8 → Lv.9")]
        )
    }

    func testMissingMuscleLevelMemoryKeepsLegacyWidgetSnapshotBytesStable() throws {
        let rows = try widgetRows(memory: nil, strings: RedeStrings(locale: .en))
        let snapshot = ReadinessWidgetSnapshot(
            generatedAtIso: "2026-07-30T00:00:00Z",
            headline: "Ready",
            advice: "Proceed",
            rows: rows,
            locale: "en"
        )

        let bytes = try ReadinessWidgetSnapshotCodec.encode(snapshot)
        let legacyBytes = Data(
            #"{"advice":"Proceed","generatedAtIso":"2026-07-30T00:00:00Z","headline":"Ready","locale":"en","rows":[],"schemaVersion":1}"#.utf8
        )

        XCTAssertEqual(bytes, legacyBytes, "无派生 memory 时必须逐字节保持旧版 rows=[] 快照")
    }

    func testWidgetMuscleLevelRowsFailClosedForUnavailableTiersAndEmptyLevels() throws {
        for tierRaw in [String?("calibrating"), "unknown", nil] {
            let rows = try widgetRows(memory: makeMuscleLevelMemory(
                levels: ["back": 8],
                peaks: ["back": 10],
                tierRaw: tierRaw
            ))
            XCTAssertTrue(rows.isEmpty, "tier=\(tierRaw ?? "nil") 不得向 widget 暴露等级")
        }

        let emptyLevelRows = try widgetRows(memory: makeMuscleLevelMemory(
            levels: [:],
            peaks: ["back": 10],
            tierRaw: "intermediate"
        ))
        XCTAssertTrue(emptyLevelRows.isEmpty, "peaks 不能替代空 levels 生成 widget rows")
    }

    func testWidgetMuscleLevelRowsFilterSortCapAndLocalizeCurrentLevels() throws {
        let memory = makeMuscleLevelMemory(
            levels: [
                "chest": 8,
                "back": 8,
                "shoulders": 10,
                "not-a-muscle": 99,
                "core": 7,
            ],
            peaks: [
                "biceps": 99,
                "shoulders": 20,
            ],
            tierRaw: "intermediate"
        )

        XCTAssertEqual(
            try widgetRows(memory: memory, strings: RedeStrings(locale: .zh)),
            [
                ReadinessWidgetRow(label: "肩部", value: "Lv.10"),
                ReadinessWidgetRow(label: "背部", value: "Lv.8"),
            ],
            "只按 levels 排序；同级按 raw 升序；非法 raw 与 peaks-only 肌群必须过滤；最多两行"
        )
        XCTAssertEqual(
            try widgetRows(memory: memory, strings: RedeStrings(locale: .en)),
            [
                ReadinessWidgetRow(label: "Shoulders", value: "Lv.10"),
                ReadinessWidgetRow(label: "Back", value: "Lv.8"),
            ],
            "label 必须走现有 RedeL10n 本地化"
        )
    }

    func testWidgetMuscleLevelRowsUseLevelsNotPeaksAndMalformedMemoryFailsClosed() throws {
        let rows = try widgetRows(memory: makeMuscleLevelMemory(
            levels: ["back": 4],
            peaks: ["back": 10, "chest": 99],
            tierRaw: "intermediate"
        ))
        XCTAssertEqual(rows, [ReadinessWidgetRow(label: "Back", value: "Lv.4")])

        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-widget-memory-malformed-\(UUID().uuidString)", isDirectory: true)
        let fileURL = directory.appendingPathComponent("muscle-level-memory.json")
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data(#"{"schemaVersion":1,"levels":"not-an-object"}"#.utf8).write(to: fileURL)

        XCTAssertTrue(
            SessionStore.widgetMuscleLevelRows(
                memoryURL: fileURL,
                strings: RedeStrings(locale: .en)
            ).isEmpty,
            "读盘或解码失败必须退回 rows=[]"
        )
    }

    func testProfileSnapshotReadsMixedInjuryArrayThroughCleanProjection() throws {
        let appData = try JSONDecoder().decode(
            AppData.self,
            from: Data(
                #"{"schemaVersion":8,"userProfile":{"injuryFlags":["wrist",42,"knee","shoulder"]}}"#.utf8
            )
        )

        let snapshot = SessionStore.profileSnapshot(from: appData)

        XCTAssertEqual(snapshot.injuryFlags, ["knee", "shoulder", "wrist"])
    }

    func testInjuryFlagsWriteReloadAndCleanProjectionUseTheRealValidationGate() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-injury-gate-\(UUID().uuidString)", isDirectory: true)
        let fileURL = directory.appendingPathComponent("app-data.json")
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try Data(
            #"{"schemaVersion":8,"futureKey":{"kept":true},"userProfile":{"name":"样例"}}"#.utf8
        ).write(to: fileURL)
        let store = JSONFileAppDataStore(fileURL: fileURL)
        let writer = CanonicalSessionWriter(store: store, gate: SessionStoreTestDataHealthGate())

        try writer.applyInjuryFlags(["wrist", "knee"])
        let reloaded = try XCTUnwrap(try store.load())
        let clean = CleanAppDataViewBuilder.build(from: reloaded)

        XCTAssertEqual(clean.profile.injuryFlags, ["knee", "wrist"])
        XCTAssertEqual(reloaded.userProfile.name, "样例")
        XCTAssertEqual(reloaded.storage["futureKey"]?.asObject?["kept"]?.asBool, true)
    }

    func testMalformedRawDaySequenceFailsClosedThroughBridgeAndEngine() throws {
        let appData = try JSONDecoder().decode(
            AppData.self,
            from: Data(
                #"""
                {
                  "schemaVersion": 11,
                  "programTemplate": {"splitType": "ppl-ul"},
                  "planCustomization": {"daySequence": ["push-a", 7]}
                }
                """#.utf8
            )
        )

        let input = PlanCustomizationBridge.input(from: appData.planCustomization)

        XCTAssertNil(input.daySequence, "任一非字符串成员必须使整个自定义日序失效，禁止部分清洗")
        XCTAssertEqual(
            TodayPrescriptionEngine.nextDayCode(
                splitType: appData.programTemplate.splitType,
                daySequenceOverride: input.daySequence,
                completedSessionCount: 0
            ),
            "push-a",
            "raw 脏日序经 bridge 后必须整体回退 ppl-ul 默认日序"
        )
    }

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

    func testAllSessionEditEventsPassThroughDurableBarrierInOrder() throws {
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = makeSessionStore(draftStore: draftStore)
        let addition = makeAdHocExercisePlan()

        XCTAssertTrue(sessionStore.applyDurably(.addExercise(addition)))
        let removal = try XCTUnwrap(sessionStore.flow?.removal(at: 3))
        XCTAssertTrue(sessionStore.applyDurably(.removeExercise(removal)))
        XCTAssertTrue(sessionStore.applyDurably(.adjustRemainingSets(1)))

        XCTAssertEqual(draftStore.saveKinds, [.durable, .durable, .durable])
        XCTAssertEqual(draftStore.attemptedDrafts.map(\.events), [
            [.addExercise(addition)],
            [.addExercise(addition), .removeExercise(removal)],
            [.addExercise(addition), .removeExercise(removal), .adjustRemainingSets(1)],
        ])
        XCTAssertEqual(draftStore.attemptedDrafts.last?.events, sessionStore.flow?.events)
        XCTAssertEqual(sessionStore.flow?.plan.exercises[1], addition)
        XCTAssertEqual(sessionStore.flow?.currentExercise?.sets.count, 4)
    }

    func testDurableRemoveThenUndoPersistsBothStatesAndRestoresRemovalAudit() throws {
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = makeSessionStore(draftStore: draftStore)
        let original = try XCTUnwrap(sessionStore.flow)
        let removal = try XCTUnwrap(sessionStore.flow?.removal(at: 2))

        XCTAssertTrue(sessionStore.applyDurably(.removeExercise(removal)))
        XCTAssertTrue(sessionStore.applyDurably(.removeExercise(removal.restoring)))

        XCTAssertEqual(draftStore.saveKinds, [.durable, .durable])
        XCTAssertEqual(draftStore.attemptedDrafts.map(\.events), [
            [.removeExercise(removal)],
            [.removeExercise(removal), .removeExercise(removal.restoring)],
        ])
        XCTAssertEqual(sessionStore.flow?.plan, original.plan)
        XCTAssertTrue(sessionStore.flow?.removedExercises.isEmpty ?? false)
    }

    func testDurableUndoFailureRollsBackToRemovedStateWithoutFakeSuccess() throws {
        let draftStore = FakeTrainSessionDraftStore(saveResults: [true, false])
        let sessionStore = makeSessionStore(draftStore: draftStore)
        let removal = try XCTUnwrap(sessionStore.flow?.removal(at: 2))

        XCTAssertTrue(sessionStore.applyDurably(.removeExercise(removal)))
        let removedState = try XCTUnwrap(sessionStore.flow)
        XCTAssertFalse(sessionStore.applyDurably(.removeExercise(removal.restoring)))

        XCTAssertEqual(sessionStore.flow, removedState)
        XCTAssertEqual(sessionStore.flow?.removedExercises, [removal])
        XCTAssertEqual(draftStore.saveKinds, [.durable, .durable])
        XCTAssertEqual(
            draftStore.attemptedDrafts.last?.events,
            [.removeExercise(removal), .removeExercise(removal.restoring)],
            "failed durable save must still expose the exact attempted replay log"
        )
    }

    func testSessionEditFreezesNarrowerEquipmentAndPoundGridWhenLiveSettingsBroaden() throws {
        let frozenEquipment = try XCTUnwrap(EquipmentAccess.allowed(for: "home-dumbbell"))
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = SessionStore(draftStore: draftStore)
        sessionStore.flow = TrainFlowState(
            prescription: makePrescription(),
            allowedEquipment: frozenEquipment,
            loadUnit: .lb
        )
        sessionStore.sessionStartedAt = startedAt
        sessionStore.todayOutcome = .ready(try makeTodayModel(
            equipmentScenario: nil,
            unitSystem: "kg"
        ))

        let candidates = sessionStore.sessionEditCandidates
        XCTAssertFalse(candidates.isEmpty)
        XCTAssertTrue(
            candidates.allSatisfy { frozenEquipment.contains($0.equipment) },
            "broader live Settings must not leak new equipment into an active session"
        )
        let dumbbell = try XCTUnwrap(candidates.first(where: { $0.equipment == "dumbbell" }))
        let plan = try XCTUnwrap(sessionStore.makeSessionEditExercisePlan(exerciseId: dumbbell.id))
        XCTAssertEqual(
            plan.stepKg,
            LoadGrid.stepKg(equipment: dumbbell.equipment, unit: .lb),
            accuracy: 0.000_001,
            "payload planning must keep the pound grid captured at session start"
        )
    }

    func testSessionEditKeepsBroaderEquipmentAndKgGridWhenLiveSettingsNarrow() throws {
        let liveEquipment = try XCTUnwrap(EquipmentAccess.allowed(for: "home-dumbbell"))
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = SessionStore(draftStore: draftStore)
        sessionStore.flow = TrainFlowState(
            prescription: makePrescription(),
            allowedEquipment: nil,
            loadUnit: .kg
        )
        sessionStore.sessionStartedAt = startedAt
        sessionStore.todayOutcome = .ready(try makeTodayModel(
            equipmentScenario: "home-dumbbell",
            unitSystem: "lb"
        ))

        let candidates = sessionStore.sessionEditCandidates
        let commercialOnly = try XCTUnwrap(candidates.first(where: {
            !liveEquipment.contains($0.equipment)
        }))
        let plan = try XCTUnwrap(sessionStore.makeSessionEditExercisePlan(
            exerciseId: commercialOnly.id
        ))
        XCTAssertEqual(
            plan.stepKg,
            LoadGrid.stepKg(equipment: commercialOnly.equipment, unit: .kg),
            accuracy: 0.000_001,
            "narrower live Settings must not remove equipment or change the kg grid mid-session"
        )
    }

    func testDraftRoundTripRestoresSessionScopedEquipmentAndUnitInsteadOfLiveSettings() throws {
        let frozenEquipment = try XCTUnwrap(EquipmentAccess.allowed(for: "home-dumbbell"))
        let savingStore = FakeTrainSessionDraftStore()
        let sessionStore = SessionStore(draftStore: savingStore)
        sessionStore.flow = TrainFlowState(
            prescription: makePrescription(),
            allowedEquipment: frozenEquipment,
            loadUnit: .lb
        )
        sessionStore.sessionStartedAt = startedAt
        sessionStore.todayOutcome = .ready(try makeTodayModel(
            equipmentScenario: nil,
            unitSystem: "kg"
        ))
        XCTAssertTrue(sessionStore.applyDurably(.adjustRemainingSets(1)))

        let saved = try XCTUnwrap(savingStore.attemptedDrafts.last)
        let bytes = try JSONEncoder().encode(saved)
        let decoded = try JSONDecoder().decode(TrainSessionDraft.self, from: bytes)
        let restoringStore = SessionStore(draftStore: FakeTrainSessionDraftStore())
        restoringStore.todayOutcome = .ready(try makeTodayModel(
            equipmentScenario: nil,
            unitSystem: "kg"
        ))
        restoringStore.pendingDraft = decoded
        restoringStore.restorePendingDraft()

        let candidates = restoringStore.sessionEditCandidates
        XCTAssertTrue(candidates.allSatisfy { frozenEquipment.contains($0.equipment) })
        let dumbbell = try XCTUnwrap(candidates.first(where: { $0.equipment == "dumbbell" }))
        let plan = try XCTUnwrap(restoringStore.makeSessionEditExercisePlan(exerciseId: dumbbell.id))
        XCTAssertEqual(
            plan.stepKg,
            LoadGrid.stepKg(equipment: dumbbell.equipment, unit: .lb),
            accuracy: 0.000_001,
            "draft replay must restore the original session grid, not current Settings"
        )
    }

    func testSetCountChangesPreserveStagedQuickAdjustmentForBothDirections() {
        let staged = TrainQuickAdjustmentState(
            isStaged: true,
            weightKg: 37.5,
            reps: 11,
            rir: 1
        )

        XCTAssertEqual(staged.preservingAfterSetCountChange(-1), staged)
        XCTAssertEqual(staged.preservingAfterSetCountChange(1), staged)
    }

    func testSessionEditActionsStackOnlyForAccessibilityDynamicType() {
        XCTAssertEqual(
            TrainSessionEditActionLayout.resolve(isAccessibilitySize: false),
            .horizontal
        )
        XCTAssertEqual(
            TrainSessionEditActionLayout.resolve(isAccessibilitySize: true),
            .vertical
        )
    }

    func testUnifiedSessionEditEntryStaysOpenAfterCurrentFactsAndOnLastExercise() throws {
        var flowWithFacts = TrainFlowState(prescription: makePrescription())
        flowWithFacts.logSet(CompletedSetObservation(
            weightKg: 40,
            reps: 8,
            rir: 2,
            painReported: false
        ))
        flowWithFacts.restFinished()

        XCTAssertEqual(flowWithFacts.phase, .activeSet)
        XCTAssertTrue(flowWithFacts.moveToCurrentCandidates.isEmpty)
        XCTAssertTrue(
            TrainSessionEditEntryPolicy.canOpen(flowWithFacts),
            "S1 move rows degrade after facts, but the unified S2 editor entry remains open"
        )

        let original = makePrescription()
        let lastOnly = TodayPrescription(
            dayCode: original.dayCode,
            exercises: [try XCTUnwrap(original.exercises.last)],
            dayReasons: original.dayReasons
        )
        let lastExerciseFlow = TrainFlowState(prescription: lastOnly)
        XCTAssertTrue(TrainSessionEditEntryPolicy.canOpen(lastExerciseFlow))
    }

    func testStaleRemoveCallbackCannotRetargetExerciseShiftedIntoTheSamePosition() throws {
        var flow = TrainFlowState(prescription: makePrescription())
        let originalTarget = try XCTUnwrap(flow.plan.exercises.dropFirst().first)
        let removal = try XCTUnwrap(TrainSessionEditRemovalPolicy.removal(
            in: flow,
            at: 1,
            expectedExercise: originalTarget,
            expectedOccurrenceCount: 1
        ))

        flow.removeExercise(removal)

        XCTAssertNil(
            TrainSessionEditRemovalPolicy.removal(
                in: flow,
                at: 1,
                expectedExercise: originalTarget,
                expectedOccurrenceCount: 1
            ),
            "a queued second tap must not remove the next exercise that shifted into the old position"
        )
        XCTAssertNotEqual(flow.plan.exercises[1], originalTarget)
    }

    func testStaleRemoveCallbackCannotDeleteSecondIdenticalDuplicateOccurrence() throws {
        // 自由日序允许同 id 重复 occurrence 且逐字段相同：位置+快照双匹配拦不住
        // 「第一击移除后第二份上移到同位置、跨主队列轮次的第二击」——
        // 渲染时捕获的份数是第三道防线。
        let base = makePrescription()
        let duplicated = TodayPrescription(
            dayCode: base.dayCode,
            exercises: base.exercises + [base.exercises[1]],
            dayReasons: base.dayReasons
        )
        var flow = TrainFlowState(prescription: duplicated)
        let target = flow.plan.exercises[1]
        XCTAssertEqual(flow.plan.exercises[3], target, "fixture needs identical duplicate")

        let removal = try XCTUnwrap(TrainSessionEditRemovalPolicy.removal(
            in: flow,
            at: 3,
            expectedExercise: target,
            expectedOccurrenceCount: 2
        ))
        flow.removeExercise(removal)

        XCTAssertNil(
            TrainSessionEditRemovalPolicy.removal(
                in: flow,
                at: 1,
                expectedExercise: target,
                expectedOccurrenceCount: 2
            ),
            "after the first removal the occurrence count changed; a stale double-tap must fail closed"
        )
        XCTAssertNotNil(
            TrainSessionEditRemovalPolicy.removal(
                in: flow,
                at: 1,
                expectedExercise: target,
                expectedOccurrenceCount: 1
            ),
            "a freshly rendered row carrying the current count may still legitimately remove the survivor"
        )
    }

    func testEverySessionEditRollsBackExactlyWhenDurableSaveFails() throws {
        let eventBuilders: [(SessionStore) throws -> TrainFlowEvent] = [
            { _ in .addExercise(self.makeAdHocExercisePlan()) },
            { store in .removeExercise(try XCTUnwrap(store.flow?.removal(at: 2))) },
            { _ in .adjustRemainingSets(1) },
        ]

        for makeEvent in eventBuilders {
            let draftStore = FakeTrainSessionDraftStore(saveResult: false)
            let sessionStore = makeSessionStore(draftStore: draftStore)
            let before = try XCTUnwrap(sessionStore.flow)
            let event = try makeEvent(sessionStore)

            XCTAssertFalse(sessionStore.applyDurably(event))
            XCTAssertEqual(sessionStore.flow, before)
            XCTAssertEqual(draftStore.saveKinds, [.durable])
            XCTAssertEqual(draftStore.attemptedDrafts.first?.events, [event])
        }
    }

    func testRejectedSessionEditDoesNotSaveOrMutateFlow() throws {
        let draftStore = FakeTrainSessionDraftStore()
        let sessionStore = makeSessionStore(draftStore: draftStore)
        let before = try XCTUnwrap(sessionStore.flow)

        XCTAssertFalse(sessionStore.applyDurably(.addExercise(makeAdHocExercisePlan(id: "bench-press"))))
        XCTAssertFalse(sessionStore.applyDurably(.adjustRemainingSets(2)))

        XCTAssertEqual(sessionStore.flow, before)
        XCTAssertTrue(draftStore.saveKinds.isEmpty)
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

    func testCompletedSessionPlanCandidateUsesPersistedTemplateIdAndSessionEditsForCopyOnly() throws {
        let current = CustomDayPlan(exercises: [
            CustomExerciseItem(exerciseId: "lat-pulldown"),
            CustomExerciseItem(exerciseId: "seated-row"),
        ])
        let appData = try makeCompletedPlanAppData(
            dayCode: "pull-a",
            finalOrder: ["seated-row", "lat-pulldown"],
            currentDayPlan: current,
            added: ["seated-row"],
            removed: ["face-pull"],
            oneTimeDayOverride: "push-a"
        )

        let candidate = try XCTUnwrap(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))

        XCTAssertEqual(candidate.dayCode, "pull-a",
                       "FR-TR12 完成时临时覆盖已消费；存回必须读该场 templateId")
        XCTAssertEqual(candidate.targetExerciseIds, ["seated-row", "lat-pulldown"])
        XCTAssertEqual(candidate.addedExerciseIds, ["seated-row"])
        XCTAssertEqual(candidate.removedExerciseIds, ["face-pull"])
    }

    func testCompletedSessionPlanCandidateOffersPureReorderWithoutSessionEdits() throws {
        let appData = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: ["incline-db-press", "bench-press"],
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "bench-press"),
                CustomExerciseItem(exerciseId: "incline-db-press"),
            ])
        )

        let candidate = try XCTUnwrap(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))

        XCTAssertEqual(candidate.targetExerciseIds, ["incline-db-press", "bench-press"])
        XCTAssertTrue(candidate.addedExerciseIds.isEmpty)
        XCTAssertTrue(candidate.removedExerciseIds.isEmpty)
    }

    func testCompletedSessionPlanCandidateDeduplicatesFirstOccurrenceAndSuppressesNoOp() throws {
        let appData = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: ["bench-press", "incline-db-press", "bench-press"],
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "bench-press"),
                CustomExerciseItem(exerciseId: "incline-db-press"),
            ]),
            added: ["bench-press"],
            removed: ["cable-fly"]
        )

        XCTAssertNil(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ), "入口资格只看去重后的最终构成；即使 sessionEdits 非空，no-op 也不显示")
    }

    func testCompletedSessionPlanCandidateOffersDefaultEquivalentTarget() throws {
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: "push-a",
            equipmentScenario: "commercial-gym"
        )
        XCTAssertFalse(defaults.isEmpty)
        let appData = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: defaults,
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "db-bench-press"),
                CustomExerciseItem(exerciseId: "db-curl"),
            ])
        )

        let candidate = try XCTUnwrap(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))

        XCTAssertEqual(candidate.targetExerciseIds, defaults)
    }

    func testCompletedSessionPlanCandidateAndLatestWriteSuppressPermanentSubstitutionEquivalentTarget() async throws {
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: "pull-a",
            equipmentScenario: "commercial-gym"
        )
        XCTAssertTrue(defaults.contains("lat-pulldown"))
        let substituted = defaults.map { $0 == "lat-pulldown" ? "pull-up" : $0 }
        let appData = try makeCompletedPlanAppData(
            dayCode: "pull-a",
            finalOrder: substituted,
            currentDayPlan: nil,
            exerciseSubstitutions: ["lat-pulldown": "pull-up"]
        )
        let now = try date("2026-07-31", timeZone: XCTUnwrap(TimeZone(identifier: "UTC")))

        XCTAssertNil(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: now
        ), "永久 A→B 已使下场真实构成等于本场 B 时，零编辑不应显示存回入口")

        let (directory, fileURL) = try makeTemporaryCanonical(appData)
        defer { try? FileManager.default.removeItem(at: directory) }
        let bytesBeforeClick = try Data(contentsOf: fileURL)
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: "save-to-plan-session",
            now: now
        )

        XCTAssertEqual(outcome, .noOp)
        XCTAssertEqual(sessionStore.completedSessionPlanRevision, 0)
        XCTAssertEqual(try Data(contentsOf: fileURL), bytesBeforeClick,
                       "同事务最新 canonical 的永久替换等价时必须 0 write")
    }

    func testCompletedSessionPlanCandidateAndLatestWriteSuppressStickyEquivalentTarget() async throws {
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: "pull-a",
            equipmentScenario: "commercial-gym"
        )
        XCTAssertTrue(defaults.contains("lat-pulldown"))
        let stickyOrder = defaults.map { $0 == "lat-pulldown" ? "pull-up" : $0 }
        let appData = try makeCompletedPlanAppData(
            dayCode: "pull-a",
            finalOrder: stickyOrder,
            currentDayPlan: nil,
            completedExerciseIds: ["pull-up"]
        )
        let now = try date("2026-07-31", timeZone: XCTUnwrap(TimeZone(identifier: "UTC")))

        XCTAssertNil(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: now
        ), "last-actual sticky 已使下场真实构成等于本场时，零编辑不应显示存回入口")

        let (directory, fileURL) = try makeTemporaryCanonical(appData)
        defer { try? FileManager.default.removeItem(at: directory) }
        let bytesBeforeClick = try Data(contentsOf: fileURL)
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: "save-to-plan-session",
            now: now
        )

        XCTAssertEqual(outcome, .noOp)
        XCTAssertEqual(sessionStore.completedSessionPlanRevision, 0)
        XCTAssertEqual(try Data(contentsOf: fileURL), bytesBeforeClick,
                       "同事务最新 canonical 的 sticky 等价时必须 0 write")
    }

    func testCompletedSessionPlanDefaultTargetWithoutOverlayRemainsNoOp() throws {
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: "pull-a",
            equipmentScenario: "commercial-gym"
        )
        let appData = try makeCompletedPlanAppData(
            dayCode: "pull-a",
            finalOrder: defaults,
            currentDayPlan: nil
        )

        XCTAssertNil(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: try date("2026-07-31", timeZone: XCTUnwrap(TimeZone(identifier: "UTC")))
        ), "无 overlay 且默认目标已经生效时继续保持 no-op")
    }

    func testSaveCompletedSessionPlanPinsDefaultAgainstPermanentSubstitutionAcrossBuilderCleanPlan() async throws {
        let dayCode = "pull-a"
        let originalId = "lat-pulldown"
        let substitutedId = "pull-up"
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: dayCode,
            equipmentScenario: "commercial-gym"
        )
        XCTAssertEqual(defaults.first, originalId)

        let seed = try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "userProfile": .object([
                "weeklyTrainingDays": .int(3),
                "equipmentScenario": .string("commercial-gym"),
            ]),
            "programTemplate": .object([
                "splitType": .string("push-pull-legs"),
                "daysPerWeek": .int(3),
            ]),
            "exerciseSubstitutions": .object([
                originalId: .string(substitutedId),
            ]),
            "history": .array([]),
        ]))
        let seedInput = try CleanTrainingDecisionInput.make(
            from: CleanAppDataViewBuilder.build(from: seed),
            todayISO: "2026-07-30"
        )
        let forcedDay = PlanCustomizationInput(daySequence: [dayCode])
        let trainVerdict = TodayVerdict(
            call: .train,
            reason: .normalProgression,
            signals: []
        )
        let substitutedPlan = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: seedInput,
            verdict: trainVerdict,
            substitutions: seed.exerciseSubstitutions,
            customization: forcedDay,
            dayCodeOverride: dayCode
        ))
        XCTAssertEqual(
            substitutedPlan.exercises.map(\.exerciseId),
            defaults.map { $0 == originalId ? substitutedId : $0 }
        )

        var flow = TrainFlowState(
            prescription: substitutedPlan,
            allowedEquipment: EquipmentAccess.allowed(for: "commercial-gym")
        )
        XCTAssertEqual(flow.currentExercise?.exerciseId, substitutedId)
        flow.replaceCurrentExercise(with: originalId)
        XCTAssertEqual(
            flow.plan.exercises.map(\.exerciseId),
            defaults,
            "本场 B→默认 A 后，builder 的最终队列应回到默认构成"
        )
        let completed = CompletedSessionBuilder.build(
            from: flow,
            sessionId: "save-to-plan-session",
            dateISO: "2026-07-30",
            startedAtISO: "2026-07-30T12:00:00Z",
            finishedAtISO: "2026-07-30T13:00:00Z",
            durationMinutes: 60
        )
        var root = seed.storage
        root["history"] = .array([.object(completed.storage)])
        let appData = try AppData(decoding: .object(root))
        let now = try date("2026-07-31", timeZone: XCTUnwrap(TimeZone(identifier: "UTC")))
        XCTAssertNotNil(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: now
        ), "永久替换仍把默认 A 拉成 B 时，B→A 的本场目标必须可存回")

        let (directory, fileURL) = try makeTemporaryCanonical(appData)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )
        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: "save-to-plan-session",
            now: now
        )
        guard case .saved = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }

        let reloaded = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(
            reloaded.planCustomization?.dayPlans[dayCode]?.exercises.map(\.exerciseId),
            defaults,
            "overlay 会拉走默认时，默认 IDs 是非冗余 userPinned 覆盖，不能 clear/no-op"
        )
        XCTAssertEqual(
            reloaded.exerciseSubstitutions,
            [originalId: substitutedId],
            "存回不得清除或改写永久 exerciseSubstitutions"
        )

        let nextInput = try CleanTrainingDecisionInput.make(
            from: CleanAppDataViewBuilder.build(from: reloaded),
            todayISO: "2026-07-31"
        )
        let bridged = PlanCustomizationBridge.input(from: reloaded.planCustomization)
        let nextPlan = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: nextInput,
            verdict: trainVerdict,
            substitutions: reloaded.exerciseSubstitutions,
            customization: PlanCustomizationInput(
                dayPlans: bridged.dayPlans,
                daySequence: [dayCode]
            ),
            dayCodeOverride: dayCode
        ))
        XCTAssertEqual(
            nextPlan.exercises.map(\.exerciseId),
            defaults,
            "builder→clean→plan：userPinned 默认 A 必须压过仍保留的永久 A→B"
        )
    }

    func testSaveCompletedSessionPlanWritesOnlyIdsAndUndoRestoresRawNodeByteForByte() async throws {
        let rawPrevious: JSONValue = .object([
            "exercises": .array([
                .object([
                    "exerciseId": .string("bench-press"),
                    "sets": .int(4),
                    "futureItemKey": .object(["keep": .bool(true)]),
                ]),
                .object([
                    "futureDirtyItem": .string("typed getter skips this"),
                ]),
                .object([
                    "exerciseId": .string("cable-fly"),
                    "crossFamily": .bool(true),
                ]),
            ]),
            "futureDayPlanSibling": .array([.string("keep"), .int(7)]),
        ])
        let appData = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: ["db-bench-press", "db-curl"],
            currentDayPlan: nil,
            rawDayPlan: rawPrevious,
            added: ["db-curl"],
            removed: ["cable-fly"]
        )
        let candidate = try XCTUnwrap(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))
        let (directory, fileURL) = try makeTemporaryCanonical(appData)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: candidate.sessionId,
            now: startedAt
        )

        guard case .saved(let undo) = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }
        XCTAssertEqual(sessionStore.completedSessionPlanRevision, 1)
        let afterSave = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        let savedItems = try XCTUnwrap(afterSave.planCustomization?.dayPlans["push-a"]?.exercises)
        XCTAssertEqual(savedItems.map(\.exerciseId), ["db-bench-press", "db-curl"])
        XCTAssertTrue(savedItems.allSatisfy {
            $0.sets == nil && $0.repMin == nil && $0.repMax == nil
                && $0.rest == nil && !$0.crossFamily
        }, "FR-TR14 只写 exerciseId，不把本场组数/次数/休息写死进计划")
        let rawSaved = try XCTUnwrap(rawDayPlan(in: afterSave, dayCode: "push-a")?.asObject)
        XCTAssertEqual(rawSaved, [
            "exercises": .array([
                .object(["exerciseId": .string("db-bench-press")]),
                .object(["exerciseId": .string("db-curl")]),
            ]),
        ], "存回本身仍是整日覆盖，只写 exerciseId")
        XCTAssertEqual(undo.dayCode, "push-a")
        XCTAssertEqual(
            try deterministicJSONBytes(undo.rawDayPlan),
            try deterministicJSONBytes(rawPrevious),
            "撤销基线必须是写入瞬间的 raw JSONValue 节点"
        )

        let restored = await sessionStore.restoreCompletedSessionPlan(undo)

        XCTAssertTrue(restored)
        XCTAssertEqual(sessionStore.completedSessionPlanRevision, 2)
        let afterUndo = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(
            try deterministicJSONBytes(rawDayPlan(in: afterUndo, dayCode: "push-a")),
            try deterministicJSONBytes(rawPrevious),
            "未知 dayPlan sibling、未知 item key、typed getter 跳过的脏 item 必须逐字节恢复"
        )
        XCTAssertEqual(afterUndo.schemaVersion, SchemaVersion.current)
    }

    func testUndoSavedPlanWithNilSnapshotRemovesCustomDayPlan() async throws {
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: "push-a",
            equipmentScenario: "commercial-gym"
        )
        let target = Array(defaults.reversed())
        XCTAssertNotEqual(target, defaults)
        let appData = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: target,
            currentDayPlan: nil
        )
        let candidate = try XCTUnwrap(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))
        let (directory, fileURL) = try makeTemporaryCanonical(appData)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: candidate.sessionId,
            now: startedAt
        )
        guard case .saved(let undo) = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }
        XCTAssertNil(undo.rawDayPlan)
        XCTAssertNotNil(try JSONFileAppDataStore(fileURL: fileURL).load()?
            .planCustomization?.dayPlans["push-a"])

        let restored = await sessionStore.restoreCompletedSessionPlan(undo)
        XCTAssertTrue(restored)
        XCTAssertNil(try JSONFileAppDataStore(fileURL: fileURL).load()?.planCustomization)
    }

    func testSaveCompletedSessionPlanClearsDefaultEquivalentCustomPlan() async throws {
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: "push-a",
            equipmentScenario: "commercial-gym"
        )
        let appData = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: defaults,
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "db-bench-press"),
                CustomExerciseItem(exerciseId: "db-curl"),
            ])
        )
        let candidate = try XCTUnwrap(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))
        let (directory, fileURL) = try makeTemporaryCanonical(appData)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: candidate.sessionId,
            now: startedAt
        )
        guard case .saved = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }

        let reloaded = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertNil(reloaded.planCustomization?.dayPlans["push-a"])
    }

    func testSaveCompletedSessionPlanRecomputesLatestAndNoOpsWhenExternalRemovalMakesDefaultEquivalent() async throws {
        let defaults = TodayPrescriptionEngine.defaultDayExerciseIds(
            dayCode: "push-a",
            equipmentScenario: "commercial-gym"
        )
        let initial = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: defaults,
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "db-bench-press"),
                CustomExerciseItem(exerciseId: "db-curl"),
            ])
        )
        XCTAssertNotNil(SessionStore.completedSessionPlanCandidate(
            from: initial,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))
        let (directory, fileURL) = try makeTemporaryCanonical(initial)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )
        let externallyEdited = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: defaults,
            currentDayPlan: nil
        )
        try JSONEncoder().encode(externallyEdited).write(to: fileURL)
        let bytesBeforeClick = try Data(contentsOf: fileURL)

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: "save-to-plan-session",
            now: startedAt
        )

        XCTAssertEqual(outcome, .noOp)
        XCTAssertNil(sessionStore.planSaveErrorText)
        XCTAssertEqual(sessionStore.completedSessionPlanRevision, 0)
        XCTAssertEqual(try Data(contentsOf: fileURL), bytesBeforeClick,
                       "最新有效构成已等价时，不写、不备份、不报成功")
    }

    func testSaveCompletedSessionPlanUsesLatestExternalEditAsUndoBaselineWhenStillDifferent() async throws {
        let target = ["db-bench-press", "db-curl"]
        let initial = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: target,
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "bench-press"),
                CustomExerciseItem(exerciseId: "incline-db-press"),
            ])
        )
        XCTAssertNotNil(SessionStore.completedSessionPlanCandidate(
            from: initial,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))
        let (directory, fileURL) = try makeTemporaryCanonical(initial)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )
        let latestRaw: JSONValue = .object([
            "exercises": .array([
                .object([
                    "exerciseId": .string("lat-pulldown"),
                    "futureItemKey": .string("latest"),
                ]),
                .object(["dirty": .bool(true)]),
                .object(["exerciseId": .string("seated-row")]),
            ]),
            "futureDayPlanSibling": .string("latest"),
        ])
        let externallyEdited = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: target,
            currentDayPlan: nil,
            rawDayPlan: latestRaw
        )
        try JSONEncoder().encode(externallyEdited).write(to: fileURL)

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: "save-to-plan-session",
            now: startedAt
        )

        guard case .saved(let undo) = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }
        XCTAssertEqual(
            try deterministicJSONBytes(undo.rawDayPlan),
            try deterministicJSONBytes(latestRaw),
            "撤销基线必须来自 compare-and-apply 同一事务内的最新 raw 前值"
        )
        let afterSave = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(
            afterSave.planCustomization?.dayPlans["push-a"]?.exercises.map(\.exerciseId),
            target
        )

        let restored = await sessionStore.restoreCompletedSessionPlan(undo)
        XCTAssertTrue(restored)
        let afterUndo = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(
            try deterministicJSONBytes(rawDayPlan(in: afterUndo, dayCode: "push-a")),
            try deterministicJSONBytes(latestRaw)
        )
    }

    func testSaveCompletedSessionPlanNoOpsWhenExternalEditAlreadyWroteTargetCustomValue() async throws {
        let target = ["db-bench-press", "db-curl"]
        let initial = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: target,
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "bench-press"),
                CustomExerciseItem(exerciseId: "incline-db-press"),
            ])
        )
        XCTAssertNotNil(SessionStore.completedSessionPlanCandidate(
            from: initial,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))
        let (directory, fileURL) = try makeTemporaryCanonical(initial)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )
        let externallyEdited = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: target,
            currentDayPlan: CustomDayPlan(exercises: target.map {
                CustomExerciseItem(exerciseId: $0)
            })
        )
        try JSONEncoder().encode(externallyEdited).write(to: fileURL)
        let bytesBeforeClick = try Data(contentsOf: fileURL)

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: "save-to-plan-session",
            now: startedAt
        )

        XCTAssertEqual(outcome, .noOp)
        XCTAssertNil(sessionStore.planSaveErrorText)
        XCTAssertEqual(sessionStore.completedSessionPlanRevision, 0)
        XCTAssertEqual(try Data(contentsOf: fileURL), bytesBeforeClick)
    }

    func testSaveCompletedSessionPlanFailureKeepsCanonicalBytesAndErrorState() async throws {
        let appData = try makeCompletedPlanAppData(
            dayCode: "push-a",
            finalOrder: ["incline-db-press", "bench-press"],
            currentDayPlan: CustomDayPlan(exercises: [
                CustomExerciseItem(exerciseId: "bench-press"),
                CustomExerciseItem(exerciseId: "incline-db-press"),
            ])
        )
        let candidate = try XCTUnwrap(SessionStore.completedSessionPlanCandidate(
            from: appData,
            sessionId: "save-to-plan-session",
            now: startedAt
        ))
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-save-plan-failure-\(UUID().uuidString)", isDirectory: true)
        let fileURL = directory.appendingPathComponent("app-data.json")
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let malformed = Data(#"{"schemaVersion":"not-readable"}"#.utf8)
        try malformed.write(to: fileURL)
        let sessionStore = SessionStore(
            draftStore: FakeTrainSessionDraftStore(),
            planWriteFileURL: fileURL
        )

        let outcome = await sessionStore.saveCompletedSessionPlan(
            sessionId: candidate.sessionId,
            now: startedAt
        )

        XCTAssertEqual(outcome, .failed)
        XCTAssertNotNil(sessionStore.planSaveErrorText)
        XCTAssertEqual(sessionStore.completedSessionPlanRevision, 0)
        XCTAssertEqual(try Data(contentsOf: fileURL), malformed)
    }

    func testPlanAdjustmentStateShowsIncreaseProposalAboveExistingReduceUndo() throws {
        let dates = [
            "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03",
            "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10",
            "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17",
            "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24",
        ]
        let appData = try makePlanAdjustmentAppData(
            programDays: 3,
            historyDates: dates,
            adjustmentHistory: [
                PlanAdjustmentRecord(kind: "reduceFrequency",
                                     fromDaysPerWeek: 5, toDaysPerWeek: 3),
            ]
        )
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))
        let now = try date("2026-07-29", timeZone: utc)

        let state = SessionStore.planAdjustmentState(from: appData, now: now, timeZone: utc)

        XCTAssertEqual(state.proposal?.kind.rawValue, "increaseFrequency",
                       "既有 reduce 记录不得压掉不同 kind 的 increase 提案")
        XCTAssertEqual(state.proposal?.toDaysPerWeek, 5)
        XCTAssertEqual(state.activeKind?.rawValue, "reduceFrequency",
                       "同屏下方仍保留栈顶已采纳收据与撤销")
        XCTAssertEqual(state.activeTo, 3)
        XCTAssertEqual(state.proposedWeekDays.count, 5)
    }

    func testPlanProposalSnoozeIsScopedByKind() {
        let store = SessionStore(draftStore: FakeTrainSessionDraftStore())

        store.snoozePlanProposal(.reduceFrequency)

        XCTAssertTrue(store.isPlanProposalSnoozed(.reduceFrequency))
        XCTAssertFalse(store.isPlanProposalSnoozed(.increaseFrequency),
                       "暂不降频不能压掉之后的增频提案")
    }

    func testPlanAdjustmentStateSuppressesSameKindWhileKeepingUndo() throws {
        let dates = [
            "2026-06-29", "2026-07-01",
            "2026-07-06", "2026-07-08",
            "2026-07-13", "2026-07-15",
            "2026-07-20", "2026-07-22",
        ]
        let appData = try makePlanAdjustmentAppData(
            programDays: 3,
            historyDates: dates,
            adjustmentHistory: [
                PlanAdjustmentRecord(kind: "reduceFrequency",
                                     fromDaysPerWeek: 5, toDaysPerWeek: 3),
            ]
        )
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))

        let state = SessionStore.planAdjustmentState(
            from: appData, now: try date("2026-07-29", timeZone: utc), timeZone: utc
        )

        XCTAssertNil(state.proposal, "栈顶已采纳 reduce 时，同 kind 的新 reduce 信号继续抑制")
        XCTAssertEqual(state.activeKind, .reduceFrequency)
        XCTAssertEqual(state.activeTo, 3, "抑制提案不能吞掉既有撤销入口")
    }

    func testPlanAdjustmentReceiptUsesCurrentProgramDaysAfterSettingsEdit() throws {
        let appData = try makePlanAdjustmentAppData(
            programDays: 4,
            historyDates: [],
            adjustmentHistory: [
                PlanAdjustmentRecord(
                    kind: "reduceFrequency",
                    fromDaysPerWeek: 5,
                    toDaysPerWeek: 3
                ),
            ]
        )
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))

        let state = SessionStore.planAdjustmentState(
            from: appData,
            now: try date("2026-07-29", timeZone: utc),
            timeZone: utc
        )

        XCTAssertEqual(state.activeTo, 4,
                       "设置页后来改为 4 天后，收据的“现在”必须跟当前计划，不能继续显示历史 to=3")
    }

    func testNormalPlanAdjustmentSurfaceMatchesOriginMainByteGolden() throws {
        // fixture 固定本分支起点 origin/main 的旧 PlanAdjustmentState 共有 surface；
        // activeKind 是本批新增字段，另由 kind 共存测试锁定，不伪装成旧基线字段。
        let inputData = try Data(contentsOf: planAdjustmentFixtureURL(
            "plan-adjustment-normal-surface.origin-main.input.json"
        ))
        let input = try JSONDecoder().decode(PlanAdjustmentSurfaceGoldenInput.self, from: inputData)
        XCTAssertEqual(input.baselineCommit, "e4a711c658f5bb2afe004e50ec5d2c40e5275f43")
        let appData = try AppData(decoding: input.appData)
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))
        let state = SessionStore.planAdjustmentState(
            from: appData,
            now: try date(input.today, timeZone: utc),
            timeZone: utc
        )
        var payload: [String: Any] = [
            "proposedWeekDays": state.proposedWeekDays.map(\.dayCode),
        ]
        if let proposal = state.proposal {
            payload["proposal"] = [
                "kind": proposal.kind.rawValue,
                "from": proposal.fromDaysPerWeek,
                "to": proposal.toDaysPerWeek,
            ]
        } else {
            payload["proposal"] = NSNull()
        }
        if let activeTo = state.activeTo {
            payload["activeTo"] = activeTo
        } else {
            payload["activeTo"] = NSNull()
        }
        let bytes = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])

        XCTAssertEqual(
            bytes,
            try expectedPlanAdjustmentGoldenBytes(
                "plan-adjustment-normal-surface.origin-main.expected.json"
            ),
            "正常依从的旧 Plan surface 必须与 origin/main fixture 逐字节等价"
        )
    }

    func testFrequencyAdoptionSynchronizesBothTruthsWithoutChangingSplitAndVerdictFollows() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-plan-adjustment-app-\(UUID().uuidString)", isDirectory: true)
        let fileURL = directory.appendingPathComponent("app-data.json")
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let dates = ["2026-07-27", "2026-07-29", "2026-07-31"]
        let before = try makePlanAdjustmentAppData(
            programDays: 3, historyDates: dates, adjustmentHistory: []
        )
        try JSONEncoder().encode(before).write(to: fileURL)
        let writer = CanonicalSessionWriter(
            store: JSONFileAppDataStore(fileURL: fileURL),
            gate: SessionStoreTestDataHealthGate()
        )
        let after = try writer.applyFrequencyAdjustment(
            kind: "increaseFrequency", fromDaysPerWeek: 3, toDaysPerWeek: 5
        )

        let beforeInput = try CleanTrainingDecisionInput.make(
            from: CleanAppDataViewBuilder.build(from: before), todayISO: "2026-08-02"
        )
        let afterInput = try CleanTrainingDecisionInput.make(
            from: CleanAppDataViewBuilder.build(from: after), todayISO: "2026-08-02"
        )
        XCTAssertEqual(TodayVerdictEngine.evaluate(beforeInput).call, .light)
        XCTAssertEqual(TodayVerdictEngine.evaluate(afterInput).call, .train)
        XCTAssertEqual(after.programTemplate.daysPerWeek, 5)
        XCTAssertEqual(after.userProfile.weeklyTrainingDays, 5)
        XCTAssertEqual(after.programTemplate.splitType, "full-body")
    }

    func testTrainRowsTreatSwapBackAsANewOccurrenceAfterSkippedSet() {
        let prescription = TodayPrescription(
            dayCode: "push-a",
            exercises: [makeExercise(id: "bench-press", weightKg: 60, sets: 2)],
            dayReasons: []
        )
        var flow = TrainFlowState(prescription: prescription)

        flow.skipSet(reason: .equipmentBusy)
        flow.replaceCurrentExercise(with: "db-bench-press")
        flow.replaceCurrentExercise(with: "bench-press")

        XCTAssertEqual(flow.currentExercise?.sets.count, 1, "fixture must return to one remaining A set")
        XCTAssertEqual(
            TrainTabView.rowStatuses(flow),
            [.active],
            "the skipped row belongs to the first A occurrence and must not stain swap-back A"
        )
    }

    func testTodayRailLastFallsBackPastLatestEmptyOccurrenceOfSameExercise() throws {
        let olderRealSet = CleanLoggedSet(weight: 80, reps: 6, rir: 2)
        let model = try makeTodayModel(
            equipmentScenario: nil,
            unitSystem: "kg",
            sessions: [
                CleanTrainingSession(
                    id: "older-real-a",
                    date: "2026-07-20",
                    exercises: [
                        CleanExercise(exerciseId: "bench-press", sets: [olderRealSet]),
                    ]
                ),
                CleanTrainingSession(
                    id: "newer-skip-then-replace",
                    date: "2026-07-22",
                    exercises: [
                        CleanExercise(
                            exerciseId: "db-bench-press",
                            sets: [CleanLoggedSet(weight: 30, reps: 10, rir: 2)],
                            replacementLinks: [
                                CleanExerciseReplacementLink(
                                    originalExerciseId: "db-bench-press",
                                    actualExerciseId: "bench-press",
                                    role: .original
                                ),
                            ]
                        ),
                        CleanExercise(
                            exerciseId: "bench-press",
                            sets: [],
                            replacementLinks: [
                                CleanExerciseReplacementLink(
                                    originalExerciseId: "db-bench-press",
                                    actualExerciseId: "bench-press",
                                    role: .actual
                                ),
                            ]
                        ),
                    ]
                ),
            ]
        )

        let rail = try XCTUnwrap(
            model.railLast,
            "an empty latest A occurrence must fall back to the earlier real A performance"
        )
        XCTAssertEqual(rail.dateISO, "2026-07-20")
        XCTAssertEqual(rail.weightKg, 80)
        XCTAssertEqual(rail.reps, 6)
    }

    func testTodayRailLastKeepsOrdinaryMostRecentHistoryBehavior() throws {
        let model = try makeTodayModel(
            equipmentScenario: nil,
            unitSystem: "kg",
            sessions: [
                CleanTrainingSession(
                    id: "older-a",
                    date: "2026-07-20",
                    exercises: [
                        CleanExercise(
                            exerciseId: "bench-press",
                            sets: [CleanLoggedSet(weight: 80, reps: 6, rir: 2)]
                        ),
                    ]
                ),
                CleanTrainingSession(
                    id: "newer-a",
                    date: "2026-07-22",
                    exercises: [
                        CleanExercise(
                            exerciseId: "bench-press",
                            sets: [
                                CleanLoggedSet(weight: 82.5, reps: 8, rir: 2),
                                CleanLoggedSet(weight: 85, reps: 5, rir: 1),
                            ]
                        ),
                    ]
                ),
            ]
        )

        let rail = try XCTUnwrap(model.railLast)
        XCTAssertEqual(rail.dateISO, "2026-07-22")
        XCTAssertEqual(rail.weightKg, 85)
        XCTAssertEqual(rail.reps, 5)
    }

    func testProgressSessionScaleAggregatesRepeatedExerciseOccurrencesIntoOnePRBar() {
        let record = SnapshotSessionRecord(
            id: "a-b-a",
            dateISO: "2026-07-30",
            exercises: [
                SnapshotExerciseRecord(
                    exerciseId: "bench-press",
                    sets: [SnapshotSetRecord(weightKg: 100, reps: 5)]
                ),
                SnapshotExerciseRecord(
                    exerciseId: "cable-row",
                    sets: [SnapshotSetRecord(weightKg: 50, reps: 10)]
                ),
                SnapshotExerciseRecord(
                    exerciseId: "bench-press",
                    sets: [SnapshotSetRecord(weightKg: 80, reps: 8)]
                ),
                SnapshotExerciseRecord(
                    exerciseId: "skip-only-terminal",
                    sets: []
                ),
            ]
        )

        let items = ProgressTabView.sessionScaleItems(
            record: record,
            prExerciseIds: ["bench-press"]
        )

        XCTAssertEqual(items.map(\.exerciseId), ["bench-press", "cable-row"])
        XCTAssertEqual(items.first?.volumeKg, 1_140)
        XCTAssertEqual(items.filter(\.isPR).count, 1)
    }

    private func makePlanAdjustmentAppData(
        programDays: Int,
        historyDates: [String],
        adjustmentHistory: [PlanAdjustmentRecord]
    ) throws -> AppData {
        let sessions: [JSONValue] = historyDates.enumerated().map { index, date in
            .object([
                "id": .string("plan-session-\(index)"),
                "date": .string(date),
                "completed": .bool(true),
                "exercises": .array([]),
            ])
        }
        let records: [JSONValue] = adjustmentHistory.map { record in
            .object([
                "kind": .string(record.kind),
                "fromDaysPerWeek": .int(Int64(record.fromDaysPerWeek)),
                "toDaysPerWeek": .int(Int64(record.toDaysPerWeek)),
            ])
        }
        return try AppData(decoding: .object([
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "userProfile": .object(["weeklyTrainingDays": .int(Int64(programDays))]),
            "programTemplate": .object([
                "splitType": .string("full-body"),
                "daysPerWeek": .int(Int64(programDays)),
            ]),
            "history": .array(sessions),
            "planAdjustmentHistory": .array(records),
        ]))
    }

    private func makeCompletedPlanAppData(
        dayCode: String,
        finalOrder: [String],
        currentDayPlan: CustomDayPlan?,
        rawDayPlan: JSONValue? = nil,
        added: [String] = [],
        removed: [String] = [],
        oneTimeDayOverride: String? = nil,
        exerciseSubstitutions: [String: String] = [:],
        completedExerciseIds: [String] = []
    ) throws -> AppData {
        func editItems(_ ids: [String]) -> JSONValue {
            .array(ids.enumerated().map { index, id in
                .object([
                    "exerciseId": .string(id),
                    "position": .int(Int64(index)),
                ])
            })
        }
        var session: [String: JSONValue] = [
            "id": .string("save-to-plan-session"),
            "date": .string("2026-07-30"),
            "completed": .bool(true),
            "templateId": .string(dayCode),
            "durationMin": .double(62),
            "exercises": .array(completedExerciseIds.map { exerciseId in
                .object([
                    "exerciseId": .string(exerciseId),
                    "sets": .array([
                        .object([
                            "weight": .int(0),
                            "reps": .int(8),
                            "rir": .int(2),
                        ]),
                    ]),
                ])
            }),
            "finalExerciseOrder": .array(finalOrder.map(JSONValue.string)),
        ]
        if !added.isEmpty || !removed.isEmpty {
            session["sessionEdits"] = .object([
                "added": editItems(added),
                "removed": editItems(removed),
            ])
        }
        var root: [String: JSONValue] = [
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "userProfile": .object([
                "weeklyTrainingDays": .int(3),
                "equipmentScenario": .string("commercial-gym"),
            ]),
            "programTemplate": .object([
                "splitType": .string("push-pull-legs"),
                "daysPerWeek": .int(3),
            ]),
            "history": .array([.object(session)]),
        ]
        if !exerciseSubstitutions.isEmpty {
            root["exerciseSubstitutions"] = .object(
                exerciseSubstitutions.mapValues(JSONValue.string)
            )
        }
        if let rawDayPlan {
            root["planCustomization"] = .object([
                "dayPlans": .object([
                    dayCode: rawDayPlan,
                ]),
            ])
        } else if let currentDayPlan {
            root["planCustomization"] = .object([
                "dayPlans": .object([
                    dayCode: .object([
                        "exercises": .array(currentDayPlan.exercises.map(customItemJSON)),
                    ]),
                ]),
            ])
        }
        if let oneTimeDayOverride {
            root["oneTimeDayOverride"] = .object([
                "dayCode": .string(oneTimeDayOverride),
                "dateISO": .string("2026-07-30"),
            ])
        }
        return try AppData(decoding: .object(root))
    }

    private func rawDayPlan(in appData: AppData, dayCode: String) -> JSONValue? {
        appData.storage["planCustomization"]?
            .asObject?["dayPlans"]?
            .asObject?[dayCode]
    }

    private func deterministicJSONBytes(_ value: JSONValue?) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(value)
    }

    private func customItemJSON(_ item: CustomExerciseItem) -> JSONValue {
        var object: [String: JSONValue] = ["exerciseId": .string(item.exerciseId)]
        if let sets = item.sets { object["sets"] = .int(Int64(sets)) }
        if let repMin = item.repMin { object["repMin"] = .int(Int64(repMin)) }
        if let repMax = item.repMax { object["repMax"] = .int(Int64(repMax)) }
        if let rest = item.rest { object["rest"] = .int(Int64(rest)) }
        if item.crossFamily { object["crossFamily"] = .bool(true) }
        return .object(object)
    }

    private func makeTemporaryCanonical(_ appData: AppData) throws -> (URL, URL) {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-save-plan-\(UUID().uuidString)", isDirectory: true)
        let fileURL = directory.appendingPathComponent("app-data.json")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONEncoder().encode(appData).write(to: fileURL)
        return (directory, fileURL)
    }

    private func date(_ iso: String, timeZone: TimeZone) throws -> Date {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return try XCTUnwrap(formatter.date(from: iso))
    }

    private func makeMuscleLevelMemory(
        levels: [String: Int],
        peaks: [String: Int],
        tierRaw: String?
    ) -> MuscleLevelMemory {
        MuscleLevelMemory(
            levels: levels,
            peaks: peaks,
            tierRaw: tierRaw,
            updatedAtIso: "2026-07-30"
        )
    }

    private func widgetRows(
        memory: MuscleLevelMemory?,
        strings: RedeStrings = RedeStrings(locale: .en)
    ) throws -> [ReadinessWidgetRow] {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-widget-memory-\(UUID().uuidString)", isDirectory: true)
        let fileURL = directory.appendingPathComponent("muscle-level-memory.json")
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        if let memory {
            try MuscleLevelMemoryStore(fileURL: fileURL).save(memory)
        }
        return SessionStore.widgetMuscleLevelRows(memoryURL: fileURL, strings: strings)
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

    private func makeExercise(
        id: String,
        weightKg: Double,
        sets: Int = 3
    ) -> ExercisePrescriptionPlan {
        ExercisePrescriptionPlan(
            exerciseId: id,
            sets: sets,
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

    private func makeAdHocExercisePlan(id: String = "db-bench-press") -> ExerciseSetPlan {
        ExerciseSetPlan(
            exerciseId: id,
            restSeconds: 90,
            repLowerBound: 8,
            repUpperBound: 12,
            stepKg: 2.5,
            loadType: "external",
            sets: (1...3).map {
                PlannedSet(index: $0, targetWeightKg: 30, targetReps: 10, targetRir: 2)
            }
        )
    }

    private func makeTodayModel(
        equipmentScenario: String?,
        unitSystem: String?,
        sessions: [CleanTrainingSession] = []
    ) throws -> TodayModel {
        let raw = try JSONDecoder().decode(
            AppData.self,
            from: Data(#"{"schemaVersion":11}"#.utf8)
        )
        let cleanView = CleanAppDataView(
            raw: raw,
            sessions: sessions,
            profile: CleanProfile(
                equipmentScenario: equipmentScenario,
                unitSystem: unitSystem
            ),
            program: CleanProgram(splitType: "push-pull-legs"),
            issues: []
        )
        return TodayModel(
            verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
            prescription: makePrescription(),
            cleanView: cleanView,
            now: startedAt,
            coachActions: [],
            substitutions: [:],
            oneTimeSubstitutions: [:],
            equipmentScenario: equipmentScenario,
            daySequence: ["push-a", "pull-a", "legs-a"],
            scheduledDayCode: "push-a",
            weeklyCycleRestart: false
        )
    }
}

private enum DraftSaveKind: Equatable {
    case ordinary
    case durable
}

private final class FakeTrainSessionDraftStore: TrainSessionDraftStoring {
    private let fallbackSaveResult: Bool
    private var saveResults: [Bool]
    private(set) var clearCallCount = 0
    private(set) var saveKinds: [DraftSaveKind] = []
    private(set) var attemptedDrafts: [TrainSessionDraft] = []
    var loadedDraft: TrainSessionDraft?

    init(saveResult: Bool = true) {
        self.fallbackSaveResult = saveResult
        self.saveResults = []
    }

    init(saveResults: [Bool]) {
        self.fallbackSaveResult = saveResults.last ?? true
        self.saveResults = saveResults
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
        guard !saveResults.isEmpty else { return fallbackSaveResult }
        return saveResults.removeFirst()
    }

    func clear() {
        clearCallCount += 1
    }
}
