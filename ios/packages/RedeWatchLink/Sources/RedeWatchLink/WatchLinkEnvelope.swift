import Foundation

// 手机 ↔ 表的消息形状（切片 2，2026-08-12）。
//
// 为什么单独成包：消息形状必须**两端共用一个真源**。两个 target 各写一份
// 迟早对不上——而 WatchConnectivity 的失配是静默的（字段读不到就是 nil，不报错）。
//
// 通道纪律（方案锁定，不要凭手感换）：
//   · applicationContext —— 手机 → 表的处方。只保留最新一份，旧的过期无所谓。
//   · transferUserInfo   —— 表 → 手机的完成组。**排队 + 保证送达**。
//     记组绝不能用 sendMessage：它在手机锁屏 / app 被杀时静默失败，丢一组就是丢数据。
//   · sendMessage        —— 只用于可丢的实时态（如休息倒计时对表）。
public enum WatchLinkChannel: String, Sendable, CaseIterable {
    case applicationContext
    case userInfo
    case message
}

/// 消息信封。
///
/// body 在切片 2 刻意是扁平的 `[String: String]`：这一片只要证明通道通，
/// 形状还没有真实需求约束。切片 3（推处方）起 body 换成具体类型——
/// 那时才知道真正要传什么，现在定死等于凭空设计。
///
/// 为什么不用 JSON 字符串：WCSession 的字典必须是 property-list 兼容类型，
/// 直接用扁平字典就天然满足，少一层编解码也就少一处失败点。
public struct WatchLinkEnvelope: Equatable, Sendable {
    /// 消息类型。未知 kind 由接收端忽略——**向前兼容**：
    /// 表和手机的版本可以不同步（用户更新了手机没更新表），旧端收到新 kind 必须安静丢弃，不能崩。
    public let kind: String
    /// 发送时刻（ISO8601）。用于日志与乱序判断；不做时钟校正，只作参考。
    public let sentAtISO: String
    public let body: [String: String]

    public init(kind: String, sentAtISO: String, body: [String: String] = [:]) {
        self.kind = kind
        self.sentAtISO = sentAtISO
        self.body = body
    }

    // MARK: - plist 字典互转

    private enum Key {
        static let kind = "k"
        static let sentAt = "t"
        static let body = "b"
    }

    public var dictionary: [String: Any] {
        [Key.kind: kind, Key.sentAt: sentAtISO, Key.body: body]
    }

    /// 缺字段 / 类型不符 → nil。**绝不部分构造**：半个信封比没有更糟，
    /// 它会让接收端以为自己拿到了完整数据。
    public init?(dictionary: [String: Any]) {
        guard let kind = dictionary[Key.kind] as? String,
              let sentAt = dictionary[Key.sentAt] as? String
        else { return nil }
        self.kind = kind
        self.sentAtISO = sentAt
        self.body = (dictionary[Key.body] as? [String: String]) ?? [:]
    }
}

/// 切片 2 用到的 kind。后续切片各自追加，不集中成一个大枚举——
/// 那会让每加一种消息都要改公共文件。
public enum WatchLinkKind {
    public static let ping = "ping"
    public static let pong = "pong"
}
