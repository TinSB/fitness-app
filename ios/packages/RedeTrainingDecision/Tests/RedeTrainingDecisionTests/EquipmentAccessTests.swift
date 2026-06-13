// FR-EQ1 补课（2026-06-11）：器械场景从「只落档」变「真消费」。
// 合同：场景白名单硬过滤候选（home-dumbbell/minimal → 仅 dumbbell）；
// 槽位 equipment / machine-kind 偏好与白名单冲突时软化（保 pattern 匹配可用器械）；
// 无法满足的槽位如实记 slotUnfilled；commercial-gym / 缺失 / 未知场景 = 不过滤
// （既有 golden 行为不动）。换动作候选同样守白名单（修所有受影响表面）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class EquipmentAccessTests: XCTestCase {
    // MARK: - 工具

    private func json(scenario: String?, historyDates: [String] = [], split: String = "push-pull-legs") -> String {
        var parts = [
            "\"schemaVersion\": 8",
            "\"history\": \(TestSupport.historyJSON(dates: historyDates))",
            #""programTemplate": {"splitType": "\#(split)", "daysPerWeek": 5}"#,
        ]
        if let scenario {
            parts.append(#""userProfile": {"equipmentScenario": "\#(scenario)"}"#)
        }
        return "{" + parts.joined(separator: ", ") + "}"
    }

    private func plan(scenario: String?, historyDates: [String] = [], today: String, split: String = "push-pull-legs") throws -> TodayPrescription? {
        let input = try TestSupport.makeInput(appDataJSON: json(scenario: scenario, historyDates: historyDates, split: split), todayISO: today)
        return TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input))
    }

    private func equipments(_ prescription: TodayPrescription, catalog: ExerciseCatalog = .minimal) -> Set<String> {
        Set(prescription.exercises.compactMap { catalog.entry(id: $0.exerciseId)?.equipment })
    }

    // MARK: - 白名单映射

    func testAllowedMapping() {
        XCTAssertNil(EquipmentAccess.allowed(for: "commercial-gym"))
        XCTAssertEqual(EquipmentAccess.allowed(for: "home-dumbbell"), ["dumbbell"])
        XCTAssertEqual(EquipmentAccess.allowed(for: "minimal"), ["dumbbell"])
        XCTAssertNil(EquipmentAccess.allowed(for: nil))
        XCTAssertNil(EquipmentAccess.allowed(for: "spaceship")) // 未知不瞎过滤
    }

    // MARK: - 处方过滤

    // 家用哑铃 · 推力日：全部动作必须是 dumbbell；fly/triceps 槽由哑铃条目补位
    func testHomeDumbbellPushDayIsAllDumbbell() throws {
        let prescription = try XCTUnwrap(try plan(scenario: "home-dumbbell", today: "2026-06-11"))
        XCTAssertEqual(prescription.dayCode, "push-a")
        XCTAssertEqual(equipments(prescription), ["dumbbell"])
        let ids = prescription.exercises.map(\.exerciseId)
        XCTAssertTrue(ids.contains("db-bench-press"))
        XCTAssertTrue(ids.contains("db-floor-press")) // wave-1：第二平推槽已清（审查 M-1）
        XCTAssertTrue(ids.contains("db-fly"))
        XCTAssertTrue(ids.contains("db-overhead-triceps-extension"))
    }

    // 家用哑铃 · 腿日：深蹲模式由 goblet-squat/db-lunge 补位；knee-flexion 由 wave-1 db-leg-curl 补位
    func testHomeDumbbellLegDayCoverage() throws {
        let prescription = try XCTUnwrap(try plan(
            scenario: "home-dumbbell",
            historyDates: ["2026-06-08", "2026-06-09"], // 2 场 → legs-a
            today: "2026-06-11"
        ))
        XCTAssertEqual(prescription.dayCode, "legs-a")
        XCTAssertEqual(equipments(prescription), ["dumbbell"])
        let ids = prescription.exercises.map(\.exerciseId)
        XCTAssertTrue(ids.contains("goblet-squat"))
        XCTAssertTrue(ids.contains("db-rdl"))
        XCTAssertTrue(ids.contains("db-lunge"))
        XCTAssertTrue(ids.contains("db-calf-raise"))
        XCTAssertTrue(ids.contains("db-leg-curl")) // wave-1：knee-flexion 缺口已清
        XCTAssertFalse(prescription.dayReasons.contains(.slotUnfilled(pattern: "knee-flexion")))
        // wave-5（审查 M-1）：腿屈伸仅选重机，家用预期缺口（正面锁定，与覆盖矩阵双保险）
        XCTAssertTrue(prescription.dayReasons.contains(.slotUnfilled(pattern: "knee-extension")))
        XCTAssertTrue(ids.contains("db-crunch")) // 腹肌槽有哑铃版（db-crunch），家用可填
    }

    // 家用哑铃 · 拉力日：垂直拉由 db-pullover 补位，rear-delt 由 rear-delt-fly 补位
    func testHomeDumbbellPullDayCoverage() throws {
        let prescription = try XCTUnwrap(try plan(
            scenario: "home-dumbbell",
            historyDates: ["2026-06-09"], // 1 场 → pull-a
            today: "2026-06-11"
        ))
        XCTAssertEqual(prescription.dayCode, "pull-a")
        XCTAssertEqual(equipments(prescription), ["dumbbell"])
        let ids = prescription.exercises.map(\.exerciseId)
        XCTAssertTrue(ids.contains("db-pullover"))
        XCTAssertTrue(ids.contains("rear-delt-fly"))
        XCTAssertTrue(ids.contains("chest-supported-db-row")) // wave-1：第二划船槽已清
    }

    // 审查 M-1：upper/lower 分化同样锁定（防槽位/目录顺序静默变化）
    func testHomeDumbbellUpperDayAllSlotsFilled() throws {
        let prescription = try XCTUnwrap(try plan(scenario: "home-dumbbell", today: "2026-06-11", split: "upper-lower"))
        XCTAssertEqual(prescription.dayCode, "upper")
        XCTAssertEqual(prescription.exercises.count, 8) // wave-5：+shrug（db-shrug 家用可填）
        XCTAssertEqual(equipments(prescription), ["dumbbell"])
        XCTAssertTrue(prescription.exercises.map(\.exerciseId).contains("db-pullover"))
        XCTAssertFalse(prescription.dayReasons.contains { if case .slotUnfilled = $0 { return true }; return false })
    }

    func testHomeDumbbellLowerDayCoverage() throws {
        let prescription = try XCTUnwrap(try plan(
            scenario: "home-dumbbell", historyDates: ["2026-06-09"], today: "2026-06-11", split: "upper-lower"
        ))
        XCTAssertEqual(prescription.dayCode, "lower")
        XCTAssertEqual(equipments(prescription), ["dumbbell"])
        let ids = prescription.exercises.map(\.exerciseId)
        XCTAssertTrue(ids.contains("goblet-squat"))
        XCTAssertTrue(ids.contains("db-lunge")) // usedIds 防重：两个深蹲槽各取其一
        XCTAssertTrue(ids.contains("db-leg-curl")) // wave-1：knee-flexion 缺口已清
        XCTAssertFalse(prescription.dayReasons.contains(.slotUnfilled(pattern: "knee-flexion")))
        // wave-5（审查 M-1）：腿屈伸仅选重机，家用预期缺口（正面锁定，与覆盖矩阵双保险）
        XCTAssertTrue(prescription.dayReasons.contains(.slotUnfilled(pattern: "knee-extension")))
        XCTAssertTrue(ids.contains("db-crunch")) // 腹肌槽有哑铃版（db-crunch），家用可填
    }

    // 审查 M-3：minimal 场景端到端（与 home-dumbbell 同白名单，仍单独锁一条）
    func testMinimalScenarioPushDayIsAllDumbbell() throws {
        let prescription = try XCTUnwrap(try plan(scenario: "minimal", today: "2026-06-11"))
        XCTAssertEqual(equipments(prescription), ["dumbbell"])
    }

    // commercial-gym 与 无场景：处方完全一致（新条目附加在目录尾部，first-match 不变 → golden 稳定）
    func testCommercialGymMatchesNoScenario() throws {
        let withScenario = try XCTUnwrap(try plan(scenario: "commercial-gym", today: "2026-06-11"))
        let without = try XCTUnwrap(try plan(scenario: nil, today: "2026-06-11"))
        XCTAssertEqual(withScenario.exercises.map(\.exerciseId), without.exercises.map(\.exerciseId))
        XCTAssertEqual(withScenario.dayReasons, without.dayReasons)
    }

    // MARK: - 换动作候选同守白名单

    func testReplacementCandidatesRespectAllowedEquipment() {
        let all = ExerciseReplacementEngine.candidates(for: "db-bench-press")
        XCTAssertTrue(all.contains("machine-chest-press")) // 不过滤时含器械
        let home = ExerciseReplacementEngine.candidates(for: "db-bench-press", allowedEquipment: ["dumbbell"])
        XCTAssertFalse(home.contains("machine-chest-press"))
        XCTAssertFalse(home.contains("bench-press")) // barbell
        XCTAssertTrue(home.contains("incline-db-press"))
    }

    // MARK: - DataHealth 投影：未知场景不进引擎

    func testUnknownScenarioProjectedToNilWithIssue() throws {
        let appDataJSON = #"{"schemaVersion": 8, "userProfile": {"equipmentScenario": "spaceship"}}"#
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: "2026-06-11")
        XCTAssertNil(input.profile.equipmentScenario)
    }

    func testKnownScenarioSurvivesProjection() throws {
        let appDataJSON = #"{"schemaVersion": 8, "userProfile": {"equipmentScenario": "home-dumbbell"}}"#
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: "2026-06-11")
        XCTAssertEqual(input.profile.equipmentScenario, "home-dumbbell")
    }
}
