import Foundation

// RestCountdown — 休息倒计时的墙钟锚点（纯值类型，now 由调用方注入，可单测）。
//
// 为什么单独成型：TrainFlowState 是无时钟 reducer（只存计划秒数）；倒计时的
// 「时间流逝」属于 app 层。早先实现把剩余秒数放在 TrainTabView 的 @State 里逐秒
// 自减——切 tab 时 RootTabView 用 switch 销毁整棵视图树，@State 随之归 0，回来后
// 倒计时显示 0:00 并立即结束（owner 反馈 2026-06-15 的 bug）。
//
// 修法：把「锚点」从视图移到会话层（SessionStore 持有本类型，跨切页存活），并改用
// 绝对结束时刻而非逐秒自减——任何一帧都能从真实 Date 求出剩余，切页回来不丢、
// 离屏期间真实时间照常流逝（符合「休息时间是墙钟时间」）。本类型只做 Date 算术，
// now 显式注入故纯而可测。
public struct RestCountdown: Equatable, Sendable {
    /// 运行中：绝对结束时刻。暂停或未在休息时为 nil。
    public private(set) var endDate: Date?
    /// 暂停中：冻结的剩余秒数。运行中为 nil。
    public private(set) var pausedRemaining: Int?
    /// 本段休息的总时长（秒），= 进度条分母。+30 会同步增长它，使进度条始终
    /// 「remaining/total」、不会因 remaining 超过初始计划而卡满（owner 2026-06-15 反馈）。
    public private(set) var totalSeconds: Int = 0

    public init() {}

    /// 是否有一段休息在进行（运行或暂停皆算）。
    public var isActive: Bool { endDate != nil || pausedRemaining != nil }

    /// 是否处于暂停态。
    public var isPaused: Bool { pausedRemaining != nil }

    /// 当前剩余秒数（永不为负）。运行中按墙钟求差并向上取整（首秒显示满值，
    /// 与常见倒计时观感一致）；暂停取冻结值；未激活为 0。
    public func remaining(now: Date = Date()) -> Int {
        if let paused = pausedRemaining { return max(0, paused) }
        guard let end = endDate else { return 0 }
        return max(0, Int(end.timeIntervalSince(now).rounded(.up)))
    }

    /// 进度条比例 = 剩余/总时长（0…1）。与倒计时数字同源、同步：满格起步、
    /// 在 0:00 精确归零；+30 后 total 同步增长故不卡满、继续平滑下降。
    public func fraction(now: Date = Date()) -> Double {
        guard totalSeconds > 0 else { return 0 }
        return min(1, max(0, Double(remaining(now: now)) / Double(totalSeconds)))
    }

    /// 开始一段休息（重置任何暂停态）。
    public mutating func begin(seconds: Int, now: Date = Date()) {
        pausedRemaining = nil
        totalSeconds = max(0, seconds)
        endDate = now.addingTimeInterval(TimeInterval(max(0, seconds)))
    }

    /// 加时（+30）：运行中推后结束点；暂停中加到冻结剩余；total 同步增长（进度条不卡满）。
    public mutating func add(seconds: Int) {
        guard isActive else { return }
        totalSeconds = max(0, totalSeconds + seconds)
        if let paused = pausedRemaining {
            pausedRemaining = max(0, paused + seconds)
        } else if let end = endDate {
            endDate = end.addingTimeInterval(TimeInterval(seconds))
        }
    }

    /// 暂停 / 继续切换。未激活则无操作。
    public mutating func togglePause(now: Date = Date()) {
        if let paused = pausedRemaining {
            // 继续：从此刻起按冻结剩余重新锚定结束点。
            pausedRemaining = nil
            endDate = now.addingTimeInterval(TimeInterval(paused))
        } else if let end = endDate {
            // 暂停：冻结此刻剩余，撤掉墙钟锚点。
            pausedRemaining = max(0, Int(end.timeIntervalSince(now).rounded(.up)))
            endDate = nil
        }
    }

    /// 结束 / 清空。
    public mutating func clear() {
        endDate = nil
        pausedRemaining = nil
        totalSeconds = 0
    }
}
