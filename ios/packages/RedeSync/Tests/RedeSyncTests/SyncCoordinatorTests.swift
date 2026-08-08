// 编排层验证。重点不是「happy path 能跑通」，而是**失败路径不丢数据**：
// 写盘失败后游标不能推进、上传失败不能回滚已写回的本地记录、schema 阻塞时不能
// 报告「同步完成」。

import XCTest
import RedeDomain
@testable import RedeSync

private let schema = 11

private func sessionPayload(_ id: String, date: String) -> [String: JSONValue] {
    ["id": .string(id), "date": .string(date), "completed": .bool(true)]
}

private func remote(_ id: String, date: String, schemaVersion: Int = schema) -> RemoteSessionRecord {
    RemoteSessionRecord(
        sessionId: id,
        payload: sessionPayload(id, date: date),
        schemaVersion: schemaVersion,
        updatedAtIso: "2026-01-01T00:00:00Z",
        deviceId: "device-B"
    )
}

// MARK: - Fakes

private actor FakeTransport: SyncTransport {
    var pages: [SyncFetchPage]
    var config: RemoteConfigRecord?
    var fetchError: SyncTransportError?
    var uploadError: SyncTransportError?

    private(set) var uploadedSessions: [RemoteSessionRecord] = []
    private(set) var uploadedConfigs: [RemoteConfigRecord] = []
    private(set) var fetchCallCount = 0

    init(pages: [SyncFetchPage], config: RemoteConfigRecord? = nil) {
        self.pages = pages
        self.config = config
    }

    func setFetchError(_ error: SyncTransportError?) { fetchError = error }
    func setUploadError(_ error: SyncTransportError?) { uploadError = error }

    func fetchSessions(since cursor: String?) async throws -> SyncFetchPage {
        if let fetchError { throw fetchError }
        fetchCallCount += 1
        guard !pages.isEmpty else {
            return SyncFetchPage(sessions: [], nextCursor: cursor, hasMore: false)
        }
        return pages.removeFirst()
    }

    func fetchConfig() async throws -> RemoteConfigRecord? {
        if let fetchError { throw fetchError }
        return config
    }

    func uploadSessions(_ records: [RemoteSessionRecord]) async throws {
        if let uploadError { throw uploadError }
        uploadedSessions.append(contentsOf: records)
    }

    func uploadConfig(_ record: RemoteConfigRecord) async throws {
        if let uploadError { throw uploadError }
        uploadedConfigs.append(record)
    }
}

private struct FakeStoreError: Error {}

private actor FakeLocalStore: SyncLocalStore {
    private(set) var storage: [String: JSONValue]
    private(set) var cursor: String?
    private(set) var configUpdatedAt: String
    private(set) var applyCallCount = 0
    private(set) var configUploadedAt: String?
    var applyShouldFail = false

    init(history: [[String: JSONValue]], config: [String: JSONValue] = [:], configUpdatedAt: String = "2026-01-01T00:00:00Z") {
        var root: [String: JSONValue] = [
            "schemaVersion": .int(Int64(schema)),
            "history": .array(history.map { .object($0) })
        ]
        for (key, value) in config { root[key] = value }
        self.storage = root
        self.configUpdatedAt = configUpdatedAt
    }

    func setApplyShouldFail(_ value: Bool) { applyShouldFail = value }

    func loadStorage() async throws -> (storage: [String: JSONValue], schemaVersion: Int) {
        (storage, schema)
    }

    func applyMerged(_ merged: [String: JSONValue]) async throws {
        applyCallCount += 1
        if applyShouldFail { throw FakeStoreError() }
        storage = merged
    }

    func loadCursor() async -> String? { cursor }
    func saveCursor(_ value: String?) async { cursor = value }
    func configUpdatedAtIso() async -> String { configUpdatedAt }
    func markConfigUploaded(at iso: String) async { configUploadedAt = iso }

    var historyIds: [String] {
        (storage["history"]?.asArray ?? []).compactMap { $0.asObject?["id"]?.asString }
    }
}

private func makeCoordinator(
    transport: FakeTransport,
    store: FakeLocalStore,
    deviceId: String = "device-A"
) -> SyncCoordinator {
    SyncCoordinator(
        transport: transport,
        localStore: store,
        deviceId: deviceId,
        now: { "2026-08-07T00:00:00Z" }
    )
}

// MARK: - Tests

final class SyncCoordinatorTests: XCTestCase {

