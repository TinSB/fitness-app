// AppDataIngressPipeline — iOS-3C ingress pipeline.
//
// Swift port of `src/dataHealth/appDataIngressPipeline.ts`. Wraps
// the iOS-3A CleanAppDataView + iOS-3B AutoRepairOrchestrator into a
// single entry-point that boot / import / cloud-restore / etc. flows
// can call with `AppData` + `AppDataIngressSource`.
//
// iOS-3C explicitly DOES NOT port the cloud-upload-eligibility check
// from `src/dataHealth/uploadEligibility.ts` — that lands in iOS-7
// when CloudKit / Supabase wiring arrives. Until then, the result
// struct exposes only the runtime-guard + repair surface.

import Foundation
import IronPathDomain

// MARK: - Source enum

public enum AppDataIngressSource: String, Equatable, Hashable, Sendable, CaseIterable {
    case boot
    case localStorageLoad   = "localStorage-load"
    case importRestore      = "import-restore"
    case backupRestore      = "backup-restore"
    case cloudRestore       = "cloud-restore"
    case cloudPull          = "cloud-pull"
    case readMirror         = "read-mirror"
    case cloudParity        = "cloud-parity"
    case accountSwitch      = "account-switch"
    case postSessionComplete = "post-session-complete"
    case preTrainingDecision = "pre-training-decision"
    case preCloudUpload     = "pre-cloud-upload"
    case export
}

public enum AppDataIngressPassiveStatusTone: String, Equatable, Hashable, Sendable {
    case ok
    case autoRepaired = "auto-repaired"
    case auditPending = "audit-pending"
    case backupFailed = "backup-failed"
    case busy
}

public struct AppDataIngressPassiveStatus: Equatable, Sendable {
    public let line: String
    public let tone: AppDataIngressPassiveStatusTone

    public init(line: String, tone: AppDataIngressPassiveStatusTone) {
        self.line = line
        self.tone = tone
    }
}

// MARK: - Per-source defaults

public struct AppDataIngressSourceDefaults: Equatable, Sendable {
    public let allowMutation: Bool
    public let allowAutoRepair: Bool
    public let requireBackup: Bool
    public let repairTrigger: RepairTrigger

    public init(
        allowMutation: Bool,
        allowAutoRepair: Bool,
        requireBackup: Bool,
        repairTrigger: RepairTrigger
    ) {
        self.allowMutation = allowMutation
        self.allowAutoRepair = allowAutoRepair
        self.requireBackup = requireBackup
        self.repairTrigger = repairTrigger
    }
}

public func ingressSourceDefaults(_ source: AppDataIngressSource) -> AppDataIngressSourceDefaults {
    switch source {
    case .boot:
        return .init(allowMutation: true, allowAutoRepair: true, requireBackup: true, repairTrigger: .boot)
    case .localStorageLoad:
        return .init(allowMutation: true, allowAutoRepair: true, requireBackup: true, repairTrigger: .boot)
    case .importRestore:
        return .init(allowMutation: true, allowAutoRepair: true, requireBackup: true, repairTrigger: .importing)
    case .backupRestore:
        return .init(allowMutation: true, allowAutoRepair: true, requireBackup: true, repairTrigger: .importing)
    case .cloudRestore:
        return .init(allowMutation: true, allowAutoRepair: true, requireBackup: true, repairTrigger: .cloudRestore)
    case .cloudPull:
        return .init(allowMutation: false, allowAutoRepair: false, requireBackup: false, repairTrigger: .cloudRestore)
    case .readMirror:
        return .init(allowMutation: false, allowAutoRepair: false, requireBackup: false, repairTrigger: .audit)
    case .cloudParity:
        return .init(allowMutation: false, allowAutoRepair: false, requireBackup: false, repairTrigger: .audit)
    case .accountSwitch:
        return .init(allowMutation: true, allowAutoRepair: true, requireBackup: true, repairTrigger: .boot)
    case .postSessionComplete:
        return .init(allowMutation: true, allowAutoRepair: true, requireBackup: true, repairTrigger: .postSession)
    case .preTrainingDecision:
        return .init(allowMutation: false, allowAutoRepair: false, requireBackup: false, repairTrigger: .audit)
    case .preCloudUpload:
        return .init(allowMutation: false, allowAutoRepair: false, requireBackup: false, repairTrigger: .audit)
    case .export:
        return .init(allowMutation: false, allowAutoRepair: false, requireBackup: false, repairTrigger: .manual)
    }
}

