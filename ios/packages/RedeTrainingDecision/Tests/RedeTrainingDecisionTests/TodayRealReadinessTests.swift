// Today real-AppData read path V1 — branch tests for `resolveTodayReadinessState`.
//
// Covers the PURE outcome→state branch logic only (no IO, no live store): the thin
// app-layer loader supplies the `TodayAppDataLoadOutcome` (already routed through
// the GENUINE RedeDataHealth clean view); this resolver maps it to an honest
// rendered state and — for a loaded view with cleaned history — mints the branded
// input and reads the engine (raw AppData never reaches the engine, master §10/§11).
// Clean-view fixtures are built in memory via CoreSliceTestKit (no committed user
// JSON), every date derives from the fixed parity clock, and the injected `now`
// matches the clock those views were built with so the result is deterministic.

import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

final class TodayRealReadinessTests: XCTestCase {

    /// The injected instant for the resolver — the same UTC parity instant the
    /// CoreSliceTestKit session gaps + todayStatus dates derive from.
    private func fixedNow() -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: CoreSliceTestKit.deterministicClockIso)!
    }

    /// Two completed sessions (latest 2d ago, prior 9d ago) — a real baseline.
    private func sessionsWithBaseline() -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "td-late", gap: 2),
         CoreSliceTestKit.session(id: "td-early", gap: 9)]
    }

    // MARK: - missing → empty (first launch / no live source)

    func test_missing_resolvesToEmpty() {
        XCTAssertEqual(resolveTodayReadinessState(.missing, now: fixedNow()), .empty)
    }

    // MARK: - unreadable → unavailable (present but unparseable; never overwritten)

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolveTodayReadinessState(.unreadable, now: fixedNow()), .unavailable)
    }

    // MARK: - loaded-but-empty history → empty (no baseline to compute from)

    func test_loadedEmptyHistory_resolvesToEmpty() {
        let cleanView = CoreSliceTestKit.cleanView(sessions: [], todayStatus: CoreSliceTestKit.todayStatusJSON())
        XCTAssertEqual(resolveTodayReadinessState(.loaded(cleanView), now: fixedNow()), .empty)
    }

    // MARK: - loaded with cleaned history → ready(summary)

    func test_loadedWithHistory_resolvesToReadySummary() {
        let cleanView = CoreSliceTestKit.cleanView(
            sessions: sessionsWithBaseline(),
            todayStatus: CoreSliceTestKit.todayStatusJSON()
        )
        guard case .ready(let summary) = resolveTodayReadinessState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready for a document with cleaned history")
        }
        // The same stable decision rows the surface renders, all populated (no leaks).
        XCTAssertEqual(
            summary.decisionRows.map(\.id),
            ["readinessLevel", "trainingAdjustment", "sessionIntent", "activePhase", "riskLevel", "finalVolumeMultiplier"]
        )
        for row in summary.decisionRows {
            XCTAssertFalse(row.value.isEmpty, "value empty for \(row.id)")
        }
        XCTAssertTrue(summary.headline.hasPrefix("准备度 · "))
    }

    /// Proves the user's REAL on-disk todayStatus flows end-to-end through the clean
    /// view into the rendered summary (not the fixed sample): a custom status on the
    /// loaded AppData shows up verbatim in the status rows.
    func test_loadedDocumentsRealTodayStatus_flowsIntoStatusRows() {
        let cleanView = CoreSliceTestKit.cleanView(
            sessions: sessionsWithBaseline(),
            todayStatus: CoreSliceTestKit.todayStatusJSON(
                sleep: "充足", energy: "高", soreness: ["腿", "肩"], time: "75"
            )
        )
        guard case .ready(let summary) = resolveTodayReadinessState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready")
        }
        let byId = Dictionary(uniqueKeysWithValues: summary.statusRows.map { ($0.id, $0.value) })
        XCTAssertEqual(byId["sleep"], "充足")
        XCTAssertEqual(byId["energy"], "高")
        XCTAssertEqual(byId["time"], "75 分钟")
        XCTAssertEqual(byId["soreness"], "腿、肩")
    }

    // MARK: - determinism (same outcome + now → same state)

    func test_resolution_isDeterministic() {
        let cleanView = CoreSliceTestKit.cleanView(
            sessions: sessionsWithBaseline(),
            todayStatus: CoreSliceTestKit.todayStatusJSON()
        )
        let a = resolveTodayReadinessState(.loaded(cleanView), now: fixedNow())
        let b = resolveTodayReadinessState(.loaded(cleanView), now: fixedNow())
        XCTAssertEqual(a, b)
    }
}
