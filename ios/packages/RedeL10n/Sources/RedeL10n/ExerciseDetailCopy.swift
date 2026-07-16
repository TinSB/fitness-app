// ExerciseDetailCopy — FR-EX2 动作详情文案：把目录里的内部码（模式/肌群/器械/类型）
// 渲染成双语展示标签 + 详情页区块标题。
//
// 码源 = Resources/exercises.json（wave-15，123 条）的 distinct 值：
//   movementPattern 17 · primaryMuscle/secondaryMuscles 合并 17 · equipment 8 · kind 3。
// 未知码回退原值（不崩、不编）。技术要点/循证（R1 收尾）：7 主项已填 techniqueCuesZh/En +
// 真实核验 evidenceTag/Url（同行评审/NSCA）；其余动作字段为空 → 详情页只展示结构化元数据、不假造。

import Foundation

extension RedeStrings {
    // MARK: - 详情页区块标题（Overline）

    public var exerciseDetailPattern: String { locale == .zh ? "动作模式" : "Movement" }
    public var exerciseDetailPrimary: String { locale == .zh ? "主要肌群" : "Primary" }
    public var exerciseDetailSecondary: String { locale == .zh ? "次要参与" : "Also works" }
    public var exerciseDetailEquipment: String { locale == .zh ? "器械" : "Equipment" }
    public var exerciseDetailType: String { locale == .zh ? "类型" : "Type" }
    public var exerciseDetailAlternatives: String { locale == .zh ? "替代动作" : "Alternatives" }
    /// FR-EX2 技术要点区块标题。
    public var exerciseDetailTechnique: String { locale == .zh ? "技术要点" : "Technique" }
    /// FR-EX2 循证依据区块标题（来源真实可核验，不编引用）。
    public var exerciseDetailEvidence: String { locale == .zh ? "循证依据" : "Evidence" }
    /// 循证来源链接行（点开真实出处）。
    public var exerciseDetailViewSource: String { locale == .zh ? "查看来源" : "View source" }
    /// FR-EX2 退阶/进阶区块标题与行内标签（缺内容则不显示）。
    public var exerciseDetailScaling: String { locale == .zh ? "调整难度" : "Adjust difficulty" }
    public var exerciseDetailRegression: String { locale == .zh ? "退阶" : "Easier" }
    public var exerciseDetailProgression: String { locale == .zh ? "进阶" : "Harder" }
    /// FR-EX2 注意事项区块标题（映射规格「禁忌提示」；§7.1 fitness≠medical 措辞，不用「禁忌」字样）。
    public var exerciseDetailSafety: String { locale == .zh ? "注意事项" : "Form & safety" }
    /// 无替代动作时的诚实占位。
    public var exerciseDetailNoAlternatives: String {
        locale == .zh ? "暂无同族替代动作" : "No equivalent alternatives yet"
    }
    /// 今日清单行可点开详情的无障碍提示。
    public var exerciseDetailHint: String {
        locale == .zh ? "查看动作详情" : "View exercise details"
    }

    // MARK: - 动作库浏览器（K2 2026-07-16：165 条目录首个浏览入口，计划页）

    /// 浏览页标题。
    public var exerciseLibraryTitle: String { locale == .zh ? "动作库" : "Exercise library" }
    /// 计划页入口行："动作库 · 165 个动作"（计数 = 目录在架条目，动态取真值不硬编码）。
    public func exerciseLibraryEntry(_ count: Int) -> String {
        locale == .zh
            ? "动作库 · \(count) 个动作"
            : (count == 1 ? "Exercise library · 1 exercise" : "Exercise library · \(count) exercises")
    }

    // MARK: - 码 → 双语标签

    public func movementPatternLabel(_ code: String) -> String { detailLabel(code, Self.patternLabels) }
    public func muscleLabel(_ code: String) -> String { detailLabel(code, Self.muscleLabels) }
    public func equipmentLabel(_ code: String) -> String { detailLabel(code, Self.equipmentLabels) }
    public func exerciseKindLabel(_ code: String) -> String { detailLabel(code, Self.kindLabels) }

