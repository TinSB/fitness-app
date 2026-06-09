// CC-4 coach-action read-path V1 — branch tests for `resolveCoachActionState` +
// `CoachActionSurfaceSummary` + the ③ injected-clock contract.
//
// Covers (1) the PURE outcome→state branch logic (no IO, no live store): the thin app-layer loader
// supplies the `CoachActionAppDataLoadOutcome` (already routed through the GENUINE RedeDataHealth
// clean view); this resolver maps it to an honest rendered state; (2) the clean-view → engine wiring
// end-to-end — a document WITH `templates` decoded from the gated view's raw bag yields a REAL
// pending coach action (the SC-C next-workout signal); (3) the ③/CC-4 §11.2 injected-clock contract —
// the live path threads a NON-EMPTY `nowIso` into `buildCoachActions`, which becomes every action's
// `createdAt`, so the engine's `nonEmpty(now) ?? ""` fallback is never reached; and (4) the legacy web app
// presenter mirror (label maps / fallbacks / primaryLabel / cleanText). Clean-view fixtures are built
// in memory via CoreSliceTestKit; the injected `now` matches the parity clock so results are
// deterministic. Mirrors NextWorkoutReadPathTests / TrainingInsightsReadPathTests.

import XCTest
import RedeDomain
import RedeDataHealth
@testable import RedeTrainingDecision

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

    /// Parse a fixed UTC ISO-8601 instant (for the injected-clock day-key tests). Deterministic — it
    /// never reads the wall clock; the resolver's civil day-key derives from THIS instant + a zone.
    private func instant(_ iso: String) -> Date {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: iso)!
    }

    /// Two completed sessions (latest 2d ago, prior 9d ago) — a real baseline.
    private func sessionsWithBaseline() -> [TrainingSession] {
        [CoreSliceTestKit.session(id: "cc-late", gap: 2),
         CoreSliceTestKit.session(id: "cc-early", gap: 9)]
    }

    /// A raw `templates[]` entry (the un-promoted document slot the read path decodes from
    /// `root["templates"]`, mirroring the legacy web app `data.templates`).
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
        // The honest read-only header + empty copy is always carried.
        XCTAssertEqual(summary.title, "教练建议")
        XCTAssertEqual(summary.emptyText, "暂无需要处理的教练建议。")
        // Each row carries the dismiss/detail labels; "暂不处理" is the CC-5 gated-dismiss button label.
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

    // MARK: - legacy web app presenter mirror (label maps / fallbacks / primaryLabel / cleanText)

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

    // MARK: - CC-6 dismiss READ-FILTER wiring (the dismiss/draft/history hide is now part of THIS read path)

    /// Build a clean view carrying templates + arbitrary extra root slots (`dismissedCoachActions` /
    /// `programAdjustmentDrafts` / `programAdjustmentHistory` / `settings`), through the GENUINE
    /// DataHealth ingress — exercising the CC-6 read-filter end-to-end over the gated clean view.
    private func cleanViewWithExtraRoot(
        sessions: [TrainingSession],
        templates: [JSONValue],
        extraRoot: [OrderedJSONObject.Entry]
    ) -> CleanAppDataView {
        var entries: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
            .init(key: "history", value: .array(sessions.map { $0.encoded() })),
            .init(key: "todayStatus", value: CoreSliceTestKit.todayStatusJSON()),
            .init(key: "templates", value: .array(templates)),
        ]
        entries.append(contentsOf: extraRoot)
        let appData = AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
        return buildCleanAppDataView(appData, clock: CoreSliceTestKit.fixedClock)
    }

    private func dismissTemplates() -> [JSONValue] {
        [templateJSON(id: "push-a", name: "推 A"), templateJSON(id: "pull-a", name: "拉 A")]
    }

    /// The pending action ids the read path surfaces for the baseline document (no dismiss / draft /
    /// history) — the actions CC-6 then selectively hides. `selectedTemplateId` is nil throughout, so
    /// the next-workout signal (hence the surfaced ids) is identical with or without the extra slots.
    private func baselinePendingIds() -> [String] {
        let cleanView = cleanViewWithTemplates(sessions: sessionsWithBaseline(), templates: dismissTemplates())
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow()) else {
            return []
        }
        return summary.actions.map { $0.id }
    }

    private func dismissedEntry(actionId: String, day: String) -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "actionId", value: .string(actionId)),
            .init(key: "dismissedAt", value: .string(day)),
            .init(key: "scope", value: .string("today")),
        ]))
    }

    func test_dismissedToday_hidesExactlyThatCard() {
        // TRIVIAL local==UTC control: under an injected UTC zone the resolver's LOCAL civil day equals
        // the UTC prefix, so `dismissedAt` = `fixedNowIso().prefix(10)` lines up. Deterministic (a fixed
        // injected zone — NOT the CI machine's `.current`). The LOCAL≠UTC proof is the CC-7 test below.
        let utc = TimeZone(identifier: "UTC")!
        let ids = baselinePendingIds()
        XCTAssertFalse(ids.isEmpty, "baseline must surface a pending action to dismiss")
        let victim = ids[0]
        let today = String(fixedNowIso().prefix(10))
        let cleanView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "dismissedCoachActions", value: .array([dismissedEntry(actionId: victim, day: today)]))]
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow(), timeZone: utc) else {
            return XCTFail("expected .ready")
        }
        XCTAssertFalse(summary.actions.contains { $0.id == victim }, "the 'today'-dismissed action is hidden")
        XCTAssertEqual(summary.actions.count, ids.count - 1, "exactly the dismissed action drops out")
    }

    func test_dismissedViaSettingsSlotOnly_alsoHides_readPriorityRootOrSettings() {
        let utc = TimeZone(identifier: "UTC")!
        let ids = baselinePendingIds()
        let victim = ids[0]
        let today = String(fixedNowIso().prefix(10))
        // NO root `dismissedCoachActions`; only the nested `settings` slot carries it → the read-side
        // priority `root || settings` still finds it (a legacy-web-origin doc may carry only the settings half;
        // the CC-5 write double-writes both). Injected UTC zone keeps the local day == the UTC prefix.
        let settings = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "dismissedCoachActions", value: .array([dismissedEntry(actionId: victim, day: today)])),
        ]))
        let cleanView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "settings", value: settings)]
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow(), timeZone: utc) else {
            return XCTFail("expected .ready")
        }
        XCTAssertFalse(summary.actions.contains { $0.id == victim }, "a settings-only dismiss still hides (root || settings)")
        XCTAssertEqual(summary.actions.count, ids.count - 1, "exactly the dismissed action drops out")
    }

    func test_dismissedAnotherCivilDay_doesNotHide_currentDateLocalKeyFromInjectedInstant() {
        let utc = TimeZone(identifier: "UTC")!
        let ids = baselinePendingIds()
        let victim = ids[0]
        let otherDay = "1999-12-31"
        XCTAssertNotEqual(otherDay, String(fixedNowIso().prefix(10)), "the fixture day must differ from the current civil day")
        let cleanView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "dismissedCoachActions", value: .array([dismissedEntry(actionId: victim, day: otherDay)]))]
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow(), timeZone: utc) else {
            return XCTFail("expected .ready")
        }
        // A dismiss from a DIFFERENT civil day is not "dismissed today" → still visible. This pins
        // currentDateLocalKey == the LOCAL civil day of the injected instant (here, under the injected
        // UTC zone, == the UTC prefix): had the resolver read a different / empty date key, the
        // today-match would not line up with the injected instant.
        XCTAssertTrue(summary.actions.contains { $0.id == victim }, "a cross-day dismiss recovers (visible today)")
        XCTAssertEqual(summary.actions.count, ids.count, "no action drops out for a cross-day dismiss")
    }

    func test_currentDateLocalKey_isLocalCivilDay_notUTC_acrossTimezoneMidnight() {
        // CC-7 P1 regression (the fix for the CC-6 UTC-day bug). The dismiss read-filter's
        // currentDateLocalKey MUST be the LOCAL civil day — the CC-5 write side stamps `dismissedAt`
        // in the device-local `.current` zone — NOT the UTC day. Pick an instant whose UTC day and
        // America/Los_Angeles day DIFFER: 2026-06-05T02:00Z is 2026-06-04 19:00 PDT (UTC-7). The zone
        // is INJECTED + fixed, so the test never depends on the CI machine's `.current` TZ.
        let la = TimeZone(identifier: "America/Los_Angeles")!
        let now = instant("2026-06-05T02:00:00.000Z")
        let localDay = "2026-06-04"   // LA civil day of `now`
        let utcDay = "2026-06-05"     // the WRONG (UTC) day the CC-6 `nowIso.prefix(10)` bug produced

        // (1) Direct: the in-package day-key derives the LOCAL civil day, never the UTC prefix.
        XCTAssertEqual(coachActionCivilDayKey(now, timeZone: la), localDay,
            "currentDateLocalKey must be the LA-local civil day derived from the injected instant")
        XCTAssertNotEqual(coachActionCivilDayKey(now, timeZone: la), utcDay,
            "a UTC-prefix day key (the CC-6 bug) would read 2026-06-05 and mis-hide across the midnight window")

        // Baseline pending ids at THIS injected (now, tz) — robust to whatever the scheduler surfaces.
        let baseView = cleanViewWithTemplates(sessions: sessionsWithBaseline(), templates: dismissTemplates())
        guard case .ready(let base) = resolveCoachActionState(.loaded(baseView), now: now, timeZone: la) else {
            return XCTFail("expected .ready baseline")
        }
        let ids = base.actions.map { $0.id }
        XCTAssertFalse(ids.isEmpty, "baseline must surface a pending action to dismiss")
        let victim = ids[0]

        // (2) End-to-end: a dismiss stamped on the LOCAL civil day (exactly what CC-5 persists) HIDES
        // the card. This assertion is RED on the CC-6 UTC-day bug (currentDate would be 2026-06-05, so
        // the 2026-06-04 dismiss would not match) and GREEN on the CC-7 fix.
        let localView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "dismissedCoachActions", value: .array([dismissedEntry(actionId: victim, day: localDay)]))]
        )
        guard case .ready(let localSummary) = resolveCoachActionState(.loaded(localView), now: now, timeZone: la) else {
            return XCTFail("expected .ready")
        }
        XCTAssertFalse(localSummary.actions.contains { $0.id == victim },
            "a LOCAL-civil-day dismiss hides the card across the timezone midnight window")
        XCTAssertEqual(localSummary.actions.count, ids.count - 1, "exactly the local-day-dismissed action drops out")

        // (3) Control (the inverse): a dismiss stamped on the UTC day does NOT hide — proving the read
        // day is LOCAL, not UTC. On the CC-6 bug this would be inverted (the UTC-day dismiss would hide).
        let utcView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "dismissedCoachActions", value: .array([dismissedEntry(actionId: victim, day: utcDay)]))]
        )
        guard case .ready(let utcSummary) = resolveCoachActionState(.loaded(utcView), now: now, timeZone: la) else {
            return XCTFail("expected .ready")
        }
        XCTAssertTrue(utcSummary.actions.contains { $0.id == victim },
            "a UTC-day dismiss does NOT match the LOCAL current day → the card stays visible")
        XCTAssertEqual(utcSummary.actions.count, ids.count, "no action drops out for a UTC-day dismiss")
    }

    func test_matchingActiveDraft_hidesTheCard() {
        let ids = baselinePendingIds()
        let victim = ids[0]
        // A draft whose `sourceCoachActionId == action.id` (coachActionDismissEngine.ts:82) with an
        // ACTIVE status → findExistingAdjustmentForCoachAction = draft_ready → filterVisible drops it.
        let draft = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "id", value: .string("cc6-draft-1")),
            .init(key: "status", value: .string("draft_created")),
            .init(key: "sourceCoachActionId", value: .string(victim)),
        ]))
        let cleanView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "programAdjustmentDrafts", value: .array([draft]))]
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready")
        }
        XCTAssertFalse(summary.actions.contains { $0.id == victim }, "an action resolved by a matching active draft is hidden")
        XCTAssertEqual(summary.actions.count, ids.count - 1, "exactly the resolved action drops out")
    }

    func test_matchingHistory_hidesTheCard() {
        let ids = baselinePendingIds()
        let victim = ids[0]
        // A history item whose `sourceCoachActionId == action.id` (ts:100), non-rolled-back → state
        // "applied" → filterVisible drops the action.
        let item = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "id", value: .string("cc6-hist-1")),
            .init(key: "status", value: .string("applied")),
            .init(key: "sourceCoachActionId", value: .string(victim)),
        ]))
        let cleanView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "programAdjustmentHistory", value: .array([item]))]
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready")
        }
        XCTAssertFalse(summary.actions.contains { $0.id == victim }, "an action resolved by a matching history item is hidden")
        XCTAssertEqual(summary.actions.count, ids.count - 1, "exactly the resolved action drops out")
    }

    func test_rolledBackDraft_doesNotHide() {
        let ids = baselinePendingIds()
        let victim = ids[0]
        // A matching draft whose ONLY status is `rolled_back` (no blocking active/resolved draft) →
        // findExistingAdjustment = rolled_back → filterVisible KEEPS the action (it is the one match
        // state that survives, coachActionDismissEngine.ts:146).
        let draft = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "id", value: .string("cc6-draft-rb")),
            .init(key: "status", value: .string("rolled_back")),
            .init(key: "sourceCoachActionId", value: .string(victim)),
        ]))
        let cleanView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: [.init(key: "programAdjustmentDrafts", value: .array([draft]))]
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready")
        }
        XCTAssertTrue(summary.actions.contains { $0.id == victim }, "a rolled_back match keeps the action visible")
        XCTAssertEqual(summary.actions.count, ids.count, "no action drops out for a rolled_back match")
    }

    func test_noDismissOrAdjustment_leavesBaselineUnchanged() {
        // Sanity: with no dismiss / draft / history, the read filter is a no-op — the baseline survives.
        let ids = baselinePendingIds()
        let cleanView = cleanViewWithExtraRoot(
            sessions: sessionsWithBaseline(),
            templates: dismissTemplates(),
            extraRoot: []
        )
        guard case .ready(let summary) = resolveCoachActionState(.loaded(cleanView), now: fixedNow()) else {
            return XCTFail("expected .ready")
        }
        XCTAssertEqual(summary.actions.map { $0.id }, ids, "no dismiss / adjustment → the read filter changes nothing")
    }
}
