// DataQualityReport — 数据质量最小信号（M4-2，FR-PR4 数据层）。
//
// 两类信号：① 净化丢弃统计（聚合 CleanAppDataView.issues）；② 可疑数值
// 静默标记——通过了合法性安检但不合常理的数字（「这组 500 lb 可能记错了」）。
// 红线：只标记、不丢弃、不改数据（clean view 原样）；输出是 typed 结构，
// 零文案——「置信度」在结构上不存在（文案基线 §3.4：可信度走行为表达）。
// 缺 RIR 类数据缺口刻意不进本报告（§3.4：折进训练时补记，不挂 Progress）。
//
// 阈值是 MVP 起步值（同 M2 引擎阈值惯例，由测试锁定、待真实反馈校准）：
// · 相对规则：组重 > 1.5×本人更早场同动作最好顶组，且基准 ≥30kg（防小重量
//   噪声）；首练无基准不标（校准期哲学）；被标记的组不进基准（防错值污染参照）。
// · 绝对天花板：>400kg 无条件标（抓无历史时的单位/手滑错误）。
// · 次数：>50 标。
// 一组只标一个理由，优先级：天花板 > 相对 > 次数。
//
// 已知边界（审查确认，刻意接受）：被标组不进基准 ⇒ 若用户单场真实暴涨
// >1.5×，其后每场都会持续被标（基准不演化）——这被视为诚实行为而非 bug：
// 渐进超负荷（±2.5kg/场）永远不触发；一场跳 50%+ 几乎总是记错/换器械/
// 单位混淆，应持续提示直到用户经修正入口（M4-3）确认或修正。有测试锁定。

public struct DataQualityReport: Equatable, Sendable {
    public struct SuspectSet: Equatable, Sendable {
        public enum Reason: Equatable, Sendable {
            /// 远超本人同动作更早历史最好顶组（携带对比基准）。
            case weightFarAboveOwnHistory(previousBestKg: Double)
            /// 超出绝对合理上限。
            case weightBeyondPlausibleCeiling
            case repsImplausiblyHigh
        }

        public let sessionId: String
        public let dateISO: String
        public let exerciseId: String
        /// 该动作 clean sets 内的 1 起始序号。
        public let setIndex: Int
        public let weightKg: Double
        public let reps: Int
        public let reason: Reason
    }

    public let droppedSessionCount: Int
    public let droppedExerciseCount: Int
    public let droppedSetCount: Int
    /// 被忽略的字段（set/profile/program 级）总数。
    public let ignoredFieldCount: Int
    /// 时序（日期升序、同日保输入序）→ 动作出现序 → 组序。
    public let suspectSets: [SuspectSet]

    public var hasFindings: Bool {
        droppedSessionCount + droppedExerciseCount + droppedSetCount + ignoredFieldCount > 0
            || !suspectSets.isEmpty
    }
}

public enum DataQualityReportBuilder {
    private static let relativeMultiplier = 1.5
    private static let relativeBaselineFloorKg = 30.0
    private static let weightCeilingKg = 400.0
    private static let repsCeiling = 50

    public static func build(view: CleanAppDataView) -> DataQualityReport {
        var droppedSessions = 0, droppedExercises = 0, droppedSets = 0, ignoredFields = 0
        for issue in view.issues {
            switch issue {
            case .sessionDropped: droppedSessions += 1
            case .exerciseDropped: droppedExercises += 1
            case .setDropped: droppedSets += 1
            case .setFieldIgnored, .profileFieldIgnored, .programFieldIgnored: ignoredFields += 1
            }
        }

        // 时序：clean view 保证日期为严格 yyyy-MM-dd → 字典序即时间序；同日保输入序。
        let chronological = view.sessions.enumerated()
            .sorted { ($0.element.date, $0.offset) < ($1.element.date, $1.offset) }
            .map(\.element)

        var suspects: [DataQualityReport.SuspectSet] = []
        var baselineByExercise: [String: Double] = [:]

        for session in chronological {
            // 本场未被标记的顶组，场末并入基准（场内自比不算「超历史」）。
            var sessionCleanTop: [String: Double] = [:]

            for exercise in session.exercises {
                let baseline = baselineByExercise[exercise.exerciseId]
                for (index, set) in exercise.sets.enumerated() {
                    let reason: DataQualityReport.SuspectSet.Reason?
                    if set.weight > weightCeilingKg {
                        reason = .weightBeyondPlausibleCeiling
                    } else if let baseline, baseline >= relativeBaselineFloorKg,
                              set.weight > baseline * relativeMultiplier {
                        reason = .weightFarAboveOwnHistory(previousBestKg: baseline)
                    } else if set.reps > repsCeiling {
                        reason = .repsImplausiblyHigh
                    } else {
                        reason = nil
                    }

                    if let reason {
                        suspects.append(DataQualityReport.SuspectSet(
                            sessionId: session.id,
                            dateISO: session.date,
                            exerciseId: exercise.exerciseId,
                            setIndex: index + 1,
                            weightKg: set.weight,
                            reps: set.reps,
                            reason: reason
                        ))
                    } else {
                        sessionCleanTop[exercise.exerciseId] = max(
                            sessionCleanTop[exercise.exerciseId] ?? set.weight, set.weight
                        )
                    }
                }
            }

            for (exerciseId, top) in sessionCleanTop {
                baselineByExercise[exerciseId] = max(baselineByExercise[exerciseId] ?? top, top)
            }
        }

        return DataQualityReport(
            droppedSessionCount: droppedSessions,
            droppedExerciseCount: droppedExercises,
            droppedSetCount: droppedSets,
            ignoredFieldCount: ignoredFields,
            suspectSets: suspects
        )
    }
}
