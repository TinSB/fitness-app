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
            ("planTitle", s.planTitle), ("planEmptyHeadline", s.planEmptyHeadline),
            ("planEmptyNote", s.planEmptyNote),
            ("planTemplateLine", s.planTemplateLine(splitName: s.onbSplitName("upper-lower"), days: 4)),
            ("settingsTitle", s.settingsTitle), ("settingsLanguage", s.settingsLanguage),
            ("settingsDone", s.settingsDone), ("settingsUnit", s.settingsUnit),
            ("settingsBackground", s.settingsBackground), ("settingsPlateHint", s.settingsPlateHint),
            ("onbEditSave", s.onbEditSave), ("onbEditCancel", s.onbEditCancel),
            ("onbDaysNote", s.onbDaysNote), ("onbEquipEcho", s.onbEquipEcho("commercial-gym")),
            ("onbEquipEchoHome", s.onbEquipEcho("home-dumbbell")), ("onbEquipEchoMinimal", s.onbEquipEcho("minimal")),
            ("onbA11yAnswered", s.onbA11yAnswered), ("onbA11yCurrent", s.onbA11yCurrent),
            ("settingsDaysValue", s.settingsDaysValue(4)), ("settingsData", s.settingsData),
            ("settingsExportNote", s.settingsExportNote), ("settingsAbout", s.settingsAbout),
            ("settingsPrivacy", s.settingsPrivacy), ("settingsPrivacyNote", s.settingsPrivacyNote),
            ("settingsPanelOverline", s.settingsPanelOverline),
            ("settingsDisclaimer", s.settingsDisclaimer), ("settingsFeedback", s.settingsFeedback),
            ("feedbackSubject", s.feedbackSubject(version: "0.1.0")),
            ("feedbackBodyPrompt", s.feedbackBodyPrompt),
            ("feedbackFallback", s.feedbackFallback(address: "a@b.c")),
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
        XCTAssertNotEqual(zh.planEmptyNote, en.planEmptyNote)
    }

    func testFeedbackMailAnchors() {
        XCTAssertEqual(zh.feedbackSubject(version: "0.1.0"), "Rede 反馈（v0.1.0）")
        XCTAssertEqual(en.feedbackSubject(version: "0.1.0"), "Rede feedback (v0.1.0)")
        // 兜底句必须把地址原样给出，用户才能手动发送
        XCTAssertTrue(zh.feedbackFallback(address: "x@y.z").contains("x@y.z"))
        XCTAssertTrue(en.feedbackFallback(address: "x@y.z").contains("x@y.z"))
    }

    func testPrivacyNoteHonestWording() {
        // 文案基线 §7.4 合同：隐私只说「默认保存在本机」事实，禁绝对化承诺
        for strings in [zh, en] {
            let note = strings.settingsPrivacyNote.lowercased()
            XCTAssertTrue(note.contains("本机") || note.contains("this device"),
                          "隐私文案必须落在「本机」事实陈述上")
            for banned in ["永不", "100%", "匿名", "私密", "never leave", "anonymous", "hipaa", "private"] {
                XCTAssertFalse(note.contains(banned), "隐私文案含绝对化措辞: \(banned)")
            }
        }
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
