import Foundation

// 表上体能训练怎么收尾（Master v3.10 §5 Apple Watch 规则 10 / 13，owner 2026-10-20 拍板）。
//
// 一条原则：**练过就写进健康，没练才丢。**
// · 手机说练完了 → 写，结束在此刻；
// · 手机说放弃了 → 丢（那一场什么都不存，健康里也不该有）；
// · 没等到手机说结局（手机 60 分钟没消息 / 被手机拉起后一直没确认 / 系统把会话停了）→ 这一场里记过组就写，
//   结束在最后一组（系统停的那次结束在停的那一刻：数据一直采到那时）；一组都没有才丢。
//
// 以前「没等到手机」一律整场丢弃——为的是别把几小时的假训练写进健康。结果练了一小时的心率和时长全没了，
// 依赖健康数据的 App（owner 用的 Peak）读不到这一场（owner 真机反馈）。结束在最后一组同样防住了假训练。
public enum WatchWorkoutEnding: Equatable, Sendable {
    /// 写进健康。endAt = nil：结束在此刻。
    case save(endAt: Date?)
    case discard

    /// 手机对这一场结局的说法。
    public enum Outcome: Equatable, Sendable {
        /// 练完了（到小结 / 已保存）。
        case completed
        /// 放弃了，什么都不存。
        case abandoned
        /// 没等到手机说：手机 60 分钟没消息、拉起后一直没确认、或会话被系统停了。
        case unknown
    }

    /// - lastSetAt: 最后一组的时刻（手机报来的与表上自己记的，取晚的那个）。
    /// - sessionStart: 这一场会话开始的时刻；比它早的组属于会话之前，不算这一场练过。
    /// - stoppedAt: 会话被系统停掉的那一刻（只有那种情况传）。
    public static func decide(_ outcome: Outcome, lastSetAt: Date?, sessionStart: Date?,
                              stoppedAt: Date? = nil) -> WatchWorkoutEnding {
        switch outcome {
        case .completed:
            return .save(endAt: nil)
        case .abandoned:
            return .discard
        case .unknown:
            guard let lastSetAt, let sessionStart, lastSetAt >= sessionStart else { return .discard }
            return .save(endAt: stoppedAt ?? lastSetAt)
        }
    }

    /// 两边各自知道的最后一组，取晚的那个。
    public static func latest(_ a: Date?, _ b: Date?) -> Date? {
        switch (a, b) {
        case let (a?, b?): return max(a, b)
        default: return a ?? b
        }
    }
}
