// SC-B — trainingCalendarEngine self-contained subset parity tests.
//
// FUNCTION-LEVEL compute-assert: for the `calendar-helpers/helper-cases-v1` golden, decode each
// case's `kind` + echoed inputs, run the PORTED `TrainingCalendarEngine` helper on the SAME inputs,
// and assert the produced value equals the golden case's `result`. The 9 string-returning helpers
// compare `String == result`; `buildTrainingCalendarMonthRange` compares the decoded
// `TrainingCalendarMonthRange` struct.
//
// The golden is GENERATED from the retired legacy trainingCalendarEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero `: Date`;
// the injected `nowMonth` / `nowIso` seams below are NEVER the load-bearing path (every fixture
// passes valid months / explicit dates), so their fixed values are irrelevant to the assertion.
// The aggregator `buildTrainingCalendar` is DEFERRED (its real prerequisite is the COMPLETE
// `sessionDetailSummary`) — not ported, not tested here.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingCalendarEngineParityTests: XCTestCase {

    /// Fixed injected `monthKey()` seam — unused for every fixture (all months are valid).
    private static let nowMonth = "2026-06"

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static var goldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/calendar-helpers/helper-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("calendar-helpers/helper-cases-v1")
    }

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func decodeRange(_ o: OrderedJSONObject) -> TrainingCalendarEngine.TrainingCalendarMonthRange {
        TrainingCalendarEngine.TrainingCalendarMonthRange(
            earliestMonth: o.optionalString("earliestMonth") ?? "",
            latestMonth: o.optionalString("latestMonth") ?? "",
            hasHistory: o.optionalBool("hasHistory") ?? false
        )
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing calendar-helpers golden")
        let root = try root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "calendar-helpers/helper-cases-v1")
        XCTAssertGreaterThanOrEqual((root.optionalArray("cases") ?? []).count, 44, "expected the calendar helper cases")
    }

    func testCalendarHelperParityForEveryCase() throws {
        let root = try root()
        let cases = root.optionalArray("cases") ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        let nowMonth = Self.nowMonth
        for caseValue in cases {
            let c = try caseValue.requireObject("calendar-helpers case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let kind = try c.requireString("kind", "\(label): kind")
            let history = try history(c)

            switch kind {
            case "toLocalDateKey":
                let actual = TrainingCalendarEngine.toLocalDateKey(c.optionalString("value"))
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): toLocalDateKey")

            case "getSessionCalendarDate":
                let session = try TrainingSession(decoding: .object(try XCTUnwrap(c.optionalObject("session"), "\(label): session")))
                let actual = TrainingCalendarEngine.getSessionCalendarDate(session)
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): getSessionCalendarDate")

            case "normalizeCalendarMonth":
                let actual = TrainingCalendarEngine.normalizeCalendarMonth(
                    c.optionalString("month"),
                    try c.requireString("fallback", "\(label): fallback")
                )
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): normalizeCalendarMonth")

            case "addCalendarMonths":
                let actual = TrainingCalendarEngine.addCalendarMonths(
                    try c.requireString("month", "\(label): month"),
                    delta: try XCTUnwrap(c.optionalInt("delta"), "\(label): delta"),
                    nowMonth: nowMonth
                )
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): addCalendarMonths")

            case "buildTrainingCalendarMonthRange":
                let actual = TrainingCalendarEngine.buildTrainingCalendarMonthRange(
                    history,
                    currentMonth: try c.requireString("currentMonth", "\(label): currentMonth")
                )
                let golden = decodeRange(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
                XCTAssertEqual(actual, golden, "\(label): buildTrainingCalendarMonthRange")

            case "clampCalendarMonth":
                let range = decodeRange(try XCTUnwrap(c.optionalObject("range"), "\(label): range"))
                let actual = TrainingCalendarEngine.clampCalendarMonth(
                    try c.requireString("month", "\(label): month"), range, nowMonth: nowMonth
                )
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): clampCalendarMonth")

            case "getLatestTrainingDateKey":
                let actual = TrainingCalendarEngine.getLatestTrainingDateKey(history, month: c.optionalString("month"))
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): getLatestTrainingDateKey")

            case "getInitialCalendarMonth":
                let actual = TrainingCalendarEngine.getInitialCalendarMonth(
                    history,
                    selectedDate: c.optionalString("selectedDate"),
                    currentMonth: try c.requireString("currentMonth", "\(label): currentMonth")
                )
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): getInitialCalendarMonth")

            case "getDefaultCalendarDateForMonth":
                let actual = TrainingCalendarEngine.getDefaultCalendarDateForMonth(
                    history,
                    month: try c.requireString("month", "\(label): month"),
                    fallbackDate: c.optionalString("fallbackDate"),
                    nowMonth: nowMonth
                )
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): getDefaultCalendarDateForMonth")

            case "resolveCalendarSelectedDate":
                let actual = TrainingCalendarEngine.resolveCalendarSelectedDate(
                    history,
                    month: try c.requireString("month", "\(label): month"),
                    currentSelectedDate: c.optionalString("currentSelectedDate"),
                    fallbackDate: c.optionalString("fallbackDate"),
                    nowMonth: nowMonth
                )
                XCTAssertEqual(actual, c.optionalString("result"), "\(label): resolveCalendarSelectedDate")

            default:
                XCTFail("\(label): unknown kind \(kind)")
            }
        }
    }
}