private let forbiddenAutoRepairWithoutMutation: Set<AppDataIngressSource> = [
    .cloudPull,
    .readMirror,
    .cloudParity,
    .preTrainingDecision,
    .preCloudUpload,
    .export,
]

// MARK: - Input / Result

public struct AppDataIngressOptions: Sendable {
    public let accountId: String?
    public let allowMutation: Bool?
    public let allowAutoRepair: Bool?
    public let requireBackup: Bool?
    public let backupAdapter: AutoRepairBackupAdapter?
    public let registry: RepairRegistry?
    public let operationId: String?

    public init(
        accountId: String? = nil,
        allowMutation: Bool? = nil,
        allowAutoRepair: Bool? = nil,
        requireBackup: Bool? = nil,
        backupAdapter: AutoRepairBackupAdapter? = nil,
        registry: RepairRegistry? = nil,
        operationId: String? = nil
    ) {
        self.accountId = accountId
        self.allowMutation = allowMutation
        self.allowAutoRepair = allowAutoRepair
        self.requireBackup = requireBackup
        self.backupAdapter = backupAdapter
        self.registry = registry
        self.operationId = operationId
    }
}

public struct AppDataIngressResult: Sendable {
    public let source: AppDataIngressSource
    public let operationId: String
    public let cleanView: CleanAppDataView
    /// Non-nil only when the orchestrator actually mutated AppData.
    public let repairedAppData: AppData?
    public let repairSummary: DataHealthAutoRepairSummary?
    public let orchestratorResult: AutoRepairOrchestratorResult?
    public let shouldPersist: Bool
    public let passiveStatus: AppDataIngressPassiveStatus
    public let warnings: [String]
    public let triggeredOrchestrator: Bool
    public let appDataHashBefore: String
    public let appDataHashAfter: String

    public init(
        source: AppDataIngressSource,
        operationId: String,
        cleanView: CleanAppDataView,
        repairedAppData: AppData?,
        repairSummary: DataHealthAutoRepairSummary?,
        orchestratorResult: AutoRepairOrchestratorResult?,
        shouldPersist: Bool,
        passiveStatus: AppDataIngressPassiveStatus,
        warnings: [String],
        triggeredOrchestrator: Bool,
        appDataHashBefore: String,
        appDataHashAfter: String
    ) {
        self.source = source
        self.operationId = operationId
        self.cleanView = cleanView
        self.repairedAppData = repairedAppData
        self.repairSummary = repairSummary
        self.orchestratorResult = orchestratorResult
        self.shouldPersist = shouldPersist
        self.passiveStatus = passiveStatus
        self.warnings = warnings
        self.triggeredOrchestrator = triggeredOrchestrator
        self.appDataHashBefore = appDataHashBefore
        self.appDataHashAfter = appDataHashAfter
    }
}

public enum AppDataIngressError: Error, Equatable, Sendable {
    case forbiddenAutoRepair(AppDataIngressSource)
}

// MARK: - Entry point

