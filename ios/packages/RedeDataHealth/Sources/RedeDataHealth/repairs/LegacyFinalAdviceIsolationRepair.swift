// LegacyFinalAdviceIsolationRepair — iOS-3B repair recipe
// (runtime_guard, audit-only — does NOT mutate AppData).
//
// Swift port of `retired web reference`.
// Documents the historical legacy advice fields (suggestion/adjustment/
// warning + prescription.weeklyAdjustment + session.explanations +
// session.deloadDecision). The actual isolation is enforced upstream
// by `CleanAppDataView` — V2 recommendation never reads these fields.

import Foundation
import RedeDomain

public struct LegacyFinalAdviceIsolationRepair: RepairDefinition {
    public let repairId: String = "legacyFinalAdviceIsolationGuardV1"
    public let version: Int = 1
    public let layer: RepairLayer = .runtimeGuard
    public let category: RepairCategory = .legacyAdviceIsolation
    public let description: String = "旧版最终建议字段在 CleanAppDataView 中被剔除"
    public let affectedAppDataPaths: [String] = []
    public let supportsApply: Bool = true

    public static let legacyAdviceFields: [String] = [
        "exercise.suggestion",
        "exercise.adjustment",
        "exercise.warning",
        "exercise.prescription.weeklyAdjustment",
        "session.explanations",
        "session.deloadDecision",
    ]

    public init() {}

    private struct Finding {
        let sessionId: String
        let hits: [String]
    }

    private func collect(_ history: [TrainingSession]) -> [Finding] {
        var out: [Finding] = []
        for session in history {
            var hits: [String] = []
            if let explanations = session._unknown["explanations"]?.arrayValue, !explanations.isEmpty {
                hits.append("session.explanations")
            }
            if let deload = session._unknown["deloadDecision"], !deload.isNull {
                hits.append("session.deloadDecision")
            }
            for exercise in (session.exercises ?? []) {
                if let s = exercise.suggestion, !s.trimmingCharacters(in: .whitespaces).isEmpty {
                    hits.append("exercise.suggestion")
                }
                if let s = exercise.adjustment, !s.trimmingCharacters(in: .whitespaces).isEmpty {
                    hits.append("exercise.adjustment")
                }
                if let s = exercise.warning, !s.trimmingCharacters(in: .whitespaces).isEmpty {
                    hits.append("exercise.warning")
                }
                if case .object(let prescObj) = (exercise.prescription ?? .null),
                   let weekly = prescObj["weeklyAdjustment"]?.stringValue,
                   !weekly.trimmingCharacters(in: .whitespaces).isEmpty {
                    hits.append("exercise.prescription.weeklyAdjustment")
                }
            }
            if !hits.isEmpty {
                out.append(Finding(sessionId: session.id ?? "", hits: Array(Set(hits))))
            }
        }
        return out
    }

    public func detect(_ appData: AppData) -> RepairDetectResult {
        let findings = collect(appData.history)
        let detected = !findings.isEmpty
        return RepairDetectResult(
            repairId: repairId,
            detected: detected,
            occurrences: findings.count,
            affectedIds: findings.map { $0.sessionId },
            severity: detected ? .warning : .info,
            userMessage: detected
                ? "\(findings.count) 个历史会话仍保留旧版最终建议字段；Runtime Guard 已将其从 V2 推荐输入中剔除"
                : "没有发现旧版最终建议字段"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let findings = collect(appData.history)
        let sample = findings.prefix(3).map { f -> RepairDryRunBeforeAfter in
            RepairDryRunBeforeAfter(
                id: f.sessionId,
                before: "仍保留：\(f.hits.joined(separator: ", "))",
                after: "保留为历史快照；CleanAppDataView 已剔除这些字段，不进入 TrainingDecision"
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "Runtime Guard：CleanAppDataView 永远不向 TrainingDecision V2 暴露 suggestion / adjustment / warning / prescription.weeklyAdjustment / session.explanations / session.deloadDecision。AppData 本身保留旧字段，仅用于历史快照显示。",
            changedPaths: [],
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let findings = collect(appData.history)
        let beforeSummary = findings.isEmpty
            ? "没有旧版最终建议字段"
            : "\(findings.count) 个历史会话保留旧版字段（仅审计）"
        return RepairApplyResult(
            repairId: repairId,
            status: .skipped,
            repairedData: appData,
            receipt: buildReceipt(ReceiptParams(
                repairId: repairId,
                category: category,
                action: "运行时隔离旧版最终建议字段",
                affectedIds: findings.map { $0.sessionId },
                beforeSummary: beforeSummary,
                afterSummary: "未修改 AppData；CleanAppDataView 保证 V2 推荐输入不读取旧字段",
                repairedAt: options?.repairedAt
            )),
            warnings: ["runtime guard + audit: no AppData mutation; protection lives in CleanAppDataView"]
        )
    }
}
