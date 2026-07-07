// MuscleMilestoneCatalog — 契约版里程碑目录（MLE-4 2026-07-07，§6.5.5 九条拍板表）。
//
// 与既有 FR-PR7 简化版（StrengthMilestoneCatalog，4-lift 通用梯）并存不替换：简化版
// 继续服务进度页里程碑区；本目录带 linkedMuscles / levelFloor / tierCandidate，服务
// MLE 等级抬底与 tier 进步信号。kg/lb 双梯禁互转、估算不冒充实测（同 FR-PR7 口径）。
// confidence rule（V1，收口写回）：actual=high、estimated=medium。
// 位置偏离契约 §6.5.5「目录集中定义在 RedeTrainingDecision」——随 MLE-0 类型落包
// 决策同置 RedeLocalSnapshot（见 MuscleLevelTypes.swift 头注，收口统一写回）。

import Foundation

/// 单条契约里程碑定义。
public struct MuscleMilestoneDefinition: Equatable, Sendable {
    public let milestoneId: String
    public let exerciseId: String
    public let displayName: String
    public let thresholdKg: Double
    public let thresholdLb: Double
    public let linkedMuscles: [MuscleGroupID]
    public let levelFloor: Int?
    public let tierCandidate: TrainingTier?
}

public enum MuscleMilestoneCatalog {
    /// 目录自带版本（契约 §6.5.5「带 modelVersion」）：只调阈值/floor 不动
    /// MuscleLevelModelConfig 时，版本痕迹落在这里（审查 m8）。
    public static let catalogVersion = "mle-milestones-v1"
    static let lbPerKg = StrengthMilestoneCatalog.lbPerKg

    /// §6.5.5 九条 V1 起始里程碑（阈值为待校准起步值，同 FR-PR7 口径）。
    public static let v1: [MuscleMilestoneDefinition] = [
        .init(milestoneId: "bench-60kg", exerciseId: "bench-press", displayName: "Bench 60kg / 135lb",
              thresholdKg: 60, thresholdLb: 135,
              linkedMuscles: [.chest, .triceps, .shoulders], levelFloor: 4, tierCandidate: nil),
        .init(milestoneId: "bench-80kg", exerciseId: "bench-press", displayName: "Bench 80kg / 185lb",
              thresholdKg: 80, thresholdLb: 185,
              linkedMuscles: [.chest, .triceps, .shoulders], levelFloor: 7, tierCandidate: nil),
        .init(milestoneId: "bench-100kg", exerciseId: "bench-press", displayName: "Bench 100kg / 225lb",
              thresholdKg: 100, thresholdLb: 225,
              linkedMuscles: [.chest, .triceps, .shoulders], levelFloor: 10, tierCandidate: .intermediate),
        .init(milestoneId: "bench-120kg", exerciseId: "bench-press", displayName: "Bench 120kg / 265lb",
              thresholdKg: 120, thresholdLb: 265,
              linkedMuscles: [.chest, .triceps, .shoulders], levelFloor: 13, tierCandidate: nil),
        .init(milestoneId: "bench-140kg", exerciseId: "bench-press", displayName: "Bench 140kg / 315lb",
              thresholdKg: 140, thresholdLb: 315,
              linkedMuscles: [.chest, .triceps, .shoulders], levelFloor: 16, tierCandidate: .advanced),
        .init(milestoneId: "squat-140kg", exerciseId: "squat", displayName: "Squat 140kg / 315lb",
              thresholdKg: 140, thresholdLb: 315,
              linkedMuscles: [.quads, .glutes, .hamstrings, .core], levelFloor: 11, tierCandidate: nil),
        .init(milestoneId: "deadlift-180kg", exerciseId: "deadlift", displayName: "Deadlift 180kg / 405lb",
              thresholdKg: 180, thresholdLb: 405,
              linkedMuscles: [.hamstrings, .glutes, .back, .core], levelFloor: 14, tierCandidate: nil),
        .init(milestoneId: "ohp-60kg", exerciseId: "overhead-press", displayName: "Overhead Press 60kg / 135lb",
              thresholdKg: 60, thresholdLb: 135,
              linkedMuscles: [.shoulders, .triceps, .core], levelFloor: 10, tierCandidate: nil),
        .init(milestoneId: "weighted-pullup-20kg", exerciseId: "weighted-pull-up", displayName: "Weighted Pull-up +20kg / +45lb",
              thresholdKg: 20, thresholdLb: 45,
              linkedMuscles: [.back, .biceps, .core], levelFloor: 11, tierCandidate: nil),
    ]

    /// 达成判定：actual 达标 → actualCompletedSet（high）；仅 e1RM 达标 →
    /// estimatedOneRepMax（medium）。同一里程碑 actual 已达不再出估算版（不冒充）。
    /// 双梯禁互转：lb 用户以 lb 阈值对（kg×换算）显示重量比较，同 FR-PR7。
    public static func achievements(
        bestActualKgByExercise: [String: Double],
        bestE1RmKgByExercise: [String: Double],
        unitSystem: String?,
        atIso: String,
        definitions: [MuscleMilestoneDefinition] = v1
    ) -> [StrengthMilestoneAchievement] {
        let isLb = unitSystem?.lowercased() == "lb"
        func crosses(_ kg: Double?, _ definition: MuscleMilestoneDefinition) -> Bool {
            guard let kg, kg > 0 else { return false }
            let display = isLb ? kg * lbPerKg : kg
            let threshold = isLb ? definition.thresholdLb : definition.thresholdKg
            return display + 1e-6 >= threshold
        }
        var out: [StrengthMilestoneAchievement] = []
        for definition in definitions {
            let actualHit = crosses(bestActualKgByExercise[definition.exerciseId], definition)
            let estimatedHit = crosses(bestE1RmKgByExercise[definition.exerciseId], definition)
            guard actualHit || estimatedHit else { continue }
            out.append(StrengthMilestoneAchievement(
                milestoneId: definition.milestoneId,
                exerciseId: definition.exerciseId,
                displayName: definition.displayName,
                thresholdKg: definition.thresholdKg,
                thresholdLb: definition.thresholdLb,
                achievedBy: actualHit ? .actualCompletedSet : .estimatedOneRepMax,
                sourceSetId: nil,
                achievedAtIso: atIso,
                linkedMuscleIds: definition.linkedMuscles,
                levelFloor: definition.levelFloor,
                tierFloor: definition.tierCandidate,
                confidence: actualHit ? .high : .medium))
        }
        return out
    }

    /// linked muscles 的 level floor（多成就取 max）。
    public static func levelFloors(from achievements: [StrengthMilestoneAchievement]) -> [MuscleGroupID: Int] {
        var floors: [MuscleGroupID: Int] = [:]
        for achievement in achievements {
            guard let floor = achievement.levelFloor else { continue }
            for muscle in achievement.linkedMuscleIds {
                floors[muscle] = max(floors[muscle] ?? 0, floor)
            }
        }
        return floors
    }
}
