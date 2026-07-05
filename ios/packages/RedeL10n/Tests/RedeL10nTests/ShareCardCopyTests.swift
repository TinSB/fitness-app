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

    private var allBands: [ShareDurationBandLabel] { [.under30, .m30to45, .m45to60, .m60to90, .over90] }
}
