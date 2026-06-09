import Foundation
import XCTest
@testable import RedeDomain

enum TestSupport {
    /// Tests/RedeDomainTests/ 同级 Fixtures/ 下的样例文件。
    static func fixtureURL(_ name: String) -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appendingPathComponent("Fixtures")
            .appendingPathComponent(name)
    }

    /// 仓库根（#filePath 向上 6 级：RedeDomainTests/Tests/RedeDomain/packages/ios/根），
    /// 用于读取 ios/ParityFixtures 参考输入。
    static func repoRootURL() -> URL {
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<6 { url = url.deletingLastPathComponent() }
        return url
    }

    static func loadSampleAppData() throws -> AppData {
        let data = try Data(contentsOf: fixtureURL("appdata-mvp-sample.json"))
        return try JSONDecoder().decode(AppData.self, from: data)
    }
}
