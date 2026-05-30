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

extension JSONFileAppDataStore {
    /// The sanctioned canonical-AppData store rooted in the app sandbox's
    /// Application Support — NOT iCloud, NOT a shared container. This is the
    /// SECOND sanctioned local JSON store (§12), alongside the IronPathLocalSnapshot
    /// Focus-history store; it lives in its own `IronPathAppData/` subdirectory and
    /// holds a DISTINCT file, so the two stores never collide. The directory is
    /// created lazily on first save (this factory does not touch disk for IO). On
    /// the near-impossible failure to resolve Application Support, it falls back to
    /// the temporary directory so app construction never crashes; a real write
    /// failure there still THROWS honestly at save time (no fake success).
    public static func applicationSupport(
        filename: String = "ironpath-appdata.json"
    ) -> JSONFileAppDataStore {
        let base = (try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        )) ?? FileManager.default.temporaryDirectory
        let directory = base.appendingPathComponent("IronPathAppData", isDirectory: true)
        return JSONFileAppDataStore(directory: directory, filename: filename)
    }
}