    /// 多个肌群码连成「· 」分隔的展示串（空 → 空串）。
    public func muscleListLabel(_ codes: [String]) -> String {
        codes.map(muscleLabel).joined(separator: " · ")
    }

    private func detailLabel(_ code: String, _ map: [String: (zh: String, en: String)]) -> String {
        guard let pair = map[code] else { return code } // 未知码：回退原值，不编
        return locale == .zh ? pair.zh : pair.en
    }

    private static let patternLabels: [String: (zh: String, en: String)] = [
        "horizontal-press": ("水平推", "Horizontal press"),
        "incline-press": ("上斜推", "Incline press"),
        "vertical-press": ("垂直推", "Vertical press"),
        "horizontal-pull": ("水平拉", "Horizontal pull"),
        "vertical-pull": ("垂直拉", "Vertical pull"),
        "squat-pattern": ("深蹲", "Squat"),
        "hinge": ("髋铰链", "Hinge"),
        "knee-extension": ("伸膝", "Knee extension"),
        "knee-flexion": ("屈膝", "Knee flexion"),
        "calf-raise": ("提踵", "Calf raise"),
        "curl": ("弯举", "Curl"),
        "triceps-extension": ("臂屈伸", "Triceps extension"),
        "lateral-raise": ("侧平举", "Lateral raise"),
        "rear-delt": ("后束", "Rear delt"),
        "fly": ("飞鸟", "Fly"),
        "shrug": ("耸肩", "Shrug"),
        "core": ("核心", "Core"),
        "hip-abduction": ("髋外展", "Hip abduction"),   // wave-17
        "hip-adduction": ("髋内收", "Hip adduction"),   // wave-17
        "front-raise": ("前平举", "Front raise"),       // wave-17
        "upright-row": ("直立划船", "Upright row"),     // wave-17
        "wrist-curl": ("腕屈伸", "Wrist curl"),         // wave-17（含正/反向腕弯举）
    ]

    private static let muscleLabels: [String: (zh: String, en: String)] = [
        "chest": ("胸", "Chest"),
        "back": ("背", "Back"),
        "upper-back": ("上背", "Upper back"),
        "lower-back": ("下背", "Lower back"),
        "shoulder": ("肩", "Shoulders"),
        "front-delt": ("前束", "Front delt"),
        "side-delt": ("侧束", "Side delt"),
        "rear-delt": ("后束", "Rear delt"),
        "biceps": ("肱二头", "Biceps"),
        "triceps": ("肱三头", "Triceps"),
        "forearm": ("前臂", "Forearms"),
        "traps": ("斜方", "Traps"),
        "core": ("核心", "Core"),
        "quads": ("股四头", "Quads"),
        "hamstrings": ("腘绳", "Hamstrings"),
        "glutes": ("臀", "Glutes"),
        "calves": ("小腿", "Calves"),
        "adductors": ("内收肌", "Adductors"),   // wave-17：髋内收机
    ]

    private static let equipmentLabels: [String: (zh: String, en: String)] = [
        "barbell": ("杠铃", "Barbell"),
        "dumbbell": ("哑铃", "Dumbbell"),
        "cable": ("绳索", "Cable"),
        "band": ("弹力带", "Band"),
        "bodyweight": ("自重", "Bodyweight"),
        "plate-loaded": ("杠片机械", "Plate-loaded"),
        "selectorized": ("插销机械", "Selectorized"),
        "smith": ("史密斯机", "Smith machine"),
    ]

    private static let kindLabels: [String: (zh: String, en: String)] = [
        "compound": ("复合", "Compound"),
        "isolation": ("孤立", "Isolation"),
        "accessory": ("辅助", "Accessory"),
    ]
}
