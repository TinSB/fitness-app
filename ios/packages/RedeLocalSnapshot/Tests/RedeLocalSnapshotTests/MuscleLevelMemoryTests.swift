// B2（2026-07-07）：MLE 跨次记忆——extract 只记已解锁、codec schema guard、store 容错。
// 语义锁：校准中肌群不进 levels/peaks（占位级不是记忆）；未知 schemaVersion 拒读；
// 坏文件/缺文件 load=nil 不崩（诚实「无记忆」）；atomic round-trip；端到端两轮
// compose：第一轮记忆喂回第二轮后 peak 不随等级回落（max 单调跨次生效）。

import Dispatch
import XCTest
@testable import RedeLocalSnapshot

final class MuscleLevelMemoryTests: XCTestCase {
    private let mondays = ["2026-06-01", "2026-06-08", "2026-06-15",
                           "2026-06-22", "2026-06-29", "2026-07-06"]

    private func seededProfile() -> MuscleDevelopmentProfile {
        var rows: [MuscleVolumeAggregator.ContributionRow] = []
        var touches: [MuscleTouchRow] = []
        for (index, monday) in mondays.enumerated() {
            rows.append(.init(dateISO: monday, muscleRaw: "chest", weight: 1.0, setCount: 8))
            touches.append(.init(muscleRaw: "chest", sessionId: "s\(index)",
                                 familyId: index % 2 == 0 ? "horizontal-press" : "fly"))
        }
        return MuscleProfileComposer.compose(MuscleProfileComposer.Input(
            rows: rows, touches: touches, e1rmRows: [],
            bestActualKgByExercise: [:], bestE1RmKgByExercise: [:],
            unitSystem: "kg", nowISO: "2026-07-07"))
    }