    func testFullRoundPullsMergesAndUploads() async throws {
        let store = FakeLocalStore(history: [sessionPayload("session-local", date: "2026-01-01")])
        let transport = FakeTransport(pages: [
            SyncFetchPage(sessions: [remote("session-remote", date: "2026-02-01")], nextCursor: "c1", hasMore: false)
        ])
        let coordinator = makeCoordinator(transport: transport, store: store)

        let report = try await coordinator.syncOnce()

        XCTAssertEqual(report.pulledSessionCount, 1)
        XCTAssertEqual(report.uploadedSessionCount, 1)
        XCTAssertTrue(report.isComplete)
        let ids = await store.historyIds
        XCTAssertEqual(ids, ["session-local", "session-remote"])
        let uploaded = await transport.uploadedSessions.map(\.sessionId)
        XCTAssertEqual(uploaded, ["session-local"], "只上传远端没有的那条")
        let savedCursor = await store.cursor
        XCTAssertEqual(savedCursor, "c1")
    }

    func testNoChangesSkipsDiskWrite() async throws {
        // 每次写盘都会产生一个备份文件且过写闸校验。没有变化时必须完全不写盘，
        // 否则后台定时同步会持续堆积备份文件。
        let store = FakeLocalStore(history: [sessionPayload("session-1", date: "2026-01-01")])
        let transport = FakeTransport(pages: [
            SyncFetchPage(sessions: [remote("session-1", date: "2026-01-01")], nextCursor: nil, hasMore: false)
        ])
        let coordinator = makeCoordinator(transport: transport, store: store)

        let report = try await coordinator.syncOnce()

        XCTAssertFalse(report.didChangeLocal)
        let applyCount = await store.applyCallCount
        XCTAssertEqual(applyCount, 0)
    }

    func testCursorDoesNotAdvanceWhenLocalWriteFails() async throws {
        // 关键：写盘失败后若游标照常推进，这批远端记录下次就不会再被拉取，
        // 等于永久丢失。
        let store = FakeLocalStore(history: [])
        await store.setApplyShouldFail(true)
        let transport = FakeTransport(pages: [
            SyncFetchPage(sessions: [remote("session-remote", date: "2026-02-01")], nextCursor: "c1", hasMore: false)
        ])
        let coordinator = makeCoordinator(transport: transport, store: store)

        do {
            _ = try await coordinator.syncOnce()
            XCTFail("写盘失败必须抛出")
        } catch is FakeStoreError {
            // 预期
        }

        let savedCursor = await store.cursor
        XCTAssertNil(savedCursor, "写盘失败后游标不得推进")
    }

    func testUploadFailureKeepsPulledDataLocally() async throws {
        // 先写回再上传的顺序保证：上传失败不影响已经拉到本地的记录。
        let store = FakeLocalStore(history: [sessionPayload("session-local", date: "2026-01-01")])
        let transport = FakeTransport(pages: [
            SyncFetchPage(sessions: [remote("session-remote", date: "2026-02-01")], nextCursor: "c1", hasMore: false)
        ])
        await transport.setUploadError(.offline)
        let coordinator = makeCoordinator(transport: transport, store: store)

        do {
            _ = try await coordinator.syncOnce()
            XCTFail("上传失败必须抛出")
        } catch SyncTransportError.offline {
            // 预期
        }

        let ids = await store.historyIds
        XCTAssertEqual(ids, ["session-local", "session-remote"], "拉到的记录必须已经落地")
    }

    func testOfflineFetchLeavesLocalUntouched() async throws {
        let store = FakeLocalStore(history: [sessionPayload("session-1", date: "2026-01-01")])
        let transport = FakeTransport(pages: [])
        await transport.setFetchError(.offline)
        let coordinator = makeCoordinator(transport: transport, store: store)

        do {
            _ = try await coordinator.syncOnce()
            XCTFail("离线必须抛出")
        } catch SyncTransportError.offline {
            // 预期
        }

        let applyCount = await store.applyCallCount
        XCTAssertEqual(applyCount, 0)
        let ids = await store.historyIds
        XCTAssertEqual(ids, ["session-1"])
    }

    func testBlockedByNewerSchemaIsReportedAsIncomplete() async throws {
        let store = FakeLocalStore(history: [])
        let transport = FakeTransport(pages: [
            SyncFetchPage(
                sessions: [remote("session-future", date: "2026-02-01", schemaVersion: schema + 1)],
                nextCursor: "c1", hasMore: false
            )
        ])
        let coordinator = makeCoordinator(transport: transport, store: store)

        let report = try await coordinator.syncOnce()

        XCTAssertEqual(report.blockedByNewerSchema, 1)
        XCTAssertEqual(report.pulledSessionCount, 0)
        XCTAssertFalse(report.isComplete, "有记录没合并进来时不得报告同步完整")
    }

