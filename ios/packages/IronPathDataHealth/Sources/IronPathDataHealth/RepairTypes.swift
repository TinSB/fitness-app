// RepairTypes — iOS-3A Data Health Runtime Foundation V1.
//
// Type-only skeleton mirroring `src/dataHealth/appDataRepairTypes.ts`.
// iOS-3A defines the protocol shape, enums, and ledger-entry struct
// so iOS-3B (repair recipes + AutoRepairOrchestrator) can implement
// concrete repairs against a stable contract. No concrete
// `RepairDefinition` instances live in iOS-3A — defining them is
// explicitly out of iOS-3A scope.
//
// Out of iOS-3A scope:
//   * 9 V1 repair-recipe instances
//   * AutoRepairOrchestrator
//   * processIncomingAppData
//   * any function that actually mutates AppData via these types

import Foundation
import IronPathDomain

// MARK: - Enums

public enum RepairLayer: String, Equatable, Hashable, Sendable, CaseIterable {
    case runtimeGuard = "runtime_guard"
    case safeAuto = "safe_auto"
    case auditOnly = "audit_only"
}

public enum RepairCategory: String, Equatable, Hashable, Sendable, CaseIterable {
    case sessionLifecycle = "session_lifecycle"
    case durationSanity = "duration_sanity"
    case readinessFreshness = "readiness_freshness"
    case screeningDecay = "screening_decay"
    case legacyAdviceIsolation = "legacy_advice_isolation"
    case setIndexRenumber = "set_index_renumber"
    case identityAudit = "identity_audit"
    case unitDisplay = "unit_display"
}

public enum RepairSeverity: String, Equatable, Hashable, Sendable, CaseIterable {
    case info, warning, error
}

public enum RepairTrigger: String, Equatable, Hashable, Sendable, CaseIterable {
    case boot
    case importing = "import"
    case cloudRestore = "cloud_restore"
    case postSession = "post_session"
    case manual
    case audit
}

public enum RepairApplyStatus: String, Equatable, Hashable, Sendable, CaseIterable {
    case applied
    case noOp = "no_op"
    case skipped
    case failed
    case backupFailed = "backup_failed"
}

// MARK: - Detect / DryRun / Apply value types

public struct RepairDetectResult: Equatable, Sendable {
    public let repairId: String
    public let detected: Bool
    public let occurrences: Int
    public let affectedIds: [String]
    public let severity: RepairSeverity
    public let userMessage: String
    /// Open-bag payload preserved verbatim — JSONValue lets iOS-3B
    /// recipes attach arbitrary diagnostic structures without us
    /// having to enumerate them in advance.
    public let hiddenDetails: JSONValue?

    public init(
        repairId: String,
        detected: Bool,
        occurrences: Int,
        affectedIds: [String],
        severity: RepairSeverity,
        userMessage: String,
        hiddenDetails: JSONValue? = nil
    ) {
        self.repairId = repairId
        self.detected = detected
        self.occurrences = occurrences
        self.affectedIds = affectedIds
        self.severity = severity
        self.userMessage = userMessage
        self.hiddenDetails = hiddenDetails
    }
}

public struct RepairDryRunBeforeAfter: Equatable, Sendable {
    public let id: String
    public let before: String
    public let after: String

    public init(id: String, before: String, after: String) {
        self.id = id
        self.before = before
        self.after = after
    }
}

public struct RepairDryRunResult: Equatable, Sendable {
    public let detect: RepairDetectResult
    public let changeSummary: String
    public let changedPaths: [String]
    public let beforeAfterSample: [RepairDryRunBeforeAfter]
    public let idempotencyKey: String

    public init(
        detect: RepairDetectResult,
        changeSummary: String,
        changedPaths: [String],
        beforeAfterSample: [RepairDryRunBeforeAfter],
        idempotencyKey: String
    ) {
        self.detect = detect
        self.changeSummary = changeSummary
        self.changedPaths = changedPaths
        self.beforeAfterSample = beforeAfterSample
        self.idempotencyKey = idempotencyKey
    }
}

public struct RepairApplyOptions: Equatable, Sendable {
    public let repairedAt: String?
    public let backupId: String?
    public let triggeredBy: RepairTrigger?

    public init(
        repairedAt: String? = nil,
        backupId: String? = nil,
        triggeredBy: RepairTrigger? = nil
    ) {
        self.repairedAt = repairedAt
        self.backupId = backupId
        self.triggeredBy = triggeredBy
    }
}

public struct RepairApplyResult: Equatable, Sendable {
    public let repairId: String
    public let status: RepairApplyStatus
    public let repairedData: AppData
    /// `DataRepairLogEntry`-shaped receipt; preserved as JSONValue
    /// because the canonical typed shape lives in TS-land for now.
    public let receipt: JSONValue
    public let warnings: [String]
    public let appDataHashBefore: String?
    public let appDataHashAfter: String?

