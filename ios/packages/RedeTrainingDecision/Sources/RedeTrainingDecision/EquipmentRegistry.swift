// EquipmentRegistry — 器械类运行时单一真源（§6.1 Blocker，2026-06-11）。
//
// 二审教训：器械知识曾散落三处字符串字面量（EquipmentAccess 白名单、槽位
// equipment/kind pin、FR-EQ1 软化键），加一类器械要同步改 N 处且无编译期
// 联动——「填俯卧撑清缺口」会被白名单静默滤掉。本注册表收口三件事：
//   1. 器械类封闭集合（合同测试与匹配共用，不再各抄一份）
//   2. machine 类成员资格（FR-EQ1 软化键改拴在这里，不再拴 kind 字符串）
//   3. 场景 × 器械类可用性矩阵（EquipmentAccess 从此派生）
// P1 扩器械类（bodyweight/band/kettlebell/assisted、machine 拆分）只改本文件
// + 目录数据 + 覆盖矩阵 golden，三者同 PR。

public enum EquipmentRegistry {
    /// 器械类封闭集合（machine 拆分落地 2026-06-11：plate-loaded 挂片式 /
    /// selectorized 插销配重栈——原 id 原地改值，§6.1 铁律）。
    public static let allClasses: Set<String> = [
        "barbell", "dumbbell", "cable", "plate-loaded", "selectorized",
    ]

    /// 「固定器械」类成员（FR-EQ1 accessory 槽软化键 + 器械槽位匹配键）：
    /// 场景白名单与本集合不相交 = 该场景无固定器械 → accessory 偏好软化。
    /// 内容前置条件（审查 M2 留痕）：目录暂无 selectorized 复合深蹲条目——
    /// 未来新增 selectorized-only 场景前必须先补该类条目，否则 lower 日主槽
    /// 将如实 slotUnfilled（覆盖矩阵 golden 会红，按 §3 流程登记或补内容）。
    public static let machineClasses: Set<String> = ["plate-loaded", "selectorized"]

    /// 场景 → 可用器械类。commercial-gym **故意不入表** = nil（全器械可用）；
    /// 缺失/未知场景同样退化 nil（DataHealth 投影层已把未知值滤成 nil）。
    /// 现状边界（如实）：目录暂无自重/弹力带条目，home-dumbbell 与 minimal
    /// 都收敛为 dumbbell-only——minimal 的「自重」覆盖等 P1 bodyweight wave
    /// 落地时与本矩阵同 PR 放开。
    public static let scenarioAccess: [String: Set<String>] = [
        "home-dumbbell": ["dumbbell"],
        "minimal": ["dumbbell"],
    ]

    /// 负重语义封闭集合（§6.1）：external 之外的类型在对应引擎支持落地前
    /// 禁止进处方/替换（TodayPrescriptionEngine / ExerciseReplacementEngine 硬过滤）。
    public static let loadTypes: Set<String> = [
        "external", "bodyweight", "bodyweight-plus", "assisted", "band",
    ]

    /// 当前引擎已支持的负重语义（渐进/疼痛瀑布/PR/吨位全链路）。
    public static let prescribableLoadTypes: Set<String> = ["external"]
}
