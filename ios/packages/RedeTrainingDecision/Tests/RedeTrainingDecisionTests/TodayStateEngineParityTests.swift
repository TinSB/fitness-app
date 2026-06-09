// SC-B — todayStateEngine parity tests.
//
// FUNCTION-LEVEL compute-assert: for the `today-state/today-state-cases-v1` golden, decode each
// case's echoed engineInput (activeSession? / history / selectedDate? / currentLocalDate? /
// plannedTemplateId?), run the PORTED `TodayStateEngine.buildTodayTrainingState` on the SAME
// inputs, and assert the produced `TodayTrainingState` equals the golden case's `result`. The
// per-status union fields the golden omits (e.g. `not_started` has no `activeSessionId`) decode to
// nil — matching what the corresponding branch leaves nil.
//
// The golden is GENERATED from the retired legacy todayStateEngine (frozen legacy fixture generator),
// never hand-edited (§22). PURE / read-only — zero `: Date`; the injected `nowIso` seam below is
// NEVER the load-bearing path (every fixture passes selectedDate or currentLocalDate), so its fixed
// value is irrelevant to the assertion.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TodayStateEngineParityTests: XCTestCase {

    /// Fixed injected `new Date().toISOString()` seam — unused for every fixture.
    private static let nowIso = "2026-06-04T08:00:00.000Z"

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
            "ios/ParityFixtures/parity/golden/today-state/today-state-cases-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("today-state/today-state-cases-v1")
    }

    private func history(_ c: OrderedJSONObject) throws -> [TrainingSession] {
        try (c.optionalArray("history") ?? []).map { try TrainingSession(decoding: $0) }
    }

    private func decodeResult(_ o: OrderedJSONObject) -> TodayStateEngine.TodayTrainingState {
        TodayStateEngine.TodayTrainingState(
            status: o.optionalString("status") ?? "",
            date: o.optionalString("date") ?? "",
            primaryAction: o.optionalString("primaryAction") ?? "",
            plannedTemplateId: o.optionalString("plannedTemplateId"),
            activeSessionId: o.optionalString("activeSessionId"),
            completedSessionIds: o.optionalStringArray("completedSessionIds"),
            lastCompletedSessionId: o.optionalString("lastCompletedSessionId")
        )
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing today-state golden")
        let root = try root()
        XCTAssertEqual(root.optionalString("sourceFixtureId"), "today-state/today-state-cases-v1")
        XCTAssertGreaterThanOrEqual((root.optionalArray("cases") ?? []).count, 11, "expected the today-state cases")
    }

    func testBuildTodayTrainingStateParityForEveryCase() throws {
        let root = try root()
        let cases = root.optionalArray("cases") ?? []
        XCTAssertFalse(cases.isEmpty, "no cases")
        for caseValue in cases {
            let c = try caseValue.requireObject("today-state case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let activeSession = try c.optionalObject("activeSession").map { try TrainingSession(decoding: .object($0)) }
            let history = try history(c)

            let actual = TodayStateEngine.buildTodayTrainingState(
                activeSession: activeSession,
                history: history,
                selectedDate: c.optionalString("selectedDate"),
                currentLocalDate: c.optionalString("currentLocalDate"),
                plannedTemplateId: c.optionalString("plannedTemplateId"),
                nowIso: Self.nowIso
            )
            let golden = decodeResult(try XCTUnwrap(c.optionalObject("result"), "\(label): result"))
            XCTAssertEqual(actual, golden, "today-state/\(label): buildTodayTrainingState mismatch")
        }
    }
}
