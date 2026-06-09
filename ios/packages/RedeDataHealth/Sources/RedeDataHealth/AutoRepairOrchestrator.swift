// AutoRepairOrchestrator — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Swift port of `retired web reference`.
//
// Flow (matches legacy web schema reference):
//   1. Compute appDataHashBefore.
//   2. Detect across safe_auto definitions; collect repairs to apply.
//   3. Detect across audit_only definitions; collect audit findings.
//   4. If nothing to apply → write summary, return unchanged.
//   5. Try backupAdapter.snapshot. On failure → write backup_failed
//      ledger rows, NEVER mutate AppData, return.
//   6. For each repair: idempotency check → runRepair → post-detect
//      check → append ledger entry.
//   7. Write summary, return.

import Foundation
import RedeDomain

private let dataHealthAutoRepairSummarySettingsKey = "dataHealthAutoRepairSummary"

public struct AuditFinding: Equatable, Sendable {
    public let repairId: String
    public let occurrences: Int
    public let affectedIds: [String]
    public let userMessage: String

    public init(
        repairId: String,
        occurrences: Int,
        affectedIds: [String],
        userMessage: String
    ) {
        self.repairId = repairId
        self.occurrences = occurrences
        self.affectedIds = affectedIds
        self.userMessage = userMessage
    }
}

public struct AutoRepairOrchestratorInput: Sendable {
    public let appData: AppData
    public let triggeredBy: RepairTrigger
    public let registry: RepairRegistry?
    public let backupAdapter: AutoRepairBackupAdapter?
    public let clock: RuntimeGuardClock

    public init(
        appData: AppData,
        triggeredBy: RepairTrigger,
        registry: RepairRegistry? = nil,
        backupAdapter: AutoRepairBackupAdapter? = nil,
        clock: RuntimeGuardClock = SystemRuntimeGuardClock()
    ) {
        self.appData = appData
        self.triggeredBy = triggeredBy
        self.registry = registry
        self.backupAdapter = backupAdapter
        self.clock = clock
    }
}

public struct AutoRepairOrchestratorResult: Sendable {
    public let appData: AppData
    public let changed: Bool
    public let results: [RepairApplyResult]
    public let auditFindings: [AuditFinding]
    public let backup: AutoRepairBackupRecord?
    public let appDataHashBefore: String
    public let appDataHashAfter: String
    public let summary: DataHealthAutoRepairSummary
    public let warnings: [String]

    public init(
        appData: AppData,
        changed: Bool,
        results: [RepairApplyResult],
        auditFindings: [AuditFinding],
        backup: AutoRepairBackupRecord?,
        appDataHashBefore: String,
        appDataHashAfter: String,
        summary: DataHealthAutoRepairSummary,
        warnings: [String]
    ) {
        self.appData = appData
        self.changed = changed
        self.results = results
        self.auditFindings = auditFindings
        self.backup = backup
        self.appDataHashBefore = appDataHashBefore
        self.appDataHashAfter = appDataHashAfter
        self.summary = summary
        self.warnings = warnings
    }
}

