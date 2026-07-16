// 每周循环模式偏好（2026-07-08）：applyWeeklyCycleRestartPreference open-bag scalar +
// weekly 模式下 TR12 换天完成不产生 rotationOffset 补偿（补偿是顺延型概念）。

import Foundation
import XCTest
@testable import RedePersistence
import RedeDomain

final class WeeklyCycleRestartWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("weekly-mode-\(UUID().uuidString)")
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

    func testPreferenceRoundTripAndDefault() throws {
        let writer = makeWriter()
        let seeded = try writer.appendCompletedSession(session(id: "s0", date: "2026-07-06"))
        XCTAssertFalse(seeded.weeklyCycleRestart)                 // 缺省 = 顺延
        let on = try writer.applyWeeklyCycleRestartPreference(enabled: true)
        XCTAssertTrue(on.weeklyCycleRestart)
        let off = try writer.applyWeeklyCycleRestartPreference(enabled: false)
        XCTAssertFalse(off.weeklyCycleRestart)
    }

    func testTr7ConsumptionSkipsOffsetInWeeklyMode() throws {
        let writer = makeWriter()
        _ = try writer.appendCompletedSession(session(id: "s0", date: "2026-07-06"))
        _ = try writer.applyWeeklyCycleRestartPreference(enabled: true)
        _ = try writer.applyOneTimeDayOverride(dayCode: "lower", dateISO: "2026-07-07")
        let after = try writer.appendCompletedSession(session(id: "s1", date: "2026-07-07"))
        XCTAssertEqual(after.rotationOffset, 0, "weekly 模式换天完成不产生补偿")
        XCTAssertNil(after.oneTimeDayOverride, "当天覆盖仍清")
    }

    func testTr7ConsumptionStillOffsetsInCarryOverMode() throws {
        let writer = makeWriter()
        _ = try writer.appendCompletedSession(session(id: "s0", date: "2026-07-06"))
        _ = try writer.applyOneTimeDayOverride(dayCode: "lower", dateISO: "2026-07-07")
        let after = try writer.appendCompletedSession(session(id: "s1", date: "2026-07-07"))
        XCTAssertEqual(after.rotationOffset, -1, "顺延模式 TR12 语义不变")
    }
}
