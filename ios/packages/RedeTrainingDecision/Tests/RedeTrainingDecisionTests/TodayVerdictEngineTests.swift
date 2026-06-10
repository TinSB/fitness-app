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

    // 瀑布 6：近 7 天达到计划频次 → 轻
    func testLightWhenWeeklyPlanReached() throws {
        let result = try verdict(
            historyDates: ["2026-06-03", "2026-06-05", "2026-06-07"],
            today: "2026-06-09",
            program: #"{"daysPerWeek": 3}"#
        )
        XCTAssertEqual(result.call, .light)
        XCTAssertEqual(result.reason, .weeklyPlanReached(sessions: 3, planned: 3))
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
    func testPlannedDaysFallsBackToProfile() throws {
        let json = #"{"schemaVersion": 8, "userProfile": {"weeklyTrainingDays": 3}, "history": \#(TestSupport.historyJSON(dates: ["2026-06-03", "2026-06-05", "2026-06-07"]))}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-09")
        let result = TodayVerdictEngine.evaluate(input)
        XCTAssertTrue(result.signals.contains(.plannedDaysPerWeek(3)))
        XCTAssertEqual(result.reason, .weeklyPlanReached(sessions: 3, planned: 3))
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
