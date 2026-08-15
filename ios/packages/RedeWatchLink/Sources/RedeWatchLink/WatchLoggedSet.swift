import Foundation

// 表 → 手机的一条已完成组（切片 4，2026-08-15）。
//
// 这是**唯一一条会改变落盘数据的表侧消息**，所以两件事必须钉死：
//
// 1. **通道**：transferUserInfo（排队 + 保证送达）。绝不能用 sendMessage——
//    它在手机锁屏 / app 被杀时静默失败，而那正是练到一半的常态。丢一组就是丢数据。
//
// 2. **幂等**：exerciseId + setNumber 就是幂等键。手机侧只在
//    「这一组正是它此刻等的那一组」时才接受，否则丢弃。
//    真实危险不是网络重传，是**两块屏同时开着**：用户在表上记了一组，
//    又顺手在手机上点了打勾——不判就是同一组记两次，落盘数据凭空多一组。
//    这条判断很便宜，而它防的是数据错误，不是假想故障。
public struct WatchLoggedSet: Codable, Equatable, Sendable {
    /// 手机推过来的 Active.exerciseId，原样带回。
    public let exerciseId: String
    /// 手机推过来的 Active.setNumber（1-based），原样带回。幂等键的另一半。
    public let setNumber: Int
    /// 原样回传手机给的目标重量。**表不重算重量**——器械梯子吸附在手机侧做过了。
    public let weightKg: Double
    /// 表上可改的唯一一项：实际做到的次数。
    public let reps: Int
    /// 原样回传目标 RIR。表上不问 RIR——练的时候没人愿意在手表上选这个。
    public let rir: Double
    /// 表侧记录时刻（ISO8601）。只作日志与排障，手机不拿它做判断——
    /// 两端时钟不保证一致，用它决策就是给自己埋雷。
    public let loggedAtISO: String
    /// 这是热身步的「做完了」而不是一组正式组。
    ///
    /// 复用同一种消息而不另开一种 kind，是为了让**幂等判断只有一处**：
    /// 两者的键都是 exerciseId + setNumber（热身时 setNumber = 热身步序号）。
    /// 手机侧据此分流：热身 → advanceWarmupStep（不落库）；正式组 → apply(.logSet)。
    /// 默认 false，旧版本表发来的消息仍能解出来（向后兼容）。
    public let isWarmup: Bool

    public init(exerciseId: String, setNumber: Int, weightKg: Double,
                reps: Int, rir: Double, loggedAtISO: String, isWarmup: Bool = false) {
        self.exerciseId = exerciseId
        self.setNumber = setNumber
        self.weightKg = weightKg
        self.reps = reps
        self.rir = rir
        self.loggedAtISO = loggedAtISO
        self.isWarmup = isWarmup
    }

    public var encoded: Data? { try? JSONEncoder().encode(self) }

    public init?(decoding data: Data) {
        guard let decoded = try? JSONDecoder().decode(WatchLoggedSet.self, from: data) else { return nil }
        self = decoded
    }
}
