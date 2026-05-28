// SessionLifecycleResidueRepair — iOS-3B safe repair recipe (safe_auto).
//
// Swift port of `src/dataHealth/repairs/sessionLifecycleResidueV1.ts`.
// Clears completed-session lifecycle residue: restTimerState.isRunning,
// currentExerciseId, currentFocusStepId, currentSetIndex,
// focusActualSetDrafts. Preserves all historical `sets`/`warmupSets`.

import Foundation
import IronPathDomain

public struct SessionLifecycleResidueRepair: RepairDefinition {
    public let repairId: String = "sessionLifecycleResidueV1"
    public let version: Int = 1
    public let layer: RepairLayer = .safeAuto
    public let category: RepairCategory = .sessionLifecycle
    public let description: String = "清理已完成会话的休息计时与聚焦草稿残留"
    public let affectedAppDataPaths: [String] = [
        "history[].restTimerState",
        "history[].currentExerciseId",
        "history[].currentFocusStepId",
        "history[].currentSetIndex",
        "history[].focusActualSetDrafts",
    ]
    public let supportsApply: Bool = true

    public init() {}

    private struct Finding {
        let sessionId: String
        let date: String?
        let flags: [String]
    }

    private func collectFindings(_ history: [TrainingSession]) -> [Finding] {
        var out: [Finding] = []
        for session in history {
            guard session.completed == true else { continue }
            var flags: [String] = []
            if case .object(let obj) = (session.restTimerState ?? .null),
               obj["isRunning"]?.boolValue == true {
                flags.append("restTimerState.isRunning")
            }
            if let id = session.currentExerciseId, !id.isEmpty {
                flags.append("currentExerciseId")
            }
            if let id = session.currentFocusStepId, !id.isEmpty, id != "completed" {
                flags.append("currentFocusStepId")
            }
            if let idx = session.currentSetIndex, let i = idx.intValue, i != 0, i != -1 {
                flags.append("currentSetIndex")
            }
            if let drafts = session.focusActualSetDrafts, !drafts.isEmpty {
                flags.append("focusActualSetDrafts")
            }
            if !flags.isEmpty {
                out.append(Finding(sessionId: session.id ?? "", date: session.date, flags: flags))
            }
        }
        return out
    }

    public func detect(_ appData: AppData) -> RepairDetectResult {
        let findings = collectFindings(appData.history)
        let detected = !findings.isEmpty
        return RepairDetectResult(
            repairId: repairId,
            detected: detected,
            occurrences: findings.count,
            affectedIds: findings.map { $0.sessionId },
            severity: detected ? .warning : .info,
            userMessage: detected
                ? "已完成会话仍带有训练状态残留：\(findings.count) 个"
                : "已完成会话状态干净"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let findings = collectFindings(appData.history)
        let sample = findings.prefix(3).map { f -> RepairDryRunBeforeAfter in
            RepairDryRunBeforeAfter(
                id: f.sessionId,
                before: "\(f.date ?? ""): \(f.flags.joined(separator: ", "))",
                after: "休息计时关闭、当前指针清空、聚焦草稿清空（历史 sets 保留）"
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "关闭已完成会话的休息计时器、清空 currentExerciseId / currentFocusStepId / currentSetIndex、移除 focusActualSetDrafts。已记录的训练 set 不会被删除或修改。",
            changedPaths: affectedAppDataPaths,
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let findings = collectFindings(appData.history)
        let affectedIds = Set(findings.map { $0.sessionId })
        let updatedHistory: [JSONValue] = (appData.root["history"]?.arrayValue ?? []).map { entry in
            guard let typed = try? TrainingSession(decoding: entry) else { return entry }
            guard let id = typed.id, affectedIds.contains(id) else { return entry }
            let cleaned = applySessionLifecycleGuard(typed).session
            return cleaned.encoded()
        }
        let newRoot = upsertKey(appData.root, "history", to: .array(updatedHistory))
        let repaired = AppData(schemaVersion: appData.schemaVersion, root: newRoot)
        let receipt = buildReceipt(ReceiptParams(
            repairId: repairId,
            category: category,
            action: "清理已完成会话的休息计时与聚焦草稿残留",
            affectedIds: findings.map { $0.sessionId },
            beforeSummary: "\(findings.count) 个已完成会话存在状态残留",
            afterSummary: "已完成会话恢复为完成态；历史 set 记录保留",
            repairedAt: options?.repairedAt
        ))
        return RepairApplyResult(
            repairId: repairId,
            status: .applied,
            repairedData: repaired,
            receipt: receipt,
            warnings: []
        )
    }
}
