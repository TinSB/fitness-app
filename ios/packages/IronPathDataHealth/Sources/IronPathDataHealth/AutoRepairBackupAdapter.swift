// AutoRepairBackupAdapter — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Backup contract that the orchestrator calls BEFORE any
// AppData-mutating repair. On `snapshot(...)` failure the
// orchestrator records `status == .backupFailed` ledger rows and
// returns without mutating AppData — the runtime guard remains active.
//
// iOS-3B ships:
//   * `AutoRepairBackupAdapter` protocol
//   * `AutoRepairBackupRecord` value type
//   * `InMemoryAutoRepairBackupAdapter` default impl (matches legacy web schema
//     `getDefaultAutoRepairBackupAdapter` fallback)
//
// iOS-3C/iOS-3D will wire a JSONFile-backed adapter through
// `IronPathPersistence.JSONFileAppDataStore`. This iOS-3B PR
// intentionally does NOT depend on Persistence for the default.
//
// legacy web schema counterpart: `retired web reference`.

import Foundation
import IronPathDomain

public enum AutoRepairBackupStorage: String, Equatable, Hashable, Sendable {
    case memory
    case indexeddb
    case localstorage
    case jsonFile = "json_file"
}

public struct AutoRepairBackupRecord: Equatable, Sendable {
    public let id: String
    public let createdAt: String
    public let triggeredBy: RepairTrigger
    public let appDataHashBefore: String
    public let repairIdScope: [String]
    public let payloadSize: Int
    public let storage: AutoRepairBackupStorage

    public init(
        id: String,
        createdAt: String,
        triggeredBy: RepairTrigger,
        appDataHashBefore: String,
        repairIdScope: [String],
        payloadSize: Int,
        storage: AutoRepairBackupStorage
    ) {
        self.id = id
        self.createdAt = createdAt
        self.triggeredBy = triggeredBy
        self.appDataHashBefore = appDataHashBefore
        self.repairIdScope = repairIdScope
        self.payloadSize = payloadSize
        self.storage = storage
    }
}

public struct AutoRepairBackupRequest: Sendable {
    public let appData: AppData
    public let triggeredBy: RepairTrigger
    public let appDataHashBefore: String
    public let repairIdScope: [String]

    public init(
        appData: AppData,
        triggeredBy: RepairTrigger,
        appDataHashBefore: String,
        repairIdScope: [String]
    ) {
        self.appData = appData
        self.triggeredBy = triggeredBy
        self.appDataHashBefore = appDataHashBefore
        self.repairIdScope = repairIdScope
    }
}

public enum AutoRepairBackupError: Error, Equatable, Sendable {
    case storageUnavailable(String)
    case encodeFailed(String)
}

public protocol AutoRepairBackupAdapter: Sendable {
    func snapshot(_ request: AutoRepairBackupRequest) throws -> AutoRepairBackupRecord
    func list() -> [AutoRepairBackupRecord]
}

// MARK: - In-memory default

/// Thread-safe in-memory adapter. Suitable for unit tests and as a
/// no-disk default in iOS-3B. iOS-3D will introduce a
/// JSONFileAppDataStore-backed adapter; this one stays as a
/// reference impl.
public final class InMemoryAutoRepairBackupAdapter: AutoRepairBackupAdapter, @unchecked Sendable {
    private let lock = NSLock()
    private var records: [(record: AutoRepairBackupRecord, payload: Data)] = []

    public init() {}

    public func snapshot(_ request: AutoRepairBackupRequest) throws -> AutoRepairBackupRecord {
        let payload: Data
        do {
            payload = try request.appData.canonicalJSONData()
        } catch {
            throw AutoRepairBackupError.encodeFailed("canonical encode failed: \(error)")
        }
        let stampFormatter = ISO8601DateFormatter()
        stampFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let now = Date()
        let ms = Int(now.timeIntervalSince1970 * 1000.0)
        let suffix = String(request.appDataHashBefore.suffix(8))
        let id = "ironpath_auto_repair_backup_\(ms)_\(suffix)"
        let record = AutoRepairBackupRecord(
            id: id,
            createdAt: stampFormatter.string(from: now),
            triggeredBy: request.triggeredBy,
            appDataHashBefore: request.appDataHashBefore,
            repairIdScope: request.repairIdScope,
            payloadSize: payload.count,
            storage: .memory
        )
        lock.lock()
        records.append((record, payload))
        lock.unlock()
        return record
    }

    public func list() -> [AutoRepairBackupRecord] {
        lock.lock()
        defer { lock.unlock() }
        return records.map { $0.record }
    }

    /// Test helper: clears all stored backups.
    public func clear() {
        lock.lock()
        records.removeAll()
        lock.unlock()
    }
}

/// A throwing adapter used by orchestrator tests to verify the
/// `backup_failed` fall-back path.
public struct ThrowingAutoRepairBackupAdapter: AutoRepairBackupAdapter {
    public let error: AutoRepairBackupError

    public init(error: AutoRepairBackupError = .storageUnavailable("test")) {
        self.error = error
    }

    public func snapshot(_ request: AutoRepairBackupRequest) throws -> AutoRepairBackupRecord {
        throw error
    }

    public func list() -> [AutoRepairBackupRecord] { [] }
}

/// Process-wide default. iOS-3B uses the in-memory adapter; iOS-3D
/// will install a JSONFile-backed adapter via DI.
public func defaultAutoRepairBackupAdapter() -> AutoRepairBackupAdapter {
    InMemoryAutoRepairBackupAdapter()
}
