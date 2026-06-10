// M3-3 端到端闭环（测试级「杀进程重开」等价物）：
// 空 store → 裁决/处方 → 跟练 → 构建 session → 真 DataHealth gate → 唯一写闸
// 落盘 → 重新 load → 今日裁决翻转为「已练，休息」。写入合规由 M1-2 写闸保证
//（备份/原子/诚实失败），gate 拒绝路径同样验证文件不动。

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
import RedePersistence
@testable import RedeTrainingDecision

/// 真 gate 适配器（与 app 层 SessionStore 内的接线同构）。
private struct DataHealthGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {
        try CanonicalWriteValidation.validate(candidate: candidate, replacing: current)
    }
}

final class EndToEndWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-e2e-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    func testTrainPersistReloadFlipsVerdictToRest() throws {
        let store = JSONFileAppDataStore(fileURL: fileURL)
        let writer = CanonicalSessionWriter(store: store, gate: DataHealthGate())

        // ① 首启：空文档 → 校准期处方
        let empty = try AppData(decoding: .object(["schemaVersion": .int(8)]))
        let cleanView = CleanAppDataViewBuilder.build(from: empty)
        let input = try CleanTrainingDecisionInput.make(from: cleanView, todayISO: "2026-06-09")
        let verdict = TodayVerdictEngine.evaluate(input)
        XCTAssertEqual(verdict.call, .train)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))

        // ② 跟练（第一动作全完成后提前结束）
        var flow = TrainFlowState(prescription: prescription)
        for _ in 0..<3 {
            flow.logSet(CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false))
            flow.restFinished()
        }
        flow.requestFinish()
        flow.confirmEnd(reason: .timeUp)
        XCTAssertEqual(flow.phase, .summary)

        // ③ 构建 + 经唯一写闸落盘
        let session = CompletedSessionBuilder.build(
            from: flow, sessionId: "e2e-1", dateISO: "2026-06-09",
            startedAtISO: "2026-06-09T10:00:00Z", finishedAtISO: "2026-06-09T10:30:00Z",
            durationMinutes: 30
        )
        let written = try writer.appendCompletedSession(session)
        XCTAssertEqual(written.history.count, 1)

        // ④「杀进程重开」：从磁盘重新读 → 今日裁决翻转为休息，处方不再开
        let reloaded = try XCTUnwrap(try store.load())
        let view2 = CleanAppDataViewBuilder.build(from: reloaded)
        XCTAssertEqual(view2.sessions.count, 1)
        XCTAssertTrue(view2.issues.isEmpty, "落盘的 session 必须完全通过净化：\(view2.issues)")
        let input2 = try CleanTrainingDecisionInput.make(from: view2, todayISO: "2026-06-09")
        let verdict2 = TodayVerdictEngine.evaluate(input2)
        XCTAssertEqual(verdict2.call, .rest)
        XCTAssertEqual(verdict2.reason, .alreadyTrainedToday)
        XCTAssertNil(TodayPrescriptionEngine.plan(input: input2, verdict: verdict2))

        // ⑤ 写前备份存在（M1-2 合同在真链路上生效）
        let backups = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent.hasPrefix("app-data.json.backup-") }
        XCTAssertEqual(backups.count, 0, "首写无旧文件不应有备份")

        // 第二天再练一次 → 这次应产生备份
        let session2 = CompletedSessionBuilder.build(
            from: flow, sessionId: "e2e-2", dateISO: "2026-06-10",
            startedAtISO: "t0", finishedAtISO: "t1", durationMinutes: 20
        )
        try writer.appendCompletedSession(session2)
        let backups2 = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent.hasPrefix("app-data.json.backup-") }
        XCTAssertEqual(backups2.count, 1)
    }

    func testGateRejectsGarbageSessionAndFileUntouched() throws {
        let store = JSONFileAppDataStore(fileURL: fileURL)
        let writer = CanonicalSessionWriter(store: store, gate: DataHealthGate())
        try Data(#"{"schemaVersion": 8, "history": []}"#.utf8).write(to: fileURL)
        let before = try Data(contentsOf: fileURL)

        // 缺 date 的 session：写闸入口校验通过（有 id、completed），但真 gate 必须拦下
        let garbage = TrainingSession(storage: ["id": .string("bad"), "completed": .bool(true)])
        XCTAssertThrowsError(try writer.appendCompletedSession(garbage)) { error in
            XCTAssertEqual(
                error as? CanonicalWriteValidation.ValidationError,
                .newSessionWouldBeDropped(id: "bad")
            )
        }
        XCTAssertEqual(try Data(contentsOf: fileURL), before, "gate 拒绝时文件必须原字节不动")
    }
}
