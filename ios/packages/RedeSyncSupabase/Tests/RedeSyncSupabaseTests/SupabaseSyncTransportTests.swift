// SupabaseSyncTransport 合同。
//
// 这些测试全部不碰真网络、真账号、真机——传输层的每一条逻辑（复合游标、401 重试、
// upsert 头、错误分类）都是可在 swift test 里穷举的纯逻辑。这正是当初不引入
// supabase-swift SDK 换来的东西：网络层能被完全 stub。

import Foundation
import XCTest
import RedeDomain
import RedeSync
@testable import RedeSyncSupabase

// MARK: - 按脚本回放的 HTTP stub

private final class StubHTTP: SupabaseHTTPClient, @unchecked Sendable {
    struct Scripted {
        let status: Int
        let body: Data
    }
    private let lock = NSLock()
    private var queue: [Scripted]
    private(set) var sent: [HTTPRequest] = []
    var throwOffline = false

    init(_ replies: [Scripted]) { self.queue = replies }

    convenience init(json: String, status: Int = 200) {
        self.init([Scripted(status: status, body: Data(json.utf8))])
    }

    func send(_ request: HTTPRequest) async throws -> HTTPReply {
        if throwOffline { throw SupabaseTransportFailure.offline }
        return try lock.withLock {
            sent.append(request)
            guard !queue.isEmpty else {
                throw SupabaseTransportFailure.malformed("stub ran out of replies")
            }
            let next = queue.removeFirst()
            return HTTPReply(status: next.status, body: next.body)
        }
    }
}

private let projectURL = URL(string: "https://example.supabase.co")!
private let apiKey = "sb_publishable_test"

private func makeAuth(
    http: SupabaseHTTPClient,
    session: SupabaseSession? = SupabaseSession(
        accessToken: "access-1", refreshToken: "refresh-1",
        expiresAtEpoch: 10_000, userId: "user-abc"
    ),
    now: @escaping @Sendable () -> Double = { 1_000 }
) -> SupabaseAuth {
    SupabaseAuth(
        projectURL: projectURL, apiKey: apiKey, http: http,
        store: InMemorySessionStore(session: session), now: now
    )
}

final class SupabaseSyncTransportTests: XCTestCase {

    // MARK: 复合游标 —— 本文件最重要的一组

    func testCursorRoundTrip() {
        let c = SupabaseSyncTransport.encodeCursor(updatedAt: "2026-08-07T10:00:00Z", sessionId: "session-9")
        let decoded = SupabaseSyncTransport.decodeCursor(c)
        XCTAssertEqual(decoded?.updatedAt, "2026-08-07T10:00:00Z")
        XCTAssertEqual(decoded?.sessionId, "session-9")
    }

    func testCursorRejectsMalformed() {
        XCTAssertNil(SupabaseSyncTransport.decodeCursor("no-separator"))
        XCTAssertNil(SupabaseSyncTransport.decodeCursor("|only-id"))
        XCTAssertNil(SupabaseSyncTransport.decodeCursor("only-ts|"))
    }

    /// 首次登录把上百场历史一次推上去时，这些行的 updated_at 由 now() 盖章、**完全相同**。
    /// 若游标只存时间戳：gt 会一次跳过整批（丢数据），gte 会每页从同一批开始（死循环）。
    /// 这个测试钉住复合游标把第二页正确地从「同一时刻但 id 更大」处接上。
    func testPaginationAdvancesWithinIdenticalTimestamps() async throws {
        let sameTs = "2026-08-07T10:00:00Z"
        let page1 = (1...3).map { rowJSON(sessionId: "session-\($0)", updatedAt: sameTs) }.joined(separator: ",")
        let http = StubHTTP([
            .init(status: 200, body: Data("[\(page1)]".utf8))
        ])
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http,
            auth: makeAuth(http: http), pageSize: 3
        )

        let page = try await transport.fetchSessions(since: nil)

        XCTAssertTrue(page.hasMore, "满页必须报还有更多")
        XCTAssertEqual(page.nextCursor, "\(sameTs)|session-3", "游标要带上最后一条的 id")

