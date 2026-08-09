// SupabaseSyncTransport — SyncTransport 的 PostgREST 实现。

import Foundation
import RedeDomain
import RedeSync

public struct SupabaseSyncTransport: SyncTransport {
    private let projectURL: URL
    private let apiKey: String
    private let http: any SupabaseHTTPClient
    private let auth: SupabaseAuth
    private let pageSize: Int

    public init(
        projectURL: URL,
        apiKey: String,
        http: any SupabaseHTTPClient,
        auth: SupabaseAuth,
        pageSize: Int = 100
    ) {
        self.projectURL = projectURL
        self.apiKey = apiKey
        self.http = http
        self.auth = auth
        self.pageSize = pageSize
    }

    // MARK: - 游标
    //
    // 游标是 `updated_at|session_id` 的复合值，不是单纯的时间戳。
    //
    // 原因（会真的丢数据，不是洁癖）：`updated_at` 由 Postgres 的 now() 盖章，而 now()
    // 在**同一个事务里对所有行返回相同值**。首次登录把本机 128 场历史一次推上去时，
    // 这 128 行的 updated_at 完全相同。若游标只存时间戳：用 `gt` 会一次跳过全部同刻记录，
    // 用 `gte` 则每页都从同一批开始 —— 前者丢数据，后者死循环。
    // 复合游标按 (updated_at, session_id) 全序推进，两种病都不会犯。

    static func encodeCursor(updatedAt: String, sessionId: String) -> String {
        "\(updatedAt)|\(sessionId)"
    }

    static func decodeCursor(_ cursor: String) -> (updatedAt: String, sessionId: String)? {
        guard let sep = cursor.firstIndex(of: "|") else { return nil }
        let ts = String(cursor[cursor.startIndex..<sep])
        let sid = String(cursor[cursor.index(after: sep)...])
        guard !ts.isEmpty, !sid.isEmpty else { return nil }
        return (ts, sid)
    }

    // MARK: - SyncTransport

    public func fetchSessions(since cursor: String?) async throws -> SyncFetchPage {
        var items = [
            URLQueryItem(name: "select", value: "session_id,payload,schema_version,device_id,updated_at"),
            URLQueryItem(name: "order", value: "updated_at.asc,session_id.asc"),
            URLQueryItem(name: "limit", value: String(pageSize)),
        ]
        if let cursor, let (ts, sid) = Self.decodeCursor(cursor) {
            // 「时间更晚」或「同一时刻但 id 更大」——PostgREST 的 or 语法。
            items.append(URLQueryItem(
                name: "or",
                value: "(updated_at.gt.\(ts),and(updated_at.eq.\(ts),session_id.gt.\(sid)))"
            ))
        }
        let data = try await get(path: "rest/v1/training_sessions", query: items)

        let rows: [SessionRow]
        do {
            rows = try JSONDecoder().decode([SessionRow].self, from: data)
        } catch {
            throw SyncTransportError.malformedResponse(message: "training_sessions: \(error)")
        }
        let records = rows.map { row in
            RemoteSessionRecord(
                sessionId: row.session_id,
                payload: row.payload.asObject ?? [:],
                schemaVersion: row.schema_version,
                updatedAtIso: row.updated_at ?? "",
                deviceId: row.device_id
            )
        }
        let next = rows.last.map { Self.encodeCursor(updatedAt: $0.updated_at ?? "", sessionId: $0.session_id) }
        return SyncFetchPage(
            sessions: records,
            nextCursor: next ?? cursor,
            hasMore: rows.count >= pageSize
        )
    }

    public func fetchConfig() async throws -> RemoteConfigRecord? {
        let data = try await get(path: "rest/v1/user_config", query: [
            URLQueryItem(name: "select", value: "payload,schema_version,device_id,updated_at"),
            URLQueryItem(name: "limit", value: "1"),
        ])
        let rows: [ConfigRow]
        do {
            rows = try JSONDecoder().decode([ConfigRow].self, from: data)
        } catch {
            throw SyncTransportError.malformedResponse(message: "user_config: \(error)")
        }
        guard let row = rows.first else { return nil }
        return RemoteConfigRecord(
            payload: row.payload.asObject ?? [:],
            schemaVersion: row.schema_version,
            updatedAtIso: row.updated_at ?? "",
            deviceId: row.device_id
        )
    }

    public func uploadSessions(_ records: [RemoteSessionRecord]) async throws {
        guard !records.isEmpty else { return }
        let uid = try await requireUserId()
        // user_id 必须显式带上：RLS 的 with check 比对 auth.uid() = user_id，
        // 不带就是 null，整批被拒。
        // updated_at 有意不带 —— 由服务端 trigger 盖章，不信客户端时钟。
        let rows = records.map { r in
            SessionUpload(
                user_id: uid,
                session_id: r.sessionId,
                payload: .object(r.payload),
                schema_version: r.schemaVersion,
                device_id: r.deviceId
            )
        }
        try await upsert(path: "rest/v1/training_sessions", body: rows)
    }

    public func uploadConfig(_ record: RemoteConfigRecord) async throws {
        let uid = try await requireUserId()
        let row = ConfigUpload(
            user_id: uid,
            payload: .object(record.payload),
            schema_version: record.schemaVersion,
            device_id: record.deviceId
        )
        try await upsert(path: "rest/v1/user_config", body: [row])
    }

