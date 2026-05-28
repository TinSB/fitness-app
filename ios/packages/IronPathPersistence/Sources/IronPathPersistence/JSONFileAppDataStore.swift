// JSONFileAppDataStore — iOS-3A Data Health Runtime Foundation V1.
//
// Atomic JSON-snapshot-on-disk implementation of `AppDataStore`. iOS-3A
// wires the contract; iOS-3B repair-apply and iOS-7 cloud-sync will
// drive it. The file format is the canonical AppData JSON emitted by
// `AppData.canonicalJSONData()` (Agent 5 §3.5) so a snapshot hash
// computed before save matches the bytes actually on disk.
//
// Atomic write contract: `Data.write(..., options: [.atomic])` on
// Foundation writes to a sibling temp file and `rename(2)`s into
// place. A mid-write crash therefore leaves the prior payload
// intact. Tests in `JSONFileAppDataStoreTests` exercise the round
// trip on a temp directory inside `FileManager.default
// .temporaryDirectory`.

import Foundation
import IronPathDomain

public struct JSONFileAppDataStore: AppDataStore {
    public let url: URL

    public init(url: URL) {
        self.url = url
    }

    /// Convenience: build a store rooted in `directory` with the given
    /// `filename`. Creates the directory lazily on first save.
    public init(directory: URL, filename: String = "ironpath-appdata.json") {
        self.url = directory.appendingPathComponent(filename, isDirectory: false)
    }

    public var hasExistingFile: Bool {
        FileManager.default.fileExists(atPath: url.path)
    }

    public func load() throws -> AppData {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw AppDataStoreError.fileMissing(url.path)
        }
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw AppDataStoreError.readFailed("\(error)")
        }
        do {
            return try AppData(decoding: data)
        } catch let e as SchemaVersionError {
            throw AppDataStoreError.schemaInvalid(String(describing: e))
        } catch {
            throw AppDataStoreError.decodeFailed(String(describing: error))
        }
    }

    public func save(_ appData: AppData) throws {
        let data: Data
        do {
            data = try appData.canonicalJSONData()
        } catch {
            throw AppDataStoreError.writeFailed("canonical encode failed: \(error)")
        }
        let directory = url.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
            try data.write(to: url, options: [.atomic])
        } catch {
            throw AppDataStoreError.writeFailed("\(error)")
        }
    }

    @discardableResult
    public func backup() throws -> URL {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw AppDataStoreError.backupFailed("no source file at \(url.path)")
        }
        let stampFormatter = ISO8601DateFormatter()
        stampFormatter.formatOptions = [.withInternetDateTime]
        let stamp = stampFormatter
            .string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
        let backupURL = url
            .deletingLastPathComponent()
            .appendingPathComponent("\(url.lastPathComponent).backup-\(stamp)", isDirectory: false)
        do {
            try FileManager.default.copyItem(at: url, to: backupURL)
            return backupURL
        } catch {
            throw AppDataStoreError.backupFailed("\(error)")
        }
    }
}
