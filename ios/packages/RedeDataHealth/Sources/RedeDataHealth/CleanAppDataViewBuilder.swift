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
    private static let knownEquipmentScenarios: Set<String> = ["commercial-gym", "home-dumbbell", "minimal"]
    private static let knownUnitSystems: Set<String> = ["kg", "lb"]

    public static func build(from appData: AppData) -> CleanAppDataView {
        var issues: [DataHealthIssue] = []

        var sessions: [CleanTrainingSession] = []
        var seenSessionIds: Set<String> = []
        let rawHistory = appData.storage["history"]?.asArray ?? []
        for element in rawHistory {
            guard let object = element.asObject else {
                issues.append(.sessionDropped(id: nil, dateISO: nil, reason: .notAnObject))
                continue
            }
            let session = TrainingSession(storage: object)
            let dateISO = session.date.flatMap(normalizedTrainingDate)
            guard let id = session.id, !id.isEmpty else {
                issues.append(.sessionDropped(id: nil, dateISO: dateISO, reason: .missingId))
                continue
            }
            guard session.completed == true else {
                issues.append(.sessionDropped(id: id, dateISO: dateISO, reason: .notCompleted))
                continue
            }
            guard let date = session.date, !date.isEmpty else {
                issues.append(.sessionDropped(id: id, dateISO: nil, reason: .missingDate))
                continue
            }
            guard let dateISO else {
                issues.append(.sessionDropped(id: id, dateISO: nil, reason: .invalidDateFormat))
                continue
            }
            guard seenSessionIds.insert(id).inserted else {
                issues.append(.sessionDropped(id: id, dateISO: dateISO, reason: .duplicateId))
                continue
            }
            let exercises = cleanExercises(
                of: session,
                sessionId: id,
                dateISO: dateISO,
                issues: &issues
            )
            sessions.append(CleanTrainingSession(id: id, date: date, exercises: exercises))
        }

        let profile = cleanProfile(appData.userProfile, issues: &issues)
        let program = cleanProgram(appData.programTemplate, issues: &issues)
        return CleanAppDataView(raw: appData, sessions: sessions, profile: profile, program: program, issues: issues)
    }

    private static func cleanProgram(
        _ program: ProgramTemplate,
        issues: inout [DataHealthIssue]
    ) -> CleanProgram {
        var daysPerWeek = program.daysPerWeek
        if let value = daysPerWeek, !(1...14).contains(value) {
            issues.append(.programFieldIgnored(field: "daysPerWeek"))
            daysPerWeek = nil
        }
        return CleanProgram(
            daysPerWeek: daysPerWeek,
            splitType: program.splitType,
            primaryGoal: program.primaryGoal
        )
    }

    /// 严格校验 "yyyy-MM-dd"（更长 ISO 串取前 10 位）：零填充、月 1-12、日按月/闰年。
    /// 下游引擎按天序号计算 recency，格式非法必须在本层留痕拦截，不许静默蒸发。
    private static func normalizedTrainingDate(_ date: String) -> String? {
        let s = String(date.prefix(10))
        let parts = s.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              (1...12).contains(month)
        else { return nil }
        let daysInMonth: Int
        switch month {
        case 1, 3, 5, 7, 8, 10, 12: daysInMonth = 31
        case 4, 6, 9, 11: daysInMonth = 30
        default:
            let isLeap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
            daysInMonth = isLeap ? 29 : 28
        }
        return (1...daysInMonth).contains(day) ? s : nil
    }

    private static func cleanExercises(
        of session: TrainingSession,
        sessionId: String,
        dateISO: String,
        issues: inout [DataHealthIssue]
    ) -> [CleanExercise] {
        var result: [CleanExercise] = []
        for exercise in session.exercises {
            guard let exerciseId = exercise.exerciseId, !exerciseId.isEmpty else {
                issues.append(.exerciseDropped(
                    sessionId: sessionId,
                    dateISO: dateISO,
                    reason: .missingExerciseId
                ))
                continue
            }
            var sets: [CleanLoggedSet] = []
            for set in exercise.sets {
                guard let weight = set.weight, weight >= 0 else {
                    issues.append(.setDropped(
                        sessionId: sessionId,
                        dateISO: dateISO,
                        exerciseId: exerciseId,
                        reason: .invalidWeight
                    ))
                    continue
                }
                guard let reps = set.reps, reps >= 1 else {
                    issues.append(.setDropped(
                        sessionId: sessionId,
                        dateISO: dateISO,
                        exerciseId: exerciseId,
                        reason: .invalidReps
                    ))
                    continue
                }
                var rir = set.rir
                if let value = rir, !(0...15).contains(value) {
                    issues.append(.setFieldIgnored(
                        sessionId: sessionId,
                        dateISO: dateISO,
                        exerciseId: exerciseId,
                        field: "rir"
                    ))
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

        // FR-EQ1：器械场景只认已知档位（未知 → nil 留痕，引擎不瞎过滤）
        var equipmentScenario = profile.equipmentScenario
        if let scenario = equipmentScenario, !knownEquipmentScenarios.contains(scenario) {
            issues.append(.profileFieldIgnored(field: "equipmentScenario"))
            equipmentScenario = nil
        }

        // 单位只认 kg/lb（未知 → nil 留痕，引擎退化 kg 档位）
        var unitSystem = profile.unitSystem
        if let unit = unitSystem, !knownUnitSystems.contains(unit) {
            issues.append(.profileFieldIgnored(field: "unitSystem"))
            unitSystem = nil
        }

        // 性别只认 male/female（审查 m8：与其他枚举字段同模式；未知 → nil 留痕，
        // 相对力量标准如实退化）
        var sex = profile.sex
        if let value = sex, !["male", "female"].contains(value) {
            issues.append(.profileFieldIgnored(field: "sex"))
            sex = nil
        }

        return CleanProfile(
            trainingLevel: trainingLevel,
            sex: sex,
            age: scalar(profile.age, 10...120, "age"),
            heightCm: scalar(profile.heightCm, 100...250, "heightCm"),
            weightKg: scalar(profile.weightKg, 20...400, "weightKg"),
            weeklyTrainingDays: scalar(profile.weeklyTrainingDays, 1...14, "weeklyTrainingDays"),
            equipmentScenario: equipmentScenario,
            unitSystem: unitSystem
        )
    }
}
