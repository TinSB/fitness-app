// CleanAppDataViewBuilder — raw → clean 的唯一投影入口（纯函数，无 IO/clock）。
//
// M1-3 最小 guard 规则（丢弃式，不就地修补）：
// - session：必须是对象、有非空 id、有非空 date、completed == true；重复 id 保首个。
// - exercise：必须有非空 exerciseId（缺失则整组 sets 不可归因，一并丢弃）。
// - set：weight ≥ 0 且 reps ≥ 1；rir 仅在 0...15 时通过，否则置 nil 留痕。
// - profile 标量：宽松合理范围之外投影为 nil 留痕；trainingLevel 只认已知档位。

import RedeDomain

public enum CleanAppDataViewBuilder {
    private static let knownTrainingLevels: Set<String> = ["beginner", "intermediate", "advanced"]

    public static func build(from appData: AppData) -> CleanAppDataView {
        var issues: [DataHealthIssue] = []

        var sessions: [CleanTrainingSession] = []
        var seenSessionIds: Set<String> = []
        let rawHistory = appData.storage["history"]?.asArray ?? []
        for element in rawHistory {
            guard let object = element.asObject else {
                issues.append(.sessionDropped(id: nil, reason: .notAnObject))
                continue
            }
            let session = TrainingSession(storage: object)
            guard let id = session.id, !id.isEmpty else {
                issues.append(.sessionDropped(id: nil, reason: .missingId))
                continue
            }
            guard session.completed == true else {
                issues.append(.sessionDropped(id: id, reason: .notCompleted))
                continue
            }
            guard let date = session.date, !date.isEmpty else {
                issues.append(.sessionDropped(id: id, reason: .missingDate))
                continue
            }
            guard seenSessionIds.insert(id).inserted else {
                issues.append(.sessionDropped(id: id, reason: .duplicateId))
                continue
            }
            let exercises = cleanExercises(of: session, sessionId: id, issues: &issues)
            sessions.append(CleanTrainingSession(id: id, date: date, exercises: exercises))
        }

        let profile = cleanProfile(appData.userProfile, issues: &issues)
        return CleanAppDataView(raw: appData, sessions: sessions, profile: profile, issues: issues)
    }

    private static func cleanExercises(
        of session: TrainingSession,
        sessionId: String,
        issues: inout [DataHealthIssue]
    ) -> [CleanExercise] {
        var result: [CleanExercise] = []
        for exercise in session.exercises {
            guard let exerciseId = exercise.exerciseId, !exerciseId.isEmpty else {
                issues.append(.exerciseDropped(sessionId: sessionId, reason: .missingExerciseId))
                continue
            }
            var sets: [CleanLoggedSet] = []
            for set in exercise.sets {
                guard let weight = set.weight, weight >= 0 else {
                    issues.append(.setDropped(sessionId: sessionId, exerciseId: exerciseId, reason: .invalidWeight))
                    continue
                }
                guard let reps = set.reps, reps >= 1 else {
                    issues.append(.setDropped(sessionId: sessionId, exerciseId: exerciseId, reason: .invalidReps))
                    continue
                }
                var rir = set.rir
                if let value = rir, !(0...15).contains(value) {
                    issues.append(.setFieldIgnored(sessionId: sessionId, exerciseId: exerciseId, field: "rir"))
                    rir = nil
                }
                sets.append(CleanLoggedSet(weight: weight, reps: reps, rir: rir))
            }
            result.append(CleanExercise(exerciseId: exerciseId, sets: sets))
        }
        return result
    }

    private static func cleanProfile(
        _ profile: UserProfile,
        issues: inout [DataHealthIssue]
    ) -> CleanProfile {
        func scalar<T: Comparable>(_ value: T?, _ range: ClosedRange<T>, _ field: String) -> T? {
            guard let value else { return nil }
            guard range.contains(value) else {
                issues.append(.profileFieldIgnored(field: field))
                return nil
            }
            return value
        }

        var trainingLevel = profile.trainingLevel
        if let level = trainingLevel, !knownTrainingLevels.contains(level) {
            issues.append(.profileFieldIgnored(field: "trainingLevel"))
            trainingLevel = nil
        }

        return CleanProfile(
            trainingLevel: trainingLevel,
            sex: profile.sex,
            age: scalar(profile.age, 10...120, "age"),
            heightCm: scalar(profile.heightCm, 100...250, "heightCm"),
            weightKg: scalar(profile.weightKg, 20...400, "weightKg"),
            weeklyTrainingDays: scalar(profile.weeklyTrainingDays, 1...14, "weeklyTrainingDays")
        )
    }
}
