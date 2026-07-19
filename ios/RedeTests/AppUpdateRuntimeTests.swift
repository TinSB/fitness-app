import Observation
import RedeL10n
import XCTest
@testable import Rede

@MainActor
final class AppUpdateRuntimeTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testLookupDecoderAcceptsOnlyTheExpectedRedeRecord() throws {
        let valid = Data(#"""
        {
          "resultCount": 1,
          "results": [{
            "trackId": 6780301633,
            "bundleId": "com.tinsab.rede",
            "version": "1.9"
          }]
        }
        """#.utf8)

        XCTAssertEqual(
            try AppStoreLookupClient.decode(
                valid,
                expectedAppID: 6_780_301_633,
                expectedBundleID: "com.tinsab.rede"
            ),
            AppStoreRelease(version: "1.9")
        )

        let wrongBundle = Data(#"""
        {
          "resultCount": 1,
          "results": [{
            "trackId": 6780301633,
            "bundleId": "com.example.other",
            "version": "99.0"
          }]
        }
        """#.utf8)
        XCTAssertThrowsError(try AppStoreLookupClient.decode(
            wrongBundle,
            expectedAppID: 6_780_301_633,
            expectedBundleID: "com.tinsab.rede"
        ))

        let wrongID = Data(#"""
        {
          "resultCount": 1,
          "results": [{
            "trackId": 42,
            "bundleId": "com.tinsab.rede",
            "version": "1.9"
          }]
        }
        """#.utf8)
        XCTAssertThrowsError(try AppStoreLookupClient.decode(
            wrongID,
            expectedAppID: 6_780_301_633,
            expectedBundleID: "com.tinsab.rede"
        ))

        let malformedVersion = Data(#"""
        {
          "resultCount": 1,
          "results": [{
            "trackId": 6780301633,
            "bundleId": "com.tinsab.rede",
            "version": "1.beta"
          }]
        }
        """#.utf8)
        XCTAssertThrowsError(try AppStoreLookupClient.decode(
            malformedVersion,
            expectedAppID: 6_780_301_633,
            expectedBundleID: "com.tinsab.rede"
        ))

        let duplicateExactRecord = Data(#"""
        {
          "resultCount": 2,
          "results": [
            {"trackId": 6780301633, "bundleId": "com.tinsab.rede", "version": "1.9"},
            {"trackId": 6780301633, "bundleId": "com.tinsab.rede", "version": "1.9"}
          ]
        }
        """#.utf8)
        XCTAssertThrowsError(try AppStoreLookupClient.decode(
            duplicateExactRecord,
            expectedAppID: 6_780_301_633,
            expectedBundleID: "com.tinsab.rede"
        ))
    }

    func testLookupSessionRefusesEveryRedirect() throws {
        let delegate = AppStoreLookupRedirectDelegate()
        let session = URLSession(configuration: .ephemeral)
        let task = session.dataTask(with: try XCTUnwrap(URL(string: "https://itunes.apple.com/lookup?id=6780301633")))
        let response = try XCTUnwrap(HTTPURLResponse(
            url: try XCTUnwrap(task.originalRequest?.url),
            statusCode: 302,
            httpVersion: "HTTP/1.1",
            headerFields: ["Location": "https://example.com/lookup"]
        ))
        let redirectedRequest = URLRequest(url: try XCTUnwrap(URL(string: "https://example.com/lookup")))
        var requestToFollow: URLRequest? = redirectedRequest

        delegate.urlSession(
            session,
            task: task,
            willPerformHTTPRedirection: response,
            newRequest: redirectedRequest
        ) { requestToFollow = $0 }

        XCTAssertNil(requestToFollow)
        task.cancel()
        session.invalidateAndCancel()
    }

    func testAutomaticFailureIsSilentButManualFailureIsHonest() async {
        let receipts = TestAppUpdateReceipts()
        let model = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: FailingAppStoreClient(),
            receipts: receipts,
            now: { self.now },
            hasCurrentWhatsNew: true
        )

        await model.checkAutomatically()
        XCTAssertEqual(model.manualStatus, .idle)
        XCTAssertEqual(receipts.lastAutomaticAttemptAt, now)

        await model.checkManually()
        XCTAssertEqual(model.manualStatus, .failed)
        XCTAssertNil(model.promptVersion)
    }

    func testAutomaticAndManualTriggersShareOneInFlightRequest() async {
        let client = DelayedAppStoreClient(release: AppStoreRelease(version: "1.9"))
        let model = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: client,
            receipts: TestAppUpdateReceipts(),
            now: { self.now },
            hasCurrentWhatsNew: true
        )

        let automatic = Task { await model.checkAutomatically() }
        await client.waitUntilStarted()
        let manual = Task { await model.checkManually() }
        await Task.yield()

        let calls = await client.callCount()
        XCTAssertEqual(calls, 1)
        await client.releaseRequest()
        await automatic.value
        await manual.value

        XCTAssertEqual(model.promptVersion, "1.9")
        XCTAssertEqual(model.manualStatus, .updateAvailable(version: "1.9"))
    }

    func testManualThenAutomaticSharedRequestPreservesTheManualResult() async {
        let client = DelayedAppStoreClient(release: AppStoreRelease(version: "1.9"))
        let model = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: client,
            receipts: TestAppUpdateReceipts(),
            now: { self.now },
            hasCurrentWhatsNew: true
        )

        let manual = Task { await model.checkManually() }
        await client.waitUntilStarted()
        let automatic = Task { await model.checkAutomatically() }
        await Task.yield()

        let calls = await client.callCount()
        XCTAssertEqual(calls, 1)
        await client.releaseRequest()
        await manual.value
        await automatic.value

        XCTAssertEqual(model.promptVersion, "1.9")
        XCTAssertEqual(model.manualStatus, .updateAvailable(version: "1.9"))
    }

    func testManualCheckBypassesAutomaticThrottleAndRefreshesACachedVersion() async {
        let client = SequenceAppStoreClient(releases: [
            AppStoreRelease(version: "1.9"),
            AppStoreRelease(version: "1.10"),
        ])
        let receipts = TestAppUpdateReceipts()
        receipts.lastAutomaticAttemptAt = now
        let model = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: client,
            receipts: receipts,
            now: { self.now },
            hasCurrentWhatsNew: true
        )

        await model.checkManually()
        XCTAssertEqual(model.promptVersion, "1.9")

        await model.checkManually()
        XCTAssertEqual(model.promptVersion, "1.10")
        let calls = await client.callCount()
        XCTAssertEqual(calls, 2)
    }

    func testAutomaticSuccessInvalidatesAStaleManualResult() async {
        let client = SequenceAppStoreClient(releases: [
            AppStoreRelease(version: "1.8"),
            AppStoreRelease(version: "1.9"),
        ])
        let model = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: client,
            receipts: TestAppUpdateReceipts(),
            now: { self.now },
            hasCurrentWhatsNew: true
        )

        await model.checkManually()
        XCTAssertEqual(model.manualStatus, .upToDate)
        XCTAssertNil(model.promptVersion)

        await model.checkAutomatically()
        XCTAssertEqual(model.manualStatus, .idle)
        XCTAssertEqual(model.promptVersion, "1.9")
    }

    func testAutomaticResultOnlySupersedesManualStateWithoutOverlap() {
        XCTAssertTrue(AppUpdateModel.automaticResultMaySupersedeManualStatus(
            manualGenerationAtStart: 4,
            manualWasCheckingAtStart: false,
            currentManualGeneration: 4
        ))
        XCTAssertFalse(AppUpdateModel.automaticResultMaySupersedeManualStatus(
            manualGenerationAtStart: 4,
            manualWasCheckingAtStart: true,
            currentManualGeneration: 4
        ))
        XCTAssertFalse(AppUpdateModel.automaticResultMaySupersedeManualStatus(
            manualGenerationAtStart: 4,
            manualWasCheckingAtStart: false,
            currentManualGeneration: 5
        ))
    }

    func testLaterIsVersionScopedAndExpiresAfterSevenDays() async {
        let clock = TestClock(now)
        let model = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: ImmediateAppStoreClient(release: AppStoreRelease(version: "1.9")),
            receipts: TestAppUpdateReceipts(),
            now: { clock.value },
            hasCurrentWhatsNew: true
        )

        await model.checkManually()
        XCTAssertEqual(model.promptVersion, "1.9")

        model.snoozeAvailableUpdate()
        XCTAssertNil(model.promptVersion)

        clock.value = now.addingTimeInterval(7 * 24 * 60 * 60)
        XCTAssertEqual(model.promptVersion, "1.9")
    }

    func testLaterInvalidatesTheObservedPromptImmediately() async {
        let model = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: ImmediateAppStoreClient(release: AppStoreRelease(version: "1.9")),
            receipts: TestAppUpdateReceipts(),
            now: { self.now },
            hasCurrentWhatsNew: true
        )
        await model.checkManually()
        XCTAssertEqual(model.promptVersion, "1.9")

        let changed = expectation(description: "observed update prompt invalidated")
        withObservationTracking {
            _ = model.promptVersion
        } onChange: {
            changed.fulfill()
        }

        model.snoozeAvailableUpdate()
        await fulfillment(of: [changed], timeout: 0.2)
        XCTAssertNil(model.promptVersion)
    }

    func testWhatsNewSkipsFirstInstallAndAppearsOnceAfterAnUpgrade() {
        let firstInstallReceipts = TestAppUpdateReceipts()
        let firstInstall = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: ImmediateAppStoreClient(release: AppStoreRelease(version: "1.8")),
            receipts: firstInstallReceipts,
            now: { self.now },
            hasCurrentWhatsNew: true
        )
        firstInstall.prepareWhatsNew(isFirstInstall: true)
        XCTAssertFalse(firstInstall.shouldPresentWhatsNew)
        XCTAssertEqual(firstInstallReceipts.lastSeenWhatsNewVersion, "1.8")

        let upgradeReceipts = TestAppUpdateReceipts()
        let upgraded = AppUpdateModel(
            installedVersion: "1.8",
            build: "25",
            client: ImmediateAppStoreClient(release: AppStoreRelease(version: "1.8")),
            receipts: upgradeReceipts,
            now: { self.now },
            hasCurrentWhatsNew: true
        )
        upgraded.prepareWhatsNew(isFirstInstall: false)
        XCTAssertTrue(upgraded.shouldPresentWhatsNew)

        upgraded.markWhatsNewSeen()
        XCTAssertFalse(upgraded.shouldPresentWhatsNew)
        XCTAssertEqual(upgradeReceipts.lastSeenWhatsNewVersion, "1.8")

        upgraded.prepareWhatsNew(isFirstInstall: false)
        XCTAssertFalse(upgraded.shouldPresentWhatsNew)
    }

    func testCurrentRedeMarketingVersionHasBundledReleaseNotes() throws {
        let version = try XCTUnwrap(
            Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        )
        XCTAssertTrue(RedeAppUpdateRuntime.hasBundledWhatsNew(for: version), version)
        XCTAssertFalse(RedeStrings(locale: .zh).appUpdateHighlights(version: version).isEmpty, version)
        XCTAssertFalse(RedeStrings(locale: .en).appUpdateHighlights(version: version).isEmpty, version)
    }

    func testAppStoreURLMatchesApplesPublishedTrackDestination() {
        XCTAssertEqual(
            RedeAppUpdateRuntime.appStoreURL.absoluteString,
            "https://apps.apple.com/us/app/rede-strength/id6780301633?uo=4"
        )
    }
}

@MainActor
private final class TestAppUpdateReceipts: AppUpdateReceiptStoring {
    var lastAutomaticAttemptAt: Date?
    var snoozedVersion: String?
    var snoozedUntil: Date?
    var lastSeenWhatsNewVersion: String?
}

@MainActor
private final class TestClock {
    var value: Date
    init(_ value: Date) { self.value = value }
}

private struct ImmediateAppStoreClient: AppStoreVersionChecking {
    let release: AppStoreRelease
    func latestRelease() async throws -> AppStoreRelease { release }
}

private struct FailingAppStoreClient: AppStoreVersionChecking {
    struct Failure: Error {}
    func latestRelease() async throws -> AppStoreRelease { throw Failure() }
}

private actor DelayedAppStoreClient: AppStoreVersionChecking {
    private let release: AppStoreRelease
    private var calls = 0
    private var started = false
    private var continuation: CheckedContinuation<Void, Never>?

    init(release: AppStoreRelease) { self.release = release }

    func latestRelease() async throws -> AppStoreRelease {
        calls += 1
        started = true
        await withCheckedContinuation { continuation = $0 }
        return release
    }

    func waitUntilStarted() async {
        while !started { await Task.yield() }
    }

    func releaseRequest() {
        continuation?.resume()
        continuation = nil
    }

    func callCount() -> Int { calls }
}

private actor SequenceAppStoreClient: AppStoreVersionChecking {
    private let releases: [AppStoreRelease]
    private var calls = 0

    init(releases: [AppStoreRelease]) { self.releases = releases }

    func latestRelease() async throws -> AppStoreRelease {
        defer { calls += 1 }
        return releases[min(calls, releases.count - 1)]
    }

    func callCount() -> Int { calls }
}
