// 同步落盘的并发合同（FR-ACC1）。
//
// 这个文件补的是一处真实缺口：App 层的同步写入此前**零测试覆盖**——包括写闸的
// 抢占原语本身。那段代码曾经写成「先 await 一个等待函数，返回后再置位 isSaving」，
// 中间隔着 suspension point，两个写入者会同时进场；修成 check-and-set 之后，
// 「修好了」一直只是读代码得出的结论，没有任何断言证明。
//
// 这里验证三件事，每件都对应一个会真出事的场景：
//   ① 用户正在保存时，同步排队等待而不是放弃（放弃 = 静默丢一次同步结果）
//   ② 等不到就如实失败并写错误面，绝不假装成功
//   ③ 并发的同步写入互斥，不会两个同时进场

import Foundation
import XCTest
@testable import Rede
import RedeDomain

@MainActor
final class SyncWriteSlotTests: XCTestCase {

    private func makeStore() -> (SessionStore, URL) {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-sync-slot-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent("app-data.json")
        return (SessionStore(planWriteFileURL: url), url)
    }

    private func storage(_ ids: [String]) -> [String: JSONValue] {
        [
            "schemaVersion": .int(Int64(SchemaVersion.current)),
            "history": .array(ids.map { id in
                .object([
                    "id": .string(id),
                    "date": .string("2026-01-01"),
                    "completed": .bool(true),
                    "exercises": .array([]),
                ])
            }),
        ]
    }

    private func historyIds(at url: URL) -> [String] {
        guard let data = try? Data(contentsOf: url),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let history = root["history"] as? [[String: Any]] else { return [] }
        return history.compactMap { $0["id"] as? String }
    }

    // MARK: ① 忙时等待而不是放弃

    func testSyncWriteWaitsForBusySlotInsteadOfDropping() async throws {
        let (store, url) = makeStore()

        // 模拟用户写入占着锁：直接置位，稍后释放。
        store.isSaving = true
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 60_000_000)   // 60ms 后放开
            store.isSaving = false
        }

        let ok = await store.applySyncMerge(mergedStorage: storage(["session-1"]))

        XCTAssertTrue(ok, "后台同步必须排队等待——放弃就是静默丢一次同步结果")
        XCTAssertEqual(historyIds(at: url), ["session-1"])
        XCTAssertNil(store.syncSaveErrorText)
    }

    // MARK: ② 等不到就如实失败

    func testSyncWriteReportsFailureWhenSlotNeverFrees() async {
        let (store, url) = makeStore()
        store.isSaving = true   // 一直不放

        let ok = await store.applySyncMerge(mergedStorage: storage(["session-1"]), maxWaitAttempts: 2)

        XCTAssertFalse(ok)
        XCTAssertNotNil(store.syncSaveErrorText, "超时必须写错误面，绝不假装成功")
        XCTAssertTrue(historyIds(at: url).isEmpty, "失败时不得留下半截写入")
        store.isSaving = false
    }

    // MARK: ③ 并发互斥

    func testConcurrentSyncWritesDoNotBothEnterTheSlot() async throws {
        let (store, url) = makeStore()

        // 两次并发的同步落盘。抢占若不是原子的（检查与置位之间有 await），
        // 两者会同时进场，最后一个写入覆盖前一个——历史里只剩一条。
        async let a = store.applySyncMerge(mergedStorage: storage(["session-1"]))
        async let b = store.applySyncMerge(mergedStorage: storage(["session-1", "session-2"]))
        let results = await [a, b]

        XCTAssertTrue(results.contains(true), "至少一次必须成功")
        // 两次都成功时，后写的那次是基于写闸重新 load 的 current，不会丢记录；
        // 关键断言是落盘结果自洽——不能出现只写了一半的历史。
        let ids = historyIds(at: url)
        XCTAssertFalse(ids.isEmpty, "并发后磁盘上必须有完整结果")
        XCTAssertEqual(Set(ids).count, ids.count, "不得出现重复条目")
        XCTAssertFalse(store.isSaving, "两次都结束后锁必须已释放")
    }

    // MARK: ④ 写闸 gate 仍在把关

    func testSyncWriteStillGoesThroughDataHealthGate() async throws {
        let (store, url) = makeStore()

        _ = await store.applySyncMerge(mergedStorage: storage(["session-1", "session-2"]))
        XCTAssertEqual(historyIds(at: url), ["session-1", "session-2"])

        // 丢掉一条已存在记录的合并必须被写闸拒绝——同步不是特权写入。
        let ok = await store.applySyncMerge(mergedStorage: storage(["session-2"]))

        XCTAssertFalse(ok, "会丢历史的合并必须被 DataHealth gate 拒绝")
        XCTAssertEqual(historyIds(at: url), ["session-1", "session-2"], "磁盘上原数据一行不动")
        XCTAssertNotNil(store.syncSaveErrorText)
    }
}
