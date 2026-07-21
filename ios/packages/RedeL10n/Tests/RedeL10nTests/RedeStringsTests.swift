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
            ("settingsBackground", s.settingsBackground),
            ("onbEditSave", s.onbEditSave), ("onbEditCancel", s.onbEditCancel),
            ("onbDaysNote", s.onbDaysNote), ("onbEquipEcho", s.onbEquipEcho("commercial-gym")),
            ("onbEquipEchoHome", s.onbEquipEcho("home-dumbbell")), ("onbEquipEchoMinimal", s.onbEquipEcho("minimal")),
            ("onbA11yAnswered", s.onbA11yAnswered), ("onbA11yCurrent", s.onbA11yCurrent),
            ("settingsDaysValue", s.settingsDaysValue(4)), ("settingsData", s.settingsData),
            ("settingsAbout", s.settingsAbout),
            // K7 数据导出（FR-SE6 兑现）
            ("settingsExportAction", s.settingsExportAction),
            ("settingsExportFailedTitle", s.settingsExportFailedTitle),
            ("settingsExportFailedBody", s.settingsExportFailedBody),
            ("settingsExportFailedConfirm", s.settingsExportFailedConfirm),
            ("settingsPrivacy", s.settingsPrivacy), ("settingsPrivacyNote", s.settingsPrivacyNote),
            // FR-SE10：版本、更新检查与内置 What's New
            ("appUpdateSection", s.appUpdateSection),
            ("appUpdateVersion", s.appUpdateVersion),
            ("appUpdateCheck", s.appUpdateCheck),
            ("appUpdateWhatsNew", s.appUpdateWhatsNew),
            ("appUpdateChecking", s.appUpdateChecking),
            ("appUpdateUpToDate", s.appUpdateUpToDate),
            ("appUpdateUnableToCheck", s.appUpdateUnableToCheck),
            ("appUpdateAvailable", s.appUpdateAvailable(version: "1.9")),
            ("appUpdateSignalOverline", s.appUpdateSignalOverline(version: "1.9")),
            ("appUpdateRowTitle", s.appUpdateRowTitle(version: "1.9")),
            ("appUpdateViewShort", s.appUpdateViewShort),
            ("appUpdateViewUpdate", s.appUpdateViewUpdate),
            ("appUpdateLater", s.appUpdateLater),
            ("appUpdateContinue", s.appUpdateContinue),
            ("appUpdateVersionValue", s.appUpdateVersionValue(marketingVersion: "1.9", build: "26")),
            ("appUpdateHeroLine", s.appUpdateHeroLine(version: "1.9")),
            ("appUpdateHighlights", s.appUpdateHighlights(version: "1.9").joined(separator: " ")),
            // FR-SE9 / FR-SUB2：订阅管理与诚实状态
            ("settingsSubscriptionSection", s.settingsSubscriptionSection),
            ("settingsSubscriptionFreeCore", s.settingsSubscriptionFreeCore),
            ("settingsSubscriptionPaidCoach", s.settingsSubscriptionPaidCoach),
            ("settingsSubscriptionChecking", s.settingsSubscriptionChecking),
            ("settingsSubscriptionUnknownTier", s.settingsSubscriptionUnknownTier),
            ("settingsSubscriptionUnknown", s.settingsSubscriptionUnknown),
            ("settingsSubscriptionGrace", s.settingsSubscriptionGrace),
            ("settingsSubscriptionManage", s.settingsSubscriptionManage),
            ("settingsSubscriptionRetry", s.settingsSubscriptionRetry),
            ("settingsSubscriptionOperationFailed", s.settingsSubscriptionOperationFailed),
            ("settingsSubscriptionOpenCoach", s.settingsSubscriptionOpenCoach),
            ("subscriptionPageCurrentPlan", s.subscriptionPageCurrentPlan),
            ("subscriptionPagePreparingOverline", s.subscriptionPagePreparingOverline),
            ("subscriptionPagePreparingTitle", s.subscriptionPagePreparingTitle),
            ("subscriptionPageNotOpen", s.subscriptionPageNotOpen),
            ("subscriptionPageUnavailableOverline", s.subscriptionPageUnavailableOverline),
            ("subscriptionPageUnavailableTitle", s.subscriptionPageUnavailableTitle),
            ("subscriptionPageFreeCoreAvailable", s.subscriptionPageFreeCoreAvailable),
            // FR-SUB3 每周教练复盘
            ("weeklyCoachReviewTitle", s.weeklyCoachReviewTitle),
            ("weeklyCoachReviewLoading", s.weeklyCoachReviewLoading),
            ("weeklyCoachReviewEmptyTitle", s.weeklyCoachReviewEmptyTitle),
            ("weeklyCoachReviewUnavailableTitle", s.weeklyCoachReviewUnavailableTitle),
            ("weeklyCoachReviewUnavailableBody", s.weeklyCoachReviewUnavailableBody),
            ("weeklyCoachReviewRetry", s.weeklyCoachReviewRetry),
            ("weeklyCoachReviewVerdictTitle", s.weeklyCoachReviewVerdictTitle(code: "progressing")),
            ("weeklyCoachReviewVerdictDisplayTitle", s.weeklyCoachReviewVerdictDisplayTitle(code: "progressing")),
            ("weeklyCoachReviewTrainingDays", s.weeklyCoachReviewTrainingDays(3)),
            ("weeklyCoachReviewRecentMedian", s.weeklyCoachReviewRecentMedian(2.5)),
            ("weeklyCoachReviewSessions", s.weeklyCoachReviewSessions(3)),
            ("weeklyCoachReviewDataFindings", s.weeklyCoachReviewDataFindings(2)),
            ("weeklyCoachReviewCleanVolume", s.weeklyCoachReviewCleanVolume("8,400 kg")),
            ("weeklyCoachReviewKeyLift", s.weeklyCoachReviewKeyLift(name: "卧推", call: "up", deltaText: "+2.5 kg")),
            ("weeklyCoachReviewAction", s.weeklyCoachReviewAction(code: "viewProgress")),
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

    func testExportCopyAnchors() {
        // K7 数据导出（FR-SE6 兑现）：自解释的行标题；失败家族沿 dataUnreadable 口径。
        XCTAssertEqual(zh.settingsExportAction, "导出训练数据")
        XCTAssertEqual(en.settingsExportAction, "Export training data")
        XCTAssertEqual(zh.settingsExportFailedTitle, "暂时读不出数据")
        XCTAssertEqual(en.settingsExportFailedTitle, "Can't read your data right now")
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
            XCTAssertTrue(note.contains("apple"), "StoreKit 上线后必须诚实披露订阅由 Apple 处理")
            XCTAssertFalse(note.contains("不连网") || note.contains("no network connection"),
                           "StoreKit 会连接 Apple，不能继续声称 App 完全不联网")
        }
    }

    func testAppUpdateCopyMatchesApprovedBaseline() {
        XCTAssertEqual(zh.appUpdateSection, "版本")
        XCTAssertEqual(en.appUpdateSection, "Version")
        XCTAssertEqual(zh.appUpdateCheck, "检查更新")
        XCTAssertEqual(en.appUpdateCheck, "Check for Updates")
        XCTAssertEqual(zh.appUpdateWhatsNew, "本次新增")
        XCTAssertEqual(en.appUpdateWhatsNew, "What's New")
        // 2026-07-20 今日页单行更新信号（三层块收敛）：事实句 + 短「查看」。
        XCTAssertEqual(zh.appUpdateRowTitle(version: "1.9"), "新版本 1.9")
        XCTAssertEqual(en.appUpdateRowTitle(version: "1.9"), "New version 1.9")
        XCTAssertEqual(zh.appUpdateViewShort, "查看")
        XCTAssertEqual(en.appUpdateViewShort, "View")
        XCTAssertEqual(zh.appUpdateAvailable(version: "1.9"), "1.9 可用")
        XCTAssertEqual(en.appUpdateAvailable(version: "1.9"), "1.9 Available")
        // 2026-07-20 owner「文案太不专业」重写：hero=版本主打句，亮点=具体名词句（基线 §5.5）。
        // 2026-07-20 archive 1.9：内置叙事切到 1.9（只保留当前发布版本，YAGNI）。
        XCTAssertEqual(zh.appUpdateHeroLine(version: "1.9"), "训练现场，顺序随你调")
        XCTAssertEqual(en.appUpdateHeroLine(version: "1.9"), "Adjust your session on the spot")
        XCTAssertEqual(
            zh.appUpdateHighlights(version: "1.9"),
            [
                "「接下来」可现在练：训练中把后面的动作提到当前，重量与进阶仍由系统安排",
                "计划编辑器防误删：移除动作可逐步撤回，「恢复默认」一键回到教练方案",
                "新版本不再错过：今日页轻量提示，设置页可检查更新、重看更新内容",
            ]
        )
        XCTAssertEqual(
            en.appUpdateHighlights(version: "1.9"),
            [
                "\"Up next\" can be now: pull a later exercise into the current slot mid-workout, loads still set by the system",
                "The plan editor forgives: undo removals step by step, or restore the coach's default in one tap",
                "Never miss a version: a light signal on Today, with Check for Updates and What's New in Settings",
            ]
        )
        XCTAssertTrue(zh.appUpdateHighlights(version: "1.8").isEmpty)
        XCTAssertTrue(en.appUpdateHighlights(version: "2.0").isEmpty)
        XCTAssertTrue(zh.appUpdateHeroLine(version: "2.0").isEmpty)
    }

    func testSubscriptionCopyAnchorsAndFreeCompatibilityFloor() {
        XCTAssertEqual(zh.settingsSubscriptionSection, "方案")
        XCTAssertEqual(en.settingsSubscriptionSection, "Plan")
        XCTAssertEqual(zh.settingsSubscriptionFreeCore, "Free Core")
        XCTAssertEqual(en.settingsSubscriptionFreeCore, "Free Core")
        XCTAssertEqual(zh.settingsSubscriptionUnknownTier, "当前方案：暂时无法确认")
        XCTAssertEqual(en.settingsSubscriptionUnknownTier, "Current plan: unavailable")
        XCTAssertEqual(zh.subscriptionPageCurrentPlan, "当前方案")
        XCTAssertEqual(en.subscriptionPageCurrentPlan, "Current plan")
        XCTAssertEqual(zh.subscriptionPagePreparingOverline, "准备中")
        XCTAssertEqual(en.subscriptionPagePreparingOverline, "In development")
        XCTAssertEqual(zh.subscriptionPagePreparingTitle, "功能完成后再加入这里")
        XCTAssertEqual(en.subscriptionPagePreparingTitle, "Features will be added here when they’re ready")
        XCTAssertEqual(zh.subscriptionPageNotOpen, "订阅尚未开放")
        XCTAssertEqual(en.subscriptionPageNotOpen, "Subscriptions aren’t open yet")
        XCTAssertEqual(zh.subscriptionPageUnavailableOverline, "暂时不可用")
        XCTAssertEqual(en.subscriptionPageUnavailableOverline, "Temporarily unavailable")
        XCTAssertEqual(zh.subscriptionPageUnavailableTitle, "订阅选项暂时不可用")
        XCTAssertEqual(en.subscriptionPageUnavailableTitle, "Subscription options are temporarily unavailable")
        XCTAssertEqual(zh.subscriptionPageFreeCoreAvailable, "Free Core 仍可使用")
        XCTAssertEqual(en.subscriptionPageFreeCoreAvailable, "Free Core remains available")
        for line in [zh.settingsSubscriptionUnknown, en.settingsSubscriptionUnknown] {
            XCTAssertTrue(line.contains("Free Core"), "未知态必须明确 Free Core 不受影响")
        }
    }

    func testSubscriptionPreviewDoesNotPromiseProductsOrUnbuiltFeatures() {
        let copy = [
            zh.subscriptionPagePreparingTitle,
            zh.subscriptionPageNotOpen,
            zh.subscriptionPageUnavailableOverline,
            zh.subscriptionPageUnavailableTitle,
            zh.subscriptionPageFreeCoreAvailable,
            en.subscriptionPagePreparingTitle,
            en.subscriptionPageNotOpen,
            en.subscriptionPageUnavailableOverline,
            en.subscriptionPageUnavailableTitle,
            en.subscriptionPageFreeCoreAvailable,
        ].joined(separator: " ").lowercased()

        for banned in ["价格", "试用", "优惠", "购买", "判断", "洞察",
                       "price", "trial", "discount", "buy", "decision", "insight"] {
            XCTAssertFalse(copy.contains(banned), "预览页不能承诺商品、优惠、交易或未实现能力: \(banned)")
        }
        XCTAssertNotEqual(zh.subscriptionPageNotOpen, zh.subscriptionPageUnavailableTitle)
        XCTAssertNotEqual(en.subscriptionPageNotOpen, en.subscriptionPageUnavailableTitle)
    }

    func testWeeklyCoachReviewCopyIsSpecificAndNonCausal() {
        XCTAssertEqual(zh.weeklyCoachReviewTitle, "每周教练复盘")
        XCTAssertEqual(en.weeklyCoachReviewTitle, "Weekly Coach Review")
        XCTAssertEqual(zh.weeklyCoachReviewIssue(weekOfYear: 28), "Weekly Review / Week 28")
        XCTAssertEqual(en.weeklyCoachReviewIssue(weekOfYear: 28), "Weekly Review / Week 28")
        XCTAssertEqual(
            zh.weeklyCoachReviewDateRange(startText: "7月6日", endText: "12日", year: 2026),
            "7月6日—12日 · 2026"
        )
        XCTAssertEqual(
            en.weeklyCoachReviewDateRange(startText: "Jul 6", endText: "12", year: 2026),
            "Jul 6–12 · 2026"
        )
        XCTAssertEqual(
            zh.weeklyCoachReviewCrossYearDateRange(
                startText: "12月29日",
                startYear: 2025,
                endText: "1月4日",
                endYear: 2026
            ),
            "2025年12月29日—2026年1月4日"
        )
        XCTAssertEqual(
            en.weeklyCoachReviewCrossYearDateRange(
                startText: "Dec 29",
                startYear: 2025,
                endText: "Jan 4",
                endYear: 2026
            ),
            "Dec 29, 2025–Jan 4, 2026"
        )
        XCTAssertEqual(zh.weeklyCoachReviewDecisionLabel, "本周判定 / Coach Call")
        XCTAssertEqual(en.weeklyCoachReviewDecisionLabel, "Coach Call")
        XCTAssertEqual(zh.weeklyCoachReviewMovementLabel, "关键变化 / Movement")
        XCTAssertEqual(en.weeklyCoachReviewMovementLabel, "Movement")
        XCTAssertEqual(zh.weeklyCoachReviewEvidenceMemoLabel, "判断依据 / Evidence")
        XCTAssertEqual(en.weeklyCoachReviewEvidenceMemoLabel, "Evidence")
        XCTAssertEqual(zh.weeklyCoachReviewNextLabel, "下一步 / Next")
        XCTAssertEqual(en.weeklyCoachReviewNextLabel, "Next")
        XCTAssertEqual(zh.weeklyCoachReviewComparableRecords, "e1RM · 可比记录")
        XCTAssertEqual(en.weeklyCoachReviewComparableRecords, "e1RM · Comparable Records")
        XCTAssertEqual(
            zh.weeklyCoachReviewLiftDetail(code: "calibrating", hasDelta: false),
            "可比场次不足"
        )
        XCTAssertEqual(
            en.weeklyCoachReviewLiftDetail(code: "up", hasDelta: false),
            "e1RM · Comparable Trend"
        )
        XCTAssertEqual(zh.weeklyCoachReviewDayUnit(3), "天")
        XCTAssertEqual(en.weeklyCoachReviewDayUnit(1), "day")
        XCTAssertEqual(en.weeklyCoachReviewDayUnit(3), "days")
        XCTAssertEqual(zh.weeklyCoachReviewSessionUnit(3), "场")
        XCTAssertEqual(en.weeklyCoachReviewEntryUnit(2), "entries")
        XCTAssertEqual(zh.weeklyCoachReviewLiftCallMetric(code: "calibrating"), "校准中")
        XCTAssertEqual(en.weeklyCoachReviewLiftCallMetric(code: "up"), "Moving Up")
        XCTAssertEqual(zh.weeklyCoachReviewVerdictDisplayTitle(code: "progressing"), "关键动作，\n向上。")
        XCTAssertEqual(en.weeklyCoachReviewVerdictDisplayTitle(code: "progressing"), "Key lift,\nmoving up.")
        XCTAssertEqual(zh.weeklyCoachReviewVerdictDisplayTitle(code: "dataNeedsReview"), "先核对，\n再判断。")
        XCTAssertEqual(en.weeklyCoachReviewVerdictDisplayTitle(code: "dataNeedsReview"), "Verify first.\nThen read the trend.")
        XCTAssertEqual(zh.weeklyCoachReviewEmptyTitle, "上周没有训练记录")
        XCTAssertEqual(en.weeklyCoachReviewEmptyTitle, "No workouts were recorded last week")
        XCTAssertEqual(zh.weeklyCoachReviewVerdictTitle(code: "calibrating"), "继续训练后再判断趋势")
        XCTAssertEqual(en.weeklyCoachReviewVerdictTitle(code: "calibrating"), "Keep training before calling a trend")
        XCTAssertEqual(zh.weeklyCoachReviewVerdictTitle(code: "dataNeedsReview"), "先核对上周的训练记录")
        XCTAssertEqual(en.weeklyCoachReviewVerdictTitle(code: "dataNeedsReview"), "Check last week’s training records first")
        XCTAssertEqual(zh.weeklyCoachReviewVerdictTitle(code: "progressing"), "关键动作在向上走")
        XCTAssertEqual(en.weeklyCoachReviewVerdictTitle(code: "progressing"), "Your key lift is moving up")
        XCTAssertEqual(zh.weeklyCoachReviewAction(code: "openToday"), "查看今天安排")
        XCTAssertEqual(zh.weeklyCoachReviewAction(code: "viewProgress"), "查看进展")
        XCTAssertEqual(zh.weeklyCoachReviewAction(code: "reviewData"), "核对训练数据")
        XCTAssertEqual(en.weeklyCoachReviewAction(code: "openToday"), "View Today")
        XCTAssertEqual(en.weeklyCoachReviewAction(code: "viewProgress"), "View Progress")
        XCTAssertEqual(en.weeklyCoachReviewAction(code: "reviewData"), "Review Training Data")
        XCTAssertEqual(en.weeklyCoachReviewRecentMedian(1), "Recent median · 1 day")

        // 2026-07-20 YAGNI 清理：V1 遗留 weeklyCoachReviewVerdictBody/Week/EvidenceTitle
        // 已删（无生产调用点）；禁词扫描改扫仍在生产的判断句家族。
        let weeklyCopy = [
            zh.weeklyCoachReviewVerdictDisplayTitle(code: "dataNeedsReview"),
            zh.weeklyCoachReviewVerdictDisplayTitle(code: "progressing"),
            en.weeklyCoachReviewVerdictDisplayTitle(code: "dataNeedsReview"),
            en.weeklyCoachReviewVerdictDisplayTitle(code: "progressing"),
            zh.weeklyCoachReviewVerdictTitle(code: "dataNeedsReview"),
            zh.weeklyCoachReviewVerdictTitle(code: "rebuildRhythm"),
            zh.weeklyCoachReviewVerdictTitle(code: "progressing"),
            en.weeklyCoachReviewVerdictTitle(code: "dataNeedsReview"),
            en.weeklyCoachReviewVerdictTitle(code: "rebuildRhythm"),
            en.weeklyCoachReviewVerdictTitle(code: "progressing"),
        ].joined(separator: " ").lowercased()

        let words = weeklyCopy.split(whereSeparator: { !$0.isLetter }).map(String.init)
        XCTAssertFalse(words.contains("ai"), "复盘文案不得自称 AI")
        for banned in ["算法", "因为", "导致", "caused", "best", "最佳", "free core", "本机"] {
            XCTAssertFalse(weeklyCopy.contains(banned), "复盘文案不得作因果、AI 或无关小字声明: \(banned)")
        }
    }

    func testUiShortPhrasesHaveNoTrailingPeriod() {
        // UI 短语不收句号(copy baseline §3.4);判断句/收据句不在此列
        let shortPhrases: [String] = [
            zh.tabToday, zh.tabTrain, zh.tabProgress, zh.tabPlan,
            zh.startTraining, zh.trainLogSet, zh.trainFinish, zh.trainHold185,
            zh.todayWhyThisCall, zh.todayHideReason,
            zh.settingsTitle, zh.settingsLanguage, zh.settingsDone,
            zh.settingsSubscriptionSection,
            zh.settingsSubscriptionManage, zh.settingsSubscriptionRetry,
            en.settingsSubscriptionSection,
            en.settingsSubscriptionManage, en.settingsSubscriptionRetry,
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
