// CleanAppDataViewBuilder — iOS-3A Data Health Runtime Foundation V1.
//
// Single entry point for building a CleanAppDataView from an
// `AppData` plus an injectable clock. Mirrors the TS function
// `buildCleanAppDataView` in `src/dataHealth/cleanAppDataView.ts`.
//
// The builder is pure: identical (AppData, clock.now()) inputs always
// produce an identical CleanAppDataView. No file IO, no network, no
// AppData mutation, no `_unknown` data loss — every key the raw
// AppData carries is still reachable via `view.raw`.

import Foundation
import IronPathDomain

private struct BuiltSession {
    let session: TrainingSession
    let durationOutcome: DurationGuardOutcome
    let lifecycleChanged: Bool
    let legacyAdviceChanged: Bool
}

private func buildCleanSession(_ session: TrainingSession) -> BuiltSession {
    let lifecycle = applySessionLifecycleGuard(session)
    let stripped = stripLegacyAdviceFromSession(lifecycle.session)
    let duration = applyDurationGuard(stripped.session)
    var next = stripped.session
    if duration.durationInvalid {
        next = TrainingSession(
            id: next.id,
            date: next.date,
            startedAt: next.startedAt,
            finishedAt: next.finishedAt,
            durationMin: nil,
            completed: next.completed,
            earlyEndReason: next.earlyEndReason,
            restTimerState: next.restTimerState,
            currentExerciseId: next.currentExerciseId,
            currentFocusStepId: next.currentFocusStepId,
            currentSetIndex: next.currentSetIndex,
            focusSessionComplete: next.focusSessionComplete,
            focusCompletedStepIds: next.focusCompletedStepIds,
            focusActualSetDrafts: next.focusActualSetDrafts,
            focusWarmupSetLogs: next.focusWarmupSetLogs,
            exercises: next.exercises,
            _unknown: next._unknown
        )
    } else if let derived = duration.derivedDurationMin, derived != next.durationMin {
        next = TrainingSession(
            id: next.id,
            date: next.date,
            startedAt: next.startedAt,
            finishedAt: next.finishedAt,
            durationMin: derived,
            completed: next.completed,
            earlyEndReason: next.earlyEndReason,
            restTimerState: next.restTimerState,
            currentExerciseId: next.currentExerciseId,
            currentFocusStepId: next.currentFocusStepId,
            currentSetIndex: next.currentSetIndex,
            focusSessionComplete: next.focusSessionComplete,
            focusCompletedStepIds: next.focusCompletedStepIds,
            focusActualSetDrafts: next.focusActualSetDrafts,
            focusWarmupSetLogs: next.focusWarmupSetLogs,
            exercises: next.exercises,
            _unknown: next._unknown
        )
    }
    return BuiltSession(
        session: next,
        durationOutcome: duration,
        lifecycleChanged: lifecycle.changed,
        legacyAdviceChanged: stripped.changed
    )
}

private func buildCleanScreening(
    _ screening: ScreeningProfile,
    issueScoreCap: IssueScoreCapOutcome,
    performanceDrops: PerformanceDropOutcome
) -> ScreeningProfile {
    guard let adaptiveState = screening.adaptiveState,
          case .object(let adaptiveObj) = adaptiveState else {
        return screening
    }
    let dropsArray: [JSONValue] = performanceDrops.filteredDrops.map { .string($0) }
    let stripped = adaptiveObj
        .withoutKeys(["issueScores", "performanceDrops"])
        .appending([
            .init(key: "issueScores", value: .object(issueScoreCap.cappedScores)),
            .init(key: "performanceDrops", value: .array(dropsArray)),
        ])
    return ScreeningProfile(
        userId: screening.userId,
        painTriggers: screening.painTriggers,
        restrictedExercises: screening.restrictedExercises,
        correctionPriority: screening.correctionPriority,
        postureFlags: screening.postureFlags,
        movementFlags: screening.movementFlags,
        adaptiveState: .object(stripped),
        _unknown: screening._unknown
    )
}

public func buildCleanAppDataView(
    _ appData: AppData,
    clock: RuntimeGuardClock = defaultGuardClock
) -> CleanAppDataView {
    var durations: [String: DurationGuardOutcome] = [:]
    var lifecycleResidueSessionIds: [String] = []
    var legacyAdviceSessionIds: [String] = []
    var invalidDurationSessionIds: [String] = []
    var cleanedHistory: [TrainingSession] = []

    let history = appData.history
    cleanedHistory.reserveCapacity(history.count)
    for session in history {
        let built = buildCleanSession(session)
        cleanedHistory.append(built.session)
        if let sid = session.id {
            durations[sid] = built.durationOutcome
            if built.lifecycleChanged { lifecycleResidueSessionIds.append(sid) }
            if built.legacyAdviceChanged { legacyAdviceSessionIds.append(sid) }
            if built.durationOutcome.durationInvalid { invalidDurationSessionIds.append(sid) }
        }
    }

    let cleanedActiveSession: TrainingSession?
    if let active = appData.activeSession {
        cleanedActiveSession = buildCleanSession(active).session
    } else {
        cleanedActiveSession = nil
    }

    let today = applyTodayStatusGuard(appData, clock: clock)
    let healthData = applyHealthDataGuard(appData, clock: clock)
    let screening = appData.screeningProfile
    let issueScoreCap = applyIssueScoreCap(screening)
    let performanceDrops = applyPerformanceDropGuard(screening, history: cleanedHistory)
    let cleanedScreening = buildCleanScreening(
        screening,
        issueScoreCap: issueScoreCap,
        performanceDrops: performanceDrops
    )

    let diagnostics = CleanAppDataViewDiagnostics(
        lifecycleResidueSessionIds: lifecycleResidueSessionIds,
        legacyAdviceSessionIds: legacyAdviceSessionIds,
        invalidDurationSessionIds: invalidDurationSessionIds,
        cappedIssueScoreKeys: issueScoreCap.changes.map { $0.key },
        staleTodayStatus: today.ignoredForCurrentReadiness,
        staleHealthData: healthData.staleForReadiness,
        filteredPerformanceDropIds: performanceDrops.removed
    )

    return CleanAppDataView(
        raw: appData,
        cleanedHistory: cleanedHistory,
        cleanedActiveSession: cleanedActiveSession,
        cleanedScreening: cleanedScreening,
        durations: durations,
        todayStatus: today,
        healthData: healthData,
        issueScoreCap: issueScoreCap,
        performanceDrops: performanceDrops,
        diagnostics: diagnostics
    )
}
