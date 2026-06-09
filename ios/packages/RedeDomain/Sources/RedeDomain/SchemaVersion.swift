// SchemaVersion — iOS-2B AppData Swift Models V1.
//
// The current AppData schema version is 8, matching
// `retired web reference` (`STORAGE_VERSION = 8`). Swift refuses
// to decode payloads whose `schemaVersion` differs from the current,
// rather than silently downgrading or upgrading. iOS-3 owns the
// storage adapter and decides whether a refusal triggers a UI prompt.

import Foundation

public enum SchemaVersionError: Error, Equatable, Sendable {
    /// Incoming payload uses an older schemaVersion than the Swift
    /// binary supports. iOS-2B does not implement migration; the
    /// upgrade path is documented in Agent 1 §6 and lands in iOS-3.
    case upgradeRequired(found: Int)

    /// Incoming payload uses a newer schemaVersion than the Swift
    /// binary knows. Refuse to load — never silently downgrade.
    case futureIncompatible(found: Int)

    /// `schemaVersion` field is missing or not a number.
    case missingOrInvalid
}

public struct SchemaVersion: RawRepresentable, Equatable, Hashable, Sendable, Comparable {
    public let rawValue: Int

    public init(rawValue: Int) {
        self.rawValue = rawValue
    }

    public static let current: SchemaVersion = SchemaVersion(rawValue: 8)

    public static func < (lhs: SchemaVersion, rhs: SchemaVersion) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    /// Refuses any payload whose schemaVersion does not equal the
    /// current Swift target. Returns the validated version on success.
    public static func validate(found: Int) throws -> SchemaVersion {
        if found < current.rawValue {
            throw SchemaVersionError.upgradeRequired(found: found)
        }
        if found > current.rawValue {
            throw SchemaVersionError.futureIncompatible(found: found)
        }
        return current
    }
}
