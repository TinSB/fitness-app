// TodayEngineCopy — M2-3 引擎接线文案：typed code → 双语句子。
//
// 引擎零文案（系统逻辑 §6.0/§6.0.1）：裁决/处方只产 code 与数值，这里把它们
// 渲染成「信号 + 影响 + 决策」句（文案基线 §4.2）；禁词（算法名/「AI 判断」/
// 「系统认为」/「最佳」）不得出现。重量一律 kg 显示——FR-SE1 单位切换落地前
// 不硬编码 lb（拍板留痕：原型里的 lb 是静态展示稿口径）。

import Foundation

extension RedeStrings {
    // MARK: - 训练日名称
    // 动作名已迁入 ExerciseCatalog（内容系统 P0，2026-06-11）：
    // 「本地化展示名是动作事实」——单一真源 exercises.json，app 层经
    // LocaleStore.exerciseName 桥接；本包不再维护动作名字典。

    /// 训练日双语名（zh 复用 legacy TEMPLATE_NAME_MAP 词汇）。
    public func trainingDayName(_ code: String) -> String {
        if locale == .zh {
            return Formatters.templateNameMap[code] ?? code
        }
        let en: [String: String] = [
            "push-a": "Push A", "pull-a": "Pull A", "legs-a": "Legs A",
            "upper": "Upper", "lower": "Lower",
        ]
        return en[code] ?? code
    }

    // MARK: - 数值格式

    /// 重量显示（输入恒为 canonical kg，整数去尾零）。kg：原值；
    /// lb（M5-2 FR-SE1）：×2.2046226218 后取 0.5 lb 步进——显示精度，不做配片量化。
    public func formatKg(_ value: Double) -> String {
        let display = unit == .lb ? ((value * 2.204_622_621_8 * 2).rounded() / 2) : value
        return display == display.rounded() ? String(Int(display)) : String(display)
    }

    /// 当前重量单位标签（"kg"/"lb"）——所有带单位文案统一从这里取。
    public var unitLabel: String { unit.rawValue }

    /// Load Plate 后缀："kg · ×6 · RIR 2"。
    public func loadDetail(targetReps: Int, targetRir: Int) -> String {
        "\(unitLabel) · ×\(targetReps) · RIR \(targetRir)"
    }

    /// "接 {动作}" / "then {exercise}"。
    public func thenLine(_ name: String) -> String {
        locale == .zh ? "接 \(name)" : "then \(name)"
    }

    /// Rail 标题："{动作} · 从上次到下次"。
    public func railTitle(_ name: String) -> String {
        locale == .zh ? "\(name) · 从上次到下次" : "\(name) · last to next"
    }

    /// Rail 节点值："60×5"；缺数据给 "—"。
    public func railValue(weightKg: Double?, reps: Int?) -> String {
        guard let weightKg, let reps else { return "—" }
        return "\(formatKg(weightKg))×\(reps)"
    }

