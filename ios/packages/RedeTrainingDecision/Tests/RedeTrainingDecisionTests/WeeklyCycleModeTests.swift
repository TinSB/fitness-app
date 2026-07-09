// 每周循环模式（2026-07-08，owner 拍板「两个都做，设置里切换」）。
// 语义锁：默认顺延（weeklyCycleRestart=false 逐字节等价现状）；开启后轮换 index =
// 本 ISO 周完成场次 % 序列长度（跨周自动回序列头，忽略 rotationOffset——换天补偿是
// 序列型概念）；dayCodeOverride 仍最优先；与回归协议兼容（gap≥21 本周必 0 场→自然
// 序列头）；顺延模式下「跨周未完轮」打 carriedOverFromLastWeek dayReason（今日页
// 副句透明化：上周的 X 日顺延到今天）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class WeeklyCycleModeTests: XCTestCase {
    private func plan(historyDates: [String], today: String,
                      weeklyRestart: Bool, override: String? = nil) throws -> TodayPrescription? {
        // push-pull-legs 6 日序列区分度足；周计划 3 天配 owner 场景
        let json = TestSupport.appDataJSON(
            historyDates: historyDates,
            program: #"{"splitType": "push-pull-legs", "daysPerWeek": 3}"#)
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: today)
        let verdict = TodayVerdictEngine.evaluate(input)
        return TodayPrescriptionEngine.plan(
            input: input, verdict: verdict,
            dayCodeOverride: override, weeklyCycleRestart: weeklyRestart)
    }

    // owner 场景：上周（周一 6/29 起）练了推(6/29)拉(7/1)漏腿，本周三 7/8 打开
    func testOwnerScenarioCarryOverByDefault() throws {
        // 默认顺延：还推腿（index 2）+ 打 carriedOverFromLastWeek（副句透明化）
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-06-29", "2026-07-01"], today: "2026-07-08", weeklyRestart: false))
        XCTAssertEqual(p.dayCode, "legs-a")
        XCTAssertTrue(p.dayReasons.contains(.carriedOverFromLastWeek))
    }

    func testOwnerScenarioWeeklyRestartStartsFresh() throws {
        // 开启每周重开：新周从序列头（推）开始，不打顺延 reason
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-06-29", "2026-07-01"], today: "2026-07-08", weeklyRestart: true))
        XCTAssertEqual(p.dayCode, "push-a")
        XCTAssertFalse(p.dayReasons.contains(.carriedOverFromLastWeek))
    }

    func testWeeklyRestartCountsWithinCurrentWeek() throws {
        // 本周已练 2 场（7/6 周一、7/7）：weekly 模式今天 index 2（周内正常推进）
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-06-29", "2026-07-01", "2026-07-06", "2026-07-07"],
            today: "2026-07-08", weeklyRestart: true))
        XCTAssertEqual(p.dayCode, "legs-a")
    }

    func testCarryOverReasonAbsentWhenLastWeekComplete() throws {
        // 上周练满 3 场：跨周继续序列（index 3）但**不打**顺延 reason（没有「漏」）
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-06-29", "2026-07-01", "2026-07-03"],
            today: "2026-07-08", weeklyRestart: false))
        XCTAssertEqual(p.dayCode, "push-b")
        XCTAssertFalse(p.dayReasons.contains(.carriedOverFromLastWeek))
    }

    func testCarryOverReasonAbsentSameWeek() throws {
        // 同周内（7/6 练了推，7/8 打开）：正常序列推进，无顺延语境
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-07-06"], today: "2026-07-08", weeklyRestart: false))
        XCTAssertEqual(p.dayCode, "pull-a")
        XCTAssertFalse(p.dayReasons.contains(.carriedOverFromLastWeek))
    }

    func testOverrideBeatsWeeklyRestart() throws {
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-06-29", "2026-07-01"], today: "2026-07-08",
            weeklyRestart: true, override: "legs-b"))
        XCTAssertEqual(p.dayCode, "legs-b")
    }

    func testWeeklyRestartCompatibleWithComebackRestart() throws {
        // 停练 22 天 + weekly 模式：本周 0 场 → 自然序列头；comebackCycleRestart 照打
        let p = try XCTUnwrap(try plan(
            historyDates: ["2026-06-15", "2026-06-16"], today: "2026-07-08", weeklyRestart: true))
        XCTAssertEqual(p.dayCode, "push-a")
        XCTAssertTrue(p.dayReasons.contains(.comebackCycleRestart))
    }

    func testIsoWeekStartAnchors() {
        // 周一锚纯算术：2026-07-06 是周一；7/8（周三）与 7/5（周日）分属两周
        let monday = TrainingDay.dayNumber(fromISO: "2026-07-06")!
        XCTAssertEqual(TrainingDay.isoWeekStartDay(of: monday), monday)
        let wednesday = TrainingDay.dayNumber(fromISO: "2026-07-08")!
        XCTAssertEqual(TrainingDay.isoWeekStartDay(of: wednesday), monday)
        let sunday = TrainingDay.dayNumber(fromISO: "2026-07-05")!
        XCTAssertEqual(TrainingDay.isoWeekStartDay(of: sunday), monday - 7)
    }

    func testProjectionFirstSlotMatchesTodayInBothModes() throws {
        // 审查 S2 防再分叉锚：Plan 排期投影第一位必须 == 今日页 dayCode（两模式都锁）
        let json = TestSupport.appDataJSON(
            historyDates: ["2026-06-29", "2026-07-01"],
            program: #"{"splitType": "push-pull-legs", "daysPerWeek": 3}"#)
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-08")
        let verdict = TodayVerdictEngine.evaluate(input)
        for weekly in [false, true] {
            let p = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input, verdict: verdict, weeklyCycleRestart: weekly))
            let base = TodayPrescriptionEngine.rotationBase(
                input: input, verdict: verdict, rotationOffset: 0, weeklyCycleRestart: weekly)
            let projected = PlanWeekProjection.weeks(
                splitType: "push-pull-legs", daysPerWeek: 3,
                completedSessionCount: base, weeks: 1)
            XCTAssertEqual(projected.first?.first?.dayCode, p.dayCode,
                           "weekly=\(weekly) 投影第一位与今日页分叉")
        }
    }
}
