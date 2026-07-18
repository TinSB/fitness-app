// WeeklyCoachReviewCopy — FR-SUB3 每周教练复盘双语文案。
//
// 只渲染 app 已确认的 typed code 与事实值；不判断趋势、不查目录、不生成价格或权益承诺。
// 语气保持可核对、非因果、非羞辱，也不附加 Free Core / 本机存储等无关小字。

extension RedeStrings {
    public var weeklyCoachReviewTitle: String {
        weeklyT("每周教练复盘", "Weekly Coach Review")
    }

    public var weeklyCoachReviewEvidenceTitle: String {
        weeklyT("依据", "Evidence")
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

    public func weeklyCoachReviewWeek(dateText: String) -> String {
        weeklyT("复盘周 · \(dateText)", "Week of \(dateText)")
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

    public func weeklyCoachReviewVerdictBody(code: String, count: Int) -> String? {
        switch code {
        case "dataNeedsReview":
            return weeklyT("上周有 \(count) 条记录需要确认，核对后再读趋势",
                           "Last week has \(count) entries to confirm before reading the trend")
        case "rebuildRhythm":
            return weeklyT("上周训练节奏比近期少至少一天，下一次训练从今日接上",
                           "Last week was at least one training day below your recent rhythm. Pick up from Today")
        case "progressing":
            return weeklyT("可比训练记录显示关键动作上升",
                           "Comparable training records show your key lift moving up")
        case "holding":
            return weeklyT("可比训练记录显示关键动作保持稳定",
                           "Comparable training records show your key lift holding steady")
        case "easing":
            return weeklyT("可比训练记录显示关键动作有所回落",
                           "Comparable training records show your key lift easing back")
        default:
            return nil
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
