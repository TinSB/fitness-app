// EquipmentAccess — FR-EQ1（2026-06-11 补课）：器械场景 → 可用器械白名单。
//
// 引导问的「你在哪练」从「只落档」变「真消费」：处方槽位与换动作候选都按
// 白名单过滤。nil = 不过滤（commercial-gym / 缺失 / 未知场景），保证既有
// golden 行为与无档案用户不受影响。
//
// 现状边界（如实）：目录暂无自重/弹力带条目，home-dumbbell 与 minimal 都
// 收敛为 dumbbell-only——minimal 的「自重」覆盖归目录扩充（§6.3 三层内容）。

public enum EquipmentAccess {
    /// 场景 → 可用器械白名单；nil = 全部可用（不过滤）。
    public static func allowed(for scenario: String?) -> Set<String>? {
        switch scenario {
        case "home-dumbbell", "minimal":
            return ["dumbbell"]
        default:
            return nil
        }
    }
}
