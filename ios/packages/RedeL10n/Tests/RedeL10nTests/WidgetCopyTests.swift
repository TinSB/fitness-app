// FR-WD1 Widget 快照文案：与今日页同源（纯组装现有裁决文案）。
// 守住「widget 文案 == 今日页」不分叉：widgetHeadline/widgetAdvice 必须复用
// verdictStatus / receiptConclusion / verdictHeadline，不另写口径；禁词同样不得出现。

import Foundation
import XCTest
@testable import RedeL10n

final class WidgetCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    // 标题：有处方 = 状态 · 训练日名；无处方/空日名 = 仅状态。
    func testHeadlineWithPlanAppendsDayName() {
        XCTAssertEqual(zh.widgetHeadline(call: "train", dayName: "推力 A", hasPlan: true), "可以训练 · 推力 A")
        XCTAssertEqual(en.widgetHeadline(call: "light", dayName: "Upper", hasPlan: true), "Light day · Upper")
    }

    func testHeadlineWithoutPlanIsStatusOnly() {
        XCTAssertEqual(zh.widgetHeadline(call: "rest", dayName: "", hasPlan: false), "今天休息")
        XCTAssertEqual(en.widgetHeadline(call: "rest", dayName: "", hasPlan: false), "Rest day")
        // 即便给了日名，无处方也不拼接（休息日无训练日语义）
        XCTAssertEqual(zh.widgetHeadline(call: "rest", dayName: "推力 A", hasPlan: false), "今天休息")
    }

    // 标题与今日页状态行同源（verdictStatus 真源）。
    func testHeadlineStatusMatchesVerdictStatusSource() {
        for call in ["train", "light", "rest", "deload"] {
            XCTAssertEqual(zh.widgetHeadline(call: call, dayName: "", hasPlan: false), zh.verdictStatus(call: call))
            XCTAssertEqual(en.widgetHeadline(call: call, dayName: "", hasPlan: false), en.verdictStatus(call: call))
        }
    }

    // 短理由：有处方 = 收据结论句；无处方 = 判断句。两者都与今日页同源。
    func testAdviceWithPlanMatchesReceiptConclusion() {
        XCTAssertEqual(
            zh.widgetAdvice(call: "train", reasonCode: "normalProgression", dayName: "推力 A", gapDays: 2, consecutiveDays: nil, hasPlan: true),
            zh.receiptConclusion(call: "train", reasonCode: "normalProgression")
        )
        XCTAssertEqual(
            en.widgetAdvice(call: "train", reasonCode: "noHistoryCalibration", dayName: "Push A", gapDays: nil, consecutiveDays: nil, hasPlan: true),
            en.receiptConclusion(call: "train", reasonCode: "noHistoryCalibration")
        )
    }

    func testAdviceWithoutPlanMatchesVerdictHeadline() {
        XCTAssertEqual(
            zh.widgetAdvice(call: "rest", reasonCode: "consecutiveDaysNeedRest", dayName: "", gapDays: 1, consecutiveDays: 3, hasPlan: false),
            zh.verdictHeadline(call: "rest", reasonCode: "consecutiveDaysNeedRest", dayName: "", gapDays: 1, consecutiveDays: 3)
        )
    }

    // 禁词守卫：widget 文案同样不得出现算法名/「AI 判断」等（文案基线 §4.1）。
    func testWidgetCopyHasNoForbiddenWords() {
        let calls = ["train", "light", "rest", "deload"]
        let reasons = ["noHistoryCalibration", "normalProgression", "longGapReentry", "weeklyPlanReached",
                       "lastSessionNearFailure", "alreadyTrainedToday", "consecutiveDaysNeedRest", "sustainedLoadDeload"]
        for strings in [zh, en] {
            for call in calls {
                for reason in reasons {
                    for hasPlan in [true, false] {
                        let text = strings.widgetHeadline(call: call, dayName: "X", hasPlan: hasPlan)
                            + " " + strings.widgetAdvice(call: call, reasonCode: reason, dayName: "X", gapDays: 5, consecutiveDays: 3, hasPlan: hasPlan)
                        for banned in ["AI", "算法", "系统认为", "最佳", "algorithm", "model", "best"] {
                            XCTAssertFalse(text.contains(banned), "禁词「\(banned)」出现在: \(text)")
                        }
                    }
                }
            }
        }
    }
}
