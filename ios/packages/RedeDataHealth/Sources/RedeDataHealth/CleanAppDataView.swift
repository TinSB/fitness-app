// CleanAppDataView — raw AppData 的只读净化投影（系统逻辑 §1.2 数据必净化 / §6）。
//
// 引擎（M2 TrainingDecision 起）只允许从这里取数，永不直接读 raw AppData。
// 投影是纯值变换：raw 原样携带、永不改写；脏/缺数据被丢弃或置 nil，
// 每一次丢弃都如实记入 issues——不静默修补，不发明默认值
// （冷启动 prior 是引擎的职责，不是数据层的）。

import RedeDomain

public struct CleanLoggedSet: Equatable, Sendable {
    /// kg 存储口径，≥ 0（自重动作可为 0）。
    public let weight: Double
    /// ≥ 1。
    public let reps: Int
    /// 0...15 之外或非数值投影为 nil。
    public let rir: Double?

    public init(weight: Double, reps: Int, rir: Double?) {
        self.weight = weight
        self.reps = reps
        self.rir = rir
    }
}

public struct CleanExercise: Equatable, Sendable {
    public let exerciseId: String
    public let sets: [CleanLoggedSet]

    public init(exerciseId: String, sets: [CleanLoggedSet]) {
        self.exerciseId = exerciseId
        self.sets = sets
    }
}

public struct CleanTrainingSession: Equatable, Sendable {
    public let id: String
    public let date: String
    public let exercises: [CleanExercise]

    public init(id: String, date: String, exercises: [CleanExercise]) {
        self.id = id
        self.date = date
        self.exercises = exercises
    }
}

/// 合法标量原样通过；越界/未知值为 nil（并在 view.issues 留痕）。
public struct CleanProfile: Equatable, Sendable {
    public let trainingLevel: String?
    public let sex: String?
    public let age: Int?
    public let heightCm: Double?
    public let weightKg: Double?
    public let weeklyTrainingDays: Int?

    public init(
        trainingLevel: String? = nil,
        sex: String? = nil,
        age: Int? = nil,
        heightCm: Double? = nil,
        weightKg: Double? = nil,
        weeklyTrainingDays: Int? = nil
    ) {
        self.trainingLevel = trainingLevel
        self.sex = sex
        self.age = age
        self.heightCm = heightCm
        self.weightKg = weightKg
        self.weeklyTrainingDays = weeklyTrainingDays
    }
}

public struct CleanAppDataView: Equatable, Sendable {
    /// 原始 AppData，verbatim 携带、永不改写。
    public let raw: AppData
    public let sessions: [CleanTrainingSession]
    public let profile: CleanProfile
    public let issues: [DataHealthIssue]

    public var hasDirtyData: Bool { !issues.isEmpty }

    public init(raw: AppData, sessions: [CleanTrainingSession], profile: CleanProfile, issues: [DataHealthIssue]) {
        self.raw = raw
        self.sessions = sessions
        self.profile = profile
        self.issues = issues
    }
}
