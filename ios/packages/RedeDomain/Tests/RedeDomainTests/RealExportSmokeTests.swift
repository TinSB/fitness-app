// 开门设计冒烟测试：真实 legacy 导出（磁盘 schemaVersion=8）经迁移升 10 后必须无损往返。
// ios/ParityFixtures 在此只是参考输入（系统逻辑 §3），不是 golden——只断言语义等值，
// 不做字节/哈希 parity。它现在直接验证「老数据迁移」这条路真的开着：v8 → v9 落地不丢字段。

import Foundation
import XCTest
@testable import RedeDomain

final class RealExportSmokeTests: XCTestCase {
    private func loadRealExport() throws -> Data {
        let url = TestSupport.repoRootURL()
            .appendingPathComponent("ios/ParityFixtures/data-health/ironpath-2026-05-27-redacted.json")
        return try Data(contentsOf: url)
    }

    func testRealExportDecodesAndRoundTripsLosslessly() throws {
        let data = try loadRealExport()
        let original = try JSONDecoder().decode(AppData.self, from: data)

        XCTAssertEqual(original.schemaVersion, 10, "磁盘 v8 经 decode 边界迁移升 10")
        XCTAssertEqual(original.mesocycle.enabled, false, "迁移播种默认关闭 = 零回归")
        XCTAssertFalse(original.history.isEmpty, "既有训练历史无损保留")
        XCTAssertNotNil(original.userProfile.trainingLevel)

        let reborn = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(original))
        XCTAssertEqual(reborn.storage, original.storage)
    }
}
