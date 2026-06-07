// AN-3 — analytics.ts dashboard parity tests.
//
// FUNCTION-LEVEL compute-assert: for each `analytics/*` golden, decode each case's echoed
// engineInput (history / weeklyPrescription / exerciseId / bodyWeights / asOfDate), run the
// PORTED AnalyticsDashboardEngine function on the SAME inputs, and assert the produced result
// equals the golden case's `result` (+ `trend`/`status`/the coreTrendExercises constant)
// field-by-field — MuscleVolumeDashboardRow[] / ExerciseTrendPoint[] + trendStatus / PrItem[] /
// the joined weekly-report string / AdherenceReport — with EXACT Double `==`.
//
// The goldens are GENERATED from the retired legacy analytics.ts (frozen legacy fixture generator),
// never hand-edited (§22). PURE / read-only — buildWeeklyReport injects asOfDate (zero `: Date`);
// no IO beyond reading the committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class AnalyticsDashboardEngineParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    }

    private func goldenRoot(_ id: String) throws -> OrderedJSONObject {
        let url = Self.repoRoot.appendingPathComponent("ios/ParityFixtures/parity/golden/\(id).json", isDirectory: false)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "missing golden \(id)")
        return try JSONValue(decoding: try Data(contentsOf: url)).requireObject(id)
    }

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    // MARK: - analytics/muscle-volume-dashboard-cases-v1

    private func decodeDashboardRow(_ o: OrderedJSONObject) -> AnalyticsDashboardEngine.MuscleVolumeDashboardRow {
        AnalyticsDashboardEngine.MuscleVolumeDashboardRow(
            muscleId: o.optionalString("muscleId") ?? "",
            muscleName: o.optionalString("muscleName") ?? "",
            targetSets: o.optionalDouble("targetSets") ?? 0,
            completedSets: o.optionalDouble("completedSets") ?? 0,
            effectiveSets: o.optionalDouble("effectiveSets") ?? 0,
            highConfidenceEffectiveSets: o.optionalDouble("highConfidenceEffectiveSets") ?? 0,
            weightedEffectiveSets: o.optionalDouble("weightedEffectiveSets") ?? 0,
            remainingSets: o.optionalDouble("remainingSets") ?? 0,
            status: o.optionalString("status") ?? "",
            notes: o.optionalStringArray("notes") ?? []
        )
    }

    func testBuildMuscleVolumeDashboardParityForEveryCase() throws {
        let root = try goldenRoot("analytics/muscle-volume-dashboard-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "analytics/muscle-volume-dashboard-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "expected the dashboard cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("dashboard case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            var wp: AnalyticsDashboardEngine.WeeklyPrescriptionInput? = nil
            if let wpObj = c.optionalObject("weeklyPrescription") {
                let muscles = (wpObj.optionalArray("muscles") ?? []).compactMap { item -> AnalyticsDashboardEngine.MuscleTarget? in
                    guard let mo = item.objectValue else { return nil }
                    return AnalyticsDashboardEngine.MuscleTarget(muscle: mo.optionalString("muscle") ?? "", target: mo.optionalDouble("target") ?? 0)
                }
                wp = AnalyticsDashboardEngine.WeeklyPrescriptionInput(weekStart: wpObj.optionalString("weekStart"), muscles: muscles)
            }
            let actual = AnalyticsDashboardEngine.buildMuscleVolumeDashboard(history, wp)
            let golden = (c.optionalArray("result") ?? []).map { decodeDashboardRow($0.objectValue ?? OrderedJSONObject()) }
            XCTAssertEqual(actual, golden, "muscle-volume-dashboard/\(label): mismatch")
        }
    }

    // MARK: - analytics/exercise-trend-cases-v1

    private func decodeTrendPoint(_ o: OrderedJSONObject) -> AnalyticsDashboardEngine.ExerciseTrendPoint {
        AnalyticsDashboardEngine.ExerciseTrendPoint(
            date: o.optionalString("date") ?? "",
            name: o.optionalString("name") ?? "",
            topWeight: o.optionalDouble("topWeight") ?? 0,
            topReps: o.optionalDouble("topReps") ?? 0,
            volume: o.optionalDouble("volume") ?? 0
        )
    }

    func testBuildExerciseTrendAndStatusParityForEveryCase() throws {
        let root = try goldenRoot("analytics/exercise-trend-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "analytics/exercise-trend-cases-v1")

        // CORE_TREND_EXERCISES constant.
        let goldenCore = (root.optionalArray("coreTrendExercises") ?? []).compactMap { item -> AnalyticsDashboardEngine.CoreTrendExercise? in
            guard let o = item.objectValue else { return nil }
            return AnalyticsDashboardEngine.CoreTrendExercise(id: o.optionalString("id") ?? "", label: o.optionalString("label") ?? "")
        }
        XCTAssertEqual(AnalyticsDashboardEngine.coreTrendExercises, goldenCore, "CORE_TREND_EXERCISES mismatch")

        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 5, "expected the exercise-trend cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("exercise-trend case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let exerciseId = c.optionalString("exerciseId") ?? ""
            let actualTrend = AnalyticsDashboardEngine.buildExerciseTrend(history, exerciseId)
            let goldenTrend = (c.optionalArray("trend") ?? []).map { decodeTrendPoint($0.objectValue ?? OrderedJSONObject()) }
            XCTAssertEqual(actualTrend, goldenTrend, "exercise-trend/\(label): buildExerciseTrend mismatch")
            XCTAssertEqual(AnalyticsDashboardEngine.trendStatus(actualTrend), c.optionalString("status") ?? "", "exercise-trend/\(label): trendStatus mismatch")
        }
    }

    // MARK: - analytics/prs-cases-v1

    private func decodePrItem(_ o: OrderedJSONObject) -> AnalyticsDashboardEngine.PrItem {
        AnalyticsDashboardEngine.PrItem(
            key: o.optionalString("key") ?? "",
            exerciseId: o.optionalString("exerciseId") ?? "",
            metric: o.optionalString("metric") ?? "",
            type: o.optionalString("type") ?? "",
            exercise: o.optionalString("exercise") ?? "",
            value: o.optionalDouble("value") ?? 0,
            displayValue: o.optionalString("displayValue") ?? "",
            raw: o.optionalDouble("raw") ?? 0,
            date: o.optionalString("date") ?? "",
            quality: o.optionalString("quality") ?? "",
            reasons: o.optionalStringArray("reasons") ?? []
        )
    }

    func testBuildPrsParityForEveryCase() throws {
        let root = try goldenRoot("analytics/prs-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "analytics/prs-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 2, "expected the prs cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("prs case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let actual = AnalyticsDashboardEngine.buildPrs(history)
            let golden = (c.optionalArray("result") ?? []).map { decodePrItem($0.objectValue ?? OrderedJSONObject()) }
            XCTAssertEqual(actual, golden, "prs/\(label): buildPrs mismatch")
        }
    }

    // MARK: - analytics/weekly-report-cases-v1

    func testBuildWeeklyReportParityForEveryCase() throws {
        let root = try goldenRoot("analytics/weekly-report-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "analytics/weekly-report-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "expected the weekly-report cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("weekly-report case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let asOfDate = try XCTUnwrap(c.optionalString("asOfDate"), "\(label): asOfDate")
            let bodyWeights = (c.optionalArray("bodyWeights") ?? []).map { item -> AnalyticsDashboardEngine.BodyWeight in
                AnalyticsDashboardEngine.BodyWeight(value: item.objectValue?.optionalDouble("value"))
            }
            let actual = AnalyticsDashboardEngine.buildWeeklyReport(history, bodyWeights, asOfDate: asOfDate)
            XCTAssertEqual(actual, c.optionalString("result") ?? "", "weekly-report/\(label): buildWeeklyReport mismatch")
        }
    }

    // MARK: - analytics/adherence-report-cases-v1

    private func decodeSessionRow(_ o: OrderedJSONObject) -> AnalyticsDashboardEngine.AdherenceSessionRow {
        AnalyticsDashboardEngine.AdherenceSessionRow(
            sessionId: o.optionalString("sessionId") ?? "",
            date: o.optionalString("date") ?? "",
            templateName: o.optionalString("templateName") ?? "",
            plannedSets: o.optionalDouble("plannedSets") ?? 0,
            actualSets: o.optionalDouble("actualSets") ?? 0,
            adherenceRate: o.optionalDouble("adherenceRate") ?? 0,
            mainPlannedSets: o.optionalDouble("mainPlannedSets") ?? 0,
            mainActualSets: o.optionalDouble("mainActualSets") ?? 0,
            correctionPlannedSets: o.optionalDouble("correctionPlannedSets") ?? 0,
            correctionActualSets: o.optionalDouble("correctionActualSets") ?? 0,
            functionalPlannedSets: o.optionalDouble("functionalPlannedSets") ?? 0,
            functionalActualSets: o.optionalDouble("functionalActualSets") ?? 0,
            hasSupportData: o.optionalBool("hasSupportData") ?? false
        )
    }

    private func decodeAdherenceReport(_ o: OrderedJSONObject) -> AnalyticsDashboardEngine.AdherenceReport {
        let recentSessions = (o.optionalArray("recentSessions") ?? []).map { decodeSessionRow($0.objectValue ?? OrderedJSONObject()) }
        let skipped = (o.optionalArray("skippedExercises") ?? []).map { item -> AnalyticsDashboardEngine.SkippedExercise in
            let so = item.objectValue ?? OrderedJSONObject()
            return AnalyticsDashboardEngine.SkippedExercise(
                exerciseId: so.optionalString("exerciseId") ?? "",
                count: so.optionalDouble("count") ?? 0,
                mostCommonReason: so.optionalString("mostCommonReason")
            )
        }
        let skippedSupport = (o.optionalArray("skippedSupportExercises") ?? []).map { item -> AnalyticsDashboardEngine.SkippedSupportExercise in
            let so = item.objectValue ?? OrderedJSONObject()
            return AnalyticsDashboardEngine.SkippedSupportExercise(
                exerciseId: so.optionalString("exerciseId") ?? "",
                moduleId: so.optionalString("moduleId") ?? "",
                blockType: so.optionalString("blockType") ?? "",
                count: so.optionalDouble("count") ?? 0,
                mostCommonReason: so.optionalString("mostCommonReason")
            )
        }
        return AnalyticsDashboardEngine.AdherenceReport(
            recentSessionCount: o.optionalDouble("recentSessionCount") ?? 0,
            plannedSets: o.optionalDouble("plannedSets") ?? 0,
            actualSets: o.optionalDouble("actualSets") ?? 0,
            overallRate: o.optionalDouble("overallRate") ?? 0,
            mainlineRate: o.optionalDouble("mainlineRate") ?? 0,
            correctionRate: o.optionalDouble("correctionRate"),
            functionalRate: o.optionalDouble("functionalRate"),
            recentSessions: recentSessions,
            skippedExercises: skipped,
            skippedSupportExercises: skippedSupport,
            suggestions: o.optionalStringArray("suggestions") ?? [],
            confidence: o.optionalString("confidence") ?? ""
        )
    }

    func testBuildAdherenceReportParityForEveryCase() throws {
        let root = try goldenRoot("analytics/adherence-report-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "analytics/adherence-report-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "expected the adherence-report cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("adherence-report case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let actual = AnalyticsDashboardEngine.buildAdherenceReport(history)
            let golden = decodeAdherenceReport(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "adherence-report/\(label): buildAdherenceReport mismatch")
        }
    }

    // MARK: - analytics/adherence-report-tie-cases-v1 (AN-8 sort-stability load-bearing)

    /// The AN-8 tie golden: a PURE skippedExercises count tie (every count == 1) whose
    /// JS-stable insertion order is pinned through the slice(0,5) cut. `stableSorted`'s
    /// original-index tiebreak makes that insertion-order intent explicit; Swift's
    /// `sort(by:)` is itself contractually stable since Swift 5.8 (SE-0372), so a plain
    /// `.sorted` would also hold the order. Generated from the retired legacy engine, never
    /// hand-edited (§22).
    func testBuildAdherenceReportTieCaseParity() throws {
        let root = try goldenRoot("analytics/adherence-report-tie-cases-v1")
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "analytics/adherence-report-tie-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 1, "expected the AN-8 tie case")
        for caseValue in cases {
            let c = try caseValue.requireObject("adherence-report tie case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let actual = AnalyticsDashboardEngine.buildAdherenceReport(history)
            let golden = decodeAdherenceReport(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "adherence-report-tie/\(label): buildAdherenceReport mismatch")
            // Load-bearing, asserted explicitly: equal-count skips keep the JS insertion
            // (Map first-seen) order through the slice(0,5) cut — stableSorted's
            // original-index tiebreak encodes that insertion-order intent explicitly.
            XCTAssertTrue(actual.skippedExercises.allSatisfy { $0.count == 1 }, "\(label): pure tie (every count == 1)")
            XCTAssertEqual(
                actual.skippedExercises.map(\.exerciseId),
                ["skip-zulu", "skip-yankee", "skip-xray", "skip-whiskey", "skip-victor"],
                "\(label): equal-count skips must keep JS insertion order through slice(0,5)"
            )
        }
    }
}
