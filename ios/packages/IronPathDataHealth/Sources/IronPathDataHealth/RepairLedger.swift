// RepairLedger — iOS-3A Data Health Runtime Foundation V1.
//
// Pure-value port of `src/dataHealth/appDataRepairLedger.ts`. Provides
// read/write/append for the `dataHealthRepairLedger` array that lives
// at `appData.settings.dataHealthRepairLedger`, plus the idempotency
// check and 24-hour summary helper.
//
// The ledger is append-only with a FIFO cap of
// `DataHealthConstants.ledgerMaxEntries` (1000). `writeLedger`
// returns a NEW AppData value with the rewritten settings; iOS-3A
// never mutates an existing AppData in place.

import Foundation
import IronPathDomain

public let appDataRepairLedgerSettingsKey = "dataHealthRepairLedger"

// MARK: - JSONValue codec for ledger entry

extension DataHealthRepairLedgerEntry {
    /// Encodes the entry as a JSON object suitable for round-tripping
    /// through `AppData.settings.dataHealthRepairLedger`.
    public func encoded() -> JSONValue {
        var entries: [OrderedJSONObject.Entry] = []
        entries.append(.init(key: "ledgerId", value: .string(ledgerId)))
        entries.append(.init(key: "repairId", value: .string(repairId)))
        entries.append(.init(key: "idempotencyKey", value: .string(idempotencyKey)))
        entries.append(.init(key: "appliedAt", value: .string(appliedAt)))
        entries.append(.init(key: "triggeredBy", value: .string(triggeredBy.rawValue)))
        entries.append(.init(key: "status", value: .string(status.rawValue)))
        entries.append(.init(key: "occurrences", value: .number(.integer(Int64(occurrences)))))
        entries.append(.init(key: "affectedIds", value: .array(affectedIds.map { .string($0) })))
        if let v = appDataHashBefore { entries.append(.init(key: "appDataHashBefore", value: .string(v))) }
        if let v = appDataHashAfter { entries.append(.init(key: "appDataHashAfter", value: .string(v))) }
        if let v = backupId { entries.append(.init(key: "backupId", value: .string(v))) }
        if let v = receiptId { entries.append(.init(key: "receiptId", value: .string(v))) }
        entries.append(.init(key: "warnings", value: .array(warnings.map { .string($0) })))
        return .object(OrderedJSONObject(entries: entries))
    }

    /// Returns nil if any required field is missing or the wrong shape.
    /// Unknown trigger / status values yield nil — matches the TS
    /// expectation that ledger rows be exactly schema-compliant.
    public init?(decoding value: JSONValue) {
        guard case .object(let obj) = value else { return nil }
        guard let ledgerId = obj["ledgerId"]?.stringValue,
              let repairId = obj["repairId"]?.stringValue,
              let idempotencyKey = obj["idempotencyKey"]?.stringValue,
              let appliedAt = obj["appliedAt"]?.stringValue,
              let triggeredByRaw = obj["triggeredBy"]?.stringValue,
              let triggeredBy = RepairTrigger(rawValue: triggeredByRaw),
              let statusRaw = obj["status"]?.stringValue,
              let status = RepairApplyStatus(rawValue: statusRaw),
              let occurrences = obj["occurrences"]?.intValue
        else { return nil }
        self.ledgerId = ledgerId
        self.repairId = repairId
        self.idempotencyKey = idempotencyKey
        self.appliedAt = appliedAt
        self.triggeredBy = triggeredBy
        self.status = status
        self.occurrences = occurrences
        self.affectedIds = obj["affectedIds"]?.arrayValue?.compactMap { $0.stringValue } ?? []
        self.appDataHashBefore = obj["appDataHashBefore"]?.stringValue
        self.appDataHashAfter = obj["appDataHashAfter"]?.stringValue
        self.backupId = obj["backupId"]?.stringValue
        self.receiptId = obj["receiptId"]?.stringValue
        self.warnings = obj["warnings"]?.arrayValue?.compactMap { $0.stringValue } ?? []
    }
}