    private func tempURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("mle-memory-tests-\(UUID().uuidString)")
            .appendingPathComponent("muscle-level-memory.json")
    }

    private func levelEvent(
        muscle: String = "back",
        from: Int = 8,
        to: Int = 9,
        at date: String = "2026-07-29",
        eventFacts: LevelBreakthroughEventFacts? = nil
    ) -> LevelBreakthrough {
        LevelBreakthrough(
            kind: .muscleLevel,
            targetId: muscle,
            fromLevel: from,
            toLevel: to,
            fromTier: nil,
            toTier: nil,
            evidence: [],
            achievedAtIso: date,
            eventFacts: eventFacts
        )
    }

    private var zeroScore: MuscleLevelScoreBreakdown {
        MuscleLevelScoreBreakdown(
            exposureScore: 0,
            performanceScore: 0,
            milestoneScore: 0,
            progressionScore: 0,
            coverageScore: 0,
            consistencyScore: 0,
            recoveryPenalty: 0,
            goalAdjustment: 0
        )
    }

    private func estimate(
        _ muscle: MuscleGroupID,
        level: Int,
        trend: MuscleLevelTrend = .stable,
        confidence: EstimateConfidence = .medium,
        decision: MuscleDevelopmentDecision = .maintain,
        recoveryPenalty: Double = 0,
        limitations: [MuscleLevelLimitation] = []
    ) -> MuscleLevelEstimate {
        let score = MuscleLevelScoreBreakdown(
            exposureScore: 0,
            performanceScore: 0,
            milestoneScore: 0,
            progressionScore: 0,
            coverageScore: 0,
            consistencyScore: 0,
            recoveryPenalty: recoveryPenalty,
            goalAdjustment: 0
        )
        return MuscleLevelEstimate(
            muscleId: muscle,
            currentLevel: level,
            peakLevel: level,
            levelProgress: 0,
            trend: trend,
            confidence: confidence,
            decision: decision,
            score: score,
            evidence: [],
            limitations: limitations
        )
    }

    private func profile(
        estimates: [MuscleLevelEstimate],
        balanceScore: Double? = nil,
        breakthroughs: [LevelBreakthrough] = []
    ) -> MuscleDevelopmentProfile {
        MuscleDevelopmentProfile(
            estimates: estimates,
            overallTier: .novicePlus,
            balanceScore: balanceScore,
            strongestMuscleIds: [],
            priorityMuscleIds: [],
            strengthMilestones: [],
            breakthroughs: breakthroughs,
            generatedAtIso: "2026-07-29",
            modelVersion: "test-only"
        )
    }

    func testExtractRecordsOnlyUnlockedMuscles() {
        let profile = seededProfile()   // chest 解锁、其余 9 块校准中
        let memory = MuscleLevelMemory.extract(from: profile, atIso: "2026-07-07")
        XCTAssertNotNil(memory.levels["chest"])
        XCTAssertEqual(memory.levels.count, 1)          // 校准中不记（占位级不是记忆）
        XCTAssertEqual(memory.peaks.count, 1)
        XCTAssertEqual(memory.levels["chest"], memory.peaks["chest"])   // 首轮 peak=current
        XCTAssertEqual(memory.tierRaw, profile.overallTier.rawValue)
        XCTAssertEqual(memory.updatedAtIso, "2026-07-07")
        XCTAssertEqual(memory.schemaVersion, MuscleLevelMemory.currentSchemaVersion)
    }

    func testCodecRejectsUnknownSchemaVersion() throws {
        let alien = MuscleLevelMemory(schemaVersion: 99, levels: [:], peaks: [:],
                                      tierRaw: nil, updatedAtIso: "2026-07-07")
        let data = try MuscleLevelMemoryCodec.encode(alien)
        XCTAssertThrowsError(try MuscleLevelMemoryCodec.decode(data)) { error in
            XCTAssertEqual(error as? MuscleLevelMemoryError, .unsupportedSchemaVersion(99))
        }
    }

    func testStoreRoundTripAndOverwrite() throws {
        let url = tempURL()
        let store = MuscleLevelMemoryStore(fileURL: url)
        XCTAssertNil(store.load())                       // 缺文件=无记忆
        let first = MuscleLevelMemory(levels: ["chest": 8], peaks: ["chest": 8],
                                      tierRaw: "novicePlus", updatedAtIso: "2026-07-01")
        try store.save(first)
        XCTAssertEqual(store.load(), first)
        let second = MuscleLevelMemory(levels: ["chest": 9], peaks: ["chest": 9],
                                       tierRaw: "novicePlus", updatedAtIso: "2026-07-07")
        try store.save(second)
        XCTAssertEqual(store.load(), second)             // atomic 覆盖
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    func testStoreLoadToleratesGarbageAndAlienSchema() throws {
        let url = tempURL()
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("not json at all".utf8).write(to: url)
        XCTAssertNil(MuscleLevelMemoryStore(fileURL: url).load())    // 坏文件=无记忆
        let alien = MuscleLevelMemory(schemaVersion: 99, levels: [:], peaks: [:],
                                      tierRaw: nil, updatedAtIso: "x")
        try MuscleLevelMemoryCodec.encode(alien).write(to: url)
        XCTAssertNil(MuscleLevelMemoryStore(fileURL: url).load())    // 未来版本=无记忆
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    func testShouldPersistOnlyOnContentChange() {
        // 审查 m2：写盘判断下沉包内——三分支锁死
        let base = MuscleLevelMemory(levels: ["chest": 8], peaks: ["chest": 8],
                                     tierRaw: "novicePlus", updatedAtIso: "2026-07-01")
        // 无记忆 + 全空 → 不写；无记忆 + 有内容 → 写
        XCTAssertFalse(MuscleLevelMemory.shouldPersist(
            previous: nil, next: MuscleLevelMemory(levels: [:], peaks: [:], tierRaw: "calibrating",
                                                   updatedAtIso: "2026-07-07")))
        XCTAssertTrue(MuscleLevelMemory.shouldPersist(previous: nil, next: base))
        // 仅日期变 → 不写；内容变（含某肌群消失）→ 写
        let sameContent = MuscleLevelMemory(levels: ["chest": 8], peaks: ["chest": 8],
                                            tierRaw: "novicePlus", updatedAtIso: "2026-07-07")
        XCTAssertFalse(MuscleLevelMemory.shouldPersist(previous: base, next: sameContent))
        let muscleGone = MuscleLevelMemory(levels: [:], peaks: [:],
                                           tierRaw: "novicePlus", updatedAtIso: "2026-07-07")
        XCTAssertTrue(MuscleLevelMemory.shouldPersist(previous: base, next: muscleGone))
    }

    func testSaveReconcilingKeepsHigherAndForeignDiskPeaks() throws {
        // 审查 M1/m3：并发竞写/回退校准两个场景下，盘上峰值不被替换语义抹掉
        let url = tempURL()
        let store = MuscleLevelMemoryStore(fileURL: url)
        try store.save(MuscleLevelMemory(levels: ["chest": 12, "back": 9],
                                         peaks: ["chest": 15, "back": 9],
                                         tierRaw: "intermediate", updatedAtIso: "2026-07-01"))
        // 本轮（旧输入的竞写者）：chest peak 只见过 10、完全没见过 back
        try store.saveReconciling(MuscleLevelMemory(levels: ["chest": 10], peaks: ["chest": 10],
                                                    tierRaw: "novicePlus", updatedAtIso: "2026-07-07"))
        let merged = store.load()
        XCTAssertEqual(merged?.peaks["chest"], 15)      // 盘上更高峰保留（max）
        XCTAssertEqual(merged?.peaks["back"], 9)        // 盘上有本轮无的键保留
        XCTAssertEqual(merged?.levels["chest"], 10)     // levels 最后写者胜（快照语义）
        XCTAssertNil(merged?.levels["back"])
        XCTAssertEqual(merged?.tierRaw, "novicePlus")
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    func testPeakSurvivesDetrainingAcrossComposes() {
        // 端到端跨次：第一轮满暴露 → 高等级记忆；第二轮暴露减半（等级回落），
        // 把第一轮记忆喂回 → current 降、peak 保持第一轮高位（max 单调跨次生效）。
        let firstProfile = seededProfile()
        let memory = MuscleLevelMemory.extract(from: firstProfile, atIso: "2026-07-07")
        let firstLevel = memory.levels["chest"] ?? 0
        XCTAssertGreaterThan(firstLevel, 1)
        var rows: [MuscleVolumeAggregator.ContributionRow] = []
        var touches: [MuscleTouchRow] = []
        for (index, monday) in mondays.prefix(3).enumerated() {   // 减量：3 周 × 3 组
            rows.append(.init(dateISO: monday, muscleRaw: "chest", weight: 1.0, setCount: 3))
            touches.append(.init(muscleRaw: "chest", sessionId: "s\(index)", familyId: "horizontal-press"))
        }
        let second = MuscleProfileComposer.compose(MuscleProfileComposer.Input(
            rows: rows, touches: touches, e1rmRows: [],
            bestActualKgByExercise: [:], bestE1RmKgByExercise: [:],
            unitSystem: "kg", previousLevels: memory.levels, previousPeaks: memory.peaks,
            previousTierRaw: memory.tierRaw, nowISO: "2026-07-07"))
        let chest = second.estimates.first { $0.muscleId == .chest }
        XCTAssertLessThan(chest?.currentLevel ?? 99, firstLevel)     // 等级如实回落
        XCTAssertEqual(chest?.peakLevel, firstLevel)                 // 峰值不消失（§6.5.4）
    }

    // MARK: - 批次 E：priorityMuscles 喂数面

    func testExtractCarriesPriorityMusclesAndPersistDetectsChange() {
        // extract 带上 assembler 真 decision 的补足名单；名单变化触发落盘
        let profile = seededProfile()
        let memory = MuscleLevelMemory.extract(from: profile, atIso: "2026-07-07")
        XCTAssertEqual(memory.priorityMuscles,
                       profile.priorityMuscleIds.map(\.rawValue))
        let base = MuscleLevelMemory(levels: ["chest": 8], peaks: ["chest": 8],
                                     tierRaw: "novicePlus", priorityMuscles: ["biceps"],
                                     updatedAtIso: "2026-07-01")
        let listChanged = MuscleLevelMemory(levels: ["chest": 8], peaks: ["chest": 8],
                                            tierRaw: "novicePlus", priorityMuscles: [],
                                            updatedAtIso: "2026-07-07")
        XCTAssertTrue(MuscleLevelMemory.shouldPersist(previous: base, next: listChanged))
    }

    func testLegacyFileWithoutPriorityFieldDecodesAsNil() throws {
        // 旧文件（schema 1 无 priorityMuscles 键）→ nil = 空名单（零迁移向后兼容）
        let legacy = #"{"schemaVersion": 1, "levels": {"chest": 8}, "peaks": {"chest": 9}, "tierRaw": "novicePlus", "updatedAtIso": "2026-07-01"}"#
        let memory = try MuscleLevelMemoryCodec.decode(Data(legacy.utf8))
        XCTAssertNil(memory.priorityMuscles)
        XCTAssertEqual(memory.levels["chest"], 8)
        // reconcilingPeaks 复制路径保留字段
        let carried = MuscleLevelMemory(levels: [:], peaks: [:], tierRaw: nil,
                                        priorityMuscles: ["back"], updatedAtIso: "2026-07-08")
            .reconcilingPeaks(with: memory)
        XCTAssertEqual(carried.priorityMuscles, ["back"])
        // 非空名单 encode→decode 往返（审查 m6：extract 空对空断言之外的 codec 面实证）
        let encoded = try MuscleLevelMemoryCodec.encode(carried)
        XCTAssertEqual(try MuscleLevelMemoryCodec.decode(encoded).priorityMuscles, ["back"])
    }

    // MARK: - MLE 消费面：pending breakthroughs（schema v1 additive optional）

    func testLegacyFileWithoutPendingBreakthroughsDecodesAsNil() throws {
        let legacy = #"{"schemaVersion":1,"levels":{"back":8},"peaks":{"back":9},"tierRaw":"novicePlus","updatedAtIso":"2026-07-28"}"#
        let decoded = try MuscleLevelMemoryCodec.decode(Data(legacy.utf8))
        XCTAssertNil(decoded.pendingBreakthroughs)
        XCTAssertEqual(decoded.schemaVersion, 1)
    }

    func testLegacyPendingEventWithoutAppendFactsStaysFactOnlyAndNeverShares() throws {
        let legacy = #"{"schemaVersion":1,"levels":{"back":9},"peaks":{"back":9},"tierRaw":"novicePlus","pendingBreakthroughs":[{"kind":"muscleLevel","targetId":"back","fromLevel":8,"toLevel":9,"evidence":[],"achievedAtIso":"2026-07-29"}],"updatedAtIso":"2026-07-29"}"#
        let decoded = try MuscleLevelMemoryCodec.decode(Data(legacy.utf8))
        let event = try XCTUnwrap(decoded.pendingBreakthroughs?.first)

        XCTAssertNil(event.eventFacts)
        XCTAssertEqual(
            MuscleEventShareBuilder.todayEvents(
                pending: decoded.pendingBreakthroughs ?? [],
                generatedDateISO: "2026-07-29"
            ),
            [event],
            "旧事件仍是当天事实"
        )
        XCTAssertFalse(
            LevelBreakthroughShareEligibility.isEligible(event),
            "缺事件时事实必须 fail closed，不得补看当前 profile"
        )
    }

    func testPendingBreakthroughMergeDeduplicatesByApprovedKey() {
        let event = levelEvent()
        let sameKeyDifferentFrom = levelEvent(from: 7)
        let differentDay = levelEvent(from: 8, at: "2026-07-30")

        let merged = MuscleLevelMemory.mergingPending(
            existing: [event],
            new: [sameKeyDifferentFrom, differentDay]
        )

        XCTAssertEqual(merged, [event, differentDay])
    }

    func testPendingBreakthroughMergeCapsAtTwentyAndDropsOldest() {
        let events = (1...22).map { index in
            levelEvent(
                muscle: "muscle-\(index)",
                from: index,
                to: index + 1,
                at: String(format: "2026-07-%02d", index)
            )
        }

        let merged = MuscleLevelMemory.mergingPending(existing: [], new: events)

        XCTAssertEqual(merged.count, 20)
        XCTAssertEqual(merged.first?.targetId, "muscle-3")
        XCTAssertEqual(merged.last?.targetId, "muscle-22")
    }

    func testSaveReconcilingMergesDiskPendingWithoutDuplicatingSecondReader() throws {
        let url = tempURL()
        let store = MuscleLevelMemoryStore(fileURL: url)
        let first = levelEvent()
        try store.save(MuscleLevelMemory(
            levels: ["back": 9],
            peaks: ["back": 9],
            tierRaw: "novicePlus",
            pendingBreakthroughs: [first],
            updatedAtIso: "2026-07-29"
        ))

        // 第二个 loadOutcome 从旧输入算出同一事件；写前必须并盘去重，同时保留先写者的新事实。
        let secondReader = MuscleLevelMemory(
            levels: ["back": 9],
            peaks: ["back": 9],
            tierRaw: "novicePlus",
            pendingBreakthroughs: [first],
            updatedAtIso: "2026-07-29"
        )
        try store.saveReconciling(secondReader)

        XCTAssertEqual(store.load()?.pendingBreakthroughs, [first])
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    func testSaveReconcilingCarriesForeignDiskPendingAndShouldPersistDetectsPendingChange() throws {
        let url = tempURL()
        let store = MuscleLevelMemoryStore(fileURL: url)
        let diskEvent = levelEvent(muscle: "back")
        let writerEvent = levelEvent(muscle: "quads")
        let base = MuscleLevelMemory(
            levels: ["back": 9],
            peaks: ["back": 9],
            tierRaw: "novicePlus",
            pendingBreakthroughs: [diskEvent],
            updatedAtIso: "2026-07-29"
        )
        try store.save(base)
        let writer = MuscleLevelMemory(
            levels: ["back": 9],
            peaks: ["back": 9],
            tierRaw: "novicePlus",
            pendingBreakthroughs: [writerEvent],
            updatedAtIso: "2026-07-29"
        )

        XCTAssertTrue(MuscleLevelMemory.shouldPersist(previous: base, next: writer))
        try store.saveReconciling(writer)
        XCTAssertEqual(store.load()?.pendingBreakthroughs, [diskEvent, writerEvent])
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    func testAdvanceAppendsComputedBreakthroughAndRepeatedReaderDoesNotDuplicate() {
        let event = levelEvent()
        let currentProfile = profile(
            estimates: [estimate(
                .back,
                level: 9,
                confidence: .high,
                decision: .prioritize,
                limitations: [MuscleLevelLimitation(code: "noBaselineWindow")]
            )],
            breakthroughs: [event]
        )
        let previous = MuscleLevelMemory(
            levels: ["back": 8],
            peaks: ["back": 8],
            tierRaw: "novicePlus",
            updatedAtIso: "2026-07-28"
        )

        let first = MuscleLevelMemory.advancing(
            from: currentProfile,
            previous: previous,
            completedSessionCount: 8,
            atIso: "2026-07-29"
        )
        let second = MuscleLevelMemory.advancing(
            from: currentProfile,
            previous: first,
            completedSessionCount: 8,
            atIso: "2026-07-29"
        )

        let appended = first.pendingBreakthroughs?.only
        XCTAssertEqual(appended?.targetId, event.targetId)
        XCTAssertEqual(appended?.eventFacts?.confidenceAtEventRaw, "high")
        XCTAssertEqual(appended?.eventFacts?.decisionRawsAtEvent, ["prioritize"])
        XCTAssertEqual(appended?.eventFacts?.limitationCodesAtEvent, ["noBaselineWindow"])
        XCTAssertEqual(appended?.eventFacts?.recoveryPenaltyAtEvent, 0)
        XCTAssertTrue(appended.map(LevelBreakthroughShareEligibility.isEligible) ?? false)
        XCTAssertEqual(second.pendingBreakthroughs, first.pendingBreakthroughs)
    }

    func testFirstAppendFactsStayLockedWhenSameEventIsObservedWithHigherConfidence() {
        let lowFacts = LevelBreakthroughEventFacts(
            confidenceAtEventRaw: "low",
            decisionRawsAtEvent: ["maintain"],
            limitationCodesAtEvent: [],
            recoveryPenaltyAtEvent: 0
        )
        let mediumFacts = LevelBreakthroughEventFacts(
            confidenceAtEventRaw: "medium",
            decisionRawsAtEvent: ["maintain"],
            limitationCodesAtEvent: [],
            recoveryPenaltyAtEvent: 0
        )

        let first = levelEvent(eventFacts: lowFacts)
        let laterSameKey = levelEvent(eventFacts: mediumFacts)
        let merged = MuscleLevelMemory.mergingPending(existing: [first], new: [laterSameKey])

        XCTAssertEqual(merged, [first])
        XCTAssertEqual(merged.first?.eventFacts?.confidenceAtEventRaw, "low")
    }

    func testExclusiveMemoryTransactionSerializesBarrierWritersWithoutLosingPendingOrNewerBalanceState() throws {
        let url = tempURL()
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let firstStore = MuscleLevelMemoryStore(fileURL: url)
        let secondStore = MuscleLevelMemoryStore(fileURL: url)
        try firstStore.save(MuscleLevelMemory(
            levels: ["back": 8],
            peaks: ["back": 8],
            tierRaw: "novicePlus",
            updatedAtIso: "2026-07-28"
        ))

        let reference = BalanceImprovementReference(
            score: 50,
            levelsByContributorID: ["back": 4, "chest": 8, "quads": 10],
            medianConfidence: .medium
        )
        let olderState = BalanceImprovementState(
            reference: reference,
            candidate: BalanceImprovementCandidate(score: 60, completedSessionCount: 10)
        )
        let newerState = BalanceImprovementState(
            reference: BalanceImprovementReference(
                score: 60,
                levelsByContributorID: ["back": 5, "chest": 8, "quads": 10],
                medianConfidence: .medium
            ),
            candidate: nil
        )
        let firstEvent = levelEvent(muscle: "back")
        let secondEvent = levelEvent(muscle: "quads")
        let firstEntered = expectation(description: "first writer entered transaction")
        let secondAttempted = expectation(description: "second writer attempted transaction")
        let writersDone = expectation(description: "both writers completed")
        writersDone.expectedFulfillmentCount = 2
        let allowFirstToProbe = DispatchSemaphore(value: 0)
        let secondEntered = DispatchSemaphore(value: 0)

        DispatchQueue.global(qos: .userInitiated).async {
            defer { writersDone.fulfill() }
            do {
                try firstStore.withExclusiveAccess { current in
                    firstEntered.fulfill()
                    _ = allowFirstToProbe.wait(timeout: .now() + 3)
                    XCTAssertEqual(
                        secondEntered.wait(timeout: .now() + 0.25),
                        .timedOut,
                        "second writer must not enter while the first transaction is open"
                    )
                    try firstStore.save(MuscleLevelMemory(
                        levels: ["back": 9],
                        peaks: ["back": 9],
                        tierRaw: "novicePlus",
                        pendingBreakthroughs: MuscleLevelMemory.mergingPending(
                            existing: current?.pendingBreakthroughs ?? [],
                            new: [firstEvent]
                        ),
                        balanceImprovementState: olderState,
                        updatedAtIso: "2026-07-29"
                    ))
                }
            } catch {
                XCTFail("first writer failed: \(error)")
            }
        }

        wait(for: [firstEntered], timeout: 2)
        DispatchQueue.global(qos: .userInitiated).async {
            defer { writersDone.fulfill() }
            secondAttempted.fulfill()
            do {
                try secondStore.withExclusiveAccess { current in
                    secondEntered.signal()
                    XCTAssertEqual(current?.balanceImprovementState, olderState)
                    try secondStore.save(MuscleLevelMemory(
                        levels: ["back": 9, "quads": 9],
                        peaks: ["back": 9, "quads": 9],
                        tierRaw: "novicePlus",
                        pendingBreakthroughs: MuscleLevelMemory.mergingPending(
                            existing: current?.pendingBreakthroughs ?? [],
                            new: [secondEvent]
                        ),
                        balanceImprovementState: newerState,
                        updatedAtIso: "2026-07-29"
                    ))
                }
            } catch {
                XCTFail("second writer failed: \(error)")
            }
        }

        wait(for: [secondAttempted], timeout: 2)
        allowFirstToProbe.signal()
        wait(for: [writersDone], timeout: 5)

        let final = try XCTUnwrap(firstStore.load())
        XCTAssertEqual(final.pendingBreakthroughs?.map(\.targetId), ["back", "quads"])
        XCTAssertEqual(final.balanceImprovementState, newerState)
    }

    func testLegacyBalanceStateSeedsReferenceWithoutEventOrCandidate() throws {
        let legacy = #"{"schemaVersion":1,"levels":{"chest":2,"back":6,"quads":10},"peaks":{"chest":2,"back":6,"quads":10},"tierRaw":"novicePlus","updatedAtIso":"2026-07-28"}"#
        let previous = try MuscleLevelMemoryCodec.decode(Data(legacy.utf8))
        XCTAssertNil(previous.balanceImprovementState)
        let currentProfile = profile(
            estimates: [
                estimate(.chest, level: 2),
                estimate(.back, level: 6),
                estimate(.quads, level: 10),
            ],
            balanceScore: 50
        )

        let next = MuscleLevelMemory.advancing(
            from: currentProfile,
            previous: previous,
            completedSessionCount: 9,
            atIso: "2026-07-29"
        )

        XCTAssertEqual(next.balanceImprovementState?.reference?.score, 50)
        XCTAssertNil(next.balanceImprovementState?.candidate)
        XCTAssertNil(next.pendingBreakthroughs)
    }

    func testNilBalanceScoreClearsStaleStateInsteadOfRetainingIt() {
        // P2：分数不可得 = 不可比观察（同裁定 4 的「新口径新起点」）。
        // 若保留旧 candidate，分数恢复后会拿过期对比立即确认一个陈旧「改善」。
        let reference = BalanceImprovementReference(
            score: 50,
            levelsByContributorID: ["chest": 2, "back": 6, "quads": 10],
            medianConfidence: .medium
        )
        let staleCandidate = BalanceImprovementCandidate(
            score: 61,
            completedSessionCount: 10
        )
        let previous = MuscleLevelMemory(
            levels: ["chest": 2, "back": 6, "quads": 10],
            peaks: ["chest": 2, "back": 6, "quads": 10],
            tierRaw: "novicePlus",
            balanceImprovementState: .init(reference: reference, candidate: staleCandidate),
            updatedAtIso: "2026-07-28"
        )
        let scoreUnavailable = profile(
            estimates: [estimate(.chest, level: 3, trend: .rising)],
            balanceScore: nil
        )

        let next = MuscleLevelMemory.advancing(
            from: scoreUnavailable,
            previous: previous,
            completedSessionCount: 11,
            atIso: "2026-07-30"
        )

        XCTAssertNil(next.balanceImprovementState)
        XCTAssertNil(next.pendingBreakthroughs)
    }

    func testBalanceCandidateNeedsStrictlyNewSessionThenAppendsMilestone() {
        let reference = BalanceImprovementReference(
            score: 50,
            levelsByContributorID: ["chest": 2, "back": 6, "quads": 10],
            medianConfidence: .medium
        )
        let previous = MuscleLevelMemory(
            levels: ["chest": 2, "back": 6, "quads": 10],
            peaks: ["chest": 2, "back": 6, "quads": 10],
            tierRaw: "novicePlus",
            balanceImprovementState: .init(reference: reference, candidate: nil),
            updatedAtIso: "2026-07-28"
        )
        let improved = profile(
            estimates: [
                estimate(.chest, level: 3, trend: .rising),
                estimate(.back, level: 6),
                estimate(.quads, level: 10),
            ],
            balanceScore: 60
        )

        let candidate = MuscleLevelMemory.advancing(
            from: improved,
            previous: previous,
            completedSessionCount: 10,
            atIso: "2026-07-29"
        )
        XCTAssertEqual(candidate.balanceImprovementState?.candidate?.completedSessionCount, 10)
        XCTAssertNil(candidate.pendingBreakthroughs)

        let repeated = MuscleLevelMemory.advancing(
            from: improved,
            previous: candidate,
            completedSessionCount: 10,
            atIso: "2026-07-29"
        )
        XCTAssertEqual(repeated.balanceImprovementState, candidate.balanceImprovementState)
        XCTAssertNil(repeated.pendingBreakthroughs)

        let confirmed = MuscleLevelMemory.advancing(
            from: improved,
            previous: repeated,
            completedSessionCount: 11,
            atIso: "2026-07-29"
        )
        let event = confirmed.pendingBreakthroughs?.only
        XCTAssertEqual(event?.kind, .balanceMilestone)
        XCTAssertEqual(event?.fromLevel, 50)
        XCTAssertEqual(event?.toLevel, 60)
        XCTAssertEqual(event?.targetId, "chest")
        XCTAssertEqual(event?.evidence.map(\.muscleId), [.chest])
        XCTAssertEqual(confirmed.balanceImprovementState?.reference?.score, 60)
        XCTAssertNil(confirmed.balanceImprovementState?.candidate)
    }
}

private extension Array {
    var only: Element? { count == 1 ? first : nil }
}
