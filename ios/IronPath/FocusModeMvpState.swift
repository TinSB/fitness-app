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

/// Outcome of the last restore-to-local-draft attempt (iOS-11). `.failed`
/// carries an honest error and NO draft is started — never a fake restore.
enum FocusRestoreStatus: Equatable {
    case idle
    case restored(String)   // scenario label of the restored draft
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

    /// The sanctioned app-local JSON store. Injectable for previews/tests; the
    /// app uses the default Application Support location. NOTE: this class never
    /// touches FileManager directly — all disk IO is delegated to the store.
    private let snapshotStore: LocalSessionSnapshotStore

    init(snapshotStore: LocalSessionSnapshotStore = LocalSessionSnapshotStore()) {
        self.snapshotStore = snapshotStore
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

    func resetProgress() {
        completedSetsByExerciseId = [:]
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

        stage = .completed
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
            LocalCompletedExerciseSnapshot(
                exerciseId: line.id,
                name: line.name,
                role: line.role,
                progress: LocalCompletedSetProgressSnapshot(
                    completedSets: line.completedSets,
                    targetSets: line.targetSets
                )
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
        selectedExerciseIndex = plan.resumeExerciseIndex
        completedSummary = nil
        saveStatus = .idle
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
