// M5-1 引导写入合同（FR-ON1/SE2 写闸口径）：applyOnboarding 是写闸新增入口，
// 共享 load → 候选 → gate → backup → atomic save 编排，不另起写路径。
// open-bag 铁律：合并写入 userProfile / programTemplate 子对象，未知字段零丢失。

import Foundation
import XCTest
import RedeDomain
@testable import RedePersistence

private struct AcceptAllGate: AppDataWriteGate {
    func validate(candidate: AppData, replacing current: AppData?) throws {}
}

private struct RejectingGate: AppDataWriteGate {
    struct Rejection: Error, Equatable {}
    func validate(candidate: AppData, replacing current: AppData?) throws { throw Rejection() }
}

final class OnboardingWriteTests: XCTestCase {
    private var directory: URL!
    private var fileURL: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("rede-onboarding-write-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("app-data.json")
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
    }

    private func makeWriter(gate: AppDataWriteGate = AcceptAllGate()) -> CanonicalSessionWriter {
        CanonicalSessionWriter(store: JSONFileAppDataStore(fileURL: fileURL), gate: gate)
    }

    private var sample: OnboardingWrite {
        OnboardingWrite(
            trainingLevel: "beginner",
            primaryGoal: "hypertrophy",
            weeklyTrainingDays: 3,
            equipmentScenario: "home-dumbbell",
            splitType: "upper-lower"
        )
    }

    func testApplyToEmptyStoreBootstrapsProfileAndTemplate() throws {
        let result = try makeWriter().applyOnboarding(sample)
        XCTAssertEqual(result.schemaVersion, 9)  // 首写引导用 SchemaVersion.current（= 9）
        XCTAssertEqual(result.userProfile.trainingLevel, "beginner")
        XCTAssertEqual(result.userProfile.primaryGoal, "hypertrophy")
        XCTAssertEqual(result.userProfile.weeklyTrainingDays, 3)
        XCTAssertEqual(result.storage["userProfile"]?.asObject?["equipmentScenario"]?.asString, "home-dumbbell")
        XCTAssertEqual(result.programTemplate.splitType, "upper-lower")
        XCTAssertEqual(result.programTemplate.daysPerWeek, 3)
        XCTAssertEqual(result.programTemplate.primaryGoal, "hypertrophy")

        let onDisk = try XCTUnwrap(try JSONFileAppDataStore(fileURL: fileURL).load())
        XCTAssertEqual(onDisk.storage, result.storage)
    }

    func testApplyMergesWithoutDroppingUnknownFields() throws {
        let existing = #"""
        {"schemaVersion": 8, "futureKey": {"deep": true},
         "userProfile": {"name": "样例", "futureProfileKey": 1},
         "programTemplate": {"futureTemplateKey": "x"},
         "history": [{"id": "old", "completed": true}]}
        """#
        try Data(existing.utf8).write(to: fileURL)

        let result = try makeWriter().applyOnboarding(sample)
        // 顶层未知字段
        XCTAssertEqual(result.storage["futureKey"], .object(["deep": .bool(true)]))
        // 子对象合并而非替换
        XCTAssertEqual(result.userProfile.name, "样例")
        XCTAssertEqual(result.storage["userProfile"]?.asObject?["futureProfileKey"]?.asInt, 1)
        XCTAssertEqual(result.storage["programTemplate"]?.asObject?["futureTemplateKey"]?.asString, "x")
        // 历史不动
        XCTAssertEqual(result.history.map(\.id), ["old"])
        // 新值已写入
        XCTAssertEqual(result.userProfile.trainingLevel, "beginner")
        XCTAssertEqual(result.programTemplate.splitType, "upper-lower")
    }

    func testGateRejectionLeavesFileUntouched() throws {
        let existingBytes = Data(#"{"schemaVersion": 8, "history": []}"#.utf8)
        try existingBytes.write(to: fileURL)
        XCTAssertThrowsError(try makeWriter(gate: RejectingGate()).applyOnboarding(sample))
        XCTAssertEqual(try Data(contentsOf: fileURL), existingBytes)
    }

    func testRepeatedApplyOverwritesKnownFieldsOnly() throws {
        // 用户改答案重跑引导 = 覆盖写已知字段；未知字段与历史依然保全。
        // 已知行为（拍板留痕）：日序列轮转基于历史条数，改 splitType 不重置轮转。
        let writer = makeWriter()
        try writer.applyOnboarding(sample)
        let updated = OnboardingWrite(
            trainingLevel: "advanced", primaryGoal: "strength",
            weeklyTrainingDays: 5, equipmentScenario: "commercial-gym", splitType: "push-pull-legs")
        let result = try writer.applyOnboarding(updated)
        XCTAssertEqual(result.userProfile.trainingLevel, "advanced")
        XCTAssertEqual(result.programTemplate.splitType, "push-pull-legs")
        XCTAssertEqual(result.programTemplate.daysPerWeek, 5)
    }

    func testRejectsInvalidAnswers() {
        let badLevel = OnboardingWrite(
            trainingLevel: "expert", primaryGoal: "hypertrophy",
            weeklyTrainingDays: 3, equipmentScenario: "minimal", splitType: "upper-lower")
        XCTAssertThrowsError(try makeWriter().applyOnboarding(badLevel)) { error in
            XCTAssertEqual(error as? OnboardingWriteError, .unknownTrainingLevel("expert"))
        }
        let badDays = OnboardingWrite(
            trainingLevel: "beginner", primaryGoal: "hypertrophy",
            weeklyTrainingDays: 0, equipmentScenario: "minimal", splitType: "upper-lower")
        XCTAssertThrowsError(try makeWriter().applyOnboarding(badDays)) { error in
            XCTAssertEqual(error as? OnboardingWriteError, .invalidWeeklyDays(0))
        }
    }
}
