// AdjustOptions — M5-3 快改刻度轨：语义档位生成 + 预演（拍板 2026-06-10）。
//
// 把「算数字」变成「做决定」：档位由引擎事实生成（跟随/上组/计划/轻重一档），
// 按值去重（固定优先级 跟随>上组>计划>轻重档）后升序排列——位置稳定是肌肉
// 记忆的前提。纯函数、引擎零文案：role 是 typed code，渲染层经 RedeL10n 出双语。
// 预演=落盘同规则：AdjustPreview 直接调用 NextSetEngine，预演说什么打勾后就发生什么。

public struct AdjustOption: Equatable, Sendable {
    public enum Role: String, Equatable, Sendable {
        case follow      // 当前建议（Hold 开启时即计划值）
        case last        // 上组实际
        case plan        // 本组计划
        case lighter     // 建议 − 一档
        case heavier     // 建议 + 一档
    }

    public let role: Role
    public let weightKg: Double

    public init(role: Role, weightKg: Double) {
        self.role = role
        self.weightKg = weightKg
    }
}

public enum AdjustOptionsBuilder {
    /// UI 无会话态的防御 fallback（非处方链路）：有会话时调用方必须传
    /// 当前动作计划步长（ExerciseSetPlan.stepKg，随目录透传，§6.1）。
    public static let stepKg = 2.5

    /// 轻一档/重一档取「器械×单位」真实梯子相邻格（2026-06-15 单位原生）：磅哑铃轻段落 2.5lb
    /// 梯子（20→22.5→25）、中段 5lb；公斤等距 2.5kg = 与旧 followKg±step 逐字段一致（零回归）。
    /// equipment 传 LoadGrid.gridEquipment 映射后的格子器械（bodyweight-plus→barbell）。
    public static func options(
        followKg: Double,
        lastActualKg: Double?,
        plannedKg: Double,
        equipment: String = "dumbbell",
        unit: LoadUnit = .kg
    ) -> [AdjustOption] {
        var candidates: [(option: AdjustOption, priority: Int)] = [
            (AdjustOption(role: .follow, weightKg: followKg), 1),
            (AdjustOption(role: .lighter, weightKg: LoadGrid.nextRungKg(followKg, equipment: equipment, unit: unit, up: false)), 4),
            (AdjustOption(role: .heavier, weightKg: LoadGrid.nextRungKg(followKg, equipment: equipment, unit: unit, up: true)), 4),
        ]
        if let last = lastActualKg {
            candidates.append((AdjustOption(role: .last, weightKg: last), 2))
        }
        candidates.append((AdjustOption(role: .plan, weightKg: plannedKg), 3))

        var byWeight: [Double: (option: AdjustOption, priority: Int)] = [:]
        for candidate in candidates where candidate.option.weightKg > 0 {
            if let existing = byWeight[candidate.option.weightKg],
               existing.priority <= candidate.priority { continue }
            byWeight[candidate.option.weightKg] = candidate
        }
        return byWeight.values
            .sorted { $0.option.weightKg < $1.option.weightKg }
            .map(\.option)
    }
}

public enum AdjustPreview {
    /// 「打勾后下一组会怎样」：对假设观察值直接求值真实引擎。
    /// 最后一组返回 nil（动作完成），渲染层据此显示完成态。
    public static func project(
        plan: ExerciseSetPlan,
        completed: [CompletedSetObservation],
        staged: CompletedSetObservation
    ) -> NextSetRecommendation? {
        NextSetEngine.recommend(plan: plan, completed: completed + [staged])
    }
}
