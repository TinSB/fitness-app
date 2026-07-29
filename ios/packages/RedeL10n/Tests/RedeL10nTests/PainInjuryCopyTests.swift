import XCTest
@testable import RedeL10n

final class PainInjuryCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testProgressionPauseReasonsMatchApprovedBilingualCopyExactly() {
        XCTAssertEqual(
            zh.progressionPausePainLine,
            "上次这个动作报过不适，这次先不加重"
        )
        XCTAssertEqual(
            en.progressionPausePainLine,
            "Discomfort was noted for this exercise last time, so it won't increase today"
        )
        XCTAssertEqual(
            zh.progressionPauseInjuryLine(bodyPartCode: "shoulder"),
            "你标记了肩膀，这个动作先不加重"
        )
        XCTAssertEqual(
            en.progressionPauseInjuryLine(bodyPartCode: "shoulder"),
            "You marked your shoulder, so this exercise won't increase today"
        )
    }

    func testBodyConditionSettingsCopyAndAllSevenPlainLanguageLabels() {
        XCTAssertEqual(zh.settingsBodyConditionLabel, "身体状况")
        XCTAssertEqual(en.settingsBodyConditionLabel, "Body areas")
        XCTAssertEqual(
            zh.settingsBodyConditionNote,
            "选了的部位，相关动作不会自动加重"
        )
        XCTAssertEqual(
            en.settingsBodyConditionNote,
            "Exercises related to selected areas won't increase automatically"
        )

        let codes = ["knee", "shoulder", "lowerBack", "elbow", "wrist", "ankle", "neck"]
        XCTAssertEqual(
            codes.map(zh.settingsBodyPartName),
            ["膝盖", "肩膀", "下背", "手肘", "手腕", "脚踝", "颈部"]
        )
        XCTAssertEqual(
            codes.map(en.settingsBodyPartName),
            ["Knee", "Shoulder", "Lower back", "Elbow", "Wrist", "Ankle", "Neck"]
        )
        XCTAssertEqual(zh.settingsBodyConditionValue(["knee", "shoulder"]), "膝盖、肩膀")
        XCTAssertEqual(en.settingsBodyConditionValue(["knee", "shoulder"]), "Knee, Shoulder")
    }

    func testNewCopyContainsNoMedicalDiagnosisTreatmentOrProtectionClaims() {
        let samples = [
            zh.progressionPausePainLine,
            en.progressionPausePainLine,
            zh.progressionPauseInjuryLine(bodyPartCode: "knee"),
            en.progressionPauseInjuryLine(bodyPartCode: "knee"),
            zh.settingsBodyConditionNote,
            en.settingsBodyConditionNote,
        ]
        let banned = [
            "你受伤了", "保护你", "诊断", "治疗", "防伤",
            "you are injured", "protect you", "diagnos", "treat", "prevent injury",
        ]
        for text in samples {
            for word in banned {
                XCTAssertFalse(
                    text.lowercased().contains(word.lowercased()),
                    "禁用医疗暗示「\(word)」出现在：\(text)"
                )
            }
        }
    }
}
