// FR-T5 教练动作文案合同（切片6b）：三类 reasonCode 双语全覆盖 + 数值插值 +
// 红线守门（不羞辱 / 无禁词 / 补量无肌群无组数）。

import Foundation
import XCTest
@testable import RedeL10n

final class CoachActionCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    // 引擎产出的 reasonCode 清单（与 CoachActionEngine 对齐）——每个都必须有非空双语标题+正文。
    private let reasonCodes = ["dataHasFindings", "ceilingReached", "belowWeeklyPlan"]

    func testEveryReasonCodeHasBilingualTitleAndBody() {
        for code in reasonCodes {
            let zhTitle = zh.coachCardTitle(reasonCode: code, exerciseName: "引体向上")
            let enTitle = en.coachCardTitle(reasonCode: code, exerciseName: "Pull-up")
            let zhBody = zh.coachCardBody(reasonCode: code, exerciseName: "引体向上", count: 2)
            let enBody = en.coachCardBody(reasonCode: code, exerciseName: "Pull-up", count: 2)
            XCTAssertFalse(zhTitle.isEmpty, "中文缺标题: \(code)")
            XCTAssertFalse(enTitle.isEmpty, "英文缺标题: \(code)")
            XCTAssertFalse(zhBody.isEmpty, "中文缺正文: \(code)")
            XCTAssertFalse(enBody.isEmpty, "英文缺正文: \(code)")
            XCTAssertNotEqual(zhTitle, enTitle, "标题疑似漏译: \(code)")
            XCTAssertNotEqual(zhBody, enBody, "正文疑似漏译: \(code)")
        }
    }

    func testUnknownReasonCodeIsEmpty() {
        XCTAssertEqual(zh.coachCardTitle(reasonCode: "made-up"), "")
        XCTAssertEqual(en.coachCardBody(reasonCode: "made-up"), "")
    }

    func testDataReviewCountInterpolated() {
        XCTAssertTrue(zh.coachCardBody(reasonCode: "dataHasFindings", count: 3).contains("3"))
        XCTAssertTrue(en.coachCardBody(reasonCode: "dataHasFindings", count: 3).contains("3"))
    }

    func testSwapTitleCarriesExerciseName() {
        XCTAssertTrue(zh.coachCardTitle(reasonCode: "ceilingReached", exerciseName: "引体向上").contains("引体向上"))
        XCTAssertTrue(en.coachCardTitle(reasonCode: "ceilingReached", exerciseName: "Pull-up").contains("Pull-up"))
    }

    func testVolumeBoostCountIsFrequencyOnly() {
        // 频率维度：count = 本周还差几次，文案出现该次数。
        XCTAssertTrue(zh.coachCardBody(reasonCode: "belowWeeklyPlan", count: 2).contains("2"))
        XCTAssertTrue(en.coachCardBody(reasonCode: "belowWeeklyPlan", count: 2).contains("2"))
    }

    /// 英文按字母切词（去标点/数字），小写——词边界匹配，避免 "reset"/"offset"/"again" 等子串误判（审查 MINOR-1/NIT-2）。
    private func enWords(_ text: String) -> Set<String> {
        Set(text.split { !$0.isLetter }.map { $0.lowercased() })
    }

    // 红线（§6.5.2）：补量是频率维度，禁出现肌群名或组数（"组"/"set"/"sets"）。
    func testVolumeBoostCopyHasNoMuscleOrSetCount() {
        let zhText = zh.coachCardTitle(reasonCode: "belowWeeklyPlan") + zh.coachCardBody(reasonCode: "belowWeeklyPlan", count: 2)
        let enText = en.coachCardTitle(reasonCode: "belowWeeklyPlan") + en.coachCardBody(reasonCode: "belowWeeklyPlan", count: 2)
        let words = enWords(enText)
        let zhMuscles = ["胸", "背", "腿", "肩", "肱", "臀"]
        let enMuscles = ["chest", "back", "leg", "legs", "shoulder", "shoulders", "glute", "glutes", "muscle", "muscles"]
        for m in zhMuscles { XCTAssertFalse(zhText.contains(m), "补量中文不得提肌群: \(m)") }
        for m in enMuscles { XCTAssertFalse(words.contains(m), "补量英文不得提肌群: \(m)") }
        XCTAssertFalse(zhText.contains("组"), "补量中文不得提组数")
        XCTAssertFalse(words.contains("set") || words.contains("sets"), "补量英文不得提组数")
    }

    // 红线（§4.2）：禁词——算法名 / 「AI 判断」/ 「系统认为」/ 「最佳」一律不出现于任何卡。
    func testNoBannedWordsInAnyCopy() {
        let bannedZh = ["算法", "AI", "系统认为", "最佳"]
        let bannedEnWords = ["ai", "best", "optimal"]   // 词边界匹配（"ai" 不误判 "maintain"/"again"）
        let bannedEnSubstrings = ["algorithm"]
        for code in reasonCodes {
            let zhText = zh.coachCardTitle(reasonCode: code, exerciseName: "引体向上") + zh.coachCardBody(reasonCode: code, exerciseName: "引体向上", count: 2)
            let enRaw = en.coachCardTitle(reasonCode: code, exerciseName: "Pull-up") + en.coachCardBody(reasonCode: code, exerciseName: "Pull-up", count: 2)
            let enText = enRaw.lowercased()
            let words = enWords(enRaw)
            for w in bannedZh { XCTAssertFalse(zhText.contains(w), "中文出现禁词 \(w) @ \(code)") }
            for w in bannedEnWords { XCTAssertFalse(words.contains(w), "英文出现禁词 \(w) @ \(code)") }
            for w in bannedEnSubstrings { XCTAssertFalse(enText.contains(w), "英文出现禁词 \(w) @ \(code)") }
        }
    }

    func testDismissLabelBilingual() {
        XCTAssertEqual(zh.coachDismissLabel, "暂不处理")
        XCTAssertEqual(en.coachDismissLabel, "Not now")
    }
}
