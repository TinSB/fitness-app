// M3-2 小结构建器：完成流的摘要数据（总量/组数/顶组/e1RM/PR 判定）。
// 纯函数；时长由调用方注入秒数（无 clock）。PR 口径（2026-10-18 与进展页 / 今日页对齐）=
// 本场任一动作的顶组重量严格大于该动作全部已存历史的最重一组；没练过的动作不判 PR。

import Foundation
import XCTest
import RedeDataHealth
import RedeDomain
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

    // 任一动作破纪录即 PR，不限于全场最重那组（与进展页 prExerciseIds 非空同义）。
    // PR 铭牌 / 分享卡写破纪录的那个动作（prTopSet），不是全场最重一组（审查 2026-10-18）。
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
        XCTAssertEqual(summary.topSet?.exerciseId, "bench-press", "全场最重一组不变")
        XCTAssertEqual(summary.prTopSet, SessionSummary.TopSet(exerciseId: "lateral-raise", weightKg: 12.5, reps: 10),
                       "PR 卡写真正破纪录的动作")
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

    // 审查 2026-10-18：进展页的 PR 是剔除数据质量可疑组之后算的；小结的基线也要剔除，
    // 否则历史里一次手滑的 120（真实最好 50）会让今天 55 在小结里不算 PR、存完进展页却算。
    func testBaselineIgnoresSetsTheDataQualityReportFlags() throws {
        let sessions = [
            session("2026-06-01", "lat-pulldown", [50]),
            session("2026-06-08", "lat-pulldown", [120]),
        ]
        let raw = try JSONDecoder().decode(AppData.self, from: Data(#"{"schemaVersion":11}"#.utf8))
        let view = CleanAppDataView(raw: raw, sessions: sessions, profile: CleanProfile(),
                                    program: CleanProgram(splitType: "push-pull-legs"), issues: [])
        let suspects = DataQualityReportBuilder.build(view: view).suspectSets
        XCTAssertEqual(suspects.map(\.weightKg), [120], "前置：120 被标为可疑")

        XCTAssertEqual(SessionSummaryBuilder.previousBestWeights(sessions: sessions)["lat-pulldown"], 120)
        let best = SessionSummaryBuilder.previousBestWeights(sessions: sessions, excluding: suspects)
        XCTAssertEqual(best["lat-pulldown"], 50)
        XCTAssertTrue(SessionSummaryBuilder.build(
            observations: ["lat-pulldown": [obs(55, 10)]], durationSeconds: 600, previousBestWeightKg: best
        ).isPersonalRecord)
    }

    // 数据体检 2026-10-19：磅用户手输的 65 lb 和引擎格子上的 65 lb 在双精度里差 1 个最低位。
    func testSamePoundWeightTypedByHandIsNotAPersonalRecord() {
        let gridKg = 13 * (5 / 2.2046226218)        // 引擎格子：13 × 5 lb
        let typedKg = 65 / 2.2046226218             // 改组面板手输 65
        XCTAssertGreaterThan(typedKg, gridKg, "前置：两者在双精度里确实不相等")
        let summary = SessionSummaryBuilder.build(
            observations: ["bench-press": [obs(typedKg, 6)]], durationSeconds: 600,
            previousBestWeightKg: ["bench-press": gridKg])
        XCTAssertFalse(summary.isPersonalRecord, "同一重量不是 PR")
    }

    // 数据体检 2026-10-19：本场手滑的一组（60 kg 记成 100 kg）不发 PR，与进展页剔除可疑组同一条规则；
    // 同场里真实的一组照样能破纪录。
    func testSuspectSetInThisSessionDoesNotCountAsAPersonalRecord() {
        let slip = SessionSummaryBuilder.build(
            observations: ["bench-press": [obs(57.5, 6), obs(100, 6)]], durationSeconds: 600,
            previousBestWeightKg: ["bench-press": 60])
        XCTAssertFalse(slip.isPersonalRecord, "100 > 1.5 × 60：可疑，不报 PR")

        let real = SessionSummaryBuilder.build(
            observations: ["bench-press": [obs(62.5, 5), obs(100, 6)]], durationSeconds: 600,
            previousBestWeightKg: ["bench-press": 60])
        XCTAssertEqual(real.prTopSet?.weightKg, 62.5, "真实的 62.5 照样是 PR，铭牌写它")

        let ceiling = SessionSummaryBuilder.build(
            observations: ["lateral-raise": [obs(80, 12)]], durationSeconds: 600,
            previousBestWeightKg: ["lateral-raise": 10], plausibleCeilingByExercise: ["lateral-raise": 60])
        XCTAssertFalse(ceiling.isPersonalRecord, "超过动作合理上限：可疑")
    }

    func testEmptyObservationsYieldEmptySummary() {
        let summary = SessionSummaryBuilder.build(observations: [:], durationSeconds: 0)
        XCTAssertEqual(summary.completedSetCount, 0)
        XCTAssertEqual(summary.totalVolumeKg, 0)
        XCTAssertNil(summary.topSet)
        XCTAssertFalse(summary.isPersonalRecord)
    }
}
