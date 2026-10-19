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
        let zhLabels = [zh.generalWarmupTitle, zh.generalWarmupDuration, zh.generalWarmupDone, zh.generalWarmupSkip,
                        zh.generalWarmupNever, zh.settingsGeneralWarmupLabel, zh.settingsGeneralWarmupNote]
        let enLabels = [en.generalWarmupTitle, en.generalWarmupDuration, en.generalWarmupDone, en.generalWarmupSkip,
                        en.generalWarmupNever, en.settingsGeneralWarmupLabel, en.settingsGeneralWarmupNote]
        for (z, e) in zip(zhLabels, enLabels) {
            XCTAssertFalse(z.isEmpty); XCTAssertFalse(e.isEmpty)
            XCTAssertNotEqual(z, e, "中英应不同: \(z)")
        }
        XCTAssertEqual(zh.generalWarmupSteps.count, 2)
        XCTAssertEqual(en.generalWarmupSteps.count, zh.generalWarmupSteps.count)
    }

    /// 文案基线 §7.1：热身只说做什么、做多久，不许暗示防伤 / 保护 / 安全功效（机器守卫不查这类词，这里兜）。
    func testWarmupCopyMakesNoInjuryOrSafetyClaims() {
        let samples = [zh, en].flatMap { s in
            [s.generalWarmupTitle, s.generalWarmupDuration, s.generalWarmupDone, s.generalWarmupSkip,
             s.generalWarmupNever, s.settingsGeneralWarmupLabel, s.settingsGeneralWarmupNote,
             s.warmupPace, s.warmupWorkingTarget("70 lb × 6"), s.warmupDone, s.warmupSkip]
            + s.generalWarmupSteps
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
