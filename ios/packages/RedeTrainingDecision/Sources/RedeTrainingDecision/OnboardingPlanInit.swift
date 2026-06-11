// OnboardingPlanInit + ColdStartPrior — M5-1 引导（FR-ON1/2/3 最小实现）。
//
// 引导 4 问（目标/天数/器械/背景）→ 首版模板字段（splitType/daysPerWeek/primaryGoal）
// 由本纯函数映射；写入经 RedePersistence 写闸（本包不做 IO）。
// ColdStartPrior：自报背景只作冷启动先验（系统逻辑 §6.5.2/§6.5.9）——只影响
// firstExposure 起始重量的保守度，绝不放大目录值；有真实记录即被覆盖。
// 乘数为待校准值（拍板留痕 2026-06-10）：beginner 0.5 / intermediate 0.75 /
// advanced 1.0 / 未自报 1.0（现状行为，goldens 兼容）。

public struct OnboardingAnswers: Equatable, Sendable {
    public let primaryGoal: String        // hypertrophy / strength / general
    public let weeklyDays: Int
    public let equipmentScenario: String  // commercial-gym / home-dumbbell / minimal
    public let trainingLevel: String      // beginner / intermediate / advanced

    public init(primaryGoal: String, weeklyDays: Int, equipmentScenario: String, trainingLevel: String) {
        self.primaryGoal = primaryGoal
        self.weeklyDays = weeklyDays
        self.equipmentScenario = equipmentScenario
        self.trainingLevel = trainingLevel
    }
}

public struct ProgramTemplateInit: Equatable, Sendable {
    public let splitType: String
    public let daysPerWeek: Int
    public let primaryGoal: String

    public init(splitType: String, daysPerWeek: Int, primaryGoal: String) {
        self.splitType = splitType
        self.daysPerWeek = daysPerWeek
        self.primaryGoal = primaryGoal
    }
}

public enum OnboardingPlanInit {
    /// 天数 → 分化（FR-ON3 最小映射，§6.1：分化是生成策略不是唯一真相）：
    /// ≥5 天 push/pull/legs，否则 upper/lower。天数钳制 2...6。
    public static func template(for answers: OnboardingAnswers) -> ProgramTemplateInit {
        let days = min(6, max(2, answers.weeklyDays))
        let split = days >= 5 ? "push-pull-legs" : "upper-lower"
        return ProgramTemplateInit(splitType: split, daysPerWeek: days, primaryGoal: answers.primaryGoal)
    }
}

public enum ColdStartPrior {
    /// 自报背景 → 起步保守度（FR-ON2：高级=目录值上限，只减不加）。
    public static func multiplier(trainingLevel: String?) -> Double {
        switch trainingLevel {
        case "beginner": return 0.5
        case "intermediate": return 0.75
        default: return 1.0   // advanced / 未自报 / 未知值（DataHealth 已过滤）
        }
    }

    /// 首练起始重量：×先验 → 按该动作步长取整 → 下限一档（处方重量口径）。
    /// §6.1 Blocker：取整量子从全局 2.5 改 per-entry——小重量动作的先验不再
    /// 被粗量子扭曲（侧平举 7.5×0.5 在 2.5 量子下取整成 5 = 实际 67% 非 50%；
    /// 步长 1.25 时可落 3.75）。P0 目录全 2.5 → 行为零变化。
    public static func scaledStartKg(_ startWeightKg: Double, trainingLevel: String?, stepKg: Double = 2.5) -> Double {
        let scaled = startWeightKg * multiplier(trainingLevel: trainingLevel)
        return max(stepKg, (scaled / stepKg).rounded() * stepKg)
    }
}
