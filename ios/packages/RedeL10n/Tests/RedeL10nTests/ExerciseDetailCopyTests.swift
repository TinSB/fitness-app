// FR-EX2 动作详情文案：码→双语标签全覆盖 + 未知回退 + 双语锚句。
// 码清单来自 exercises.json（wave-15）distinct 值——每个码必须有标签（不得回退成原值）。

import Foundation
import XCTest
@testable import RedeL10n

final class ExerciseDetailCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    // 目录现有 distinct 码——每个都必须被标签覆盖（label != code）。新增内容码若漏配标签，这里报红。
    private let patternCodes = ["horizontal-press", "incline-press", "vertical-press", "horizontal-pull",
                                "vertical-pull", "squat-pattern", "hinge", "knee-extension", "knee-flexion",
                                "calf-raise", "curl", "triceps-extension", "lateral-raise", "rear-delt",
                                "fly", "shrug", "core"]
    private let muscleCodes = ["chest", "back", "upper-back", "lower-back", "shoulder", "front-delt",
                               "side-delt", "rear-delt", "biceps", "triceps", "forearm", "traps", "core",
                               "quads", "hamstrings", "glutes", "calves"]
    private let equipmentCodes = ["barbell", "dumbbell", "cable", "band", "bodyweight",
                                  "plate-loaded", "selectorized", "smith"]
    private let kindCodes = ["compound", "isolation", "accessory"]

    func testEveryCatalogCodeHasBilingualLabel() {
        for code in patternCodes {
            XCTAssertNotEqual(zh.movementPatternLabel(code), code, "中文缺模式标签: \(code)")
            XCTAssertNotEqual(en.movementPatternLabel(code), code, "英文缺模式标签: \(code)")
        }
        for code in muscleCodes {
            XCTAssertNotEqual(zh.muscleLabel(code), code, "中文缺肌群标签: \(code)")
            XCTAssertNotEqual(en.muscleLabel(code), code, "英文缺肌群标签: \(code)")
        }
        for code in equipmentCodes {
            XCTAssertNotEqual(zh.equipmentLabel(code), code, "中文缺器械标签: \(code)")
            XCTAssertNotEqual(en.equipmentLabel(code), code, "英文缺器械标签: \(code)")
        }
        for code in kindCodes {
            XCTAssertNotEqual(zh.exerciseKindLabel(code), code, "中文缺类型标签: \(code)")
            XCTAssertNotEqual(en.exerciseKindLabel(code), code, "英文缺类型标签: \(code)")
        }
    }

    func testAnchors() {
        XCTAssertEqual(zh.equipmentLabel("barbell"), "杠铃")
        XCTAssertEqual(en.equipmentLabel("barbell"), "Barbell")
        XCTAssertEqual(zh.muscleLabel("chest"), "胸")
        XCTAssertEqual(en.exerciseKindLabel("compound"), "Compound")
        XCTAssertEqual(zh.movementPatternLabel("hinge"), "髋铰链")
    }

    func testUnknownCodeFallsBackToRaw() {
        XCTAssertEqual(zh.muscleLabel("made-up"), "made-up")
        XCTAssertEqual(en.equipmentLabel("zzz"), "zzz")
    }

    func testMuscleListJoin() {
        XCTAssertEqual(zh.muscleListLabel(["chest", "triceps"]), "胸 · 肱三头")
        XCTAssertEqual(en.muscleListLabel(["chest", "triceps"]), "Chest · Triceps")
        XCTAssertEqual(zh.muscleListLabel([]), "")
    }

    func testSectionTitlesBilingual() {
        XCTAssertEqual(zh.exerciseDetailAlternatives, "替代动作")
        XCTAssertEqual(en.exerciseDetailAlternatives, "Alternatives")
        // 其余 7 个标题/提示：双语均非空且中英不同（拼写/漏配会报红，审查 Minor-3）。
        let zhTitles = [zh.exerciseDetailPattern, zh.exerciseDetailPrimary, zh.exerciseDetailSecondary,
                        zh.exerciseDetailEquipment, zh.exerciseDetailType, zh.exerciseDetailNoAlternatives,
                        zh.exerciseDetailHint]
        let enTitles = [en.exerciseDetailPattern, en.exerciseDetailPrimary, en.exerciseDetailSecondary,
                        en.exerciseDetailEquipment, en.exerciseDetailType, en.exerciseDetailNoAlternatives,
                        en.exerciseDetailHint]
        for (zhText, enText) in zip(zhTitles, enTitles) {
            XCTAssertFalse(zhText.isEmpty, "中文标题为空")
            XCTAssertFalse(enText.isEmpty, "英文标题为空")
            XCTAssertNotEqual(zhText, enText, "中英标题相同（疑似漏译）: \(zhText)")
        }
    }

    // K2 动作库（2026-07-16）：标题 + 计划页入口行（中西混排空格、zh 无句号、en 单复数分流）。
    func testExerciseLibraryStrings() {
        XCTAssertEqual(zh.exerciseLibraryTitle, "动作库")
        XCTAssertEqual(en.exerciseLibraryTitle, "Exercise library")
        XCTAssertEqual(zh.exerciseLibraryEntry(165), "动作库 · 165 个动作")
        XCTAssertEqual(en.exerciseLibraryEntry(165), "Exercise library · 165 exercises")
        XCTAssertEqual(en.exerciseLibraryEntry(1), "Exercise library · 1 exercise")
    }
}
