// M4-3 进展文案：判断先行句式 + 禁词回归（含「置信度/confidence」——§3.4 专项）。

import XCTest
@testable import RedeL10n

final class ProgressEngineCopyTests: XCTestCase {
    private let zh = RedeStrings(locale: .zh)
    private let en = RedeStrings(locale: .en)

    func testE1RmFormattingRoundsToHalfKg() {
        XCTAssertEqual(zh.formatE1Rm(69.66666666666666), "69.5")
        XCTAssertEqual(zh.formatE1Rm(75.0), "75")
        XCTAssertEqual(zh.formatE1Rm(73.26), "73.5")
    }

    func testTrendVerdictUpMatchesPRDVoice() {
        XCTAssertEqual(zh.trendVerdict(call: "up", liftName: "卧推"), "卧推仍在上升")
        XCTAssertEqual(en.trendVerdict(call: "up", liftName: "Bench press"), "Bench press is still trending up")
        XCTAssertEqual(zh.trendSub(call: "up", sessions: 4, deltaKg: "5"), "过去 4 次训练里，估算 1RM 提高 5 kg")
        XCTAssertEqual(en.trendSub(call: "up", sessions: 4, deltaKg: "5"), "Estimated 1RM is up 5 kg over the last 4 sessions")
    }

    func testCalibratingMakesNoJudgment() {
        XCTAssertEqual(zh.trendVerdict(call: "calibrating", liftName: "卧推"), "正在校准")
        XCTAssertEqual(en.trendSub(call: "calibrating", sessions: 1, deltaKg: "0"),
                       "A few more sessions and the trend emerges")
    }

    func testWeekComparisonLines() {
        XCTAssertEqual(zh.weekSubCompared(deltaPercent: 12, sets: 18, volumeKg: "5500"),
                       "训练量较上周 +12% · 18 组 · 5500 kg")
        XCTAssertEqual(en.weekSubCompared(deltaPercent: -8, sets: 12, volumeKg: "4100"),
                       "Volume −8% vs last week · 12 sets · 4100 kg")
        XCTAssertEqual(zh.weekVerdict("first"), "第一周开账")
        XCTAssertEqual(zh.weekVerdict("down"), "本周收着练")
        XCTAssertEqual(zh.weekVerdict("gap"), "本周回到训练")
        XCTAssertEqual(en.weekVerdict("up"), "Volume is up this week")
        XCTAssertEqual(en.weekVerdict("gap"), "Back to lifting this week")
        XCTAssertEqual(zh.weekSubFirstWeek(sets: 5, volumeKg: "2000"), "本周 5 组 · 2000 kg　多周后显现对比")
        XCTAssertEqual(en.weekSubFirstWeek(sets: 5, volumeKg: "2000"),
                       "5 sets · 2000 kg this week. Comparison appears as weeks add up")
        XCTAssertEqual(en.weekSubGapWeek(sets: 12, volumeKg: "4100"),
                       "12 sets · 4100 kg this week. No sessions last week to compare")
    }

    // 周中失真保守修复（2026-07-03 审查 MAJOR #3）：进行中的周只报事实、不下结论
    func testInProgressWeekLinesAreNeutral() {
        XCTAssertEqual(zh.weekVerdict("inProgress"), "本周进行中")
        XCTAssertEqual(en.weekVerdict("inProgress"), "Week in progress")
        XCTAssertEqual(zh.weekSubInProgress(sets: 6, volumeKg: "3200"),
                       "本周至今 6 组 · 3200 kg　周结束后显现对比")
        XCTAssertEqual(en.weekSubInProgress(sets: 6, volumeKg: "3200"),
                       "6 sets · 3200 kg so far this week. Comparison appears when the week ends")
        // 防回潮：进行中文案不得携带任何对上周的结论
        for line in [zh.weekSubInProgress(sets: 6, volumeKg: "3200"),
                     zh.weekVerdict("inProgress")] {
            XCTAssertFalse(line.contains("较上周"))
            XCTAssertFalse(line.contains("%"))
        }
        for line in [en.weekSubInProgress(sets: 6, volumeKg: "3200"),
                     en.weekVerdict("inProgress")] {
            XCTAssertFalse(line.contains("vs last week"))
            XCTAssertFalse(line.contains("%"))
        }
    }

