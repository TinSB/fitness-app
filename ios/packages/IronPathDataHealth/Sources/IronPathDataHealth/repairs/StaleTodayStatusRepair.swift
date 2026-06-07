// StaleTodayStatusRepair — iOS-3B safe repair recipe (safe_auto).
//
// Swift port of `retired web reference`.
// Marks `settings.dataHealthRuntimeFlags.todayStatusIgnoredAt` when
// `applyTodayStatusGuard` says today status is stale. The user's
// sleep/energy/soreness/time/date payload is preserved exactly as-is.

import Foundation
import IronPathDomain

public struct StaleTodayStatusRepair: RepairDefinition {
    public let repairId: String = "staleTodayStatusV1"
    public let version: Int = 1
    public let layer: RepairLayer = .safeAuto
    public let category: RepairCategory = .readinessFreshness
    public let description: String = "标记过期 today status 在准备度中被跳过"
    public let affectedAppDataPaths: [String] = [
        "settings.dataHealthRuntimeFlags.todayStatusIgnoredAt",
    ]
    public let supportsApply: Bool = true

    private let clock: RuntimeGuardClock

    public init(clock: RuntimeGuardClock = SystemRuntimeGuardClock()) {
        self.clock = clock
    }

    public func detect(_ appData: AppData) -> RepairDetectResult {
        let guardOutcome = applyTodayStatusGuard(appData, clock: clock)
        let flags = readRuntimeFlags(appData)
        let alreadyMarked =
            flags["todayStatusIgnoredAt"]?.stringValue != nil &&
            flags["todayStatusObservedDate"]?.stringValue == guardOutcome.observedDate
        let detected = guardOutcome.ignoredForCurrentReadiness && !alreadyMarked
        return RepairDetectResult(
            repairId: repairId,
            detected: detected,
            occurrences: detected ? 1 : 0,
            affectedIds: detected ? ["todayStatus"] : [],
            severity: detected ? .warning : .info,
            userMessage: detected
                ? "今日状态最后更新于 \(guardOutcome.daysOld.map(String.init) ?? "?") 天前（\(guardOutcome.observedDate ?? "?")），不再作为今天准备度依据"
                : "今日状态足够新鲜"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let guardOutcome = applyTodayStatusGuard(appData, clock: clock)
        let sample: [RepairDryRunBeforeAfter]
        if detectResult.detected {
            sample = [RepairDryRunBeforeAfter(
                id: "todayStatus",
                before: "date=\(guardOutcome.observedDate ?? "?")（\(guardOutcome.daysOld.map(String.init) ?? "?") 天前）",
                after: "保留主观项；标记 settings.dataHealthRuntimeFlags.todayStatusIgnoredAt，准备度计算不再消费过期状态"
            )]
        } else {
            sample = []
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "不删除用户填写的睡眠/精力/酸痛/时长。只在 settings.dataHealthRuntimeFlags.todayStatusIgnoredAt 写入过期时间，由 Runtime Guard 跳过此过期状态。",
            changedPaths: affectedAppDataPaths,
            beforeAfterSample: sample,
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let guardOutcome = applyTodayStatusGuard(appData, clock: clock)
        if !guardOutcome.ignoredForCurrentReadiness {
            return RepairApplyResult(
                repairId: repairId,
                status: .noOp,
                repairedData: appData,
                receipt: buildReceipt(ReceiptParams(
                    repairId: repairId,
                    category: category,
                    action: "标记过期 today status 跳过",
                    affectedIds: [],
                    beforeSummary: "今日状态足够新鲜",
                    afterSummary: "未变更",
                    repairedAt: options?.repairedAt
                )),
                warnings: []
            )
        }
        let stamp = options?.repairedAt ?? isoNow(clock)
        var flags = readRuntimeFlags(appData)
        flags = upsertKey(flags, "todayStatusIgnoredAt", to: .string(stamp))
        if let observed = guardOutcome.observedDate {
            flags = upsertKey(flags, "todayStatusObservedDate", to: .string(observed))
        }
        let updated = writeRuntimeFlags(appData, flags)
        return RepairApplyResult(
            repairId: repairId,
            status: .applied,
            repairedData: updated,
            receipt: buildReceipt(ReceiptParams(
                repairId: repairId,
                category: category,
                action: "标记过期 today status 在准备度中被跳过（保留主观项）",
                affectedIds: ["settings.dataHealthRuntimeFlags.todayStatusIgnoredAt"],
                beforeSummary: "today status 最后更新于 \(guardOutcome.observedDate ?? "?") （\(guardOutcome.daysOld.map(String.init) ?? "?") 天前）",
                afterSummary: "已标记忽略；用户重新填写今日状态后自动恢复使用",
                repairedAt: options?.repairedAt
            )),
            warnings: []
        )
    }
}
