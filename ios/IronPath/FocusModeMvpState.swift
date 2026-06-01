// FocusModeMvpState — iOS-8 Native Local Training MVP Mega Migration V1.
//
// Pure in-memory state for the native Focus session demo. Holds the selected
// sample scenario, the cursor into the today exercise list, the per-exercise
// completed-set counts, the plan/in-session/completed stage, and — after the
// user finishes — an in-RAM completed-session summary for the local preview.
//
// 100% in-RAM. No FileManager, no UserDefaults, no AppData write, no disk, no
// network. Resets on app restart. Resets progress + summary whenever the
// scenario changes. Timestamps come from an INJECTABLE clock (deterministic by
// default — never an inline Date()), matching FocusModePreviewData's
// deterministic-sample philosophy; real wall-clock + on-disk persistence are a
// deferred follow-up (see IOS_8 doc).

import Foundation
import SwiftUI
import IronPathDomain
import IronPathDataHealth
import IronPathPersistence
import IronPathTrainingDecision
import IronPathLocalSnapshot

/// The plan -> in-session -> completed flow. `isInSession` stays available as a
/// computed alias so existing read sites keep working.
enum FocusSessionStage: Equatable {
    case plan
    case inSession
    case completed
}

/// Outcome of the last local-save attempt. Drives the completed-screen banner.
/// `.failed` carries an honest error string — there is NO fake-success state.
enum FocusSaveStatus: Equatable {
    case idle
    case saved
    case failed(String)
}

/// Outcome of the last local debug-copy export attempt (iOS-10). `.failed`
/// carries an honest error — never a fabricated success.
enum FocusExportStatus: Equatable {
    case idle
    case exported
    case nothingToExport
    case failed(String)
}

/// DEEP-EDIT-1: outcome of an in-place logged-set correction (重量 / 次数 / RIR).
/// `.failed` carries an honest error string — there is NO fake-success state: a
/// correction is reported `.saved` only after a real, DataHealth-gated, atomic
/// canonical write committed it.
enum LoggedSetEditOutcome: Equatable {
    case saved
    case failed(String)
}

/// SR-4: outcome of an in-place exercise replacement (换动作) or its restore (复原).
/// `.failed` carries an honest error string — there is NO fake-success state: a
/// replacement is reported `.saved` only after a real, DataHealth-gated, atomic
/// canonical write committed it. Mirrors `LoggedSetEditOutcome`.
enum ExerciseSwapOutcome: Equatable {
    case saved
    case failed(String)
}

/// SR-4 display: the canonical-first replacement state for ONE history exercise, so the
/// saved-session detail can show the ACTUAL exercise (换动作 后的动作) and attribute the
/// performed sets to it. Resolved read-only through the §10 clean view — the override
/// lives in canonical history (not the derived LocalSnapshot copy), so it shows
/// persistently (cold start too).
struct ExerciseReplacementDisplay: Equatable {
    /// True when a user replacement is recorded: `actualExerciseId` is set AND differs
    /// from the original planned/logged id (never inferred from `originalExerciseId`,
    /// which this feature never writes).
    let isReplaced: Bool
    /// The effective actual exercise id (the override when replaced, else the original).
    let actualExerciseId: String
    /// The library-resolved display name of the actual exercise (falls back to the id).
    let actualName: String
}

/// SR-4 (a) presentation row: ONE smart-replacement recommendation, flattened by the
/// view-model from the engine's `SmartReplacementRecommendation` so the thin detail view
/// renders it WITHOUT importing the engine package (the presentation layer stays free of
/// engine/canonical tokens, mirroring `canonicalSetDisplay`). The engine returns rows
/// already ordered (primary → secondary → angle variation → avoid), so the view renders
/// them in order; `priorityLabel` carries the Chinese category for the row's chip.
struct ReplacementOptionRow: Identifiable, Equatable {
    let id: String          // the candidate exercise id (what a 换动作 writes as the actual)
    let name: String        // the candidate's display name (engine-resolved)
    let priority: String    // raw: "primary" | "secondary" | "angle_variation" | "avoid"
    let priorityLabel: String   // 优先推荐 / 次选 / 角度变化 / 不建议
    let fatigueLabel: String    // 低疲劳 / 中疲劳 / 高疲劳 (or "")
    let reason: String
}

/// Outcome of the last restore-to-local-draft attempt (iOS-11). `.failed`
/// carries an honest error and NO draft is started — never a fake restore.
enum FocusRestoreStatus: Equatable {
    case idle
    case restored(String)   // scenario label of the restored draft
    case failed(String)
}

/// iOS-17A: outcome of writing the completed session to the CANONICAL AppData
/// document (the source of truth, §8). Distinct from `FocusSaveStatus` (which is
/// the LocalSnapshot history copy) so each store reports its own honest result.
/// `.failed` carries an honest error — there is NO fake-success state. `.skipped`
/// means nothing canonical was written because no per-set detail was captured
/// (an honest "no performed sets to record", not a failure).
enum FocusCanonicalSaveStatus: Equatable {
    case idle
    case saved
    case skipped
    case failed(String)
}

/// One completed-exercise line in the local saved preview (in-RAM only).
struct FocusCompletedExerciseLine: Identifiable, Equatable {
    let id: String
    let name: String
    let role: String
    let completedSets: Int
    let targetSets: Int
}

/// The in-memory snapshot the local preview renders. Never written to disk.
struct FocusCompletedSessionSummary: Equatable {
    let scenarioLabel: String
    let sessionIntent: String
    let activePhase: String
    let deloadLevel: String
    let deloadStrategy: String
    let lines: [FocusCompletedExerciseLine]
    let totalCompletedSets: Int
    let totalTargetSets: Int
    let timestampLabel: String
}

@MainActor
final class FocusModeMvpState: ObservableObject {

    @Published private(set) var selectedScenario: FocusModeSampleScenario = .normal
    @Published var selectedExerciseIndex: Int = 0
    @Published private(set) var completedSetsByExerciseId: [String: Int] = [:]
    @Published private(set) var stage: FocusSessionStage = .plan
    /// Non-nil only after `completeSession`. The local saved preview reads this.
    @Published private(set) var completedSummary: FocusCompletedSessionSummary? = nil

    // MARK: - iOS-9 local persistence surface (delegated to the store)

    /// The most-recently-saved on-disk snapshot, loaded on launch and refreshed
    /// after each save. nil when nothing is saved locally yet.
    @Published private(set) var latestSaved: LocalCompletedSessionSnapshot? = nil
    /// Recent saved snapshots (newest first) for the local history list.
    @Published private(set) var savedHistory: [LocalCompletedSessionSnapshot] = []
    /// Result of the last save attempt — `.failed` shows an honest error and is
    /// never replaced by a fabricated success.
    @Published private(set) var saveStatus: FocusSaveStatus = .idle
    /// Non-nil when a save/load/clear error must be shown non-blockingly.
    @Published private(set) var saveErrorMessage: String? = nil

