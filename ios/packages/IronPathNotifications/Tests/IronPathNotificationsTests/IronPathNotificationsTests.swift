// IronPathNotificationsTests — N-1 Local Rest-Timer Notification V1.
//
// Exercises the PURE scheduling policy with an injected clock (deterministic,
// no wall-clock), the role → recommended-rest mapping, and the seam contract via
// a host fake. The real `UserNotificationsRestReminderScheduler` is `#if os(iOS)`
// so it is not built on the macOS host test toolchain — these tests prove the
// scheduling logic without UserNotifications.

import XCTest
@testable import IronPathNotifications

final class IronPathNotificationsTests: XCTestCase {

    /// Deterministic reference instant (never the wall clock).
    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    func testVersionProbeIsBootstrapConstant() {
        XCTAssertEqual(IronPathNotificationsVersion.value, "0.0.1-bootstrap")
    }

    func testRecommendedRestSecondsByRole() {
        XCTAssertEqual(RestReminderPolicy.recommendedRestSeconds(exerciseRoleRawValue: "main-compound"), 180)
        XCTAssertEqual(RestReminderPolicy.recommendedRestSeconds(exerciseRoleRawValue: "secondary-compound"), 180)
        XCTAssertEqual(RestReminderPolicy.recommendedRestSeconds(exerciseRoleRawValue: "accessory"), 90)
        XCTAssertEqual(RestReminderPolicy.recommendedRestSeconds(exerciseRoleRawValue: "isolation"), 60)
        // Unknown rawValue defaults to the longer (compound) rest — never too short.
        XCTAssertEqual(RestReminderPolicy.recommendedRestSeconds(exerciseRoleRawValue: "mystery"), 180)
    }

    func testExerciseClassMapping() {
        XCTAssertEqual(RestReminderExerciseClass(exerciseRoleRawValue: "main-compound"), .compound)
        XCTAssertEqual(RestReminderExerciseClass(exerciseRoleRawValue: "secondary-compound"), .compound)
        XCTAssertEqual(RestReminderExerciseClass(exerciseRoleRawValue: "accessory"), .accessory)
        XCTAssertEqual(RestReminderExerciseClass(exerciseRoleRawValue: "isolation"), .isolation)
        XCTAssertEqual(RestReminderExerciseClass(exerciseRoleRawValue: "weird"), .compound)
    }

    func testMakeReminderComputesFireInstantFromInjectedNow() {
        let req = RestReminderPolicy.makeReminder(
            now: now, restSeconds: 120, exerciseName: "平板卧推", nextSetNumber: 2
        )
        XCTAssertNotNil(req)
        XCTAssertEqual(req?.secondsFromNow, 120)
        XCTAssertEqual(req?.fireDate, now.addingTimeInterval(120))
        XCTAssertEqual(req?.identifier, RestReminderPolicy.reminderIdentifier)
        XCTAssertTrue(req?.body.contains("平板卧推") ?? false)
        XCTAssertTrue(req?.body.contains("第 2 组") ?? false)
    }

    func testMakeReminderIsNilForNonPositiveRest() {
        XCTAssertNil(RestReminderPolicy.makeReminder(now: now, restSeconds: 0, exerciseName: "x", nextSetNumber: 1))
        XCTAssertNil(RestReminderPolicy.makeReminder(now: now, restSeconds: -30, exerciseName: "x", nextSetNumber: 1))
    }

    func testRoleConvenienceMakeReminder() {
        let req = RestReminderPolicy.makeReminder(
            now: now, exerciseRoleRawValue: "isolation", exerciseName: "二头弯举", nextSetNumber: 3
        )
        XCTAssertEqual(req?.secondsFromNow, 60)
        XCTAssertEqual(req?.fireDate, now.addingTimeInterval(60))
    }

    func testDurationTextFormatting() {
        XCTAssertEqual(RestReminderPolicy.durationText(180), "3 分钟")
        XCTAssertEqual(RestReminderPolicy.durationText(90), "1 分 30 秒")
        XCTAssertEqual(RestReminderPolicy.durationText(45), "45 秒")
    }