public func runAutoRepairOrchestrator(
    _ input: AutoRepairOrchestratorInput
) throws -> AutoRepairOrchestratorResult {
    let registry = input.registry ?? safeRepairRegistry()
    let backupAdapter = input.backupAdapter ?? defaultAutoRepairBackupAdapter()
    let clock = input.clock

    let appDataHashBefore = computeAppDataHash(input.appData)
    let safeAutoDefinitions = registry.byLayer(.safeAuto)
    let auditDefinitions = registry.byLayer(.auditOnly)

    // 1. Collect safe_auto candidates whose detect == true.
    struct ApplyCandidate {
        let definition: any RepairDefinition
        let occurrences: Int
        let affectedIds: [String]
    }
    var repairsToApply: [ApplyCandidate] = []
    for definition in safeAutoDefinitions {
        let detect = definition.detect(input.appData)
        if !detect.detected { continue }
        repairsToApply.append(ApplyCandidate(
            definition: definition,
            occurrences: detect.occurrences,
            affectedIds: detect.affectedIds
        ))
    }

    // 2. Collect audit_only findings.
    let auditFindings: [AuditFinding] = auditDefinitions
        .map { $0.detect(input.appData) }
        .filter { $0.detected }
        .map { AuditFinding(
            repairId: $0.repairId,
            occurrences: $0.occurrences,
            affectedIds: $0.affectedIds,
            userMessage: $0.userMessage
        )}

    // 3. Nothing to apply → summary-only return.
    if repairsToApply.isEmpty {
        let ledger = readLedger(input.appData)
        let summary = buildSummary(
            ledger: ledger,
            auditCount: auditFindings.count,
            triggeredBy: input.triggeredBy,
            backupId: nil,
            now: clock.now()
        )
        return AutoRepairOrchestratorResult(
            appData: writeSummary(input.appData, summary: summary),
            changed: false,
            results: [],
            auditFindings: auditFindings,
            backup: nil,
            appDataHashBefore: appDataHashBefore,
            appDataHashAfter: appDataHashBefore,
            summary: summary,
            warnings: []
        )
    }

    // 4. Backup-first. On failure → return UNCHANGED AppData.
    //
    // iOS-3B safety divergence from legacy web schema source: on backup failure we
    // do NOT persist anything to AppData — no ledger entries, no
    // summary write, no receipt. The legacy web schema implementation appends
    // `backup_failed` ledger rows and a summary blob to
    // `settings.dataHealthRepairLedger` / `.dataHealthAutoRepairSummary`
    // so the next run can see "we tried last time"; the user's safety
    // brief instead requires backup_failed to leave AppData strictly
    // unchanged, with the diagnostic surfaced only via the result
    // struct's `summary` + `warnings` + (the empty) `results` fields.
    //
    // Rationale: persisting a half-repaired state on a backup failure
    // can pollute idempotency-key matching in later runs and make
    // recovery harder. Leaving AppData byte-equal is the safest stance
    // when we couldn't guarantee a rollback.
    let backup: AutoRepairBackupRecord
    do {
        backup = try backupAdapter.snapshot(AutoRepairBackupRequest(
            appData: input.appData,
            triggeredBy: input.triggeredBy,
            appDataHashBefore: appDataHashBefore,
            repairIdScope: repairsToApply.map { $0.definition.repairId }
        ))
    } catch {
        let stampedAt = isoNow(clock)
        let backupFailedKey = "backup-failed-\(appDataHashBefore)"
        // Build diagnostic-only ledger entries. These are NOT
        // appended to AppData; they live only in the LedgerSummary
        // computation feed below.
        var diagnosticLedgerEntries: [DataHealthRepairLedgerEntry] = []
        for candidate in repairsToApply {
            let entry = buildLedgerEntry(BuildLedgerEntryParams(
                repairId: candidate.definition.repairId,
                idempotencyKey: backupFailedKey,
                appliedAt: stampedAt,
                triggeredBy: input.triggeredBy,
                status: .backupFailed,
                occurrences: candidate.occurrences,
                affectedIds: candidate.affectedIds,
                appDataHashBefore: appDataHashBefore,
                warnings: ["backup adapter rejected; runtime guard remains active"]
            ))
            diagnosticLedgerEntries.append(entry)
        }
        let combinedLedger = readLedger(input.appData) + diagnosticLedgerEntries
        let summary = buildSummary(
            ledger: combinedLedger,
            auditCount: auditFindings.count,
            triggeredBy: input.triggeredBy,
            backupId: nil,
            now: clock.now()
        )
        return AutoRepairOrchestratorResult(
            appData: input.appData,  // CRITICAL: AppData UNCHANGED.
            changed: false,
            results: [],
            auditFindings: auditFindings,
            backup: nil,
            appDataHashBefore: appDataHashBefore,
            appDataHashAfter: appDataHashBefore,
            summary: summary,
            warnings: [
                "backup_failed: no mutation performed; Runtime Guard still protects recommendation",
                "backup_failed: AppData byte-equal to input; ledger/summary diagnostics live only in the result struct",
            ]
        )
    }

    // 5. Apply loop.
    var working = input.appData
    var results: [RepairApplyResult] = []
    var warnings: [String] = []
    let nowDate = clock.now()
    let nowIso = isoNow(clock)

    for candidate in repairsToApply {
        let ledger = readLedger(working)
        let dryRun = candidate.definition.dryRun(working)
        let alreadyApplied = isIdempotentMatch(
            ledger,
            repairId: candidate.definition.repairId,
            idempotencyKey: dryRun.idempotencyKey,
            now: nowDate
        )
        if alreadyApplied { continue }

        let result: RepairApplyResult
        do {
            result = try runRepair(
                registry,
                working,
                candidate.definition.repairId,
                options: RepairApplyOptions(
                    repairedAt: nowIso,
                    backupId: backup.id,
                    triggeredBy: input.triggeredBy
                )
            )
        } catch {
            warnings.append("\(candidate.definition.repairId): runRepair threw — \(error)")
            continue
        }
        results.append(result)

        let receiptId = receiptIdField(result.receipt)
        let finalStatus: RepairApplyStatus
        if result.status == .applied {
            let postDetect = candidate.definition.detect(result.repairedData)
            finalStatus = postDetect.detected ? .failed : .applied
            if finalStatus == .failed {
                warnings.append("\(candidate.definition.repairId): post-state detect still reports issue; flagged failed")
            }
        } else {
            finalStatus = result.status
        }

        let ledgerEntry = buildLedgerEntry(BuildLedgerEntryParams(
            repairId: candidate.definition.repairId,
            idempotencyKey: dryRun.idempotencyKey,
            appliedAt: nowIso,
            triggeredBy: input.triggeredBy,
            status: finalStatus,
            occurrences: candidate.occurrences,
            affectedIds: candidate.affectedIds,
            appDataHashBefore: appDataHashBefore,
            appDataHashAfter: computeAppDataHash(result.repairedData),
            backupId: backup.id,
            receiptId: receiptId,
            warnings: result.warnings
        ))
        working = appendLedgerEntry(result.repairedData, ledgerEntry)
    }

    let ledgerAfter = readLedger(working)
    let summary = buildSummary(
        ledger: ledgerAfter,
        auditCount: auditFindings.count,
        triggeredBy: input.triggeredBy,
        backupId: backup.id,
        now: nowDate
    )
    let appDataHashAfter = computeAppDataHash(working)
    let appliedCount = results.filter { $0.status == .applied }.count
    return AutoRepairOrchestratorResult(
        appData: writeSummary(working, summary: summary),
        changed: appliedCount > 0,
        results: results,
        auditFindings: auditFindings,
        backup: backup,
        appDataHashBefore: appDataHashBefore,
        appDataHashAfter: appDataHashAfter,
        summary: summary,
        warnings: warnings
    )
}

