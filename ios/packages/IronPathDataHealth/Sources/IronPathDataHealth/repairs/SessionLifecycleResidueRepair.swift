// SessionLifecycleResidueRepair — iOS-3B safe repair recipe (safe_auto).
//
// Swift port of `retired web reference`
// — with one DELIBERATE iOS-3B safety divergence from the legacy web schema source:
//
//   * `focusActualSetDrafts` is NEVER cleared by `apply()`. The legacy web schema
//     implementation (and iOS-3A's `applySessionLifecycleGuard` that
//     CleanAppDataView uses in-memory) blanks the array to `[]`. The
//     drafts however are user-entered Focus Mode data, and we cannot
//     prove on the AppData side that every draft has already been
//     committed into `exercises[].sets`. Persisting a clear here
//     would risk losing user data.
//
//   The in-memory projection (CleanAppDataView) still applies the
//   blanking to keep recommendation downstream pristine; the
//   on-disk repair instead just rewrites the 4 *active-pointer*
//   residue fields:
//       - restTimerState.isRunning  (force false)
//       - currentExerciseId         (force "")
//       - currentFocusStepId        (force "completed")
//       - currentSetIndex           (force -1)
//
//   detect()/dryRun() still surface drafts presence so users see the
//   diagnostic, but apply() leaves drafts verbatim and skips sessions
//   whose only residue is the drafts array.

import Foundation
import IronPathDomain

public struct SessionLifecycleResidueRepair: RepairDefinition {
    public let repairId: String = "sessionLifecycleResidueV1"
    public let version: Int = 1
    public let layer: RepairLayer = .safeAuto
    public let category: RepairCategory = .sessionLifecycle
    public let description: String = "清理已完成会话的休息计时与当前指针残留"
    public let affectedAppDataPaths: [String] = [
        "history[].restTimerState",
        "history[].currentExerciseId",
        "history[].currentFocusStepId",
        "history[].currentSetIndex",
        // NOTE: focusActualSetDrafts is intentionally NOT listed —
        // iOS-3B preserves the array (see file-header rationale).
    ]
    public let supportsApply: Bool = true

    public init() {}

    private struct Finding {
        let sessionId: String
        let date: String?
        let flags: [String]
        /// True if at least one non-drafts active-pointer residue is
        /// present. Used by apply() to decide which sessions actually
        /// receive a rewrite — drafts-only findings are detected (so
        /// users see them) but NOT rewritten by apply().
        let hasActivePointerResidue: Bool
    }

    private func collectFindings(_ history: [TrainingSession]) -> [Finding] {
        var out: [Finding] = []
        for session in history {
            guard session.completed == true else { continue }
            var flags: [String] = []
            var hasActive = false
            if case .object(let obj) = (session.restTimerState ?? .null),
               obj["isRunning"]?.boolValue == true {
                flags.append("restTimerState.isRunning")
                hasActive = true
            }
            if let id = session.currentExerciseId, !id.isEmpty {
                flags.append("currentExerciseId")
                hasActive = true
            }
            if let id = session.currentFocusStepId, !id.isEmpty, id != "completed" {
                flags.append("currentFocusStepId")
                hasActive = true
            }
            if let idx = session.currentSetIndex, let i = idx.intValue, i != 0, i != -1 {
                flags.append("currentSetIndex")
                hasActive = true
            }
            if let drafts = session.focusActualSetDrafts, !drafts.isEmpty {
                flags.append("focusActualSetDrafts")
                // NOT marking hasActive — drafts alone are not auto-cleaned.
            }
            if !flags.isEmpty {
                out.append(Finding(
                    sessionId: session.id ?? "",
                    date: session.date,
                    flags: flags,
                    hasActivePointerResidue: hasActive
                ))
            }
        }
        return out
    }

