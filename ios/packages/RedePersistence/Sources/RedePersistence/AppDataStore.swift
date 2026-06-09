// AppDataStore — iOS-3A Data Health Runtime Foundation V1.
//
// Protocol abstracting AppData persistence. iOS-3A ships:
//   * the protocol contract (this file)
//   * a JSON-snapshot-on-disk concrete implementation
//     (`JSONFileAppDataStore.swift`)
//
// iOS-3B will use this protocol to drive the repair-apply pipeline
// (load → snapshot → backup → apply → save). iOS-7 cloud sync will
// add a CloudKit-backed implementation alongside the JSON file one.
//
// Hard prohibitions for iOS-3A:
//   * NO SwiftData
//   * NO CoreData
//   * NO `@Model` / `@Observable`
//   * NO third-party persistence SwiftPM dependency

import Foundation
import RedeDomain

public enum AppDataStoreError: Error, Equatable, Sendable {
    case storageUnavailable(String)
    case fileMissing(String)
    case readFailed(String)
    case writeFailed(String)
    case decodeFailed(String)
    case backupFailed(String)
    case schemaInvalid(String)
}

public protocol AppDataStore: Sendable {
    /// True if the underlying storage already holds an AppData payload.
    /// Used by the iOS-3B boot flow to decide between "fresh install"
    /// and "load existing".
    var hasExistingFile: Bool { get }

    /// Reads and decodes the AppData. Throws
    /// `AppDataStoreError.fileMissing` if no payload exists,
    /// `AppDataStoreError.schemaInvalid` when the schemaVersion guard
    /// refuses the payload, and `.decodeFailed` for any other parse
    /// failure.
    func load() throws -> AppData

    /// Atomically writes the canonical JSON form of `appData` to
    /// storage. Implementations MUST guarantee that a crash mid-write
    /// leaves the previous payload intact.
    func save(_ appData: AppData) throws

    /// Snapshots the current on-disk payload to a backup file and
    /// returns the backup URL. Used by iOS-3B repair-apply before
    /// risky rewrites. Throws if no payload exists to back up.
    @discardableResult
    func backup() throws -> URL
}
