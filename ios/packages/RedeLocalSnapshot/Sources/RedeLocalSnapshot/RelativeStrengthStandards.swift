// RelativeStrengthStandards — 相对体重力量标准（批次 D 2026-07-09，owner 拍板「123 全做」）。
//
// 解决绝对锚（MuscleMilestoneCatalog）三缺口：60kg 以下无档、back/biceps 无低门槛
// 路径（barbell-row 进表）、锚不按体重/性别调（女表独立）。与绝对锚**并存取 max**：
// 绝对锚保留 kg/lb 心理里程碑，本表管公平性。
//
// 口径：相对比 = 成绩(kg) ÷ 当前体重(kg)，无单位——不受 unitSystem 影响（绝对锚的
// lb 独立梯是心理数字需求，比值无此问题）。性别/体重任一缺 → 整体不参与（如实退化
// 到绝对锚现状，不猜不用中间表）。时点简化（交接件 §3.3）：当前体重 × 全历史最好成绩。
// 数值 = E1 专家判断锚（业界通识（strengthlevel/ExRx 风格：男 intermediate 卧推
// 1.0×体重）），owner 可后调；全表锚测试锁死防手滑。
// weighted-pull-up 不进表：负重引体「+X kg」与体重比语义冲突，绝对锚已覆盖。
// sex 用途单一契约：只进本表，不进处方/恢复/等级其他面。

import Foundation

public enum RelativeStrengthStandards {
    public static let standardsVersion = "rel-standards-v1"

    /// 体重合理区间（审查 S1：HealthKit 源绕过 CleanAppDataViewBuilder 的 20...400 钳制
    /// ——第三方秤错单位/家庭共享混数据可致极小值，一次脏数据会经 peaks 只升不降永久
    /// 污染等级记忆；在有测试覆盖的包内层再守一道，越界如实退化）。
    public static let plausibleBodyweightKg: ClosedRange<Double> = 20...400

    /// 五档：floor/tier 与绝对锚同格（bench-100→10/.intermediate、140→16/.advanced）。
    /// elite=19 非 20：满级留给「elite 档 + 持续训练量」，防一次测验直接满级；
    /// 低置信另有护栏（assembler：confidence low 时相对 floor 封 intermediate）。
    public enum Grade: String, CaseIterable, Equatable, Sendable {
        case beginner, novice, intermediate, advanced, elite

        public var levelFloor: Int {
            switch self {
            case .beginner: return 2
            case .novice: return 6
            case .intermediate: return 10
            case .advanced: return 16
            case .elite: return 19
            }
        }

        public var tierCandidate: TrainingTier? {
            switch self {
            case .beginner, .novice: return nil
            case .intermediate: return .intermediate
            case .advanced: return .advanced
            case .elite: return .elite
            }
        }
    }

    /// 一个动作的男女五档倍数表（ratios 按 Grade.allCases 顺序）。
    public struct Standard: Equatable, Sendable {
        public let exerciseId: String
        public let displayBase: String        // "Bench" 等（displayName 组装用）
        public let maleRatios: [Double]
        public let femaleRatios: [Double]
        public let linkedMuscles: [MuscleGroupID]
    }

    /// 交接件 §3.1 五动作表（exerciseId 沿绝对锚同款；barbell-row 为 ② 新覆盖）。
    public static let v1: [Standard] = [
        Standard(exerciseId: "bench-press", displayBase: "Bench",
                 maleRatios: [0.50, 0.75, 1.00, 1.50, 2.00],
                 femaleRatios: [0.25, 0.40, 0.60, 0.90, 1.20],
                 linkedMuscles: [.chest, .triceps, .shoulders]),
        Standard(exerciseId: "squat", displayBase: "Squat",
                 maleRatios: [0.75, 1.00, 1.50, 2.00, 2.50],
                 femaleRatios: [0.50, 0.75, 1.10, 1.50, 2.00],
                 linkedMuscles: [.quads, .glutes, .hamstrings, .core]),
        Standard(exerciseId: "deadlift", displayBase: "Deadlift",
                 maleRatios: [1.00, 1.25, 1.75, 2.25, 2.75],
                 femaleRatios: [0.60, 0.90, 1.25, 1.75, 2.25],
                 linkedMuscles: [.hamstrings, .glutes, .back, .core]),
        Standard(exerciseId: "overhead-press", displayBase: "Overhead Press",
                 maleRatios: [0.35, 0.50, 0.70, 0.95, 1.20],
                 femaleRatios: [0.20, 0.30, 0.45, 0.65, 0.85],
                 linkedMuscles: [.shoulders, .triceps, .core]),
        Standard(exerciseId: "barbell-row", displayBase: "Barbell Row",
                 maleRatios: [0.50, 0.65, 0.90, 1.20, 1.50],
                 femaleRatios: [0.30, 0.45, 0.65, 0.90, 1.15],
                 linkedMuscles: [.back, .biceps]),
    ]

    /// 达成判定：每命中档各出一条（同绝对锚逐条行为，floors 下游自动 max）。
    /// 双轨沿绝对锚：actual 达标 = actualCompletedSet（high）；仅 e1RM 达标 =
    /// estimatedOneRepMax（medium），同档 actual 已达不重复出估算版。
    public static func achievements(
        sex: String?,
        bodyweightKg: Double?,
        bestActualKgByExercise: [String: Double],
        bestE1RmKgByExercise: [String: Double],
        atIso: String,
        standards: [Standard] = v1
    ) -> [StrengthMilestoneAchievement] {
        let ratios: (Standard) -> [Double]
        switch sex?.lowercased() {
        case "male": ratios = { $0.maleRatios }
        case "female": ratios = { $0.femaleRatios }
        default: return []   // 未设置/未知值 → 如实退化，不猜
        }
        guard let bodyweightKg, plausibleBodyweightKg.contains(bodyweightKg) else { return [] }

        var out: [StrengthMilestoneAchievement] = []
        for standard in standards {
            let table = ratios(standard)
            let actualRatio = (bestActualKgByExercise[standard.exerciseId] ?? 0) / bodyweightKg
            let estimatedRatio = (bestE1RmKgByExercise[standard.exerciseId] ?? 0) / bodyweightKg
            for (index, grade) in Grade.allCases.enumerated() {
                let threshold = table[index]
                let actualHit = actualRatio + 1e-9 >= threshold
                let estimatedHit = estimatedRatio + 1e-9 >= threshold
                guard actualHit || estimatedHit else { continue }
                let thresholdKg = threshold * bodyweightKg
                out.append(StrengthMilestoneAchievement(
                    milestoneId: "rel-\(standard.exerciseId)-\(grade.rawValue)",
                    exerciseId: standard.exerciseId,
                    displayName: "\(standard.displayBase) \(String(format: "%.2f", threshold))× bodyweight",
                    thresholdKg: thresholdKg,
                    thresholdLb: thresholdKg * MuscleMilestoneCatalog.lbPerKg,
                    achievedBy: actualHit ? .actualCompletedSet : .estimatedOneRepMax,
                    sourceSetId: nil,
                    achievedAtIso: atIso,
                    linkedMuscleIds: standard.linkedMuscles,
                    levelFloor: grade.levelFloor,
                    tierFloor: grade.tierCandidate,
                    confidence: actualHit ? .high : .medium))
            }
        }
        return out
    }
}
