// ExerciseCatalog（最小）— 动作事实唯一权威（系统逻辑 §6.1；PRD FR-EX1 / 开放决策 #1
// 已拍板：覆盖起始计划生成 + 常见替换的最小集，宁可少而准）。
//
// 字段只放「事实」：稳定 id、movement pattern、主/次肌群、器械、替代族、保守起始
// 重量（kg）。展示名（双语）不在这里——引擎零文案，名称归 RedeL10n（M2-3 落地）。
// 肌群贡献权重与禁忌提示本版缺席：按 §6.1 红线如实声明 limitation，相关高置信
// 建议（肌群级分析）在补齐前不得基于本 catalog 产出。
//
// 数据来源：legacy 模板库存（tag legacy-parity-final 的 DefaultTemplates/
// ExerciseLibrary）的事实性复用——id、肌群、器械、起始重量逐条核对移植；
// 同动作跨模板的起始值冲突取首次声明（MVP 简化，已留痕）。
//
// 重量口径（显式产品声明，渲染层据此标注）：哑铃/单边动作 startWeightKg =
// 单只哑铃重量；杠铃 = 总杠重（含杆）；cable/machine = 配重片读数。
//
// 条目声明顺序是合同的一部分：日计划槽位按「目录顺序第一个未用且匹配」选动作，
// 调整顺序 = 调整生成结果，必须让 goldens 红（五个训练日均有 golden 锁定）。

public struct ExerciseCatalogEntry: Equatable, Sendable {
    public let id: String
    public let movementPattern: String
    public let primaryMuscle: String
    public let secondaryMuscles: [String]
    /// barbell / dumbbell / cable / machine
    public let equipment: String
    /// compound / machine / isolation（训练学角色，沿 legacy 词汇）
    public let kind: String
    public let substitutionGroup: String
    public let startWeightKg: Double

    public init(
        id: String, movementPattern: String, primaryMuscle: String,
        secondaryMuscles: [String] = [], equipment: String, kind: String,
        substitutionGroup: String, startWeightKg: Double
    ) {
        self.id = id
        self.movementPattern = movementPattern
        self.primaryMuscle = primaryMuscle
        self.secondaryMuscles = secondaryMuscles
        self.equipment = equipment
        self.kind = kind
        self.substitutionGroup = substitutionGroup
        self.startWeightKg = startWeightKg
    }
}

public struct ExerciseCatalog: Equatable, Sendable {
    public let catalogVersion: String
    public let entries: [ExerciseCatalogEntry]

    public func entry(id: String) -> ExerciseCatalogEntry? {
        entries.first { $0.id == id }
    }