    func testSeamScheduleThenCancelViaFake() async throws {
        let fake = FakeRestReminderScheduler()
        let auth = await fake.requestAuthorization()
        XCTAssertEqual(auth, .authorized)

        let req = try XCTUnwrap(
            RestReminderPolicy.makeReminder(now: now, restSeconds: 90, exerciseName: "深蹲", nextSetNumber: 2)
        )
        try await fake.schedule(req)
        XCTAssertEqual(fake.pending, [req.identifier])

        // Re-scheduling the same identifier replaces, never duplicates.
        try await fake.schedule(req)
        XCTAssertEqual(fake.pending, [req.identifier])

        await fake.cancel(identifier: req.identifier)
        XCTAssertEqual(fake.pending, [])
    }

    // MARK: - N-2 Training Reminders (pure policy, injected time/calendar)

    func testTrainingIdentifierRoundTrip() {
        for weekday in 1...7 {
            let id = TrainingReminderPolicy.identifier(forWeekday: weekday)
            XCTAssertTrue(id.hasPrefix(TrainingReminderPolicy.identifierPrefix))
            XCTAssertEqual(TrainingReminderPolicy.weekday(fromIdentifier: id), weekday)
        }
        // Not ours / invalid → nil (never confused with the N-1 rest reminder).
        XCTAssertNil(TrainingReminderPolicy.weekday(fromIdentifier: RestReminderPolicy.reminderIdentifier))
        XCTAssertNil(TrainingReminderPolicy.weekday(fromIdentifier: "ironpath.local.training-reminder.0"))
        XCTAssertNil(TrainingReminderPolicy.weekday(fromIdentifier: "ironpath.local.training-reminder.8"))
        XCTAssertNil(TrainingReminderPolicy.weekday(fromIdentifier: "something.else"))
    }

    func testMakeRemindersForSelectedWeekdays() {
        let reminders = TrainingReminderPolicy.makeReminders(weekdays: [6, 2, 4], hour: 19, minute: 30)
        // De-duplicated + sorted ascending by weekday.
        XCTAssertEqual(reminders.map(\.weekday), [2, 4, 6])
        XCTAssertEqual(reminders.map(\.identifier), [
            TrainingReminderPolicy.identifier(forWeekday: 2),
            TrainingReminderPolicy.identifier(forWeekday: 4),
            TrainingReminderPolicy.identifier(forWeekday: 6),
        ])
        for reminder in reminders {
            XCTAssertEqual(reminder.hour, 19)
            XCTAssertEqual(reminder.minute, 30)
            XCTAssertEqual(reminder.title, "训练提醒")
            XCTAssertFalse(reminder.body.isEmpty)
        }
    }

    func testMakeRemindersValidatesInput() {
        // No valid weekday selected → nothing to schedule.
        XCTAssertEqual(TrainingReminderPolicy.makeReminders(weekdays: [], hour: 8, minute: 0).count, 0)
        // Out-of-range weekdays filtered out (only 1 valid remains).
        XCTAssertEqual(TrainingReminderPolicy.makeReminders(weekdays: [0, 3, 8], hour: 8, minute: 0).map(\.weekday), [3])
        // Out-of-range time → empty (never a fabricated reminder).
        XCTAssertEqual(TrainingReminderPolicy.makeReminders(weekdays: [3], hour: 24, minute: 0).count, 0)
        XCTAssertEqual(TrainingReminderPolicy.makeReminders(weekdays: [3], hour: 9, minute: 60).count, 0)
    }

    func testScheduleFromPendingReconstructs() {
        XCTAssertNil(TrainingReminderPolicy.schedule(fromPending: []))
        let pending = [
            PendingTrainingReminder(weekday: 4, hour: 19, minute: 30),
            PendingTrainingReminder(weekday: 2, hour: 19, minute: 30),
        ]
        let schedule = TrainingReminderPolicy.schedule(fromPending: pending)
        XCTAssertEqual(schedule?.weekdays, [2, 4])
        XCTAssertEqual(schedule?.hour, 19)
        XCTAssertEqual(schedule?.minute, 30)
        XCTAssertEqual(schedule?.isEmpty, false)
        // Invalid pending entries are dropped.
        XCTAssertNil(TrainingReminderPolicy.schedule(fromPending: [PendingTrainingReminder(weekday: 9, hour: 25, minute: 0)]))
    }

    func testNextFireDateIsDeterministicWithInjectedCalendar() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        // Fixed reference instant — never the wall clock.
        let now = Date(timeIntervalSince1970: 1_700_000_000)

