// DataHealthIssue — 净化投影丢弃/忽略数据时的诚实留痕。
// 它同时服务 Progress 页的「数据是否可信」提示（MVP 成功定义第 5 条）。

public enum DataHealthIssue: Equatable, Hashable, Sendable {
    public enum SessionDropReason: Equatable, Hashable, Sendable {
        case notAnObject
        case missingId
        case missingDate
        case invalidDateFormat
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

    case sessionDropped(id: String?, dateISO: String?, reason: SessionDropReason)
    case exerciseDropped(sessionId: String, dateISO: String, reason: ExerciseDropReason)
    case setDropped(sessionId: String, dateISO: String, exerciseId: String, reason: SetDropReason)
    case setFieldIgnored(sessionId: String, dateISO: String, exerciseId: String, field: String)
    case profileFieldIgnored(field: String)
    case programFieldIgnored(field: String)

    /// Weekly review 只把真正丢弃训练事实的问题纳入判断；被忽略的 RIR/profile/program
    /// 字段不影响训练日、场次、训练量或关键动作趋势。
    public var isDroppedTrainingData: Bool {
        switch self {
        case .sessionDropped, .exerciseDropped, .setDropped:
            true
        case .setFieldIgnored, .profileFieldIgnored, .programFieldIgnored:
            false
        }
    }

    /// nil 表示该丢弃问题无法可靠归入某一周；调用方必须失败关闭，不能把它
    /// 静默排除后继续给出正向趋势。
    public var droppedTrainingDateISO: String? {
        switch self {
        case .sessionDropped(_, let dateISO, _):
            dateISO
        case .exerciseDropped(_, let dateISO, _):
            dateISO
        case .setDropped(_, let dateISO, _, _):
            dateISO
        case .setFieldIgnored, .profileFieldIgnored, .programFieldIgnored:
            nil
        }
    }
}
