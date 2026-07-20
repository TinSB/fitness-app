// WeeklyCoachReviewCopy — FR-SUB3 每周教练复盘双语文案。
//
// 只渲染 app 已确认的 typed code 与事实值；不判断趋势、不查目录、不生成价格或权益承诺。
// 语气保持可核对、非因果、非羞辱，也不附加 Free Core / 本机存储等无关小字。

extension RedeStrings {
    public var weeklyCoachReviewTitle: String {
        weeklyT("每周教练复盘", "Weekly Coach Review")
    }

    public func weeklyCoachReviewIssue(weekOfYear: Int) -> String {
        "Weekly Review / Week \(weekOfYear)"
    }

    public func weeklyCoachReviewDateRange(
        startText: String,
        endText: String,
        year: Int
    ) -> String {
        weeklyT("\(startText)—\(endText) · \(year)", "\(startText)–\(endText) · \(year)")
    }

    public func weeklyCoachReviewCrossYearDateRange(
        startText: String,
        startYear: Int,
        endText: String,
        endYear: Int
    ) -> String {
        weeklyT(
            "\(startYear)年\(startText)—\(endYear)年\(endText)",
            "\(startText), \(startYear)–\(endText), \(endYear)"
        )
    }

    public var weeklyCoachReviewDecisionLabel: String {
        weeklyT("本周判定 / Coach Call", "Coach Call")
    }

    public var weeklyCoachReviewMovementLabel: String {
        weeklyT("关键变化 / Movement", "Movement")
    }

    public var weeklyCoachReviewDataCheckLabel: String {
        weeklyT("数据核对 / Data Check", "Data Check")
    }

    public var weeklyCoachReviewRhythmLabel: String {
        weeklyT("训练节奏 / Rhythm", "Rhythm")
    }

    public var weeklyCoachReviewBaselineLabel: String {
        weeklyT("训练积累 / Baseline", "Baseline")
    }

    public var weeklyCoachReviewEvidenceMemoLabel: String {
        weeklyT("判断依据 / Evidence", "Evidence")
    }

    public var weeklyCoachReviewNextLabel: String {
        weeklyT("下一步 / Next", "Next")
    }

    public var weeklyCoachReviewComparableRecords: String {
        weeklyT("e1RM · 可比记录", "e1RM · Comparable Records")
    }

    public func weeklyCoachReviewLiftDetail(code: String, hasDelta: Bool) -> String {
        if hasDelta { return weeklyCoachReviewComparableRecords }
        switch code {
        case "up", "flat", "down":
            return weeklyT("e1RM · 可比趋势", "e1RM · Comparable Trend")
        default:
            return weeklyT("可比场次不足", "More Comparable Sessions Needed")
        }
    }

    public var weeklyCoachReviewLastFullWeek: String {
        weeklyT("上一完整周", "Last Full Week")
    }

    public var weeklyCoachReviewTrainingRhythmMetric: String {
        weeklyT("训练节奏", "Training Rhythm")
    }

    public var weeklyCoachReviewEffectiveVolumeMetric: String {
        weeklyT("有效训练量", "Clean Volume")
    }

    public var weeklyCoachReviewRecentRhythmMetric: String {
        weeklyT("近期中位", "Recent Median")
    }

    public var weeklyCoachReviewSessionsMetric: String {
        weeklyT("完成训练", "Sessions")
    }

    public var weeklyCoachReviewDataFindingsMetric: String {
        weeklyT("待核对记录", "Entries to Review")
    }

    public func weeklyCoachReviewDayUnit(_ count: Double) -> String {
        weeklyT("天", count == 1 ? "day" : "days")
    }

    public func weeklyCoachReviewSessionUnit(_ count: Int) -> String {
        weeklyT("场", count == 1 ? "session" : "sessions")
    }

    public func weeklyCoachReviewEntryUnit(_ count: Int) -> String {
        weeklyT("条", count == 1 ? "entry" : "entries")
    }

    public func weeklyCoachReviewLiftCallMetric(code: String) -> String {
        switch code {
        case "up": return weeklyT("向上", "Moving Up")
        case "flat": return weeklyT("稳定", "Holding")
        case "down": return weeklyT("回落", "Easing")
        default: return weeklyT("校准中", "Calibrating")
        }
    }

