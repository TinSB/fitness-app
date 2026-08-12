import XCTest
@testable import RedeTrainingDecision

// 循环死区检测。第一条用例复刻的是真实用户：weeklyCycleRestart + 4 天序列 + 每周 2 练，
// 56 天一次腿都没练过。
final class PlanReachabilityTests: XCTestCase {

    private let seq4 = ["push-a", "pull-a", "legs-a", "upper"]

    /// 2026 年的周一（ISO 周起点），用来构造干净的周内/跨周日期。
    private let monA = "2026-07-27"   // 周一
    private let monB = "2026-08-03"
    private let monC = "2026-08-10"

    func testRealUserCase_twoPerWeek_leavesTailUnreachable() {
        // 连续三周、每周只练周一和周二 → 轮转每周都只走到序列第 2 天。
        let dates = ["2026-07-27", "2026-07-28",
                     "2026-08-03", "2026-08-04",
                     "2026-08-10", "2026-08-11"]
        let out = PlanReachability.unreachableDays(
            sequence: seq4, weeklyCycleRestart: true,
            sessionDates: dates, todayISO: "2026-08-12")
        XCTAssertEqual(out, ["legs-a", "upper"], "每周 2 练时序列第 3、4 天永远轮不到")
    }

    func testCarryOverModeNeverHasDeadZone() {
        // 顺延（默认）：轮转按累计场次推进，序列必然全部轮到。
        let dates = ["2026-07-27", "2026-07-28", "2026-08-03", "2026-08-04"]
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: seq4, weeklyCycleRestart: false,
                sessionDates: dates, todayISO: "2026-08-12"),
            [], "顺延模式不该报死区")
    }

    func testOneGoodWeekClearsTheWholeSequence() {
        // 取最大周场次而非平均：只要最近有一周走完了 4 天，就不是死区。
        // 宁可漏报不可误报——误报会让人不信这条提示。
        let dates = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30",  // 4 练
                     "2026-08-03", "2026-08-04"]                              // 2 练
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: seq4, weeklyCycleRestart: true,
                sessionDates: dates, todayISO: "2026-08-05"),
            [], "近期有一周走满序列就不该判死区")
    }

    func testNotEnoughWeeksStaysSilent() {
        // 只有一个有训练的周：数据不足，不下结论。新用户第一周练一次不该被判死区。
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: seq4, weeklyCycleRestart: true,
                sessionDates: ["2026-08-10", "2026-08-11"], todayISO: "2026-08-12"),
            [], "只有一周数据时应保持沉默")
    }

    func testBlankWeeksAreNotCountedAsZero() {
        // 中间空了一周（停练）不该被当成「那周练了 0 次」拉低频率——
        // 只数练过的周。这里两个练过的周各 4 练 → 无死区。
        let dates = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30",
                     // 08-03 那周整周没练
                     "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"]
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: seq4, weeklyCycleRestart: true,
                sessionDates: dates, todayISO: "2026-08-13"),
            [], "空白周不该被当作 0 次拉低频率")
    }

    func testRepeatedMemberInTailIsReachableViaHead() {
        // 序列允许重复成员：[推, 拉, 推, 腿] 每周 2 练时，
        // index 2 的「推」其实在 index 0 就练到了——只有「腿」是真死区。
        let dates = ["2026-07-27", "2026-07-28", "2026-08-03", "2026-08-04"]
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: ["push-a", "pull-a", "push-a", "legs-a"],
                weeklyCycleRestart: true,
                sessionDates: dates, todayISO: "2026-08-05"),
            ["legs-a"], "尾段里重复出现的日不算死区")
    }

    func testShortSequenceAndEmptyInputsAreSafe() {
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: ["push-a"], weeklyCycleRestart: true,
                sessionDates: ["2026-08-10", "2026-08-03"], todayISO: "2026-08-12"),
            [], "单日序列没有死区可言")
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: [], weeklyCycleRestart: true,
                sessionDates: [], todayISO: "2026-08-12"),
            [])
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: seq4, weeklyCycleRestart: true,
                sessionDates: ["not-a-date"], todayISO: "2026-08-12"),
            [], "脏日期不该让检测崩或误报")
    }

    func testWindowIgnoresAncientHistory() {
        // 观察窗口只看最近 4 周：三个月前那次「一周练满 4 天」不能永久豁免死区。
        let dates = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07",  // 窗口外
                     "2026-08-03", "2026-08-04",
                     "2026-08-10", "2026-08-11"]
        XCTAssertEqual(
            PlanReachability.unreachableDays(
                sequence: seq4, weeklyCycleRestart: true,
                sessionDates: dates, todayISO: "2026-08-12"),
            ["legs-a", "upper"], "窗口外的历史不该豁免当前死区")
    }
}
