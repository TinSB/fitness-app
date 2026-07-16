// M2-3 引擎接线文案：双语锚句 + 禁词守卫（文案基线 §4.1/§4.2）。

import Foundation
import XCTest
@testable import RedeL10n

final class TodayEngineCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testVerdictStatusAnchors() {
        XCTAssertEqual(zh.verdictStatus(call: "train"), "可以训练")
        XCTAssertEqual(en.verdictStatus(call: "train"), "Ready to train")
        XCTAssertEqual(zh.verdictStatus(call: "deload"), "减载周")
        XCTAssertEqual(en.verdictStatus(call: "rest"), "Rest day")
    }

    func testHeadlineUsesSignalImpactDecisionShape() {
        let line = zh.verdictHeadline(call: "light", reasonCode: "longGapReentry", dayName: "上肢 A", gapDays: 16, consecutiveDays: nil)
        XCTAssertEqual(line, "今天轻练　停训 16 天，先回到状态")
        let enLine = en.verdictHeadline(call: "rest", reasonCode: "consecutiveDaysNeedRest", dayName: "Upper", gapDays: 1, consecutiveDays: 3)
        XCTAssertEqual(enLine, "Rest today. 3 days straight")
    }

    func testForbiddenWordsNeverAppear() {
        // 文案基线禁词：不写算法名、不写「AI 判断」「系统认为」「最佳」。
        let calls = ["train", "light", "rest", "deload"]
        let reasons = ["noHistoryCalibration", "normalProgression", "longGapReentry", "weeklyPlanReached",
                       "lastSessionNearFailure", "alreadyTrainedToday", "consecutiveDaysNeedRest", "sustainedLoadDeload"]
        for strings in [zh, en] {
            for call in calls {
                for reason in reasons {
                    let text = strings.verdictHeadline(call: call, reasonCode: reason, dayName: "X", gapDays: 5, consecutiveDays: 3)
                        + strings.receiptConclusion(call: call, reasonCode: reason)
                    for banned in ["AI", "算法", "系统认为", "最佳", "algorithm", "model", "best"] {
                        XCTAssertFalse(text.contains(banned), "禁词「\(banned)」出现在: \(text)")
                    }
                }
            }
        }
    }

    // 动作名已迁入 ExerciseCatalog（内容系统 P0）：名字覆盖合同归
    // RedeTrainingDecision/CatalogContractTests；本包只测训练日名。
    func testExerciseAndDayNames() {
        XCTAssertEqual(zh.trainingDayName("upper"), "上肢 A")
        XCTAssertEqual(en.trainingDayName("push-a"), "Push A")
        XCTAssertEqual(en.trainingDayName("upper"), "Upper")
        XCTAssertEqual(en.trainingDayName("lower"), "Lower")
    }

    func testDateFormattingAnchors() {
        // 固定日期锚句：2026-06-09 是周二。
        var components = DateComponents()
        components.year = 2026; components.month = 6; components.day = 9; components.hour = 12
        components.timeZone = TimeZone(identifier: "UTC")
        let date = Calendar(identifier: .gregorian).date(from: components)!

        XCTAssertEqual(en.shortDate(fromISO: "2026-06-05"), "Jun 5")
        XCTAssertEqual(zh.shortDate(fromISO: "2026-06-05"), "6月5日")
        XCTAssertEqual(zh.shortDate(fromISO: "not-a-date"), "not-a-date")

        // dateLine 含周几与月日（顺序/分隔随 locale，锚关键片段）
        let enLine = en.dateLine(date)
        XCTAssertTrue(enLine.contains("Jun") && enLine.contains("9"), enLine)
        let zhLine = zh.dateLine(date)
        XCTAssertTrue(zhLine.contains("6月9日") && zhLine.contains("周二"), zhLine)
    }

    func testFormattingHelpers() {
        XCTAssertEqual(zh.formatKg(62.5), "62.5")
        XCTAssertEqual(zh.formatKg(60), "60")
        XCTAssertEqual(en.loadDetail(targetReps: 6, targetRir: 2), "kg · ×6 · RIR 2")
        XCTAssertEqual(zh.railValue(weightKg: 60, reps: 5), "60×5")
        XCTAssertEqual(zh.railValue(weightKg: nil, reps: nil), "—")
        XCTAssertEqual(zh.thenLine("绳索夹胸"), "接 绳索夹胸")
        // N3a 周分段条计数：日历周口径可以说 this week；单位=天（格子=天，「次」会与
        // 同日多场分叉——审查 NIT，与 a11y 串合流）；中西混排带空格；英文单复数分流
        XCTAssertEqual(zh.weekStripCount(3), "本周练 3 天")
        XCTAssertEqual(en.weekStripCount(1), "1 day this week")
        XCTAssertEqual(en.weekStripCount(3), "3 days this week")
        // 口径合流（周口径迁移 2026-07-15）：weeklyPlanReached 已随引擎迁到日历周
        //（trainedDaysThisWeek，周一始），文案回迁「本周/weekly」措辞——与分段条同口径。
        // 正向断言防漂移（替代 #696 的反向防回潮断言，其前提已消失）。
        XCTAssertTrue(en.verdictHeadline(call: "light", reasonCode: "weeklyPlanReached",
                                         dayName: "Push A", gapDays: nil, consecutiveDays: nil)
            .lowercased().contains("week"))
        XCTAssertTrue(zh.verdictHeadline(call: "light", reasonCode: "weeklyPlanReached",
                                         dayName: "推 A", gapDays: nil, consecutiveDays: nil)
            .contains("本周"))
        XCTAssertEqual(zh.weekStripA11y(3), "本周已练 3 天")
        XCTAssertEqual(en.weekStripA11y(1), "Trained 1 day this week")
        XCTAssertEqual(en.weekStripA11y(2), "Trained 2 days this week")
        XCTAssertEqual(en.changeLine(exerciseName: "Bench press", change: "increase", fromKg: "60", toKg: "62.5"), "Bench press 60→62.5 kg · moving up")
    }

    // K1 待机仪表（2026-07-16）：上次事实行 + 下一场标签——观察式、zh 无句号、中西混排空格。
    func testStandbyLastLineAnchors() {
        XCTAssertEqual(
            zh.standbyLastLine(dateText: "7月13日", dayName: "全身 C", volumeText: "21,300", setCount: 14),
            "上次 · 7月13日　全身 C · 21,300 kg · 14 组")
        XCTAssertEqual(
            en.standbyLastLine(dateText: "Jul 13", dayName: "Full Body C", volumeText: "21,300", setCount: 14),
            "Last · Jul 13 · Full Body C · 21,300 kg · 14 sets")
        // dayName 缺失整段省略（不编数据）；en 单数分流
        XCTAssertEqual(
            zh.standbyLastLine(dateText: "7月13日", dayName: nil, volumeText: "900", setCount: 3),
            "上次 · 7月13日　900 kg · 3 组")
        XCTAssertEqual(
            en.standbyLastLine(dateText: "Jul 13", dayName: nil, volumeText: "60", setCount: 1),
            "Last · Jul 13 · 60 kg · 1 set")
        XCTAssertEqual(zh.nextSessionLabel, "下一场")
        XCTAssertEqual(en.nextSessionLabel, "Next session")
        // K3 休息日「上一场」区头
        XCTAssertEqual(zh.lastSessionSummaryHeader(dateText: "7月14日"), "上一场 · 7月14日")
        XCTAssertEqual(en.lastSessionSummaryHeader(dateText: "Jul 14"), "Last session · Jul 14")
    }

    // 自重展示（wave-6）：大数字=次数、无「0kg」
    func testBodyweightDisplayShowsRepsNotZeroWeight() {
        XCTAssertEqual(zh.heroNumber(loadType: "bodyweight", weightKg: 0, reps: 12), "12")
        XCTAssertEqual(zh.heroNumber(loadType: "external", weightKg: 50, reps: 6), "50")
        XCTAssertEqual(zh.heroDetail(loadType: "bodyweight", reps: 12, rir: 2), "次 · RIR 2")
        XCTAssertEqual(zh.railValue(loadType: "bodyweight", weightKg: 0, reps: 12), "×12")
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "俯卧撑", change: "start", reps: 12, atCeiling: false), "俯卧撑 首次 ×12")
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "俯卧撑", change: "increase", reps: 14, atCeiling: false), "俯卧撑 加到 ×14 · 进阶")
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "引体向上", change: "hold", reps: 25, atCeiling: true), "引体向上 ×25 · 到顶　可加配重或进阶")
    }

    // 弹力带展示（wave-12，A 案按次数进阶）：渲染完全镜像自重（次数当大数字、不显重量），
    // 唯一分叉=到顶 change 行换带提示（isBand）。
    func testBandDisplayMirrorsBodyweightExceptCeiling() {
        // hero/rail/detail 与自重一致（band 走 isRepBased 同一分支）
        XCTAssertEqual(zh.heroNumber(loadType: "band", weightKg: 0, reps: 18), "18")
        XCTAssertEqual(zh.heroDetail(loadType: "band", reps: 18, rir: 2), "次 · RIR 2")
        XCTAssertEqual(zh.railValue(loadType: "band", weightKg: 0, reps: 18), "×18")
        // 非到顶三态（首次/加到/保持）与自重共用文案
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "弹力带侧平举", change: "increase", reps: 16, atCeiling: false, isBand: true), "弹力带侧平举 加到 ×16 · 进阶")
        // 到顶分叉：弹力带换重带（区别于自重的加配重）
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "弹力带侧平举", change: "hold", reps: 25, atCeiling: true, isBand: true), "弹力带侧平举 ×25 · 到顶　换更重的带子")
        XCTAssertEqual(en.changeLineBodyweight(exerciseName: "Band lateral raise", change: "hold", reps: 25, atCeiling: true, isBand: true), "Band lateral raise ×25 · at ceiling, size up the band")
    }

    // T1 练完态当日总结（2026-07-05）：区头 / 体量标签 / 分享入口锚句。
    // 动作·组·时长标签复用 shareCardStat*（同词同义）；PR 徽章复用 shareCardPRBadge。
    func testTodayDoneSummaryAnchors() {
        XCTAssertEqual(zh.todayDoneSummaryHeader, "今天这场")
        XCTAssertEqual(en.todayDoneSummaryHeader, "Today's session")
        XCTAssertEqual(zh.todayDoneVolumeLabel, "总量")
        XCTAssertEqual(en.todayDoneVolumeLabel, "Volume")
        XCTAssertEqual(zh.todayDoneShareAction, "分享这场训练")
        XCTAssertEqual(en.todayDoneShareAction, "Share this workout")
    }

    func testComebackReceiptTiers() {
        let zh = RedeStrings(locale: .zh)
        let en = RedeStrings(locale: .en)
        // ≥21：循环重启句；14-20：找回感觉句；非回归 light 保持通用句（默认参不破既有）
        XCTAssertTrue(zh.receiptConclusion(call: "light", reasonCode: "longGapReentry", gapDays: 22).contains("循环从头开始"))
        XCTAssertTrue(en.receiptConclusion(call: "light", reasonCode: "longGapReentry", gapDays: 22).contains("restarts"))
        XCTAssertTrue(zh.receiptConclusion(call: "light", reasonCode: "longGapReentry", gapDays: 15).contains("找回感觉"))
        XCTAssertEqual(zh.receiptConclusion(call: "light", reasonCode: "weeklyPlanReached"),
                       "今天整体降一档")
        // 无 gap 传入（防御）不崩且落 14-20 句
        XCTAssertFalse(zh.receiptConclusion(call: "light", reasonCode: "longGapReentry").isEmpty)
    }

    func testMusclePriorityBoostedLineRedLines() {
        // 批次 E（审查 M4）：自动均衡依据行——双语 parity/禁词/无尾句号/多肌群连接
        let zhLine = zh.musclePriorityBoostedLine(names: ["肱二头"])
        let enLine = en.musclePriorityBoostedLine(names: ["Biceps"])
        XCTAssertNotEqual(zhLine, enLine)
        XCTAssertTrue(zhLine.contains("肱二头"))
        XCTAssertTrue(en.musclePriorityBoostedLine(names: ["Biceps", "Back"]).contains("Biceps, Back"))
        XCTAssertTrue(zh.musclePriorityBoostedLine(names: ["肱二头", "背部"]).contains("肱二头、背部"))
        for text in [zhLine, enLine] {
            XCTAssertFalse(text.contains("。") || text.contains("——") || text.hasSuffix("."),
                           "句号/破折号: \(text)")
            for banned in ["AI", "算法", "系统认为", "最佳", "algorithm", "model", "best",
                           "置信度", "confidence", "弱", "weak", "差", "poor"] {
                XCTAssertFalse(text.lowercased().contains(banned.lowercased()),
                               "禁词「\(banned)」: \(text)")
            }
        }
    }
}
