// EquipmentAccess — FR-EQ1（2026-06-11 补课）：器械场景 → 可用器械白名单。
//
// 引导问的「你在哪练」从「只落档」变「真消费」：处方槽位与换动作候选都按
// 白名单过滤。nil = 不过滤（commercial-gym / 缺失 / 未知场景），保证既有
// golden 行为与无档案用户不受影响。
//
// Blocker schema PR（2026-06-11）：场景矩阵收口进 EquipmentRegistry——
// 本类型只是查询入口，不再自带硬编码表。

public enum EquipmentAccess {
    /// 场景 → 可用器械白名单；nil = 全部可用（不过滤）。
    public static func allowed(for scenario: String?) -> Set<String>? {
        guard let scenario else { return nil }
        return EquipmentRegistry.scenarioAccess[scenario]
    }
}
