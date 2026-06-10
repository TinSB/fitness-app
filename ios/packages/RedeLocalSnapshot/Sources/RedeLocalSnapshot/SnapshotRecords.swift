// 快照输入值类型 — Master 合同：本包 Foundation-only、与 RedeDomain 解耦，
// 所以输入是包内自有类型；由 app 组合层把 DataHealth clean view 映射进来（M4-3）。
// 这里只承载已净化的用户事实，永不回流 canonical。

public struct SnapshotSetRecord: Equatable, Sendable {
    public let weightKg: Double
    public let reps: Int

    public init(weightKg: Double, reps: Int) {
        self.weightKg = weightKg
        self.reps = reps
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

    public init(id: String, dateISO: String, exercises: [SnapshotExerciseRecord], durationMinutes: Int? = nil) {
        self.id = id
        self.dateISO = dateISO
        self.exercises = exercises
        self.durationMinutes = durationMinutes
    }
}
