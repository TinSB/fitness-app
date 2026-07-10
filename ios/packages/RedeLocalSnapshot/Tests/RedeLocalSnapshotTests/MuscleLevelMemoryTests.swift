// B2（2026-07-07）：MLE 跨次记忆——extract 只记已解锁、codec schema guard、store 容错。
// 语义锁：校准中肌群不进 levels/peaks（占位级不是记忆）；未知 schemaVersion 拒读；
// 坏文件/缺文件 load=nil 不崩（诚实「无记忆」）；atomic round-trip；端到端两轮
// compose：第一轮记忆喂回第二轮后 peak 不随等级回落（max 单调跨次生效）。

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
}