    // MARK: - iOS-10 local hardening surface (validation / stats / diagnostics)

    /// Count of saved files that failed to decode OR failed schema validation
    /// and were therefore skipped from the valid history. Drives the local
    /// "invalid skipped" warning.
    @Published private(set) var invalidSkippedCount: Int = 0
    /// Derived local stats over the valid saved snapshots.
    @Published private(set) var stats: LocalSnapshotStats = .empty
    /// Local-only storage status for the diagnostics surface.
    @Published private(set) var storageDiagnostics: LocalSnapshotStorageDiagnostics = .empty
    /// Result of the last local debug-copy export attempt.
    @Published private(set) var exportStatus: FocusExportStatus = .idle
    /// iOS-11: # of saved files whose on-disk schema was below current and were
    /// migrated forward in memory on the last refresh.
    @Published private(set) var migratedSavedCount: Int = 0
    /// iOS-11: result of the last restore-to-local-draft attempt.
    @Published private(set) var restoreStatus: FocusRestoreStatus = .idle
    /// iOS-13: reconciliation of the last restore — which saved exercises matched
    /// the current scenario, which were skipped (renamed/removed), which are new.
    /// nil until a restore is attempted.
    @Published private(set) var restoreReconciliation: LocalDraftRestoreReconciliation? = nil

    /// iOS-15: the coarse date-range filter selected on the history surface.
    /// Pure in-RAM UI state (no disk, no IO); applied against the same injectable
    /// clock the rest of the history surface uses, so previews/tests stay
    /// deterministic. Settable so the history control can bind to it.
    @Published var historyDateRange: LocalHistoryDateRange = .all

    /// iOS-16: custom from/to date-range filter state for the history surface.
    /// Pure in-RAM UI state (no disk, no IO). `historyCustomRange` is nil unless
    /// the user turns custom filtering on. The default from/to are deterministic
    /// (the reference instant, NEVER an inline `Date()`) so previews/tests never
    /// depend on the wall clock; enabling the control seeds a sensible window
    /// from the injectable clock.
    @Published var historyCustomRangeEnabled: Bool = false
    @Published var historyCustomFrom: Date = FocusModeMvpState.deterministicReferenceDate()
    @Published var historyCustomTo: Date = FocusModeMvpState.deterministicReferenceDate()

    // MARK: - iOS-17b in-RAM per-set capture (NO persistence)

    /// Per-exercise captured set drafts for the ACTIVE session, in RAM only.
    /// Uses the existing typed `IronPathDomain.ActualSetDraft` (kg-stored). This
    /// is the capture half of the iOS-17 set-logging epic; it is NOT persisted —
    /// the canonical-AppData write path is the deferred iOS-17c slice. Cleared
    /// alongside `completedSetsByExerciseId` (resetProgress / restoreDraft) so it
    /// never outlives the counts it parallels. Vanishes on relaunch (in-RAM).
    @Published private(set) var capturedSetDraftsByExerciseId: [String: [ActualSetDraft]] = [:]

    /// Display unit for the capture weight field (storage is always kg; the
    /// view-model converts before recording). In-RAM UI state, default `.kg`.
    @Published var captureDisplayUnit: WeightUnit = .kg

    /// Source marker stamped onto every captured draft, so a draft is always
    /// attributable to this local native capture surface (never confused with
    /// imported/cloud data).
    static let captureSourceTag = "local-ios-focus-capture"

    // MARK: - iOS-17A canonical-AppData write status (the source of truth, §8)

    /// Result of the last attempt to append the completed session to the canonical
    /// AppData document. `.failed` surfaces an honest error and never reads as
    /// success; `.skipped` means no per-set detail was captured so nothing
    /// canonical was written. Drives the completed-screen canonical banner.
    @Published private(set) var canonicalSaveStatus: FocusCanonicalSaveStatus = .idle

    /// The active custom interval, or nil when custom filtering is off. Read by
    /// the history view and passed straight into the pure, unit-tested
    /// `LocalSnapshotHistory.filtered(customRange:)`. No logic beyond on/off.
    var historyCustomRange: LocalHistoryCustomDateRange? {
        historyCustomRangeEnabled
            ? LocalHistoryCustomDateRange(from: historyCustomFrom, to: historyCustomTo)
            : nil
    }

    /// Turn custom date filtering on/off. On first enable, seed the interval to
    /// roughly the last 30 days from the injectable clock (deterministic by
    /// default — NEVER an inline `Date()`) so the pickers don't start at the 1970
    /// epoch. Pure in-RAM UI wiring; no disk, no IO, no engine.
    func setHistoryCustomRangeEnabled(_ on: Bool) {
        if on && !historyCustomRangeEnabled {
            let now = clock()
            historyCustomTo = now
            historyCustomFrom = LocalSnapshotHistory.utcCalendar.date(byAdding: .day, value: -30, to: now) ?? now
        }
        historyCustomRangeEnabled = on
    }

    /// The sanctioned app-local JSON store. Injectable for previews/tests; the
    /// app uses the default Application Support location. NOTE: this class never
    /// touches FileManager directly — all disk IO is delegated to the store.
    private let snapshotStore: LocalSessionSnapshotStore

    /// iOS-17A: the CANONICAL AppData store (the source of truth, §8). Optional so
    /// previews/tests can opt OUT of canonical writes entirely (nil → the FIRST
    /// native write path is simply not exercised, and `canonicalSaveStatus` stays
    /// `.idle`). The running app injects the Application Support store from the
    /// shell's `.task` (mirroring `useSystemClock()`), so SwiftUI previews never
    /// touch the real on-disk canonical document. All disk IO is delegated to the
    /// store + the pure `CanonicalSessionWriter`; this class never touches
    /// FileManager directly.
    private var appDataStore: AppDataStore?

    init(
        snapshotStore: LocalSessionSnapshotStore = LocalSessionSnapshotStore(),
        appDataStore: AppDataStore? = nil
    ) {
        self.snapshotStore = snapshotStore
        self.appDataStore = appDataStore
    }

    /// Opt the RUNNING app into canonical-AppData persistence, pointing at the
    /// sanctioned Application Support store. Called once from the shell on launch
    /// (alongside `useSystemClock()`); tests/previews leave it unset so they never
    /// write a real canonical document. Idempotent.
    func useApplicationSupportAppDataStore() {
        if appDataStore == nil {
            appDataStore = JSONFileAppDataStore.applicationSupport()
        }
    }

    /// Back-compat read alias for the iOS-7 `isInSession` call sites.
    var isInSession: Bool { stage == .inSession }

