// PlanAdjustmentEngine — FR-PL3/4 计划调整提案（纯策略，路线 B：非 MLE 提案先行）。
//
// 纯函数大脑：吃现成依从信号产 typed 调整提案；预览/采纳/回滚由上层（PlanWeekProjection 预览 +
// 唯一写闸采纳/反向回滚，复刻 FR-T5 范式）。零文案——文案归 RedeL10n（§5.4/§7.3 中性，禁羞辱）。
//
// 频率/依从一类双向对称：最近 4 个完整 ISO 周的训练天数中位数持续低于计划 → 降到可持续频率；
// 持续高于计划 → 把账本调到实际频率。FR-PL5 已按独立自动式落地，不进入本提案引擎。

import Foundation

/// 单条计划调整提案（typed，零文案）。preview「改什么/影响哪几天」由上层用 PlanWeekProjection 现算 before/after。
public struct PlanAdjustmentProposal: Equatable, Sendable {
    public enum Kind: String, Equatable, Hashable, Sendable {
        case reduceFrequency   // 周计划高于实际依从 → 降到可持续频率
        case increaseFrequency // 实际训练天数高于周计划 → 让计划账本匹配真实行为
    }
    public let kind: Kind
    public let reasonCode: String       // 如 "belowPlanSustained"
    public let observedDaysPerWeek: Int // 最近 4 个完整 ISO 周训练天数的整数中位数（未钳制）
    public let fromDaysPerWeek: Int
    public let toDaysPerWeek: Int
    public init(
        kind: Kind,
        reasonCode: String,
        observedDaysPerWeek: Int,
        fromDaysPerWeek: Int,
        toDaysPerWeek: Int
    ) {
        self.kind = kind
        self.reasonCode = reasonCode
        self.observedDaysPerWeek = observedDaysPerWeek
        self.fromDaysPerWeek = fromDaysPerWeek
        self.toDaysPerWeek = toDaysPerWeek
    }
}

public enum PlanAdjustmentEngine {
    static let signalWindowWeeks = 4
    static let adjustmentMargin = 1
    static let minDaysPerWeek = 2
    static let maxDaysPerWeek = 6

    /// 频率/依从调整提案。入参是按旧→新排列的完整 ISO 周训练天数；只取最近 4 周。
    /// 双向守卫明确互斥：中位数 ≤ 计划−1 才降，中位数 ≥ 计划+1 才升；目标钳在 2...6。
    public static func frequencyProposal(
        plannedDaysPerWeek: Int,
        recentWeeklySessionCounts: [Int]
    ) -> PlanAdjustmentProposal? {
        guard recentWeeklySessionCounts.count >= signalWindowWeeks else { return nil }
        let typical = median(Array(recentWeeklySessionCounts.suffix(signalWindowWeeks)))
        let shouldReduce = typical <= plannedDaysPerWeek - adjustmentMargin
        let shouldIncrease = typical >= plannedDaysPerWeek + adjustmentMargin

        // 数学上不应同时成立；显式守卫防未来阈值调整时双向同发。
        guard shouldReduce != shouldIncrease else { return nil }

        if shouldReduce {
            let proposed = max(minDaysPerWeek, min(maxDaysPerWeek, typical))
            guard proposed < plannedDaysPerWeek else { return nil }
            return PlanAdjustmentProposal(
                kind: .reduceFrequency,
                reasonCode: "belowPlanSustained",
                observedDaysPerWeek: typical,
                fromDaysPerWeek: plannedDaysPerWeek,
                toDaysPerWeek: proposed
            )
        }

        let proposed = max(minDaysPerWeek, min(maxDaysPerWeek, typical))
        guard proposed > plannedDaysPerWeek else { return nil }
        return PlanAdjustmentProposal(
            kind: .increaseFrequency,
            reasonCode: "abovePlanSustained",
            observedDaysPerWeek: typical,
            fromDaysPerWeek: plannedDaysPerWeek,
            toDaysPerWeek: proposed
        )
    }

    /// 整数中位数（偶数取中间两数向下取整，保持既有确定性口径）。
    static func median(_ values: [Int]) -> Int {
        let sorted = values.sorted()
        guard !sorted.isEmpty else { return 0 }
        let mid = sorted.count / 2
        return sorted.count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
}