        // 第二页：请求里必须出现「时间更晚 或（同一时刻且 id 更大）」
        let http2 = StubHTTP(json: "[]")
        let transport2 = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http2,
            auth: makeAuth(http: http2), pageSize: 3
        )
        _ = try await transport2.fetchSessions(since: page.nextCursor)

        let query = http2.sent.first?.url.query ?? ""
        let decoded = query.removingPercentEncoding ?? query
        XCTAssertTrue(decoded.contains("updated_at.gt.\(sameTs)"), "缺少「时间更晚」分支：\(decoded)")
        XCTAssertTrue(
            decoded.contains("and(updated_at.eq.\(sameTs),session_id.gt.session-3)"),
            "缺少「同刻但 id 更大」分支，同 timestamp 批次会被整批跳过：\(decoded)"
        )
    }

    func testShortPageReportsNoMore() async throws {
        let http = StubHTTP(json: "[\(rowJSON(sessionId: "session-1", updatedAt: "2026-08-07T10:00:00Z"))]")
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http,
            auth: makeAuth(http: http), pageSize: 100
        )
        let page = try await transport.fetchSessions(since: nil)
        XCTAssertFalse(page.hasMore)
        XCTAssertEqual(page.sessions.count, 1)
        XCTAssertEqual(page.sessions.first?.sessionId, "session-1")
        XCTAssertEqual(page.sessions.first?.payload["id"]?.asString, "session-1")
    }

    func testEmptyPageKeepsCursorAndStops() async throws {
        let http = StubHTTP(json: "[]")
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http,
            auth: makeAuth(http: http), pageSize: 100
        )
        let page = try await transport.fetchSessions(since: "2026-08-07T10:00:00Z|session-3")
        XCTAssertFalse(page.hasMore)
        XCTAssertTrue(page.sessions.isEmpty)
        XCTAssertEqual(page.nextCursor, "2026-08-07T10:00:00Z|session-3", "空页不应把游标退回 nil")
    }

    // MARK: 上传

    func testUploadCarriesUserIdAndUpsertHeader() async throws {
        let http = StubHTTP([.init(status: 201, body: Data())])
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )

        try await transport.uploadSessions([
            RemoteSessionRecord(
                sessionId: "session-1", payload: ["id": .string("session-1")],
                schemaVersion: 3, updatedAtIso: "2026-08-07T10:00:00Z", deviceId: "device-A"
            )
        ])

        let req = try XCTUnwrap(http.sent.first)
        XCTAssertEqual(req.method, "POST")
        XCTAssertEqual(
            req.headers["Prefer"], "resolution=merge-duplicates,return=minimal",
            "必须是幂等 upsert —— 网络重试会重复提交同一批"
        )
        let body = try XCTUnwrap(req.body)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [[String: Any]])
        XCTAssertEqual(json.first?["user_id"] as? String, "user-abc",
                       "不带 user_id 会被 RLS 的 with check 整批拒绝")
        XCTAssertNil(json.first?["updated_at"],
                     "updated_at 必须由服务端 trigger 盖章，不信客户端时钟")
    }

    func testEmptyUploadSkipsNetwork() async throws {
        let http = StubHTTP([])
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )
        try await transport.uploadSessions([])
        XCTAssertTrue(http.sent.isEmpty)
    }

    // MARK: 401 重试

    func testUnauthorizedTriggersRefreshThenRetriesOnce() async throws {
        let refreshed = """
        {"access_token":"access-2","refresh_token":"refresh-2","expires_in":3600,"user":{"id":"user-abc"}}
        """
        let http = StubHTTP([
            .init(status: 401, body: Data("{}".utf8)),                     // 首次请求过期
            .init(status: 200, body: Data(refreshed.utf8)),                // 刷新
            .init(status: 200, body: Data("[]".utf8)),                     // 重试成功
        ])
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )

        let page = try await transport.fetchSessions(since: nil)

        XCTAssertTrue(page.sessions.isEmpty)
        XCTAssertEqual(http.sent.count, 3)
        XCTAssertEqual(
            http.sent.last?.headers["Authorization"], "Bearer access-2",
            "重试必须换上刷新后的 token"
        )
    }

    func testStillUnauthorizedAfterRefreshSurfacesAsNotAuthenticated() async {
        let refreshed = """
        {"access_token":"access-2","refresh_token":"refresh-2","expires_in":3600,"user":{"id":"user-abc"}}
        """
        let http = StubHTTP([
            .init(status: 401, body: Data("{}".utf8)),
            .init(status: 200, body: Data(refreshed.utf8)),
            .init(status: 401, body: Data("{}".utf8)),   // 刷新后仍 401
        ])
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )

        do {
            _ = try await transport.fetchSessions(since: nil)
            XCTFail("应抛 notAuthenticated")
        } catch {
            XCTAssertEqual(error as? SyncTransportError, .notAuthenticated)
        }
        XCTAssertEqual(http.sent.count, 3, "只重试一次，不得反复撞限流")
    }

    // MARK: 错误分类

    func testOfflineIsReportedAsOfflineNotRejection() async {
        let http = StubHTTP([])
        http.throwOffline = true
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )
        do {
            _ = try await transport.fetchSessions(since: nil)
            XCTFail("应抛 offline")
        } catch {
            XCTAssertEqual(error as? SyncTransportError, .offline,
                           "离线是可恢复常态，不能和后端拒绝混为一谈")
        }
    }

    func testServerRejectionCarriesMessage() async {
        let http = StubHTTP([
            .init(status: 403, body: Data(#"{"message":"permission denied"}"#.utf8))
        ])
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )
        do {
            _ = try await transport.fetchSessions(since: nil)
            XCTFail("应抛 rejected")
        } catch {
            guard case .rejected(let msg)? = error as? SyncTransportError else {
                return XCTFail("类型不对：\(error)")
            }
            XCTAssertTrue(msg.contains("permission denied"), msg)
        }
    }

    func testMalformedRowsSurfaceAsMalformed() async {
        let http = StubHTTP(json: #"[{"unexpected":1}]"#)
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )
        do {
            _ = try await transport.fetchSessions(since: nil)
            XCTFail("应抛 malformedResponse")
        } catch {
            guard case .malformedResponse? = error as? SyncTransportError else {
                return XCTFail("类型不对：\(error)")
            }
        }
    }

    func testNoSessionSurfacesAsNotAuthenticated() async {
        let http = StubHTTP([])
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http,
            auth: makeAuth(http: http, session: nil)
        )
        do {
            _ = try await transport.fetchSessions(since: nil)
            XCTFail("应抛 notAuthenticated")
        } catch {
            XCTAssertEqual(error as? SyncTransportError, .notAuthenticated)
        }
    }

    // MARK: config

    func testFetchConfigReturnsNilWhenNeverSynced() async throws {
        let http = StubHTTP(json: "[]")
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )
        let config = try await transport.fetchConfig()
        XCTAssertNil(config)
    }

    func testFetchConfigDecodesPayload() async throws {
        let json = """
        [{"payload":{"unitSystem":"metric"},"schema_version":3,"device_id":"device-A",
          "updated_at":"2026-08-07T10:00:00Z"}]
        """
        let http = StubHTTP(json: json)
        let transport = SupabaseSyncTransport(
            projectURL: projectURL, apiKey: apiKey, http: http, auth: makeAuth(http: http)
        )
        let config = try await transport.fetchConfig()
        XCTAssertEqual(config?.payload["unitSystem"]?.asString, "metric")
        XCTAssertEqual(config?.schemaVersion, 3)
        XCTAssertEqual(config?.deviceId, "device-A")
    }

    // MARK: helper

    private func rowJSON(sessionId: String, updatedAt: String) -> String {
        """
        {"session_id":"\(sessionId)","payload":{"id":"\(sessionId)","completed":true},
         "schema_version":3,"device_id":"device-A","updated_at":"\(updatedAt)"}
        """
    }
}
