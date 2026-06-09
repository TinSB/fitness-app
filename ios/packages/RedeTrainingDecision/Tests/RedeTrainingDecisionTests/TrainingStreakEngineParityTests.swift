// AN-1 — trainingStreakEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for the `training-streak/*` golden, decode each case's
// echoed engineInput (history + options), run the PORTED `TrainingStreakEngine.computeTrainingStreak`
// on the SAME inputs, and assert the produced `TrainingStreakResult` equals the golden
// case's `result` field-by-field (week/month current+longest streaks, totalAnalyticsSessions,
// lastActiveWeekKey, reason). Every field is Int / String / optional-String, so equality is
// plain struct `==`.
//
// The golden is GENERATED from the retired legacy trainingStreakEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero
// `: Date` (the injected `options.nowIso` is the only clock), no IO beyond reading the
// committed golden.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingStreakEngineParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static var goldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/training-streak/streak-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("training-streak/streak-cases-v1")
    }

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func options(_ c: OrderedJSONObject) throws -> TrainingStreakEngine.TrainingStreakOptions {
        let o = try XCTUnwrap(c.optionalObject("options"), "case: options")
        let nowIso = try XCTUnwrap(o.optionalString("nowIso"), "case: options.nowIso")
        return TrainingStreakEngine.TrainingStreakOptions(
            nowIso: nowIso,
            weekStartDayOfWeek: o.optionalInt("weekStartDayOfWeek")
        )
    }

    private func decodeResult(_ o: OrderedJSONObject) -> TrainingStreakEngine.TrainingStreakResult {
        TrainingStreakEngine.TrainingStreakResult(
            currentWeekStreak: o.optionalInt("currentWeekStreak") ?? 0,
            longestWeekStreak: o.optionalInt("longestWeekStreak") ?? 0,
            currentMonthStreak: o.optionalInt("currentMonthStreak") ?? 0,
            longestMonthStreak: o.optionalInt("longestMonthStreak") ?? 0,
            totalAnalyticsSessions: o.optionalInt("totalAnalyticsSessions") ?? 0,
            lastActiveWeekKey: o.optionalString("lastActiveWeekKey"),
            reason: o.optionalString("reason") ?? ""
        )
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing training-streak golden")
        let root = try root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "training-streak/streak-cases-v1")
        XCTAssertGreaterThanOrEqual((root.optionalArray("cases") ?? []).count, 5, "expected the 5 streak cases")
    }

    func testComputeTrainingStreakParityForEveryCase() throws {
        let root = try root()
        let cases = root.optionalArray("cases") ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("training-streak case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let options = try options(c)

            let actual = TrainingStreakEngine.computeTrainingStreak(history, options)
            let golden = decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "training-streak/\(label): computeTrainingStreak mismatch")
        }
    }

    // MARK: - AN-1b boundary fixtures (streak-boundary-cases-v1)

    private static var boundaryGoldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/training-streak/streak-boundary-cases-v1.json", isDirectory: false
        )
    }

    private func boundaryRoot() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.boundaryGoldenURL)
        return try JSONValue(decoding: data).requireObject("training-streak/streak-boundary-cases-v1")
    }

    /// AN-1b coverage-debt pins: the `finishedAt ?? startedAt ?? date` precedence + the
    /// full-ISO→noon `safeDate` branch + non-Monday (Sunday) `weekStartDayOfWeek`, and
    /// `prevMonthKey` cross-year underflow + month-carry (`2026-01` → `2025-12`).
    func testComputeTrainingStreakParityForBoundaryCases() throws {
        let root = try boundaryRoot()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "training-streak/streak-boundary-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 2, "expected the 2 streak boundary cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("training-streak boundary case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let options = try options(c)
            let actual = TrainingStreakEngine.computeTrainingStreak(history, options)
            let golden = decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "training-streak/\(label): computeTrainingStreak mismatch")
        }
    }
}
