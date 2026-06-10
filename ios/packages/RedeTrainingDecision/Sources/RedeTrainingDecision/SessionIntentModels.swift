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
    public static func candidates(
        for exerciseId: String,
        catalog: ExerciseCatalog = .minimal,
        excluding alreadyScheduledIds: Set<String> = []
    ) -> [String] {
        guard let entry = catalog.entry(id: exerciseId) else { return [] }
        return catalog.entries
            .filter {
                $0.substitutionGroup == entry.substitutionGroup
                    && $0.id != exerciseId
                    && !alreadyScheduledIds.contains($0.id)
            }
            .map(\.id)
    }
}
