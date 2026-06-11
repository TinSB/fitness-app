// M3-1 验收③：跳过/替换/完成原因模型——全 typed（文案归 L10n），
// 替换候选来自 catalog 同替代族（FR-TR6 地基）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class SessionIntentModelTests: XCTestCase {
    func testSkipAndEndReasonsAreStableCodes() {
        XCTAssertEqual(SetSkipReason.equipmentBusy.rawValue, "equipmentBusy")
        XCTAssertEqual(SetSkipReason.painDiscomfort.rawValue, "painDiscomfort")
        XCTAssertEqual(SessionEndReason.completedAll.rawValue, "completedAll")
        XCTAssertEqual(SessionEndReason.pain.rawValue, "pain")
        XCTAssertEqual(SetSkipReason.allCases.count, 5)
        XCTAssertEqual(SessionEndReason.allCases.count, 5)
    }

    func testReplacementCandidatesComeFromSameSubstitutionGroup() {
        let candidates = ExerciseReplacementEngine.candidates(for: "bench-press")
        XCTAssertEqual(candidates, ["incline-db-press", "db-bench-press", "machine-chest-press"])
    }

    func testReplacementExcludesSelfAndKeepsCatalogOrder() {
        let candidates = ExerciseReplacementEngine.candidates(for: "hack-squat")
        XCTAssertFalse(candidates.contains("hack-squat"))
        // FR-EQ1 目录扩充（2026-06-11）：squat 族尾部新增哑铃选项，目录序保持
        XCTAssertEqual(candidates, ["squat", "leg-press", "goblet-squat", "db-lunge"])
    }

    func testUnknownExerciseYieldsNoCandidates() {
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "no-such-exercise"), [])
    }

    func testSoleMemberGroupReturnsNoCandidates() {
        // FR-EQ1 后 calves 族不再单成员；hamstring-curl（leg-curl）仍是单成员族
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "leg-curl"), [])
    }

    // 排除当日已排动作（M3-3 接线合同：push-a 已含 machine-chest-press）
    func testCandidatesExcludeAlreadyScheduledExercises() {
        let candidates = ExerciseReplacementEngine.candidates(
            for: "bench-press",
            excluding: ["machine-chest-press"]
        )
        XCTAssertEqual(candidates, ["incline-db-press", "db-bench-press"])
    }
}