        // A single selected weekday: next fire is strictly after `now`, lands on
        // that weekday at the requested time (in the injected calendar).
        let weekday = 4
        let next = try XCTUnwrap(
            TrainingReminderPolicy.nextFireDate(weekdays: [weekday], hour: 19, minute: 30, now: now, calendar: calendar)
        )
        XCTAssertGreaterThan(next, now)
        XCTAssertEqual(calendar.component(.weekday, from: next), weekday)
        XCTAssertEqual(calendar.component(.hour, from: next), 19)
        XCTAssertEqual(calendar.component(.minute, from: next), 30)

        // Multiple weekdays: the earliest single-weekday fire wins.
        let multi = TrainingReminderPolicy.nextFireDate(weekdays: [2, 4, 6], hour: 19, minute: 30, now: now, calendar: calendar)
        let singles = [2, 4, 6].compactMap {
            TrainingReminderPolicy.nextFireDate(weekdays: [$0], hour: 19, minute: 30, now: now, calendar: calendar)
        }
        XCTAssertEqual(multi, singles.min())

        // Nothing selected / invalid time → nil.
        XCTAssertNil(TrainingReminderPolicy.nextFireDate(weekdays: [], hour: 19, minute: 30, now: now, calendar: calendar))
        XCTAssertNil(TrainingReminderPolicy.nextFireDate(weekdays: [3], hour: 99, minute: 0, now: now, calendar: calendar))
    }

    func testTrainingSeamReplaceReadbackCancelViaFake() async throws {
        let fake = FakeTrainingReminderScheduler()
        let auth = await fake.requestAuthorization()
        XCTAssertEqual(auth, .authorized)
        let initial = await fake.pendingSchedule()
        XCTAssertNil(initial)

        try await fake.replaceReminders(
            TrainingReminderPolicy.makeReminders(weekdays: [2, 4], hour: 7, minute: 15)
        )
        let afterSaveOpt = await fake.pendingSchedule()
        let afterSave = try XCTUnwrap(afterSaveOpt)
        XCTAssertEqual(afterSave.weekdays, [2, 4])
        XCTAssertEqual(afterSave.hour, 7)
        XCTAssertEqual(afterSave.minute, 15)

        // Re-saving REPLACES (a de-selected weekday is dropped, never duplicated).
        try await fake.replaceReminders(
            TrainingReminderPolicy.makeReminders(weekdays: [4], hour: 7, minute: 15)
        )
        let afterReplaceOpt = await fake.pendingSchedule()
        let afterReplace = try XCTUnwrap(afterReplaceOpt)
        XCTAssertEqual(afterReplace.weekdays, [4])

        await fake.cancelAll()
        let afterCancel = await fake.pendingSchedule()
        XCTAssertNil(afterCancel)
    }
}

/// Host fake exercising the LOCAL-ONLY seam without UserNotifications.
private final class FakeRestReminderScheduler: RestReminderScheduling, @unchecked Sendable {
    private(set) var pending: [String] = []
    var authResult: RestReminderAuthorization = .authorized

    func requestAuthorization() async -> RestReminderAuthorization { authResult }

    func schedule(_ request: RestReminderRequest) async throws {
        pending.removeAll { $0 == request.identifier }
        pending.append(request.identifier)
    }

    func cancel(identifier: String) async {
        pending.removeAll { $0 == identifier }
    }
}

/// Host fake exercising the N-2 LOCAL-ONLY training-reminder seam without
/// UserNotifications. Mirrors the real adapter's contract (replace-all + read-back
/// via the pure policy + cancel-all) entirely in RAM.
private final class FakeTrainingReminderScheduler: TrainingReminderScheduling, @unchecked Sendable {
    private var pending: [TrainingReminderRequest] = []
    var authResult: RestReminderAuthorization = .authorized

    func requestAuthorization() async -> RestReminderAuthorization { authResult }

    func replaceReminders(_ requests: [TrainingReminderRequest]) async throws {
        pending = requests
    }

    func pendingSchedule() async -> TrainingReminderSchedule? {
        TrainingReminderPolicy.schedule(fromPending: pending.map {
            PendingTrainingReminder(weekday: $0.weekday, hour: $0.hour, minute: $0.minute)
        })
    }

    func cancelAll() async {
        pending = []
    }
}