    // MARK: - HTTP

    private func requireUserId() async throws -> String {
        guard let uid = await auth.userId else { throw SyncTransportError.notAuthenticated }
        return uid
    }

    /// query 值的编码字符集：在标准 urlQueryAllowed 基础上**移掉 `+`**。
    ///
    /// 真机实证（2026-08-08 TestFlight，1.10.0 首个 build）：Postgres 的 timestamptz
    /// 序列化成 `2026-08-08T21:50:15.952823+00:00`，而 `URLComponents.queryItems`
    /// **不会**编码 `+`（它在 query 里是合法字符）。服务端按表单规则把 `+` 解成空格，
    /// 时间戳变成 `...952823 00:00` → `HTTP 400 invalid input syntax for type
    /// timestamp with time zone`。首次同步 cursor 为 nil、不带该条件所以能成功，
    /// 之后每次必失败——「第一次成功后面全挂」正是这个形状。
    ///
    /// 逗号与括号保留不编码：PostgREST 的 `or=(a.gt.x,and(...))` 语法要用到它们。
    private static let queryValueAllowed: CharacterSet = {
        var set = CharacterSet.urlQueryAllowed
        set.remove(charactersIn: "+&=?#")
        return set
    }()

    private func get(path: String, query: [URLQueryItem]) async throws -> Data {
        var components = URLComponents(
            url: projectURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )
        // 自己控制百分号编码——交给 queryItems 会漏掉 `+`（见上）。
        components?.percentEncodedQueryItems = query.map { item in
            URLQueryItem(
                name: item.name,
                value: item.value?.addingPercentEncoding(withAllowedCharacters: Self.queryValueAllowed)
            )
        }
        guard let url = components?.url else {
            throw SyncTransportError.malformedResponse(message: "bad url for \(path)")
        }
        return try await authorized { token in
            HTTPRequest(
                method: "GET",
                url: url,
                headers: ["apikey": apiKey, "Authorization": "Bearer \(token)"],
                body: nil
            )
        }
    }

    private func upsert<T: Encodable>(path: String, body: [T]) async throws {
        let payload: Data
        do {
            payload = try JSONEncoder().encode(body)
        } catch {
            throw SyncTransportError.malformedResponse(message: "encode \(path): \(error)")
        }
        let url = projectURL.appendingPathComponent(path)
        _ = try await authorized { token in
            HTTPRequest(
                method: "POST",
                url: url,
                headers: [
                    "apikey": apiKey,
                    "Authorization": "Bearer \(token)",
                    "Content-Type": "application/json",
                    // 幂等 upsert：同 (user_id, session_id) 重传更新而非报冲突。
                    // 网络重试会重复提交同一批，这是协议明写的要求。
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                ],
                body: payload
            )
        }
    }

    /// 带一次 401 重试的请求。
    ///
    /// 只重试一次：如果刷新完还是 401，那就是真的没登录（refresh token 也失效了），
    /// 继续重试只会把 GoTrue 的限流撞出来。
    private func authorized(_ build: (String) -> HTTPRequest) async throws -> Data {
        let token: String
        do {
            token = try await auth.validAccessToken()
        } catch SupabaseAuthError.notSignedIn {
            throw SyncTransportError.notAuthenticated
        } catch SupabaseAuthError.offline {
            throw SyncTransportError.offline
        } catch {
            throw SyncTransportError.rejected(message: String(describing: error))
        }

        let first: HTTPReply
        do {
            first = try await http.send(build(token))
        } catch SupabaseTransportFailure.offline {
            throw SyncTransportError.offline
        }
        if first.status != 401 {
            return try Self.unwrap(first)
        }

        let refreshed: String
        do {
            refreshed = try await auth.forceRefresh()
        } catch SupabaseAuthError.offline {
            // 刷新时断网 ≠ 登录失效。一律报 notAuthenticated 会让用户白白重登一次，
            // 而他要做的只是等网络回来。
            throw SyncTransportError.offline
        } catch {
            throw SyncTransportError.notAuthenticated
        }
        let second: HTTPReply
        do {
            second = try await http.send(build(refreshed))
        } catch SupabaseTransportFailure.offline {
            throw SyncTransportError.offline
        }
        if second.status == 401 { throw SyncTransportError.notAuthenticated }
        return try Self.unwrap(second)
    }

    static func unwrap(_ reply: HTTPReply) throws -> Data {
        guard (200..<300).contains(reply.status) else {
            throw SyncTransportError.rejected(message: SupabaseAuth.errorMessage(from: reply))
        }
        return reply.body
    }

    // MARK: - 行形态

    private struct SessionRow: Decodable {
        let session_id: String
        let payload: JSONValue
        let schema_version: Int
        let device_id: String
        let updated_at: String?
    }

    private struct ConfigRow: Decodable {
        let payload: JSONValue
        let schema_version: Int
        let device_id: String
        let updated_at: String?
    }

    private struct SessionUpload: Encodable {
        let user_id: String
        let session_id: String
        let payload: JSONValue
        let schema_version: Int
        let device_id: String
    }

    private struct ConfigUpload: Encodable {
        let user_id: String
        let payload: JSONValue
        let schema_version: Int
        let device_id: String
    }
}
