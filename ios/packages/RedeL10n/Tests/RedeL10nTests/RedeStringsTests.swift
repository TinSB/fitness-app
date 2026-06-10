import XCTest
@testable import RedeL10n

// M0-3 双语基底测试:两套 locale 全 key 非空、locale 解析规则、关键基准句与 copy baseline 一致。

final class RedeStringsTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    private func allStrings(_ s: RedeStrings) -> [(String, String)] {
        [
            ("tabToday", s.tabToday), ("tabTrain", s.tabTrain), ("tabProgress", s.tabProgress), ("tabPlan", s.tabPlan),
            ("todayTitle", s.todayTitle), ("todayDateLine", s.todayDateLine), ("todayReadyStatus", s.todayReadyStatus),
            ("todayVerdict", s.todayVerdict), ("todayStartHere", s.todayStartHere), ("todayLoadDetail", s.todayLoadDetail),
            ("todayThenIncline", s.todayThenIncline), ("todayThenCable", s.todayThenCable), ("startTraining", s.startTraining),
            ("todayReceiptTitle", s.todayReceiptTitle), ("todayReceiptTag", s.todayReceiptTag), ("todayReceiptLine", s.todayReceiptLine),
            ("todayWhyThisCall", s.todayWhyThisCall), ("todayHideReason", s.todayHideReason),
            ("receiptSignal", s.receiptSignal), ("receiptChange", s.receiptChange), ("receiptControl", s.receiptControl),
            ("todaySignalLine", s.todaySignalLine), ("todayChangeLine", s.todayChangeLine),
            ("controlApply", s.controlApply), ("controlHold", s.controlHold), ("controlSwap", s.controlSwap),
            ("todayRailTitle", s.todayRailTitle), ("railLastDate", s.railLastDate), ("railToday", s.railToday), ("railNext", s.railNext),
            ("trainDayTitle", s.trainDayTitle), ("trainProgressLine", s.trainProgressLine), ("trainFinish", s.trainFinish),
            ("trainWhyLine", s.trainWhyLine), ("trainHold185", s.trainHold185), ("trainLogSet", s.trainLogSet),
            ("trainColSet", s.trainColSet), ("trainColWeight", s.trainColWeight), ("trainColReps", s.trainColReps), ("trainColRir", s.trainColRir),
            ("trainNextUp", s.trainNextUp),
            ("progressTitle", s.progressTitle), ("scaleSession", s.scaleSession), ("scaleWeek", s.scaleWeek), ("scaleCycle", s.scaleCycle),
            ("sessionChartTitle", s.sessionChartTitle),
            ("planTitle", s.planTitle), ("planPhaseLine", s.planPhaseLine),
            ("planMonDone", s.planMonDone), ("planWedDone", s.planWedDone), ("planFriToday", s.planFriToday), ("planSunNext", s.planSunNext),
            ("planPushA", s.planPushA), ("planPullA", s.planPullA), ("planPushB", s.planPushB), ("planLegs", s.planLegs),
            ("planPushAMeta", s.planPushAMeta), ("planPullAMeta", s.planPullAMeta), ("planTodayMeta", s.planTodayMeta), ("planLegsMeta", s.planLegsMeta),
            ("planControlsTitle", s.planControlsTitle), ("planHoldTitle", s.planHoldTitle), ("planHoldSub", s.planHoldSub),
            ("planLockTitle", s.planLockTitle), ("planLockSub", s.planLockSub),
            ("settingsTitle", s.settingsTitle), ("settingsLanguage", s.settingsLanguage),
            ("settingsDone", s.settingsDone), ("settingsUnit", s.settingsUnit),
            ("settingsBackground", s.settingsBackground), ("settingsEditAnswers", s.settingsEditAnswers),
            ("settingsDaysValue", s.settingsDaysValue(4)), ("settingsData", s.settingsData),
            ("settingsExportNote", s.settingsExportNote), ("settingsAbout", s.settingsAbout),
            ("settingsDisclaimer", s.settingsDisclaimer), ("settingsFeedback", s.settingsFeedback),
            ("exerciseBenchPress", s.exerciseBenchPress),
        ]
    }

    func testAllKeysNonEmptyInBothLocales() {
        for (key, value) in allStrings(zh) {
            XCTAssertFalse(value.trimmingCharacters(in: .whitespaces).isEmpty, "zh \(key) 为空")
        }
        for (key, value) in allStrings(en) {
            XCTAssertFalse(value.trimmingCharacters(in: .whitespaces).isEmpty, "en \(key) 为空")
        }
    }

    func testLocaleResolution() {
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: "zh"), .zh)
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: "zh-Hans"), .zh)
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: "zh-Hant-TW"), .zh)
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: "ZH-HANS"), .zh)
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: "en"), .en)
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: "en-US"), .en)
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: "ja"), .en)
        XCTAssertEqual(RedeLocale.resolve(fromLanguageCode: nil), .en)
    }

    func testCopyBaselineAnchors() {
        // copy baseline 基准句:带练句「完成本组」/「查看依据」;tab 名与商业 IA 一致
        XCTAssertEqual(zh.trainLogSet, "完成本组")
        XCTAssertEqual(zh.todayWhyThisCall, "查看依据")
        XCTAssertEqual(zh.tabToday, "今日")
        XCTAssertEqual(zh.tabTrain, "训练")
        XCTAssertEqual(zh.tabProgress, "进展")
        XCTAssertEqual(zh.tabPlan, "计划")
        XCTAssertEqual(en.trainLogSet, "Log set")
        XCTAssertEqual(en.todayWhyThisCall, "Why this call")
    }

    func testZhEnDifferWhereExpected() {
        // 抽样:双语不是同一份表(允许 lb/RIR 等术语两边一致)
        XCTAssertNotEqual(zh.todayVerdict, en.todayVerdict)
        XCTAssertNotEqual(zh.trainLogSet, en.trainLogSet)
        XCTAssertNotEqual(zh.progressEmptyTitle, en.progressEmptyTitle)
        XCTAssertNotEqual(zh.planControlsTitle, en.planControlsTitle)
    }

    func testUiShortPhrasesHaveNoTrailingPeriod() {
        // UI 短语不收句号(copy baseline §3.4);判断句/收据句不在此列
        let shortPhrases: [String] = [
            zh.tabToday, zh.tabTrain, zh.tabProgress, zh.tabPlan,
            zh.startTraining, zh.trainLogSet, zh.trainFinish, zh.trainHold185,
            zh.todayWhyThisCall, zh.todayHideReason, zh.controlApply, zh.controlHold, zh.controlSwap,
            zh.settingsTitle, zh.settingsLanguage, zh.settingsDone,
            en.startTraining, en.trainLogSet, en.trainFinish, en.trainHold185,
            en.todayWhyThisCall, en.todayHideReason,
        ]
        for phrase in shortPhrases {
            XCTAssertFalse(phrase.hasSuffix("。") || phrase.hasSuffix("."), "短语不应收句号: \(phrase)")
        }
    }
}
