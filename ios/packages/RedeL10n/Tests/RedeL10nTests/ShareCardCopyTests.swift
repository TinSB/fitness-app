// FR-SH1 分享卡文案：时长档数值/单位分离锚句（T5 2026-07-05）。
// 卡面三列 stat 同构「大数字 + overline 标签」，时长档完整串（"60–90 min"）在
// 30pt 等分列宽下必破行——value 只含数字区间，单位独立成段小字号渲染。

import Foundation
import XCTest
@testable import RedeL10n

final class ShareCardCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testDurationBandValueIsUnitFree() {
        XCTAssertEqual(zh.shareCardDurationBandValue(.m60to90), "60–90")
        XCTAssertEqual(en.shareCardDurationBandValue(.m60to90), "60–90")
        XCTAssertEqual(zh.shareCardDurationBandValue(.under30), "<30")
        XCTAssertEqual(en.shareCardDurationBandValue(.under30), "<30")
        XCTAssertEqual(zh.shareCardDurationBandValue(.m30to45), "30–45")
        XCTAssertEqual(en.shareCardDurationBandValue(.m45to60), "45–60")
        XCTAssertEqual(zh.shareCardDurationBandValue(.over90), ">90")
        XCTAssertEqual(en.shareCardDurationBandValue(.over90), ">90")
        // 数值段不得混入单位（拆分即为此；防误拼回归）
        for t in [zh, en] {
            for band in allBands {
                XCTAssertFalse(t.shareCardDurationBandValue(band).contains(t.shareCardDurationUnit))
            }
        }
    }

    func testDurationUnitBothLocales() {
        XCTAssertEqual(zh.shareCardDurationUnit, "分")
        XCTAssertEqual(en.shareCardDurationUnit, "min")
    }

    /// 列宽契约（审查 MAJOR 2026-07-05）：卡面时长列 fixedSize 按内容取宽、纯数字列
    /// 均分剩余——该方案假设档位数值段 ≤5 字符（现最长 "60–90"）。更长档位会静默
    /// 挤压邻列到截断（独立探测实测 "120–180" 时 "999" 裁成 "9…"）。新增档位或改措辞
    /// 触发本断言时，先回 ShareCard.swift 复核三列列宽分配，不许直接放宽上限。
    func testDurationBandValueWidthContract() {
        for t in [zh, en] {
            for band in allBands {
                XCTAssertLessThanOrEqual(t.shareCardDurationBandValue(band).count, 5)
            }
        }
    }

    func testMLEConsumptionCardCopyExactBothLocales() {
        XCTAssertEqual(zh.shareCardLevelUpTitle, "等级变化")
        XCTAssertEqual(en.shareCardLevelUpTitle, "Level update")
        XCTAssertEqual(zh.shareCardBalanceTitle, "均衡改善")
        XCTAssertEqual(en.shareCardBalanceTitle, "Balance improved")
        XCTAssertEqual(zh.shareCardMilestoneTitle, "力量里程碑")
        XCTAssertEqual(en.shareCardMilestoneTitle, "Strength milestone")
        XCTAssertEqual(zh.shareCardRecentTrainingDays(9), "近 4 周训练 9 天")
        XCTAssertEqual(en.shareCardRecentTrainingDays(9), "9 training days in 4 weeks")
        XCTAssertEqual(zh.shareCardBalanceChange(from: 71, to: 82), "均衡度 71 → 82")
        XCTAssertEqual(en.shareCardBalanceChange(from: 71, to: 82), "Balance 71 → 82")
        XCTAssertEqual(zh.shareCardImprovingDirection(["背部", "腿前侧"]), "正在补足 背部 · 腿前侧")
        XCTAssertEqual(en.shareCardImprovingDirection(["Back", "Quads"]), "Building Back · Quads")
    }

    func testMLEConsumptionCardCopyHasNoHypeShameConfidenceOrTerminalPunctuation() {
        let values = [
            zh.shareCardLevelUpTitle,
            en.shareCardLevelUpTitle,
            zh.shareCardBalanceTitle,
            en.shareCardBalanceTitle,
            zh.shareCardMilestoneTitle,
            en.shareCardMilestoneTitle,
            zh.shareCardRecentTrainingDays(9),
            en.shareCardRecentTrainingDays(9),
            zh.shareCardBalanceChange(from: 71, to: 82),
            en.shareCardBalanceChange(from: 71, to: 82),
            zh.shareCardImprovingDirection(["背部"]),
            en.shareCardImprovingDirection(["Back"]),
        ]
        let forbidden = ["干得漂亮", "恭喜", "最弱", "置信", "great job", "congrat", "weakest", "confidence"]
        for value in values {
            let lower = value.lowercased()
            XCTAssertFalse(value.hasSuffix("。"), value)
            XCTAssertFalse(value.hasSuffix("."), value)
            XCTAssertFalse(value.contains("!"), value)
            XCTAssertFalse(value.contains("！"), value)
            XCTAssertFalse(value.contains("—"), value)
            for word in forbidden {
                XCTAssertFalse(lower.contains(word), "\(value) 不应含 \(word)")
            }
        }
    }

    private var allBands: [ShareDurationBandLabel] { [.under30, .m30to45, .m45to60, .m60to90, .over90] }
}
