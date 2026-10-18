// M3-2 小结构建器：完成流的摘要数据（总量/组数/顶组/e1RM/PR 判定）。
// 纯函数；时长由调用方注入秒数（无 clock）。PR 口径（2026-10-18 与进展页 / 今日页对齐）=
// 本场任一动作的顶组重量严格大于该动作全部已存历史的最重一组；没练过的动作不判 PR。

import Foundation
import XCTest
import RedeDataHealth
@testable import RedeTrainingDecision

final class SessionSummaryTests: XCTestCase {
    private func obs(_ w: Double, _ r: Int) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: 2, painReported: false)
    }

    private func session(_ date: String, _ exerciseId: String, _ weights: [Double]) -> CleanTrainingSession {
        CleanTrainingSession(id: "s-\(date)-\(exerciseId)", date: date, exercises: [
            CleanExercise(exerciseId: exerciseId, sets: weights.map { CleanLoggedSet(weight: $0, reps: 8, rir: 2) }),
        ])
    }

    func testSummaryAggregatesVolumeSetsAndTopSet() throws {
        let observations = [
            "db-bench-press": [obs(30, 10), obs(32.5, 8)],
            "lat-pulldown": [obs(55, 9)],
        ]
        let summary = SessionSummaryBuilder.build(observations: observations, durationSeconds: 2_820)
        XCTAssertEqual(summary.completedSetCount, 3)
        // §6.2 owner 拍板 B 案：吨位×loadFactor——双哑铃卧推 ×2，绳索下拉 ×1
        let expectedVolume: Double = (300 + 260) * 2 + 495 // (30×10 + 32.5×8)×2 + 55×9×1
        XCTAssertEqual(summary.totalVolumeKg, expectedVolume)
        XCTAssertEqual(summary.topSet?.exerciseId, "lat-pulldown")
        XCTAssertEqual(summary.topSet?.weightKg, 55)
        XCTAssertEqual(summary.durationSeconds, 2_820)
        // Epley e1RM = w × (1 + r/30)
        XCTAssertEqual(summary.topSetE1RmKg.map { ($0 * 10).rounded() / 10 }, 71.5)
    }

    // 没练过的动作（无历史基线）不判 PR——校准期不发奖。
    func testNoPrWithoutHistory() {
        let summary = SessionSummaryBuilder.build(
            observations: ["db-bench-press": [obs(40, 5)]], durationSeconds: 600, previousBestWeightKg: [:]
        )
        XCTAssertFalse(summary.isPersonalRecord)
    }

    // 进展页口径：要超过全部历史的最重一组，不是只超过上次。
    // 三周前 75、上次 65、今天 70：此前小结报 PR、存完进展页没有——现在两边都不报。
    func testPrMeansBeatingTheAllTimeBestNotJustLastTime() {
        let best = SessionSummaryBuilder.previousBestWeights(sessions: [
            session("2026-05-20", "bench-press", [70, 75]),
            session("2026-06-07", "bench-press", [65, 65]),
        ])
        XCTAssertEqual(best["bench-press"], 75)

        let notPR = SessionSummaryBuilder.build(
            observations: ["bench-press": [obs(70, 6)]], durationSeconds: 600, previousBestWeightKg: best
        )
        XCTAssertFalse(notPR.isPersonalRecord)

        let pr = SessionSummaryBuilder.build(
            observations: ["bench-press": [obs(77.5, 3)]], durationSeconds: 600, previousBestWeightKg: best
        )
        XCTAssertTrue(pr.isPersonalRecord)

        let tie = SessionSummaryBuilder.build(
            observations: ["bench-press": [obs(75, 8)]], durationSeconds: 600, previousBestWeightKg: best
        )
        XCTAssertFalse(tie.isPersonalRecord, "持平不算（严格大于）")
    }

    // 任一动作破纪录即 PR，不限于全场最重那组（与进展页 prExerciseIds 非空同义）；
    // 顶组展示仍是全场最重一组（与今日页练完块一致）。
    func testPrOnAnyExerciseCountsEvenWhenItIsNotTheTopSet() {
        let summary = SessionSummaryBuilder.build(
            observations: [
                "bench-press": [obs(60, 6)],
                "lateral-raise": [obs(12.5, 10)],
            ],
            durationSeconds: 600,
            previousBestWeightKg: ["bench-press": 75, "lateral-raise": 10]
        )
        XCTAssertTrue(summary.isPersonalRecord)
        XCTAssertEqual(summary.topSet?.exerciseId, "bench-press")
    }

    // 换入动作只和它自己的历史比；辅助器械不参与 PR，也不进基线。
    func testEachExerciseComparesWithItsOwnHistoryAndAssistedNeverCounts() {
        let best = SessionSummaryBuilder.previousBestWeights(sessions: [
            session("2026-06-01", "db-floor-press", [20]),
            session("2026-06-01", "assisted-pull-up", [30]),
        ])
        XCTAssertNil(best["assisted-pull-up"])
        let swapped = SessionSummaryBuilder.build(
            observations: ["db-floor-press": [obs(22.5, 8)]], durationSeconds: 600, previousBestWeightKg: best
        )
        XCTAssertTrue(swapped.isPersonalRecord)
        let assisted = SessionSummaryBuilder.build(
            observations: ["assisted-pull-up": [obs(40, 8)]], durationSeconds: 600,
            previousBestWeightKg: ["assisted-pull-up": 30]
        )
        XCTAssertFalse(assisted.isPersonalRecord)
    }

    func testEmptyObservationsYieldEmptySummary() {
        let summary = SessionSummaryBuilder.build(observations: [:], durationSeconds: 0)
        XCTAssertEqual(summary.completedSetCount, 0)
        XCTAssertEqual(summary.totalVolumeKg, 0)
        XCTAssertNil(summary.topSet)
        XCTAssertFalse(summary.isPersonalRecord)
    }
}
