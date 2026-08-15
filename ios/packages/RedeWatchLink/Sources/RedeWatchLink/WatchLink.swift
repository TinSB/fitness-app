import Foundation

// WatchConnectivity 只在 iOS / watchOS 存在。用 canImport 隔开的好处是
// `swift test`（跑在 macOS 上）仍能编译并执行信封那层的纯单测——
// 那才是这个包里唯一可单测的部分；WCSession 那层要配对设备，属于实跑验收。
#if canImport(WatchConnectivity)
import WatchConnectivity

// WCSession 包装（切片 2）。手机与表**共用这一个实现**，只有 iOS 独有的两个
// 生命周期回调用 #if 隔开。
//
// 为什么不各写一份：WatchConnectivity 的坑几乎全在生命周期和线程上
//（delegate 回调在后台队列、session 会被系统重新激活、iOS 侧还要处理切表）。
// 两端各踩一遍是浪费。

@MainActor
public final class WatchLink: NSObject, ObservableObject {
    public static let shared = WatchLink()

    /// 对端此刻是否可达（sendMessage 能不能立即送到）。
    /// applicationContext / transferUserInfo **不需要**它为 true——那正是选它们的理由。
    @Published public private(set) var isReachable = false
    @Published public private(set) var isActivated = false
    /// 切片 2 的可见性手段：收发都记一行，两端各自能看见。
    /// 这是调试脚手架，不是产品能力——切片 4 之后应当收敛。
    @Published public private(set) var log: [String] = []

    private var session: WCSession? { WCSession.isSupported() ? .default : nil }

    /// 对端**存在**吗（区别于 isReachable 的「此刻能不能立即送到」）。
    ///
    /// 绝大多数用户没有 Apple Watch。不判这个，今日页每加载一次就往空处推一次，
    /// 系统每次回一条 WCErrorCodeDeviceNotPaired——白做功，还把测试日志刷满、
    /// 真错误反而看不见（2026-08-15 门禁日志里抓到）。
    public var hasCounterpart: Bool {
        guard let session else { return false }
        #if os(iOS)
        return session.isPaired && session.isWatchAppInstalled
        #else
        return session.isCompanionAppInstalled
        #endif
    }

    public var onReceive: ((WatchLinkEnvelope, WatchLinkChannel) -> Void)?

    private override init() { super.init() }

    public func activate() {
        guard let session else { append("WCSession 不受支持"); return }
        session.delegate = self
        session.activate()
        append("activate 已请求")
    }

    // MARK: - 发送

    /// 按通道纪律发送。**通道由调用方按语义选**，不在这里替它决定——
    /// 这个选择是有后果的（记组用错通道会静默丢数据），必须在调用点看得见。
    public func send(_ envelope: WatchLinkEnvelope, via channel: WatchLinkChannel) {
        guard let session, session.activationState == .activated else {
            append("发送失败：session 未激活 [\(envelope.kind)]")
            return
        }
        // 没有对端就别发。放在这里而不是各调用点：漏一处就是一条静默的失败日志。
        guard hasCounterpart else { return }
        switch channel {
        case .applicationContext:
            do {
                try session.updateApplicationContext(envelope.dictionary)
                append("→ \(envelope.kind) (context)")
            } catch {
                append("→ \(envelope.kind) (context) 失败：\(error.localizedDescription)")
            }
        case .userInfo:
            session.transferUserInfo(envelope.dictionary)
            append("→ \(envelope.kind) (userInfo 已排队)")
        case .message:
            guard session.isReachable else {
                append("→ \(envelope.kind) (message) 跳过：对端不可达")
                return
            }
            session.sendMessage(envelope.dictionary, replyHandler: nil) { [weak self] error in
                Task { @MainActor in self?.append("→ \(envelope.kind) (message) 失败：\(error.localizedDescription)") }
            }
            append("→ \(envelope.kind) (message)")
        }
    }

    // MARK: - 内部

