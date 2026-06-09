// iOS-17C — tests for the read-only Plan + Today surface presenters.
//
// These cover the PURE organization/formatting logic only: given an engine
// `TrainingDecisionCoreSlice` (built through the genuine clean-input boundary via
// CoreSliceTestKit) and Domain value types, the presenters emit stable rows and
// honest placeholders. No engine output is asserted here (that is golden territory)
// — only that the formatters read and label existing values correctly.

import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

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
}
