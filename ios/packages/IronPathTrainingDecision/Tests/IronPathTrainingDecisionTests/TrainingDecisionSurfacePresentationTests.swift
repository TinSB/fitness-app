// iOS-17C — tests for the read-only Plan + Today surface presenters.
//
// These cover the PURE organization/formatting logic only: given an engine
// `TrainingDecisionCoreSlice` (built through the genuine clean-input boundary via
// CoreSliceTestKit) and Domain value types, the presenters emit stable rows and
// honest placeholders. No engine output is asserted here (that is golden territory)
// — only that the formatters read and label existing values correctly.

import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

final class TrainingDecisionSurfacePresentationTests: XCTestCase {

    // MARK: - TodayReadinessSummary

    private func normalSlice() -> TrainingDecisionCoreSlice {
        buildTrainingDecisionFromCleanInput(CoreSliceTestKit.makeCleanInput(gap: 3))
    }

    func testTodayReadinessSummary_decisionRows_haveStableIdsAndNonEmptyLabels() {
        let slice = normalSlice()
        let status = TodayStatus(date: "2026-05-27", sleep: "一般", energy: "中", time: "60", soreness: ["无"])
        let summary = TodayReadinessSummary(slice: slice, todayStatus: status)

        XCTAssertEqual(
            summary.decisionRows.map(\.id),
            ["readinessLevel", "trainingAdjustment", "sessionIntent", "activePhase", "riskLevel", "finalVolumeMultiplier"]
        )
        // Every row carries a non-empty Chinese label + value (no "—"/blank leaks).
        for row in summary.decisionRows {
            XCTAssertFalse(row.label.isEmpty, "label empty for \(row.id)")
            XCTAssertFalse(row.value.isEmpty, "value empty for \(row.id)")
        }
        XCTAssertTrue(summary.headline.hasPrefix("准备度 · "))
        XCTAssertTrue(summary.advice.hasPrefix("建议："))
        // The 负荷系数 row is the engine's finalVolumeMultiplier, 2dp.
        XCTAssertEqual(
            summary.decisionRows.first(where: { $0.id == "finalVolumeMultiplier" })?.value,
            TodayReadinessSummary.multiplierText(slice.finalVolumeMultiplier)
        )
    }

    func testTodayReadinessSummary_emptyTodayStatus_rendersHonestPlaceholders() {
        let summary = TodayReadinessSummary(slice: normalSlice(), todayStatus: TodayStatus())
        XCTAssertEqual(summary.statusRows.map(\.id), ["sleep", "energy", "time", "soreness"])
        XCTAssertEqual(summary.statusRows.map(\.value), ["未填写", "未填写", "未填写", "未填写"])
    }

    func testTodayReadinessSummary_populatedTodayStatus_formatsRows() {
        let status = TodayStatus(date: "2026-05-27", sleep: "充足", energy: "高", time: "75", soreness: ["腿", "肩"])
        let summary = TodayReadinessSummary(slice: normalSlice(), todayStatus: status)
        let byId = Dictionary(uniqueKeysWithValues: summary.statusRows.map { ($0.id, $0.value) })
        XCTAssertEqual(byId["sleep"], "充足")
        XCTAssertEqual(byId["energy"], "高")
        XCTAssertEqual(byId["time"], "75 分钟")
        XCTAssertEqual(byId["soreness"], "腿、肩")
    }

    func testTodayReadinessSummary_whitespaceStatus_treatedAsMissing() {
        let status = TodayStatus(sleep: "   ", energy: "", time: " ", soreness: ["  ", ""])
        let summary = TodayReadinessSummary(slice: normalSlice(), todayStatus: status)
        XCTAssertEqual(summary.statusRows.map(\.value), ["未填写", "未填写", "未填写", "未填写"])
    }

    // MARK: - Label maps are total + non-empty + distinct

    func testReadinessLevelLabels() {
        XCTAssertEqual(TodayReadinessSummary.readinessLabel(.low), "偏低")
        XCTAssertEqual(TodayReadinessSummary.readinessLabel(.medium), "中等")
        XCTAssertEqual(TodayReadinessSummary.readinessLabel(.high), "良好")
    }

    func testAdjustmentLabels() {
        XCTAssertEqual(TodayReadinessSummary.adjustmentLabel(.push), "可加量")
        XCTAssertEqual(TodayReadinessSummary.adjustmentLabel(.normal), "正常推进")
        XCTAssertEqual(TodayReadinessSummary.adjustmentLabel(.conservative), "保守")
        XCTAssertEqual(TodayReadinessSummary.adjustmentLabel(.recovery), "以恢复为主")
    }

