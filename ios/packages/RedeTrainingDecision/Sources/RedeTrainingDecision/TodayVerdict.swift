// TodayVerdict — 今日裁决输出（PRD FR-T1 四态 + FR-T3 可解释结构）。
//
// 引擎不产任何用户可见文案：reason/signal 是 typed code + 参数，由 M2-3 经
// RedeL10n 双语模板渲染成「信号 + 影响 + 决策」句——FR-T3 的禁词约束
// （不写算法名/「AI 判断」）因此在结构上成立。输出是纯派生，永不写回 AppData。

public enum TodayCall: String, Equatable, Sendable {
    case train
    case light
    case rest
    case deload
}

/// 可观察事实（喂今日页 Receipt 的 Signal 行）。
public enum VerdictSignal: Equatable, Sendable {
    case noTrainingHistory
    case daysSinceLastSession(Int)
    case sessionsInLast7Days(Int)
    case plannedDaysPerWeek(Int)
    case consecutiveTrainingDays(Int)
    case lastSessionMeanRir(Double)
}

/// 裁决主理由（瀑布命中的那条规则）。
public enum VerdictReason: Equatable, Sendable {
    case alreadyTrainedToday
    case noHistoryCalibration
    case longGapReentry(days: Int)
    case consecutiveDaysNeedRest(days: Int)
    case sustainedLoadDeload(days: Int)
    case weeklyPlanReached(sessions: Int, planned: Int)
    case lastSessionNearFailure(meanRir: Double)
    case normalProgression

    /// 稳定 code——goldens 锁定用，也是 M2-3 双语文案 key 的挂点。
    public var code: String {
        switch self {
        case .alreadyTrainedToday: return "alreadyTrainedToday"
        case .noHistoryCalibration: return "noHistoryCalibration"
        case .longGapReentry: return "longGapReentry"
        case .consecutiveDaysNeedRest: return "consecutiveDaysNeedRest"
        case .sustainedLoadDeload: return "sustainedLoadDeload"
        case .weeklyPlanReached: return "weeklyPlanReached"
        case .lastSessionNearFailure: return "lastSessionNearFailure"
        case .normalProgression: return "normalProgression"
        }
    }
}

public struct TodayVerdict: Equatable, Sendable {
    public let call: TodayCall
    public let reason: VerdictReason
    public let signals: [VerdictSignal]

    public init(call: TodayCall, reason: VerdictReason, signals: [VerdictSignal]) {
        self.call = call
        self.reason = reason
        self.signals = signals
    }
}
