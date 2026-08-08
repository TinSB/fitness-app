// SupabaseSession — 登录态，以及它该被存在哪。

import Foundation
#if canImport(Security)
import Security
#endif

public struct SupabaseSession: Codable, Equatable, Sendable {
    /// 短期凭据，默认 1 小时过期。
    public let accessToken: String
    /// 长期凭据，用来换新的 accessToken。**这是本 App 最敏感的一个字符串。**
    public let refreshToken: String
    /// accessToken 过期时刻（Unix 秒）。
    public let expiresAtEpoch: Double
    /// Supabase 的用户 uuid，等于两张表的 user_id。
    public let userId: String

    public init(accessToken: String, refreshToken: String, expiresAtEpoch: Double, userId: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAtEpoch = expiresAtEpoch
        self.userId = userId
    }

    /// 留 60 秒余量：正好卡在过期瞬间发出的请求会白跑一次 401。
    public func isExpired(now: Double) -> Bool {
        now >= expiresAtEpoch - 60
    }
}

public protocol SupabaseSessionStoring: Sendable {
    func load() -> SupabaseSession?
    func save(_ session: SupabaseSession)
    func clear()
}

/// 测试与预览用。绝不可用于生产——refreshToken 留在内存里进程一死就没了，
/// 更重要的是它不该被当成「反正也能用」的省事选项。
public final class InMemorySessionStore: SupabaseSessionStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var session: SupabaseSession?

    public init(session: SupabaseSession? = nil) { self.session = session }

    public func load() -> SupabaseSession? { lock.withLock { session } }
    public func save(_ s: SupabaseSession) { lock.withLock { session = s } }
    public func clear() { lock.withLock { session = nil } }
}

#if canImport(Security)
/// 生产存储。
///
/// 两个刻意的选择：
/// ① `AfterFirstUnlock` 而非 `WhenUnlocked` —— 后台同步可能在锁屏时触发，
///    用 WhenUnlocked 会让它在口袋里静默失败。
/// ② `ThisDeviceOnly` —— 认证凭据不进 iCloud 钥匙串、不进设备备份。换机时用户
///    重新按一下 Sign in with Apple 即可（一次点击），不值得为省这一下把长期
///    凭据复制到别处。
public struct KeychainSessionStore: SupabaseSessionStoring {
    private let service: String
    private let account: String

    public init(service: String = "fit.rede.sync", account: String = "supabase-session") {
        self.service = service
        self.account = account
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    public func load() -> SupabaseSession? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(SupabaseSession.self, from: data)
    }

    public func save(_ session: SupabaseSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        // 先删后写：SecItemUpdate 在条目不存在时失败，两步反而比分支判断更难写错。
        SecItemDelete(baseQuery as CFDictionary)
        var query = baseQuery
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    public func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}
#endif
