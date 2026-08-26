// 快照输入值类型 — Master 合同：本包 Foundation-only、与 RedeDomain 解耦，
// 所以输入是包内自有类型；由 app 组合层把 DataHealth clean view 映射进来（M4-3）。
// 这里只承载已净化的用户事实，永不回流 canonical。

public struct SnapshotSetRecord: Equatable, Sendable {
    public let weightKg: Double
    public let reps: Int
    /// 记下这一组的时刻（ISO8601）。把「组」放回时间轴的坐标——单场记录页要用它
    /// 把每一组标在心率曲线上。nil = 旧数据没有这一位，那一场就只画曲线不标组。
    public let completedAtISO: String?

    public init(weightKg: Double, reps: Int, completedAtISO: String? = nil) {
        self.weightKg = weightKg
        self.reps = reps
        self.completedAtISO = completedAtISO
    }
}

public struct SnapshotExerciseRecord: Equatable, Sendable {
    public let exerciseId: String
    public let sets: [SnapshotSetRecord]

    public init(exerciseId: String, sets: [SnapshotSetRecord]) {
        self.exerciseId = exerciseId
        self.sets = sets
    }
}

public struct SnapshotSessionRecord: Equatable, Sendable {
    public let id: String
    /// 用户本地日 yyyy-MM-dd（与引擎天序号口径一致）。
    public let dateISO: String
    public let exercises: [SnapshotExerciseRecord]
    public let durationMinutes: Int?
    /// 这一场的开始 / 结束时刻（ISO8601）。用来把这一场对回「健康」里的那条体能训练
    /// （按时间窗匹配），也是时间轴的两端。
    public let startedAtISO: String?
    public let finishedAtISO: String?

    public init(id: String, dateISO: String, exercises: [SnapshotExerciseRecord],
                durationMinutes: Int? = nil,
                startedAtISO: String? = nil, finishedAtISO: String? = nil) {
        self.id = id
        self.dateISO = dateISO
        self.exercises = exercises
        self.durationMinutes = durationMinutes
        self.startedAtISO = startedAtISO
        self.finishedAtISO = finishedAtISO
    }
}