    func testSuspectLinesAreBehavioral() {
        let line = zh.suspectWeightLine(dateISO: "2026-06-03", lift: "卧推", setIndex: 1, kg: "227")
        XCTAssertTrue(line.contains("可能记错了"))
        let en1 = en.suspectWeightLine(dateISO: "2026-06-03", lift: "Bench press", setIndex: 1, kg: "227")
        XCTAssertTrue(en1.contains("probably a typo"))
        XCTAssertEqual(zh.droppedRecordsLine(2), "2 条记录有问题，没有计入统计")
        XCTAssertEqual(en.droppedRecordsLine(1), "1 record couldn't be counted")
    }

    func testSessionAndHistoryLines() {
        XCTAssertEqual(zh.sessionVerdictPR("卧推"), "本场新纪录　卧推")
        XCTAssertEqual(zh.sessionSubTopSet(lift: "卧推", kg: "62.5", reps: 6, e1rmKg: "75"),
                       "顶组 卧推 62.5 kg × 6 · 估算 1RM 75 kg")
        XCTAssertEqual(en.historyRowMeta(sets: 18, volumeKg: "5500"), "18 sets · 5500 kg")
        XCTAssertEqual(zh.historyRowMeta(sets: 18, volumeKg: "5500"), "18 组 · 5500 kg")
    }

    // 禁词回归：全部进展文案在两种语言下扫禁词；「置信度/confidence」为本页专项红线。
    func testForbiddenWordsNeverAppearInProgressCopy() {
        let forbidden = ["AI", "算法", "系统认为", "最佳", "algorithm", "model thinks", "best",
                         "置信度", "confidence", "解锁全部潜能", "unlock your full potential"]
        for strings in [zh, en] {
            var lines: [String] = [
                strings.progressEmptyTitle, strings.progressEmptySub,
                strings.sessionVerdictDone, strings.sessionCaptionNoPR,
                strings.sessionVerdictPR("卧推"), strings.sessionCaptionPR("卧推"),
                strings.sessionSubTopSet(lift: "卧推", kg: "62.5", reps: 6, e1rmKg: "75"),
                strings.weekChartTitleByWeek, strings.weekCaptionCurrent,
                strings.weekSubCompared(deltaPercent: 12, sets: 18, volumeKg: "5500"),
                strings.weekSubFirstWeek(sets: 18, volumeKg: "5500"),
                strings.weekSubGapWeek(sets: 18, volumeKg: "5500"),
                strings.weekSubInProgress(sets: 18, volumeKg: "5500"),
                strings.cycleCaptionPeak, strings.cycleChartTitleFor("卧推"),
                strings.historyTitle, strings.historyRowMeta(sets: 18, volumeKg: "5500"),
                strings.historyDetailSets, strings.dataQualityTitle,
                strings.suspectWeightLine(dateISO: "2026-06-03", lift: "卧推", setIndex: 1, kg: "227"),
                strings.suspectRepsLine(dateISO: "2026-06-03", lift: "卧推", setIndex: 1, reps: 80),
                strings.droppedRecordsLine(2),
            ]
            for code in ["up", "down", "level", "first", "gap", "inProgress"] {
                lines.append(strings.weekVerdict(code))
            }
            for call in ["up", "down", "flat", "calibrating"] {
                lines.append(strings.trendVerdict(call: call, liftName: "卧推"))
                lines.append(strings.trendSub(call: call, sessions: 4, deltaKg: "5"))
            }
            for line in lines {
                for word in forbidden {
                    XCTAssertFalse(
                        line.lowercased().contains(word.lowercased()),
                        "禁词「\(word)」出现在: \(line)"
                    )
                }
            }
        }
    }
}