    public init(
        repairId: String,
        status: RepairApplyStatus,
        repairedData: AppData,
        receipt: JSONValue,
        warnings: [String],
        appDataHashBefore: String? = nil,
        appDataHashAfter: String? = nil
    ) {
        self.repairId = repairId
        self.status = status
        self.repairedData = repairedData
        self.receipt = receipt
        self.warnings = warnings
        self.appDataHashBefore = appDataHashBefore
        self.appDataHashAfter = appDataHashAfter
    }
}

// MARK: - RepairDefinition protocol

/// iOS-3A defines the contract. iOS-3B will ship concrete `struct`
/// types conforming to this protocol — one per repair recipe. The
/// protocol intentionally exposes `apply` as throwing-optional so
/// audit-only repairs can omit it; recipes that do support
/// repair-apply throw on backup failure or unrecoverable input.
public protocol RepairDefinition: Sendable {
    var repairId: String { get }
    var version: Int { get }
    var layer: RepairLayer { get }
    var category: RepairCategory { get }
    var description: String { get }
    var affectedAppDataPaths: [String] { get }

    func detect(_ appData: AppData) -> RepairDetectResult
    func dryRun(_ appData: AppData) -> RepairDryRunResult

    /// Returns nil when the repair is audit-only.
    var supportsApply: Bool { get }
    func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult
}

// MARK: - Ledger entry

public struct DataHealthRepairLedgerEntry: Equatable, Sendable {
    public let ledgerId: String
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
        ledgerId: String,
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
        self.ledgerId = ledgerId
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

// MARK: - Runtime flags + Auto-repair summary + AppDataHashable

public struct DataHealthRuntimeFlags: Equatable, Sendable {
    public let todayStatusIgnoredAt: String?
    public let todayStatusObservedDate: String?
    public let healthDataStaleSince: String?
    public let healthDataObservedLatestAt: String?
    public let healthDataObservedDaysOld: Int?
    public let screeningIssueScoreGuardedAt: String?

    public init(
        todayStatusIgnoredAt: String? = nil,
        todayStatusObservedDate: String? = nil,
        healthDataStaleSince: String? = nil,
        healthDataObservedLatestAt: String? = nil,
        healthDataObservedDaysOld: Int? = nil,
        screeningIssueScoreGuardedAt: String? = nil
    ) {
        self.todayStatusIgnoredAt = todayStatusIgnoredAt
        self.todayStatusObservedDate = todayStatusObservedDate
        self.healthDataStaleSince = healthDataStaleSince
        self.healthDataObservedLatestAt = healthDataObservedLatestAt
        self.healthDataObservedDaysOld = healthDataObservedDaysOld
        self.screeningIssueScoreGuardedAt = screeningIssueScoreGuardedAt
    }
}

public struct DataHealthAutoRepairSummary: Equatable, Sendable {
    public let lastRunAt: String?
    public let lastTriggeredBy: RepairTrigger?
    public let appliedCount: Int
    public let auditOnlyCount: Int
    public let pendingHighRiskCount: Int
    public let lastBackupId: String?
    public let lastFailureCount: Int

    public init(
        lastRunAt: String? = nil,
        lastTriggeredBy: RepairTrigger? = nil,
        appliedCount: Int = 0,
        auditOnlyCount: Int = 0,
        pendingHighRiskCount: Int = 0,
        lastBackupId: String? = nil,
        lastFailureCount: Int = 0
    ) {
        self.lastRunAt = lastRunAt
        self.lastTriggeredBy = lastTriggeredBy
        self.appliedCount = appliedCount
        self.auditOnlyCount = auditOnlyCount
        self.pendingHighRiskCount = pendingHighRiskCount
        self.lastBackupId = lastBackupId
        self.lastFailureCount = lastFailureCount
    }
}

public struct AppDataHashable: Equatable, Sendable {
    public let schemaVersion: Int
    public let historyLength: Int
    public let sessionsHash: String
    public let todayStatusDate: String?
    public let healthLatestSampleAt: String?
    public let issueScoresHash: String

    public init(
        schemaVersion: Int,
        historyLength: Int,
        sessionsHash: String,
        todayStatusDate: String? = nil,
        healthLatestSampleAt: String? = nil,
        issueScoresHash: String
    ) {
        self.schemaVersion = schemaVersion
        self.historyLength = historyLength
        self.sessionsHash = sessionsHash
        self.todayStatusDate = todayStatusDate
        self.healthLatestSampleAt = healthLatestSampleAt
        self.issueScoresHash = issueScoresHash
    }
}
