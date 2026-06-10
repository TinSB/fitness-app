// TodayEngineCopy — M2-3 引擎接线文案：typed code → 双语句子。
//
// 引擎零文案（系统逻辑 §6.0/§6.0.1）：裁决/处方只产 code 与数值，这里把它们
// 渲染成「信号 + 影响 + 决策」句（文案基线 §4.2）；禁词（算法名/「AI 判断」/
// 「系统认为」/「最佳」）不得出现。重量一律 kg 显示——FR-SE1 单位切换落地前
// 不硬编码 lb（拍板留痕：原型里的 lb 是静态展示稿口径）。

import Foundation

extension RedeStrings {
    // MARK: - 名称（动作 24 条 + 训练日）

    /// 动作双语名（id 即 catalog 稳定 id；未知 id 原样回显，不猜）。
    public func exerciseName(_ id: String) -> String {
        let zh: [String: String] = [
            "bench-press": "平板卧推", "incline-db-press": "上斜哑铃卧推",
            "db-bench-press": "哑铃卧推", "machine-chest-press": "器械推胸",
            "cable-fly": "绳索夹胸", "lat-pulldown": "高位下拉",
            "seated-row": "坐姿划船", "barbell-row": "杠铃划船",
            "one-arm-db-row": "单臂哑铃划船", "face-pull": "面拉",
            "shoulder-press": "哑铃肩推", "lateral-raise": "哑铃侧平举",
            "db-curl": "哑铃弯举", "hammer-curl": "锤式弯举",
            "preacher-curl": "牧师凳弯举", "triceps-pushdown": "绳索下压",
            "close-grip-bench": "窄握卧推", "squat": "深蹲",
            "hack-squat": "哈克深蹲", "leg-press": "腿举",
            "romanian-deadlift": "罗马尼亚硬拉", "db-rdl": "哑铃罗马尼亚硬拉",
            "leg-curl": "腿弯举", "calf-raise": "提踵",
        ]
        let en: [String: String] = [
            "bench-press": "Bench press", "incline-db-press": "Incline DB press",
            "db-bench-press": "DB bench press", "machine-chest-press": "Machine chest press",
            "cable-fly": "Cable fly", "lat-pulldown": "Lat pulldown",
            "seated-row": "Seated row", "barbell-row": "Barbell row",
            "one-arm-db-row": "One-arm DB row", "face-pull": "Face pull",
            "shoulder-press": "Shoulder press", "lateral-raise": "Lateral raise",
            "db-curl": "DB curl", "hammer-curl": "Hammer curl",
            "preacher-curl": "Preacher curl", "triceps-pushdown": "Triceps pushdown",
            "close-grip-bench": "Close-grip bench", "squat": "Squat",
            "hack-squat": "Hack squat", "leg-press": "Leg press",
            "romanian-deadlift": "Romanian deadlift", "db-rdl": "DB RDL",
            "leg-curl": "Leg curl", "calf-raise": "Calf raise",
        ]
        let table = locale == .zh ? zh : en
        return table[id] ?? id
    }

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

    /// kg 数值：整数去尾零（62.5 → "62.5"，60.0 → "60"）。
    public func formatKg(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }

    /// Load Plate 后缀："kg · ×6 · RIR 2"。
    public func loadDetail(targetReps: Int, targetRir: Int) -> String {
        "kg · ×\(targetReps) · RIR \(targetRir)"
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
            return t2("\(exerciseName) 首次定档 \(toKg) kg", "\(exerciseName) starts at \(toKg) kg")
        case "increase":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) \(from)→\(toKg) kg · 进阶", "\(exerciseName) \(from)→\(toKg) kg · moving up")
        case "ease":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) \(from)→\(toKg) kg · 回调", "\(exerciseName) eased \(from)→\(toKg) kg")
        default:
            return t2("\(exerciseName) 保持 \(toKg) kg", "\(exerciseName) holds \(toKg) kg")
        }
    }

    private func t2(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