    /// Injectable, deterministic clock. Defaults to FocusModePreviewData's fixed
    /// reference instant so the demo is reproducible and testable — NEVER an inline
    /// `Date()`. A future persistence task can inject a real-time clock.
    var clock: () -> Date = { FocusModeMvpState.deterministicReferenceDate() }

    static func deterministicReferenceDate() -> Date {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fmt.timeZone = TimeZone(identifier: "UTC")
        return fmt.date(from: FocusModePreviewData.referenceClockIso) ?? Date(timeIntervalSince1970: 0)
    }

    /// iOS-14: the real wall-clock, used ONLY when the running app opts in via
    /// `useSystemClock()`. The default `clock` stays deterministic so tests and
    /// SwiftUI previews remain reproducible and never flaky.
    static let systemClock: () -> Date = { Date() }

    /// Switch this state to the real wall-clock for the RUNNING app, so saved
    /// timestamps + history grouping (Today/Earlier/Older) reflect real days.
    /// Called once from the shell on launch; tests/previews never call it.
    func useSystemClock() {
        clock = FocusModeMvpState.systemClock
    }

    private func timestampLabel(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        fmt.dateFormat = "yyyy-MM-dd HH:mm 'UTC'"
        return fmt.string(from: date)
    }

    /// Machine-readable ISO-8601 instant for the on-disk snapshot's
    /// `createdAtIso`. Derived from the injectable clock (deterministic by
    /// default), matching FocusModePreviewData.referenceClockIso's format.
    private func iso8601(_ date: Date) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fmt.timeZone = TimeZone(identifier: "UTC")
        return fmt.string(from: date)
    }

    // MARK: - Scenario

    func setScenario(_ next: FocusModeSampleScenario) {
        guard next != selectedScenario else { return }
        selectedScenario = next
        resetProgress()
        selectedExerciseIndex = 0
        stage = .plan
        completedSummary = nil
        // The transient save banner is per-completion; clear it. The on-disk
        // history (latestSaved / savedHistory) survives a scenario change.
        saveStatus = .idle
        canonicalSaveStatus = .idle
        saveErrorMessage = nil
        restoreStatus = .idle
        restoreReconciliation = nil
    }

    // MARK: - Per-exercise progress

    func completedSets(for exerciseId: String) -> Int {
        completedSetsByExerciseId[exerciseId] ?? 0
    }

    func completeOneSet(for exerciseId: String, target: Int) {
        let current = completedSetsByExerciseId[exerciseId] ?? 0
        completedSetsByExerciseId[exerciseId] = min(target, current + 1)
    }

    /// iOS-17b: complete one set AND capture its per-set weight/reps/RIR into an
    /// in-RAM `ActualSetDraft`. `weightInDisplayUnit` is in `captureDisplayUnit`
    /// (or nil if blank) and is converted to kg before recording (storage is
    /// always kg). The new set's 0-based `setIndex` is the prior completed count,
    /// and `completedAt` comes from the injectable clock (deterministic default).
    /// The count is advanced through the UNCHANGED `completeOneSet`, so restore /
    /// reconcile / the count-based snapshot are unaffected. At target the set is
    /// already complete, so nothing is captured (the button is disabled too — no
    /// fake capture). Blank fields stay nil (honest "not entered"). NO persistence.
    func captureSet(
        for exerciseId: String,
        target: Int,
        weightInDisplayUnit: Double?,
        reps: Int?,
        rir: Int?
    ) {
        let current = completedSetsByExerciseId[exerciseId] ?? 0
        guard current < target else { return }   // already complete — no fake capture
        let weightKg = WeightConversion.toKilograms(weightInDisplayUnit, from: captureDisplayUnit)
        let draft = ActualSetDraftFactory.capturedDraft(
            priorCompletedCount: current,
            weightKg: weightKg,
            reps: reps,
            rir: rir,
            exerciseId: exerciseId,
            source: FocusModeMvpState.captureSourceTag,
            completedAtIso: iso8601(clock())
        )
        capturedSetDraftsByExerciseId[exerciseId, default: []].append(draft)
        completeOneSet(for: exerciseId, target: target)
    }

    /// All captured set drafts for one exercise this session (in RAM; empty if
    /// none captured). Read-only accessor for the UI / tests.
    func capturedSets(for exerciseId: String) -> [ActualSetDraft] {
        capturedSetDraftsByExerciseId[exerciseId] ?? []
    }

    func resetProgress() {
        completedSetsByExerciseId = [:]
        // iOS-17b: captured drafts parallel the counts — clear them together so a
        // reset / scenario change never leaves stale per-set data behind.
        capturedSetDraftsByExerciseId = [:]
    }

    // MARK: - Aggregate progress

    func totalCompletedSets(for exerciseIds: [String]) -> Int {
        exerciseIds.reduce(0) { $0 + completedSets(for: $1) }
    }

    func progressPercent(totalCompleted: Int, totalTarget: Int) -> Double {
        guard totalTarget > 0 else { return 0 }
        return Double(totalCompleted) / Double(totalTarget)
    }

    // MARK: - Stage transitions

    func startSession() {
        selectedExerciseIndex = 0
        // A fresh "开始训练" is not a restored draft — clear any stale restore
        // status so the in-session restored-draft banner never shows wrongly.
        restoreStatus = .idle
        restoreReconciliation = nil
        stage = .inSession
    }

    func endSession() {
        stage = .plan
    }

    /// Capture the completed-session summary from the engine-derived values the
    /// shell supplies (the state never recomputes the engine), then ATTEMPT a
    /// local JSON save and move to the completed/preview stage.
    ///
    /// The in-RAM `completedSummary` is always set first, so the preview works
    /// even if the save fails. Persistence is delegated to the snapshot store
    /// (this class never touches FileManager). NO AppData mutation, NO cloud.
    func completeSession(
        slice: TrainingDecisionCoreSlice,
        lines: [FocusCompletedExerciseLine]
    ) {
        restoreStatus = .idle   // a fresh completion is not a restored draft
        restoreReconciliation = nil
        let totalCompleted = lines.reduce(0) { $0 + $1.completedSets }
        let totalTarget = lines.reduce(0) { $0 + $1.targetSets }
        let now = clock()
        completedSummary = FocusCompletedSessionSummary(
            scenarioLabel: selectedScenario.shortLabel,
            sessionIntent: slice.sessionIntent.rawValue,
            activePhase: slice.activePhase.rawValue,
            deloadLevel: slice.deload.level.rawValue,
            deloadStrategy: slice.deload.strategy.rawValue,
            lines: lines,
            totalCompletedSets: totalCompleted,
            totalTargetSets: totalTarget,
            timestampLabel: timestampLabel(now)
        )

        let snapshot = buildSnapshot(slice: slice, lines: lines, createdAt: now)
        do {
            try snapshotStore.save(snapshot)
            // Only after a real, thrown-error-free save do we report success.
            saveStatus = .saved
            saveErrorMessage = nil
            refreshSavedFromStore()
        } catch {
            // No fake success: surface the error and keep the in-RAM preview.
            let message = error.localizedDescription
            saveStatus = .failed(message)
            saveErrorMessage = message
        }

        // iOS-17A: ALSO append the performed sets to the canonical AppData document
        // (the source of truth, §8). This is independent of the LocalSnapshot save
        // above — each store reports its own honest status. The LocalSnapshot copy
        // is a derived display record; the canonical write is the durable record of
        // what was performed.
        persistCanonicalSession(snapshotId: snapshot.snapshotId, lines: lines, finishedAt: now)

        stage = .completed
    }

    /// iOS-17A: append the just-completed session to the canonical AppData document
    /// through the FIRST native canonical write path. Builds a completed
    /// `TrainingSession` (performed sets in `exercises[].sets`, never the lifecycle
    /// draft buffer) and persists it via `CanonicalSessionWriter`, gated by
    /// DataHealth. Honest status: `.skipped` when no per-set detail was captured,
    /// `.failed(_)` on any thrown error (never a fake success), `.saved` only after
    /// a real write. The LocalSnapshot history copy is unaffected by a canonical
    /// failure (and vice-versa).
    private func persistCanonicalSession(
        snapshotId: String,
        lines: [FocusCompletedExerciseLine],
        finishedAt: Date
    ) {
        guard let appDataStore else {
            canonicalSaveStatus = .idle   // canonical persistence not opted in (previews/tests)
            return
        }
        // Build the performed-exercise list from the in-RAM captures. Only
        // exercises with ≥1 captured set carry per-set detail.
        let performed: [NativePerformedExercise] = lines.compactMap { line in
            let drafts = capturedSets(for: line.id)
            guard !drafts.isEmpty else { return nil }
            return NativePerformedExercise(exerciseId: line.id, name: line.name, drafts: drafts)
        }
        guard !performed.isEmpty else {
            // Nothing was logged per-set → honestly record nothing canonical.
            canonicalSaveStatus = .skipped
            return
        }
        let session = NativeCompletedSessionBuilder.completedSession(
            id: snapshotId,
            dateIso: nil,
            finishedAtIso: iso8601(finishedAt),
            performed: performed
        )
        let expectedSetCount = (session.exercises ?? []).reduce(0) { $0 + ($1.sets?.count ?? 0) }
        let writer = CanonicalSessionWriter(store: appDataStore)
        do {
            try writer.appendCompletedSession(session) { candidate in
                // DataHealth gate (§10): route the candidate through the read-only
                // clean-view ingress (no mutation, no auto-repair) and accept ONLY
                // when our just-appended session survives the clean view with ALL
                // its performed sets intact. If the lifecycle guard had treated our
                // completed session as residue (e.g. sets routed into the draft
                // buffer by mistake), the cleaned entry would lose sets and we would
                // REFUSE to write — no silent data loss through the chokepoint.
                guard let result = try? processIncomingAppData(
                    appData: candidate,
                    source: .postSessionComplete,
                    options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
                ) else { return false }
                guard let cleaned = result.cleanView.cleanedHistory.first(where: { $0.id == snapshotId }) else {
                    return false
                }
                let cleanedSetCount = (cleaned.exercises ?? []).reduce(0) { $0 + ($1.sets?.count ?? 0) }
                return cleanedSetCount == expectedSetCount
            }
            canonicalSaveStatus = .saved
        } catch {
            // No fake success: surface the canonical error independently of the
            // LocalSnapshot status. The on-disk canonical document is left intact
            // (backup-before-overwrite / atomic save guarantee no partial state).
            canonicalSaveStatus = .failed(error.localizedDescription)
        }
    }

    // MARK: - DEEP-EDIT-1 logged-set correction (canonical edit, same gated path)

    /// Correct ONE logged set's 重量(weight)/ 次数(reps)/ RIR in a saved session and
    /// persist it through the SAME sanctioned canonical-AppData write path as the
    /// session append (§8 rule 4: NOT a second write path), via
    /// `CanonicalSessionWriter.updateHistorySet`. The set is located by the identity
    /// the saved-session detail UI projects: the session id (== snapshotId), the
    /// exercise id, and the stored setIndex.
    ///
    /// `weightInDisplayUnit` is in `captureDisplayUnit` (or nil if the field is blank)
    /// and is converted to kg before the write — storage is ALWAYS kilograms.
    /// A logged set is an ENGINE INPUT; the engine recomputes e1RM / readiness FROM it
    /// on its next run, so this edit never touches an engine output.
    ///
    /// Honest result: `.failed(_)` when canonical persistence is not opted in
    /// (previews/tests) OR on any thrown write/validation error (never a fake success);
    /// `.saved` only after a real, gated, atomic write. The injected DataHealth gate
    /// re-validates — against the FRESHLY-LOADED on-disk history — that the correction
    /// survives the clean view AND landed exactly as intended before the write commits;
    /// a rejected candidate is never written. The on-disk document is left intact on
    /// failure (backup-before-overwrite / atomic save).
    func updateLoggedSet(
        sessionId: String,
        exerciseId: String,
        setIndex: Int,
        weightInDisplayUnit: Double?,
        reps: Int?,
        rir: Int?
    ) -> LoggedSetEditOutcome {
        guard let appDataStore else {
            // Canonical persistence not opted in (previews/tests) — honest failure,
            // never a fake success.
            return .failed("没有可写入的本机存储")
        }
        let weightKg = WeightConversion.toKilograms(weightInDisplayUnit, from: captureDisplayUnit)
        let writer = CanonicalSessionWriter(store: appDataStore)
        do {
            try writer.updateHistorySet(
                sessionId: sessionId,
                exerciseId: exerciseId,
                setIndex: setIndex,
                weightKg: weightKg,
                reps: reps,
                rir: rir
            ) { candidate in
                // Defensive DataHealth gate (§10): re-run the candidate through the SAME
                // sanctioned, read-only DataHealth ingress the session-append write uses
                // (`processIncomingAppData` → its `cleanView`), so the edit path adds NO
                // second AppData-cleaning entry point. Accept ONLY when the corrected set
                // SURVIVES the clean view (DataHealth would not strip it) AND its three
                // metrics landed exactly as intended (representation-agnostic compare).
                // No fake success — an invariant-breaking candidate is never written.
                guard let result = try? processIncomingAppData(
                    appData: candidate,
                    source: .postSessionComplete,
                    options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
                ) else { return false }
                let view = result.cleanView
                guard let session = view.cleanedHistory.first(where: { $0.id == sessionId }),
                      let exercise = (session.exercises ?? []).first(where: {
                          $0.id == exerciseId || $0.exerciseId == exerciseId
                      }),
                      let set = (exercise.sets ?? []).first(where: { $0.setIndex?.intValue == setIndex })
                else { return false }
                guard set.reps?.intValue == reps, set.rir?.intValue == rir else { return false }
                switch (set.weight?.doubleValue, weightKg) {
                case (nil, nil): return true
                case let (lhs?, rhs?): return abs(lhs - rhs) < 1e-9
                default: return false
                }
            }
            return .saved
        } catch {
            return .failed(Self.loggedSetEditErrorMessage(error))
        }
    }

    /// Map a canonical write failure to an honest, user-facing Chinese message. Unknown
    /// errors fall back to their `localizedDescription` — never a fabricated success.
    private static func loggedSetEditErrorMessage(_ error: Error) -> String {
        if let writeError = error as? CanonicalSessionWriteError {
            switch writeError {
            case .existingDocumentUnreadable:
                return "本机训练记录无法读取，未改动（不会覆盖无法解析的数据）"
            case .validationRejected:
                return "修正未通过本机数据校验，未保存"
            case .backupFailed:
                return "备份失败，未保存（原记录保持不变）"
            case .saveFailed:
                return "写入失败，未保存（原记录保持不变）"
            }
        }
        return error.localizedDescription
    }

    // MARK: - DEEP-EDIT-1 display: per-set values read CANONICAL-first (corrected, persistent)

    /// The per-set DISPLAY values for one saved snapshot, CANONICAL-FIRST: a set that
    /// reached canonical `history` shows its authoritative (DEEP-EDIT-1-corrected)
    /// 重量/次数/RIR, so a correction persists across a cold start; a set with no
    /// canonical counterpart (a snapshot-only / legacy session, inherently uneditable)
    /// honestly falls back to the LocalSnapshot display copy. Keyed `[exerciseId][setIndex]`
    /// with the LocalSnapshot display type the detail row already renders — so the
    /// presentation files stay free of any canonical-store token (the read is funnelled
    /// here, the view-model).
    ///
    /// The match is the pure, unit-tested `resolveSavedSessionSetDisplay` (DataHealth);
    /// the snapshot is translated into NEUTRAL fallbacks here, so the snapshot store
    /// never reads canonical data and the two stay decoupled (§12). The canonical read
    /// goes through the SAME sanctioned, read-only DataHealth ingress the edit gate uses
    /// (clean view, §10) — no second cleaning entry point, no write. A nil store /
    /// unreadable / missing document collapses canonical to empty, and the resolver then
    /// returns the snapshot fallbacks unchanged (honest, never a crash). 100% read-only.
    func canonicalSetDisplay(
        for snapshot: LocalCompletedSessionSnapshot
    ) -> [String: [Int: LocalCompletedSetEntrySnapshot]] {
        // Translate the LocalSnapshot display copy into neutral fallbacks (app-layer
        // translation — the snapshot never reads canonical; the resolver never imports
        // IronPathLocalSnapshot).
        let fallbacks: [SavedSessionSetFallback] = snapshot.exercises.flatMap { exercise in
            (exercise.setLogs ?? []).map { log in
                SavedSessionSetFallback(
                    exerciseId: exercise.exerciseId,
                    setIndex: log.setIndex,
                    weightKg: log.weightKg,
                    reps: log.reps,
                    rir: log.rir
                )
            }
        }
        guard !fallbacks.isEmpty else { return [:] }

        // Canonical cleaned history through the SAME read-only DataHealth ingress the
        // edit gate uses (routes through the clean view, §10) — read-only options
        // override the source defaults, so nothing is mutated/repaired/written. Any
        // failure (no store / unreadable / missing file) → empty canonical → the
        // resolver returns the snapshot fallbacks.
        let canonicalHistory: [TrainingSession]
        if let store = appDataStore, store.hasExistingFile,
           let loaded = try? store.load(),
           let result = try? processIncomingAppData(
               appData: loaded,
               source: .localStorageLoad,
               options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
           ) {
            canonicalHistory = result.cleanView.cleanedHistory
        } else {
            canonicalHistory = []
        }

        // Pure projection: canonical-corrected per matched set, else the snapshot copy.
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: snapshot.snapshotId,
            canonicalHistory: canonicalHistory,
            snapshotFallbacks: fallbacks
        )

        // Shape for the thin detail view: [exerciseId: [setIndex: entry]] using the
        // LocalSnapshot display type it already renders (no DataHealth type leaks into
        // the presentation layer).
        var byExercise: [String: [Int: LocalCompletedSetEntrySnapshot]] = [:]
        for (key, value) in resolved {
            byExercise[key.exerciseId, default: [:]][key.setIndex] = LocalCompletedSetEntrySnapshot(
                setIndex: key.setIndex,
                weightKg: value.weightKg,
                reps: value.reps,
                rir: value.rir
            )
        }
        return byExercise
    }

    // MARK: - SR-4 smart-replacement integration (recommend → 换动作 / 复原 → display)

    /// The CLEANED canonical history (§10/§11): load the on-disk canonical document and
    /// route it through the SAME read-only DataHealth ingress the edit gate uses
    /// (`processIncomingAppData` → its `cleanView`) — never raw AppData. Any failure
    /// (no store / unreadable / missing) collapses to `nil` (honest empty), never a crash.
    private func cleanedCanonicalHistory() -> [TrainingSession]? {
        guard let store = appDataStore, store.hasExistingFile,
              let loaded = try? store.load(),
              let result = try? processIncomingAppData(
                  appData: loaded,
                  source: .localStorageLoad,
                  options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
              )
        else { return nil }
        return result.cleanView.cleanedHistory
    }

    /// SR-4 (a): smart-replacement recommendations for ONE saved-session exercise,
    /// produced by the ported `SmartReplacementEngine` and fed input DERIVED FROM the
    /// DataHealth clean view (§10/§11) — never raw AppData, no engine change. The current
    /// exercise is the user's ACTUAL exercise when already replaced (so alternatives are
    /// to the swapped-in movement), else the original logged exercise; the clean history
    /// is mapped into the engine's training-history shape so its pain-history signal
    /// (which honors `actualExerciseId`) is considered. Read-only. An empty result (no
    /// canonical match / no store) is honest, never a crash.
    func replacementRecommendations(
        forSnapshot snapshotId: String,
        exerciseId: String
    ) -> [ReplacementOptionRow] {
        guard let cleanedHistory = cleanedCanonicalHistory(),
              let session = cleanedHistory.first(where: { $0.id == snapshotId }),
              let exercise = (session.exercises ?? []).first(where: {
                  $0.id == exerciseId || $0.exerciseId == exerciseId
              })
        else { return [] }
        // Effective current id: the recorded actual (override) wins, else the original
        // planned/logged identity — mirroring the PWA resolution precedence.
        guard let currentId = Self.firstNonEmpty([
            exercise.actualExerciseId, exercise.recordExerciseId,
            exercise.displayExerciseId, exercise.exerciseId, exercise.id
        ]) else { return [] }
        let params = SmartReplacementParams(
            currentExercise: .id(currentId),
            trainingHistory: cleanedHistory.map(Self.smartReplacementSession(from:))
        )
        // Flatten the engine output into the app-presentation row (keeps the engine type
        // out of the thin detail view). The engine returns rows already ordered.
        return SmartReplacementEngine.buildSmartReplacementRecommendations(params).map { rec in
            ReplacementOptionRow(
                id: rec.exerciseId,
                name: rec.exerciseName,
                priority: rec.priority,
                priorityLabel: Self.replacementPriorityLabel(rec.priorityEnum),
                fatigueLabel: Self.replacementFatigueLabel(rec.fatigueCost),
                reason: rec.reason
            )
        }
    }

    /// SR-4 (b)+(c): set ONE saved-session exercise's user-override identity to a chosen
    /// replacement (换动作), or clear it (复原, `replacementExerciseId == nil`), through the
    /// SAME sanctioned canonical-AppData write path as the logged-set correction (§8 rule
    /// 4: NOT a second write path), via `CanonicalSessionWriter.updateExerciseReplacement`.
    /// The exercise is located by the identity the detail UI projects (session id ==
    /// snapshotId + the original exercise id, which this edit never changes).
    ///
    /// Only the three user-override identity fields (`actualExerciseId` /
    /// `displayExerciseId` / `recordExerciseId`) are written — never the engine-opened
    /// `originalExerciseId`, the prescription body, the performed sets, or any engine
    /// output (§11). Honest result: `.failed(_)` when canonical persistence is not opted
    /// in (previews/tests) OR on any thrown write/validation error (never a fake success);
    /// `.saved` only after a real, gated, atomic write. The injected DataHealth gate
    /// re-validates — against the FRESHLY-LOADED on-disk history — that the override
    /// landed exactly (apply → all three == the replacement; restore → all three cleared)
    /// AND the exercise survives the clean view before the write commits.
    func swapExercise(
        sessionId: String,
        exerciseId: String,
        replacementExerciseId: String?
    ) -> ExerciseSwapOutcome {
        guard let appDataStore else {
            // Canonical persistence not opted in (previews/tests) — honest failure.
            return .failed("没有可写入的本机存储")
        }
        let writer = CanonicalSessionWriter(store: appDataStore)
        do {
            try writer.updateExerciseReplacement(
                sessionId: sessionId,
                exerciseId: exerciseId,
                replacementExerciseId: replacementExerciseId
            ) { candidate in
                // Defensive DataHealth gate (§10): re-run the candidate through the SAME
                // read-only DataHealth ingress the other edits use; accept ONLY when the
                // matched exercise's three identity fields landed EXACTLY as intended
                // (apply → all == the replacement; restore → all cleared) AND the exercise
                // survives the clean view. No fake success.
                guard let result = try? processIncomingAppData(
                    appData: candidate,
                    source: .postSessionComplete,
                    options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
                ) else { return false }
                guard let session = result.cleanView.cleanedHistory.first(where: { $0.id == sessionId }),
                      let exercise = (session.exercises ?? []).first(where: {
                          $0.id == exerciseId || $0.exerciseId == exerciseId
                      })
                else { return false }
                return exercise.actualExerciseId == replacementExerciseId
                    && exercise.displayExerciseId == replacementExerciseId
                    && exercise.recordExerciseId == replacementExerciseId
            }
            return .saved
        } catch {
            return .failed(Self.replacementEditErrorMessage(error))
        }
    }

    /// SR-4 (d): the canonical-first replacement display state per exercise for one saved
    /// snapshot, keyed by the exerciseId the detail row renders. So a 换动作 shows the
    /// ACTUAL exercise name and the performed sets read as attributed to it — read-only
    /// through the §10 clean view (the override lives in canonical history, not the
    /// LocalSnapshot copy, so it shows persistently). A snapshot-only / legacy /
    /// unreplaced exercise yields `isReplaced == false`. Honest empty when no canonical
    /// match.
    func canonicalExerciseReplacementDisplay(
        for snapshot: LocalCompletedSessionSnapshot
    ) -> [String: ExerciseReplacementDisplay] {
        guard let cleanedHistory = cleanedCanonicalHistory(),
              let session = cleanedHistory.first(where: { $0.id == snapshot.snapshotId })
        else { return [:] }
        var byExercise: [String: ExerciseReplacementDisplay] = [:]
        for ex in session.exercises ?? [] {
            // Key by the SAME id the LocalSnapshot detail row uses (exerciseId → id).
            guard let key = Self.firstNonEmpty([ex.exerciseId, ex.id]) else { continue }
            let plannedId = Self.firstNonEmpty([ex.exerciseId, ex.id])
            // The effective record/display id (override wins, mirroring PWA precedence).
            let actualId = Self.firstNonEmpty([
                ex.actualExerciseId, ex.recordExerciseId, ex.displayExerciseId,
                ex.exerciseId, ex.id
            ]) ?? key
            // Replaced iff a user override (actualExerciseId) is set AND differs from the
            // original planned/logged id — never inferred from originalExerciseId.
            let isReplaced = (ex.actualExerciseId != nil) && (ex.actualExerciseId != plannedId)
            let resolvedName = ExerciseLibrary.getExerciseNameEntry(actualId).zh
            byExercise[key] = ExerciseReplacementDisplay(
                isReplaced: isReplaced,
                actualExerciseId: actualId,
                actualName: resolvedName.isEmpty ? actualId : resolvedName
            )
        }
        return byExercise
    }

    /// Map a CLEAN canonical `TrainingSession` into the smart-replacement engine's
    /// training-history shape (only the fields it reads: id-identity + per-set pain).
    /// Pure; feeds the engine a clean-derived signal (§11), never raw AppData.
    private static func smartReplacementSession(from session: TrainingSession) -> SmartReplacementTrainingSession {
        SmartReplacementTrainingSession(
            date: session.date,
            exercises: (session.exercises ?? []).map { ex in
                SmartReplacementHistoryExercise(
                    id: ex.id ?? ex.exerciseId,
                    actualExerciseId: ex.actualExerciseId,
                    sets: (ex.sets ?? []).map { set in
                        SmartReplacementHistorySet(
                            painFlag: set.painFlag,
                            painArea: set.painArea,
                            painSeverity: set.painSeverity?.doubleValue
                        )
                    }
                )
            }
        )
    }

    /// First non-nil, non-empty string in `candidates`, else nil.
    private static func firstNonEmpty(_ candidates: [String?]) -> String? {
        for c in candidates { if let c, !c.isEmpty { return c } }
        return nil
    }

    /// Chinese label for a recommendation priority (nil/unknown → empty).
    private static func replacementPriorityLabel(_ priority: SmartReplacementPriority?) -> String {
        switch priority {
        case .primary: return "优先推荐"
        case .secondary: return "次选"
        case .angleVariation: return "角度变化"
        case .avoid: return "不建议"
        case nil: return ""
        }
    }

    /// Chinese label for a recommendation fatigue cost (unknown → empty).
    private static func replacementFatigueLabel(_ raw: String) -> String {
        switch raw {
        case "low": return "低疲劳"
        case "medium": return "中疲劳"
        case "high": return "高疲劳"
        default: return ""
        }
    }

    /// Map a canonical write failure to an honest, user-facing Chinese message for a
    /// 换动作 / 复原 — never a fabricated success. Mirrors `loggedSetEditErrorMessage`.
    private static func replacementEditErrorMessage(_ error: Error) -> String {
        if let writeError = error as? CanonicalSessionWriteError {
            switch writeError {
            case .existingDocumentUnreadable:
                return "本机训练记录无法读取，未改动（不会覆盖无法解析的数据）"
            case .validationRejected:
                return "换动作未通过本机数据校验，未保存"
            case .backupFailed:
                return "备份失败，未保存（原记录保持不变）"
            case .saveFailed:
                return "写入失败，未保存（原记录保持不变）"
            }
        }
        return error.localizedDescription
    }

    /// Map the engine-derived completion into the on-disk Codable snapshot. The
    /// snapshotId is deterministic (scenario + a monotone index over what is
    /// already saved), so tests/previews stay reproducible without random ids.
    private func buildSnapshot(
        slice: TrainingDecisionCoreSlice,
        lines: [FocusCompletedExerciseLine],
        createdAt: Date
    ) -> LocalCompletedSessionSnapshot {
        let totalCompleted = lines.reduce(0) { $0 + $1.completedSets }
        let totalTarget = lines.reduce(0) { $0 + $1.targetSets }
        let index = savedHistory.count + 1
        let exercises = lines.map { line in
            // iOS-17A (v3): attach the DERIVED per-set display copy (weight kg /
            // reps / RIR) from the in-RAM captures. nil when nothing was captured
            // for this exercise, so a no-detail session honestly carries no
            // setLogs. This is a derived display record only — the canonical
            // performed sets live in AppData.history (§8/§12).
            let captured = capturedSets(for: line.id)
            let setLogs: [LocalCompletedSetEntrySnapshot]? = captured.isEmpty ? nil : captured.enumerated().map { idx, draft in
                LocalCompletedSetEntrySnapshot(
                    setIndex: draft.setIndex?.intValue ?? idx,
                    weightKg: draft.weight?.doubleValue,
                    reps: draft.reps?.intValue,
                    rir: draft.rir?.intValue
                )
            }
            return LocalCompletedExerciseSnapshot(
                exerciseId: line.id,
                name: line.name,
                role: line.role,
                progress: LocalCompletedSetProgressSnapshot(
                    completedSets: line.completedSets,
                    targetSets: line.targetSets
                ),
                setLogs: setLogs
            )
        }
        // v2 resume cursor: the first not-yet-complete exercise (where a restored
        // draft should continue); falls back to the start when all are complete.
        let resumeIndex: Int? = {
            if let firstIncomplete = exercises.firstIndex(where: { $0.completedSets < $0.targetSets }) {
                return firstIncomplete
            }
            return exercises.isEmpty ? nil : 0
        }()
        return LocalCompletedSessionSnapshot(
            snapshotId: "focus-\(selectedScenario.rawValue)-\(index)",
            createdAtIso: iso8601(createdAt),
            scenarioId: selectedScenario.rawValue,
            scenarioLabel: selectedScenario.shortLabel,
            sessionIntent: slice.sessionIntent.rawValue,
            activePhase: slice.activePhase.rawValue,
            deloadLevel: slice.deload.level.rawValue,
            deloadStrategy: slice.deload.strategy.rawValue,
            totalCompletedSets: totalCompleted,
            totalTargetSets: totalTarget,
            exercises: exercises,
            resumeExerciseIndex: resumeIndex
        )
    }

    // MARK: - Local persistence (load on launch / refresh / clear)

    /// Load the latest saved snapshot + history on launch. Read failures are
    /// non-fatal: the surfaces simply show "nothing saved yet" plus a soft note.
    func loadSavedSessions() {
        refreshSavedFromStore()
    }

    private func refreshSavedFromStore() {
        do {
            // iOS-10 defensive scan: valid snapshots + count of skipped invalid.
            let scan = try snapshotStore.scanSnapshots()
            savedHistory = scan.valid
            invalidSkippedCount = scan.invalidCount
            migratedSavedCount = scan.migratedCount
            stats = LocalSnapshotStats.derive(from: scan.valid)
            // Keep loading the rolling latest pointer, but VALIDATE it before
            // showing it as restored; fall back to the newest valid history. A
            // CORRUPT pointer must not abort the whole refresh and hide valid
            // history — `try?` lets it fall back instead of throwing out.
            let rawLatest = (try? snapshotStore.loadLatest()) ?? nil
            latestSaved = validatedLatest(rawLatest, fallback: scan.valid.first)
            storageDiagnostics = (try? snapshotStore.storageDiagnostics()) ?? .empty
        } catch {
            saveErrorMessage = error.localizedDescription
        }
    }

    /// Show the latest pointer only if it passes validation; otherwise restore
    /// the newest valid history entry. An invalid latest is never shown as a
    /// successful restore (no fake success).
    private func validatedLatest(
        _ raw: LocalCompletedSessionSnapshot?,
        fallback: LocalCompletedSessionSnapshot?
    ) -> LocalCompletedSessionSnapshot? {
        if let raw, LocalSnapshotValidator.isValid(raw) { return raw }
        return fallback
    }

    /// Whether the last refresh found any saved files it had to skip as invalid.
    var hasInvalidSkipped: Bool { invalidSkippedCount > 0 }

    /// Quarantine corrupt/invalid saved files (in-place rename inside the
    /// sanctioned directory), then refresh. A failure surfaces an honest error.
    func quarantineInvalidSnapshots() {
        do {
            _ = try snapshotStore.quarantineInvalid()
            refreshSavedFromStore()
        } catch {
            saveErrorMessage = error.localizedDescription
        }
    }

    /// Write a local-only debug copy of the latest snapshot JSON. Reports an
    /// honest status — `.exported` only on a real, thrown-error-free copy.
    func exportLatestDebugCopy() {
        do {
            if try snapshotStore.exportLatestDebugCopy() != nil {
                exportStatus = .exported
            } else {
                exportStatus = .nothingToExport
            }
            storageDiagnostics = (try? snapshotStore.storageDiagnostics()) ?? storageDiagnostics
        } catch {
            exportStatus = .failed(error.localizedDescription)
            saveErrorMessage = error.localizedDescription
        }
    }

    /// Clear ONLY this store's sanctioned local snapshot files, then refresh the
    /// UI. A failure surfaces an honest error AND reconciles the displayed list
    /// with whatever survived a partial clear (so the UI never over-reports
    /// still-present saved sessions after a mid-delete failure).
    func clearSavedSessions() {
        do {
            try snapshotStore.clear()
            latestSaved = nil
            savedHistory = []
            invalidSkippedCount = 0
            stats = .empty
            storageDiagnostics = .empty
            exportStatus = .idle
            saveStatus = .idle
            saveErrorMessage = nil
        } catch {
            saveErrorMessage = error.localizedDescription
            refreshSavedFromStore()
        }
    }

    // MARK: - iOS-11 restore-to-local-draft / continue a saved session

    /// Restore a saved snapshot into an IN-RAM training draft and resume it.
    /// This is NOT an AppData restore: the engine slice is regenerated
    /// deterministically from the scenario, and only the per-exercise completed-
    /// set counts + the resume cursor are restored into memory. Restore fidelity
    /// (order + completed counts + clamped cursor + reject-impossible) is handled
    /// by the pure, unit-tested LocalDraftRestorePlanner. Any failure (unknown
    /// scenario OR impossible/empty progress) fails honestly and leaves the
    /// current in-memory session UNTOUCHED — no fake restore.
    func restoreDraft(from snapshot: LocalCompletedSessionSnapshot) {
        guard let scenario = FocusModeSampleScenario(rawValue: snapshot.scenarioId) else {
            restoreStatus = .failed("无法识别的训练样例：\(snapshot.scenarioId)，无法在本机恢复")
            restoreReconciliation = nil
            return
        }
        // iOS-13: reconcile the saved exercise ids against the CURRENT scenario's
        // exercise ids (regenerated deterministically). Counts apply only to
        // matched exercises; saved ids that no longer exist are reported, not
        // injected; the resume cursor is remapped into the current row order.
        let reconciliation: LocalDraftRestoreReconciliation
        switch LocalDraftRestorePlanner.reconcile(
            from: snapshot,
            against: currentExerciseIds(for: scenario)
        ) {
        case .success(let r):
            reconciliation = r
        case .failure(let error):
            // Honest failure: do NOT mutate the current session.
            switch error {
            case .emptyExercises:
                restoreStatus = .failed("该存档没有可恢复的动作")
            case .impossibleProgress:
                restoreStatus = .failed("该存档的完成进度不合法，已拒绝恢复")
            }
            restoreReconciliation = nil
            return
        }
        // Apply the reconciled plan to the in-RAM draft (matched-only counts;
        // resume remapped to current order; the shell maps counts by exercise id).
        let plan = reconciliation.plan
        selectedScenario = scenario
        completedSetsByExerciseId = plan.completedSetsByExerciseId
        // iOS-17b: a restored draft carries only per-exercise COUNTS, never
        // per-set detail — so start capture empty (no stale drafts bleed in).
        // restoreDraft semantics are otherwise unchanged.
        capturedSetDraftsByExerciseId = [:]
        selectedExerciseIndex = plan.resumeExerciseIndex
        completedSummary = nil
        saveStatus = .idle
        canonicalSaveStatus = .idle
        saveErrorMessage = nil
        restoreReconciliation = reconciliation
        restoreStatus = .restored(snapshot.scenarioLabel)
        stage = .inSession
    }

    /// The CURRENT scenario's displayed exercise ids — regenerated
    /// deterministically the same way the shell builds its rows (perExercise
    /// entries that have a matching template). Pure read; no disk/AppData.
    private func currentExerciseIds(for scenario: FocusModeSampleScenario) -> [String] {
        let slice = FocusModePreviewData.sampleCoreSlice(for: scenario)
        let templateIds = Set(FocusModePreviewData.sampleTemplateExercises().map(\.id))
        return slice.perExercise.map(\.exerciseId).filter { templateIds.contains($0) }
    }

    /// iOS-15: the CURRENT exercise ids for a SAVED snapshot's own scenario, so
    /// the detail sheet can project a read-only recovery insight via
    /// `LocalSnapshotRecovery.insight`. Mirrors how `restoreDraft` resolves the
    /// scenario from `snapshot.scenarioId`; returns [] for an unknown scenario
    /// (the insight then honestly shows nothing restorable). Pure read — no disk,
    /// no AppData, no restore side effects.
    func currentExerciseIds(forSnapshot snapshot: LocalCompletedSessionSnapshot) -> [String] {
        guard let scenario = FocusModeSampleScenario(rawValue: snapshot.scenarioId) else { return [] }
        return currentExerciseIds(for: scenario)
    }

    /// Whether the current in-session draft was restored from a saved snapshot.
    var isRestoredDraft: Bool {
        if case .restored = restoreStatus { return stage == .inSession }
        return false
    }

    /// iOS-13: the saved history grouped into Today / Earlier / Older for the
    /// local history surface (deterministic clock by default).
    var groupedHistory: [LocalHistorySection] {
        LocalSnapshotHistory.grouped(savedHistory, now: clock())
    }

    /// The reference "now" the history surface groups against (deterministic
    /// clock by default); lets the view group a filtered subset consistently.
    var historyNow: Date { clock() }

    /// From the completed preview, start over on the same scenario (clears the
    /// in-RAM progress + summary + transient save banner). The on-disk saved
    /// history is intentionally preserved.
    func startNewSession() {
        resetProgress()
        selectedExerciseIndex = 0
        completedSummary = nil
        saveStatus = .idle
        canonicalSaveStatus = .idle
        saveErrorMessage = nil
        restoreStatus = .idle
        restoreReconciliation = nil
        stage = .plan
    }

    // MARK: - Cursor

    func moveToNextExercise(totalCount: Int) {
        guard totalCount > 0 else { return }
        selectedExerciseIndex = min(totalCount - 1, selectedExerciseIndex + 1)
    }

    func moveToPreviousExercise() {
        selectedExerciseIndex = max(0, selectedExerciseIndex - 1)
    }

    func clampCursor(totalCount: Int) {
        guard totalCount > 0 else {
            selectedExerciseIndex = 0
            return
        }
        if selectedExerciseIndex < 0 { selectedExerciseIndex = 0 }
        if selectedExerciseIndex >= totalCount { selectedExerciseIndex = totalCount - 1 }
    }
}
