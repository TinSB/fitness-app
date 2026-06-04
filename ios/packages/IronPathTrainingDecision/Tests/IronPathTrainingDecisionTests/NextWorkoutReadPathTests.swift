// SC-D scheduling read-path V1 — branch tests for `resolveNextWorkoutScheduleState` +
// `NextWorkoutScheduleSummary`.
//
// Covers (1) the PURE outcome→state branch logic (no IO, no live store): the thin
// app-layer loader supplies the `NextWorkoutAppDataLoadOutcome` (already routed through the
// GENUINE IronPathDataHealth clean view); this resolver maps it to an honest rendered state;
// (2) the clean-view → scheduler wiring end-to-end — a document WITH `templates` decoded from
// the gated view's raw bag yields a REAL next-workout + nested recovery recommendation, while
// a document WITHOUT templates yields the scheduler's own honest "暂无下次建议" branch (never a
// fabricated next workout); and (3) every internal presentation label helper branch (kindLabel
// / confidenceLabel / conflictLabel — the summary marks them `internal so tests can assert`).
// Clean-view fixtures are built in memory via CoreSliceTestKit; the injected `now` matches the
// parity clock so results are deterministic. Mirrors TrainingInsightsReadPathTests.

import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

final class NextWorkoutReadPathTests: XCTestCase {