    public var weeklyCoachReviewLoading: String {
        weeklyT("正在整理上周", "Reviewing last week")
    }

    public var weeklyCoachReviewEmptyTitle: String {
        weeklyT("上周没有训练记录", "No workouts were recorded last week")
    }

    public var weeklyCoachReviewUnavailableTitle: String {
        weeklyT("暂时读不出复盘", "Can't load the review right now")
    }

    public var weeklyCoachReviewUnavailableBody: String {
        weeklyT("训练记录此刻无法读取，稍后再试一次",
                "Your training records couldn't be read. Try again")
    }

    public var weeklyCoachReviewRetry: String {
        weeklyT("重新读取", "Try again")
    }

    public func weeklyCoachReviewVerdictTitle(code: String) -> String {
        switch code {
        case "dataNeedsReview":
            return weeklyT("先核对上周的训练记录", "Check last week’s training records first")
        case "rebuildRhythm":
            return weeklyT("先把训练节奏接回来", "Rebuild your training rhythm")
        case "progressing":
            return weeklyT("关键动作在向上走", "Your key lift is moving up")
        case "holding":
            return weeklyT("关键动作保持稳定", "Your key lift is holding steady")
        case "easing":
            return weeklyT("关键动作有所回落", "Your key lift eased back")
        default:
            return weeklyT("继续训练后再判断趋势", "Keep training before calling a trend")
        }
    }

    /// 概念稿 V2 的展示级判断：只压缩既有 typed verdict，不增加原因、建议或能力承诺。
    public func weeklyCoachReviewVerdictDisplayTitle(code: String) -> String {
        switch code {
        case "dataNeedsReview":
            return weeklyT("先核对，\n再判断。", "Verify first.\nThen read the trend.")
        case "rebuildRhythm":
            return weeklyT("先接回，\n训练节奏。", "Rebuild\nyour rhythm.")
        case "progressing":
            return weeklyT("关键动作，\n向上。", "Key lift,\nmoving up.")
        case "holding":
            return weeklyT("关键动作，\n稳定。", "Key lift,\nholding.")
        case "easing":
            return weeklyT("关键动作，\n回落。", "Key lift,\neasing.")
        default:
            return weeklyT("继续积累，\n再判断。", "Keep building.\nThen call the trend.")
        }
    }

    public func weeklyCoachReviewTrainingDays(_ count: Int) -> String {
        weeklyT("训练 \(count) 天", count == 1 ? "1 training day" : "\(count) training days")
    }

    public func weeklyCoachReviewRecentMedian(_ count: Double) -> String {
        let value = count.rounded() == count ? String(Int(count)) : String(count)
        let days = count == 1 ? "day" : "days"
        return weeklyT("近期中位 \(value) 天", "Recent median · \(value) \(days)")
    }

    public func weeklyCoachReviewSessions(_ count: Int) -> String {
        weeklyT("完成 \(count) 场", count == 1 ? "1 session" : "\(count) sessions")
    }

    public func weeklyCoachReviewDataFindings(_ count: Int) -> String {
        weeklyT("待核对记录 \(count) 条", count == 1 ? "1 entry to review" : "\(count) entries to review")
    }

    public func weeklyCoachReviewCleanVolume(_ formattedValue: String) -> String {
        weeklyT("有效训练量 · \(formattedValue)", "Clean volume · \(formattedValue)")
    }

    public func weeklyCoachReviewKeyLift(name: String, call: String, deltaText: String?) -> String {
        switch call {
        case "up", "down":
            if let deltaText {
                return "\(name) · e1RM \(deltaText)"
            }
            return weeklyT("\(name) · 可比趋势已更新", "\(name) · comparable trend updated")
        case "flat":
            return weeklyT("\(name) · e1RM 基本持平", "\(name) · e1RM held steady")
        default:
            return weeklyT("\(name) · 可比场次还不足", "\(name) · more comparable sessions needed")
        }
    }

    public func weeklyCoachReviewAction(code: String) -> String {
        switch code {
        case "reviewData": return weeklyT("核对训练数据", "Review Training Data")
        case "openToday": return weeklyT("查看今天安排", "View Today")
        default: return weeklyT("查看进展", "View Progress")
        }
    }

    private func weeklyT(_ zh: String, _ en: String) -> String {
        locale == .zh ? zh : en
    }
}
