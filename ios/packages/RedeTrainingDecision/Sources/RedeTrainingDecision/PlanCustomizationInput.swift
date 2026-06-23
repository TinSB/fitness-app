// PlanCustomizationInput — 引擎消费的「用户自定义计划」clean 形态（FR-PL6/PL7，切片 S2/S3）。
//
// 分层（Master §8）：raw AppData.planCustomization 不直接进引擎——app/clean 层校验后构造本类型再喂
// plan()/PlanWeekProjection。引擎对本输入仍做防御消费（catalog 查不到/非可处方/越场景 → 优雅丢弃，
// 见 TodayPrescriptionEngine.customSlots）。**默认空 = 引擎逐字节等价于现状**（golden 零变化）。

import Foundation

public struct PlanCustomizationInput: Equatable, Sendable {
    /// 单个自定义动作规格：钉死 exerciseId（用户选的动作），可选覆盖组数/次数/休息（缺=引擎默认）。
    public struct ExerciseSpec: Equatable, Sendable {
        public let exerciseId: String
        public let sets: Int?
        public let repMin: Int?
        public let repMax: Int?
        public let rest: Int?
        public init(exerciseId: String, sets: Int? = nil, repMin: Int? = nil, repMax: Int? = nil, rest: Int? = nil) {
            self.exerciseId = exerciseId
            self.sets = sets
            self.repMin = repMin
            self.repMax = repMax
            self.rest = rest
        }
    }

    /// dayCode → 该训练日的有序自定义动作清单（数组顺序 = 训练顺序，FR-PL7①）。
    public let dayPlans: [String: [ExerciseSpec]]
    /// 自定义日序（FR-PL7②）；nil = 引擎默认 daySequence。须为默认日序的排列，否则引擎回退默认。
    public let daySequence: [String]?

    public init(dayPlans: [String: [ExerciseSpec]] = [:], daySequence: [String]? = nil) {
        self.dayPlans = dayPlans
        self.daySequence = daySequence
    }

    /// 空覆盖：引擎行为逐字节等价于现状（默认参数即此值 → golden 零变化）。
    public static let empty = PlanCustomizationInput()
}
