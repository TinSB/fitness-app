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

    /// 体量显示（周/单次总吨位，Task 2b 2026-07-04）：千分位分组（36,210；千以下
    /// 无分隔）。**整数口径**（进度页审计 2026-07-13，推翻 Task 2b 的小数保留）：
    /// 吨位是聚合值，五位数带 .5/.75 是数字噪音不是精度——显示层四舍五入取整。
    /// 仅体量用——处方重量仍走 formatKg（多处消费，防布局回归）。
    public func formatVolumeKg(_ value: Double) -> String {
        let display = (unit == .lb ? value * 2.204_622_621_8 : value).rounded()
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true  // POSIX locale 默认关分组，须显式开
        formatter.groupingSeparator = ","
        formatter.groupingSize = 3
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: display)) ?? formatKg(value)
    }

    // MARK: - 空态（FR-ON4）

    public var progressEmptyTitle: String {
        locale == .zh ? "还没有训练记录" : "No sessions yet"
    }
    public var progressEmptySub: String {
        locale == .zh
            ? "完成第一场训练　数据从这里累积"
            : "Finish your first session. Data builds from here."
    }

    /// M2 空态示意柱下的说明（caption 级）：消除「加载失败/骨架屏」误读——示意柱是预告非数据。
    public var progressEmptyPreviewHint: String {
        locale == .zh ? "数据会长这样" : "Your data will look like this"
    }

    // MARK: - Session 尺度（最近一场）

    public func sessionVerdictPR(_ liftName: String) -> String {
        locale == .zh ? "本场新纪录　\(liftName)" : "New \(liftName) PR"
    }
    public var sessionVerdictDone: String {
        locale == .zh ? "这场练完，记录在案" : "Session logged"
    }
    /// "顶组 卧推 62.5 kg × 6 · 估算 1RM 75 kg"
    public func sessionSubTopSet(lift: String, kg: String, reps: Int, e1rmKg: String) -> String {
        locale == .zh
            ? "顶组 \(lift) \(kg) \(unitLabel) × \(reps) · 估算 1RM \(e1rmKg) \(unitLabel)"
            : "Top set \(lift) \(kg) \(unitLabel) × \(reps) · est 1RM \(e1rmKg) \(unitLabel)"
    }
    // 图例行退役（进度页审计 2026-07-13）：「橙色标出本周/新纪录」解释显而易见的
    // 事——柱标签已橙、PR 已浮标；单序列图不配图例（Apple 口径 + owner 反小字红线）。
    // sessionCaptionPR/NoPR、weekCaptionCurrent、cycleCaptionPeak 四串随渲染一并删除。

    // MARK: - Week 尺度（周训练量，FR-PR3）

    /// code: up / down / level / first / gap（gap = 有历史但上周缺席，≠ 第一周）
    /// / inProgress（本周未收口，只报事实不下结论——2026-07-03 审查 MAJOR #3）。
    public func weekVerdict(_ code: String) -> String {
        switch code {
        case "up": return locale == .zh ? "本周量上行" : "Volume is up this week"
        case "down": return locale == .zh ? "本周收着练" : "A lighter week"
        case "level": return locale == .zh ? "本周持平" : "Holding level this week"
        case "gap": return locale == .zh ? "本周回到训练" : "Back to lifting this week"
        case "inProgress": return locale == .zh ? "本周进行中" : "Week in progress"
        default: return locale == .zh ? "第一周开账" : "Week one on the books"
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
            ? "本周 \(sets) 组 · \(volumeKg) \(unitLabel)　多周后显现对比"
            : "\(sets) sets · \(volumeKg) \(unitLabel) this week. Comparison appears as weeks add up"
    }
    public func weekSubGapWeek(sets: Int, volumeKg: String) -> String {
        locale == .zh
            ? "本周 \(sets) 组 · \(volumeKg) \(unitLabel)　上周没练，暂无对比"
            : "\(sets) sets · \(volumeKg) \(unitLabel) this week. No sessions last week to compare"
    }
    /// 进行中的周只报「本周至今」事实（无 ±N%、无较上周结论）——周收口后由
    /// weekSubCompared 接管。
    public func weekSubInProgress(sets: Int, volumeKg: String) -> String {
        locale == .zh
            ? "本周至今 \(sets) 组 · \(volumeKg) \(unitLabel)　周结束后显现对比"
            : "\(sets) sets · \(volumeKg) \(unitLabel) so far this week. Comparison appears when the week ends"
    }
    public var weekChartTitleByWeek: String {
        locale == .zh ? "周训练量" : "Weekly volume"
    }
    /// 周柱标签 "6/8"（周一日期）。
    public func weekBarLabel(fromISO iso: String) -> String { shortDate(fromISO: iso) }

    // MARK: - Cycle 尺度（e1RM 趋势，FR-PR2 判断先行）

    public func trendVerdict(call: String, liftName: String) -> String {
        switch call {
        case "up": return locale == .zh ? "\(liftName)仍在上升" : "\(liftName) is still trending up"
        case "down": return locale == .zh ? "\(liftName)最近在回落" : "\(liftName) is trending down lately"
        case "flat": return locale == .zh ? "\(liftName)稳住了" : "\(liftName) is holding steady"
        default: return locale == .zh ? "正在校准" : "Calibrating"
        }
    }
    /// §5.3 标准句式："过去 4 次训练里，估算 1RM 提高 5 kg。"
    public func trendSub(call: String, sessions: Int, deltaKg: String) -> String {
        switch call {
        case "up":
            return locale == .zh
                ? "过去 \(sessions) 次训练里，估算 1RM 提高 \(deltaKg) \(unitLabel)"
                : "Estimated 1RM is up \(deltaKg) \(unitLabel) over the last \(sessions) sessions"
        case "down":
            return locale == .zh
                ? "过去 \(sessions) 次训练里，估算 1RM 回落 \(deltaKg) \(unitLabel)"
                : "Estimated 1RM is down \(deltaKg) \(unitLabel) over the last \(sessions) sessions"
        case "flat":
            return locale == .zh
                ? "过去 \(sessions) 次训练里，估算 1RM 基本持平"
                : "Estimated 1RM is about level over the last \(sessions) sessions"
        default:
            return locale == .zh
                ? "再练几场　趋势显现"
                : "A few more sessions and the trend emerges"
        }
    }
    public func cycleChartTitleFor(_ liftName: String) -> String {
        locale == .zh ? "e1RM 趋势 · \(liftName)" : "e1RM trend · \(liftName)"
    }
    /// 周期趋势清单标题（进度页审计 2026-07-13）：「估算 1RM」列口径声明一次，
    /// 替代每行重复的副标（T2 排期折叠同款「一次性化」手法）。
    public var cycleTrendTitle: String {
        locale == .zh ? "主项趋势 · 估算 1RM" : "Top lifts · estimated 1RM"
    }

    // MARK: - 历史（FR-PR1）

    public var historyTitle: String { locale == .zh ? "历史" : "History" }
    /// "18 组 · 5,500 kg"
    public func historyRowMeta(sets: Int, volumeKg: String) -> String {
        locale == .zh ? "\(sets) 组 · \(volumeKg) \(unitLabel)" : "\(sets) sets · \(volumeKg) \(unitLabel)"
    }
    public var historyPRBadge: String { "PR" }
    /// 图表柱 VoiceOver 读数："标签，明细[，PR]" / "label: detail[, PR]"。
    public func a11yChartBar(_ label: String, _ detail: String, pr: Bool = false) -> String {
        let base = locale == .zh ? "\(label)，\(detail)" : "\(label): \(detail)"
        guard pr else { return base }
        return locale == .zh ? "\(base)，\(historyPRBadge)" : "\(base), \(historyPRBadge)"
    }
    public var historyDetailSets: String { locale == .zh ? "逐组明细" : "Set by set" }
    /// 明细行 "60 kg × 6"
    public func historySetLine(kg: String, reps: Int) -> String { "\(kg) \(unitLabel) × \(reps)" }

    // MARK: - 连续性月历（FR-PR5，中性呈现：不算 streak、不羞辱断签）

    public var continuityTitle: String { locale == .zh ? "训练连续性" : "Consistency" }

    /// 月历标题 "2026年6月" / "June 2026"（本地化月名）。
    public func calendarMonthLabel(year: Int, month: Int) -> String {
        var components = DateComponents()
        components.year = year; components.month = month; components.day = 1
        components.timeZone = TimeZone(identifier: "UTC")
        let calendar = Calendar(identifier: .gregorian)
        guard let date = calendar.date(from: components) else { return "\(year)-\(month)" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: locale == .zh ? "zh_CN" : "en_US")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.setLocalizedDateFormatFromTemplate(locale == .zh ? "yyyyMMMM" : "MMMM yyyy")
        return formatter.string(from: date)
    }

    /// 周一起始的星期首字母表头。
    public var weekdayInitialsMonFirst: [String] {
        locale == .zh ? ["一", "二", "三", "四", "五", "六", "日"] : ["M", "T", "W", "T", "F", "S", "S"]
    }

    /// 中性计数（不羞辱断签）："本月 5 次训练" / "5 sessions this month"。
    public func continuityCount(_ count: Int) -> String {
        if locale == .zh { return "本月 \(count) 次训练" }
        return count == 1 ? "1 session this month" : "\(count) sessions this month"
    }

    /// 单格 VoiceOver："6月9日，已训练" / "Jun 9, trained"；未训练只读日期。
    public func continuityDayA11y(dateISO: String, trained: Bool) -> String {
        let date = shortDate(fromISO: dateISO)
        guard trained else { return date }
        return locale == .zh ? "\(date)，已训练" : "\(date), trained"
    }

    // MARK: - 力量里程碑（FR-PR7，实测达成；杠铃配片阈值，待校准起步值）

    public var milestonesTitle: String { locale == .zh ? "力量里程碑" : "Milestones" }
    /// 估算里程碑微标（FR-PR7：明确标注估算，绝不冒充实测）。
    public var milestoneEstimatedBadge: String { locale == .zh ? "估算" : "est" }
    /// 里程碑行 VoiceOver："卧推 100 kg 已达成" / "Bench press, 100 kg reached"；估算则点明。
    public func milestoneA11y(lift: String, value: String, estimated: Bool = false) -> String {
        if estimated {
            return locale == .zh ? "\(lift) 估算 \(value) 已达成" : "\(lift), estimated \(value) reached"
        }
        return locale == .zh ? "\(lift) \(value) 已达成" : "\(lift), \(value) reached"
    }
    /// 实测+估算合并行 VoiceOver（owner 拍板合并行 2026-07-14）。
    public func milestoneCombinedA11y(lift: String, measured: String, estimated: String) -> String {
        locale == .zh
            ? "\(lift) \(measured) 已达成，估算 \(estimated)"
            : "\(lift), \(measured) reached, estimated \(estimated)"
    }

    // MARK: - 数据质量（FR-PR4，行为化、零置信标签）

    public var dataQualityTitle: String { locale == .zh ? "数据" : "Data" }
    /// "6/3 卧推第 1 组 227 kg　可能记错了"
    public func suspectWeightLine(dateISO: String, lift: String, setIndex: Int, kg: String) -> String {
        let date = shortDate(fromISO: dateISO)
        return locale == .zh
            ? "\(date) \(lift)第 \(setIndex) 组 \(kg) \(unitLabel)　可能记错了"
            : "\(date) \(lift) set \(setIndex) at \(kg) \(unitLabel), probably a typo"
    }
    public func suspectRepsLine(dateISO: String, lift: String, setIndex: Int, reps: Int) -> String {
        let date = shortDate(fromISO: dateISO)
        return locale == .zh
            ? "\(date) \(lift)第 \(setIndex) 组 \(reps) 次　可能记错了"
            : "\(date) \(lift) set \(setIndex) at \(reps) reps, probably a typo"
    }
    /// "2 条记录有问题，没有计入统计"
    public func droppedRecordsLine(_ count: Int) -> String {
        locale == .zh
            ? "\(count) 条记录有问题，没有计入统计"
            : count == 1 ? "1 record couldn't be counted" : "\(count) records couldn't be counted"
    }

    /// 可疑组超出前若干条时的溢出提示（与今日「修数据」卡的总数对账，避免卡说 N 条这里只见 3 条）。
    public func suspectMoreLine(_ more: Int) -> String {
        locale == .zh ? "还有 \(more) 条待核对" : "\(more) more to review"
    }
}