    /// The injected instant for the resolver — the same UTC parity instant the
    /// CoreSliceTestKit session gaps derive from.
    private func fixedNow() -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: CoreSliceTestKit.deterministicClockIso)!
    }

    /// Two completed sessions (latest 2d ago, prior 9d ago) — a real baseline.
    private func sessionsWithBaseline() -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "sc-late", gap: 2),
         CoreSliceTestKit.session(id: "sc-early", gap: 9)]
    }

    /// A raw `templates[]` entry (the un-promoted document slot the read path decodes from
    /// `root["templates"]`, mirroring the PWA `data.templates`).
    private func templateJSON(id: String, name: String) -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "id", value: .string(id)),
            .init(key: "name", value: .string(name)),
            .init(key: "focus", value: .string("")),
            .init(key: "duration", value: .number(.integer(60))),
            .init(key: "note", value: .string("")),
            .init(key: "exercises", value: .array([])),
        ]))
    }

    /// Build a clean view from an in-memory AppData that ALSO carries a raw `templates[]`
    /// slot (CoreSliceTestKit.makeAppData does not), exercising the read path's template
    /// decode end-to-end through the GENUINE DataHealth clean-view ingress.
    private func cleanViewWithTemplates(sessions: [TrainingSession], templates: [JSONValue]) -> CleanAppDataView {
        let entries: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
            .init(key: "history", value: .array(sessions.map { $0.encoded() })),
            .init(key: "todayStatus", value: CoreSliceTestKit.todayStatusJSON()),
            .init(key: "templates", value: .array(templates)),
        ]
        let appData = AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
        return buildCleanAppDataView(appData, clock: CoreSliceTestKit.fixedClock)
    }

    // MARK: - resolver branches (mirror resolveTrainingInsightsState)

    func test_missing_resolvesToEmpty() {
        XCTAssertEqual(resolveNextWorkoutScheduleState(.missing, now: fixedNow()), .empty)
    }

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolveNextWorkoutScheduleState(.unreadable, now: fixedNow()), .unavailable)
    }

    func test_loadedEmptyHistory_resolvesToEmpty() {
        // A loaded document with NO cleaned history → honest empty, never the schedulers' bare
        // first-launch defaults.
        let cleanView = CoreSliceTestKit.cleanView(sessions: [], todayStatus: CoreSliceTestKit.todayStatusJSON())
        XCTAssertEqual(resolveNextWorkoutScheduleState(.loaded(cleanView), now: fixedNow()), .empty)
    }

    func test_resolution_isDeterministic() {
        let cleanView = cleanViewWithTemplates(
            sessions: sessionsWithBaseline(),
            templates: [templateJSON(id: "push-a", name: "推 A"), templateJSON(id: "pull-a", name: "拉 A")]
        )
        let a = resolveNextWorkoutScheduleState(.loaded(cleanView), now: fixedNow())
        let b = resolveNextWorkoutScheduleState(.loaded(cleanView), now: fixedNow())
        XCTAssertEqual(a, b)
    }

    // MARK: - clean-view → scheduler wiring (end-to-end through the genuine clean view)

    func test_loadedWithTemplates_resolvesToRealRecommendationWithRecovery() {
        let cleanView = cleanViewWithTemplates(
            sessions: sessionsWithBaseline(),
            templates: [
                templateJSON(id: "push-a", name: "推 A"),
                templateJSON(id: "pull-a", name: "拉 A"),
                templateJSON(id: "legs-a", name: "腿 A"),
            ]
        )
        guard case .ready(let summary) = resolveNextWorkoutScheduleState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready for a document with cleaned history + templates")
        }
        // A REAL next workout (decoded templates → ordered non-empty), not the no-template fallback.
        XCTAssertNotEqual(summary.headline, "暂无下次建议")
        XCTAssertFalse(summary.headline.isEmpty)
        // The at-a-glance rows always lead with the recommended day + a confidence row.
        XCTAssertEqual(summary.scheduleRows.first?.id, "next-template")
        XCTAssertTrue(summary.scheduleRows.contains { $0.id == "next-confidence" })
        // 恢复感知推荐 is produced for a real (non-short-circuit) recommendation.
        XCTAssertNotNil(summary.recovery, "a real recommendation carries a nested recovery section")
        XCTAssertFalse(summary.recovery?.conflictLabel.isEmpty ?? true)
    }

    func test_loadedWithoutTemplates_resolvesToHonestNoSuggestionReady() {
        // History present but NO templates in the document → the scheduler's own honest
        // no-suggestion branch (never a fabricated next workout).
        let cleanView = CoreSliceTestKit.cleanView(
            sessions: sessionsWithBaseline(),
            todayStatus: CoreSliceTestKit.todayStatusJSON()
        )
        guard case .ready(let summary) = resolveNextWorkoutScheduleState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready (the honest no-suggestion recommendation is still a ready state)")
        }
        XCTAssertEqual(summary.headline, "暂无下次建议")
        XCTAssertEqual(summary.kindLabel, "主动恢复")  // activeRecovery fallback
        XCTAssertFalse(summary.warnings.isEmpty, "the no-template branch warns to add a template")
        XCTAssertNil(summary.recovery, "the no-template short-circuit carries no recovery section")
    }

    // MARK: - label helpers (deterministic, no engine)

    func test_kindLabel_everyCase() {
        XCTAssertEqual(NextWorkoutScheduleSummary.kindLabel(.train), "正常训练")
        XCTAssertEqual(NextWorkoutScheduleSummary.kindLabel(.modifiedTrain), "调整后训练")
        XCTAssertEqual(NextWorkoutScheduleSummary.kindLabel(.rest), "休息")
        XCTAssertEqual(NextWorkoutScheduleSummary.kindLabel(.activeRecovery), "主动恢复")
        XCTAssertEqual(NextWorkoutScheduleSummary.kindLabel(.mobilityOnly), "仅活动度")
    }

    func test_confidenceLabel_everyCase() {
        XCTAssertEqual(NextWorkoutScheduleSummary.confidenceLabel(.high), "高")
        XCTAssertEqual(NextWorkoutScheduleSummary.confidenceLabel(.medium), "中")
        XCTAssertEqual(NextWorkoutScheduleSummary.confidenceLabel(.low), "低")
    }

    func test_conflictLabel_everyCase() {
        XCTAssertEqual(NextWorkoutScheduleSummary.conflictLabel(.none), "无")
        XCTAssertEqual(NextWorkoutScheduleSummary.conflictLabel(.low), "低")
        XCTAssertEqual(NextWorkoutScheduleSummary.conflictLabel(.moderate), "中")
        XCTAssertEqual(NextWorkoutScheduleSummary.conflictLabel(.high), "高")
    }
}