    func testPaginationPullsEveryPage() async throws {
        let store = FakeLocalStore(history: [])
        let transport = FakeTransport(pages: [
            SyncFetchPage(sessions: [remote("session-1", date: "2026-01-01")], nextCursor: "c1", hasMore: true),
            SyncFetchPage(sessions: [remote("session-2", date: "2026-01-02")], nextCursor: "c2", hasMore: true),
            SyncFetchPage(sessions: [remote("session-3", date: "2026-01-03")], nextCursor: "c3", hasMore: false)
        ])
        let coordinator = makeCoordinator(transport: transport, store: store)

        let report = try await coordinator.syncOnce()

        XCTAssertEqual(report.pulledSessionCount, 3)
        let ids = await store.historyIds
        XCTAssertEqual(ids, ["session-1", "session-2", "session-3"])
        let cursor = await store.cursor
        XCTAssertEqual(cursor, "c3")
    }

    func testUploadedConfigExcludesHistory() async throws {
        // 配置行不得承载训练记录——否则一次配置覆盖就会波及 history。
        let store = FakeLocalStore(
            history: [sessionPayload("session-1", date: "2026-01-01")],
            config: ["unitSystem": .string("kg")]
        )
        let transport = FakeTransport(pages: [])
        let coordinator = makeCoordinator(transport: transport, store: store)

        _ = try await coordinator.syncOnce()

        let configs = await transport.uploadedConfigs
        XCTAssertEqual(configs.count, 1)
        XCTAssertNil(configs.first?.payload["history"])
        XCTAssertEqual(configs.first?.payload["unitSystem"]?.asString, "kg")
    }

    func testUploadedConfigStripsHealthKeysButKeepsUnknownOnes() async throws {
        // 护栏而非迁移工具：配置区「history 之外整块上传」意味着将来任何往 canonical
        // 顶层写健康数据的改动都会静默上云，写那个功能的人不会想起来检查同步载荷。
        // 这条断言让那种改动在这里失败。
        // 同时钉住 open-bag：**未知**键（新版本写的）必须原样保留，不能被白名单吃掉。
        let store = FakeLocalStore(
            history: [],
            config: [
                "unitSystem": .string("kg"),
                "bodyWeights": .array([.object(["kg": .double(72.4)])]),
                "healthMetricSamples": .array([.string("hr-sample")]),
                "healthImportBatches": .array([.string("batch-1")]),
                "importedWorkoutSamples": .array([.string("hk-workout")]),
                "someFutureKey": .string("written by a newer app"),
            ]
        )
        let transport = FakeTransport(pages: [])
        let coordinator = makeCoordinator(transport: transport, store: store)

        _ = try await coordinator.syncOnce()

        let uploaded = await transport.uploadedConfigs
        let payload = try XCTUnwrap(uploaded.first?.payload)
        for key in SyncRedaction.deprecatedHealthKeys {
            XCTAssertNil(payload[key], "\(key) 属于已废弃健康键，绝不能上传")
        }
        XCTAssertEqual(payload["unitSystem"]?.asString, "kg")
        XCTAssertEqual(
            payload["someFutureKey"]?.asString, "written by a newer app",
            "未知键必须原样保留——白名单会让跨版本同步静默吃掉新字段"
        )
    }

    func testUncleanRemoteRecordIsReportedAsIncompleteNotSilentlyDropped() async throws {
        // 远端有坏数据时，同步不能显示「完成」——这类问题正是要靠后台查数据排障的。
        let store = FakeLocalStore(history: [])
        let transport = FakeTransport(pages: [
            SyncFetchPage(
                sessions: [remote("session-good", date: "2026-01-01"), remote("session-bad", date: "2026-01-02")],
                nextCursor: "c1", hasMore: false
            )
        ])
        let coordinator = SyncCoordinator(
            transport: transport, localStore: store, deviceId: "device-A",
            isSessionAcceptable: { $0["id"]?.asString != "session-bad" },
            now: { "2026-08-07T00:00:00Z" }
        )

        let report = try await coordinator.syncOnce()

        XCTAssertEqual(report.rejectedUncleanCount, 1)
        XCTAssertEqual(report.pulledSessionCount, 1)
        XCTAssertFalse(report.isComplete)
        let ids = await store.historyIds
        XCTAssertEqual(ids, ["session-good"], "好记录必须落地，不被坏记录连累")
    }

    func testRunawayPaginationIsBounded() async throws {
        // 后端游标实现有 bug 时（永远 hasMore=true 且游标在变），不能无限拉下去。
        let store = FakeLocalStore(history: [])
        let pages = (0..<200).map { index in
            SyncFetchPage(
                sessions: [remote("session-\(index)", date: "2026-01-01")],
                nextCursor: "c\(index)", hasMore: true
            )
        }
        let transport = FakeTransport(pages: pages)
        let coordinator = SyncCoordinator(
            transport: transport, localStore: store, deviceId: "device-A",
            maxPages: 5, now: { "2026-08-07T00:00:00Z" }
        )

        _ = try await coordinator.syncOnce()

        let calls = await transport.fetchCallCount
        XCTAssertEqual(calls, 5, "必须被 maxPages 截断")
    }
}
