// watchOS 表 app 文案合同：双语非空、互异 + 进度/排队插值。

import XCTest
@testable import RedeL10n

final class WatchCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testLabelsBilingualNonEmpty() {
        let zhLabels = [zh.watchLogged, zh.watchRestPaused, zh.watchPhoneUnreachable,
                        zh.watchRestDay, zh.watchFetchingPlan, zh.watchOpenPhone]
        let enLabels = [en.watchLogged, en.watchRestPaused, en.watchPhoneUnreachable,
                        en.watchRestDay, en.watchFetchingPlan, en.watchOpenPhone]
        for (z, e) in zip(zhLabels, enLabels) {
            XCTAssertFalse(z.isEmpty); XCTAssertFalse(e.isEmpty)
            XCTAssertNotEqual(z, e, "中英应不同: \(z)")
        }
    }

    func testProgressIsCompactEnoughForTheWatch() {
        XCTAssertEqual(zh.watchProgress(exercise: 3, exerciseTotal: 6, set: 2, setTotal: 4), "3/6 · 第 2/4 组")
        XCTAssertEqual(en.watchProgress(exercise: 3, exerciseTotal: 6, set: 2, setTotal: 4), "3/6 · Set 2/4")
    }

    func testPendingSetsPluralizes() {
        XCTAssertEqual(zh.watchPendingSets(1), "1 组待同步")
        XCTAssertEqual(en.watchPendingSets(1), "1 set queued")
        XCTAssertEqual(en.watchPendingSets(3), "3 sets queued")
    }

    func testStalePlanShowsMonthDayOnly() {
        XCTAssertEqual(zh.watchStalePlan(dateISO: "2026-08-14"), "08-14 的计划")
        XCTAssertEqual(en.watchStalePlan(dateISO: "2026-08-14"), "Plan for 08-14")
    }

    func testDoneTodayAndHealthGateBilingual() {
        XCTAssertEqual(zh.watchDoneToday(sets: 22), "今天练完了 · 22 组")
        XCTAssertEqual(en.watchDoneToday(sets: 1), "Done for today · 1 set")
        XCTAssertEqual(en.watchDoneToday(sets: 22), "Done for today · 22 sets")
        for (z, e) in [(zh.watchHealthGateTitle, en.watchHealthGateTitle), (zh.watchHealthGateBody, en.watchHealthGateBody),
                       (zh.watchHealthGateAllow, en.watchHealthGateAllow), (zh.watchHealthGateDeniedBody, en.watchHealthGateDeniedBody),
                       (zh.watchHealthGateRecheck, en.watchHealthGateRecheck)] {
            XCTAssertFalse(z.isEmpty); XCTAssertFalse(e.isEmpty); XCTAssertNotEqual(z, e)
        }
    }

    func testNextUpPrefixesTarget() {
        XCTAssertEqual(zh.watchNextUp("60 kg × 8"), "下一组 60 kg × 8")
        XCTAssertEqual(en.watchNextUp("60 kg × 8"), "Next 60 kg × 8")
    }
}
