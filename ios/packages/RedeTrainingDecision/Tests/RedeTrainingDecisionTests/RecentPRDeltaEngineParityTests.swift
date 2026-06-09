// AN-1 — recentPRDeltaEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for the `recent-pr-delta/*` golden, decode each case's
// echoed engineInput (history + options), run the PORTED `RecentPRDeltaEngine.computeRecentPRDeltas`
// on the SAME inputs, and assert the produced `[RecentPRDeltaEntry]` equals the golden case's
// `result` array **item-by-item AND in order** (the sort: new first, then deltaKg descending,
// then the `limit` slice). The rounded `deltaKg` / `deltaPercent` Doubles are compared with
// EXACT `==` (the fixtures use non-tie decimals so the ported `roundToFixed` matches JS
// `toFixed` bit-for-bit).
//
// The golden is GENERATED from the retired legacy recentPRDeltaEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero
// `: Date` (the injected `options.nowIso` is the only clock), no IO beyond reading the
// committed golden.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class RecentPRDeltaEngineParityTests: XCTestCase {

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
            "ios/ParityFixtures/parity/golden/recent-pr-delta/delta-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("recent-pr-delta/delta-cases-v1")
    }

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func options(_ c: OrderedJSONObject) throws -> RecentPRDeltaEngine.RecentPRDeltaOptions {
        let o = try XCTUnwrap(c.optionalObject("options"), "case: options")
        let nowIso = try XCTUnwrap(o.optionalString("nowIso"), "case: options.nowIso")
        return RecentPRDeltaEngine.RecentPRDeltaOptions(
            nowIso: nowIso,
            windowDays: o.optionalInt("windowDays"),
            limit: o.optionalInt("limit")
        )
    }

    private func decodeEntry(_ o: OrderedJSONObject) -> RecentPRDeltaEngine.RecentPRDeltaEntry {
        RecentPRDeltaEngine.RecentPRDeltaEntry(
            exerciseId: o.optionalString("exerciseId") ?? "",
            exerciseName: o.optionalString("exerciseName") ?? "",
            windowDays: o.optionalInt("windowDays") ?? 0,
            currentBestKg: o.optionalDouble("currentBestKg") ?? 0,
            currentBestReps: o.optionalDouble("currentBestReps") ?? 0,
            currentBestDate: o.optionalString("currentBestDate") ?? "",
            previousBestKg: o.optionalDouble("previousBestKg"),
            previousBestReps: o.optionalDouble("previousBestReps"),
            previousBestDate: o.optionalString("previousBestDate"),
            deltaKg: o.optionalDouble("deltaKg"),
            deltaPercent: o.optionalDouble("deltaPercent"),
            direction: o.optionalString("direction") ?? ""
        )
    }

    private func decodeResult(_ arr: [JSONValue]?) throws -> [RecentPRDeltaEngine.RecentPRDeltaEntry] {
        try (arr ?? []).map { decodeEntry(try $0.requireObject("recent-pr-delta entry")) }
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing recent-pr-delta golden")
        let root = try root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "recent-pr-delta/delta-cases-v1")
        XCTAssertGreaterThanOrEqual((root.optionalArray("cases") ?? []).count, 4, "expected the 4 PR-delta cases")
    }

    func testComputeRecentPRDeltasParityForEveryCase() throws {
        let root = try root()
        let cases = root.optionalArray("cases") ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("recent-pr-delta case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let options = try options(c)

            let actual = RecentPRDeltaEngine.computeRecentPRDeltas(history, options)
            let golden = try decodeResult(c.optionalArray("result"))
            XCTAssertEqual(actual, golden, "recent-pr-delta/\(label): computeRecentPRDeltas mismatch")
        }
    }

    // MARK: - AN-1b boundary fixtures (delta-boundary-cases-v1)

    private static var boundaryGoldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/recent-pr-delta/delta-boundary-cases-v1.json", isDirectory: false
        )
    }

    private func boundaryRoot() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.boundaryGoldenURL)
        return try JSONValue(decoding: data).requireObject("recent-pr-delta/delta-boundary-cases-v1")
    }

    /// AN-1b coverage-debt pins: both-new NaN-tie + equal-`deltaKg` 0-tie (JS-stable
    /// insertion order), `pickBest` full-equality (weight AND reps) first-seen-wins, and
    /// the `roundToFixed` `.XX5` tie (deltaKg `5.55` — the old multiply-then-round
    /// `roundToFixed` would have produced `5.56`, so this case PROVES the fidelity fix).
    func testComputeRecentPRDeltasParityForBoundaryCases() throws {
        let root = try boundaryRoot()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "recent-pr-delta/delta-boundary-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 3, "expected the 3 PR-delta boundary cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("recent-pr-delta boundary case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let history = try history(c)
            let options = try options(c)
            let actual = RecentPRDeltaEngine.computeRecentPRDeltas(history, options)
            let golden = try decodeResult(c.optionalArray("result"))
            XCTAssertEqual(actual, golden, "recent-pr-delta/\(label): computeRecentPRDeltas mismatch")
        }
    }
}
