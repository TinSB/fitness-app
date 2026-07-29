// M2-2 goldens：固定输入 → 锁定处方（走完整链：AppData JSON → DataHealth →
// branded input → 裁决 → 处方）。*.expected.json 从本分支起点 origin/main
// b634d2c885c6897fe563f69524270a61a8f437cb 的旧引擎输出捕获；改规则必先让这里红。

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

    private static let progressionPauseReasonKey = Data(#""progressionPauseReason""#.utf8)

    private static func expectedPrescriptionData(for name: String) throws -> Data {
        var data = try Data(contentsOf: TestSupport.fixtureURL("\(name).expected.json"))
        while let last = data.last, last == 0x0A || last == 0x0D {
            data.removeLast()
        }
        return data
    }

    func testAllPrescriptionGoldens() throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]

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
            let encoded = try encoder.encode(prescription)
            let expectedData = try Self.expectedPrescriptionData(for: name)

            XCTAssertEqual(encoded, expectedData, "\(name): 完整处方 JSON bytes 漂移")
            XCTAssertTrue(
                prescription.exercises.allSatisfy { $0.progressionPauseReason == nil },
                "\(name): baseline progressionPauseReason 应为 nil"
            )
            XCTAssertNil(
                encoded.range(of: Self.progressionPauseReasonKey),
                "\(name): nil progressionPauseReason 不得进入 JSON"
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