// MARK: - Internal helpers

fileprivate extension OrderedJSONObject {
    /// Returns a new `OrderedJSONObject` with `key`'s value replaced
    /// (or appended at the end if the key is missing). Preserves the
    /// insertion order of all other keys.
    func settingKey(_ key: String, to value: JSONValue) -> OrderedJSONObject {
        var found = false
        let updated = entries.map { entry -> OrderedJSONObject.Entry in
            if entry.key == key {
                found = true
                return OrderedJSONObject.Entry(key: key, value: value)
            }
            return entry
        }
        if found { return OrderedJSONObject(entries: updated) }
        return OrderedJSONObject(entries: updated + [OrderedJSONObject.Entry(key: key, value: value)])
    }
}

// MARK: - Read / write / append

/// Returns the parsed ledger entries. Rows that fail to decode are
/// dropped silently — matches the TS contract of returning only well-
/// formed entries.
public func readLedger(_ appData: AppData) -> [DataHealthRepairLedgerEntry] {
    guard let array = appData.settings.dataHealthRepairLedger?.arrayValue else { return [] }
    return array.compactMap { DataHealthRepairLedgerEntry(decoding: $0) }
}

/// Returns a new AppData whose `settings.dataHealthRepairLedger` is
/// `entries`, FIFO-truncated to `DataHealthConstants.ledgerMaxEntries`.
/// `raw` AppData is untouched (Swift value semantics).
public func writeLedger(_ appData: AppData, _ entries: [DataHealthRepairLedgerEntry]) -> AppData {
    let cap = DataHealthConstants.ledgerMaxEntries
    let truncated: [DataHealthRepairLedgerEntry]
    if entries.count > cap {
        truncated = Array(entries.suffix(cap))
    } else {
        truncated = entries
    }
    let ledgerValue = JSONValue.array(truncated.map { $0.encoded() })

    let settingsObj: OrderedJSONObject
    if let v = appData.root["settings"], case .object(let obj) = v {
        settingsObj = obj
    } else {
        settingsObj = OrderedJSONObject()
    }
    let newSettings = settingsObj.settingKey(appDataRepairLedgerSettingsKey, to: ledgerValue)
    let newRoot = appData.root.settingKey("settings", to: .object(newSettings))
    return AppData(schemaVersion: appData.schemaVersion, root: newRoot)
}

/// Convenience: appends `entry` to the existing ledger and returns the
/// new AppData. Equivalent to `writeLedger(appData, readLedger(appData) + [entry])`.
public func appendLedgerEntry(
    _ appData: AppData,
    _ entry: DataHealthRepairLedgerEntry
) -> AppData {
    writeLedger(appData, readLedger(appData) + [entry])
}

// MARK: - Idempotency

/// True if a row exists in `ledger` for `repairId` + `idempotencyKey`
/// whose `appliedAt` falls within `windowHours` of `now` AND whose
/// status is `.applied` or `.noOp`.
public func isIdempotentMatch(
    _ ledger: [DataHealthRepairLedgerEntry],
    repairId: String,
    idempotencyKey: String,
    windowHours: Double = Double(DataHealthConstants.ledgerIdempotentWindowHours),
    now: Date = Date()
) -> Bool {
    let cutoff = now.addingTimeInterval(-windowHours * 3600.0)
    return ledger.contains { entry in
        guard entry.repairId == repairId,
              entry.idempotencyKey == idempotencyKey,
              entry.status == .applied || entry.status == .noOp,
              let applied = parseIsoDate(entry.appliedAt)
        else { return false }
        return applied >= cutoff
    }
}

// MARK: - Build helper

