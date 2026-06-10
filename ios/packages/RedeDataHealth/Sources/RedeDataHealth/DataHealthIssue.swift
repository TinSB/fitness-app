// DataHealthIssue — 净化投影丢弃/忽略数据时的诚实留痕。
// 它同时服务 Progress 页的「数据是否可信」提示（MVP 成功定义第 5 条）。

public enum DataHealthIssue: Equatable, Hashable, Sendable {
    public enum SessionDropReason: Equatable, Hashable, Sendable {
        case notAnObject
        case missingId
        case missingDate
        /// 含 completed 字段缺失——与显式 false 刻意同义合并：M1-2 写闸保证
        /// 新数据必带 completed=true，缺失只可能来自 legacy/手工数据，对
        /// 「这条记录不可作为完成训练统计」这一下游语义二者无差别。
        case notCompleted
        case duplicateId
    }

    public enum ExerciseDropReason: Equatable, Hashable, Sendable {
        case missingExerciseId
    }

    public enum SetDropReason: Equatable, Hashable, Sendable {
        case invalidWeight
        case invalidReps
    }

    case sessionDropped(id: String?, reason: SessionDropReason)
    case exerciseDropped(sessionId: String, reason: ExerciseDropReason)
    case setDropped(sessionId: String, exerciseId: String, reason: SetDropReason)
    case setFieldIgnored(sessionId: String, exerciseId: String, field: String)
    case profileFieldIgnored(field: String)
}
