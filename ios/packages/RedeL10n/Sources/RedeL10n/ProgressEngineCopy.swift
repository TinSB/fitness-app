// ProgressEngineCopy — M4-3 进展页文案：typed insight → 双语判断先行句。
//
// 禁词红线同款（无 AI/算法/系统认为/最佳，且**永不出现「置信度/confidence」**
// ——§3.4 可信度只走行为表达，有回归测试）；§5.3 Progress 声音：不是庆功墙，
// 判断句先行、证据句跟上；禁无证据鼓励（"你正在变得更好"类句式不存在）。
// 数据质量提示行为化（「可能记错了」），不出现百分比置信标签。

import Foundation

extension RedeStrings {
    /// e1RM 展示口径：取整到 0.5 kg（legacy roundToHalfKg 同口径）再走 formatKg。
    /// Epley 原始浮点（如 69.666…）绝不直出 UI。
    /// lb 模式双重量化（0.5kg → 0.5lb）为有意取舍（审查留痕 2026-06-10）：
    /// 1RM 是估算值，接受 ≤±0.8 lb 显示偏差，换取换算逻辑单点不分叉。
    public func formatE1Rm(_ value: Double) -> String {
        formatKg((value * 2).rounded() / 2)
    }

    // MARK: - 空态（FR-ON4）

    public var progressEmptyTitle: String {
        locale == .zh ? "还没有训练记录。" : "No sessions yet."
    }
    public var progressEmptySub: String {
        locale == .zh
            ? "完成第一场训练，进展会从这里开始积累。"
            : "Finish your first session and your progress starts here."
    }

    // MARK: - Session 尺度（最近一场）

    public func sessionVerdictPR(_ liftName: String) -> String {
        locale == .zh ? "扎实的一场。\(liftName)新纪录。" : "Solid session. New \(liftName) PR."
    }
    public var sessionVerdictDone: String {
        locale == .zh ? "这场练完，记录在案。" : "Session logged."
    }
    /// "顶组 卧推 62.5 kg × 6 · 估算 1RM 75 kg"
    public func sessionSubTopSet(lift: String, kg: String, reps: Int, e1rmKg: String) -> String {
        locale == .zh
            ? "顶组 \(lift) \(kg) \(unitLabel) × \(reps) · 估算 1RM \(e1rmKg) \(unitLabel)"
            : "Top set \(lift) \(kg) \(unitLabel) × \(reps) · est 1RM \(e1rmKg) \(unitLabel)"
    }
    public func sessionCaptionPR(_ liftName: String) -> String {
        locale == .zh
            ? "动的是\(liftName)——唯一的铁火线标出新纪录。"
            : "\(liftName) is the lift that moved — single ember marks the PR."
    }
    public var sessionCaptionNoPR: String {
        locale == .zh ? "这场每个动作的量都记下了。" : "Every lift this session, logged."
    }

    // MARK: - Week 尺度（周训练量，FR-PR3）

    /// code: up / down / level / first / gap（gap = 有历史但上周缺席，≠ 第一周）。
    public func weekVerdict(_ code: String) -> String {
        switch code {
        case "up": return locale == .zh ? "本周量上来了。" : "Volume is up this week."
        case "down": return locale == .zh ? "本周收着练。" : "A lighter week."
        case "level": return locale == .zh ? "本周持平。" : "Holding level this week."
        case "gap": return locale == .zh ? "这周练回来了。" : "Back at it this week."
        default: return locale == .zh ? "第一周开账。" : "Week one on the books."
        }
    }
    /// "训练量较上周 +12% · 18 组 · 5,500 kg"
    public func weekSubCompared(deltaPercent: Int, sets: Int, volumeKg: String) -> String {
        let sign = deltaPercent >= 0 ? "+" : "−"
        let magnitude = abs(deltaPercent)
        return locale == .zh
            ? "训练量较上周 \(sign)\(magnitude)% · \(sets) 组 · \(volumeKg) \(unitLabel)"
            : "Volume \(sign)\(magnitude)% vs last week · \(sets) sets · \(volumeKg) \(unitLabel)"
    }
    public func weekSubFirstWeek(sets: Int, volumeKg: String) -> String {
        locale == .zh
            ? "本周 \(sets) 组 · \(volumeKg) \(unitLabel)——连续训练后这里会出现对比。"
            : "\(sets) sets · \(volumeKg) \(unitLabel) this week — comparisons appear as weeks stack up."
    }
    public func weekSubGapWeek(sets: Int, volumeKg: String) -> String {
        locale == .zh
            ? "本周 \(sets) 组 · \(volumeKg) \(unitLabel)——上周没有训练，暂无对比。"
            : "\(sets) sets · \(volumeKg) \(unitLabel) this week — no sessions last week to compare."
    }
    public var weekChartTitleByWeek: String {
        locale == .zh ? "周训练量" : "Weekly volume"
    }
    public var weekCaptionCurrent: String {
        locale == .zh ? "唯一的铁火线标出本周。" : "Single ember marks this week."
    }
    /// 周柱标签 "6/8"（周一日期）。
    public func weekBarLabel(fromISO iso: String) -> String { shortDate(fromISO: iso) }

