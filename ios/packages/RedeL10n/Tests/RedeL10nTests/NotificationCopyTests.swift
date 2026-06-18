// FR-NT1 通知/设置文案合同：双语非空互异 + §7.3 红线（禁鸡汤/羞辱/streak 施压/绝对承诺）。

import XCTest
@testable import RedeL10n

final class NotificationCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testBilingualNonEmptyDistinct() {
        let zhAll = [zh.notificationRestEndTitle, zh.notificationRestEndBody, zh.notificationsSectionTitle,
                     zh.notificationRestEndLabel, zh.notificationRestEndHint, zh.notificationPermissionDeniedHint]
        let enAll = [en.notificationRestEndTitle, en.notificationRestEndBody, en.notificationsSectionTitle,
                     en.notificationRestEndLabel, en.notificationRestEndHint, en.notificationPermissionDeniedHint]
        for (z, e) in zip(zhAll, enAll) {
            XCTAssertFalse(z.isEmpty); XCTAssertFalse(e.isEmpty)
            XCTAssertNotEqual(z, e, "中英应不同: \(z)")
        }
    }

    // §7.3：通知文案禁鸡汤/羞辱/streak 施压/绝对承诺。
    func testNoForbiddenToneInNotificationCopy() {
        let zhTexts = [zh.notificationRestEndTitle, zh.notificationRestEndBody, zh.notificationRestEndHint, zh.notificationPermissionDeniedHint]
        let enTexts = [en.notificationRestEndTitle, en.notificationRestEndBody, en.notificationRestEndHint, en.notificationPermissionDeniedHint]
        let zhForbidden = ["继续坚持", "别停", "别偷懒", "逆袭", "断签", "加油", "最佳"]
        let enForbidden = ["don't stop", "keep going", "no excuses", "streak", "crush", "don't break", "best"]
        for t in zhTexts {
            for w in zhForbidden { XCTAssertFalse(t.contains(w), "中文出现禁词 \(w): \(t)") }
        }
        for t in enTexts {
            let lower = t.lowercased()
            for w in enForbidden { XCTAssertFalse(lower.contains(w), "英文出现禁词 \(w): \(t)") }
        }
    }
}
