import XCTest
@testable import RedeL10n

// M0-3 双语基底测试:两套 locale 全 key 非空、locale 解析规则、关键基准句与 copy baseline 一致。

final class RedeStringsTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    private func allStrings(_ s: RedeStrings) -> [(String, String)] {
        [
            ("tabToday", s.tabToday), ("tabTrain", s.tabTrain), ("tabProgress", s.tabProgress), ("tabPlan", s.tabPlan),
            // 每周循环模式（审查 m4：新增 key 进 parity 清单）
            ("settingsWeeklyRestartLabel", s.settingsWeeklyRestartLabel),
            ("settingsWeeklyRestartNote", s.settingsWeeklyRestartNote),
            ("carriedOverHeader", s.carriedOverHeader(day: "腿 A")),
            ("swapDayScopeOnceWeekly", s.swapDayScopeOnceWeekly),
            ("swapDayAdoptedToastWeekly", s.swapDayAdoptedToastWeekly(chosen: "推 A")),
            ("todayTitle", s.todayTitle), ("todayDateLine", s.todayDateLine), ("todayReadyStatus", s.todayReadyStatus),
            ("todayVerdict", s.todayVerdict), ("todayStartHere", s.todayStartHere), ("todayLoadDetail", s.todayLoadDetail),
            ("todayThenIncline", s.todayThenIncline), ("todayThenCable", s.todayThenCable), ("startTraining", s.startTraining),
            ("todayReceiptTitle", s.todayReceiptTitle), ("todayReceiptTag", s.todayReceiptTag), ("todayReceiptLine", s.todayReceiptLine),
            ("todayWhyThisCall", s.todayWhyThisCall), ("todayHideReason", s.todayHideReason),
            ("receiptChange", s.receiptChange),
            ("todaySignalLine", s.todaySignalLine), ("todayChangeLine", s.todayChangeLine),
            ("todayRailTitle", s.todayRailTitle), ("railLastDate", s.railLastDate), ("railToday", s.railToday), ("railNext", s.railNext),
            ("trainDayTitle", s.trainDayTitle), ("trainProgressLine", s.trainProgressLine), ("trainFinish", s.trainFinish),
            ("trainWhyLine", s.trainWhyLine), ("trainHold185", s.trainHold185), ("trainLogSet", s.trainLogSet),
            ("trainColSet", s.trainColSet), ("trainColWeight", s.trainColWeight), ("trainColReps", s.trainColReps), ("trainColRir", s.trainColRir),
            ("trainNextUp", s.trainNextUp),
            ("progressTitle", s.progressTitle), ("scaleSession", s.scaleSession), ("scaleWeek", s.scaleWeek), ("scaleCycle", s.scaleCycle),
            ("sessionChartTitle", s.sessionChartTitle),
            ("planTitle", s.planTitle), ("planEmptyHeadline", s.planEmptyHeadline),
            ("planEmptyNote", s.planEmptyNote), ("planBackToToday", s.planBackToToday),
            ("planScheduleNote", s.planScheduleNote),
            ("planCycleWeek", s.planCycleWeek(week: 3, total: 4)),
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
        XCTAssertEqual(zh.planBackToToday, "回今日")
        XCTAssertEqual(en.planBackToToday, "Back to today")
    }

    // Task 4（2026-07-03 审查 MINOR）：PlanWeekProjection 是「从下一场起按每周场数
    // 分块」的滚动排期、不是日历周——区块标签不得再用「本周/下周」字面，防止
    // 本周已练满的用户误读「这周还有 4 场」。planAdjustAfterLabel 同根因（同投影）。
    func testPlanScheduleLabelsAreSequenceNotCalendar() {
        XCTAssertEqual(zh.planScheduleThisWeek, "接下来")
        XCTAssertEqual(en.planScheduleThisWeek, "Coming up")
        XCTAssertEqual(zh.planScheduleNextWeek, "再往后")
        XCTAssertEqual(en.planScheduleNextWeek, "After that")
        XCTAssertEqual(zh.planAdjustAfterLabel, "调整后")
        XCTAssertEqual(en.planAdjustAfterLabel, "After the change")
        // 防回潮：计划页排期标签不得出现日历周字面
        for line in [zh.planScheduleThisWeek, zh.planScheduleNextWeek, zh.planAdjustAfterLabel] {
            XCTAssertFalse(line.contains("本周") || line.contains("下周"), line)
        }
        for line in [en.planScheduleThisWeek, en.planScheduleNextWeek, en.planAdjustAfterLabel] {
            XCTAssertFalse(line.lowercased().contains("this week") || line.lowercased().contains("next week"), line)
        }
    }

