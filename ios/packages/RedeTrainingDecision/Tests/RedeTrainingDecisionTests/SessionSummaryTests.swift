// M3-2 小结构建器：完成流的摘要数据（总量/组数/顶组/e1RM/PR 判定）。
// 纯函数；时长由调用方注入秒数（无 clock）。PR 口径 = 顶组重量 > 该动作处方
// 携带的上次工作重量（previousWeightKg）；无历史不判 PR（校准期不发奖）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class SessionSummaryTests: XCTestCase {
    private func obs(_ w: Double, _ r: Int) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: 2, painReported: false)
    }

    private func makePrescriptionAndObservations() throws -> (TodayPrescription, [String: [CompletedSetObservation]]) {
        let input = try TestSupport.makeInput(
            appDataJSON: TestSupport.appDataJSON(historyDates: ["2026-06-05", "2026-06-07"], program: #"{"splitType": "upper-lower"}"#),
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return (prescription, [:])
    }

    func testSummaryAggregatesVolumeSetsAndTopSet() throws {
        let (prescription, _) = try makePrescriptionAndObservations()
        let observations = [
            "db-bench-press": [obs(30, 10), obs(32.5, 8)],
            "lat-pulldown": [obs(55, 9)],
        ]
        let summary = SessionSummaryBuilder.build(
            prescription: prescription,
            observations: observations,
            durationSeconds: 2_820
        )
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

    func testPrRequiresPreviousReference() throws {
        let (prescription, _) = try makePrescriptionAndObservations()
        // 首练（previousWeightKg = nil）→ 不判 PR
        let calibration = SessionSummaryBuilder.build(
            prescription: prescription,
            observations: ["db-bench-press": [obs(40, 5)]],
            durationSeconds: 600
        )
        XCTAssertFalse(calibration.isPersonalRecord)
    }

    func testPrWhenTopSetExceedsPreviousWeight() throws {
        let json = #"{"schemaVersion": 8, "programTemplate": {"splitType": "upper-lower"}, "history": [{"id": "s0", "date": "2026-06-05", "completed": true, "exercises": []}, {"id": "s1", "date": "2026-06-07", "completed": true, "exercises": [{"exerciseId": "db-bench-press", "sets": [{"weight": 30, "reps": 8, "rir": 2}]}]}]}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-09")
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))

        let pr = SessionSummaryBuilder.build(
            prescription: prescription,
            observations: ["db-bench-press": [obs(32.5, 6)]],
            durationSeconds: 600
        )
        XCTAssertTrue(pr.isPersonalRecord)

        let noPr = SessionSummaryBuilder.build(
            prescription: prescription,
            observations: ["db-bench-press": [obs(30, 6)]],
            durationSeconds: 600
        )
        XCTAssertFalse(noPr.isPersonalRecord)
    }

    func testEmptyObservationsYieldEmptySummary() throws {
        let (prescription, _) = try makePrescriptionAndObservations()
        let summary = SessionSummaryBuilder.build(prescription: prescription, observations: [:], durationSeconds: 0)
        XCTAssertEqual(summary.completedSetCount, 0)
        XCTAssertEqual(summary.totalVolumeKg, 0)
        XCTAssertNil(summary.topSet)
        XCTAssertFalse(summary.isPersonalRecord)
    }

    // §6.2 修复：换入动作的 PR 只和它自己的历史比（调用方注入 overrides）
    func testPrAfterReplacementUsesOwnHistoryViaOverrides() throws {
        let (prescription, _) = try makePrescriptionAndObservations()
        // 换入 db-floor-press（不在处方），注入其自身历史 20 → 顶组 22.5 = PR
        let withHistory = SessionSummaryBuilder.build(
            prescription: prescription,
            observations: ["db-floor-press": [obs(22.5, 8)]],
            durationSeconds: 600,
            previousWeightOverrides: ["db-floor-press": 20]
        )
        XCTAssertTrue(withHistory.isPersonalRecord)
        // 无注入（该动作无历史）→ 保守不发奖（与首练同口径），不再静默恒 false 暗规则
        let noHistory = SessionSummaryBuilder.build(
            prescription: prescription,
            observations: ["db-floor-press": [obs(22.5, 8)]],
            durationSeconds: 600
        )
        XCTAssertFalse(noHistory.isPersonalRecord)
        // 绝不拿被换走动作的历史比：处方里 db-bench-press previous 存在也不参与
        XCTAssertFalse(prescription.exercises.contains { $0.exerciseId == "db-floor-press" })
    }
}
