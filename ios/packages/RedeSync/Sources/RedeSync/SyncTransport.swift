// SyncTransport — 同步引擎对后端的**全部**要求。
//
// 这个协议存在的意义是把「后端能力」压缩成一张明确的清单：任何后端只要能做到
// 下面四件事，就能接进来，换后端不影响合并语义和上层编排。反过来，如果某个候选
// 后端做不到其中一条（例如没有可靠的增量游标），那在选型阶段就该被排除，而不是
// 在实现到一半时才发现。
//
// 有意不放进这个协议的东西：
//   · 认证 —— 由实现自己持有会话；同步层只在「已登录」前提下被调用
//   · 重试/退避 —— 由实现处理，因为退避策略和后端的限流语义强相关
//   · 冲突解决 —— 归 SyncMergeEngine，后端不参与判断谁赢

import RedeDomain

/// 一次增量拉取的结果。
public struct SyncFetchPage: Equatable, Sendable {
    public let sessions: [RemoteSessionRecord]
    /// 下次拉取的起点。nil 表示已拉到最新。
    public let nextCursor: String?
    /// 是否还有更多页。分页存在的理由：老用户首次登录新设备要拉几百场记录，
    /// 一次性拉完会超时也会占内存。
    public let hasMore: Bool

    public init(sessions: [RemoteSessionRecord], nextCursor: String?, hasMore: Bool) {
        self.sessions = sessions
        self.nextCursor = nextCursor
        self.hasMore = hasMore
    }
}

public enum SyncTransportError: Error, Equatable {
    /// 未登录或会话过期。上层应停止同步并提示重新登录，**不得**清空本地数据。
    case notAuthenticated
    /// 网络不可达。上层应静默保留待上传队列，下次再试。
    case offline
    /// 后端拒绝（限流、配额、权限）。message 用于日志和排障，不直接展示给用户。
    case rejected(message: String)
    /// 后端返回的数据不符合约定形态。这是 bug 或后端 schema 漂移，必须如实上报。
    case malformedResponse(message: String)
}

/// 后端传输层。实现方负责认证、重试和网络细节；不负责合并判断。
public protocol SyncTransport: Sendable {
    /// 拉取 cursor 之后发生变化的训练记录。cursor 为 nil 时从头拉。
    func fetchSessions(since cursor: String?) async throws -> SyncFetchPage

    /// 拉取该用户的配置记录。用户还没同步过配置时返回 nil。
    func fetchConfig() async throws -> RemoteConfigRecord?

    /// 上传训练记录。必须是幂等的 upsert（按 sessionId）——网络重试会重复提交同一批。
    func uploadSessions(_ records: [RemoteSessionRecord]) async throws

    /// 上传配置记录（整块覆盖该用户的配置行）。
    func uploadConfig(_ record: RemoteConfigRecord) async throws
}
