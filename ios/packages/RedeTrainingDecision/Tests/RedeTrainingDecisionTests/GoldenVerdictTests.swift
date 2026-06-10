// Goldens（M2-1 验收原文要求）：固定输入 → 锁定裁决输出。
// 每个 golden 走完整读路径：AppData JSON → DataHealth 投影 → branded input → 引擎。
// 改任何规则/阈值都必须让这里红——这是「给定固定输入，输出稳定裁决」的合同锚。

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class GoldenVerdictTests: XCTestCase {
    private struct Golden: Decodable {
        struct Expected: Decodable {
            let call: String
            let reasonCode: String
        }
        let today: String
        let expected: Expected
    }

    private static let goldenNames = [
        "golden-train-normal",
        "golden-rest-trained-today",
        "golden-light-long-gap",
        "golden-deload-sustained",
    ]

    func testAllGoldensProduceLockedVerdicts() throws {
        for name in Self.goldenNames {
            let data = try Data(contentsOf: TestSupport.fixtureURL("\(name).json"))
            let golden = try JSONDecoder().decode(Golden.self, from: data)

            // appData 子树单独取出走真实解码路径
            let envelope = try JSONDecoder().decode(JSONValue.self, from: data)
            guard case .object(let object) = envelope, let appDataValue = object["appData"] else {
                XCTFail("\(name): missing appData")
                continue
            }
            let appData = try AppData(decoding: appDataValue)
            let cleanView = CleanAppDataViewBuilder.build(from: appData)
            let input = try CleanTrainingDecisionInput.make(from: cleanView, todayISO: golden.today)
            let verdict = TodayVerdictEngine.evaluate(input)

            XCTAssertEqual(verdict.call.rawValue, golden.expected.call, "\(name): call 漂移")
            XCTAssertEqual(verdict.reason.code, golden.expected.reasonCode, "\(name): 主理由漂移")
        }
    }
}
