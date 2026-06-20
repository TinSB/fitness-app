// PlanAdjustmentEngine — FR-PL3/4 计划调整提案（纯策略，路线 B：非 MLE 提案先行）。
//
// 纯函数大脑：吃现成依从信号产 typed 调整提案；预览/采纳/回滚由上层（PlanWeekProjection 预览 +
// 唯一写闸采纳/反向回滚，复刻 FR-T5 范式）。零文案——文案归 RedeL10n（§5.4/§7.3 中性，禁羞辱）。
//
// MVP 范围（保守起步值，待 owner 真机校准）：仅「频率/依从」一类——**持续落后于周计划 → 建议降到
// 可持续频率**（友善、减摩擦，不羞辱）。升频（持续超额）+ 肌群级均衡（FR-PL5，依赖未落地 MLE）后置，
// 落地后接进**同一**提案/预览/采纳/回滚框架（PlanAdjustmentEngine 增源、零返工）。

import Foundation

/// 单条计划调整提案（typed，零文案）。preview「改什么/影响哪几天」由上层用 PlanWeekProjection 现算 before/after。
public struct PlanAdjustmentProposal: Equatable, Sendable {
    public enum Kind: String, Equatable, Sendable {
        case reduceFrequency   // 周计划高于实际依从 → 降到可持续频率
        // increaseFrequency（持续超额）/ rebalanceMuscle（FR-PL5·MLE）后置
    }
    public let kind: Kind
    public let reasonCode: String       // 如 "belowPlanSustained"
    public let fromDaysPerWeek: Int
    public let toDaysPerWeek: Int
    public init(kind: Kind, reasonCode: String, fromDaysPerWeek: Int, toDaysPerWeek: Int) {
        self.kind = kind
        self.reasonCode = reasonCode
        self.fromDaysPerWeek = fromDaysPerWeek
        self.toDaysPerWeek = toDaysPerWeek
    }
}

public enum PlanAdjustmentEngine {
    // 保守起步常量（owner 拍板「保守」，待真机校准）：
    static let minWeeksOfData = 4   // 至少 4 周历史才提（够稳、不被单周噪声带偏）
    static let underMargin = 1      // 近况中位数 ≤ 计划 − 1 才算「持续落后」
    static let minDaysPerWeek = 2   // 不建议低于每周 2 次（最低有效频率）

    /// 频率/依从调整提案。`recentWeeklySessionCounts` = 最近若干周每周完成场次（app 从 clean 历史摊平注入）。
    /// 返回 nil = 不提：① 已在下限附近（planned ≤ minDaysPerWeek）；② 数据不足（< minWeeksOfData 周）；
    /// ③ 未持续落后（中位数 > planned − margin）；④ 算出的目标降不动（≥ planned）。
    public static func frequencyProposal(
        plannedDaysPerWeek: Int,
        recentWeeklySessionCounts: [Int]
    ) -> PlanAdjustmentProposal? {
        guard plannedDaysPerWeek > minDaysPerWeek else { return nil }
        guard recentWeeklySessionCounts.count >= minWeeksOfData else { return nil }
        let typical = median(recentWeeklySessionCounts)
        guard typical <= plannedDaysPerWeek - underMargin else { return nil }
        let proposed = max(minDaysPerWeek, typical)
        guard proposed < plannedDaysPerWeek else { return nil }
        return PlanAdjustmentProposal(
            kind: .reduceFrequency, reasonCode: "belowPlanSustained",
            fromDaysPerWeek: plannedDaysPerWeek, toDaysPerWeek: proposed
        )
    }

    /// 整数中位数（偶数取中间两数向下取整——保守偏低，与"降到可持续"方向一致）。
    static func median(_ values: [Int]) -> Int {
        let sorted = values.sorted()
        guard !sorted.isEmpty else { return 0 }
        let mid = sorted.count / 2
        return sorted.count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }
}
