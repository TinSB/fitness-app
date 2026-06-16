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
        "bodyweight",   // wave-6（2026-06-13）：自重——loadType 闸开启
        "smith",        // wave-8（2026-06-13）：史密斯导轨架——挂奥片、external 负重、商业房通用
        "band",         // wave-12（2026-06-14）：弹力带——无 kg 轴、按次数进阶，家用/居家/旅行通用
    ]

    /// 「固定器械」类成员（FR-EQ1 accessory 槽软化键 + 器械槽位匹配键）：
    /// 场景白名单与本集合不相交 = 该场景无固定器械 → accessory 偏好软化。
    /// 内容前置条件（审查 M2 留痕）：目录暂无 selectorized 复合深蹲条目——
    /// 未来新增 selectorized-only 场景前必须先补该类条目，否则 lower 日主槽
    /// 将如实 slotUnfilled（覆盖矩阵 golden 会红，按 §3 流程登记或补内容）。
    public static let machineClasses: Set<String> = ["plate-loaded", "selectorized", "smith"]
    // wave-8（2026-06-13）：史密斯导轨架是固定路径站 → isGuided=true，按合同
    // 「guided ⟹ 固定器械类」纳入本集合。语义自洽：squat-pattern 固定器械槽
    // （§slots line 92）从此把史密斯深蹲也算合法候选。零行为变化：smith rank 全
    // 920+ 尾部，槽位挑最低 rank，默认仍选既有固定器械（主槽 hack-squat rank 180 /
    // 辅槽 leg-press rank 190 在前）；家用/极简白名单不含 smith，accessory 软化判定不变。

    /// 场景 → 可用器械类。commercial-gym **故意不入表** = nil（全器械可用）；
    /// 缺失/未知场景同样退化 nil（DataHealth 投影层已把未知值滤成 nil）。
    /// 现状边界（如实）：目录暂无自重/弹力带条目，home-dumbbell 与 minimal
    /// 都收敛为 dumbbell-only——minimal 的「自重」覆盖等 P1 bodyweight wave
    /// 落地时与本矩阵同 PR 放开。
    /// bodyweight 对所有有限场景隐含可用（徒手不需器械）：家用/极简都加 bodyweight。
    /// band（弹力带，wave-12）同理是家用/居家/旅行轻量器械——家用/极简都加 band。
    public static let scenarioAccess: [String: Set<String>] = [
        "home-dumbbell": ["dumbbell", "bodyweight", "band"],
        "minimal": ["dumbbell", "bodyweight", "band"],
    ]

    /// 负重语义封闭集合（§6.1）：external 之外的类型在对应引擎支持落地前
    /// 禁止进处方/替换（TodayPrescriptionEngine / ExerciseReplacementEngine 硬过滤）。
    public static let loadTypes: Set<String> = [
        "external", "bodyweight", "bodyweight-plus", "assisted", "band",
    ]

    /// 当前引擎已支持的负重语义。bodyweight（自重）于 wave-6 加入——按次数进阶、
    /// 重量轴不参与（owner 拍板 2026-06-13）；assisted（反向器械）于 wave-9 加入——
    /// 辅助量轴方向反转（越多辅助=越轻=安全方向），进阶=减辅助、安全缓降=加辅助、
    /// 不进吨位/e1RM、到底毕业换自重版（owner 拍板 2026-06-13）；bodyweight-plus（负重
    /// 自重）于 wave-11 加入——重量轴=外挂负重，方向同 external（加负重=更难）、外加负重
    /// 计入吨位、减到最小一片还吃力则自动回退换自重孪生（owner 拍板 2026-06-14）；band（弹力带）
    /// 于 wave-12 加入——A 案「按次数进阶」（owner 拍板 2026-06-14）：复用自重引擎、无 kg 轴、
    /// 不计入吨位（weight 恒 0），唯一分叉=次数到顶提示换重一档的带子（.bandCeilingReached）。
    /// 至此 prescribableLoadTypes == loadTypes（全部负重语义已开闸，无闸内类型）。
    public static let prescribableLoadTypes: Set<String> = ["external", "bodyweight", "assisted", "bodyweight-plus", "band"]
}