public func processIncomingAppData(
    appData: AppData,
    source: AppDataIngressSource,
    clock: RuntimeGuardClock = SystemRuntimeGuardClock(),
    options: AppDataIngressOptions = AppDataIngressOptions()
) throws -> AppDataIngressResult {
    let defaults = ingressSourceDefaults(source)
    let allowMutation = options.allowMutation ?? defaults.allowMutation
    let allowAutoRepair = options.allowAutoRepair ?? defaults.allowAutoRepair
    let requireBackup = options.requireBackup ?? defaults.requireBackup

    // Read-only sources cannot opt into auto-repair without also
    // explicitly opting into mutation.
    if allowAutoRepair && forbiddenAutoRepairWithoutMutation.contains(source) && options.allowMutation != true {
        throw AppDataIngressError.forbiddenAutoRepair(source)
    }

    let registry = options.registry ?? fullRepairRegistry()
    let appDataHashBefore = computeAppDataHash(appData)
    let operationId = options.operationId
        ?? generateOperationId(source: source, accountId: options.accountId, hash: appDataHashBefore, clock: clock)

    // Always build CleanAppDataView, even on read-only sources.
    let cleanView = buildCleanAppDataView(appData, clock: clock)

    var orchestratorResult: AutoRepairOrchestratorResult?
    var repairedAppData: AppData?
    var workingAppData = appData
    var triggeredOrchestrator = false
    var warnings: [String] = []

    if allowMutation && allowAutoRepair {
        do {
            let result = try runAutoRepairOrchestrator(AutoRepairOrchestratorInput(
                appData: appData,
                triggeredBy: defaults.repairTrigger,
                registry: registry,
                backupAdapter: options.backupAdapter,
                clock: clock
            ))
            orchestratorResult = result
            triggeredOrchestrator = true
            if result.changed {
                repairedAppData = result.appData
                workingAppData = result.appData
            } else {
                workingAppData = result.appData
            }
            for warning in result.warnings {
                warnings.append(warning)
            }
        } catch {
            warnings.append("orchestrator_error: \(error)")
        }
    }

    let summary = readAutoRepairSummary(workingAppData)
    let auditFindingsCount = orchestratorResult?.auditFindings.count ?? 0
    let appliedCount = orchestratorResult?.results.filter { $0.status == .applied }.count ?? 0
    let backupFailed = orchestratorResult?.warnings.contains(where: { $0.contains("backup_failed") }) ?? false

    let passiveStatus = composePassiveStatus(
        appliedCount: appliedCount,
        pendingRepairs: 0,  // iOS-3C does NOT port uploadEligibility; iOS-7 will own pending counts
        auditOnly: auditFindingsCount,
        backupFailed: backupFailed
    )

    if requireBackup && allowMutation && allowAutoRepair && backupFailed {
        warnings.append("backup_failed: ingress kept runtime guard active without mutation")
    }

    let shouldPersist = allowMutation && repairedAppData != nil

    return AppDataIngressResult(
        source: source,
        operationId: operationId,
        cleanView: cleanView,
        repairedAppData: repairedAppData,
        repairSummary: summary,
        orchestratorResult: orchestratorResult,
        shouldPersist: shouldPersist,
        passiveStatus: passiveStatus,
        warnings: warnings,
        triggeredOrchestrator: triggeredOrchestrator,
        appDataHashBefore: appDataHashBefore,
        appDataHashAfter: computeAppDataHash(workingAppData)
    )
}

// MARK: - Internals

private func composePassiveStatus(
    appliedCount: Int,
    pendingRepairs: Int,
    auditOnly: Int,
    backupFailed: Bool
) -> AppDataIngressPassiveStatus {
    if backupFailed {
        return AppDataIngressPassiveStatus(line: "数据正在自动整理，稍后同步", tone: .backupFailed)
    }
    if appliedCount > 0 {
        return AppDataIngressPassiveStatus(line: "已自动修复 \(appliedCount) 个旧版本问题", tone: .autoRepaired)
    }
    if pendingRepairs > 0 {
        return AppDataIngressPassiveStatus(line: "\(pendingRepairs) 个待自动修复", tone: .busy)
    }
    if auditOnly > 0 {
        return AppDataIngressPassiveStatus(line: "\(auditOnly) 个已隔离，不影响训练建议", tone: .auditPending)
    }
    return AppDataIngressPassiveStatus(line: "数据已自动检查", tone: .ok)
}

private func generateOperationId(
    source: AppDataIngressSource,
    accountId: String?,
    hash: String,
    clock: RuntimeGuardClock
) -> String {
    let scope = accountId ?? "unscoped"
    let hashSuffix = String(hash.suffix(8))
    let ms = Int(clock.now().timeIntervalSince1970 * 1000.0)
    let msRadix36 = String(ms, radix: 36)
    let rand = Int.random(in: 0..<1_000_000)
    let randRadix36 = String(rand, radix: 36)
    return "ingress_\(source.rawValue)_\(scope)_\(hashSuffix)_\(msRadix36)_\(randRadix36)"
}
