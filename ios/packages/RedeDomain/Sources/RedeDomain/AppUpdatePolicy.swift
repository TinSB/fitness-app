import Foundation

/// App Store marketing version (`CFBundleShortVersionString`) with numeric,
/// one-to-three-component ordering. Presentation-only; never canonical data.
public struct AppMarketingVersion: Comparable, Hashable, Sendable {
    public let displayValue: String
    private let components: [Int]

    public init?(_ rawValue: String) {
        let parts = rawValue.split(separator: ".", omittingEmptySubsequences: false)
        guard (1...3).contains(parts.count) else { return nil }

        var parsed: [Int] = []
        parsed.reserveCapacity(3)
        for part in parts {
            guard !part.isEmpty,
                  part.unicodeScalars.allSatisfy({ (48...57).contains($0.value) }),
                  let value = Int(part) else { return nil }
            parsed.append(value)
        }
        while parsed.count < 3 { parsed.append(0) }

        displayValue = rawValue
        components = parsed
    }

    public static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.components == rhs.components
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(components)
    }

    public static func < (lhs: Self, rhs: Self) -> Bool {
        for (left, right) in zip(lhs.components, rhs.components) where left != right {
            return left < right
        }
        return false
    }
}

public enum AppUpdateAvailability: Equatable, Sendable {
    case updateAvailable(version: String)
    case upToDate
    case unavailable
}

public enum AppUpdatePolicy {
    public static let automaticCheckInterval: TimeInterval = 24 * 60 * 60
    public static let snoozeInterval: TimeInterval = 7 * 24 * 60 * 60

    public static func availability(
        installedVersion: String,
        storeVersion: String
    ) -> AppUpdateAvailability {
        guard let installed = AppMarketingVersion(installedVersion),
              let store = AppMarketingVersion(storeVersion) else {
            return .unavailable
        }
        guard installed < store else { return .upToDate }
        return .updateAvailable(version: store.displayValue)
    }

    public static func automaticCheckIsDue(lastAttemptAt: Date?, now: Date) -> Bool {
        guard let lastAttemptAt else { return true }
        return now.timeIntervalSince(lastAttemptAt) >= automaticCheckInterval
    }

    public static func shouldPresentUpdate(
        installedVersion: String,
        storeVersion: String,
        snoozedVersion: String?,
        snoozedUntil: Date?,
        now: Date
    ) -> Bool {
        guard case .updateAvailable = availability(
            installedVersion: installedVersion,
            storeVersion: storeVersion
        ) else { return false }

        guard let snoozedVersion,
              let snoozedUntil,
              let snoozed = AppMarketingVersion(snoozedVersion),
              let store = AppMarketingVersion(storeVersion),
              snoozed == store else {
            return true
        }
        return now >= snoozedUntil
    }
}
