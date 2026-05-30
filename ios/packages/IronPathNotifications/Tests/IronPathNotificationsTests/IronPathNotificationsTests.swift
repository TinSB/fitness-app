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
