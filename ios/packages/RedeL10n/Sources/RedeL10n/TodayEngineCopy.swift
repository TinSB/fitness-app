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
        // 新日型（6 天 PPL×2 的 B 日 + 2-3 天全身 A/B/C）名：legacy parity map（formatters.ts 端）
        // 无此键，就近处理，不污染 parity-locked 的 Formatters.templateNameMap。
        let extraNames: [String: (zh: String, en: String)] = [
            "push-b": ("推 B", "Push B"),
            "pull-b": ("拉 B", "Pull B"),
            "legs-b": ("腿 B", "Legs B"),
            "full-a": ("全身 A", "Full Body A"),
            "full-b": ("全身 B", "Full Body B"),
            "full-c": ("全身 C", "Full Body C"),
        ]
        if let b = extraNames[code] { return locale == .zh ? b.zh : b.en }
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
        t2("数据暂时读不出来　你的记录仍在，没有被覆盖",
           "Your data can't be read right now. Nothing was lost or overwritten")
    }
    public var dataUnreadableReceipt: String {
        t2("今天不开训练单　先保护已有数据", "No prescription today. Protecting your existing data first")
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
            return t2("今天可以练　首次训练，重量从轻", "Train today. First session, starting light")
        case ("train", _):
            return t2("今天可以练　\(dayName)，按计划", "Train today. \(dayName) as planned")
        case ("light", "longGapReentry"):
            let days = gapDays.map(String.init) ?? "—"
            return t2("今天轻练　停训 \(days) 天，先回到状态", "Go light today. \(days) days off, ease back in first")
        case ("light", "weeklyPlanReached"):
            return t2("今天轻练　本周量已够，留有余力", "Go light today. Weekly volume is in, keep some in reserve")
        case ("light", "lastSessionNearFailure"):
            return t2("今天轻练　上次练到力竭，留出恢复", "Go light today. Last session hit failure, leave room to recover")
        case ("light", _):
            return t2("今天轻练　\(dayName)，降一档", "Go light today. \(dayName), one notch down")
        case ("rest", "alreadyTrainedToday"):
            return t2("今天已练完　明天继续", "Already trained today. Back tomorrow")
        case ("rest", "consecutiveDaysNeedRest"):
            let days = consecutiveDays.map(String.init) ?? "—"
            return t2("今天休息　已连练 \(days) 天", "Rest today. \(days) days straight")
        case ("rest", _):
            return t2("今天休息", "Rest today")
        case ("deload", _):
            return t2("本周减载　连续数周高量，主动降一档", "Deload this week. Weeks of heavy load, backing off on purpose")
        default:
            return t2("今天可以练", "Train today")
        }
    }

    /// 顺延透明化副句（2026-07-08）：新周 + 上周未练满 + 指针不在序列头——解释
    /// 「为什么今天不是从头」并指路换天（决策在用户；两拍全角空格，§3.4）。
    public func carriedOverHeader(day: String) -> String {
        t2("上周的\(day)顺延到今天　想重新开一轮可以换一天练",
           "Last week's \(day) carries over to today. Swap the day to start a fresh round")
    }

    /// 自动均衡依据行（批次 E 2026-07-10，owner 拍板「不要建议直接自动改」）：
    /// 只进「查看依据」抽屉，无常驻小字；names 为已本地化肌群名。
    public func musclePriorityBoostedLine(names: [String]) -> String {
        let joined = names.joined(separator: locale == .zh ? "、" : ", ")
        return t2("\(joined)正在补足　今天多安排了组数",
                  "Building up \(joined). Extra sets added today")
    }

    /// 收据结论句。gapDays 供回归分档（默认 nil = 既有调用不变）。
    public func receiptConclusion(call: String, reasonCode: String, gapDays: Int? = nil) -> String {
        switch (call, reasonCode) {
        case ("train", "noHistoryCalibration"):
            return t2("首次训练，全部动作从轻起步", "First session, every lift starts light")
        case ("train", _):
            return t2("按计划推进，照上次表现微调", "On plan, tuned to your last session")
        case ("light", "longGapReentry"):
            // 回归协议（2026-07-08）：告别通用「降一档」——回归场景说人话。
            // ≥21 天：循环已重启+重量回落；14-20 天：先找回感觉（两拍全角空格，§3.4）
            let days = gapDays.map(String.init) ?? "—"
            return (gapDays ?? 0) >= 21
                ? t2("停练 \(days) 天　循环从头开始，重量先回落", "\(days) days away. Cycle restarts from day one, weights eased back")
                : t2("停练 \(days) 天　这场先找回感觉", "\(days) days away. This one is about finding your groove")
        case ("light", _):
            return t2("今天整体降一档", "Everything one notch lighter today")
        case ("rest", _):
            return t2("今天不开训练单", "No prescription today")
        case ("deload", _):
            return t2("本周减载　重量与组数同时回收", "Deload week: weight and sets both pulled back")
        default:
            return t2("按计划推进", "On plan")
        }
    }

    // MARK: - Widget 快照文案（FR-WD1）：与今日页同源——纯组装现有裁决文案，不另起口径。
    // app 层把裁决投影成 primitives（call/reason/dayName/hasPlan/信号）后调这里，再写 App Group
    // 快照；widget 进程只渲染这里产出的字符串，故文案永远 == 今日页（同 verdictStatus /
    // receiptConclusion / verdictHeadline / trainingDayName 真源）。host 可单测。

    /// Widget 标题：先回答「今天该不该练」（裁决状态），有处方时接训练日名。
    public func widgetHeadline(call: String, dayName: String, hasPlan: Bool) -> String {
        let status = verdictStatus(call: call)
        return (hasPlan && !dayName.isEmpty) ? "\(status) · \(dayName)" : status
    }

    /// Widget 短理由：有处方走收据结论句（与今日页判断行同句）；无处方（休息等）走判断句。
    public func widgetAdvice(call: String, reasonCode: String, dayName: String, gapDays: Int?, consecutiveDays: Int?, hasPlan: Bool) -> String {
        hasPlan
            ? receiptConclusion(call: call, reasonCode: reasonCode, gapDays: gapDays)
            : verdictHeadline(call: call, reasonCode: reasonCode, dayName: dayName, gapDays: gapDays, consecutiveDays: consecutiveDays)
    }

    /// Signal 行：可观察事实。
    public func signalLine(gapDays: Int?, sessionsLast7: Int, planned: Int) -> String {
        guard let gapDays else {
            return t2("暂无训练记录", "No training history yet")
        }
        // 口径=滚动 7 天（sessionsLast7），非 ISO 周——英文不得写 this week（2026-07-03 审查修复）
        return t2(
            "距上次 \(gapDays) 天 · 近 7 天 \(sessionsLast7)/\(planned) 练",
            "\(gapDays)d since last · \(sessionsLast7)/\(planned) sessions in the past 7 days"
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

    /// 纯次数渲染的负重语义（无 kg 轴）：自重（wave-6）+ 弹力带（wave-12，A 案按次数进阶）。
    /// 两者显示完全一致（次数当大数字、不显重量），唯一分叉在到顶 change 行的文案。
    private func isRepBased(_ loadType: String) -> Bool {
        loadType == "bodyweight" || loadType == "band"
    }

    /// 主数字：自重/弹力带 = 次数；辅助 = 「辅助 N」；负重自重 = 「负重 +N」；其余 = 重量。
    public func heroNumber(loadType: String, weightKg: Double, reps: Int) -> String {
        if isRepBased(loadType) { return String(reps) }
        if loadType == "assisted" { return assistPrefixed(formatKg(weightKg)) }
        if loadType == "bodyweight-plus" { return weightedPrefixed(formatKg(weightKg)) }
        return formatKg(weightKg)
    }

    /// 辅助器械前缀（wave-9）：辅助配重量冠「辅助」二字，区别于举起的负重——
    /// 用户看到「辅助 30」才不会误以为举起了 30kg。前缀只加在数字，单位/后缀各自照常。
    private func assistPrefixed(_ value: String) -> String {
        t2("辅助 \(value)", "assist \(value)")
    }

    /// 负重自重前缀（wave-11）：大数字/Rail 用「+N」——「+」已明示自重之上**外加**的负荷，
    /// 动作名「负重引体向上」+ 组表「负重」表头已给足语境，巨字号下不冗余不换行
    /// （区别于 prose change 行仍写全「负重 +」）。
    private func weightedPrefixed(_ value: String) -> String {
        "+\(value)"
    }

    /// 副标：自重/弹力带 = 「次 · RIR」（次数已在主数字）；其余 = 「单位 · ×次 · RIR」。
    public func heroDetail(loadType: String, reps: Int, rir: Int) -> String {
        isRepBased(loadType)
            ? t2("次 · RIR \(rir)", "reps · RIR \(rir)")
            : loadDetail(targetReps: reps, targetRir: rir)
    }

    /// Rail 节点值：自重/弹力带 = 「×次」；辅助 = 「辅助 重×次」；其余 = 「重×次」。
    public func railValue(loadType: String, weightKg: Double?, reps: Int?) -> String {
        if isRepBased(loadType) {
            guard let reps else { return "—" }
            return "×\(reps)"
        }
        if loadType == "assisted" {
            return assistPrefixed(railValue(weightKg: weightKg, reps: reps))
        }
        if loadType == "bodyweight-plus" {
            return weightedPrefixed(railValue(weightKg: weightKg, reps: reps))
        }
        return railValue(weightKg: weightKg, reps: reps)
    }

    /// Change 行（自重/弹力带）：按次数叙述，重量轴不出现。
    /// 唯一分叉在到顶（isBand，wave-12）：弹力带换更重的带子，自重加配重/换更难变体；
    /// start/increase/hold 三态完全共用（都是「首次/加到/保持 ×次」）。
    public func changeLineBodyweight(exerciseName: String, change: String, reps: Int, atCeiling: Bool, isBand: Bool = false) -> String {
        if atCeiling {
            return isBand
                ? t2("\(exerciseName) ×\(reps) · 到顶　换更重的带子",
                     "\(exerciseName) ×\(reps) · at ceiling, size up the band")
                : t2("\(exerciseName) ×\(reps) · 到顶　可加配重或进阶",
                     "\(exerciseName) ×\(reps) · at ceiling, add load or progress")
        }
        switch change {
        case "start": return t2("\(exerciseName) 首次 ×\(reps)", "\(exerciseName) first set ×\(reps)")
        case "increase": return t2("\(exerciseName) 加到 ×\(reps) · 进阶", "\(exerciseName) up to ×\(reps)")
        default: return t2("\(exerciseName) 保持 ×\(reps)", "\(exerciseName) holds ×\(reps)")
        }
    }

    /// Change 行（辅助器械，wave-9）：方向已由引擎翻好（进阶=辅助↓、回调=辅助↑），
    /// 这里**不再反读**，只加「辅助」前缀消歧——靠「辅助」二字让「数字下降=进阶」读通。
    public func changeLineAssisted(exerciseName: String, change: String, fromKg: String?, toKg: String) -> String {
        switch change {
        case "start":
            return t2("\(exerciseName) 首次定档 辅助 \(toKg) \(unitLabel)", "\(exerciseName) starts at assist \(toKg) \(unitLabel)")
        case "increase":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) 辅助 \(from)→\(toKg) \(unitLabel) · 进阶", "\(exerciseName) assist \(from)→\(toKg) \(unitLabel) · moving up")
        case "ease":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) 辅助 \(from)→\(toKg) \(unitLabel) · 回调", "\(exerciseName) assist \(from)→\(toKg) \(unitLabel) · easing")
        default:
            return t2("\(exerciseName) 保持 辅助 \(toKg) \(unitLabel)", "\(exerciseName) holds assist \(toKg) \(unitLabel)")
        }
    }

    /// Change 行（负重自重，wave-11）：方向同 external（加负重=进阶、减负重=回调），
    /// 只加「负重 +」前缀。
    public func changeLineBodyweightPlus(exerciseName: String, change: String, fromKg: String?, toKg: String) -> String {
        switch change {
        case "start":
            return t2("\(exerciseName) 首次定档 负重 +\(toKg) \(unitLabel)", "\(exerciseName) starts at weighted +\(toKg) \(unitLabel)")
        case "increase":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) 负重 +\(from)→+\(toKg) \(unitLabel) · 进阶", "\(exerciseName) weighted +\(from)→+\(toKg) \(unitLabel) · moving up")
        case "ease":
            let from = fromKg ?? "—"
            return t2("\(exerciseName) 负重 +\(from)→+\(toKg) \(unitLabel) · 回调", "\(exerciseName) weighted +\(from)→+\(toKg) \(unitLabel) · easing")
        default:
            return t2("\(exerciseName) 保持 负重 +\(toKg) \(unitLabel)", "\(exerciseName) holds weighted +\(toKg) \(unitLabel)")
        }
    }

    /// Change 行（负重回退，wave-11）：外挂负重减到最小还吃力、引擎已切自重孪生——回退提示。
    /// 调用方须在 bodyweight 分支**之前**按 reason==.bodyweightPlusDegraded 命中（此时 loadType 已是自重）。
    public func changeLineBodyweightPlusDegraded(exerciseName: String, reps: Int) -> String {
        t2("\(exerciseName) · 负重到底　回到自重 ×\(reps)", "\(exerciseName) · back to bodyweight ×\(reps)")
    }

    /// Change 行（辅助毕业，wave-9）：辅助减到最小、引擎已切自重孪生——一次性祝贺。
    /// 调用方须在 bodyweight 分支**之前**按 reason==.assistedGraduated 命中（此时 loadType 已是自重）。
    public func changeLineAssistedGraduated(exerciseName: String) -> String {
        t2("\(exerciseName) · 辅助毕业，开始自重", "\(exerciseName) · graduated to unassisted")
    }

    // MARK: - 练完态当日总结（T1 2026-07-05：FR-SH3 完成后轻量分享入口延续到今日页）

    /// 总结块区头（overline）。
    public var todayDoneSummaryHeader: String { t2("今天这场", "Today's session") }
    /// 总量标签（overline；数值走 formatVolumeKg 千分位 + 单位）。
    public var todayDoneVolumeLabel: String { t2("总量", "Volume") }
    /// 轻量分享入口（打开分享卡预览；FR-SH3 绝不自动弹出）。
    public var todayDoneShareAction: String { t2("分享这场训练", "Share this workout") }

    private func t2(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
