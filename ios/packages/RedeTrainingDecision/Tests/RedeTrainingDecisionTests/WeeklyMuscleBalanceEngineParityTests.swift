// AN-1 — weeklyMuscleBalanceEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for the `weekly-muscle-balance/*` golden, decode each case's
// echoed engineInput (history + options), run the PORTED
// `WeeklyMuscleBalanceEngine.computeWeeklyMuscleBalance` on the SAME inputs, and assert the
// produced `WeeklyMuscleBalance` equals the golden case's `result` field-by-field
// (weekStartKey, totalEffectiveSets, totalEstimatedVolumeKg, the ordered `entries` array
// [muscle/effectiveSets/estimatedVolumeKg/share], overworked/underworked muscle lists,
// balanceScore, headline). The rounded `effectiveSets` / `share` / `totalEffectiveSets`
// Doubles are compared with EXACT `==`.
//
// The golden is GENERATED from the retired legacy weeklyMuscleBalanceEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero
// `: Date` (the injected `options.nowIso` is the only clock), no IO beyond reading the
// committed golden.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class WeeklyMuscleBalanceEngineParityTests: XCTestCase {

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
            "ios/ParityFixtures/parity/golden/weekly-muscle-balance/balance-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("weekly-muscle-balance/balance-cases-v1")
    }

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func options(_ c: OrderedJSONObject) throws -> WeeklyMuscleBalanceEngine.WeeklyMuscleBalanceOptions {
        let o = try XCTUnwrap(c.optionalObject("options"), "case: options")
        let nowIso = try XCTUnwrap(o.optionalString("nowIso"), "case: options.nowIso")
        return WeeklyMuscleBalanceEngine.WeeklyMuscleBalanceOptions(
            nowIso: nowIso,
            weekStartDayOfWeek: o.optionalInt("weekStartDayOfWeek"),
            focusMuscles: o.optionalStringArray("focusMuscles")
        )
    }

    private func decodeEntry(_ o: OrderedJSONObject) -> WeeklyMuscleBalanceEngine.MuscleBalanceEntry {
        WeeklyMuscleBalanceEngine.MuscleBalanceEntry(
            muscle: o.optionalString("muscle") ?? "",
            effectiveSets: o.optionalDouble("effectiveSets") ?? 0,
            estimatedVolumeKg: o.optionalInt("estimatedVolumeKg") ?? 0,
            share: o.optionalDouble("share") ?? 0
        )
    }

    private func decodeResult(_ o: OrderedJSONObject) throws -> WeeklyMuscleBalanceEngine.WeeklyMuscleBalance {
        let entries = try (o.optionalArray("entries") ?? []).map { decodeEntry(try $0.requireObject("muscle entry")) }
        return WeeklyMuscleBalanceEngine.WeeklyMuscleBalance(
            weekStartKey: o.optionalString("weekStartKey") ?? "",
            totalEffectiveSets: o.optionalDouble("totalEffectiveSets") ?? 0,
            totalEstimatedVolumeKg: o.optionalInt("totalEstimatedVolumeKg") ?? 0,
            entries: entries,
            overworkedMuscles: o.optionalStringArray("overworkedMuscles") ?? [],
            underworkedMuscles: o.optionalStringArray("underworkedMuscles") ?? [],
            balanceScore: o.optionalInt("balanceScore") ?? 0,
            headline: o.optionalString("headline") ?? ""
        )
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing weekly-muscle-balance golden")
        let root = try root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "weekly-muscle-balance/balance-cases-v1")
        XCTAssertGreaterThanOrEqual((root.optionalArray("cases") ?? []).count, 4, "expected the 4 muscle-balance cases")
    }

    func testComputeWeeklyMuscleBalanceParityForEveryCase() throws {
        let root = try root()
        let cases = root.optionalArray("cases") ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("weekly-muscle-balance case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let options = try options(c)

            let actual = WeeklyMuscleBalanceEngine.computeWeeklyMuscleBalance(history, options)
            let golden = try decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "weekly-muscle-balance/\(label): computeWeeklyMuscleBalance mismatch")
        }
    }

    // MARK: - AN-1b boundary fixtures (balance-boundary-cases-v1)

    private static var boundaryGoldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/weekly-muscle-balance/balance-boundary-cases-v1.json", isDirectory: false
        )
    }

    private func boundaryRoot() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.boundaryGoldenURL)
        return try JSONValue(decoding: data).requireObject("weekly-muscle-balance/balance-boundary-cases-v1")
    }

    /// AN-1b coverage-debt pins: non-focus muscles surfacing via `effectiveSets > 0` + Map
    /// insertion-order tie + the `roundToFixed` `.XX5` tie (effectiveSets `2.67` — the old
    /// multiply-then-round would have produced `2.68`), `focusEntries.count < 2` gate, and
    /// the ±12 overworked/underworked threshold hit EXACTLY (shares 62 / 38 → ±12).
    func testComputeWeeklyMuscleBalanceParityForBoundaryCases() throws {
        let root = try boundaryRoot()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "weekly-muscle-balance/balance-boundary-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "expected the 3 muscle-balance boundary cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("weekly-muscle-balance boundary case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let options = try options(c)
            let actual = WeeklyMuscleBalanceEngine.computeWeeklyMuscleBalance(history, options)
            let golden = try decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "weekly-muscle-balance/\(label): computeWeeklyMuscleBalance mismatch")
        }
    }
}
