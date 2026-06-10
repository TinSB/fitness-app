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
        for exercisePlan in flow.plan.exercises {
            guard let observations = flow.observationsByExercise[exercisePlan.exerciseId],
                  !observations.isEmpty else { continue }

            var sets: [JSONValue] = []
            for (index, obs) in observations.enumerated() {
                var set: [String: JSONValue] = [
                    "id": .string("\(sessionId)-\(exercisePlan.exerciseId)-\(index + 1)"),
                    "setIndex": .int(Int64(index + 1)),
                    "exerciseId": .string(exercisePlan.exerciseId),
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
                "id": .string("\(sessionId)-\(exercisePlan.exerciseId)"),
                "exerciseId": .string(exercisePlan.exerciseId),
                "sets": .array(sets),
            ]
            if let replacement = flow.replacements.first(where: { $0.actualExerciseId == exercisePlan.exerciseId }) {
                exercise["originalExerciseId"] = .string(replacement.originalExerciseId)
                exercise["actualExerciseId"] = .string(replacement.actualExerciseId)
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
            // 跳过留痕统一归到「最终动作 id」：换动作前的跳过重写到 actualExerciseId，
            // 保证 skippedSets 与 exercises 数组可对齐（M4 进展层按动作索引）。
            storage["skippedSets"] = .array(flow.skippedSets.map { skip in
                let finalId = flow.replacements
                    .first(where: { $0.originalExerciseId == skip.exerciseId })?
                    .actualExerciseId ?? skip.exerciseId
                return .object([
                    "exerciseId": .string(finalId),
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
        return TrainingSession(storage: storage)
    }

    /// 整数重量存 int（开门口径：JSON 不出现无谓的 .0）。
    private static func weightValue(_ value: Double) -> JSONValue {
        value == value.rounded() ? .int(Int64(value)) : .double(value)
    }
}
