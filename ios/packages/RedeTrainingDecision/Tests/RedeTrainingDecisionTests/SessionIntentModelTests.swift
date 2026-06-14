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
        XCTAssertEqual(candidates, ["incline-db-press", "db-bench-press", "machine-chest-press", "db-floor-press", "incline-barbell-press", "decline-barbell-press", "push-up", "hammer-chest-press", "incline-hammer-press", "smith-bench-press", "smith-incline-press", "band-chest-press"]) // wave-1/2/4/6/8/13 入族
    }

    func testReplacementExcludesSelfAndKeepsCatalogOrder() {
        let candidates = ExerciseReplacementEngine.candidates(for: "hack-squat")
        XCTAssertFalse(candidates.contains("hack-squat"))
        // FR-EQ1/wave-2 目录扩充：squat 族尾部追加，rank 序保持
        XCTAssertEqual(candidates, ["squat", "leg-press", "goblet-squat", "db-lunge", "front-squat", "bulgarian-split-squat", "bodyweight-squat", "bodyweight-lunge", "pendulum-squat", "smith-squat", "band-squat"]) // wave-8/13 入族
    }

    func testUnknownExerciseYieldsNoCandidates() {
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "no-such-exercise"), [])
    }

    func testSubstitutionGroupSoleMemberAndPairedCounts() {   // 审查 L-2 改名：同时锁单成员族与配对族
        // wave-2 后目录无单成员族——单成员语义改用构造目录锁定（族里只有自己 → 零候选）
        let solo = ExerciseCatalog(catalogVersion: "test", entries: [
            ExerciseCatalogEntry(
                id: "solo-move", movementPattern: "curl", primaryMuscle: "biceps",
                equipment: "dumbbell", kind: "isolation", substitutionGroups: ["solo-group"],
                startWeightKg: 10, rank: 0
            ),
        ])
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "solo-move", catalog: solo), [])
        // 配对族：wave-1/2 入族后的真实目录
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "leg-curl"), ["db-leg-curl", "seated-leg-curl", "hammer-leg-curl"]) // wave-3/10 入族
        // wave-10：双杠（自重 dip + 辅助 assisted-dip）入 triceps 族尾部——锁定换动作候选（审查 MAJOR）
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "triceps-pushdown"), ["close-grip-bench", "db-overhead-triceps-extension", "cable-overhead-triceps", "skullcrusher", "overhead-barbell-triceps", "cable-kickback", "assisted-dip", "dip", "weighted-dip", "band-triceps-pushdown"]) // wave-10/11/12 入族
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "lateral-raise"), ["cable-lateral-raise", "machine-lateral-raise", "band-lateral-raise"]) // wave-2/3/12 入族
        // wave-12（审查 MINOR-1）：弹力带分肩入 rear-delt 族、弹力带弯举入 biceps-curl 族——
        // 与 triceps/lateral 同口径锁定候选，防止后续往这两族追加条目时静默漂移
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "face-pull"), ["rear-delt-fly", "reverse-pec-deck", "band-pull-apart"]) // wave-12 入族
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "db-curl"), ["hammer-curl", "preacher-curl", "barbell-curl", "cable-curl", "incline-db-curl", "concentration-curl", "machine-preacher-curl", "band-curl"]) // wave-12 入族
        // wave-13：弹力带居家复合补全——划船/过头推/早安入 row/shoulder-press/hinge 族，同口径锁定候选
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "seated-row"), ["barbell-row", "one-arm-db-row", "chest-supported-db-row", "machine-row", "pendlay-row", "t-bar-row", "single-arm-cable-row", "meadows-row", "inverted-row", "hammer-row", "band-row"]) // wave-13 入族
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "shoulder-press"), ["overhead-press", "machine-shoulder-press", "arnold-press", "landmine-press", "push-press", "hammer-shoulder-press", "smith-overhead-press", "band-overhead-press"]) // wave-13 入族
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "romanian-deadlift"), ["db-rdl", "deadlift", "hip-thrust", "good-morning", "cable-pull-through", "sumo-deadlift", "band-good-morning"]) // wave-13 入族
        // 审查 M-1/Mi-2（wave-2）：直臂下压系孤立动作，不得混入复合垂直拉族——
        // 独立 lat-isolation 族（单成员）；vertical-pull 族列表显式锁定
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "lat-pulldown"), ["db-pullover", "close-grip-pulldown", "wide-grip-pulldown", "pull-up", "hammer-pulldown", "assisted-pull-up", "chin-up", "weighted-pull-up", "band-lat-pulldown"]) // wave-3/4/6/9/10/11/13 入族
        XCTAssertEqual(ExerciseReplacementEngine.candidates(for: "straight-arm-pulldown"), [])
    }

    // 排除当日已排动作（M3-3 接线合同：push-a 已含 machine-chest-press）
    func testCandidatesExcludeAlreadyScheduledExercises() {
        let candidates = ExerciseReplacementEngine.candidates(
            for: "bench-press",
            excluding: ["machine-chest-press"]
        )
        XCTAssertEqual(candidates, ["incline-db-press", "db-bench-press", "db-floor-press", "incline-barbell-press", "decline-barbell-press", "push-up", "hammer-chest-press", "incline-hammer-press", "smith-bench-press", "smith-incline-press", "band-chest-press"]) // wave-1/2/4/6/8/13 入族
    }
}
