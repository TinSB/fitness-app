// JSONFileAutoRepairBackupAdapter — iOS-3C JSON-file-backed backup adapter.
//
// Persists each `snapshot(...)` payload as an atomic JSON file under
// the configured directory. iOS-3B's `InMemoryAutoRepairBackupAdapter`
// stays as the default; iOS-3C adds this file-backed option for
// production-like flows.
//
// Lives in IronPathDataHealth (NOT IronPathPersistence) to keep the
// package graph acyclic. Uses `FileManager.default` directly — no
// Persistence dependency.
//
// File naming: `ironpath_auto_repair_backup_<ms>_<hashSuffix>.json`.
// Atomic write via `Data.write(..., options: [.atomic])`.

import Foundation
import IronPathDomain

public struct JSONFileAutoRepairBackupAdapter: AutoRepairBackupAdapter {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    public func snapshot(_ request: AutoRepairBackupRequest) throws -> AutoRepairBackupRecord {
        let payload: Data
        do {
            payload = try request.appData.canonicalJSONData()
        } catch {
            throw AutoRepairBackupError.encodeFailed("canonical encode failed: \(error)")
        }
        // Ensure directory exists. Failure here is a storage error.
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true
            )
        } catch {
            throw AutoRepairBackupError.storageUnavailable("create directory failed: \(error)")
        }

        let stampFormatter = ISO8601DateFormatter()
        stampFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = Date()
        let ms = Int(now.timeIntervalSince1970 * 1000.0)
        let hashSuffix = String(request.appDataHashBefore.suffix(8))
        let id = "ironpath_auto_repair_backup_\(ms)_\(hashSuffix)"
        let fileURL = directory.appendingPathComponent("\(id).json", isDirectory: false)
        do {
            try payload.write(to: fileURL, options: [.atomic])
        } catch {
            throw AutoRepairBackupError.storageUnavailable("write failed: \(error)")
        }
        return AutoRepairBackupRecord(
            id: id,
            createdAt: stampFormatter.string(from: now),
            triggeredBy: request.triggeredBy,
            appDataHashBefore: request.appDataHashBefore,
            repairIdScope: request.repairIdScope,
            payloadSize: payload.count,
            storage: .jsonFile
        )
    }

    /// Enumerates the backup directory and rebuilds records by
    /// parsing the filename convention. Returned records have
    /// `triggeredBy` defaulted to `.boot` and `repairIdScope = []` —
    /// those fields are not encoded in the filename. Callers that
    /// need the canonical record should pair `list()` with their own
    /// out-of-band metadata.
    public func list() -> [AutoRepairBackupRecord] {
        guard let entries = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }

        var records: [AutoRepairBackupRecord] = []
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        for url in entries {
            let name = url.deletingPathExtension().lastPathComponent
            guard name.hasPrefix("ironpath_auto_repair_backup_") else { continue }
            guard let record = parseRecord(fromName: name, url: url, formatter: isoFormatter) else { continue }
            records.append(record)
        }
        return records
    }

    private func parseRecord(
        fromName name: String,
        url: URL,
        formatter: ISO8601DateFormatter
    ) -> AutoRepairBackupRecord? {
        // Expected: ironpath_auto_repair_backup_<ms>_<hashSuffix>
        let parts = name.split(separator: "_")
        guard parts.count >= 6 else { return nil }
        let hashSuffix = String(parts[parts.count - 1])
        let createdAt: String
        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
           let modDate = attrs[.modificationDate] as? Date {
            createdAt = formatter.string(from: modDate)
        } else {
            createdAt = formatter.string(from: Date())
        }
        let size: Int
        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
           let s = attrs[.size] as? NSNumber {
            size = s.intValue
        } else {
            size = 0
        }
        return AutoRepairBackupRecord(
            id: name,
            createdAt: createdAt,
            triggeredBy: .boot,
            appDataHashBefore: "appdata_unknown_\(hashSuffix)",
            repairIdScope: [],
            payloadSize: size,
            storage: .jsonFile
        )
    }
}