    // MARK: - Cycle 尺度（e1RM 趋势，FR-PR2 判断先行）

    public func trendVerdict(call: String, liftName: String) -> String {
        switch call {
        case "up": return locale == .zh ? "\(liftName)仍在上升。" : "\(liftName) is still trending up."
        case "down": return locale == .zh ? "\(liftName)最近在回落。" : "\(liftName) eased off lately."
        case "flat": return locale == .zh ? "\(liftName)稳住了。" : "\(liftName) is holding steady."
        default: return locale == .zh ? "正在校准。" : "Calibrating."
        }
    }
    /// §5.3 标准句式："过去 4 次训练里，估算 1RM 提高 5 kg。"
    public func trendSub(call: String, sessions: Int, deltaKg: String) -> String {
        switch call {
        case "up":
            return locale == .zh
                ? "过去 \(sessions) 次训练里，估算 1RM 提高 \(deltaKg) \(unitLabel)。"
                : "Estimated 1RM is up \(deltaKg) \(unitLabel) over the last \(sessions) sessions."
        case "down":
            return locale == .zh
                ? "过去 \(sessions) 次训练里，估算 1RM 回落 \(deltaKg) \(unitLabel)。"
                : "Estimated 1RM is down \(deltaKg) \(unitLabel) over the last \(sessions) sessions."
        case "flat":
            return locale == .zh
                ? "过去 \(sessions) 次训练里，估算 1RM 基本持平。"
                : "Estimated 1RM is about level over the last \(sessions) sessions."
        default:
            return locale == .zh
                ? "再完成几场训练，趋势就会出现。"
                : "A few more sessions and the trend shows up."
        }
    }
    public func cycleChartTitleFor(_ liftName: String) -> String {
        locale == .zh ? "e1RM 趋势 · \(liftName)" : "e1RM trend · \(liftName)"
    }
    public var cycleCaptionPeak: String {
        locale == .zh ? "唯一的铁火线标出最高点。" : "Single ember marks the peak."
    }

    // MARK: - 历史（FR-PR1）

    public var historyTitle: String { locale == .zh ? "历史" : "History" }
    /// "18 组 · 5,500 kg"
    public func historyRowMeta(sets: Int, volumeKg: String) -> String {
        locale == .zh ? "\(sets) 组 · \(volumeKg) \(unitLabel)" : "\(sets) sets · \(volumeKg) \(unitLabel)"
    }
    public var historyPRBadge: String { "PR" }
    public var historyDetailSets: String { locale == .zh ? "逐组明细" : "Set by set" }
    /// 明细行 "60 kg × 6"
    public func historySetLine(kg: String, reps: Int) -> String { "\(kg) \(unitLabel) × \(reps)" }

    // MARK: - 数据质量（FR-PR4，行为化、零置信标签）

    public var dataQualityTitle: String { locale == .zh ? "数据" : "Data" }
    /// "6/3 卧推第 1 组 227 kg——可能记错了"
    public func suspectWeightLine(dateISO: String, lift: String, setIndex: Int, kg: String) -> String {
        let date = shortDate(fromISO: dateISO)
        return locale == .zh
            ? "\(date) \(lift)第 \(setIndex) 组 \(kg) \(unitLabel)——可能记错了"
            : "\(date) \(lift) set \(setIndex) at \(kg) \(unitLabel) — probably a typo"
    }
    public func suspectRepsLine(dateISO: String, lift: String, setIndex: Int, reps: Int) -> String {
        let date = shortDate(fromISO: dateISO)
        return locale == .zh
            ? "\(date) \(lift)第 \(setIndex) 组 \(reps) 次——可能记错了"
            : "\(date) \(lift) set \(setIndex) at \(reps) reps — probably a typo"
    }
    /// "2 条记录有问题，没有计入统计"
    public func droppedRecordsLine(_ count: Int) -> String {
        locale == .zh
            ? "\(count) 条记录有问题，没有计入统计"
            : count == 1 ? "1 record couldn't be counted" : "\(count) records couldn't be counted"
    }
}