    public static let minimal = ExerciseCatalog(
        catalogVersion: "mvp-1",
        entries: [
            // 胸 / 推
            .init(id: "bench-press", movementPattern: "horizontal-press", primaryMuscle: "chest", secondaryMuscles: ["triceps", "front-delt"], equipment: "barbell", kind: "compound", substitutionGroup: "chest-press", startWeightKg: 60),
            .init(id: "incline-db-press", movementPattern: "incline-press", primaryMuscle: "chest", secondaryMuscles: ["front-delt", "triceps"], equipment: "dumbbell", kind: "compound", substitutionGroup: "chest-press", startWeightKg: 22.5),
            .init(id: "db-bench-press", movementPattern: "horizontal-press", primaryMuscle: "chest", secondaryMuscles: ["triceps", "front-delt"], equipment: "dumbbell", kind: "compound", substitutionGroup: "chest-press", startWeightKg: 30),
            .init(id: "machine-chest-press", movementPattern: "horizontal-press", primaryMuscle: "chest", secondaryMuscles: ["triceps"], equipment: "machine", kind: "machine", substitutionGroup: "chest-press", startWeightKg: 55),
            .init(id: "cable-fly", movementPattern: "fly", primaryMuscle: "chest", equipment: "cable", kind: "isolation", substitutionGroup: "chest-fly", startWeightKg: 17.5),
            // 背 / 拉
            .init(id: "lat-pulldown", movementPattern: "vertical-pull", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "cable", kind: "compound", substitutionGroup: "vertical-pull", startWeightKg: 55),
            .init(id: "seated-row", movementPattern: "horizontal-pull", primaryMuscle: "back", secondaryMuscles: ["biceps", "rear-delt"], equipment: "cable", kind: "compound", substitutionGroup: "row", startWeightKg: 50),
            .init(id: "barbell-row", movementPattern: "horizontal-pull", primaryMuscle: "back", secondaryMuscles: ["biceps", "rear-delt"], equipment: "barbell", kind: "compound", substitutionGroup: "row", startWeightKg: 50),
            // legacy 起始值 26kg，归一化到 2.5kg 网格（处方重量一律 2.5 取整）。
            .init(id: "one-arm-db-row", movementPattern: "horizontal-pull", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "dumbbell", kind: "compound", substitutionGroup: "row", startWeightKg: 25),
            .init(id: "face-pull", movementPattern: "rear-delt", primaryMuscle: "rear-delt", secondaryMuscles: ["upper-back"], equipment: "cable", kind: "isolation", substitutionGroup: "rear-delt", startWeightKg: 20),
            // 肩
            .init(id: "shoulder-press", movementPattern: "vertical-press", primaryMuscle: "shoulder", secondaryMuscles: ["triceps"], equipment: "dumbbell", kind: "compound", substitutionGroup: "shoulder-press", startWeightKg: 20),
            .init(id: "lateral-raise", movementPattern: "lateral-raise", primaryMuscle: "side-delt", equipment: "dumbbell", kind: "isolation", substitutionGroup: "side-delt", startWeightKg: 7.5),
            // 手臂
            .init(id: "db-curl", movementPattern: "curl", primaryMuscle: "biceps", equipment: "dumbbell", kind: "isolation", substitutionGroup: "biceps-curl", startWeightKg: 12.5),
            .init(id: "hammer-curl", movementPattern: "curl", primaryMuscle: "biceps", secondaryMuscles: ["forearm"], equipment: "dumbbell", kind: "isolation", substitutionGroup: "biceps-curl", startWeightKg: 12.5),
            .init(id: "preacher-curl", movementPattern: "curl", primaryMuscle: "biceps", equipment: "barbell", kind: "isolation", substitutionGroup: "biceps-curl", startWeightKg: 25),
            .init(id: "triceps-pushdown", movementPattern: "triceps-extension", primaryMuscle: "triceps", equipment: "cable", kind: "isolation", substitutionGroup: "triceps", startWeightKg: 25),
            .init(id: "close-grip-bench", movementPattern: "horizontal-press", primaryMuscle: "triceps", secondaryMuscles: ["chest"], equipment: "barbell", kind: "compound", substitutionGroup: "triceps", startWeightKg: 50),
            // 腿
            .init(id: "squat", movementPattern: "squat-pattern", primaryMuscle: "quads", secondaryMuscles: ["glutes", "core"], equipment: "barbell", kind: "compound", substitutionGroup: "squat", startWeightKg: 80),
            .init(id: "hack-squat", movementPattern: "squat-pattern", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "machine", kind: "compound", substitutionGroup: "squat", startWeightKg: 80),
            .init(id: "leg-press", movementPattern: "squat-pattern", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "machine", kind: "machine", substitutionGroup: "squat", startWeightKg: 140),
            .init(id: "romanian-deadlift", movementPattern: "hinge", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "lower-back"], equipment: "barbell", kind: "compound", substitutionGroup: "hinge", startWeightKg: 70),
            .init(id: "db-rdl", movementPattern: "hinge", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes"], equipment: "dumbbell", kind: "compound", substitutionGroup: "hinge", startWeightKg: 30),
            .init(id: "leg-curl", movementPattern: "knee-flexion", primaryMuscle: "hamstrings", equipment: "machine", kind: "isolation", substitutionGroup: "hamstring-curl", startWeightKg: 40),
            .init(id: "calf-raise", movementPattern: "calf-raise", primaryMuscle: "calves", equipment: "machine", kind: "isolation", substitutionGroup: "calves", startWeightKg: 50),

            // FR-EQ1 家用哑铃覆盖（2026-06-11）：补齐槽位 pattern 的 dumbbell 选项。
            // 一律附加在目录尾部——first-match 顺序不变，commercial/无场景行为与 golden 稳定。
            // 重量口径：哑铃/单边 = 单只哑铃重量（系统逻辑 §153）。
            .init(id: "goblet-squat", movementPattern: "squat-pattern", primaryMuscle: "quads", secondaryMuscles: ["glutes", "core"], equipment: "dumbbell", kind: "compound", substitutionGroup: "squat", startWeightKg: 17.5),
            .init(id: "db-lunge", movementPattern: "squat-pattern", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "dumbbell", kind: "compound", substitutionGroup: "squat", startWeightKg: 12.5),
            .init(id: "db-fly", movementPattern: "fly", primaryMuscle: "chest", equipment: "dumbbell", kind: "isolation", substitutionGroup: "chest-fly", startWeightKg: 10),
            .init(id: "db-pullover", movementPattern: "vertical-pull", primaryMuscle: "back", secondaryMuscles: ["chest"], equipment: "dumbbell", kind: "compound", substitutionGroup: "vertical-pull", startWeightKg: 15),
            .init(id: "rear-delt-fly", movementPattern: "rear-delt", primaryMuscle: "rear-delt", secondaryMuscles: ["upper-back"], equipment: "dumbbell", kind: "isolation", substitutionGroup: "rear-delt", startWeightKg: 7.5),
            .init(id: "db-overhead-triceps-extension", movementPattern: "triceps-extension", primaryMuscle: "triceps", equipment: "dumbbell", kind: "isolation", substitutionGroup: "triceps", startWeightKg: 10),
            .init(id: "db-calf-raise", movementPattern: "calf-raise", primaryMuscle: "calves", equipment: "dumbbell", kind: "isolation", substitutionGroup: "calves", startWeightKg: 17.5),
        ]
    )
}
