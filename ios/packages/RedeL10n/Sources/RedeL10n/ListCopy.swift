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

    /// 目标摘要的**分段**版本（2026-08-06 排版基准 S1）。
    ///
    /// `targetLine` 返回一整串，整串同字号会退化成一个「标签」；视图层要把数值/单位/次数
    /// 排成不同字号才有数据重心。分段必须在这里做——**视图层拆字符串是脆弱的**
    /// （5 种 loadType 有「辅助」「负重 +」等前缀，`split(" ")` 一碰就碎）。
    ///
    /// 契约：各段拼接后与 `targetLine` 逐字一致（同 loadType/同入参），故无障碍与
    /// 既有断言仍可继续用 `targetLine`。
    public func targetParts(loadType: String, weightKg: Double, reps: Int) -> TargetParts {
        let w = formatKg(weightKg)
        switch loadType {
        case "bodyweight", "band":
            return TargetParts(prefix: nil, value: nil, unit: nil, reps: "× \(reps)")
        case "assisted":
            return TargetParts(prefix: t3("辅助", "assist"), value: w, unit: nil, reps: "× \(reps)")
        case "bodyweight-plus":
            return TargetParts(prefix: t3("负重", nil), value: "+\(w)", unit: nil, reps: "× \(reps)")
        default:
            return TargetParts(prefix: nil, value: w, unit: unitLabel, reps: "× \(reps)")
        }
    }

    /// zh 有前缀、en 无前缀时用（`负重 +10 × 6` / `+10 × 6`）。
    private func t3(_ zh: String, _ en: String?) -> String? {
        locale == .zh ? zh : en
    }
}

/// 目标摘要的分段。视图层按段给不同字号：数值大、单位小、前缀与次数中等。
public struct TargetParts: Equatable, Sendable {
    public let prefix: String?   // "辅助" / "负重"（en 侧多为 nil）
    public let value: String?    // "37.5" / "+10"；自重/弹力带为 nil
    public let unit: String?     // "kg" / "lb"；辅助与负重不带单位（沿用 targetLine 口径）
    public let reps: String      // "× 6"

    public init(prefix: String?, value: String?, unit: String?, reps: String) {
        self.prefix = prefix
        self.value = value
        self.unit = unit
        self.reps = reps
    }
}

extension RedeStrings {

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
