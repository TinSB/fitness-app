// ScreeningIssueScoreRepair — iOS-3C safe_auto recipe (screening_decay).
//
// Swift port of `retired web reference`.
// Persists `applyIssueScoreCap` deltas to
// `screeningProfile.adaptiveState.issueScores` ONLY when all three
// safety predicates pass:
//   * movementFlags is non-empty AND every value == "good"
//   * painTriggers is empty (or nil)
//   * restrictedExercises is empty (or nil)
//
// Predicate-blocked → `detect.detected = false` → orchestrator never
// calls apply. All other adaptiveState keys + painTriggers /
// restrictedExercises / movementFlags / correctionPriority are
// preserved verbatim.

import Foundation
import IronPathDomain

public struct ScreeningIssueScoreRepair: RepairDefinition {
    public let repairId: String = "screeningIssueScoreRepairV1"
    public let version: Int = 1
    public let layer: RepairLayer = .safeAuto
    public let category: RepairCategory = .screeningDecay
    public let description: String = "issueScores 安全收敛（仅在 movementFlags 全好且无 pain/restriction 时写回）"
    public let affectedAppDataPaths: [String] = ["screeningProfile.adaptiveState.issueScores"]
    public let supportsApply: Bool = true

    public init() {}

    private func isFullySafeToWrite(_ screening: ScreeningProfile) -> Bool {
        guard case .object(let flags) = (screening.movementFlags ?? .null) else { return false }
        if flags.entries.isEmpty { return false }
        let allGood = flags.entries.allSatisfy { $0.value.stringValue == "good" }
        if !allGood { return false }
        if !(screening.painTriggers ?? []).isEmpty { return false }
        if !(screening.restrictedExercises ?? []).isEmpty { return false }
        return true
    }

    public func detect(_ appData: AppData) -> RepairDetectResult {
        let screening = appData.screeningProfile
        let cap = applyIssueScoreCap(screening)
        let safeToWrite = isFullySafeToWrite(screening)
        let detected = !cap.changes.isEmpty && safeToWrite
        return RepairDetectResult(
            repairId: repairId,
            detected: detected,
            occurrences: detected ? cap.changes.count : 0,
            affectedIds: detected ? cap.changes.map { $0.key } : [],
            severity: detected ? .warning : .info,
            userMessage: detected
                ? "\(cap.changes.count) 项 issueScores 与全好的 movementFlags 不一致，将把异常分数收敛写回（含 before/after 收据）"
                : "没有可以安全写回的 issueScores 收敛动作"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let cap = applyIssueScoreCap(appData.screeningProfile)
        let sample = cap.changes.prefix(3).map { change -> RepairDryRunBeforeAfter in
            RepairDryRunBeforeAfter(
                id: change.key,
                before: "\(change.key)=\(formatDoubleForReceipt(change.before))",
                after: "\(change.key)=\(change.after)（持久化）"
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "把异常 issueScores 收敛到合理范围（硬上限 \(DataHealthConstants.issueScoreHardCap)，软上限 \(DataHealthConstants.issueScoreSoftCap)）。只在 movementFlags 全部 good 且无 pain/restriction 时执行写回。painByExercise / painTriggers / restrictedExercises 保持不变。",
            changedPaths: affectedAppDataPaths,
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let screening = appData.screeningProfile
        let cap = applyIssueScoreCap(screening)
        if cap.changes.isEmpty || !isFullySafeToWrite(screening) {
            return RepairApplyResult(
                repairId: repairId,
                status: .noOp,
                repairedData: appData,
                receipt: buildReceipt(ReceiptParams(
                    repairId: repairId,
                    category: category,
                    action: "issueScores 安全收敛",
                    affectedIds: [],
                    beforeSummary: "无需收敛或不满足安全写回前置条件",
                    afterSummary: "未变更",
                    repairedAt: options?.repairedAt
                )),
                warnings: []
            )
        }

        // Re-build screeningProfile inside root: replace adaptiveState's
        // issueScores key only, leave every other adaptiveState key +
        // every other screening field verbatim.
        let originalAdaptive: OrderedJSONObject
        if let adaptive = screening.adaptiveState, case .object(let obj) = adaptive {
            originalAdaptive = obj
        } else {
            originalAdaptive = OrderedJSONObject()
        }
        let originalIssueScores = originalAdaptive["issueScores"] ?? .object(OrderedJSONObject())
        let nextAdaptive = upsertKey(originalAdaptive, "issueScores", to: .object(cap.cappedScores))

        let screeningObj: OrderedJSONObject
        if let v = appData.root["screeningProfile"], case .object(let obj) = v {
            screeningObj = obj
        } else {
            screeningObj = OrderedJSONObject()
        }
        let newScreening = upsertKey(screeningObj, "adaptiveState", to: .object(nextAdaptive))
        let newRoot = upsertKey(appData.root, "screeningProfile", to: .object(newScreening))
        let repaired = AppData(schemaVersion: appData.schemaVersion, root: newRoot)

        let before = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "issueScores", value: originalIssueScores),
        ]))
        let after = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "issueScores", value: .object(cap.cappedScores)),
        ]))

        return RepairApplyResult(
            repairId: repairId,
            status: .applied,
            repairedData: repaired,
            receipt: buildReceipt(ReceiptParams(
                repairId: repairId,
                category: category,
                action: "issueScores 安全写回（保留 painByExercise / painTriggers / restrictedExercises）",
                affectedIds: cap.changes.map { $0.key },
                beforeSummary: "\(cap.changes.count) 项异常分数",
                afterSummary: "\(cap.changes.count) 项分数已收敛写回",
                repairedAt: options?.repairedAt,
                before: before,
                after: after
            )),
            warnings: []
        )
    }
}

private func formatDoubleForReceipt(_ value: Double) -> String {
    if value.truncatingRemainder(dividingBy: 1) == 0 {
        return String(Int(value))
    }
    return String(value)
}
