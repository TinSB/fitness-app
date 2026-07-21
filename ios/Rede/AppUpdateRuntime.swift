import Foundation
import Observation
import RedeDomain

struct AppStoreRelease: Equatable, Sendable {
    let version: String
}

protocol AppStoreVersionChecking: Sendable {
    func latestRelease() async throws -> AppStoreRelease
}

enum AppStoreLookupError: Error {
    case invalidEndpoint
    case invalidResponse
    case unexpectedRecord
}

/// The approved network boundary is one direct request to Apple's Lookup
/// endpoint. Refuse every redirect instead of silently widening the allowlist.
final class AppStoreLookupRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

/// The only general-network exception in Rede: one anonymous GET to Apple's
/// public catalog. It projects a version only; remote copy never reaches UI.
final class AppStoreLookupClient: AppStoreVersionChecking, @unchecked Sendable {
    private struct LookupResponse: Decodable {
        let results: [Record]
    }

    private struct Record: Decodable {
        let trackId: Int64
        let bundleId: String
        let version: String
    }

    private let appID: Int64
    private let bundleID: String
    private let session: URLSession

    init(
        appID: Int64 = 6_780_301_633,
        bundleID: String = "com.tinsab.rede",
        session: URLSession = AppStoreLookupClient.makeSession()
    ) {
        self.appID = appID
        self.bundleID = bundleID
        self.session = session
    }

    func latestRelease() async throws -> AppStoreRelease {
        var components = URLComponents(string: "https://itunes.apple.com/lookup")
        components?.queryItems = [URLQueryItem(name: "id", value: String(appID))]
        guard let url = components?.url, url.scheme == "https", url.host == "itunes.apple.com" else {
            throw AppStoreLookupError.invalidEndpoint
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 8

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              http.url == url,
              data.count <= 256 * 1_024 else {
            throw AppStoreLookupError.invalidResponse
        }
        return try Self.decode(data, expectedAppID: appID, expectedBundleID: bundleID)
    }

    static func decode(
        _ data: Data,
        expectedAppID: Int64,
        expectedBundleID: String
    ) throws -> AppStoreRelease {
        let response = try JSONDecoder().decode(LookupResponse.self, from: data)
        let matches = response.results.filter {
            $0.trackId == expectedAppID && $0.bundleId == expectedBundleID
        }
        guard matches.count == 1,
              let record = matches.first,
              AppMarketingVersion(record.version) != nil else {
            throw AppStoreLookupError.unexpectedRecord
        }
        return AppStoreRelease(version: record.version)
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 12
        configuration.waitsForConnectivity = false
        return URLSession(
            configuration: configuration,
            delegate: AppStoreLookupRedirectDelegate(),
            delegateQueue: nil
        )
    }
}

@MainActor
protocol AppUpdateReceiptStoring: AnyObject {
    var lastAutomaticAttemptAt: Date? { get set }
    var snoozedVersion: String? { get set }
    var snoozedUntil: Date? { get set }
    var lastSeenWhatsNewVersion: String? { get set }
}

@MainActor
final class UserDefaultsAppUpdateReceiptStore: AppUpdateReceiptStoring {
    private enum Key {
        static let prefix = "rede.update-awareness."
        static let lastAutomaticAttemptAt = prefix + "last-automatic-attempt-at"
        static let snoozedVersion = prefix + "snoozed-version"
        static let snoozedUntil = prefix + "snoozed-until"
        static let lastSeenWhatsNewVersion = prefix + "last-seen-whats-new-version"
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    var lastAutomaticAttemptAt: Date? {
        get { defaults.object(forKey: Key.lastAutomaticAttemptAt) as? Date }
        set { defaults.set(newValue, forKey: Key.lastAutomaticAttemptAt) }
    }

    var snoozedVersion: String? {
        get { defaults.string(forKey: Key.snoozedVersion) }
        set { defaults.set(newValue, forKey: Key.snoozedVersion) }
    }

    var snoozedUntil: Date? {
        get { defaults.object(forKey: Key.snoozedUntil) as? Date }
        set { defaults.set(newValue, forKey: Key.snoozedUntil) }
    }

