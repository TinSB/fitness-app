// SetIndexRenumberRepair — iOS-3C safe_auto recipe (set_index_renumber).
//
// Swift port of `retired web reference`.
// Renumbers `history[].exercises[].sets[].setIndex` to 0..n-1 when
// the original index is either ALL zeros or contains duplicates.
// Preserves every other set field: id, weight, actualWeightKg, reps,
// RIR, RPE, painFlag, completionStatus, done, etc.
//
// Per-exercise / per-session scope only — never moves sets between
// exercises and never touches `TrainingSetLog.id`.

import Foundation
import RedeDomain

public struct SetIndexRenumberRepair: RepairDefinition {
    public let repairId: String = "setIndexRenumberV1"
    public let version: Int = 1
    public let layer: RepairLayer = .safeAuto
    public let category: RepairCategory = .setIndexRenumber
    public let description: String = "按顺序重新编号 setIndex"
    public let affectedAppDataPaths: [String] = ["history[].exercises[].sets[].setIndex"]
    public let supportsApply: Bool = true

    public init() {}

    private struct Finding {
        let sessionId: String
        let exerciseId: String
        let exerciseName: String
        let before: [Int]
        let after: [Int]
        var affectedId: String { "\(sessionId)/\(exerciseId)" }
    }

    private func needsRenumber(_ before: [Int]) -> Bool {
        if before.count < 2 { return false }
        let allZero = before.allSatisfy { $0 == 0 }
        let unique = Set(before).count
        let hasDuplicates = unique != before.count
        return allZero || hasDuplicates
    }

    private func collect(_ history: [TrainingSession]) -> [Finding] {
        var out: [Finding] = []
        for session in history {
            guard let sid = session.id else { continue }
            for exercise in (session.exercises ?? []) {
                guard let eid = exercise.id else { continue }
                guard let sets = exercise.sets, sets.count >= 2 else { continue }
                let before = sets.map { $0.setIndex?.intValue ?? -1 }
                if !needsRenumber(before) { continue }
                let after = Array(0..<sets.count)
                out.append(Finding(
                    sessionId: sid,
                    exerciseId: eid,
                    exerciseName: exercise.name ?? eid,
                    before: before,
                    after: after
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
                ? "\(findings.count) 个动作的 set 序号全部为 0 或重复，会影响顺序排序"
                : "set 序号顺序正常"
        )
    }

    public func dryRun(_ appData: AppData) -> RepairDryRunResult {
        let detectResult = detect(appData)
        let findings = collect(appData.history)
        let sample = findings.prefix(3).map { f -> RepairDryRunBeforeAfter in
            RepairDryRunBeforeAfter(
                id: f.affectedId,
                before: "\(f.exerciseName): setIndex=[\(f.before.map(String.init).joined(separator: ","))]",
                after: "\(f.exerciseName): setIndex=[\(f.after.map(String.init).joined(separator: ","))]"
            )
        }
        return RepairDryRunResult(
            detect: detectResult,
            changeSummary: "按 sets 数组顺序重新编号 setIndex (0..n-1)。真实重量/次数/RIR/set ID 不变。",
            changedPaths: affectedAppDataPaths,
            beforeAfterSample: Array(sample),
            idempotencyKey: hashIdempotencyKey(repairId: repairId, affectedIds: detectResult.affectedIds)
        )
    }

    public func apply(_ appData: AppData, options: RepairApplyOptions?) throws -> RepairApplyResult {
        let findings = collect(appData.history)
        // Index findings for O(1) lookup during the history rewrite.
        var bySessionExercise: [String: Bool] = [:]
        for f in findings {
            bySessionExercise[f.affectedId] = true
        }

        let updatedHistory: [JSONValue] = (appData.root["history"]?.arrayValue ?? []).map { entry in
            guard let session = try? TrainingSession(decoding: entry) else { return entry }
            guard let sid = session.id else { return entry }
            // Quick check: any exercise in this session need renumber?
            let needsRewrite = (session.exercises ?? []).contains { ex in
                if let eid = ex.id, bySessionExercise["\(sid)/\(eid)"] == true { return true }
                return false
            }
            if !needsRewrite { return entry }

            let rewrittenExercises: [ExercisePrescription] = (session.exercises ?? []).map { ex -> ExercisePrescription in
                guard let eid = ex.id, bySessionExercise["\(sid)/\(eid)"] == true else { return ex }
                guard let sets = ex.sets else { return ex }
                let renumberedSets: [TrainingSetLog] = sets.enumerated().map { idx, log -> TrainingSetLog in
                    TrainingSetLog(
                        id: log.id,
                        setIndex: .integer(Int64(idx)),
                        exerciseId: log.exerciseId,
                        originalExerciseId: log.originalExerciseId,
                        actualExerciseId: log.actualExerciseId,
                        weight: log.weight,
                        actualWeightKg: log.actualWeightKg,
                        displayWeight: log.displayWeight,
                        displayUnit: log.displayUnit,
                        reps: log.reps,
                        rir: log.rir,
                        rpe: log.rpe,
                        techniqueQuality: log.techniqueQuality,
                        painFlag: log.painFlag,
                        painArea: log.painArea,
                        painSeverity: log.painSeverity,
                        completedAt: log.completedAt,
                        completionStatus: log.completionStatus,
                        done: log.done,
                        _unknown: log._unknown
                    )
                }
                return ExercisePrescription(
                    id: ex.id,
                    exerciseId: ex.exerciseId,
                    name: ex.name,
                    originalExerciseId: ex.originalExerciseId,
                    actualExerciseId: ex.actualExerciseId,
                    displayExerciseId: ex.displayExerciseId,
                    recordExerciseId: ex.recordExerciseId,
                    sets: renumberedSets,
                    warmupSets: ex.warmupSets,
                    plannedSets: ex.plannedSets,
                    prescription: ex.prescription,
                    suggestion: ex.suggestion,
                    adjustment: ex.adjustment,
                    warning: ex.warning,
                    explanations: ex.explanations,
                    _unknown: ex._unknown
                )
            }

            let rebuiltSession = TrainingSession(
                id: session.id,
                date: session.date,
                startedAt: session.startedAt,
                finishedAt: session.finishedAt,
                durationMin: session.durationMin,
                completed: session.completed,
                earlyEndReason: session.earlyEndReason,
                restTimerState: session.restTimerState,
                currentExerciseId: session.currentExerciseId,
                currentFocusStepId: session.currentFocusStepId,
                currentSetIndex: session.currentSetIndex,
                focusSessionComplete: session.focusSessionComplete,
                focusCompletedStepIds: session.focusCompletedStepIds,
                focusActualSetDrafts: session.focusActualSetDrafts,
                focusWarmupSetLogs: session.focusWarmupSetLogs,
                exercises: rewrittenExercises,
                _unknown: session._unknown
            )
            return rebuiltSession.encoded()
        }

        let newRoot = upsertKey(appData.root, "history", to: .array(updatedHistory))
        let repaired = AppData(schemaVersion: appData.schemaVersion, root: newRoot)
        let receipt = buildReceipt(ReceiptParams(
            repairId: repairId,
            category: category,
            action: "按顺序重新编号 setIndex（保留真实重量/次数/RIR/set ID）",
            affectedIds: findings.map { $0.affectedId },
            beforeSummary: "\(findings.count) 个动作 setIndex 异常",
            afterSummary: "已按数组顺序重新编号",
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
