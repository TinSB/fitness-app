// ReplacementEquivalenceAuditRepair — iOS-3C audit_only recipe.
//
// Swift port of `src/dataHealth/repairs/replacementEquivalenceAuditV1.ts`.
// Detects vertical-pull exercises mapped to horizontal-pull
// equivalence chains, and vertical-push exercises mapped to fly
// equivalence chains. Audit-only: `supportsApply = true` (so
// orchestrator can route through it) but `apply` returns `.skipped`
// with AppData untouched.
//
// iOS-3C stays audit-only because there is no curated chain map.
// iOS-3D / iOS-4 may ship that map and escalate this to safe-auto.

import Foundation
import IronPathDomain

public struct ReplacementEquivalenceAuditRepair: RepairDefinition {
    public let repairId: String = "replacementEquivalenceAuditV1"
    public let version: Int = 1
    public let layer: RepairLayer = .auditOnly
    public let category: RepairCategory = .identityAudit
    public let description: String = "replacement / equivalence 链审计"
    public let affectedAppDataPaths: [String] = []
    public let supportsApply: Bool = true

    public static let verticalPullIds: Set<String> = ["assisted-pull-up", "pull-up", "chin-up"]
    public static let verticalPushIds: Set<String> = ["assisted-dip", "dip", "bench-dip"]

    public init() {}

    private struct Finding {
        let sessionId: String
        let exerciseId: String
        let exerciseName: String
        let baseId: String?
        let actualExerciseId: String?
        let originalExerciseId: String?
        let reason: String
        var affectedId: String { "\(sessionId)/\(exerciseId)" }
    }

    private func readChainId(_ exercise: ExercisePrescription) -> String? {
        // `equivalence` is not in iOS-2C's typed ExercisePrescription
        // surface; the field lives inside `_unknown`. iOS-3C reads it
        // directly there.
        guard case .object(let equivalence) = (exercise._unknown["equivalence"] ?? .null) else {
            return nil
        }
        if let chain = equivalence["chainId"]?.stringValue { return chain }
        if let id = equivalence["id"]?.stringValue { return id }
        return nil
    }

    private func readBaseId(_ exercise: ExercisePrescription) -> String? {
        exercise._unknown["baseId"]?.stringValue
    }

    private func isHorizontalPullChain(_ chainId: String?) -> Bool {
        guard let c = chainId else { return false }
        return c.contains("horizontal-pull")
    }

    private func isFlyChain(_ chainId: String?) -> Bool {
        chainId == "fly"
    }

    private func collect(_ history: [TrainingSession]) -> [Finding] {
        var out: [Finding] = []
        for session in history {
            guard let sid = session.id else { continue }
            for exercise in (session.exercises ?? []) {
                guard let eid = exercise.id else { continue }
                let chainId = readChainId(exercise)
                let actual = exercise.actualExerciseId
                var reasons: [String] = []
                if let a = actual, Self.verticalPullIds.contains(a), isHorizontalPullChain(chainId) {
                    reasons.append("垂直拉动作匹配到水平拉链：chainId=\(chainId ?? "?")")
                }
                if let a = actual, Self.verticalPushIds.contains(a), isFlyChain(chainId) {
                    reasons.append("垂直推动作匹配到飞鸟链：chainId=\(chainId ?? "?")")
                }
                if reasons.isEmpty { continue }
                out.append(Finding(
                    sessionId: sid,
                    exerciseId: eid,
                    exerciseName: exercise.name ?? eid,
                    baseId: readBaseId(exercise),
                    actualExerciseId: actual,
                    originalExerciseId: exercise.originalExerciseId,
                    reason: reasons.joined(separator: "; ")
                ))
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
            affectedIds: findings.map { $0.affectedId },
            severity: detected ? .warning : .info,
            userMessage: detected
                ? "\(findings.count) 个动作的 replacement/equivalence 链与实际语义不一致；需要人工策划替换链表"
                : "replacement/equivalence 元数据一致"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let findings = collect(appData.history)
        let sample = findings.prefix(3).map { f -> RepairDryRunBeforeAfter in
            RepairDryRunBeforeAfter(
                id: f.affectedId,
                before: "\(f.exerciseName) (actual=\(f.actualExerciseId ?? "?"), base=\(f.baseId ?? "?")): \(f.reason)",
                after: "审计：保留 PR/总量；不自动改写 chainId/baseId；需要人工策划"
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "审计模式：列出 replacement / equivalence 链与动作语义不一致的记录。V1 不自动重映射，避免污染 PR / 总量。",
            changedPaths: [],
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let findings = collect(appData.history)
        let beforeSummary = findings.isEmpty
            ? "replacement 元数据一致"
            : "\(findings.count) 个动作 chainId/baseId 与语义不一致（仅审计）"
        return RepairApplyResult(
            repairId: repairId,
            status: .skipped,
            repairedData: appData,
            receipt: buildReceipt(ReceiptParams(
                repairId: repairId,
                category: category,
                action: "replacement / equivalence 链审计",
                affectedIds: findings.map { $0.affectedId },
                beforeSummary: beforeSummary,
                afterSummary: "未修改 AppData；等待人工策划替换链",
                repairedAt: options?.repairedAt
            )),
            warnings: ["audit-only: identity rewrite requires curated mapping"]
        )
    }
}
