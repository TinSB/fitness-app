// M2-2 goldens：固定输入 → 锁定处方（走完整链：AppData JSON → DataHealth →
// branded input → 裁决 → 处方）。改渐进规则/轮转/调制必先让这里红。

import Foundation
import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class GoldenPrescriptionTests: XCTestCase {
    private struct Golden: Decodable {
        struct Expected: Decodable {
            let dayCode: String
            let firstExerciseId: String
            let firstWeightKg: Double
            let firstChange: String
            let exerciseCount: Int
            let dayReasonCodes: [String]?
        }
        let today: String
        let expected: Expected
    }

    private static let goldenNames = [
        "golden-prescription-first-exposure",
        "golden-prescription-progression",
        "golden-prescription-deload",
        "golden-prescription-pull-day",
        "golden-prescription-legs-day",
    ]

    func testAllPrescriptionGoldens() throws {
        for name in Self.goldenNames {
            let data = try Data(contentsOf: TestSupport.fixtureURL("\(name).json"))
            let golden = try JSONDecoder().decode(Golden.self, from: data)

            let envelope = try JSONDecoder().decode(JSONValue.self, from: data)
            guard case .object(let object) = envelope, let appDataValue = object["appData"] else {
                XCTFail("\(name): missing appData")
                continue
            }
            let appData = try AppData(decoding: appDataValue)
            let cleanView = CleanAppDataViewBuilder.build(from: appData)
            let input = try CleanTrainingDecisionInput.make(from: cleanView, todayISO: golden.today)
            let verdict = TodayVerdictEngine.evaluate(input)
            let prescription = try XCTUnwrap(
                TodayPrescriptionEngine.plan(input: input, verdict: verdict),
                "\(name): 期望有处方"
            )

            XCTAssertEqual(prescription.dayCode, golden.expected.dayCode, "\(name): dayCode 漂移")
            XCTAssertEqual(prescription.exercises.count, golden.expected.exerciseCount, "\(name): 动作数漂移")
            let first = try XCTUnwrap(prescription.exercises.first)
            XCTAssertEqual(first.exerciseId, golden.expected.firstExerciseId, "\(name): 首动作漂移")
            XCTAssertEqual(first.targetWeightKg, golden.expected.firstWeightKg, "\(name): 首动作重量漂移")
            XCTAssertEqual(first.change.rawValue, golden.expected.firstChange, "\(name): change 漂移")
            if let expectedCodes = golden.expected.dayReasonCodes {
                XCTAssertEqual(prescription.dayReasons.map(\.code), expectedCodes, "\(name): day reasons 漂移")
            }
        }
    }
}
