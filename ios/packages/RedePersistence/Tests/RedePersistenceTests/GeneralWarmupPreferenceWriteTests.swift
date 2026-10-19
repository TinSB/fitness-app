// 开练前全身热身卡开关（训练流审查 P1，2026-10-18）：userProfile.generalWarmupEnabled open-bag scalar，
// 缺省 = 显示；只改这一个键，userProfile 其余字段原样保留。

import Foundation
import XCTest
@testable import RedePersistence
import RedeDomain

final class GeneralWarmupPreferenceWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("general-warmup-\(UUID().uuidString)")
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

    func testDefaultIsShownAndRoundTripKeepsOtherProfileKeys() throws {
        let writer = makeWriter()
        let seeded = try writer.applyPreferences(unitSystem: "lb", locale: "zh")
        XCTAssertTrue(seeded.generalWarmupEnabled, "缺省 = 显示")

        let off = try writer.applyGeneralWarmupPreference(enabled: false)
        XCTAssertFalse(off.generalWarmupEnabled)
        XCTAssertEqual(off.userProfile.unitSystem, "lb", "其余 userProfile 键原样保留")
        XCTAssertEqual(off.userProfile.locale, "zh")

        let reloaded = try JSONFileAppDataStore(fileURL: fileURL).load()
        XCTAssertEqual(reloaded?.generalWarmupEnabled, false, "落盘")

        let on = try writer.applyGeneralWarmupPreference(enabled: true)
        XCTAssertTrue(on.generalWarmupEnabled)
    }
}
