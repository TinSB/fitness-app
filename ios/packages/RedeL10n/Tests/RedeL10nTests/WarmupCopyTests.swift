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

    // MARK: 训练流审查 P1：热身卡正式组目标 / 节奏 / 全身热身卡 / 设置

    func testWorkingTargetAndPace() {
        XCTAssertEqual(zh.warmupWorkingTarget("70 lb × 6"), "正式组 70 lb × 6")
        XCTAssertEqual(en.warmupWorkingTarget("70 lb × 6"), "Working set 70 lb × 6")
        XCTAssertEqual(zh.warmupPace, "歇 45–60 秒")
        XCTAssertEqual(en.warmupPace, "Rest 45–60 s")
    }

    func testGeneralWarmupCopyBilingual() {
        let zhLabels = [zh.generalWarmupTitle(upperBody: true, lowerBody: true), zh.generalWarmupDuration, zh.generalWarmupDone, zh.generalWarmupSkip,
                        zh.generalWarmupNever, zh.settingsGeneralWarmupLabel, zh.settingsGeneralWarmupNote]
        let enLabels = [en.generalWarmupTitle(upperBody: true, lowerBody: true), en.generalWarmupDuration, en.generalWarmupDone, en.generalWarmupSkip,
                        en.generalWarmupNever, en.settingsGeneralWarmupLabel, en.settingsGeneralWarmupNote]
        for (z, e) in zip(zhLabels, enLabels) {
            XCTAssertFalse(z.isEmpty); XCTAssertFalse(e.isEmpty)
            XCTAssertNotEqual(z, e, "中英应不同: \(z)")
        }
        for (upper, lower) in [(true, false), (false, true), (true, true)] {
            XCTAssertEqual(zh.generalWarmupSteps(upperBody: upper, lowerBody: lower).count, 2)
            XCTAssertEqual(en.generalWarmupSteps(upperBody: upper, lowerBody: lower).count, 2)
            XCTAssertNotEqual(zh.generalWarmupTitle(upperBody: upper, lowerBody: lower),
                              en.generalWarmupTitle(upperBody: upper, lowerBody: lower))
        }
    }

    /// 2026-10-20 owner 真机反馈：拉日的全身热身给开合跳、徒手深蹲。上肢日只活动上肢，腿日只活动下肢，不再有开合跳。
    func testGeneralWarmupFollowsTodaysBodyParts() {
        let upper = zh.generalWarmupSteps(upperBody: true, lowerBody: false).joined()
        XCTAssertTrue(upper.contains("手臂绕环"))
        XCTAssertFalse(upper.contains("深蹲"), "上肢日不做徒手深蹲")
        let lower = zh.generalWarmupSteps(upperBody: false, lowerBody: true).joined()
        XCTAssertTrue(lower.contains("徒手深蹲"))
        XCTAssertFalse(lower.contains("手臂绕环"))
        // 卡名跟着内容走：只练上肢 / 下肢的日子不叫「全身热身」（审查 2026-10-20）。
        XCTAssertEqual(zh.generalWarmupTitle(upperBody: true, lowerBody: false), "上肢热身")
        XCTAssertEqual(zh.generalWarmupTitle(upperBody: false, lowerBody: true), "下肢热身")
        XCTAssertEqual(zh.generalWarmupTitle(upperBody: true, lowerBody: true), "全身热身")
        // 升温留一个不用器械的选项（在家练没有跑步机也能做）。
        XCTAssertTrue(zh.generalWarmupSteps(upperBody: true, lowerBody: false)[0].contains("快走"))
        XCTAssertTrue(en.generalWarmupSteps(upperBody: true, lowerBody: false)[0].contains("brisk walk"))
        for s in [zh, en] {
            for (u, l) in [(true, false), (false, true), (true, true)] {
                let text = s.generalWarmupSteps(upperBody: u, lowerBody: l).joined().lowercased()
                XCTAssertFalse(text.contains("开合跳") || text.contains("jumping jack"))
            }
        }
    }

    /// 文案基线 §7.1：热身只说做什么、做多久，不许暗示防伤 / 保护 / 安全功效（机器守卫不查这类词，这里兜）。
    func testWarmupCopyMakesNoInjuryOrSafetyClaims() {
        let samples = [zh, en].flatMap { s in
            [s.generalWarmupTitle(upperBody: true, lowerBody: false), s.generalWarmupTitle(upperBody: false, lowerBody: true),
             s.generalWarmupTitle(upperBody: true, lowerBody: true), s.generalWarmupDuration, s.generalWarmupDone, s.generalWarmupSkip,
             s.generalWarmupNever, s.settingsGeneralWarmupLabel, s.settingsGeneralWarmupNote,
             s.warmupPace, s.warmupWorkingTarget("70 lb × 6"), s.warmupDone, s.warmupSkip, s.generalWarmupThenSpecific]
            + s.generalWarmupSteps(upperBody: true, lowerBody: false)
            + s.generalWarmupSteps(upperBody: false, lowerBody: true)
            + s.generalWarmupSteps(upperBody: true, lowerBody: true)
        }
        let banned = ["防伤", "预防", "受伤", "保护", "安全", "关节", "伤病",
                      "injur", "prevent", "protect", "safe", "joint", "pain-free"]
        for text in samples {
            for word in banned {
                XCTAssertFalse(text.lowercased().contains(word), "热身文案不许出现「\(word)」：\(text)")
            }
        }
    }
}
