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

/// The plan -> in-session -> completed flow. `isInSession` stays available as a
/// computed alias so existing read sites keep working.
enum FocusSessionStage: Equatable {
    case plan
    case inSession
    case completed
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

    // MARK: - Scenario

    func setScenario(_ next: FocusModeSampleScenario) {
        guard next != selectedScenario else { return }
        selectedScenario = next
        resetProgress()
        selectedExerciseIndex = 0
        stage = .plan
        completedSummary = nil
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
        stage = .inSession
    }

    func endSession() {
        stage = .plan
    }

    /// Capture an in-RAM completed-session snapshot from the engine-derived values
    /// the shell supplies (the state never recomputes the engine), then move to the
    /// completed/preview stage. NO disk write, NO AppData mutation.
    func completeSession(
        slice: TrainingDecisionCoreSlice,
        lines: [FocusCompletedExerciseLine]
    ) {
        let totalCompleted = lines.reduce(0) { $0 + $1.completedSets }
        let totalTarget = lines.reduce(0) { $0 + $1.targetSets }
        completedSummary = FocusCompletedSessionSummary(
            scenarioLabel: selectedScenario.shortLabel,
            sessionIntent: slice.sessionIntent.rawValue,
            activePhase: slice.activePhase.rawValue,
            deloadLevel: slice.deload.level.rawValue,
            deloadStrategy: slice.deload.strategy.rawValue,
            lines: lines,
            totalCompletedSets: totalCompleted,
            totalTargetSets: totalTarget,
            timestampLabel: timestampLabel(clock())
        )
        stage = .completed
    }

    /// From the completed preview, start over on the same scenario (clears progress
    /// + summary). Pure in-RAM.
    func startNewSession() {
        resetProgress()
        selectedExerciseIndex = 0
        completedSummary = nil
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
