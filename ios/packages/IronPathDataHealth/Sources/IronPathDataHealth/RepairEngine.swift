// RepairEngine — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Swift port of `src/dataHealth/appDataRepairEngine.ts:runRepair` +
// `appendDataRepairLog`. iOS-3A shipped the type skeleton; this file
// lands the engine that drives a single repair execution and appends
// its receipt to `settings.dataRepairLogs`.
//
// Cap policy: 500 dataRepairLogs entries (FIFO) — matches TS
// `MAX_DATA_REPAIR_LOG_ENTRIES` exactly.

import Foundation
import IronPathDomain

public let dataRepairLogsMaxEntries: Int = 500
public let dataRepairLogsSettingsKey: String = "dataRepairLogs"

public enum RepairEngineError: Error, Equatable, Sendable {
    case unknownRepairId(String)
}

/// Runs a single repair by ID against the given AppData. Returns
/// either `applied`, `no_op`, `skipped`, or `failed` per the recipe's
/// behaviour. Matches TS `runRepair`:
///   * audit-only (layer == audit_only OR supportsApply == false) →
///     skipped without calling apply
///   * else: detect first; if not detected, return no_op
///   * else: call apply, append receipt to settings.dataRepairLogs
public func runRepair(
    _ registry: RepairRegistry,
    _ appData: AppData,
    _ repairId: String,
    options: RepairApplyOptions? = nil
) throws -> RepairApplyResult {
    guard let definition = registry.get(repairId) else {
        throw RepairEngineError.unknownRepairId(repairId)
    }
    let repairedAt = options?.repairedAt ?? isoNow()

    // Audit-only short-circuit.
    if !definition.supportsApply || definition.layer == .auditOnly {
        let detect = definition.detect(appData)
        let receipt = buildReceipt(ReceiptParams(
            repairId: repairId,
            category: definition.category,
            action: definition.description,
            affectedIds: detect.affectedIds,
            beforeSummary: detect.detected ? "\(detect.occurrences) 项审计待人工确认" : "没有发现需要审计的数据",
            afterSummary: "未变更 AppData",
            repairedAt: repairedAt
        ))
        return RepairApplyResult(
            repairId: repairId,
            status: .skipped,
            repairedData: appData,
            receipt: receipt,
            warnings: ["audit-only repair: no mutation performed"]
        )
    }

    // Detect first.
    let detect = definition.detect(appData)
    if !detect.detected {
        let receipt = buildReceipt(ReceiptParams(
            repairId: repairId,
            category: definition.category,
            action: definition.description,
            affectedIds: [],
            beforeSummary: "检测未发现需要修复的数据",
            afterSummary: "未变更 AppData",
            repairedAt: repairedAt
        ))
        return RepairApplyResult(
            repairId: repairId,
            status: .noOp,
            repairedData: appData,
            receipt: receipt,
            warnings: []
        )
    }

    // Apply, then append receipt to dataRepairLogs.
    let result = try definition.apply(appData, options: options)
    let repairedWithLog = appendDataRepairLog(result.repairedData, receipt: result.receipt)
    return RepairApplyResult(
        repairId: result.repairId,
        status: result.status,
        repairedData: repairedWithLog,
        receipt: result.receipt,
        warnings: result.warnings,
        appDataHashBefore: result.appDataHashBefore,
        appDataHashAfter: result.appDataHashAfter
    )
}

/// Appends `receipt` to `settings.dataRepairLogs`, FIFO-truncated to
/// `dataRepairLogsMaxEntries`. Mirrors TS `appendDataRepairLog`.
public func appendDataRepairLog(_ appData: AppData, receipt: JSONValue) -> AppData {
    var existing: [JSONValue] = appData.settings.dataRepairLogs?.arrayValue ?? []
    existing.append(receipt)
    if existing.count > dataRepairLogsMaxEntries {
        existing = Array(existing.suffix(dataRepairLogsMaxEntries))
    }
    let logsValue = JSONValue.array(existing)
    let settingsObj: OrderedJSONObject
    if let v = appData.root["settings"], case .object(let obj) = v {
        settingsObj = obj
    } else {
        settingsObj = OrderedJSONObject()
    }
    let newSettings = upsertKey(settingsObj, dataRepairLogsSettingsKey, to: logsValue)
    let newRoot = upsertKey(appData.root, "settings", to: .object(newSettings))
    return AppData(schemaVersion: appData.schemaVersion, root: newRoot)
}

/// Read-only accessor for tests + iOS-3C use.
public func readDataRepairLogs(_ appData: AppData) -> [JSONValue] {
    appData.settings.dataRepairLogs?.arrayValue ?? []
}
