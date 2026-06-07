// ImpossibleDurationRepair — iOS-3B safe repair recipe (safe_auto).
//
// Swift port of `retired web reference`.
// Rewrites `history[].durationMin` when it exceeds 240 minutes (or
// the start→finish span exceeds 360 minutes). Uses the rounded span
// when sane; otherwise marks `durationInvalid = true` (in `_unknown`)
// and falls back to `DATA_HEALTH_FALLBACK_DURATION_MIN` (60).
// NEVER uses a 70-hour span as the repaired duration.

import Foundation
import IronPathDomain

public struct ImpossibleDurationRepair: RepairDefinition {
    public let repairId: String = "impossibleDurationV1"
    public let version: Int = 1
    public let layer: RepairLayer = .safeAuto
    public let category: RepairCategory = .durationSanity
    public let description: String = "修正不合理的训练时长"
    public let affectedAppDataPaths: [String] = [
        "history[].durationMin",
        "history[].durationInvalid",
    ]
    public let supportsApply: Bool = true

    public init() {}

    private struct Finding {
        let sessionId: String
        let date: String?
        let rawDurationMin: Double?
        let rawSpanMin: Double?
        let derivedDurationMin: NumberRepr?
        let durationInvalid: Bool
    }

    private func collectFindings(_ history: [TrainingSession]) -> [Finding] {
        var out: [Finding] = []
        let impossible = Double(DataHealthConstants.impossibleDurationMin)
        for session in history {
            // Skip sessions already marked durationInvalid in _unknown.
            if session._unknown["durationInvalid"]?.boolValue == true {
                continue
            }
            let outcome = applyDurationGuard(session)
            let rawDurationOver = (outcome.rawDurationMin?.doubleValue ?? -1) > impossible
            let rawSpanOver = (outcome.rawSpanMin ?? -1) > impossible * 1.5
            if !rawDurationOver && !rawSpanOver { continue }
            out.append(Finding(
                sessionId: session.id ?? "",
                date: session.date,
                rawDurationMin: outcome.rawDurationMin?.doubleValue,
                rawSpanMin: outcome.rawSpanMin,
                derivedDurationMin: outcome.derivedDurationMin,
                durationInvalid: outcome.durationInvalid
            ))
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
                ? "\(findings.count) 个会话训练时长不合理（>\(DataHealthConstants.impossibleDurationMin) 分钟）"
                : "所有会话训练时长在合理范围"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let findings = collectFindings(appData.history)
        let sample = findings.prefix(3).map { f -> RepairDryRunBeforeAfter in
            let rawDurStr = f.rawDurationMin.map { String(Int($0)) } ?? "?"
            let spanStr = f.rawSpanMin.map { String(Int($0)) } ?? "?"
            let afterStr: String
            if f.durationInvalid {
                afterStr = "标记 durationInvalid=true，疲劳/恢复运算不再使用此时长"
            } else if let d = f.derivedDurationMin?.intValue {
                afterStr = "修正为 \(d) 分钟（按合理跨度截取）"
            } else {
                afterStr = "fallback \(DataHealthConstants.fallbackDurationMin) 分钟"
            }
            return RepairDryRunBeforeAfter(
                id: f.sessionId,
                before: "\(f.date ?? ""): durationMin=\(rawDurStr), span=\(spanStr) 分钟",
                after: afterStr
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "把训练时长 >\(DataHealthConstants.impossibleDurationMin) 分钟的会话修正为合理跨度；若跨度本身也异常，则标记 durationInvalid=true 并使用 \(DataHealthConstants.fallbackDurationMin) 分钟 fallback 显示。原始 startedAt/finishedAt/sets 保留。",
            changedPaths: affectedAppDataPaths,
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let findings = collectFindings(appData.history)
        let byId: [String: Finding] = Dictionary(uniqueKeysWithValues: findings.map { ($0.sessionId, $0) })

        let updatedHistory: [JSONValue] = (appData.root["history"]?.arrayValue ?? []).map { entry in
            guard let typed = try? TrainingSession(decoding: entry) else { return entry }
            guard let id = typed.id, let finding = byId[id] else { return entry }
            // Build new session.
            let nextDurationMin: NumberRepr?
            let nextDurationInvalid: Bool
            if let derived = finding.derivedDurationMin, !finding.durationInvalid {
                nextDurationMin = derived
                nextDurationInvalid = false
            } else {
                nextDurationMin = .integer(Int64(DataHealthConstants.fallbackDurationMin))
                nextDurationInvalid = true
            }
            // Inject durationInvalid into _unknown carrier.
            let newUnknown = upsertKey(typed._unknown, "durationInvalid", to: .bool(nextDurationInvalid))
            let rebuilt = TrainingSession(
                id: typed.id,
                date: typed.date,
                startedAt: typed.startedAt,
                finishedAt: typed.finishedAt,
                durationMin: nextDurationMin,
                completed: typed.completed,
                earlyEndReason: typed.earlyEndReason,
                restTimerState: typed.restTimerState,
                currentExerciseId: typed.currentExerciseId,
                currentFocusStepId: typed.currentFocusStepId,
                currentSetIndex: typed.currentSetIndex,
                focusSessionComplete: typed.focusSessionComplete,
                focusCompletedStepIds: typed.focusCompletedStepIds,
                focusActualSetDrafts: typed.focusActualSetDrafts,
                focusWarmupSetLogs: typed.focusWarmupSetLogs,
                exercises: typed.exercises,
                _unknown: newUnknown
            )
            return rebuilt.encoded()
        }
        let newRoot = upsertKey(appData.root, "history", to: .array(updatedHistory))
        let repaired = AppData(schemaVersion: appData.schemaVersion, root: newRoot)
        let receipt = buildReceipt(ReceiptParams(
            repairId: repairId,
            category: category,
            action: "修正不合理的训练时长（保留时间戳与训练记录）",
            affectedIds: findings.map { $0.sessionId },
            beforeSummary: "\(findings.count) 个会话时长 >\(DataHealthConstants.impossibleDurationMin) 分钟",
            afterSummary: "已用合理跨度替换或标记为 durationInvalid",
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
