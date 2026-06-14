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
        XCTAssertEqual(line, "今天轻练。停练 16 天，先回归再加量。")
        let enLine = en.verdictHeadline(call: "rest", reasonCode: "consecutiveDaysNeedRest", dayName: "Upper", gapDays: 1, consecutiveDays: 3)
        XCTAssertEqual(enLine, "Rest today. 3 days straight — recovery first.")
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
        XCTAssertEqual(en.signalLine(gapDays: 2, sessionsLast7: 2, planned: 4), "2d since last · 2/4 sessions this week")
        XCTAssertEqual(zh.signalLine(gapDays: nil, sessionsLast7: 0, planned: 6), "暂无训练记录")
        XCTAssertEqual(en.changeLine(exerciseName: "Bench press", change: "increase", fromKg: "60", toKg: "62.5"), "Bench press 60→62.5 kg · moving up")
    }

    // 自重展示（wave-6）：大数字=次数、无「0kg」
    func testBodyweightDisplayShowsRepsNotZeroWeight() {
        XCTAssertEqual(zh.heroNumber(loadType: "bodyweight", weightKg: 0, reps: 12), "12")
        XCTAssertEqual(zh.heroNumber(loadType: "external", weightKg: 50, reps: 6), "50")
        XCTAssertEqual(zh.heroDetail(loadType: "bodyweight", reps: 12, rir: 2), "次 · RIR 2")
        XCTAssertEqual(zh.railValue(loadType: "bodyweight", weightKg: 0, reps: 12), "×12")
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "俯卧撑", change: "start", reps: 12, atCeiling: false), "俯卧撑 首次 ×12")
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "俯卧撑", change: "increase", reps: 14, atCeiling: false), "俯卧撑 加到 ×14 · 进阶")
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "引体向上", change: "hold", reps: 25, atCeiling: true), "引体向上 ×25 · 可加配重或换更难变体了")
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
        XCTAssertEqual(zh.changeLineBodyweight(exerciseName: "弹力带侧平举", change: "hold", reps: 25, atCeiling: true, isBand: true), "弹力带侧平举 ×25 · 该换重一档的带子了")
        XCTAssertEqual(en.changeLineBodyweight(exerciseName: "Band lateral raise", change: "hold", reps: 25, atCeiling: true, isBand: true), "Band lateral raise ×25 · time for a heavier band")
    }
}
