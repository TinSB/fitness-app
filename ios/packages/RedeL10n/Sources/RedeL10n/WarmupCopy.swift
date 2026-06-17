// WarmupCopy — FR-TR10 热身组文案（双语）。
//
// 热身是流内临时引导（不落库）；引擎零文案，这里把 WarmupStep 的 kind/次数渲染成展示串。
// 红线：中性、不羞辱；空杆/动作模式预热不冒充工作组。重量经 formatKg/unitLabel 走现役单位口径。

import Foundation

extension RedeStrings {
    /// 热身进度小标：「热身 N/M」。
    public func warmupProgress(index: Int, total: Int) -> String {
        t2w("热身 \(index)/\(total)", "Warm-up \(index)/\(total)")
    }

    /// 空杆预热主标（杠铃/史密斯）。
    public var warmupEmptyBar: String { t2w("空杆", "Empty bar") }

    /// 无重量轴动作模式预热主标（自重/弹力带）。
    public var warmupMovementPrep: String { t2w("动作模式预热", "Movement prep") }

    /// 次数后缀「×N」（与组表/hero 同口径）。
    public func warmupReps(_ reps: Int) -> String { "×\(reps)" }

    /// 热身重量主行：「{重量}{单位}」（百分比阶梯档）。
    public func warmupWeight(_ kg: Double) -> String { "\(formatKg(kg)) \(unitLabel)" }

    /// 「完成热身组」主操作。
    public var warmupDone: String { t2w("完成热身组", "Warm-up done") }

    /// 「跳过热身」次操作（中性，不催促）。
    public var warmupSkip: String { t2w("跳过热身", "Skip warm-up") }

    private func t2w(_ zh: String, _ en: String) -> String { locale == .zh ? zh : en }
}
