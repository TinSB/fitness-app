// MuscleContributionTable — 动作 → 契约肌群 fractional 贡献对（MLE-1a 2026-07-07）。
//
// fractional 二档口径的唯一定义点：primary 1.0 / secondary 各 0.5。依据（EVIDENCE_LEDGER
// MLE-SCI-1/CMP-3）：Pelland et al. 2025（67 研究 meta-regression）三种计量口径中
// fractional 拟合最优（BF 9.48-54.84）；Hevy 公开采用同口径。0.5 是「有据可依的约定」
// 非测量值——呈现层披露为通行口径，不标「科学测量」（MLE-SCI-3 红线）。
//
// 同一契约肌群多路命中（细粒度归并撞桶，如 secondary 同含 traps 与 upper-back）
// 合并取 **max** 不叠加——归并不虚增贡献。映射 nil（forearm/未知值）如实跳过。

import Foundation

public enum MuscleContributionTable {
    public static let primaryWeight = 1.0
    public static let secondaryWeight = 0.5

    /// 动作的契约肌群贡献对；未知动作/全排除动作 → 空数组。
    public static func contributions(
        exerciseId: String, catalog: ExerciseCatalog = .minimal
    ) -> [(muscle: MuscleGroupID, weight: Double)] {
        guard let entry = catalog.entry(id: exerciseId) else { return [] }
        var merged: [MuscleGroupID: Double] = [:]
        if let primary = MuscleGroupMapping.group(forCatalogMuscle: entry.primaryMuscle) {
            merged[primary] = primaryWeight
        }
        for secondary in entry.secondaryMuscles {
            guard let muscle = MuscleGroupMapping.group(forCatalogMuscle: secondary) else { continue }
            merged[muscle] = max(merged[muscle] ?? 0, secondaryWeight)
        }
        return merged.map { (muscle: $0.key, weight: $0.value) }
            .sorted { $0.muscle.rawValue < $1.muscle.rawValue }
    }
}
