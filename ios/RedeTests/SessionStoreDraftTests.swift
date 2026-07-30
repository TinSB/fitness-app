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
