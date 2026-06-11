// SessionIntentModels — 跳过 / 替换 / 收尾原因模型（M3-1）。
//
// 全 typed：rawValue 即留痕 code，双语文案归 RedeL10n（M3-3）。
// 跳过/替换是引擎输入事实（写入合同 §5 的 saved-session replacement 在
// M3-3 经唯一写闸落盘）；替换候选 = catalog 同替代族（FR-TR6）。

public enum SetSkipReason: String, CaseIterable, Equatable, Sendable, Codable {
    case equipmentBusy
    case painDiscomfort
    case fatigue
    case timeShort
    case other
}

public enum SessionEndReason: String, CaseIterable, Equatable, Sendable, Codable {
    case completedAll
    case timeUp
    case fatigue
    case pain
    case other
}

public enum ExerciseReplacementEngine {
    /// 同替代族候选（catalog 声明顺序，排除自身与当日已排动作）；未知 id → 空。
    /// M3-3 接线时调用方必须传入当天清单的动作 id 集合，避免替换成已有动作。
    /// FR-EQ1（2026-06-11）：candidates 同守器械白名单（nil = 不过滤）——
    /// 不能给家用哑铃用户推荐换成器械推胸。
    public static func candidates(
        for exerciseId: String,
        catalog: ExerciseCatalog = .minimal,
        excluding alreadyScheduledIds: Set<String> = [],
        allowedEquipment: Set<String>? = nil
    ) -> [String] {
        guard let entry = catalog.entry(id: exerciseId) else { return [] }
        return catalog.entries
            .filter {
                !$0.deprecated
                    // §6.1：非 external 负重语义未获引擎支持，禁入替换候选
                    && EquipmentRegistry.prescribableLoadTypes.contains($0.loadType)
                    && $0.substitutionGroup == entry.substitutionGroup
                    && $0.id != exerciseId
                    && !alreadyScheduledIds.contains($0.id)
                    && (allowedEquipment == nil || allowedEquipment!.contains($0.equipment))
            }
            .sorted { ($0.rank, $0.id) < ($1.rank, $1.id) }   // 内容系统 P0：去顺序化
            .map(\.id)
    }
}