    var lastSeenWhatsNewVersion: String? {
        get { defaults.string(forKey: Key.lastSeenWhatsNewVersion) }
        set { defaults.set(newValue, forKey: Key.lastSeenWhatsNewVersion) }
    }
}

enum ManualAppUpdateStatus: Equatable {
    case idle
    case checking
    case upToDate
    case updateAvailable(version: String)
    case failed
}

@MainActor
@Observable
final class AppUpdateModel {
    let installedVersion: String
    let build: String

    private(set) var manualStatus: ManualAppUpdateStatus = .idle
    private(set) var availableVersion: String?
    private(set) var shouldPresentWhatsNew = false

    private let client: any AppStoreVersionChecking
    private let receipts: any AppUpdateReceiptStoring
    private let now: () -> Date
    private let hasCurrentWhatsNew: Bool
    private let forceWhatsNew: Bool
    private var inFlight: Task<Result<AppStoreRelease, Error>, Never>?
    private var manualCheckGeneration: UInt64 = 0
    /// 收据本身不是 Observation 对象；递增此值让“稍后”后的提示立即失效并重绘。
    private var presentationRevision = 0

    init(
        installedVersion: String,
        build: String,
        client: any AppStoreVersionChecking,
        receipts: any AppUpdateReceiptStoring,
        now: @escaping () -> Date = Date.init,
        hasCurrentWhatsNew: Bool,
        forceWhatsNew: Bool = false
    ) {
        self.installedVersion = installedVersion
        self.build = build
        self.client = client
        self.receipts = receipts
        self.now = now
        self.hasCurrentWhatsNew = hasCurrentWhatsNew
        self.forceWhatsNew = forceWhatsNew
    }

    var promptVersion: String? {
        _ = presentationRevision
        guard let availableVersion,
              AppUpdatePolicy.shouldPresentUpdate(
                installedVersion: installedVersion,
                storeVersion: availableVersion,
                snoozedVersion: receipts.snoozedVersion,
                snoozedUntil: receipts.snoozedUntil,
                now: now()
              ) else { return nil }
        return availableVersion
    }

    func checkAutomatically() async {
        let attemptDate = now()
        guard AppUpdatePolicy.automaticCheckIsDue(
            lastAttemptAt: receipts.lastAutomaticAttemptAt,
            now: attemptDate
        ) else { return }

        let manualGenerationAtStart = manualCheckGeneration
        let manualWasCheckingAtStart = manualStatus == .checking

        // Record before suspension so concurrent foreground triggers cannot race
        // into a second request. A failed attempt is still throttled for 24h.
        receipts.lastAutomaticAttemptAt = attemptDate
        let result = await fetchRelease()
        apply(
            result,
            manual: false,
            maySupersedeManualStatus: Self.automaticResultMaySupersedeManualStatus(
                manualGenerationAtStart: manualGenerationAtStart,
                manualWasCheckingAtStart: manualWasCheckingAtStart,
                currentManualGeneration: manualCheckGeneration
            )
        )
    }

    func checkManually() async {
        manualCheckGeneration &+= 1
        let generation = manualCheckGeneration
        manualStatus = .checking
        let result = await fetchRelease()
        guard generation == manualCheckGeneration else { return }
        apply(result, manual: true)
    }

    static func automaticResultMaySupersedeManualStatus(
        manualGenerationAtStart: UInt64,
        manualWasCheckingAtStart: Bool,
        currentManualGeneration: UInt64
    ) -> Bool {
        !manualWasCheckingAtStart && manualGenerationAtStart == currentManualGeneration
    }

    func snoozeAvailableUpdate() {
        guard let availableVersion else { return }
        receipts.snoozedVersion = availableVersion
        receipts.snoozedUntil = now().addingTimeInterval(AppUpdatePolicy.snoozeInterval)
        presentationRevision &+= 1
    }

    func prepareWhatsNew(isFirstInstall: Bool) {
        if forceWhatsNew {
            shouldPresentWhatsNew = hasCurrentWhatsNew
            return
        }
        if isFirstInstall {
            receipts.lastSeenWhatsNewVersion = installedVersion
            shouldPresentWhatsNew = false
            return
        }
        shouldPresentWhatsNew = hasCurrentWhatsNew
            && receipts.lastSeenWhatsNewVersion != installedVersion
    }

