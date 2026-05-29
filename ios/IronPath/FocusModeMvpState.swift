// FocusModeMvpState — iOS-7 Native Focus MVP Bundle V1.
//
// Pure in-memory state for the native Focus session demo. Holds the
// currently selected sample scenario, the cursor into the today
// exercise list, the per-exercise completed-set counts, and whether
// the user is inside the in-session sub-view.
//
// 100% in-RAM. No FileManager, no UserDefaults, no AppData write,
// no disk, no network. Resets on app restart. Resets progress
// whenever the scenario changes.

import Foundation
import SwiftUI

@MainActor
final class FocusModeMvpState: ObservableObject {

    @Published private(set) var selectedScenario: FocusModeSampleScenario = .normal
    @Published var selectedExerciseIndex: Int = 0
    @Published private(set) var completedSetsByExerciseId: [String: Int] = [:]
    @Published var isInSession: Bool = false

    // MARK: - Scenario

    func setScenario(_ next: FocusModeSampleScenario) {
        guard next != selectedScenario else { return }
        selectedScenario = next
        resetProgress()
        selectedExerciseIndex = 0
        isInSession = false
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

    // MARK: - Cursor

    func startSession() {
        selectedExerciseIndex = 0
        isInSession = true
    }

    func endSession() {
        isInSession = false
    }

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
