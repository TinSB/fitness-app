// T2 计划页排期折叠（2026-07-05）：训练日类型去重 + 分段序列的纯函数视图模型。
import XCTest
@testable import RedeTrainingDecision

final class PlanScheduleDigestTests: XCTestCase {
    private func day(_ code: String, _ count: Int = 7, _ patterns: [String] = ["squat", "hinge"]) -> PlanDayProjection {
        PlanDayProjection(dayCode: code, exerciseCount: count, patternCodes: patterns)
    }

    func testUpperLowerTwoWeeksCollapsesToTwoTypes() {
        let lower = day("lower"), upper = day("upper", 8, ["horizontal-press", "vertical-pull"])
        let projection = [[lower, upper, lower, upper], [lower, upper, lower, upper]]
        let digest = PlanScheduleDigestBuilder.digest(from: projection)
        XCTAssertEqual(digest.dayTypes.map(\.dayCode), ["lower", "upper"]) // 首现顺序
        XCTAssertEqual(digest.dayTypes.count, 2)                           // 8 行 → 2 类
        XCTAssertEqual(digest.segments, [["lower", "upper", "lower", "upper"], ["lower", "upper", "lower", "upper"]])
    }

    func testFirstOccurrenceCompositionWins() {
        // 同 dayCode 构成恒一致（投影按 dayCode 派生）；防御断言保留首现
        let a = day("push-a", 5, ["horizontal-press"])
        let digest = PlanScheduleDigestBuilder.digest(from: [[a, day("pull-a", 6, ["vertical-pull"]), a]])
        XCTAssertEqual(digest.dayTypes.map(\.dayCode), ["push-a", "pull-a"])
        XCTAssertEqual(digest.dayTypes[0].exerciseCount, 5)
    }

    func testUnevenCustomSequencePreservesSegmentShape() {
        let p = [[day("push-a"), day("pull-a"), day("legs-a"), day("push-a"), day("pull-a")],
                 [day("legs-a"), day("push-a"), day("pull-a"), day("legs-a"), day("push-a")]]
        let digest = PlanScheduleDigestBuilder.digest(from: p)
        XCTAssertEqual(digest.dayTypes.map(\.dayCode), ["push-a", "pull-a", "legs-a"])
        XCTAssertEqual(digest.segments[1], ["legs-a", "push-a", "pull-a", "legs-a", "push-a"])
    }

    func testEmptyProjectionYieldsEmptyDigest() {
        let digest = PlanScheduleDigestBuilder.digest(from: [])
        XCTAssertTrue(digest.dayTypes.isEmpty)
        XCTAssertTrue(digest.segments.isEmpty)
    }
}