// MARK: - Summary builders

private func buildSummary(
    ledger: [DataHealthRepairLedgerEntry],
    auditCount: Int,
    triggeredBy: RepairTrigger,
    backupId: String?,
    now: Date
) -> DataHealthAutoRepairSummary {
    let sevenDaysAgo = now.addingTimeInterval(-7 * 24 * 3600)
    let recent = ledger.filter { entry in
        guard let at = parseIsoDate(entry.appliedAt) else { return false }
        return at >= sevenDaysAgo
    }
    let applied = recent.filter { $0.status == .applied }.count
    let auditOnly = recent.filter { $0.status == .skipped }.count
    let failed = recent.filter { $0.status == .failed || $0.status == .backupFailed }.count
    let isoFormatter = ISO8601DateFormatter()
    isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return DataHealthAutoRepairSummary(
        lastRunAt: isoFormatter.string(from: now),
        lastTriggeredBy: triggeredBy,
        appliedCount: applied,
        auditOnlyCount: auditOnly + auditCount,
        pendingHighRiskCount: auditCount,
        lastBackupId: backupId,
        lastFailureCount: failed
    )
}

private func writeSummary(_ appData: AppData, summary: DataHealthAutoRepairSummary) -> AppData {
    let summaryValue = encodeSummary(summary)
    let settingsObj: OrderedJSONObject
    if let v = appData.root["settings"], case .object(let obj) = v {
        settingsObj = obj
    } else {
        settingsObj = OrderedJSONObject()
    }
    let newSettings = upsertKey(settingsObj, dataHealthAutoRepairSummarySettingsKey, to: summaryValue)
    let newRoot = upsertKey(appData.root, "settings", to: .object(newSettings))
    return AppData(schemaVersion: appData.schemaVersion, root: newRoot)
}

private func encodeSummary(_ summary: DataHealthAutoRepairSummary) -> JSONValue {
    var entries: [OrderedJSONObject.Entry] = []
    if let v = summary.lastRunAt {
        entries.append(.init(key: "lastRunAt", value: .string(v)))
    }
    if let v = summary.lastTriggeredBy {
        entries.append(.init(key: "lastTriggeredBy", value: .string(v.rawValue)))
    }
    entries.append(.init(key: "appliedCount", value: .number(.integer(Int64(summary.appliedCount)))))
    entries.append(.init(key: "auditOnlyCount", value: .number(.integer(Int64(summary.auditOnlyCount)))))
    entries.append(.init(key: "pendingHighRiskCount", value: .number(.integer(Int64(summary.pendingHighRiskCount)))))
    if let v = summary.lastBackupId {
        entries.append(.init(key: "lastBackupId", value: .string(v)))
    }
    entries.append(.init(key: "lastFailureCount", value: .number(.integer(Int64(summary.lastFailureCount)))))
    return .object(OrderedJSONObject(entries: entries))
}

/// Read-only accessor returning the typed summary, if present.
public func readAutoRepairSummary(_ appData: AppData) -> DataHealthAutoRepairSummary? {
    guard let obj = appData.settings.dataHealthAutoRepairSummary?.objectValue else { return nil }
    let lastRunAt = obj["lastRunAt"]?.stringValue
    let lastTriggeredBy: RepairTrigger? = {
        if let raw = obj["lastTriggeredBy"]?.stringValue {
            return RepairTrigger(rawValue: raw)
        }
        return nil
    }()
    return DataHealthAutoRepairSummary(
        lastRunAt: lastRunAt,
        lastTriggeredBy: lastTriggeredBy,
        appliedCount: obj["appliedCount"]?.intValue ?? 0,
        auditOnlyCount: obj["auditOnlyCount"]?.intValue ?? 0,
        pendingHighRiskCount: obj["pendingHighRiskCount"]?.intValue ?? 0,
        lastBackupId: obj["lastBackupId"]?.stringValue,
        lastFailureCount: obj["lastFailureCount"]?.intValue ?? 0
    )
}
