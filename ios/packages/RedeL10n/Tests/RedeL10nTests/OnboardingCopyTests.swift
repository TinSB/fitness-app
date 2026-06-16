// M5-1b 引导文案锚句 + 禁词回归（沿 TrainEngineCopy 测试模式）。

import XCTest
@testable import RedeL10n

final class OnboardingCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testOptionCodesCoverAllAndBilingual() {
        for code in ["hypertrophy", "strength", "general"] {
            XCTAssertFalse(zh.onbGoalOption(code).title.isEmpty)
            XCTAssertFalse(en.onbGoalOption(code).caption.isEmpty)
        }
        for code in ["commercial-gym", "home-dumbbell", "minimal"] {
            XCTAssertFalse(zh.onbEquipOption(code).title.isEmpty)
            XCTAssertFalse(en.onbEquipOption(code).title.isEmpty)
        }
        for code in ["beginner", "intermediate", "advanced"] {
            XCTAssertFalse(zh.onbLevelOption(code).title.isEmpty)
            XCTAssertFalse(en.onbPriorNote(code).isEmpty)
        }
    }

    func testVerdictAnchors() {
        XCTAssertEqual(
            zh.onbVerdict(splitCode: "upper-lower", days: 4, goalCode: "hypertrophy"),
            "上下分化，每周 4 天　为增肌而排"
        )
        XCTAssertEqual(
            en.onbVerdict(splitCode: "push-pull-legs", days: 5, goalCode: "strength"),
            "Push / Pull / Legs, 5 days a week — built for strength"
        )
        XCTAssertEqual(zh.onbSplitName("upper-lower"), "上下分化")
        XCTAssertEqual(en.onbSplitName("push-pull-legs"), "Push / Pull / Legs")
    }

    func testPriorNotesHonest() {
        // FR-ON2：不承诺不吹捧；三档可区分
        let notes = [zh, en].flatMap { s in
            ["beginner", "intermediate", "advanced"].map { s.onbPriorNote($0) }
        }
        XCTAssertEqual(Set(notes).count, notes.count, "三档先验说明必须可区分")
        for text in notes {
            for banned in ["保证", "最佳", "完美", "guarantee", "best", "perfect", "AI"] {
                XCTAssertFalse(text.contains(banned), "禁词「\(banned)」出现在: \(text)")
            }
        }
    }

    func testForbiddenWordsAcrossOnboardingCopy() {
        let samples: [String] = [zh, en].flatMap { s in
            [s.onbHeaderTag, s.onbFooterNote, s.onbGoalQuestion, s.onbDaysQuestion,
             s.onbEquipQuestion, s.onbLevelQuestion, s.onbLevelNote, s.onbReadyTag,
             s.onbFirstSession, s.onbOpenToday, s.onbWriteFailed, s.onbRetry,
             s.onbVerdict(splitCode: "upper-lower", days: 3, goalCode: "general")]
        }
        for text in samples {
            for banned in ["AI", "算法", "系统认为", "最佳", "algorithm", "model", "best"] {
                XCTAssertFalse(text.contains(banned), "禁词「\(banned)」出现在: \(text)")
            }
        }
    }
}
