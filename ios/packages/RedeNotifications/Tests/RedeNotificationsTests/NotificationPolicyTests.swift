// FR-NT1/2 通知策略合同：偏好门控（总开关/分项/无效时长）+ typed 计划字段 + 每周固定 2 条 + 确定性。

import XCTest
@testable import RedeNotifications

final class NotificationPolicyTests: XCTestCase {
    private func prefs(master: Bool = true, rest: Bool = true, weekly: Bool = true) -> NotificationPreferences {
        NotificationPreferences(masterEnabled: master, restEndEnabled: rest, weeklyEnabled: weekly)
    }

    // MARK: FR-NT1 休息结束

    func testRestSchedulesWhenEnabled() {
        let plan = RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: 120, preferences: prefs())
        XCTAssertEqual(plan?.notificationId, "rest-end")
        XCTAssertEqual(plan?.fireAfterSeconds, 120)
        XCTAssertEqual(plan?.titleCode, "rest_end")
        XCTAssertEqual(plan?.bodyCode, "rest_end_body")
    }

    func testRestNilWhenMasterOff() {
        XCTAssertNil(RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: 120, preferences: prefs(master: false)))
    }

    func testRestNilWhenRestEndOff() {
        XCTAssertNil(RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: 120, preferences: prefs(rest: false)))
    }

    func testRestNilWhenNoRestDuration() {
        XCTAssertNil(RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: 0, preferences: prefs()))
        XCTAssertNil(RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: -5, preferences: prefs()))
    }

    func testCancelIdMatchesScheduleId() {
        XCTAssertEqual(RestNotificationPolicy.shouldCancelRestNotification(), RestNotificationPolicy.restNotificationId)
    }

    // MARK: FR-NT2 每周

    func testWeeklyTwoRemindersWhenEnabled() {
        let reminders = WeeklyTrainingReminderPolicy.weeklyReminders(preferences: prefs())
        XCTAssertEqual(reminders.map(\.reminderId), ["weekly-mon", "weekly-thu"])
        XCTAssertEqual(reminders.map(\.weekday), [2, 5], "周一=2、周四=5")
        XCTAssertEqual(reminders.map(\.messageCode), ["weekly_new_week", "weekly_keep_pace"])
        XCTAssertTrue(reminders.allSatisfy { (0...23).contains($0.hour) && (0...59).contains($0.minute) })
    }

    func testWeeklyEmptyWhenOff() {
        XCTAssertTrue(WeeklyTrainingReminderPolicy.weeklyReminders(preferences: prefs(master: false)).isEmpty)
        XCTAssertTrue(WeeklyTrainingReminderPolicy.weeklyReminders(preferences: prefs(weekly: false)).isEmpty)
    }

    func testDeterministic() {
        XCTAssertEqual(
            WeeklyTrainingReminderPolicy.weeklyReminders(preferences: prefs()),
            WeeklyTrainingReminderPolicy.weeklyReminders(preferences: prefs())
        )
        XCTAssertEqual(
            RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: 90, preferences: prefs()),
            RestNotificationPolicy.scheduleOnRestBegin(restSecondsPlanned: 90, preferences: prefs())
        )
    }
}