    func testCaseIterableLabelMaps_areNonEmptyAndDistinct() {
        let intents = SessionIntent.allCases.map(TodayReadinessSummary.intentLabel)
        let phases = ActivePhase.allCases.map(TodayReadinessSummary.phaseLabel)
        let risks = RiskLevel.allCases.map(TodayReadinessSummary.riskLabel)
        for group in [intents, phases, risks] {
            XCTAssertFalse(group.contains(where: \.isEmpty))
            XCTAssertEqual(Set(group).count, group.count, "labels must be distinct: \(group)")
        }
    }

    func testMultiplierText_twoDecimals() {
        XCTAssertEqual(TodayReadinessSummary.multiplierText(1.0), "1.00")
        XCTAssertEqual(TodayReadinessSummary.multiplierText(0.954), "0.95")
    }

    // MARK: - PlanSurfaceSummary

    func testPlanSurfaceSummary_fullSample_buildsCycleAndProgramRows() {
        let meso = MesocyclePlan(
            startDate: "2026-05-01",
            endDate: "2026-06-28",
            phase: "accumulation",
            weeks: CoreSliceTestKit.standardWeeksJSON() // 4 weeks
        )
        let program = ProgramTemplate(
            primaryGoal: "hypertrophy",
            splitType: "push-pull-legs",
            daysPerWeek: .integer(4),
            correctionStrategy: .object(OrderedJSONObject(entries: [.init(key: "foo", value: .string("bar"))]))
        )
        let summary = PlanSurfaceSummary(mesocycle: meso, program: program)

        XCTAssertFalse(summary.isEmpty)
        XCTAssertEqual(summary.weekCount, 4)
        XCTAssertEqual(summary.phaseText, "accumulation")
        XCTAssertEqual(summary.dateRangeText, "2026-05-01 – 2026-06-28")
        XCTAssertEqual(summary.cycleRows.map(\.id), ["phase", "weeks", "dateRange"])
        XCTAssertEqual(summary.cycleRows.first(where: { $0.id == "weeks" })?.value, "4 周")
        XCTAssertEqual(summary.programRows.map(\.id), ["goal", "split", "days"])
        XCTAssertEqual(summary.programRows.first(where: { $0.id == "days" })?.value, "4 天")
        XCTAssertTrue(summary.hasCorrectionStrategy)
        XCTAssertFalse(summary.hasFunctionalStrategy)
    }

    func testPlanSurfaceSummary_empty_isEmptyTrueWithNoRows() {
        let summary = PlanSurfaceSummary(mesocycle: MesocyclePlan(), program: ProgramTemplate())
        XCTAssertTrue(summary.isEmpty)
        XCTAssertEqual(summary.weekCount, 0)
        XCTAssertNil(summary.phaseText)
        XCTAssertNil(summary.dateRangeText)
        XCTAssertTrue(summary.cycleRows.isEmpty)
        XCTAssertTrue(summary.programRows.isEmpty)
        XCTAssertFalse(summary.hasCorrectionStrategy)
        XCTAssertFalse(summary.hasFunctionalStrategy)
    }

    func testPlanSurfaceSummary_dateRange_halfOpenVariants() {
        XCTAssertEqual(PlanSurfaceSummary.dateRange(start: "2026-05-01", end: nil), "2026-05-01 起")
        XCTAssertEqual(PlanSurfaceSummary.dateRange(start: nil, end: "2026-06-28"), "至 2026-06-28")
        XCTAssertNil(PlanSurfaceSummary.dateRange(start: "  ", end: nil))
    }

    func testPlanSurfaceSummary_weekCount_onlyCountsArrays() {
        XCTAssertEqual(PlanSurfaceSummary.weekCount(.array([.string("w1"), .string("w2")])), 2)
        XCTAssertEqual(PlanSurfaceSummary.weekCount(.object(OrderedJSONObject())), 0)
        XCTAssertEqual(PlanSurfaceSummary.weekCount(nil), 0)
    }

    func testPlanSurfaceSummary_hasContent_presenceRules() {
        XCTAssertFalse(PlanSurfaceSummary.hasContent(nil))
        XCTAssertFalse(PlanSurfaceSummary.hasContent(.null))
        XCTAssertFalse(PlanSurfaceSummary.hasContent(.object(OrderedJSONObject())))
        XCTAssertFalse(PlanSurfaceSummary.hasContent(.array([])))
        XCTAssertFalse(PlanSurfaceSummary.hasContent(.string("")))
        XCTAssertTrue(PlanSurfaceSummary.hasContent(.string("x")))
        XCTAssertTrue(PlanSurfaceSummary.hasContent(.array([.null])))
        XCTAssertTrue(PlanSurfaceSummary.hasContent(.bool(false)))
    }
}
