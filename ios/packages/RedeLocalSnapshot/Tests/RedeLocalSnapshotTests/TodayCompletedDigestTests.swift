// T1 最近一场总结（2026-07-05；K3 2026-07-16 放宽 today-only 门槛）：从已落盘历史派生
// 总结块 + 分享快照的纯函数。
// 语义锁：最近一场（任意日期）都产出，dateISO 透传供 UI 区头分流（今天这场/上一场）；
// record 缺失诚实退化 nil（UI 退回原状兜底）；时长缺失不出训练总结卡（不编时长档）
// 但不扼杀 PR 卡；分享快照日期 = 场次真实日期（旧场不标成今天）。

import XCTest
@testable import RedeLocalSnapshot

final class TodayCompletedDigestTests: XCTestCase {
    private let today = "2026-07-05"

    private func entry(dateISO: String, prIds: [String] = [], topSet: ProgressSnapshot.TopSet? = nil,
                       volume: Double = 7060, sets: Int = 22) -> ProgressSnapshot.HistoryEntry {
        ProgressSnapshot.HistoryEntry(
            sessionId: "s1", dateISO: dateISO, totalVolumeKg: volume, setCount: sets,
            topSet: topSet, prExerciseIds: prIds, durationMinutes: nil)
    }

    private func record(exercises: Int = 8) -> SnapshotSessionRecord {
        SnapshotSessionRecord(
            id: "s1", dateISO: today,
            exercises: (0..<exercises).map { i in
                SnapshotExerciseRecord(exerciseId: "ex\(i)", sets: [SnapshotSetRecord(weightKg: 30, reps: 6)])
            })
    }

    func testTodayCompletedProducesSummaryAndShareSnapshots() {
        let digest = TodayCompletedDigestBuilder.digest(
            latest: entry(dateISO: today), record: record(),
            dayCode: "upper", durationMinutes: 72, patterns: ["horizontal-press", "vertical-pull"])
        XCTAssertNotNil(digest)
        XCTAssertEqual(digest?.dateISO, today)
        XCTAssertEqual(digest?.exerciseCount, 8)
        XCTAssertEqual(digest?.setCount, 22)
        XCTAssertEqual(digest?.totalVolumeKg, 7060)
        XCTAssertEqual(digest?.durationBand, .m60to90)
        XCTAssertEqual(digest?.prCount, 0)
        // 无 PR：只有训练总结卡，hadPR=false、dayCode 透传
        XCTAssertEqual(digest?.shareSnapshots.count, 1)
        if case let .workoutSummary(w)? = digest?.shareSnapshots.first?.content {
            XCTAssertFalse(w.hadPR)
            XCTAssertEqual(w.dayCode, "upper")
            XCTAssertEqual(w.setCount, 22)
        } else { XCTFail("expected workoutSummary") }
    }

    func testPRDayAppendsPersonalRecordCard() {
        let top = ProgressSnapshot.TopSet(exerciseId: "bench-press", weightKg: 102.5, reps: 5)
        let digest = TodayCompletedDigestBuilder.digest(
            latest: entry(dateISO: today, prIds: ["bench-press"], topSet: top),
            record: record(),
            dayCode: nil, durationMinutes: 45, patterns: [])
        XCTAssertEqual(digest?.prCount, 1)
        XCTAssertEqual(digest?.shareSnapshots.count, 2)
        if case let .personalRecord(pr)? = digest?.shareSnapshots.last?.content {
            XCTAssertEqual(pr.exerciseId, "bench-press")
            XCTAssertEqual(pr.weightKg, 102.5)
            XCTAssertFalse(pr.isEstimated)
        } else { XCTFail("expected personalRecord") }
    }

    // K3（2026-07-16）：最近一场不是今天也产出——休息日「上一场」回执；
    // dateISO 透传真实日期，分享快照日期 = 场次日期（不编成今天）。
    func testLatestNotTodayStillProducesDigestWithRealDate() {
        let digest = TodayCompletedDigestBuilder.digest(
            latest: entry(dateISO: "2026-07-03"), record: record(),
            dayCode: "full-b", durationMinutes: 60, patterns: ["squat-pattern"])
        XCTAssertNotNil(digest)
        XCTAssertEqual(digest?.dateISO, "2026-07-03")
        if case let .workoutSummary(w)? = digest?.shareSnapshots.first?.content {
            XCTAssertEqual(w.dayCode, "full-b")
        } else { XCTFail("expected workoutSummary") }
        XCTAssertEqual(digest?.shareSnapshots.first?.generatedDateISO, "2026-07-03")
        // 零历史仍 nil（不编数据）
        XCTAssertNil(TodayCompletedDigestBuilder.digest(
            latest: nil, record: nil,
            dayCode: nil, durationMinutes: 60, patterns: []))
    }

    func testMissingRecordDegradesHonestly() {
        // statsRecords 里找不到对应场（防御）：不猜动作数，整体退化 nil
        XCTAssertNil(TodayCompletedDigestBuilder.digest(
            latest: entry(dateISO: today), record: nil,
            dayCode: "upper", durationMinutes: 60, patterns: []))
    }

    func testAllSetsSuspectStillRendersZeroSetsHonestly() {
        // 边界（审查 MINOR）：动作条目在、但全部组被质量清洗剔除 → setCount=0。
        // 锁定行为：如实显示「N 动作 · 0 组 · 总量 0」（丑但不编数据、不崩），不整体退化。
        let digest = TodayCompletedDigestBuilder.digest(
            latest: entry(dateISO: today, volume: 0, sets: 0), record: record(exercises: 3),
            dayCode: nil, durationMinutes: 40, patterns: [])
        XCTAssertNotNil(digest)
        XCTAssertEqual(digest?.setCount, 0)
        XCTAssertEqual(digest?.totalVolumeKg, 0)
        XCTAssertEqual(digest?.exerciseCount, 3)
    }

    func testMissingDurationSkipsWorkoutCardButKeepsPRCard() {
        let top = ProgressSnapshot.TopSet(exerciseId: "squat", weightKg: 140, reps: 3)
        let digest = TodayCompletedDigestBuilder.digest(
            latest: entry(dateISO: today, prIds: ["squat"], topSet: top),
            record: record(),
            dayCode: "lower", durationMinutes: nil, patterns: ["squat"])
        XCTAssertNotNil(digest)
        XCTAssertNil(digest?.durationBand)          // 不编时长档
        XCTAssertEqual(digest?.shareSnapshots.count, 1) // 无训练总结卡（时长档必填），PR 卡保留
        if case .personalRecord? = digest?.shareSnapshots.first?.content {} else {
            XCTFail("expected personalRecord only")
        }
    }
}
