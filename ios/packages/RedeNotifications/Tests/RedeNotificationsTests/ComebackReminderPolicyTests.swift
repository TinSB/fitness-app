// 批次 F（2026-07-10）：召回提醒策略。
// 语义锁：三档 5/12/21 天（21=回归协议重启线同源）@惯练中位小时；过期档跳过不迟发；
// 总开关/召回项关/无历史=空；档 1 带日名档 2/3 不带；无历史回退 19:00。

import Foundation
import XCTest
@testable import RedeNotifications

final class ComebackReminderPolicyTests: XCTestCase {
    private let utc = TimeZone(identifier: "UTC")!
    private let onPrefs = NotificationPreferences(
        masterEnabled: true, restEndEnabled: false, weeklyEnabled: false, comebackEnabled: true)

    private func date(_ iso: String) -> Date {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: iso)!
    }

    func testThreeTiersAtTypicalHourWithDayNameOnFirstOnly() {
        // 上次 7/1，历史都在 10 点（UTC）练 → 三档 7/6、7/13、7/22 各 10:00
        let out = ComebackReminderPolicy.comebackReminders(
            preferences: onPrefs,
            lastSessionISO: "2026-07-01",
            sessionStartISOs: ["2026-06-27T10:00:00Z", "2026-06-29T10:15:00Z", "2026-07-01T10:30:00Z"],
            nextDayName: "推 A",
            now: date("2026-07-01T12:00:00Z"),
            timeZone: utc)
        XCTAssertEqual(out.map(\.reminderId), ["comeback-5d", "comeback-12d", "comeback-21d"])
        XCTAssertEqual(out.map(\.messageCode), ["comeback_5d", "comeback_12d", "comeback_21d"])
        XCTAssertEqual(out[0].fireAt, date("2026-07-06T10:00:00Z"))
        XCTAssertEqual(out[1].fireAt, date("2026-07-13T10:00:00Z"))
        XCTAssertEqual(out[2].fireAt, date("2026-07-22T10:00:00Z"))
        XCTAssertEqual(out[0].dayName, "推 A")          // 档 1 带日名
        XCTAssertNil(out[1].dayName)                    // 档 2/3 不带（跨周易过期）
        XCTAssertNil(out[2].dayName)
    }

    func testExpiredTiersAreSkippedNotLate() {
        // 距上次已 8 天 → 5 天档过期跳过（不迟发），只剩 12/21 档
        let out = ComebackReminderPolicy.comebackReminders(
            preferences: onPrefs,
            lastSessionISO: "2026-07-01",
            sessionStartISOs: ["2026-07-01T10:00:00Z"],
            nextDayName: nil,
            now: date("2026-07-09T12:00:00Z"),
            timeZone: utc)
        XCTAssertEqual(out.map(\.reminderId), ["comeback-12d", "comeback-21d"])
    }

    func testTypicalHourMedianAndFallback() {
        XCTAssertEqual(ComebackReminderPolicy.typicalHour(
            sessionStartISOs: ["2026-07-01T06:00:00Z", "2026-07-02T19:00:00Z", "2026-07-03T20:00:00Z"],
            timeZone: utc), 19)                          // 中位数（非平均）
        XCTAssertEqual(ComebackReminderPolicy.typicalHour(sessionStartISOs: [], timeZone: utc), 19)
        XCTAssertEqual(ComebackReminderPolicy.typicalHour(
            sessionStartISOs: ["garbage"], timeZone: utc), 19)   // 坏数据回退
    }

    func testDisabledOrNoHistoryYieldsNothing() {
        let offMaster = NotificationPreferences(
            masterEnabled: false, restEndEnabled: true, weeklyEnabled: true, comebackEnabled: true)
        let offComeback = NotificationPreferences(
            masterEnabled: true, restEndEnabled: true, weeklyEnabled: true, comebackEnabled: false)
        for prefs in [offMaster, offComeback] {
            XCTAssertTrue(ComebackReminderPolicy.comebackReminders(
                preferences: prefs, lastSessionISO: "2026-07-01",
                sessionStartISOs: [], nextDayName: nil,
                now: date("2026-07-01T12:00:00Z"), timeZone: utc).isEmpty)
        }
        XCTAssertTrue(ComebackReminderPolicy.comebackReminders(
            preferences: onPrefs, lastSessionISO: nil,
            sessionStartISOs: [], nextDayName: nil,
            now: date("2026-07-01T12:00:00Z"), timeZone: utc).isEmpty)
    }

    func testManagedIdsCoverAllTiers() {
        XCTAssertEqual(ComebackReminderPolicy.managedComebackIds,
                       ["comeback-5d", "comeback-12d", "comeback-21d"])
        XCTAssertEqual(NotificationPreferences(
            masterEnabled: true, restEndEnabled: false, weeklyEnabled: false).comebackEnabled,
            true)   // 缺省开（opt-out 拍板）
    }
}
