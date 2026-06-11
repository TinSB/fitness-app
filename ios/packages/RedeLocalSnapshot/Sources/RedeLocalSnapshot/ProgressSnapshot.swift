// ProgressSnapshot — 进展页只读派生投影（M4-1，FR-PR1/2/3 数据层）。
//
// 口径锁定（与已落盘实现对齐，改动须过架构门）：
// · e1RM = Epley w×(1+r/30)，取每场每动作顶组（重量优先、同重比次数）——同 SessionSummary；
// · PR = 顶组重量严格大于全部更早历史同动作顶组；首练不发奖（M3 保守口径）；
// · volume = Σ 重量×次数×loadFactor（§6.2 owner 拍板 B 案：目录系数修正
//   哑铃单只口径低估；facts 缺省 = 系数 1，与旧口径一致）；
//   周聚合 = ISO 周（周一起始），纯日期数学；
// · 非法日期条目整体跳过（上游 clean view 已保证合法，这里只是防御）。
// 纯函数、无 clock/IO；输出是派生展示对象，永不写回 canonical（Master §6 L152）。

public struct ProgressSnapshot: Equatable, Sendable {
    public struct TopSet: Equatable, Sendable {
        public let exerciseId: String
        public let weightKg: Double
        public let reps: Int
    }

    public struct HistoryEntry: Equatable, Sendable {
        public let sessionId: String
        public let dateISO: String
        public let totalVolumeKg: Double
        public let setCount: Int
        public let topSet: TopSet?
        /// 本场创下重量 PR 的动作（按该场动作出现顺序）。
        public let prExerciseIds: [String]
        public let durationMinutes: Int?
    }

    public struct E1RMPoint: Equatable, Sendable {
        public let sessionId: String
        public let dateISO: String
        public let e1RmKg: Double
    }

    public struct ExerciseTrend: Equatable, Sendable {
        public let exerciseId: String
        /// 旧→新（趋势图直接可用）。
        public let points: [E1RMPoint]
        public let latestE1RmKg: Double
        public let bestE1RmKg: Double
        public let bestWeightKg: Double
    }

    public struct WeeklyVolume: Equatable, Sendable {
        /// 该周周一 yyyy-MM-dd（ISO 周键，「与上周对比」可按此推算相邻周）。
        public let weekStartISO: String
        public let totalVolumeKg: Double
        public let setCount: Int
        public let sessionCount: Int
    }

    /// 新→旧。
    public let history: [HistoryEntry]
    /// 按 exerciseId 升序（确定性）。
    public let exerciseTrends: [ExerciseTrend]
    /// 新→旧（按周一日期）。
    public let weeklyVolume: [WeeklyVolume]
}

/// 目录只读事实窄投影（§6.2：进展层不依赖决策包，由 app 层注入）。
public struct ExerciseStatsFacts: Equatable, Sendable {
    /// 吨位换算系数（双哑铃=2 等）。
    public let loadFactor: Double
    /// 训练学主项复合（关键动作挑选优先级）。
    public let isCompound: Bool

    public init(loadFactor: Double = 1.0, isCompound: Bool = false) {
        self.loadFactor = loadFactor
        self.isCompound = isCompound
    }
}

