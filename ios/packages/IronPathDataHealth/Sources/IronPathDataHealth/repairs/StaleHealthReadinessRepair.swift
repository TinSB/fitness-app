// StaleHealthReadinessRepair — iOS-3B safe repair recipe (safe_auto).
//
// Swift port of `src/dataHealth/repairs/staleHealthReadinessGuardV1.ts`.
// Marks `settings.dataHealthRuntimeFlags.healthDataStaleSince` when
// `applyHealthDataGuard` reports stale HealthKit samples. Does NOT
// delete any sample, workout, or `raw` opaque payload.

import Foundation
import IronPathDomain

public struct StaleHealthReadinessRepair: RepairDefinition {
    public let repairId: String = "staleHealthReadinessGuardV1"
    public let version: Int = 1
    public let layer: RepairLayer = .safeAuto
    public let category: RepairCategory = .readinessFreshness
    public let description: String = "陈旧的外部健康数据不应作为准备度强信号"
    public let affectedAppDataPaths: [String] = [
        "settings.dataHealthRuntimeFlags.healthDataStaleSince",
    ]
    public let supportsApply: Bool = true

    private let clock: RuntimeGuardClock

    public init(clock: RuntimeGuardClock = SystemRuntimeGuardClock()) {
        self.clock = clock
    }

    public func detect(_ appData: AppData) -> RepairDetectResult {
        let guardOutcome = applyHealthDataGuard(appData, clock: clock)
        let flags = readRuntimeFlags(appData)
        let alreadyMarked =
            flags["healthDataStaleSince"]?.stringValue != nil &&
            flags["healthDataObservedLatestAt"]?.stringValue == guardOutcome.latestSampleAt
        let detected = guardOutcome.staleForReadiness && !alreadyMarked
        return RepairDetectResult(
            repairId: repairId,
            detected: detected,
            occurrences: detected ? 1 : 0,
            affectedIds: detected ? ["settings.dataHealthRuntimeFlags.healthDataStaleSince"] : [],
            severity: detected ? .warning : .info,
            userMessage: detected
                ? "导入的健康数据已经 \(guardOutcome.daysOld.map(String.init) ?? "?") 天没更新（最新样本 \(String(guardOutcome.latestSampleAt?.prefix(10) ?? "?"))），运行时已降级置信度"
                : "健康数据足够新鲜或未启用"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let guardOutcome = applyHealthDataGuard(appData, clock: clock)
        let sample: [RepairDryRunBeforeAfter]
        if detectResult.detected {
            sample = [RepairDryRunBeforeAfter(
                id: "settings.dataHealthRuntimeFlags.healthDataStaleSince",
                before: "最新健康样本于 \(String(guardOutcome.latestSampleAt?.prefix(10) ?? "?"))（\(guardOutcome.daysOld.map(String.init) ?? "?") 天前），useHealthDataForReadiness=\(guardOutcome.useHealthDataForReadiness)",
                after: "保留用户偏好；写入过期标记；准备度降级置信度直到新样本导入"
            )]
        } else {
            sample = []
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "不修改 useHealthDataForReadiness 用户偏好。只在 settings.dataHealthRuntimeFlags.healthDataStaleSince 记录过期时间（阈值 \(DataHealthConstants.healthDataStaleDays) 天）。",
            changedPaths: affectedAppDataPaths,
            beforeAfterSample: sample,
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let guardOutcome = applyHealthDataGuard(appData, clock: clock)
        if !guardOutcome.staleForReadiness {
            return RepairApplyResult(
                repairId: repairId,
                status: .noOp,
                repairedData: appData,
                receipt: buildReceipt(ReceiptParams(
                    repairId: repairId,
                    category: category,
                    action: "健康数据陈旧标记",
                    affectedIds: [],
                    beforeSummary: "健康数据新鲜或未启用",
                    afterSummary: "未变更",
                    repairedAt: options?.repairedAt
                )),
                warnings: []
            )
        }
        let stamp = options?.repairedAt ?? isoNow(clock)
        var flags = readRuntimeFlags(appData)
        flags = upsertKey(flags, "healthDataStaleSince", to: .string(stamp))
        if let latest = guardOutcome.latestSampleAt {
            flags = upsertKey(flags, "healthDataObservedLatestAt", to: .string(latest))
        }
        if let days = guardOutcome.daysOld {
            flags = upsertKey(flags, "healthDataObservedDaysOld", to: .number(.integer(Int64(days))))
        }
        let updated = writeRuntimeFlags(appData, flags)
        return RepairApplyResult(
            repairId: repairId,
            status: .applied,
            repairedData: updated,
            receipt: buildReceipt(ReceiptParams(
                repairId: repairId,
                category: category,
                action: "健康数据陈旧标记（运行时降级置信度）",
                affectedIds: ["settings.dataHealthRuntimeFlags.healthDataStaleSince"],
                beforeSummary: "最新健康样本于 \(String(guardOutcome.latestSampleAt?.prefix(10) ?? "?"))（\(guardOutcome.daysOld.map(String.init) ?? "?") 天前）",
                afterSummary: "已标记陈旧；导入新样本后自动恢复",
                repairedAt: options?.repairedAt
            )),
            warnings: []
        )
    }
}