    private func append(_ line: String) {
        let ts = ISO8601DateFormatter().string(from: Date()).suffix(14).prefix(8)
        log.append("\(ts) \(line)")
        if log.count > 40 { log.removeFirst(log.count - 40) }
    }

    /// delegate 回调都在后台队列。**统一在这里跳回 MainActor**，
    /// 而不是让每个回调各自处理——漏一个就是数据竞争。
    fileprivate nonisolated func receive(_ dict: [String: Any], _ channel: WatchLinkChannel) {
        Task { @MainActor in
            guard let envelope = WatchLinkEnvelope(dictionary: dict) else {
                self.append("← 丢弃：信封不完整")
                return
            }
            self.append("← \(envelope.kind) (\(channel.rawValue))")
            self.onReceive?(envelope, channel)
        }
    }

    fileprivate nonisolated func note(_ line: String) {
        Task { @MainActor in self.append(line) }
    }

    fileprivate nonisolated func syncState(activated: Bool, reachable: Bool) {
        Task { @MainActor in
            self.isActivated = activated
            self.isReachable = reachable
        }
    }
}

extension WatchLink: WCSessionDelegate {
    public nonisolated func session(_ session: WCSession,
                                    activationDidCompleteWith state: WCSessionActivationState,
                                    error: Error?) {
        if let error {
            note("激活失败：\(error.localizedDescription)")
        } else {
            note("已激活（state=\(state.rawValue)）")
        }
        syncState(activated: state == .activated, reachable: session.isReachable)

        // **启动时必须主动读一次已存的 applicationContext。**
        // didReceiveApplicationContext 只在**新**一份到达时触发，系统不会在 app 启动时重放；
        // 而 receivedApplicationContext 是系统替我们持久化的那一份，重启后依然在。
        // 不读它 = 表一重启就变空白，直到手机再推一次——而手机锁在柜子里正是表最该有用的时候。
        //（2026-08-15 实测抓获：杀掉手机 app 后重开表 app，处方消失。）
        guard state == .activated else { return }
        let stored = session.receivedApplicationContext
        if !stored.isEmpty { receive(stored, .applicationContext) }
    }

    public nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        note("可达性变化：\(session.isReachable)")
        syncState(activated: session.activationState == .activated, reachable: session.isReachable)
    }

    public nonisolated func session(_ session: WCSession, didReceiveApplicationContext ctx: [String: Any]) {
        receive(ctx, .applicationContext)
    }

    public nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        receive(userInfo, .userInfo)
    }

    public nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        receive(message, .message)
    }

    /// **必须实现**。transferUserInfo 是排队通道，投递发生在调用之后——
    /// 不实现这个回调，失败就是静默的：系统只会在 os_log 里嘀咕一句
    /// 「delegate does not implement session:didFinishUserInfoTransfer:error:」，
    /// 而 app 侧一无所知。切片 4 要用这条通道送完成的组，丢一组就是丢数据，
    /// 没有投递结果等于没有保证。（切片 2 实测抓获：pong 排队后出错，日志里查不出原因。）
    public nonisolated func session(_ session: WCSession,
                                    didFinish transfer: WCSessionUserInfoTransfer,
                                    error: Error?) {
        let kind = (transfer.userInfo["k"] as? String) ?? "?"
        if let error {
            note("✗ \(kind) (userInfo) 投递失败：\(error.localizedDescription)")
        } else {
            note("✓ \(kind) (userInfo) 已送达")
        }
    }

    #if os(iOS)
    // iOS 独有：用户切换配对的表时，session 会先失活再重新激活。
    // 不实现这两个回调，切表之后通道就是死的。
    public nonisolated func sessionDidBecomeInactive(_ session: WCSession) {
        note("session 失活（多为切换配对设备）")
    }

    public nonisolated func sessionDidDeactivate(_ session: WCSession) {
        note("session 已停用，重新激活")
        session.activate()
    }
    #endif
}
#endif
