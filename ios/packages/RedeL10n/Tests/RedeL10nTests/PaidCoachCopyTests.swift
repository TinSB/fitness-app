// Rede Coach 付费文案合同（FR-SUB1 修订）：七条能力双语齐全、未知码不露原始码。

import XCTest
@testable import RedeL10n

final class PaidCoachCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    /// 与 app 层 PaidCoachCapability.allCases 同一份清单；任何一方加能力，另一方漏了这里会红。
    private let codes = ["planAdjustment", "autoBalance", "periodization", "coachOptimization",
                         "muscleDrilldown", "estimatedMilestone", "weeklyReview"]

    func testEveryCapabilityHasBilingualTitleAndNote() {
        for code in codes {
            for pair in [(zh.paidCoachCapabilityTitle(code), en.paidCoachCapabilityTitle(code)),
                         (zh.paidCoachCapabilityNote(code), en.paidCoachCapabilityNote(code))] {
                XCTAssertFalse(pair.0.isEmpty, "缺中文：\(code)")
                XCTAssertFalse(pair.1.isEmpty, "缺英文：\(code)")
                XCTAssertNotEqual(pair.0, pair.1, "中英应不同：\(code)")
            }
        }
    }

    func testUnknownCapabilityCodeYieldsEmptyStringNotRawCode() {
        // 目录标签的老教训：兜底回退原值会在中文界面里安静露出英文码。这里回空串，调用方跳过整行。
        XCTAssertEqual(zh.paidCoachCapabilityTitle("teleportation"), "")
        XCTAssertEqual(en.paidCoachCapabilityNote("teleportation"), "")
    }

    func testPitchAndFreePromiseAreBilingual() {
        for pair in [(zh.paidCoachPitch, en.paidCoachPitch),
                     (zh.paidCoachAlwaysFree, en.paidCoachAlwaysFree),
                     (zh.paidCoachIncludedOverline, en.paidCoachIncludedOverline),
                     (zh.paidCoachPlanTeaser, en.paidCoachPlanTeaser)] {
            XCTAssertFalse(pair.0.isEmpty); XCTAssertFalse(pair.1.isEmpty)
            XCTAssertNotEqual(pair.0, pair.1)
        }
    }

    func testPlanTeaserNeverLeaksWhatWouldChange() {
        // 免费态预告只说「有一条」。出现天数、方向或数字就是泄露付费结论（FR-SUB3 纪律）。
        for teaser in [zh.paidCoachPlanTeaser, en.paidCoachPlanTeaser] {
            // 只禁阿拉伯数字：中文量词「一条」里的「一」也是 isNumber，但它不泄露任何频率。
            XCTAssertFalse(teaser.contains { $0.isASCII && $0.isNumber }, "预告行不得带数字：\(teaser)")
            for leak in ["减", "增", "天", "more", "fewer", "days", "week"] {
                XCTAssertFalse(teaser.lowercased().contains(leak.lowercased()),
                               "预告行泄露了改什么：\(teaser)")
            }
        }
    }
}
