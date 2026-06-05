// CC-4 coach-action read-path V1 — branch tests for `resolveCoachActionState` +
// `CoachActionSurfaceSummary` + the ③ injected-clock contract.
//
// Covers (1) the PURE outcome→state branch logic (no IO, no live store): the thin app-layer loader
// supplies the `CoachActionAppDataLoadOutcome` (already routed through the GENUINE IronPathDataHealth
// clean view); this resolver maps it to an honest rendered state; (2) the clean-view → engine wiring
// end-to-end — a document WITH `templates` decoded from the gated view's raw bag yields a REAL
// pending coach action (the SC-C next-workout signal); (3) the ③/CC-4 §11.2 injected-clock contract —
// the live path threads a NON-EMPTY `nowIso` into `buildCoachActions`, which becomes every action's
// `createdAt`, so the engine's `nonEmpty(now) ?? ""` fallback is never reached; and (4) the PWA
// presenter mirror (label maps / fallbacks / primaryLabel / cleanText). Clean-view fixtures are built
// in memory via CoreSliceTestKit; the injected `now` matches the parity clock so results are
// deterministic. Mirrors NextWorkoutReadPathTests / TrainingInsightsReadPathTests.

import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

final class CoachActionReadPathTests: XCTestCase {

    private typealias Summary = CoachActionSurfaceSummary

