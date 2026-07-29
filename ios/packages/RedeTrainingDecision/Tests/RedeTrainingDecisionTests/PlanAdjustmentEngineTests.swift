// FR-PL3 计划调整提案合同（频率/依从）：最近 4 个完整 ISO 周的训练天数中位数，
// 低于计划则降频、高于计划则增频；双向互斥、目标钳在 2...6、正常依从 byte golden 不变。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class PlanAdjustmentEngineTests: XCTestCase {
    private struct NormalAdherenceGoldenInput: Decodable {
        let baselineCommit: String
        let plannedDaysPerWeek: Int
        let recentWeeklySessionCounts: [Int]
    }

    private func proposal(planned: Int, weeks: [Int]) -> PlanAdjustmentProposal? {
        PlanAdjustmentEngine.frequencyProposal(plannedDaysPerWeek: planned, recentWeeklySessionCounts: weeks)
    }

    private func expectedGoldenBytes(_ name: String) throws -> Data {
        var data = try Data(contentsOf: TestSupport.fixtureURL(name))
        while let last = data.last, last == 0x0A || last == 0x0D {
            data.removeLast()
        }
        return data
    }

    func testProposesReduceWhenSustainedBelowPlan() {
        let p = proposal(planned: 4, weeks: [2, 3, 2, 2])  // 4 周中位数 2 ≤ 4-1
        XCTAssertEqual(p?.kind, .reduceFrequency)
        XCTAssertEqual(p?.reasonCode, "belowPlanSustained")
        XCTAssertEqual(p?.observedDaysPerWeek, 2)
        XCTAssertEqual(p?.fromDaysPerWeek, 4)
        XCTAssertEqual(p?.toDaysPerWeek, 2, "降到可持续中位数")
    }

    func testProposesIncreaseAtExactOneDayMargin() {
        let p = proposal(planned: 3, weeks: [4, 5, 4, 4])
        XCTAssertEqual(p?.kind.rawValue, "increaseFrequency")
        XCTAssertEqual(p?.reasonCode, "abovePlanSustained")
        XCTAssertEqual(p?.observedDaysPerWeek, 4)
        XCTAssertEqual(p?.fromDaysPerWeek, 3)
        XCTAssertEqual(p?.toDaysPerWeek, 4)
    }

    func testNilWhenOnTrack() {
        XCTAssertNil(proposal(planned: 4, weeks: [4, 4, 3, 4]), "中位数 4 > 4-1，未持续落后")
        XCTAssertNil(proposal(planned: 3, weeks: [3, 3, 3, 3]), "完全达标")
    }

    func testNilWhenInsufficientData() {
        XCTAssertNil(proposal(planned: 4, weeks: [1, 1, 1]), "只有 3 周 < 4，数据不足不提")
    }

    func testNilWhenAlreadyAtMinimum() {
        XCTAssertNil(proposal(planned: 2, weeks: [0, 0, 1, 0]), "已是最低频率，不再降")
    }

    func testFloorsAtMinimumDaysPerWeek() {
        let p = proposal(planned: 5, weeks: [0, 1, 0, 1])  // 中位数 0，但不建议低于 2
        XCTAssertEqual(p?.toDaysPerWeek, 2, "目标不低于每周 2 次下限")
    }

    func testIncreaseCeilsAtSixAndDoesNotProposeNoOpAtMaximum() {
        let p = proposal(planned: 3, weeks: [7, 8, 7, 8])
        XCTAssertEqual(p?.kind.rawValue, "increaseFrequency")
        XCTAssertEqual(p?.observedDaysPerWeek, 7, "观测中位数保留真实值，不能把钳制后的 6 冒充观测")
        XCTAssertEqual(p?.toDaysPerWeek, 6)
        XCTAssertNil(proposal(planned: 6, weeks: [7, 7, 7, 7]), "计划已在上限，不能提 6→6")
    }

    func testCleanCurrentOutsideTargetRangeCanProposeBackIntoTwoThroughSix() {
        XCTAssertEqual(
            proposal(planned: 1, weeks: [2, 2, 2, 2])?.toDaysPerWeek,
            2,
            "current 可为 clean 合法 1；新目标仍钳到下限 2"
        )
        XCTAssertEqual(
            proposal(planned: 7, weeks: [6, 6, 6, 6])?.toDaysPerWeek,
            6,
            "current 可为 clean 合法 7；新目标仍钳到上限 6"
        )
    }

    func testOnlyMostRecentFourWeeksDriveBothDirections() {
        let increase = proposal(planned: 3, weeks: [1, 1, 1, 1, 5, 5, 5, 5])
        XCTAssertEqual(increase?.kind.rawValue, "increaseFrequency",
                       "旧 4 周不得稀释最近 4 周的增频信号")
        XCTAssertEqual(increase?.toDaysPerWeek, 5)

        let reduce = proposal(planned: 5, weeks: [6, 6, 6, 6, 2, 2, 2, 2])
        XCTAssertEqual(reduce?.kind, .reduceFrequency,
                       "旧 4 周不得稀释最近 4 周的降频信号")
        XCTAssertEqual(reduce?.toDaysPerWeek, 2)
    }

    func testDirectionSignalsAreMutuallyExclusive() {
        XCTAssertEqual(proposal(planned: 4, weeks: [2, 2, 2, 2])?.kind, .reduceFrequency)
        XCTAssertNil(proposal(planned: 4, weeks: [4, 4, 4, 4]))
        XCTAssertEqual(proposal(planned: 4, weeks: [5, 5, 5, 5])?.kind.rawValue, "increaseFrequency")
    }

    func testNormalAdherenceProposalSurfaceMatchesOriginMainByteGolden() throws {
        // input/expected 由本分支起点 origin/main e4a711c658f5bb2afe004e50ec5d2c40e5275f43
        // 的旧 PlanAdjustmentEngine 输出固定；这里比较旧版本已有的完整 proposal adapter surface。
        let inputData = try Data(contentsOf: TestSupport.fixtureURL(
            "plan-adjustment-normal-adherence.origin-main.input.json"
        ))
        let input = try JSONDecoder().decode(NormalAdherenceGoldenInput.self, from: inputData)
        XCTAssertEqual(input.baselineCommit, "e4a711c658f5bb2afe004e50ec5d2c40e5275f43")
        let p = proposal(
            planned: input.plannedDaysPerWeek,
            weeks: input.recentWeeklySessionCounts
        )
        var payload: [String: Any] = [:]
        if let p {
            payload["proposal"] = [
                "kind": p.kind.rawValue,
                "reasonCode": p.reasonCode,
                "from": p.fromDaysPerWeek,
                "to": p.toDaysPerWeek,
            ]
        } else {
            payload["proposal"] = NSNull()
        }
        let bytes = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
        XCTAssertEqual(
            bytes,
            try expectedGoldenBytes("plan-adjustment-normal-adherence.origin-main.expected.json"),
            "正常依从旧 proposal surface 必须与 origin/main fixture 逐字节等价"
        )
    }

    func testMedianOddAndEven() {
        XCTAssertEqual(PlanAdjustmentEngine.median([2, 3, 2, 2]), 2, "偶数取中间两数向下")
        XCTAssertEqual(PlanAdjustmentEngine.median([1, 2, 3]), 2, "奇数取中")
        XCTAssertEqual(PlanAdjustmentEngine.median([]), 0)
    }

    func testDeterministic() {
        XCTAssertEqual(proposal(planned: 4, weeks: [2, 2, 3, 2]), proposal(planned: 4, weeks: [2, 2, 3, 2]))
    }
}
