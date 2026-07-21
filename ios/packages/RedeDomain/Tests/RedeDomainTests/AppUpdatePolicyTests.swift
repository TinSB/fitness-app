import XCTest
@testable import RedeDomain

final class AppUpdatePolicyTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testMarketingVersionUsesNumericComponentsAndNormalizesTrailingZeroes() throws {
        let oneNine = try XCTUnwrap(AppMarketingVersion("1.9"))
        let oneTen = try XCTUnwrap(AppMarketingVersion("1.10"))
        let oneEight = try XCTUnwrap(AppMarketingVersion("1.8"))
        let oneEightZero = try XCTUnwrap(AppMarketingVersion("1.8.0"))

        XCTAssertLessThan(oneNine, oneTen)
        XCTAssertEqual(oneEight, oneEightZero)
        XCTAssertEqual(oneTen.displayValue, "1.10")
    }

    func testMarketingVersionRejectsValuesAppleCannotUseAsMarketingVersions() {
        for value in ["", "1.", ".1", "1.2.3.4", "1.beta", " 1.8", "1.8 ", "-1.8"] {
            XCTAssertNil(AppMarketingVersion(value), value)
        }
    }

    func testAvailabilityOnlyReportsAStrictlyNewerStoreVersion() {
        XCTAssertEqual(
            AppUpdatePolicy.availability(installedVersion: "1.9", storeVersion: "1.10"),
            .updateAvailable(version: "1.10")
        )
        XCTAssertEqual(
            AppUpdatePolicy.availability(installedVersion: "1.8", storeVersion: "1.8.0"),
            .upToDate
        )
        XCTAssertEqual(
            AppUpdatePolicy.availability(installedVersion: "2.0", storeVersion: "1.9"),
            .upToDate
        )
        XCTAssertEqual(
            AppUpdatePolicy.availability(installedVersion: "invalid", storeVersion: "1.9"),
            .unavailable
        )
    }

    func testAutomaticCheckUsesARollingTwentyFourHourBoundary() {
        XCTAssertTrue(AppUpdatePolicy.automaticCheckIsDue(lastAttemptAt: nil, now: now))
        XCTAssertFalse(AppUpdatePolicy.automaticCheckIsDue(
            lastAttemptAt: now.addingTimeInterval(-(24 * 60 * 60) + 1),
            now: now
        ))
        XCTAssertTrue(AppUpdatePolicy.automaticCheckIsDue(
            lastAttemptAt: now.addingTimeInterval(-(24 * 60 * 60)),
            now: now
        ))
        XCTAssertFalse(AppUpdatePolicy.automaticCheckIsDue(
            lastAttemptAt: now.addingTimeInterval(60),
            now: now
        ))
    }

    func testLaterSuppressesOnlyTheSameStoreVersionForSevenDays() {
        let snoozedUntil = now.addingTimeInterval(7 * 24 * 60 * 60)

        XCTAssertFalse(AppUpdatePolicy.shouldPresentUpdate(
            installedVersion: "1.8",
            storeVersion: "1.9",
            snoozedVersion: "1.9",
            snoozedUntil: snoozedUntil,
            now: now
        ))
        XCTAssertTrue(AppUpdatePolicy.shouldPresentUpdate(
            installedVersion: "1.8",
            storeVersion: "1.9",
            snoozedVersion: "1.9",
            snoozedUntil: snoozedUntil,
            now: snoozedUntil
        ))
        XCTAssertTrue(AppUpdatePolicy.shouldPresentUpdate(
            installedVersion: "1.8",
            storeVersion: "1.10",
            snoozedVersion: "1.9",
            snoozedUntil: snoozedUntil,
            now: now
        ))
    }
}
