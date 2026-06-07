// ScreeningIssueScoreRuntimeGuardRepair — iOS-3C runtime_guard recipe.
//
// Swift port of `retired web reference`.
// Runtime guard only — `apply` returns `.skipped` with the AppData
// untouched. The actual cap protection lives upstream in
// `CleanAppDataView.cleanedScreening`.

import Foundation
import IronPathDomain

public struct ScreeningIssueScoreRuntimeGuardRepair: RepairDefinition {
    public let repairId: String = "screeningIssueScoreRuntimeGuardV1"
    public let version: Int = 1
    public let layer: RepairLayer = .runtimeGuard
    public let category: RepairCategory = .screeningDecay
    public let description: String = "issueScores 运行时上限保护"
    public let affectedAppDataPaths: [String] = []
    public let supportsApply: Bool = true

    public init() {}

    public func detect(_ appData: AppData) -> RepairDetectResult {
        let cap = applyIssueScoreCap(appData.screeningProfile)
        let detected = !cap.changes.isEmpty
        return RepairDetectResult(
            repairId: repairId,
            detected: detected,
            occurrences: cap.changes.count,
            affectedIds: cap.changes.map { $0.key },
            severity: detected ? .error : .info,
            userMessage: detected
                ? "检测到 \(cap.changes.count) 项 issueScores 异常（超过硬上限 \(DataHealthConstants.issueScoreHardCap) 或与 movementFlags 矛盾）；运行时已上限保护"
                : "issueScores 与 movementFlags 一致"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let cap = applyIssueScoreCap(appData.screeningProfile)
        let sample = cap.changes.prefix(3).map { change -> RepairDryRunBeforeAfter in
            RepairDryRunBeforeAfter(
                id: change.key,
                before: "\(change.key)=\(formatDouble(change.before))",
                after: "\(change.key)=\(change.after)（运行时上限）"
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "永远不写回 AppData。Runtime Guard 在 CleanAppDataView 上限：硬上限 \(DataHealthConstants.issueScoreHardCap)；当 movementFlags 全为 good 且无 pain/restriction 时软上限 \(DataHealthConstants.issueScoreSoftCap)。训练建议只能看到上限后的分数。",
            changedPaths: [],
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let cap = applyIssueScoreCap(appData.screeningProfile)
        let beforeSummary = cap.changes.isEmpty
            ? "issueScores 正常"
            : "\(cap.changes.count) 项 issueScores 在运行时被上限保护"
        return RepairApplyResult(
            repairId: repairId,
            status: .skipped,
            repairedData: appData,
            receipt: buildReceipt(ReceiptParams(
                repairId: repairId,
                category: category,
                action: "issueScores 运行时上限保护（不修改 AppData）",
                affectedIds: cap.changes.map { $0.key },
                beforeSummary: beforeSummary,
                afterSummary: "未修改 AppData；训练建议读取 CleanAppDataView 时受保护",
                repairedAt: options?.repairedAt
            )),
            warnings: ["runtime guard: no mutation by design"]
        )
    }
}

private func formatDouble(_ value: Double) -> String {
    if value.truncatingRemainder(dividingBy: 1) == 0 {
        return String(Int(value))
    }
    return String(value)
}