    /// The injected instant for the resolver — the same UTC parity instant the CoreSliceTestKit
    /// session gaps derive from.
    private func fixedNow() -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: CoreSliceTestKit.deterministicClockIso)!
    }

    /// The UTC ISO-8601 the resolver derives from `fixedNow()` (same helper shape) — the value the
    /// live path injects as `createdAt`.
    private func fixedNowIso() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.string(from: fixedNow())
    }

    /// Two completed sessions (latest 2d ago, prior 9d ago) — a real baseline.
    private func sessionsWithBaseline() -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "cc-late", gap: 2),
         CoreSliceTestKit.session(id: "cc-early", gap: 9)]
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

    /// Build a clean view from an in-memory AppData that ALSO carries a raw `templates[]` slot
    /// (CoreSliceTestKit.makeAppData does not), exercising the read path's template decode end-to-end
    /// through the GENUINE DataHealth clean-view ingress.
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

    // MARK: - resolver branches (mirror resolveNextWorkoutScheduleState)

    func test_missing_resolvesToEmpty() {
        XCTAssertEqual(resolveCoachActionState(.missing, now: fixedNow()), .empty)
    }

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolveCoachActionState(.unreadable, now: fixedNow()), .unavailable)
    }

    func test_loadedEmptyHistory_resolvesToEmpty() {
        // A loaded document with NO cleaned history → honest empty, never the engines' bare defaults.
        let cleanView = CoreSliceTestKit.cleanView(sessions: [], todayStatus: CoreSliceTestKit.todayStatusJSON())
        XCTAssertEqual(resolveCoachActionState(.loaded(cleanView), now: fixedNow()), .empty)
    }

    func test_resolution_isDeterministic() {
        let cleanView = cleanViewWithTemplates(
            sessions: sessionsWithBaseline(),
            templates: [templateJSON(id: "push-a", name: "推 A"), templateJSON(id: "pull-a", name: "拉 A")]
        )
        let a = resolveCoachActionState(.loaded(cleanView), now: fixedNow())
        let b = resolveCoachActionState(.loaded(cleanView), now: fixedNow())
        XCTAssertEqual(a, b)
    }

    // MARK: - clean-view → engine wiring (end-to-end through the genuine clean view)

    func test_loadedWithTemplates_resolvesToReadyWithPendingActions() {
        let cleanView = cleanViewWithTemplates(
            sessions: sessionsWithBaseline(),
            templates: [
                templateJSON(id: "push-a", name: "推 A"),
                templateJSON(id: "pull-a", name: "拉 A"),
                templateJSON(id: "legs-a", name: "腿 A"),
            ]
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready for a document with cleaned history + templates")
        }
        // The SC-C next-workout signal becomes at least one pending coach action.
        XCTAssertFalse(summary.actions.isEmpty, "a real next-workout signal yields a pending coach action")
        XCTAssertTrue(summary.actions.contains { $0.id.hasPrefix("next-workout-") },
                      "the next-workout coach action is surfaced")
        // The honest read-only header + empty/deferral copy is always carried.
        XCTAssertEqual(summary.title, "教练建议")
        XCTAssertEqual(summary.emptyText, "暂无需要处理的教练建议。")
        XCTAssertTrue(summary.dismissDeferredNote.contains("CC-5"), "dismiss persistence is honestly deferred to CC-5")
        // Each row carries the read-only dismiss/detail labels (DISPLAY-ONLY; never wired to a write).
        for row in summary.actions {
            XCTAssertEqual(row.secondaryLabel, "暂不处理")
            XCTAssertEqual(row.detailLabel, "查看详情")
        }
    }

    // MARK: - ③ §11.2 injected-clock contract (nowIso threaded into createdAt; "" never reached)

    func test_injectedNowIso_becomesCreatedAt_neverEmptyFallback() {
        // Reconstruct the SAME wiring the resolver performs (the private assembly is exercised
        // end-to-end above; here we assert the engine boundary the ③ contract pins).
        let cleanView = cleanViewWithTemplates(
            sessions: sessionsWithBaseline(),
            templates: [templateJSON(id: "push-a", name: "推 A"), templateJSON(id: "pull-a", name: "拉 A")]
        )
        let nowIso = fixedNowIso()
        XCTAssertFalse(nowIso.isEmpty, "ISO8601DateFormatter always yields a non-empty instant")

        let todayState = TodayStateEngine.buildTodayTrainingState(
            activeSession: cleanView.cleanedActiveSession,
            history: cleanView.cleanedHistory,
            plannedTemplateId: cleanView.raw.settings.selectedTemplateId,
            nowIso: nowIso
        )
        let templates = (cleanView.raw.root["templates"]?.arrayValue ?? []).compactMap { try? TrainingTemplate(decoding: $0) }
        let nextWorkout = NextWorkoutScheduler.buildNextWorkoutRecommendation(
            history: cleanView.cleanedHistory,
            activeSession: cleanView.cleanedActiveSession,
            programTemplate: cleanView.raw.programTemplate,
            templates: templates,
            todayState: todayState
        )
        let actions = CoachActionEngine.buildCoachActions(
            CoachActionEngine.BuildCoachActionsInput(
                appData: AppData(schemaVersion: .current, root: OrderedJSONObject(entries: [])),
                nextWorkout: nextWorkout,
                now: nowIso
            )
        )
        XCTAssertFalse(actions.isEmpty, "the wiring produces at least the next-workout action")
        for action in actions {
            // ③: every createdAt is the INJECTED nowIso, never the engine's empty-string fallback.
            XCTAssertEqual(action.createdAt, nowIso, "\(action.id): createdAt must be the injected nowIso")
            XCTAssertFalse(action.createdAt.isEmpty, "\(action.id): createdAt must never be the empty fallback")
        }
    }

    // MARK: - PWA presenter mirror (label maps / fallbacks / primaryLabel / cleanText)

    private func action(
        id: String = "x",
        source: String = "nextWorkout",
        actionType: String = "open_next_workout",
        priority: String = "low",
        status: String = "pending",
        title: String = "查看下次训练：推 A",
        description: String = "打开下次训练建议详情。",
        reason: String = "按计划轮转判断。",
        requiresConfirmation: Bool = false,
        reversible: Bool = false,
        targetId: String? = nil,
        targetType: String? = nil
    ) -> CoachActionEngine.CoachAction {
        CoachActionEngine.CoachAction(
            id: id, title: title, description: description, source: source, actionType: actionType,
            priority: priority, status: status, requiresConfirmation: requiresConfirmation,
            reversible: reversible, createdAt: "2026-06-03T10:00:00.000Z", targetId: targetId,
            targetType: targetType, reason: reason
        )
    }

    func test_sourceAndPriorityAndStatus_labels() {
        XCTAssertEqual(Summary.sourceLabels["nextWorkout"], "下次训练")
        XCTAssertEqual(Summary.sourceLabels["dataHealth"], "数据健康")
        XCTAssertEqual(Summary.priorityLabels["urgent"], "优先处理")
        XCTAssertEqual(Summary.priorityLabels["low"], "可稍后看")
        XCTAssertEqual(Summary.statusLabels["pending"], "待处理")
        XCTAssertEqual(Summary.priorityRank("urgent"), 4)
        XCTAssertEqual(Summary.priorityRank("low"), 1)
        XCTAssertEqual(Summary.priorityRank("???"), 0)
    }

    func test_makeRow_rendersReadOnlyFields() {
        let row = Summary.makeRow(action(requiresConfirmation: true, reversible: true))
        XCTAssertEqual(row.sourceLabel, "下次训练")
        XCTAssertEqual(row.priorityLabel, "可稍后看")
        XCTAssertEqual(row.statusLabel, "待处理")
        XCTAssertEqual(row.confirmationLabel, "需要确认")
        XCTAssertEqual(row.reversibleLabel, "可撤销")
        XCTAssertEqual(row.primaryLabel, "查看建议")  // open_next_workout
        XCTAssertEqual(row.secondaryLabel, "暂不处理")
        XCTAssertEqual(row.detailLabel, "查看详情")
        XCTAssertNil(row.disabledReason)
    }

    func test_makeRow_confirmationAndReversibleFalseBranch() {
        let row = Summary.makeRow(action(requiresConfirmation: false, reversible: false))
        XCTAssertEqual(row.confirmationLabel, "只查看")
        XCTAssertNil(row.reversibleLabel)
    }

    func test_fallbackTitle_usedWhenTitleEmpty() {
        let row = Summary.makeRow(action(source: "dataHealth", actionType: "open_data_health", title: ""))
        XCTAssertEqual(row.title, "检查数据健康")  // fallbackTitle(dataHealth)
        XCTAssertEqual(row.primaryLabel, "查看数据")  // open_data_health
    }

    func test_draftActionMissingTarget_disabledReasonAndViewLabel() {
        // create_plan_adjustment_preview WITHOUT a usable target → disabled reason + "查看建议".
        let row = Summary.makeRow(action(
            source: "plateau", actionType: "create_plan_adjustment_preview", title: "生成动作调整预览",
            targetId: nil, targetType: nil
        ))
        XCTAssertEqual(row.primaryLabel, "查看建议")
        XCTAssertEqual(row.disabledReason, "当前建议缺少可生成草案的目标信息，只能先查看原因。")
    }

    func test_draftActionWithTarget_generatesDraftLabel() {
        let row = Summary.makeRow(action(
            source: "volumeAdaptation", actionType: "create_plan_adjustment_preview", title: "生成训练量调整预览",
            targetId: "back", targetType: "muscle"
        ))
        XCTAssertEqual(row.primaryLabel, "生成调整草案")
        XCTAssertNil(row.disabledReason)
    }

    func test_cleanText_scrubsRawTokensAndFallsBack() {
        // A bare raw token → scrubbed to empty → fallback.
        XCTAssertEqual(Summary.cleanText("pending", fallback: "FB"), "FB")
        // A mojibake hit → fallback.
        XCTAssertEqual(Summary.cleanText("锛乱码", fallback: "FB"), "FB")
        // Clean CJK passes through untouched.
        XCTAssertEqual(Summary.cleanText("查看下次训练", fallback: "FB"), "查看下次训练")
    }

    func test_pendingOnly_sortedByPriorityThenTitle() {
        // dismissed/applied are filtered (surface 'today' = pending only); urgent sorts above low.
        let summary = Summary(actions: [
            action(id: "a", priority: "low", status: "pending", title: "乙"),
            action(id: "b", priority: "urgent", status: "pending", title: "甲"),
            action(id: "c", priority: "low", status: "dismissed", title: "丙"),
        ])
        XCTAssertEqual(summary.actions.map { $0.id }, ["b", "a"], "urgent first, dismissed filtered out")
    }
}