    /// 头部日期行（周几 · 月日）；周数随 mesocycle 促升后再加。
    public func dateLine(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: locale == .zh ? "zh_CN" : "en_US")
        formatter.setLocalizedDateFormatFromTemplate(locale == .zh ? "EEE MMMd" : "EEE MMM d")
        let text = formatter.string(from: date)
        return locale == .zh ? text.replacingOccurrences(of: " ", with: " · ") : text.replacingOccurrences(of: ", ", with: " · ")
    }

    /// Rail「上次」节点日期："2026-06-05" → "6月5日" / "Jun 5"。
    public func shortDate(fromISO iso: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "UTC")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: String(iso.prefix(10))) else { return iso }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: locale == .zh ? "zh_CN" : "en_US")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }

    // MARK: - 裁决文案（信号 + 影响 + 决策；不写算法名）

    // MARK: - 数据不可读态（诚实降级：绝不把损坏数据当新用户）

    public var dataUnreadableStatus: String { t2("数据暂不可读", "Data unavailable") }
    public var dataUnreadableHeadline: String {
        t2("数据暂时读不出来。你的记录仍在，不会被覆盖。",
           "Your data can't be read right now. Nothing has been lost or overwritten.")
    }
    public var dataUnreadableReceipt: String {
        t2("今天不开训练单——先保护已有数据。", "No prescription today — protecting your existing data first.")
    }

    /// rest 日 / 无处方时 Change 行的专属文案（语义对齐：无负重调整）。
    public var changeLineNone: String { t2("今天无负重调整", "No load changes today") }

    /// 状态 pill。
    public func verdictStatus(call: String) -> String {
        switch call {
        case "train": return t2("可以训练", "Ready to train")
        case "light": return t2("今天轻练", "Light day")
        case "rest": return t2("今天休息", "Rest day")
        case "deload": return t2("减载周", "Deload week")
        default: return call
        }
    }

    /// 判断句（hero headline）。
    public func verdictHeadline(call: String, reasonCode: String, dayName: String, gapDays: Int?, consecutiveDays: Int?) -> String {
        switch (call, reasonCode) {
        case ("train", "noHistoryCalibration"):
            return t2("今天可以练。首练定档，重量保守起步。", "Train today. First session sets your baseline — starting easy.")
        case ("train", _):
            return t2("今天可以练。\(dayName)，按计划推进。", "Train today. \(dayName) as planned.")
        case ("light", "longGapReentry"):
            let days = gapDays.map(String.init) ?? "—"
            return t2("今天轻练。停练 \(days) 天，先回归再加量。", "Go light today. \(days) days off — ease back in first.")
        case ("light", "weeklyPlanReached"):
            return t2("今天轻练。本周量已练够，留点余力。", "Go light today. Weekly volume is in — keep some in reserve.")
        case ("light", "lastSessionNearFailure"):
            return t2("今天轻练。上次练到力竭，给恢复留空间。", "Go light today. Last session hit failure — give recovery room.")
        case ("light", _):
            return t2("今天轻练。\(dayName)，降一档推进。", "Go light today. \(dayName), one notch down.")
        case ("rest", "alreadyTrainedToday"):
            return t2("今天已练完。休息，明天继续。", "Already trained today. Rest — back tomorrow.")
        case ("rest", "consecutiveDaysNeedRest"):
            let days = consecutiveDays.map(String.init) ?? "—"
            return t2("今天休息。已连练 \(days) 天，恢复优先。", "Rest today. \(days) days straight — recovery first.")
        case ("rest", _):
            return t2("今天休息。恢复也是训练的一部分。", "Rest today. Recovery is part of the plan.")
        case ("deload", _):
            return t2("本周减载。持续高量数周，主动降档。", "Deload this week. Weeks of sustained load — backing off on purpose.")
        default:
            return t2("今天可以练。", "Train today.")
        }
    }

    /// 收据结论句。
    public func receiptConclusion(call: String, reasonCode: String) -> String {
        switch (call, reasonCode) {
        case ("train", "noHistoryCalibration"):
            return t2("首练定档，全部动作保守起步。", "First session — every lift starts conservative.")
        case ("train", _):
            return t2("按计划推进，按上次表现微调。", "On plan — tuned to your last session.")
        case ("light", _):
            return t2("今天整体降一档。", "Everything one notch lighter today.")
        case ("rest", _):
            return t2("今天不开训练单。", "No prescription today.")
        case ("deload", _):
            return t2("本周减载：重量与组数同时回收。", "Deload week: weight and sets both pulled back.")
        default:
            return t2("按计划推进。", "On plan.")
        }
    }

    /// Signal 行：可观察事实。
    public func signalLine(gapDays: Int?, sessionsLast7: Int, planned: Int) -> String {
        guard let gapDays else {
            return t2("暂无训练记录", "No training history yet")
        }
        return t2(
            "距上次 \(gapDays) 天 · 近 7 天 \(sessionsLast7)/\(planned) 练",
            "\(gapDays)d since last · \(sessionsLast7)/\(planned) sessions this week"
        )
    }

    /// Change 行：首个动作的 previous→target。
    public func changeLine(exerciseName: String, change: String, fromKg: String?, toKg: String) -> String {
        switch change {
        case "start":
            return t2("\(exerciseName) 首次定档 \(toKg) \(unitLabel)", "\(exerciseName) starts at \(toKg) \(unitLabel)")
        case "increase":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) \(from)→\(toKg) \(unitLabel) · 进阶", "\(exerciseName) \(from)→\(toKg) \(unitLabel) · moving up")
        case "ease":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) \(from)→\(toKg) \(unitLabel) · 回调", "\(exerciseName) eased \(from)→\(toKg) \(unitLabel)")
        default:
            return t2("\(exerciseName) 保持 \(toKg) \(unitLabel)", "\(exerciseName) holds \(toKg) \(unitLabel)")
        }
    }

    // MARK: - 自重展示（wave-6）：大数字=次数、无「0kg」

    /// 主数字：自重 = 次数；其余 = 重量。
    public func heroNumber(loadType: String, weightKg: Double, reps: Int) -> String {
        loadType == "bodyweight" ? String(reps) : formatKg(weightKg)
    }

    /// 副标：自重 = 「次 · RIR」（次数已在主数字）；其余 = 「单位 · ×次 · RIR」。
    public func heroDetail(loadType: String, reps: Int, rir: Int) -> String {
        loadType == "bodyweight"
            ? t2("次 · RIR \(rir)", "reps · RIR \(rir)")
            : loadDetail(targetReps: reps, targetRir: rir)
    }

    /// Rail 节点值：自重 = 「×次」；其余 = 「重×次」。
    public func railValue(loadType: String, weightKg: Double?, reps: Int?) -> String {
        if loadType == "bodyweight" {
            guard let reps else { return "—" }
            return "×\(reps)"
        }
        return railValue(weightKg: weightKg, reps: reps)
    }

    /// Change 行（自重）：按次数叙述，重量轴不出现。
    public func changeLineBodyweight(exerciseName: String, change: String, reps: Int, atCeiling: Bool) -> String {
        if atCeiling {
            return t2("\(exerciseName) ×\(reps) · 可加配重或换更难变体了",
                      "\(exerciseName) ×\(reps) · ready to add load or progress")
        }
        switch change {
        case "start": return t2("\(exerciseName) 首次 ×\(reps)", "\(exerciseName) starts at ×\(reps)")
        case "increase": return t2("\(exerciseName) 加到 ×\(reps) · 进阶", "\(exerciseName) up to ×\(reps)")
        default: return t2("\(exerciseName) 保持 ×\(reps)", "\(exerciseName) holds ×\(reps)")
        }
    }

    private func t2(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