public enum ProgressSnapshotBuilder {
    public static func build(
        sessions: [SnapshotSessionRecord],
        facts: [String: ExerciseStatsFacts] = [:]
    ) -> ProgressSnapshot {
        // 时序基准：日期升序、同日保输入序（稳定排序）；PR 按此运行最大值判定。
        let chronological = sessions
            .compactMap { record -> (record: SnapshotSessionRecord, day: Int)? in
                guard let day = SnapshotDayMath.dayNumber(of: record.dateISO) else { return nil }
                return (record, day)
            }
            .enumerated()
            .sorted { ($0.element.day, $0.offset) < ($1.element.day, $1.offset) }
            .map(\.element.record)

        var history: [ProgressSnapshot.HistoryEntry] = []
        var pointsByExercise: [String: [ProgressSnapshot.E1RMPoint]] = [:]
        var bestWeightByExercise: [String: Double] = [:]
        var weekBuckets: [String: (volume: Double, sets: Int, sessions: Int)] = [:]

        for record in chronological {
            var volume = 0.0
            var setCount = 0
            var top: ProgressSnapshot.TopSet?
            var prIds: [String] = []

            // 同场重复 exerciseId 的条目先按 id 合并（首现顺序），再做顶组/PR/e1RM：
            // PR 只和「更早的场」比，场内自比不发 PR；每场每动作只产出一个 e1RM 点。
            var orderedIds: [String] = []
            var setsByExercise: [String: [SnapshotSetRecord]] = [:]
            for exercise in record.exercises {
                if setsByExercise[exercise.exerciseId] == nil { orderedIds.append(exercise.exerciseId) }
                setsByExercise[exercise.exerciseId, default: []].append(contentsOf: exercise.sets)
                let factor = facts[exercise.exerciseId]?.loadFactor ?? 1.0
                for set in exercise.sets {
                    volume += set.weightKg * Double(set.reps) * factor
                    setCount += 1
                }
            }

            for exerciseId in orderedIds {
                guard let exerciseTop = topSet(of: setsByExercise[exerciseId] ?? []) else { continue }
                if top == nil || exerciseTop.weightKg > top!.weightKg
                    || (exerciseTop.weightKg == top!.weightKg && exerciseTop.reps > top!.reps) {
                    top = ProgressSnapshot.TopSet(
                        exerciseId: exerciseId,
                        weightKg: exerciseTop.weightKg,
                        reps: exerciseTop.reps
                    )
                }

                // PR：严格大于全部更早场的同动作顶组；首练（无运行最大值）不发奖。
                if let previousBest = bestWeightByExercise[exerciseId],
                   exerciseTop.weightKg > previousBest {
                    prIds.append(exerciseId)
                }
                bestWeightByExercise[exerciseId] = max(
                    bestWeightByExercise[exerciseId] ?? exerciseTop.weightKg,
                    exerciseTop.weightKg
                )

                pointsByExercise[exerciseId, default: []].append(
                    ProgressSnapshot.E1RMPoint(
                        sessionId: record.id,
                        dateISO: record.dateISO,
                        e1RmKg: epley(weightKg: exerciseTop.weightKg, reps: exerciseTop.reps)
                    )
                )
            }

            history.append(ProgressSnapshot.HistoryEntry(
                sessionId: record.id,
                dateISO: record.dateISO,
                totalVolumeKg: volume,
                setCount: setCount,
                topSet: top,
                prExerciseIds: prIds,
                durationMinutes: record.durationMinutes
            ))

            if let weekStart = SnapshotDayMath.isoWeekStart(of: record.dateISO) {
                var bucket = weekBuckets[weekStart] ?? (0, 0, 0)
                bucket.volume += volume
                bucket.sets += setCount
                bucket.sessions += 1
                weekBuckets[weekStart] = bucket
            }
        }

        let trends = pointsByExercise
            .sorted { $0.key < $1.key }
            .map { exerciseId, points -> ProgressSnapshot.ExerciseTrend in
                ProgressSnapshot.ExerciseTrend(
                    exerciseId: exerciseId,
                    points: points,
                    latestE1RmKg: points.last?.e1RmKg ?? 0,
                    bestE1RmKg: points.map(\.e1RmKg).max() ?? 0,
                    bestWeightKg: bestWeightByExercise[exerciseId] ?? 0
                )
            }

        let weekly = weekBuckets
            .sorted { $0.key > $1.key }
            .map { weekStart, bucket in
                ProgressSnapshot.WeeklyVolume(
                    weekStartISO: weekStart,
                    totalVolumeKg: bucket.volume,
                    setCount: bucket.sets,
                    sessionCount: bucket.sessions
                )
            }

        return ProgressSnapshot(
            history: history.reversed(),
            exerciseTrends: trends,
            weeklyVolume: weekly
        )
    }

    /// 顶组：重量优先，同重比次数（与 SessionSummaryBuilder 同口径）。
    private static func topSet(of sets: [SnapshotSetRecord]) -> SnapshotSetRecord? {
        sets.max { a, b in
            (a.weightKg, a.reps) < (b.weightKg, b.reps)
        }
    }

    /// Epley（与 SessionSummary.topSetE1RmKg 同公式）。
    private static func epley(weightKg: Double, reps: Int) -> Double {
        weightKg * (1 + Double(reps) / 30)
    }
}
