// PlanCustomizationBridge — FR-PL6/PL7 切片 S6：域层 AppData.planCustomization →
// 引擎 PlanCustomizationInput 的 app 层转换（持目录的这一层做，Master §8：raw 不直接进引擎）。
//
// 职责：结构映射 + 数值范围钳制（sets 1…10 / repMin≤repMax∈1…50 / rest 0…600）。catalog 合法性
// （exerciseId 存在/可处方/越场景）由引擎 customSlots 防御消费（查不到即丢），此处不重复。

import Foundation
import RedeDomain
import RedeTrainingDecision

enum PlanCustomizationBridge {
    /// 域层自定义 → 引擎输入（nil/全空 → .empty = 引擎逐字段等价于现状）。
    static func input(from custom: PlanCustomization?) -> PlanCustomizationInput {
        guard let custom else { return .empty }
        var dayPlans: [String: [PlanCustomizationInput.ExerciseSpec]] = [:]
        for (dayCode, day) in custom.dayPlans {
            let specs = day.exercises.map { item in
                PlanCustomizationInput.ExerciseSpec(
                    exerciseId: item.exerciseId,
                    sets: item.sets.map { min(10, max(1, $0)) },
                    repMin: item.repMin.map { min(50, max(1, $0)) },
                    repMax: item.repMax.map { min(50, max(1, $0)) },
                    rest: item.rest.map { min(600, max(0, $0)) }
                )
            }
            if !specs.isEmpty { dayPlans[dayCode] = specs }
        }
        return PlanCustomizationInput(dayPlans: dayPlans, daySequence: custom.daySequence)
    }
}
