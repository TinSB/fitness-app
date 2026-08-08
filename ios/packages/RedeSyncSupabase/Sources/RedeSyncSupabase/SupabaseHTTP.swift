// SupabaseHTTP — 网络调用的最小抽象。
//
// 存在的唯一理由是可测：整个传输层的逻辑（token 刷新、401 重试、分页游标、错误分类）
// 都能在 swift test 里穷举，不需要真网络、真账号或真机。生产走 URLSession，
// 测试注入一个按脚本回放的 stub。

import Foundation

/// 一次 HTTP 往返的结果。
public struct HTTPReply: Sendable {
    public let status: Int
    public let body: Data

    public init(status: Int, body: Data) {
        self.status = status
        self.body = body
    }
}

public struct HTTPRequest: Sendable, Equatable {
    public let method: String
    public let url: URL
    public let headers: [String: String]
    public let body: Data?

    public init(method: String, url: URL, headers: [String: String], body: Data?) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
    }
}

public protocol SupabaseHTTPClient: Sendable {
    func send(_ request: HTTPRequest) async throws -> HTTPReply
}

/// 生产实现。把 URLSession 的错误分成「离线」与其它——离线是可恢复的常态，
/// 不该和后端拒绝混为一谈（上层对这两者的处置完全不同）。
public struct URLSessionHTTPClient: SupabaseHTTPClient {
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: HTTPRequest) async throws -> HTTPReply {
        var req = URLRequest(url: request.url)
        req.httpMethod = request.method
        req.httpBody = request.body
        for (k, v) in request.headers { req.setValue(v, forHTTPHeaderField: k) }
        do {
            let (data, response) = try await session.data(for: req)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            return HTTPReply(status: status, body: data)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost,
                 .cannotConnectToHost, .timedOut, .dataNotAllowed, .internationalRoamingOff:
                throw SupabaseTransportFailure.offline
            default:
                throw SupabaseTransportFailure.offline
            }
        }
    }
}

/// 传输层内部错误。会在边界上翻译成 SyncTransportError 再抛给上层。
public enum SupabaseTransportFailure: Error, Equatable {
    case offline
    case unauthorized
    case rejected(status: Int, message: String)
    case malformed(String)
}
