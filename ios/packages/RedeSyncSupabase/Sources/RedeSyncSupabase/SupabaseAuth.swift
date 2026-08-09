// SupabaseAuth — 登录态的持有者与刷新者。
//
// 为什么是 actor：Supabase 的 refresh token 是**一次性轮换**的——用它换到新 access token
// 的同时会得到一个新的 refresh token，旧的立即作废。如果两个并发请求同时发现 token 过期
// 并各自去刷新，第二个会拿着已作废的 token 撞上 401，结果是用户被莫名其妙登出。
// actor 把刷新串行化，后到的请求会看到前一个刷完的结果，不会重复刷。

import Foundation

public enum SupabaseAuthError: Error, Equatable {
    /// 没有会话，或 refresh token 已失效。上层必须提示重新登录，**不得清空本地数据**。
    case notSignedIn
    case offline
    case rejected(message: String)
    case malformed(String)
}

public actor SupabaseAuth {
    private let projectURL: URL
    private let apiKey: String
    private let http: any SupabaseHTTPClient
    private let store: any SupabaseSessionStoring
    private let now: @Sendable () -> Double

    public init(
        projectURL: URL,
        apiKey: String,
        http: any SupabaseHTTPClient,
        store: any SupabaseSessionStoring,
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 }
    ) {
        self.projectURL = projectURL
        self.apiKey = apiKey
        self.http = http
        self.store = store
        self.now = now
    }

    public var isSignedIn: Bool { store.load() != nil }
    public var userId: String? { store.load()?.userId }

    /// 用 Sign in with Apple 拿到的 identity token 换 Supabase 会话。
    ///
    /// - Parameters:
    ///   - identityToken: `ASAuthorizationAppleIDCredential.identityToken` 的 UTF-8 字符串。
    ///   - rawNonce: 发起授权时用的**原始**（未哈希）nonce。Apple 的 token 里带的是它的
    ///     SHA256，Supabase 拿原始值去比对。传错这个会得到一个语焉不详的 400。
    @discardableResult
    public func signInWithApple(identityToken: String, rawNonce: String?) async throws -> SupabaseSession {
        var body: [String: String] = ["provider": "apple", "id_token": identityToken]
        if let rawNonce { body["nonce"] = rawNonce }
        let session = try await requestToken(grantType: "id_token", body: body)
        store.save(session)
        return session
    }

    /// 返回可用的 access token，过期则先刷新。这是传输层拿凭据的唯一入口。
    public func validAccessToken() async throws -> String {
        guard let session = store.load() else { throw SupabaseAuthError.notSignedIn }
        if !session.isExpired(now: now()) { return session.accessToken }
        let refreshed = try await refresh(using: session.refreshToken)
        return refreshed.accessToken
    }

    /// 强制刷新一次（传输层撞上 401 时调用）。
    @discardableResult
    public func forceRefresh() async throws -> String {
        guard let session = store.load() else { throw SupabaseAuthError.notSignedIn }
        return try await refresh(using: session.refreshToken).accessToken
    }

    private func refresh(using refreshToken: String) async throws -> SupabaseSession {
        do {
            let session = try await requestToken(
                grantType: "refresh_token",
                body: ["refresh_token": refreshToken]
            )
            store.save(session)
            return session
        } catch SupabaseAuthError.rejected {
            // refresh token 被拒 = 它已失效（用户在别处登出、或被轮换掉）。
            // 清掉本地会话；**本地训练数据一行不动**。
            //
            // 这里必须抛 notSignedIn 而不是把后端原话透传成 rejected：语义是
            // 「要重新登录」，而 rejected 在上层会渲染成「云端拒绝了这次同步」——
            // 用户读完不知道该干什么，只会反复点重试。排障信息的价值低于让用户
            // 知道下一步该做什么。
            store.clear()
            throw SupabaseAuthError.notSignedIn
        }
    }

    /// 登出。只断开云端关联——本地 canonical 由调用方负责保持不动。
    public func signOut() {
        store.clear()
    }

    /// 删除云端账号。走 schema 里的 security definer 函数，
    /// 这样客户端不需要 service role key（那个 key 绝不能进 App）。
    public func deleteAccount() async throws {
        let token = try await validAccessToken()
        let url = projectURL.appendingPathComponent("rest/v1/rpc/delete_own_account")
        let reply = try await http.send(HTTPRequest(
            method: "POST",
            url: url,
            headers: [
                "apikey": apiKey,
                "Authorization": "Bearer \(token)",
                "Content-Type": "application/json",
            ],
            body: Data("{}".utf8)
        ))
        guard (200..<300).contains(reply.status) else {
            throw SupabaseAuthError.rejected(message: Self.errorMessage(from: reply))
        }
        store.clear()
    }

    // MARK: - GoTrue token 端点

    private func requestToken(grantType: String, body: [String: String]) async throws -> SupabaseSession {
        var components = URLComponents(
            url: projectURL.appendingPathComponent("auth/v1/token"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "grant_type", value: grantType)]
        guard let url = components?.url else { throw SupabaseAuthError.malformed("bad token url") }

        let payload = try JSONSerialization.data(withJSONObject: body)
        let reply: HTTPReply
        do {
            reply = try await http.send(HTTPRequest(
                method: "POST",
                url: url,
                headers: ["apikey": apiKey, "Content-Type": "application/json"],
                body: payload
            ))
        } catch SupabaseTransportFailure.offline {
            throw SupabaseAuthError.offline
        }

        guard (200..<300).contains(reply.status) else {
            throw SupabaseAuthError.rejected(message: Self.errorMessage(from: reply))
        }
        return try Self.parseSession(reply.body, now: now())
    }

    static func parseSession(_ data: Data, now: Double) throws -> SupabaseSession {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw SupabaseAuthError.malformed("token response is not an object")
        }
        guard let access = root["access_token"] as? String, !access.isEmpty else {
            throw SupabaseAuthError.malformed("missing access_token")
        }
        guard let refresh = root["refresh_token"] as? String, !refresh.isEmpty else {
            throw SupabaseAuthError.malformed("missing refresh_token")
        }
        guard let user = root["user"] as? [String: Any], let uid = user["id"] as? String, !uid.isEmpty else {
            throw SupabaseAuthError.malformed("missing user.id")
        }
        // expires_in 缺失时按 1 小时算——宁可早刷一次，也不要拿着过期 token 反复撞 401。
        let expiresIn = (root["expires_in"] as? Double) ?? 3600
        return SupabaseSession(
            accessToken: access,
            refreshToken: refresh,
            expiresAtEpoch: now + expiresIn,
            userId: uid
        )
    }

    static func errorMessage(from reply: HTTPReply) -> String {
        guard let root = try? JSONSerialization.jsonObject(with: reply.body) as? [String: Any] else {
            return "HTTP \(reply.status)"
        }
        let text = (root["error_description"] as? String)
            ?? (root["msg"] as? String)
            ?? (root["message"] as? String)
            ?? (root["error"] as? String)
        return text.map { "HTTP \(reply.status): \($0)" } ?? "HTTP \(reply.status)"
    }
}
