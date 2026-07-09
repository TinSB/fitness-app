// PlanCustomizationImpact — FR-PL6.1 自定义计划「改动影响」纯函数（切片 S7）。
//
// 给计划编辑器的「预览」用：算采纳自定义前后**每肌群每周训练频率**的变化，护栏=提示不强制
// （droppedBelowTwice = 从 ≥2×/周 跌到 <2× 的肌群 = 核心频率护栏，也是 A/B 分化破坏的度量）。
//
// 诚实限制（§6.1 catalog limitation）：基于 catalog 单值 `primaryMuscle` 的**频率级**近似——
// 不算 secondaryMuscles 的部分贡献、不做 sets×reps 容量精算（肌群贡献权重 P0 仍缺席）。
// 对「肩 2×→1×」这类频率提示足够；不冒充精确容量分析。
//
// 设计：本函数只做**纯表格统计**——调用方（计划编辑器）用引擎对"当前生效计划"与"待采纳计划"
// 各跑一周 plan() 得到每个训练日的已解析动作 id 列表，喂进来；本层 catalog 查 primaryMuscle 计频。
// 这样影响计算与引擎选材口径完全一致（用的就是引擎真实输出），且本函数零引擎耦合、可独立单测。

import Foundation

public enum PlanCustomizationImpact {
    // 命名 Summary（非 Result，避免与 Swift.Result 歧义，审查 NIT-1）。
    public struct Summary: Equatable, Sendable {
        /// primaryMuscle → 该肌群一周内被练到的**训练日数**（同一天多动作命中同肌群只计 1）。
        public let frequencyBefore: [String: Int]
        public let frequencyAfter: [String: Int]
        /// 从 ≥2×/周 跌到 <2×/周 的肌群（升序）——核心护栏：提示用户"练偏了"，但不阻止采纳。
        public let droppedBelowTwice: [String]
        /// 跨族换动作的 exerciseId（来自 customization 跨族标记，原样回传供 UI 提示/确认）。
        public let crossFamilyChanges: [String]

        public init(frequencyBefore: [String: Int], frequencyAfter: [String: Int],
                    droppedBelowTwice: [String], crossFamilyChanges: [String]) {
            self.frequencyBefore = frequencyBefore
            self.frequencyAfter = frequencyAfter
            self.droppedBelowTwice = droppedBelowTwice
            self.crossFamilyChanges = crossFamilyChanges
        }
    }

    /// - Parameters:
    ///   - weekBefore: 当前生效计划一周内每个训练日的已解析动作 id 列表（引擎跑出）。
    ///   - weekAfter: 待采纳计划同口径的一周列表。
    ///   - crossFamilyExerciseIds: 本次自定义里被标记为跨族换的 exerciseId（原样回传）。
    public static func compute(
        weekBefore: [[String]],
        weekAfter: [[String]],
        crossFamilyExerciseIds: [String] = [],
        catalog: ExerciseCatalog = .minimal
    ) -> Summary {
        let before = muscleDayFrequency(week: weekBefore, catalog: catalog)
        let after = muscleDayFrequency(week: weekAfter, catalog: catalog)
        // 跌破 2×：before≥2 且 after<2（含 after 缺该肌群=0）。
        let dropped = before
            .filter { $0.value >= 2 && (after[$0.key] ?? 0) < 2 }
            .map(\.key)
            .sorted()
        return Summary(
            frequencyBefore: before,
            frequencyAfter: after,
            droppedBelowTwice: dropped,
            crossFamilyChanges: crossFamilyExerciseIds
        )
    }

    /// 每肌群被练到的训练日数：对每个训练日，取该日动作 primaryMuscle 的**去重集合**，逐肌群计数 +1。
    private static func muscleDayFrequency(week: [[String]], catalog: ExerciseCatalog) -> [String: Int] {
        var freq: [String: Int] = [:]
        for day in week {
            var musclesThisDay = Set<String>()
            for exerciseId in day {
                // 频率护栏面归并回 10 大块（2026-07-09 子肌群钻取后：目录 primaryMuscle
                // 细化为 lats/upper-back/front-delt 等——编辑器「背部 2次/周」比拆开
                // 更符合频率守卫语义；细粒度归钻取详情页）。无归宿值（forearm）保留原值。
                if let raw = catalog.entry(id: exerciseId)?.primaryMuscle, !raw.isEmpty {
                    let m = MuscleGroupMapping.group(forCatalogMuscle: raw)?.rawValue ?? raw
                    musclesThisDay.insert(m)
                }
            }
            for muscle in musclesThisDay { freq[muscle, default: 0] += 1 }
        }
        return freq
    }
}
