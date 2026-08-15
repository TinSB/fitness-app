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

    /// 最后一份 applicationContext（不论发成功没有）。
    ///
    /// 记「最后一份」而不是只记「没发出去的」，是因为要同时补两个洞：
    /// · 激活前推的那份会被 guard 拦掉（真机实拍的那个缺陷）
    /// · **表 app 重装后它那份存档就没了**——装新 TestFlight 必然发生。
    ///   这时手机侧早就激活过、也早就发成功过，只记 pending 的话没东西可补。
    /// 只留一份，不攒队列：它本来就是「最新状态」语义。
    private var latestContext: WatchLinkEnvelope?

    /// 重发最后一份 context。激活完成、手表状态变化（含刚装好 app）时各调一次。
    /// 内容没变时重发是无害的——表侧激活时会主动读 receivedApplicationContext。
    private func resendLatestContext() {
        guard let latest = latestContext else { return }
        guard let session, session.activationState == .activated, hasCounterpart else { return }
        do {
            try session.updateApplicationContext(latest.dictionary)
            append("→ \(latest.kind) (context 补发)")
        } catch {
            append("→ \(latest.kind) (context 补发) 失败：\(error.localizedDescription)")
        }
    }

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
        // applicationContext 是「最新状态」，不是队列——所以还没激活时**不能丢**，
        // 要留住最后一份等激活后补发。
        //
        // 这不是防御性补丁，是真机上抓到的缺陷（2026-08-15，owner 手表实拍）：
        // activate() 是异步的，调用后 activationState 还不是 .activated，
        // 而 isPaired 按 Apple 文档「只有激活后才有效」。App 启动时 loadToday 推的
        // 那一份同时撞上这两道 guard 被丢，之后没有任何东西会重推——
        // 表上就永远停在「正在取计划」。模拟器上没暴露，是因为我在反复重启/切单位/
        // 开训，每次都重推了一遍。
        guard let session, session.activationState == .activated, hasCounterpart else {
            if channel == .applicationContext {
                latestContext = envelope
                append("⏸ \(envelope.kind) 暂存（等激活）")
            } else {
                append("发送失败：session 未就绪 [\(envelope.kind)]")
            }
            return
        }
        switch channel {
        case .applicationContext:
            latestContext = envelope   // 记下来，表 app 重装后要靠它补
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

        // 激活前攒下的那份现在才发得出去。手机侧的第一份处方就走这条路。
        Task { @MainActor in self.resendLatestContext() }
    }

    #if os(iOS)
    /// 手表配对状态变化——**用户刚在手表上装好 app** 就走这里。
    /// 此前 isWatchAppInstalled 是 false，处方被拦在 hasCounterpart 那道 guard 外；
    /// 装好的这一刻必须补发，否则用户得重启手机 app 才能看到计划。
    public nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        note("手表状态变化（paired=\(session.isPaired) installed=\(session.isWatchAppInstalled)）")
        Task { @MainActor in self.resendLatestContext() }
    }
    #endif

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
