// 回归协议（2026-07-08）：重启场（与历史最后一场日期差 ≥21 天）完成时 rotationOffset
// 归零——FR-TR7 换天累计的旧偏移在「从头开始」语义下清除；引擎轮换自重启点无状态
// 重新计数（扫描历史），此清零只管残值。语义锁：<21 天不动 offset（TR7 不破）；
// offset 已为 0 不写多余变更；与 TR7 消费（同场 -1）可叠加（先 -1 再判重启归零）。

import Foundation
import XCTest
@testable import RedePersistence
import RedeDomain

final class ComebackOffsetResetTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("comeback-offset-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private struct AcceptAllGate: AppDataWriteGate {
        func validate(candidate: AppData, replacing current: AppData?) throws {}
    }

    private func makeWriter() -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: AcceptAllGate())
    }

    private func session(id: String, date: String) -> TrainingSession {
        TrainingSession(storage: [
            "id": .string(id), "date": .string(date),
            "completed": .bool(true), "exercises": .array([]),
        ])
    }

    func testRestartSessionResetsAccruedOffset() throws {
        let writer = makeWriter()
        _ = try writer.appendCompletedSession(session(id: "s0", date: "2026-06-15"))
        // TR7 换天完成累计 offset -1（用覆盖路径制造非零残值）
        _ = try writer.applyOneTimeDayOverride(dayCode: "lower", dateISO: "2026-06-16")
        let afterOverride = try writer.appendCompletedSession(session(id: "s1", date: "2026-06-16"))
        XCTAssertEqual(afterOverride.rotationOffset, -1)
        // 停练 22 天后的重启场完成 → 残值归零
        let afterComeback = try writer.appendCompletedSession(session(id: "s2", date: "2026-07-08"))
        XCTAssertEqual(afterComeback.rotationOffset, 0)
    }

    func testShortGapKeepsOffset() throws {
        let writer = makeWriter()
        _ = try writer.appendCompletedSession(session(id: "s0", date: "2026-06-15"))
        _ = try writer.applyOneTimeDayOverride(dayCode: "lower", dateISO: "2026-06-16")
        _ = try writer.appendCompletedSession(session(id: "s1", date: "2026-06-16"))
        // 20 天 <21：TR7 偏移保留
        let after = try writer.appendCompletedSession(session(id: "s2", date: "2026-07-06"))
        XCTAssertEqual(after.rotationOffset, -1)
    }

    func testRestartWithZeroOffsetWritesNothingExtra() throws {
        let writer = makeWriter()
        _ = try writer.appendCompletedSession(session(id: "s0", date: "2026-06-15"))
        let after = try writer.appendCompletedSession(session(id: "s1", date: "2026-07-08"))
        XCTAssertEqual(after.rotationOffset, 0)
        XCTAssertEqual(after.history.count, 2)
    }

    func testRestartDayWithOverrideKeepsFreshTr7Delta() throws {
        // 审查 M3 组合场景：重启日用户又「今天换一天练」并完成——本次写内 TR7 刚产生
        // 的 -1 必须保留（序列头下一场补回），只清写前残值
        let writer = makeWriter()
        _ = try writer.appendCompletedSession(session(id: "s0", date: "2026-06-15"))
        // 制造写前残值 -1（6/16 换天完成）
        _ = try writer.applyOneTimeDayOverride(dayCode: "lower", dateISO: "2026-06-16")
        _ = try writer.appendCompletedSession(session(id: "s1", date: "2026-06-16"))
        // 停练 22 天，重启日再换天并完成：写前残值 -1 应清、本次 TR7 的 -1 应留
        _ = try writer.applyOneTimeDayOverride(dayCode: "lower", dateISO: "2026-07-08")
        let after = try writer.appendCompletedSession(session(id: "s2", date: "2026-07-08"))
        XCTAssertEqual(after.rotationOffset, -1, "本次换天补偿保留、历史残值清除")
        XCTAssertNil(after.oneTimeDayOverride)
    }
}