    public func detect(_ appData: AppData) -> RepairDetectResult {
        let findings = collectFindings(appData.history)
        let cleanable = findings.filter { $0.hasActivePointerResidue }
        // detect.detected reflects only what apply() can act on, so
        // the orchestrator's idempotency-by-affectedIds stays stable
        // across runs. Drafts-only findings are exposed via the user
        // message (audit signal) but don't trigger another apply.
        let detected = !cleanable.isEmpty
        let draftsOnlyCount = findings.count - cleanable.count
        let userMessage: String
        if !detected && draftsOnlyCount == 0 {
            userMessage = "已完成会话状态干净"
        } else if !detected {
            userMessage = "\(draftsOnlyCount) 个已完成会话仅 focusActualSetDrafts 残留（保留为用户数据；iOS-3B 不持久化清空）"
        } else if draftsOnlyCount > 0 {
            userMessage = "已完成会话存在活动指针残留：\(cleanable.count) 个（另有 \(draftsOnlyCount) 个仅 drafts 残留，保留）"
        } else {
            userMessage = "已完成会话存在活动指针残留：\(cleanable.count) 个"
        }
        return RepairDetectResult(
            repairId: repairId,
            detected: detected,
            occurrences: cleanable.count,
            affectedIds: cleanable.map { $0.sessionId },
            severity: detected ? .warning : .info,
            userMessage: userMessage
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let findings = collectFindings(appData.history)
        let sample = findings.prefix(3).map { f -> RepairDryRunBeforeAfter in
            let afterText: String
            if f.hasActivePointerResidue {
                afterText = "休息计时关闭、当前指针清空、focusActualSetDrafts 保留为用户数据"
            } else {
                afterText = "仅 focusActualSetDrafts 残留 — iOS-3B 不持久化清空，保留为用户数据"
            }
            return RepairDryRunBeforeAfter(
                id: f.sessionId,
                before: "\(f.date ?? ""): \(f.flags.joined(separator: ", "))",
                after: afterText
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "关闭已完成会话的休息计时器、清空 currentExerciseId / currentFocusStepId / currentSetIndex。focusActualSetDrafts 在 AppData 中保留不变（CleanAppDataView 在内存投影中剔除以保护推荐输入）。已记录的训练 set / warmup logs 不会被删除或修改。",
            changedPaths: affectedAppDataPaths,
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let findings = collectFindings(appData.history)
        // Only sessions with active-pointer residue actually get
        // rewritten. Drafts-only findings are reported but the
        // AppData is left unchanged for them.
        let cleanableIds = Set(findings.filter { $0.hasActivePointerResidue }.map { $0.sessionId })

        let updatedHistory: [JSONValue] = (appData.root["history"]?.arrayValue ?? []).map { entry in
            guard let typed = try? TrainingSession(decoding: entry) else { return entry }
            guard let id = typed.id, cleanableIds.contains(id) else { return entry }
            return cleanedSessionPreservingDrafts(typed).encoded()
        }
        let newRoot = upsertKey(appData.root, "history", to: .array(updatedHistory))
        let repaired = AppData(schemaVersion: appData.schemaVersion, root: newRoot)

        let cleanedCount = cleanableIds.count
        let draftsOnlyCount = findings.count - cleanedCount
        let beforeSummary: String
        if draftsOnlyCount > 0 {
            beforeSummary = "\(findings.count) 个已完成会话存在残留；其中 \(cleanedCount) 个需要清理活动指针，\(draftsOnlyCount) 个仅 drafts 残留（保留）"
        } else {
            beforeSummary = "\(cleanedCount) 个已完成会话存在活动指针残留"
        }
        let afterSummary = draftsOnlyCount > 0
            ? "已完成会话恢复为完成态；focusActualSetDrafts / 历史 set / warmup logs 保留"
            : "活动指针清空；focusActualSetDrafts / 历史 set / warmup logs 保留"
        let receipt = buildReceipt(ReceiptParams(
            repairId: repairId,
            category: category,
            action: "清理已完成会话的活动指针残留（focusActualSetDrafts 保留为用户数据）",
            affectedIds: Array(cleanableIds),
            beforeSummary: beforeSummary,
            afterSummary: afterSummary,
            repairedAt: options?.repairedAt
        ))
        return RepairApplyResult(
            repairId: repairId,
            status: .applied,
            repairedData: repaired,
            receipt: receipt,
            warnings: draftsOnlyCount > 0
                ? ["focusActualSetDrafts preserved on \(draftsOnlyCount) sessions; CleanAppDataView excludes them in-memory for recommendation"]
                : []
        )
    }

    /// Self-contained session cleaner that mirrors
    /// `applySessionLifecycleGuard` for the four active-pointer fields
    /// but DOES NOT touch `focusActualSetDrafts` /
    /// `focusWarmupSetLogs` / `focusCompletedStepIds` / `exercises`.
    /// This is iOS-3B's documented safety divergence from iOS-3A.
    private func cleanedSessionPreservingDrafts(_ session: TrainingSession) -> TrainingSession {
        var nextRestTimer = session.restTimerState
        if case .object(let obj) = (session.restTimerState ?? .null),
           obj["isRunning"]?.boolValue == true {
            let rewritten = obj.entries.map { entry -> OrderedJSONObject.Entry in
                if entry.key == "isRunning" {
                    return OrderedJSONObject.Entry(key: "isRunning", value: .bool(false))
                }
                return entry
            }
            nextRestTimer = .object(OrderedJSONObject(entries: rewritten))
        }
        let nextCurrentExerciseId: String?
        if let id = session.currentExerciseId, !id.isEmpty {
            nextCurrentExerciseId = ""
        } else {
            nextCurrentExerciseId = session.currentExerciseId
        }
        let nextCurrentFocusStepId: String?
        if let id = session.currentFocusStepId, !id.isEmpty, id != "completed" {
            nextCurrentFocusStepId = "completed"
        } else {
            nextCurrentFocusStepId = session.currentFocusStepId
        }
        let nextCurrentSetIndex: NumberRepr?
        if let idx = session.currentSetIndex, let i = idx.intValue, i != 0, i != -1 {
            nextCurrentSetIndex = .integer(-1)
        } else {
            nextCurrentSetIndex = session.currentSetIndex
        }
        return TrainingSession(
            id: session.id,
            date: session.date,
            startedAt: session.startedAt,
            finishedAt: session.finishedAt,
            durationMin: session.durationMin,
            completed: session.completed,
            earlyEndReason: session.earlyEndReason,
            restTimerState: nextRestTimer,
            currentExerciseId: nextCurrentExerciseId,
            currentFocusStepId: nextCurrentFocusStepId,
            currentSetIndex: nextCurrentSetIndex,
            focusSessionComplete: session.focusSessionComplete,
            focusCompletedStepIds: session.focusCompletedStepIds,
            focusActualSetDrafts: session.focusActualSetDrafts,   // ← preserved
            focusWarmupSetLogs: session.focusWarmupSetLogs,       // ← preserved
            exercises: session.exercises,                          // ← preserved
            _unknown: session._unknown
        )
    }
}
