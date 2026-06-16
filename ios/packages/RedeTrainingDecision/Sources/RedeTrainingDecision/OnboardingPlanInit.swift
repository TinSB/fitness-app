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
    /// 天数 → 分化（循证频率映射，方案 2026-06-16）：每肌群尽量 2×/周。
    /// 6→PPL×2(A/B 全 2×)｜5→PPL+UL(腿 2×)｜4→上下肢(2×)｜2-3→上下肢(暂；全身待 Slice 2)。
    /// 天数钳制 2...6。
    public static func template(for answers: OnboardingAnswers) -> ProgramTemplateInit {
        let days = min(6, max(2, answers.weeklyDays))
        let split: String
        switch days {
        case 6: split = "push-pull-legs"   // 推A拉A腿A推B拉B腿B
        case 5: split = "ppl-ul"           // 推A拉A腿A·上·下（腿 2×）
        default: split = "upper-lower"     // 4 天上下肢；2-3 天暂上下肢（全身 Slice 2 接）
        }
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

    /// 辅助器械首练「辅助保守度」——方向反转（wave-9，owner 拍板）：辅助越多=越轻松，
    /// 故新手要**更多**辅助、高级要更少（external 先验的镜像）。新手 ×1.5 / 中 ×1.0 / 高 ×0.5。
    /// （external 是 0.5/0.75/1.0——给新手更少负重；assisted 必须倒过来，否则做不动引体
    /// 的新手得到更少帮助 = 更难 = 危险。）
    public static func assistMultiplier(trainingLevel: String?) -> Double {
        switch trainingLevel {
        case "beginner": return 1.5
        case "intermediate": return 1.0
        default: return 0.5   // advanced / 未自报 / 未知值（接近能自重，少帮）
        }
    }

    /// 辅助器械首练辅助量：×反转先验 → 按器械步长取整 → 下限一档。
    public static func scaledAssistKg(_ startAssistKg: Double, trainingLevel: String?, stepKg: Double) -> Double {
        let scaled = startAssistKg * assistMultiplier(trainingLevel: trainingLevel)
        return max(stepKg, (scaled / stepKg).rounded() * stepKg)
    }
}
