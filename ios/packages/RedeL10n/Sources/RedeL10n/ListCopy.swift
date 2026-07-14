// ListCopy — 视觉重做三屏（今日 / 进展 / 训练，2026-06-15）的清单/行文案。
//
// 这些串在重做时为快速迭代曾直写视图层（中文）；设计定型后抽到这里补双语，
// 与「引擎零文案、文案归 L10n」口径对齐。动作名/数字已是 localized，这里补的是
// 标签词（组 / 休 / RIR / 上次 / 估算 1RM / 进阶…）。中英各按本语言习惯，不互译。

import Foundation

extension RedeStrings {
    private func t3(_ zh: String, _ en: String) -> String { locale == .zh ? zh : en }

    /// 判断行动作数后缀（带分隔）。
    public func verdictExerciseCount(_ count: Int) -> String {
        t3("　\(count) 个动作", " · \(count) exercises")
    }

    /// 今日清单行·副信息：组数 · 组间休息 · RIR。
    public func exerciseMetaLine(sets: Int, restSeconds: Int, rir: Double) -> String {
        t3("\(sets) 组 · 休 \(restSeconds)s · RIR \(formatRir(rir))",
           "\(sets) sets · rest \(restSeconds)s · RIR \(formatRir(rir))")
    }

    /// 今日清单行·目标摘要（按 loadType；自重/弹力带仅次数）。
    public func targetLine(loadType: String, weightKg: Double, reps: Int) -> String {
        let w = formatKg(weightKg)
        switch loadType {
        case "bodyweight", "band": return "× \(reps)"
        case "assisted": return t3("辅助 \(w) × \(reps)", "assist \(w) × \(reps)")
        case "bodyweight-plus": return t3("负重 +\(w) × \(reps)", "+\(w) × \(reps)")
        default: return "\(w) \(unitLabel) × \(reps)"
        }
    }

    /// 「上次」参照（今日清单 + 训练卡片共用）；首练/缺上次 → nil。
    public func lastRefLine(loadType: String, prevWeightKg: Double?, prevReps: Int?) -> String? {
        if loadType == "bodyweight" || loadType == "band" {
            return prevReps.map { t3("上次 ×\($0)", "last ×\($0)") }
        }
        guard let kg = prevWeightKg, let r = prevReps else { return nil }
        let w = formatKg(kg)
        switch loadType {
        case "assisted": return t3("上次 辅助 \(w)×\(r)", "last assist \(w)×\(r)")
        case "bodyweight-plus": return t3("上次 负重 +\(w)×\(r)", "last +\(w)×\(r)")
        default: return t3("上次 \(w)×\(r)", "last \(w)×\(r)")
        }
    }

    /// 今日页底部合计行。
    public func dailySummaryLine(totalSets: Int, exerciseCount: Int) -> String {
        t3("合计 \(totalSets) 组 · \(exerciseCount) 个动作",
           "\(totalSets) sets · \(exerciseCount) exercises")
    }

    /// 短标签：保持 / 首练 / 估算 1RM。
    public var holdShort: String { t3("保持", "hold") }
    public var firstTimeShort: String { t3("首练", "first") }

    /// 训练卡片升降标签（含箭头）；首练 / 未知 → nil（不显示）。
    public func trainChangeTag(_ change: String) -> String? {
        switch change {
        case "increase": return t3("↑ 进阶", "↑ up")
        case "ease": return t3("↓ 回调", "↓ back")
        case "hold": return t3("保持", "hold")
        default: return nil
        }
    }
}
