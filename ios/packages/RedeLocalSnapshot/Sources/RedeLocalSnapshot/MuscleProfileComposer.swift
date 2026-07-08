// MuscleProfileComposer — MLE 喂数管线包内组合层（批次 B B1 2026-07-07）。
//
// 职责：把 app 胶水翻译好的「贡献行/触达行/e1RM 行」串成完整 MuscleDevelopmentProfile：
// 聚合 → 每肌群观察组装 → estimator.compute → milestone 判定 → assembler。
// 全链在包内可单测；app 层（ProgressModel）只剩目录翻译薄胶水（不可测面最小化）。
//
// 输入合同（Master §5：本包零依赖，跨包一律 rawValue 字符串行类型）：
// - rows：fractional 贡献行（主 1.0/次 0.5 已在翻译侧算好）
// - touches：肌群触达行（sessionsTouched/movementFamiliesTouched 的原料，unique 计数在此）
// - e1rmRows：**只挂主肌群**的 e1RM 时序（批次 B 拍板③：次肌群只吃容量不吃性能信号）
// - previous*：rawValue 键（持久层 B2 的字符串形态直通；非法键如实丢弃）
// 10 肌群全量输出：无数据肌群照出 isCalibrating（冷启动灰屏语义，§6.5.9）。

import Foundation

/// 肌群触达行：该 session 的某动作触达了某肌群（主或次）+ 动作族。
public struct MuscleTouchRow: Equatable, Sendable {
    public let muscleRaw: String
    public let sessionId: String
    public let familyId: String
    public init(muscleRaw: String, sessionId: String, familyId: String) {
        self.muscleRaw = muscleRaw
        self.sessionId = sessionId
        self.familyId = familyId
    }
}

/// e1RM 观察行（主肌群归属，翻译侧已完成 exerciseId → 主肌群映射）。
public struct MuscleE1RMRow: Equatable, Sendable {
    public let muscleRaw: String
    public let dateISO: String
    public let e1RmKg: Double
    public init(muscleRaw: String, dateISO: String, e1RmKg: Double) {
        self.muscleRaw = muscleRaw
        self.dateISO = dateISO
        self.e1RmKg = e1RmKg
    }
}

public enum MuscleProfileComposer {
    public struct Input: Sendable {
        public let rows: [MuscleVolumeAggregator.ContributionRow]
        public let touches: [MuscleTouchRow]
        public let e1rmRows: [MuscleE1RMRow]
        public let bestActualKgByExercise: [String: Double]
        public let bestE1RmKgByExercise: [String: Double]
        public let unitSystem: String?
        public let previousLevels: [String: Int]
        public let previousPeaks: [String: Int]
        public let previousTierRaw: String?
        public let nowISO: String
        public init(rows: [MuscleVolumeAggregator.ContributionRow],
                    touches: [MuscleTouchRow],
                    e1rmRows: [MuscleE1RMRow],
                    bestActualKgByExercise: [String: Double],
                    bestE1RmKgByExercise: [String: Double],
                    unitSystem: String?,
                    previousLevels: [String: Int] = [:],
                    previousPeaks: [String: Int] = [:],
                    previousTierRaw: String? = nil,
                    nowISO: String) {
            self.rows = rows
            self.touches = touches
            self.e1rmRows = e1rmRows
            self.bestActualKgByExercise = bestActualKgByExercise
            self.bestE1RmKgByExercise = bestE1RmKgByExercise
            self.unitSystem = unitSystem
            self.previousLevels = previousLevels
            self.previousPeaks = previousPeaks
            self.previousTierRaw = previousTierRaw
            self.nowISO = nowISO
        }
    }

    public static func compose(_ input: Input, config: MuscleLevelModelConfig = .current) -> MuscleDevelopmentProfile {
        let weekly = MuscleVolumeAggregator.weeklyFractionalSets(rows: input.rows)
        // 触达/性能行按肌群分桶：rawValue 解析失败（持久层脏键/未来新增值）如实丢弃不崩。
        var sessionsByMuscle: [MuscleGroupID: Set<String>] = [:]
        var familiesByMuscle: [MuscleGroupID: Set<String>] = [:]
        for touch in input.touches {
            guard let muscle = MuscleGroupID(rawValue: touch.muscleRaw) else { continue }
            sessionsByMuscle[muscle, default: []].insert(touch.sessionId)
            familiesByMuscle[muscle, default: []].insert(touch.familyId)
        }
        var e1rmByMuscle: [MuscleGroupID: [MuscleObservations.E1RMObservation]] = [:]
        for row in input.e1rmRows {
            guard let muscle = MuscleGroupID(rawValue: row.muscleRaw) else { continue }
            e1rmByMuscle[muscle, default: []].append(.init(dateISO: row.dateISO, e1RmKg: row.e1RmKg))
        }
        // 10 肌群全量：无数据也出 calibrating 计算体（冷启动灰屏 + 逐肌群解锁，§6.5.9）。
        var computations: [MuscleLevelComputation] = []
        var observationsById: [MuscleGroupID: MuscleObservations] = [:]
        for muscle in MuscleGroupID.allCases.sorted(by: { $0.rawValue < $1.rawValue }) {
            let observations = MuscleObservations(
                muscleId: muscle,
                weeklyFractionalSets: weekly[muscle] ?? [:],
                sessionsTouched: sessionsByMuscle[muscle]?.count ?? 0,
                movementFamiliesTouched: familiesByMuscle[muscle]?.count ?? 0,
                e1rmPoints: (e1rmByMuscle[muscle] ?? []).sorted { $0.dateISO < $1.dateISO })
            observationsById[muscle] = observations
            computations.append(MuscleLevelEstimator.compute(
                observations: observations, config: config, nowISO: input.nowISO))
        }
        let milestones = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: input.bestActualKgByExercise,
            bestE1RmKgByExercise: input.bestE1RmKgByExercise,
            unitSystem: input.unitSystem, atIso: input.nowISO)
        return MuscleProfileAssembler.assemble(
            computations: computations,
            observations: observationsById,
            previousLevels: parseMuscleKeyed(input.previousLevels),
            previousPeaks: parseMuscleKeyed(input.previousPeaks),
            previousTier: input.previousTierRaw.flatMap(TrainingTier.init(rawValue:)),
            generatedAtIso: input.nowISO,
            config: config,
            milestones: milestones)
    }

    /// rawValue 键字典 → 类型键（持久层 B2 的字符串形态直通；非法键丢弃）。
    private static func parseMuscleKeyed(_ raw: [String: Int]) -> [MuscleGroupID: Int] {
        var out: [MuscleGroupID: Int] = [:]
        for (key, value) in raw {
            guard let muscle = MuscleGroupID(rawValue: key) else { continue }
            out[muscle] = value
        }
        return out
    }
}
