// 开门设计冒烟测试：真实 legacy 导出（schemaVersion=8）必须能被新模型无损往返。
// ios/ParityFixtures 在此只是参考输入（系统逻辑 §3），不是 golden——只断言语义等值，
// 不做字节/哈希 parity。它证明「未来若做老数据迁移，模型层的门是开着的」。

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

        XCTAssertEqual(original.schemaVersion, 8)
        XCTAssertFalse(original.history.isEmpty)
        XCTAssertNotNil(original.userProfile.trainingLevel)

        let reborn = try JSONDecoder().decode(AppData.self, from: JSONEncoder().encode(original))
        XCTAssertEqual(reborn.storage, original.storage)
    }
}
