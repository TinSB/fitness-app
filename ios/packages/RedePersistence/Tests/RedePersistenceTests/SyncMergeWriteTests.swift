// applySyncMerge 合同（云同步落盘）。
//
// 这条写入路径与其余类别不同：mutation 由 RedeSync 的纯函数引擎在包外算好后整体送入。
// 因此这里要证明的核心不是「合并算得对不对」（那在 RedeSyncTests 里穷举），而是
// **写闸没有因为让出了 mutation 计算权而放松把关**：gate 照常收到候选、拒绝时不落盘。
//
// 这一点是数据安全的最后一道闸——上游引擎万一算出会丢历史的结果，必须死在这里。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

/// 模拟 DataHealth 的核心规则：candidate 的 history 不得比 current 少。
private struct NoHistoryLossGate: AppDataWriteGate {
    struct SessionLost: Error, Equatable {}
    func validate(candidate: AppData, replacing current: AppData?) throws {
        guard let current else { return }
        let currentIds = Set(current.history.compactMap(\.id))
        let candidateIds = Set(candidate.history.compactMap(\.id))
        if !currentIds.isSubset(of: candidateIds) { throw SessionLost() }
    }
}

private final class StoreSpy: AppDataStore {
    var current: AppData?
    private(set) var saveCount = 0
    private(set) var backupCount = 0

    init(current: AppData? = nil) { self.current = current }

    func load() throws -> AppData? { current }
    func save(_ appData: AppData) throws { saveCount += 1; current = appData }
    func backupExisting() throws -> URL? { backupCount += 1; return nil }
}

private final class CapturingGate: AppDataWriteGate {
    private(set) var captured: [(candidate: AppData, replacing: AppData?)] = []
    func validate(candidate: AppData, replacing current: AppData?) throws {
        captured.append((candidate, current))
    }
}

final class SyncMergeWriteTests: XCTestCase {

    private func session(_ id: String, date: String) -> JSONValue {
        .object([
            "id": .string(id),
            "date": .string(date),
            "completed": .bool(true),
            "exercises": .array([]),
        ])
    }

    private func storage(history: [JSONValue]) -> [String: JSONValue] {
        [
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "history": .array(history),
        ]
    }

    // MARK: 正常落盘

    func testMergedStorageIsPersisted() throws {
        let store = StoreSpy(current: try AppData(decoding: .object(storage(history: [
            session("s1", date: "2026-01-01")
        ]))))
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())

        let merged = storage(history: [
            session("s1", date: "2026-01-01"),
            session("s2", date: "2026-01-02"),
        ])
        let result = try writer.applySyncMerge(mergedStorage: merged)

        XCTAssertEqual(result.history.compactMap(\.id), ["s1", "s2"])
        XCTAssertEqual(store.saveCount, 1)
        XCTAssertEqual(store.backupCount, 1, "落盘前必须先备份")
    }

    // MARK: 写闸没有放松 —— 本文件存在的理由

    func testGateStillReceivesCandidateAndCurrent() throws {
        let current = try AppData(decoding: .object(storage(history: [session("s1", date: "2026-01-01")])))
        let store = StoreSpy(current: current)
        let gate = CapturingGate()
        let writer = CanonicalSessionWriter(store: store, gate: gate)

        _ = try writer.applySyncMerge(mergedStorage: storage(history: [
            session("s1", date: "2026-01-01"),
            session("s2", date: "2026-01-02"),
        ]))

        XCTAssertEqual(gate.captured.count, 1, "同步写入必须过闸，不能绕过")
        XCTAssertEqual(gate.captured.first?.replacing?.history.compactMap(\.id), ["s1"])
        XCTAssertEqual(gate.captured.first?.candidate.history.compactMap(\.id), ["s1", "s2"])
    }

    func testMergeThatWouldLoseHistoryIsRejectedAndNotWritten() throws {
        // 上游引擎若有 bug、算出丢掉 s1 的结果，必须死在写闸而不是落盘。
        let current = try AppData(decoding: .object(storage(history: [
            session("s1", date: "2026-01-01"),
            session("s2", date: "2026-01-02"),
        ])))
        let store = StoreSpy(current: current)
        let writer = CanonicalSessionWriter(store: store, gate: NoHistoryLossGate())

        let lossy = storage(history: [session("s2", date: "2026-01-02")])

        XCTAssertThrowsError(try writer.applySyncMerge(mergedStorage: lossy)) { error in
            XCTAssertTrue(error is NoHistoryLossGate.SessionLost)
        }
        XCTAssertEqual(store.saveCount, 0, "被拒绝的合并绝不能落盘")
        XCTAssertEqual(store.current?.history.compactMap(\.id), ["s1", "s2"], "原数据必须原封不动")
    }

    // MARK: 幂等

    func testUnchangedMergeDoesNotRewriteDisk() throws {
        let same = storage(history: [session("s1", date: "2026-01-01")])
        let store = StoreSpy(current: try AppData(decoding: .object(same)))
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())

        _ = try writer.applySyncMerge(mergedStorage: same)

        XCTAssertEqual(store.saveCount, 0, "无变化的同步不应产生写入与备份")
        XCTAssertEqual(store.backupCount, 0)
    }

    func testFirstWriteOnEmptyStoreBootstraps() throws {
        let store = StoreSpy(current: nil)
        let writer = CanonicalSessionWriter(store: store, gate: AcceptAllGate())

        let result = try writer.applySyncMerge(mergedStorage: storage(history: [
            session("s1", date: "2026-01-01")
        ]))

        XCTAssertEqual(result.history.compactMap(\.id), ["s1"])
        XCTAssertEqual(store.saveCount, 1)
    }
}