    // M2 空态修正（2026-07-06）：计划页无模板兜底态的腐烂承诺清除——FR-PL2/3/4
    // 均已上线，「计划视图还在路上/将在后续版本加入」对 1.0 用户是假话。
    // 防回潮：兜底文案禁再出现「后续版本 / 还在路上 / later version / on its way」。
    func testPlanEmptyCopyIsHonest() {
        XCTAssertEqual(zh.planEmptyHeadline, "还没有训练计划")
        XCTAssertEqual(en.planEmptyHeadline, "No plan yet")
        XCTAssertEqual(zh.planEmptyNote, "排期与调整建议会出现在这里　先从今日页开始")
        XCTAssertEqual(en.planEmptyNote, "Your schedule and adjustments will land here. Start from Today")
        for line in [zh.planEmptyHeadline, zh.planEmptyNote] {
            XCTAssertFalse(line.contains("后续版本") || line.contains("还在路上"), line)
        }
        for line in [en.planEmptyHeadline, en.planEmptyNote] {
            let l = line.lowercased()
            XCTAssertFalse(l.contains("later version") || l.contains("on its way"), line)
        }
        // planScheduleNote 同类风险点（#642 已清过一次腐烂承诺），防御性纳入（审查 NIT）
        XCTAssertFalse(zh.planScheduleNote.contains("后续版本") || zh.planScheduleNote.contains("还在路上"))
        XCTAssertFalse(en.planScheduleNote.lowercased().contains("later version") || en.planScheduleNote.lowercased().contains("on its way"))
        // 示意柱说明锚句（审查 MAJOR：无说明字易误读为骨架屏/加载失败）
        XCTAssertEqual(zh.progressEmptyPreviewHint, "数据会长这样")
        XCTAssertEqual(en.progressEmptyPreviewHint, "Your data will look like this")
    }

    // T2 排期折叠（2026-07-05）：类型区区头——构成只展开一次，序列另行紧凑表达。
    func testPlanDayTypesHeader() {
        XCTAssertEqual(zh.planDayTypesHeader, "训练日构成")
        XCTAssertEqual(en.planDayTypesHeader, "Day types")
    }

    // K5 计划页收尾（2026-07-16）：训练日「上次」列 + 累计事实行（单位=天，裁定 3）。
    func testPlanLastTrainedAndTenureAnchors() {
        XCTAssertEqual(zh.planDayLastTrained(dateText: "7月12日"), "上次 · 7月12日")
        XCTAssertEqual(en.planDayLastTrained(dateText: "Jul 12"), "Last · Jul 12")
        XCTAssertEqual(zh.planTenureLine(weeks: 5, days: 14), "已练 5 周 · 14 天")
        XCTAssertEqual(en.planTenureLine(weeks: 5, days: 14), "5 weeks in · 14 days trained")
        XCTAssertEqual(en.planTenureLine(weeks: 1, days: 1), "1 week in · 1 day trained")
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
            zh.todayWhyThisCall, zh.todayHideReason,
            zh.settingsTitle, zh.settingsLanguage, zh.settingsDone,
            zh.settingsWeeklyRestartLabel, zh.settingsWeeklyRestartNote, zh.carriedOverHeader(day: "腿 A"),
            zh.swapDayScopeOnceWeekly, en.settingsWeeklyRestartLabel, en.carriedOverHeader(day: "Legs A"),
            zh.planScheduleThisWeek, zh.planScheduleNextWeek, zh.planAdjustAfterLabel,
            en.startTraining, en.trainLogSet, en.trainFinish, en.trainHold185,
            en.todayWhyThisCall, en.todayHideReason,
            en.planScheduleThisWeek, en.planScheduleNextWeek, en.planAdjustAfterLabel,
        ]
        for phrase in shortPhrases {
            XCTAssertFalse(phrase.hasSuffix("。") || phrase.hasSuffix("."), "短语不应收句号: \(phrase)")
        }
    }
}
