// FR-TR10 热身文案合同：双语非空、互异 + 进度/重量插值。

import XCTest
@testable import RedeL10n

final class WarmupCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testLabelsBilingualNonEmpty() {
        let zhLabels = [zh.warmupEmptyBar, zh.warmupMovementPrep, zh.warmupDone, zh.warmupSkip]
        let enLabels = [en.warmupEmptyBar, en.warmupMovementPrep, en.warmupDone, en.warmupSkip]
        for (z, e) in zip(zhLabels, enLabels) {
            XCTAssertFalse(z.isEmpty); XCTAssertFalse(e.isEmpty)
            XCTAssertNotEqual(z, e, "中英应不同: \(z)")
        }
    }

    func testProgressInterpolates() {
        XCTAssertEqual(zh.warmupProgress(index: 2, total: 4), "热身 2/4")
        XCTAssertEqual(en.warmupProgress(index: 2, total: 4), "Warm-up 2/4")
    }

    func testRepsAndWeight() {
        XCTAssertEqual(zh.warmupReps(8), "×8")
        XCTAssertTrue(zh.warmupWeight(60).contains("60"), "重量行含数值")
    }
}
