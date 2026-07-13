// FR-NT1 通知/设置文案合同：双语非空互异 + §7.3 红线（禁鸡汤/羞辱/streak 施压/绝对承诺）。

import XCTest
@testable import RedeL10n

final class NotificationCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testBilingualNonEmptyDistinct() {
        let zhAll = [zh.notificationRestEndTitle, zh.notificationRestEndBody, zh.notificationsSectionTitle,
                     zh.notificationRestEndLabel, zh.notificationPermissionDeniedHint]
        let enAll = [en.notificationRestEndTitle, en.notificationRestEndBody, en.notificationsSectionTitle,
                     en.notificationRestEndLabel, en.notificationPermissionDeniedHint]
        for (z, e) in zip(zhAll, enAll) {
            XCTAssertFalse(z.isEmpty); XCTAssertFalse(e.isEmpty)
            XCTAssertNotEqual(z, e, "中英应不同: \(z)")
        }
    }

    // §7.3：通知文案禁鸡汤/羞辱/streak 施压/绝对承诺。
    func testNoForbiddenToneInNotificationCopy() {
        let zhTexts = [zh.notificationRestEndTitle, zh.notificationRestEndBody, zh.notificationPermissionDeniedHint]
        let enTexts = [en.notificationRestEndTitle, en.notificationRestEndBody, en.notificationPermissionDeniedHint]
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

    // FR-NT2 每周文案：两个 code 双语非空互异、未知 code 空 + 设置标签双语 + §7.3 红线。
    func testWeeklyCopyPerCodeAndSettings() {
        for code in ["weekly_new_week", "weekly_keep_pace"] {
            for s in [zh, en] {
                XCTAssertFalse(s.notificationWeeklyTitle(messageCode: code).isEmpty, "缺标题 \(code)")
                XCTAssertFalse(s.notificationWeeklyBody(messageCode: code).isEmpty, "缺正文 \(code)")
            }
            XCTAssertNotEqual(zh.notificationWeeklyTitle(messageCode: code), en.notificationWeeklyTitle(messageCode: code))
        }
        XCTAssertEqual(zh.notificationWeeklyTitle(messageCode: "made-up"), "", "未知 code 空")
        XCTAssertNotEqual(zh.notificationWeeklyLabel, en.notificationWeeklyLabel)
    }

    func testWeeklyCopyNoForbiddenTone() {
        let zhForbidden = ["别断", "断签", "别偷懒", "逆袭", "加油", "坚持住"]
        let enForbidden = ["streak", "don't break", "no excuses", "crush", "don't stop"]
        for code in ["weekly_new_week", "weekly_keep_pace"] {
            let zhText = zh.notificationWeeklyTitle(messageCode: code) + zh.notificationWeeklyBody(messageCode: code)
            let enText = (en.notificationWeeklyTitle(messageCode: code) + en.notificationWeeklyBody(messageCode: code)).lowercased()
            for w in zhForbidden { XCTAssertFalse(zhText.contains(w), "每周中文禁词 \(w)") }
            for w in enForbidden { XCTAssertFalse(enText.contains(w), "每周英文禁词 \(w)") }
        }
    }

    func testComebackCopyParityAndTone() {
        // FR-NT3（批次 F，owner 三轮定稿 Apple 风格）：三档 parity + 档 1 日名插值 +
        // 零施压红线（不出「你已经/别忘了/坚持」责备式）
        for code in ["comeback_5d", "comeback_12d", "comeback_21d"] {
            XCTAssertNotEqual(zh.comebackTitle(code: code, dayName: nil),
                              en.comebackTitle(code: code, dayName: nil), code)
            XCTAssertNotEqual(zh.comebackBody(code: code), en.comebackBody(code: code), code)
        }
        XCTAssertEqual(zh.comebackTitle(code: "comeback_5d", dayName: "推 A"), "该练推 A 了")
        XCTAssertEqual(zh.comebackTitle(code: "comeback_5d", dayName: nil), "该训练了")
        XCTAssertNotEqual(zh.notificationComebackLabel, en.notificationComebackLabel)
        let all = ["comeback_5d", "comeback_12d", "comeback_21d"].flatMap {
            [zh.comebackTitle(code: $0, dayName: "推 A"), zh.comebackBody(code: $0),
             en.comebackTitle(code: $0, dayName: "Push A"), en.comebackBody(code: $0)]
        }
        for text in all {
            for banned in ["你已经", "别忘了", "坚持", "加油", "断签", "偷懒", "逆袭", "streak",
                           "don't forget", "you haven't", "lazy"] {
                XCTAssertFalse(text.lowercased().contains(banned.lowercased()),
                               "施压词「\(banned)」: \(text)")
            }
        }
    }
}
