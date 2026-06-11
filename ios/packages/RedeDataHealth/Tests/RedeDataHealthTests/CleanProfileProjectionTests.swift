// CleanProfile 投影：合法标量通过，越界/未知值投影为 nil 并记 issue——
// 不发明默认值（冷启动 prior 是 M2 引擎的职责，不是数据层的）。

import Foundation
import XCTest
import RedeDomain
@testable import RedeDataHealth

final class CleanProfileProjectionTests: XCTestCase {
    private func makeView(profileJSON: String) throws -> CleanAppDataView {
        let json = "{\"schemaVersion\": 8, \"userProfile\": \(profileJSON)}"
        let appData = try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
        return CleanAppDataViewBuilder.build(from: appData)
    }

    func testValidProfilePassesThrough() throws {
        let view = try makeView(profileJSON: #"""
        {"trainingLevel": "intermediate", "sex": "M", "age": 30,
         "heightCm": 178, "weightKg": 74.5, "weeklyTrainingDays": 4}
        """#)
        XCTAssertEqual(view.profile.trainingLevel, "intermediate")
        XCTAssertEqual(view.profile.sex, "M")
        XCTAssertEqual(view.profile.age, 30)
        XCTAssertEqual(view.profile.heightCm, 178)
        XCTAssertEqual(view.profile.weightKg, 74.5)
        XCTAssertEqual(view.profile.weeklyTrainingDays, 4)
        XCTAssertTrue(view.issues.isEmpty)
    }

    func testOutOfRangeScalarsProjectAsNilWithIssues() throws {
        let view = try makeView(profileJSON: #"""
        {"age": 500, "heightCm": 30, "weightKg": 1000, "weeklyTrainingDays": 0}
        """#)
        XCTAssertNil(view.profile.age)
        XCTAssertNil(view.profile.heightCm)
        XCTAssertNil(view.profile.weightKg)
        XCTAssertNil(view.profile.weeklyTrainingDays)
        XCTAssertEqual(Set(view.issues), Set([
            .profileFieldIgnored(field: "age"),
            .profileFieldIgnored(field: "heightCm"),
            .profileFieldIgnored(field: "weightKg"),
            .profileFieldIgnored(field: "weeklyTrainingDays"),
        ]))
    }

    func testRangeEndpointsPassExactly() throws {
        let lower = try makeView(profileJSON: #"{"age": 10, "heightCm": 100, "weightKg": 20, "weeklyTrainingDays": 1}"#)
        XCTAssertEqual(lower.profile.age, 10)
        XCTAssertEqual(lower.profile.heightCm, 100)
        XCTAssertEqual(lower.profile.weightKg, 20)
        XCTAssertEqual(lower.profile.weeklyTrainingDays, 1)
        XCTAssertTrue(lower.issues.isEmpty)

        let upper = try makeView(profileJSON: #"{"age": 120, "heightCm": 250, "weightKg": 400, "weeklyTrainingDays": 14}"#)
        XCTAssertEqual(upper.profile.age, 120)
        XCTAssertEqual(upper.profile.heightCm, 250)
        XCTAssertEqual(upper.profile.weightKg, 400)
        XCTAssertEqual(upper.profile.weeklyTrainingDays, 14)
        XCTAssertTrue(upper.issues.isEmpty)
    }

    func testUnknownTrainingLevelProjectsAsNilWithIssue() throws {
        let view = try makeView(profileJSON: #"{"trainingLevel": "superhuman"}"#)
        XCTAssertNil(view.profile.trainingLevel)
        XCTAssertEqual(view.issues, [.profileFieldIgnored(field: "trainingLevel")])
    }

    // FR-EQ1（2026-06-11，审查 M-2）：器械场景同款白名单投影合同
    func testValidEquipmentScenarioPassesThrough() throws {
        let view = try makeView(profileJSON: #"{"equipmentScenario": "home-dumbbell"}"#)
        XCTAssertEqual(view.profile.equipmentScenario, "home-dumbbell")
        XCTAssertTrue(view.issues.isEmpty)
    }

    func testUnknownEquipmentScenarioProjectsAsNilWithIssue() throws {
        let view = try makeView(profileJSON: #"{"equipmentScenario": "spaceship"}"#)
        XCTAssertNil(view.profile.equipmentScenario)
        XCTAssertEqual(view.issues, [.profileFieldIgnored(field: "equipmentScenario")])
    }

    func testMissingProfileYieldsEmptyCleanProfileWithoutIssues() throws {
        let appData = try JSONDecoder().decode(AppData.self, from: Data(#"{"schemaVersion": 8}"#.utf8))
        let view = CleanAppDataViewBuilder.build(from: appData)
        XCTAssertNil(view.profile.trainingLevel)
        XCTAssertNil(view.profile.age)
        XCTAssertTrue(view.issues.isEmpty)
    }
}