public struct BuildLedgerEntryParams {
    public let repairId: String
    public let idempotencyKey: String
    public let appliedAt: String
    public let triggeredBy: RepairTrigger
    public let status: RepairApplyStatus
    public let occurrences: Int
    public let affectedIds: [String]
    public let appDataHashBefore: String?
    public let appDataHashAfter: String?
    public let backupId: String?
    public let receiptId: String?
    public let warnings: [String]

    public init(
        repairId: String,
        idempotencyKey: String,
        appliedAt: String,
        triggeredBy: RepairTrigger,
        status: RepairApplyStatus,
        occurrences: Int,
        affectedIds: [String],
        appDataHashBefore: String? = nil,
        appDataHashAfter: String? = nil,
        backupId: String? = nil,
        receiptId: String? = nil,
        warnings: [String] = []
    ) {
        self.repairId = repairId
        self.idempotencyKey = idempotencyKey
        self.appliedAt = appliedAt
        self.triggeredBy = triggeredBy
        self.status = status
        self.occurrences = occurrences
        self.affectedIds = affectedIds
        self.appDataHashBefore = appDataHashBefore
        self.appDataHashAfter = appDataHashAfter
        self.backupId = backupId
        self.receiptId = receiptId
        self.warnings = warnings
    }
}

/// Mirrors TS `buildLedgerEntry`. `ledgerId` is composed as
/// `"{repairId}-{appliedAt}-{idempotencyKey[0..<8]}"`.
public func buildLedgerEntry(_ p: BuildLedgerEntryParams) -> DataHealthRepairLedgerEntry {
    let prefix = String(p.idempotencyKey.prefix(8))
    let ledgerId = "\(p.repairId)-\(p.appliedAt)-\(prefix)"
    return DataHealthRepairLedgerEntry(
        ledgerId: ledgerId,
        repairId: p.repairId,
        idempotencyKey: p.idempotencyKey,
        appliedAt: p.appliedAt,
        triggeredBy: p.triggeredBy,
        status: p.status,
        occurrences: p.occurrences,
        affectedIds: p.affectedIds,
        appDataHashBefore: p.appDataHashBefore,
        appDataHashAfter: p.appDataHashAfter,
        backupId: p.backupId,
        receiptId: p.receiptId,
        warnings: p.warnings
    )
}

// MARK: - Summary

public struct LedgerSummary: Equatable, Sendable {
    public let applied: Int
    public let noOp: Int
    public let failed: Int
    public let auditOnly: Int
    public let lastRunAt: String?

    public init(applied: Int, noOp: Int, failed: Int, auditOnly: Int, lastRunAt: String?) {
        self.applied = applied
        self.noOp = noOp
        self.failed = failed
        self.auditOnly = auditOnly
        self.lastRunAt = lastRunAt
    }
}

public func summarizeLedger(
    _ ledger: [DataHealthRepairLedgerEntry],
    withinHours: Double = Double(DataHealthConstants.ledgerIdempotentWindowHours),
    now: Date = Date()
) -> LedgerSummary {
    let cutoff = now.addingTimeInterval(-withinHours * 3600.0)
    var applied = 0
    var noOp = 0
    var failed = 0
    var auditOnly = 0
    var lastRunAt: String?
    var lastRunAtDate: Date?
    for entry in ledger {
        guard let at = parseIsoDate(entry.appliedAt), at >= cutoff else { continue }
        if let prev = lastRunAtDate {
            if at > prev {
                lastRunAtDate = at
                lastRunAt = entry.appliedAt
            }
        } else {
            lastRunAtDate = at
            lastRunAt = entry.appliedAt
        }
        switch entry.status {
        case .applied: applied += 1
        case .noOp: noOp += 1
        case .failed, .backupFailed: failed += 1
        case .skipped: auditOnly += 1
        }
    }
    return LedgerSummary(
        applied: applied,
        noOp: noOp,
        failed: failed,
        auditOnly: auditOnly,
        lastRunAt: lastRunAt
    )
}
