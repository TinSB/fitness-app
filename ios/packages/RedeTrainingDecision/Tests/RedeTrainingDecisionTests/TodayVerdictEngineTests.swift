// M2-1 验收：给定固定输入，输出稳定裁决（练/休/轻/减载）。
// 输入面按 PRD 开放决策 #2 拍板：仅已记录训练历史（负荷/间隔/上次表现）+ 计划结构。
// 引擎是纯函数：今天的日期由 input 注入，无 clock、无 IO、不写回 AppData。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class TodayVerdictEngineTests: XCTestCase {
    private func verdict(historyDates: [String], today: String, rir: String = "2", program: String? = nil) throws -> TodayVerdict {
        let input = try TestSupport.makeInput(
            appDataJSON: TestSupport.appDataJSON(historyDates: historyDates, rir: rir, program: program),
            todayISO: today
        )
        return TodayVerdictEngine.evaluate(input)
    }

    // 瀑布 1：今天已练 → 休
    func testRestWhenAlreadyTrainedToday() throws {
        let result = try verdict(historyDates: ["2026-06-09"], today: "2026-06-09")
        XCTAssertEqual(result.call, .rest)
        XCTAssertEqual(result.reason, .alreadyTrainedToday)
    }

    // 瀑布 2：零历史 → 练（校准期，不伪造 readiness）
    func testTrainWithNoHistoryAsCalibration() throws {
        let result = try verdict(historyDates: [], today: "2026-06-09")
        XCTAssertEqual(result.call, .train)
        XCTAssertEqual(result.reason, .noHistoryCalibration)
        XCTAssertTrue(result.signals.contains(.noTrainingHistory))
    }

    // 瀑布 3：长间隔 ≥14 天 → 轻（回归保底）
    func testLightAfterLongGap() throws {
        let result = try verdict(historyDates: ["2026-05-26"], today: "2026-06-09")
        XCTAssertEqual(result.call, .light)
        XCTAssertEqual(result.reason, .longGapReentry(days: 14))

        let thirteen = try verdict(historyDates: ["2026-05-27"], today: "2026-06-09")
        XCTAssertEqual(thirteen.call, .train)
        XCTAssertEqual(thirteen.reason, .normalProgression)
    }

    // 天序号数学：严格解析 + 闰年/跨月边界
    func testDayNumberMath() {
        XCTAssertEqual(TrainingDay.dayNumber(fromISO: "1970-01-01"), 0)
        XCTAssertEqual(TrainingDay.dayNumber(fromISO: "1970-01-02"), 1)
        // 跨月连续：2026-05-31 → 06-01
        let may31 = TrainingDay.dayNumber(fromISO: "2026-05-31")!
        XCTAssertEqual(TrainingDay.dayNumber(fromISO: "2026-06-01"), may31 + 1)
        // 闰年：2028-02-29 合法，2026-02-29 非法
        XCTAssertNotNil(TrainingDay.dayNumber(fromISO: "2028-02-29"))
        XCTAssertNil(TrainingDay.dayNumber(fromISO: "2026-02-29"))
        // 严格格式：拒绝非零填充与越界
        XCTAssertNil(TrainingDay.dayNumber(fromISO: "2026-6-9"))
        XCTAssertNil(TrainingDay.dayNumber(fromISO: "2026-13-01"))
        XCTAssertNil(TrainingDay.dayNumber(fromISO: "2026-12-32"))
        // ISO datetime 取前 10 位
        XCTAssertEqual(
            TrainingDay.dayNumber(fromISO: "2026-06-09T10:00:00.000Z"),
            TrainingDay.dayNumber(fromISO: "2026-06-09")
        )
    }

    // 瀑布 4：连续 ≥3 天训练 → 休
    func testRestAfterThreeConsecutiveTrainingDays() throws {
        let result = try verdict(
            historyDates: ["2026-06-06", "2026-06-07", "2026-06-08"],
            today: "2026-06-09"
        )
        XCTAssertEqual(result.call, .rest)
        XCTAssertEqual(result.reason, .consecutiveDaysNeedRest(days: 3))
    }

    // 瀑布 5：21 天高频无间断 → 减载
    func testDeloadAfterSustainedLoadWithoutBreak() throws {
        // 2026-05-20 起每天练到 06-08（20 天），今天 06-09 未练：
        // 21 天窗口内 20 个训练日 ≥ 3×6（默认计划），最长间隔 1 天。
        let dates = (0..<20).map { offset -> String in
            let day = 20 + offset
            return day <= 31 ? String(format: "2026-05-%02d", day) : String(format: "2026-06-%02d", day - 31)
        }
        let result = try verdict(historyDates: dates, today: "2026-06-09")
        XCTAssertEqual(result.call, .deload)
        XCTAssertEqual(result.reason, .sustainedLoadDeload(days: 21))
    }

    // 瀑布 6：本日历周（周一始）训练天数达到计划频次 → 轻
    // 周口径迁移（2026-07-15）：滚动 7 天 → 日历周；fixture 平移到同一日历周内
    //（06-08 周一 / 06-10 周三 / 06-12 周五，今天 06-14 周日——case 语义不变）。
    func testLightWhenWeeklyPlanReached() throws {
        let result = try verdict(
            historyDates: ["2026-06-08", "2026-06-10", "2026-06-12"],
            today: "2026-06-14",
            program: #"{"daysPerWeek": 3}"#
        )
        XCTAssertEqual(result.call, .light)
        XCTAssertEqual(result.reason, .weeklyPlanReached(days: 3, planned: 3))
        XCTAssertTrue(result.signals.contains(.trainedDaysThisWeek(3)))
    }

    // 行为变化锁（2026-07-15 周口径迁移，有意变化非回归）：上周三/五/日练满计划 3，
    // 今天周一 = 新日历周（本周 0 天）→ train。滚动 7 天窗在这里会给 light（近 7 天
    // 3 场），日历周语义下周一重置重新计——此测试防止有人无意改回滚动窗。
    // 周初连续高频的保护由 consecutiveDaysNeedRest / sustainedLoad 承担，无保护真空。
    func testMondayAfterFullPreviousWeekTrainsAgain() throws {
        let result = try verdict(
            historyDates: ["2026-06-03", "2026-06-05", "2026-06-07"],
            today: "2026-06-08",
            program: #"{"daysPerWeek": 3}"#
        )
        XCTAssertEqual(result.call, .train)
        XCTAssertEqual(result.reason, .normalProgression)
        XCTAssertTrue(result.signals.contains(.trainedDaysThisWeek(0)), "新周从 0 计，上周天数不跨周")
    }

    // 周中练满：周一/周二练满计划 2 → 周三轻练（weeklyPlanReached 在同一周内照常触发）
    func testMidweekPlanReachedGoesLight() throws {
        let result = try verdict(
            historyDates: ["2026-06-08", "2026-06-09"],
            today: "2026-06-10",
            program: #"{"daysPerWeek": 2}"#
        )
        XCTAssertEqual(result.call, .light)
        XCTAssertEqual(result.reason, .weeklyPlanReached(days: 2, planned: 2))
    }

    // 周中未满：周三只练了周一 1 天（计划 3）→ 正常推进，信号=本周 1 天
    func testMidweekBelowPlanTrainsNormally() throws {
        let result = try verdict(
            historyDates: ["2026-06-08"],
            today: "2026-06-10",
            program: #"{"daysPerWeek": 3}"#
        )
        XCTAssertEqual(result.call, .train)
        XCTAssertEqual(result.reason, .normalProgression)
        XCTAssertTrue(result.signals.contains(.trainedDaysThisWeek(1)))
    }

    // 瀑布 7：昨天练到力竭（mean RIR ≤ 0.5）→ 轻
    func testLightWhenLastSessionNearFailure() throws {
        let result = try verdict(historyDates: ["2026-06-08"], today: "2026-06-09", rir: "0")
        XCTAssertEqual(result.call, .light)
        XCTAssertEqual(result.reason, .lastSessionNearFailure(meanRir: 0))
    }

    // 瀑布 8：常规推进 → 练
    func testTrainNormally() throws {
        let result = try verdict(historyDates: ["2026-06-05", "2026-06-07"], today: "2026-06-09")
        XCTAssertEqual(result.call, .train)
        XCTAssertEqual(result.reason, .normalProgression)
        XCTAssertTrue(result.signals.contains(.daysSinceLastSession(2)))
    }

    // 计划频次回退链第二跳：program 缺失时用 profile.weeklyTrainingDays
    //（fixture 同步平移到日历周内：06-08/10/12 同周，今天 06-14 周日）
    func testPlannedDaysFallsBackToProfile() throws {
        let json = #"{"schemaVersion": 8, "userProfile": {"weeklyTrainingDays": 3}, "history": \#(TestSupport.historyJSON(dates: ["2026-06-08", "2026-06-10", "2026-06-12"]))}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-14")
        let result = TodayVerdictEngine.evaluate(input)
        XCTAssertTrue(result.signals.contains(.plannedDaysPerWeek(3)))
        XCTAssertEqual(result.reason, .weeklyPlanReached(days: 3, planned: 3))
    }

    // 确定性：同输入两次求值结果完全相等
    func testEvaluationIsDeterministic() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: TestSupport.appDataJSON(historyDates: ["2026-06-05", "2026-06-07"]),
            todayISO: "2026-06-09"
        )
        XCTAssertEqual(TodayVerdictEngine.evaluate(input), TodayVerdictEngine.evaluate(input))
    }

    // 未来日期的 session（时钟漂移/脏数据）不参与 recency 计算
    func testFutureDatedSessionsAreIgnored() throws {
        let result = try verdict(historyDates: ["2026-07-01"], today: "2026-06-09")
        XCTAssertEqual(result.call, .train)
        XCTAssertEqual(result.reason, .noHistoryCalibration)
    }

    // 无 RIR 数据时力竭规则不触发（不猜）
    func testNearFailureRuleSkippedWithoutRirData() throws {
        let json = #"{"schemaVersion": 8, "history": [{"id": "s0", "date": "2026-06-08", "completed": true, "exercises": [{"exerciseId": "squat", "sets": [{"weight": 100, "reps": 5}]}]}]}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-09")
        let result = TodayVerdictEngine.evaluate(input)
        XCTAssertEqual(result.call, .train)
        XCTAssertEqual(result.reason, .normalProgression)
    }

    // 输入合同：非法 today 在工厂处抛错，引擎自身不抛
    func testInvalidTodayISOThrowsAtInputFactory() {
        XCTAssertThrowsError(
            try TestSupport.makeInput(appDataJSON: #"{"schemaVersion": 8}"#, todayISO: "not-a-date")
        ) { error in
            XCTAssertEqual(error as? CleanTrainingDecisionInput.InputError, .invalidTodayISO("not-a-date"))
        }
    }

    // 工厂投影完整性：sessions/profile/program 来自 CleanAppDataView
    func testInputFactoryProjectsCleanViewFields() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: TestSupport.appDataJSON(historyDates: ["2026-06-07"], program: #"{"daysPerWeek": 4}"#),
            todayISO: "2026-06-09"
        )
        XCTAssertEqual(input.sessions.count, 1)
        XCTAssertEqual(input.program.daysPerWeek, 4)
        XCTAssertEqual(input.todayISO, "2026-06-09")
    }
}
