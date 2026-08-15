import Foundation

// 表 → 手机的遥控命令（v2，2026-08-15）。
//
// 与 WatchLoggedSet 的分工：那条是**事实**（这一组做完了，落库），这条是**指令**
//（把休息加 30 秒 / 休息不等了 / 热身不做了）。两者通道也不同：
//
// · 指令走 **sendMessage**：它们只在「此刻」有意义——两分钟后才送到的「+30 秒」
//   加在下一段休息上就是错的。手机够不着就让它失败，表上把按钮置灰说清楚，
//   而不是排队等一个过期的执行。
// · 事实走 transferUserInfo：迟到无所谓，丢了不行。
//
// **表永远不自己推进**（owner 拍板 2026-08-15）：休息到点、跳过休息、跳过热身，
// 表都只是**告诉手机**，下一组仍由手机的引擎决定后推回来。表上没有历史、e1RM、
// 疼痛记录，NextSetEngine 的输入它根本不具备——它能做的只有转述用户的意图。
public struct WatchCommand: Codable, Equatable, Sendable {
    public enum Action: String, Codable, Sendable {
        /// 休息 +30 秒（= 手机休息屏的「+30s」）。
        case restAdd30
        /// 结束这段休息、进下一组（= 手机休息屏的「下一组」；也用于表上倒计时自然走完）。
        case restSkip
        /// 跳过这个动作剩余的全部热身步（= 手机热身态的「跳过热身」）。
        case skipWarmup
    }

    public let action: Action
    /// 表发命令那一刻显示的动作。手机据此判断命令是不是对着当前状态发的——
    /// 表侧 context 滞后一拍时，「跳过热身」不能落到下一个动作头上。
    public let exerciseId: String
    /// 是否由倒计时自然走完触发（而不是用户按了「下一组」）。
    /// 手机据此决定要不要撤回已排程的「休息结束」通知：自然到点 = 通知正该此刻送达，
    /// 不撤；手动提前 = 撤回，免得训练已推进还弹一条。与手机自己的 finishRest(auto:) 同一口径。
    public let auto: Bool
    /// 表侧发出时刻（ISO8601）。只作日志。
    public let sentAtISO: String

    public init(action: Action, exerciseId: String, auto: Bool = false, sentAtISO: String) {
        self.action = action
        self.exerciseId = exerciseId
        self.auto = auto
        self.sentAtISO = sentAtISO
    }

    public var encoded: Data? { try? JSONEncoder().encode(self) }

    /// 未知 action（更新的表发来的新命令）解不出来 → nil → 手机安静丢弃。向前兼容。
    public init?(decoding data: Data) {
        guard let decoded = try? JSONDecoder().decode(WatchCommand.self, from: data) else { return nil }
        self = decoded
    }
}