    func showWhatsNewManually() {
        shouldPresentWhatsNew = hasCurrentWhatsNew
    }

    func markWhatsNewSeen() {
        receipts.lastSeenWhatsNewVersion = installedVersion
        shouldPresentWhatsNew = false
    }

    private func fetchRelease() async -> Result<AppStoreRelease, Error> {
        if let inFlight { return await inFlight.value }

        let client = self.client
        let task = Task<Result<AppStoreRelease, Error>, Never> {
            do { return .success(try await client.latestRelease()) }
            catch { return .failure(error) }
        }
        inFlight = task
        let result = await task.value
        inFlight = nil
        return result
    }

    private func apply(
        _ result: Result<AppStoreRelease, Error>,
        manual: Bool,
        maySupersedeManualStatus: Bool = false
    ) {
        switch result {
        case .failure:
            if manual { manualStatus = .failed }
        case .success(let release):
            // A newer successful automatic observation supersedes any stale
            // Settings receipt from an earlier manual check.
            if !manual && maySupersedeManualStatus { manualStatus = .idle }
            switch AppUpdatePolicy.availability(
                installedVersion: installedVersion,
                storeVersion: release.version
            ) {
            case .updateAvailable(let version):
                availableVersion = version
                if manual { manualStatus = .updateAvailable(version: version) }
            case .upToDate:
                availableVersion = nil
                if manual { manualStatus = .upToDate }
            case .unavailable:
                availableVersion = nil
                if manual { manualStatus = .failed }
            }
        }
    }
}

@MainActor
enum RedeAppUpdateRuntime {
    nonisolated static let appStoreURL = URL(string: "https://apps.apple.com/us/app/rede-strength/id6780301633?uo=4")!
    // 与 RedeL10n.appUpdateHighlights 的版本门同步维护（发版 bump 时两处同改；
    // 门禁 testCurrentRedeMarketingVersionHasBundledReleaseNotes 会抓漂移）。
    private static let bundledWhatsNewVersions: Set<String> = ["1.9.1"]

    static func hasBundledWhatsNew(for version: String) -> Bool {
        bundledWhatsNewVersions.contains(version)
    }

    static func makeModel(
        bundle: Bundle = .main,
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> AppUpdateModel {
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""

        let client: any AppStoreVersionChecking
        let receipts: any AppUpdateReceiptStoring
        #if DEBUG
        if let fixture = fixtureValue(arguments: arguments) {
            client = FixtureAppStoreVersionClient(fixture: fixture, currentVersion: version)
            receipts = VolatileAppUpdateReceiptStore()
        } else {
            client = AppStoreLookupClient()
            receipts = UserDefaultsAppUpdateReceiptStore()
        }
        #else
        client = AppStoreLookupClient()
        receipts = UserDefaultsAppUpdateReceiptStore()
        #endif

        return AppUpdateModel(
            installedVersion: version,
            build: build,
            client: client,
            receipts: receipts,
            hasCurrentWhatsNew: hasBundledWhatsNew(for: version),
            forceWhatsNew: arguments.contains("-forceWhatsNew")
        )
    }

    private static func fixtureValue(arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: "-appUpdateFixture"),
              arguments.indices.contains(index + 1) else { return nil }
        return arguments[index + 1]
    }
}

#if DEBUG
private struct FixtureAppStoreVersionClient: AppStoreVersionChecking {
    struct FixtureFailure: Error {}
    let fixture: String
    let currentVersion: String

    func latestRelease() async throws -> AppStoreRelease {
        switch fixture {
        case "available": return AppStoreRelease(version: "1.9")
        case "current": return AppStoreRelease(version: currentVersion)
        default: throw FixtureFailure()
        }
    }
}

@MainActor
private final class VolatileAppUpdateReceiptStore: AppUpdateReceiptStoring {
    var lastAutomaticAttemptAt: Date?
    var snoozedVersion: String?
    var snoozedUntil: Date?
    var lastSeenWhatsNewVersion: String?
}
#endif
