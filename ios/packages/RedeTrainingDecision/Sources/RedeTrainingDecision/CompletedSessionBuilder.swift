// CompletedSessionBuilder — 训练流终态 → canonical TrainingSession（M3-3）。
//
// 只记录用户事实：实际完成的组（重量/次数/RIR/疼痛 flag）、跳过留痕、
// 替换审计（originalExerciseId/actualExerciseId）、收尾原因——处方目标值
// 等 engine 输出一律不落盘（系统逻辑 §5「不把 engine output 写回真相」）。
// 字段名沿 legacy 词汇表（开门设计）；id/日期/时间由调用方注入（无 clock）。

import RedeDomain

public enum CompletedSessionBuilder {
    public static func build(
        from flow: TrainFlowState,
        sessionId: String,
        dateISO: String,
        startedAtISO: String,
        finishedAtISO: String,
        durationMinutes: Int
    ) -> TrainingSession {
        var exercises: [JSONValue] = []
        // skipSet 也是 occurrence 事实：split 端点即使没有完成组也要落盘；future
        // terminal 被移除后，已封存 root 虽已溶解 link，仍是普通事实 occurrence。
        // 普通 skip-only 动作既未 sealed 也无 link，继续沿用旧的顶层留痕。
        let persistedSegments = flow.exerciseFactSegments.filter { segment in
            !segment.observations.isEmpty
                || (!segment.skippedSets.isEmpty
                    && (segment.isSealed || !segment.replacementLinks.isEmpty))
        }
        let occurrenceCounts = Dictionary(grouping: persistedSegments, by: \.exerciseId)
            .mapValues(\.count)
        var occurrenceOrdinals: [String: Int] = [:]

        for segment in persistedSegments {
            let occurrenceOrdinal = (occurrenceOrdinals[segment.exerciseId] ?? 0) + 1
            occurrenceOrdinals[segment.exerciseId] = occurrenceOrdinal
            let recordStem = occurrenceCounts[segment.exerciseId, default: 0] > 1
                ? "\(sessionId)-\(segment.exerciseId)-occurrence-\(occurrenceOrdinal)"
                : "\(sessionId)-\(segment.exerciseId)"

            var sets: [JSONValue] = []
            for (index, obs) in segment.observations.enumerated() {
                var set: [String: JSONValue] = [
                    "id": .string("\(recordStem)-\(index + 1)"),
                    "setIndex": .int(Int64(index + 1)),
                    "exerciseId": .string(segment.exerciseId),
                    "weight": weightValue(obs.weightKg),
                    "reps": .int(Int64(obs.reps)),
                    "done": .bool(true),
                    "completionStatus": .string("completed"),
                ]
                if let rir = obs.rir { set["rir"] = weightValue(rir) }
                if obs.painReported { set["painFlag"] = .bool(true) }
                sets.append(.object(set))
            }

            var exercise: [String: JSONValue] = [
                "id": .string(recordStem),
                "exerciseId": .string(segment.exerciseId),
                "sets": .array(sets),
            ]
            if let primaryLink = segment.replacementLinks.last {
                let replacement = primaryLink.replacement
                exercise["originalExerciseId"] = .string(replacement.originalExerciseId)
                exercise["actualExerciseId"] = .string(replacement.actualExerciseId)
                exercise["replacementRole"] = .string(primaryLink.role.rawValue)
            } else if let replacement = segment.replacementAudit {
                // 零事实替换沿用修复前的两个审计字段，不新增 role，保持字节 golden。
                exercise["originalExerciseId"] = .string(replacement.originalExerciseId)
                exercise["actualExerciseId"] = .string(replacement.actualExerciseId)
            }

            var allLinks = segment.replacementLinks
            if let replacementAudit = segment.replacementAudit,
               !allLinks.contains(where: { $0.replacement == replacementAudit }) {
                allLinks.insert(
                    TrainFlowState.SegmentReplacementLink(
                        replacement: replacementAudit,
                        role: .actual
                    ),
                    at: 0
                )
            }
            if allLinks.count > 1 {
                exercise["replacementLinks"] = .array(allLinks.map { link in
                    .object([
                        "originalExerciseId": .string(link.replacement.originalExerciseId),
                        "actualExerciseId": .string(link.replacement.actualExerciseId),
                        "replacementRole": .string(link.role.rawValue),
                    ])
                })
            }
            exercises.append(.object(exercise))
        }

        var storage: [String: JSONValue] = [
            "id": .string(sessionId),
            "date": .string(dateISO),
            "startedAt": .string(startedAtISO),
            "finishedAt": .string(finishedAtISO),
            "durationMin": .int(Int64(durationMinutes)),
            "completed": .bool(true),
            "templateId": .string(flow.plan.dayCode),
            "exercises": .array(exercises),
        ]
        if let endReason = flow.endReason {
            storage["endReason"] = .string(endReason.rawValue)
        }
        if !flow.skippedSets.isEmpty {
            // 跳过是发生时动作的用户事实；中途替换只承接剩余量，不改写历史归属。
            storage["skippedSets"] = .array(flow.skippedSets.map { skip in
                return .object([
                    "exerciseId": .string(skip.exerciseId),
                    "setIndex": .int(Int64(skip.setIndex)),
                    "reason": .string(skip.reason.rawValue),
                ])
            })
        }
        if !flow.skippedExercises.isEmpty {
            storage["skippedExercises"] = .array(flow.skippedExercises.map { skip in
                .object(["exerciseId": .string(skip.exerciseId), "reason": .string(skip.reason.rawValue)])
            })
        }
        if !flow.addedExercises.isEmpty || !flow.removedExercises.isEmpty {
            var edits: [String: JSONValue] = [:]
            if !flow.addedExercises.isEmpty {
                edits["added"] = .array(flow.addedExercises.map { addition in
                    .object([
                        "exerciseId": .string(addition.exerciseId),
                        "position": .int(Int64(addition.position)),
                    ])
                })
            }
            if !flow.removedExercises.isEmpty {
                edits["removed"] = .array(flow.removedExercises.map { removal in
                    .object([
                        "exerciseId": .string(removal.exercise.exerciseId),
                        "position": .int(Int64(removal.index)),
                    ])
                })
            }
            storage["sessionEdits"] = .object(edits)
        }
        return TrainingSession(storage: storage)
    }

    /// 整数重量存 int（开门口径：JSON 不出现无谓的 .0）。
    private static func weightValue(_ value: Double) -> JSONValue {
        value == value.rounded() ? .int(Int64(value)) : .double(value)
    }
}
