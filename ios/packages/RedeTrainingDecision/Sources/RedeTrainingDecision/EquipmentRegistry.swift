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
    /// 器械类封闭集合（MVP 四类；`machine` 为 plate-loaded/selectorized 合并档）。
    public static let allClasses: Set<String> = ["barbell", "dumbbell", "cable", "machine"]

    /// 「固定器械」类成员（FR-EQ1 accessory 槽软化键）：场景白名单与本集合
    /// 不相交 = 该场景无固定器械 → accessory 偏好软化。P1 machine 拆分后
    /// 此集合变 {plate-loaded, selectorized}，软化逻辑零改动。
    public static let machineClasses: Set<String> = ["machine"]

    /// 场景 → 可用器械类；不在表内（commercial-gym / 缺失 / 未知）= 不过滤。
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
