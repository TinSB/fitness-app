// DataHealthRuntimeGuard — iOS-3A Data Health Runtime Foundation V1.
//
// Pure, side-effect-free port of `src/dataHealth/dataHealthRuntimeGuard.ts`.
// Each guard takes an immutable input (TrainingSession, AppData, or
// ScreeningProfile) plus an injectable clock and returns an outcome
// value. None of these functions mutate their inputs; they return
// either a re-constructed Swift value or a diagnostic structure that
// CleanAppDataViewBuilder uses to build the projection view.
//
// Forbidden in iOS-3A:
//   * file IO, network, UI, AppData mutation
//   * Date persisted fields on inputs
//   * any kind of repair-apply side effect (iOS-3B owns that)
//
// The TS file lives at src/dataHealth/dataHealthRuntimeGuard.ts.
// Behavior parity is asserted by the Swift tests in
// DataHealthRuntimeGuardTests and by CleanAppDataViewRealExportTests.

import Foundation
import IronPathDomain

// MARK: - Clock

public protocol RuntimeGuardClock: Sendable {
    func now() -> Date
}

public struct SystemRuntimeGuardClock: RuntimeGuardClock {
    public init() {}
    public func now() -> Date { Date() }
}

/// Frozen clock for tests. Always returns the same `Date`.
public struct FixedRuntimeGuardClock: RuntimeGuardClock {
    public let fixed: Date
    public init(_ fixed: Date) { self.fixed = fixed }
    public func now() -> Date { fixed }
}

public let defaultGuardClock: RuntimeGuardClock = SystemRuntimeGuardClock()

// MARK: - ISO date / day arithmetic helpers

/// Permissive ISO-8601 parser matching JS `new Date(s)` semantics
/// for the subset of strings IronPath actually persists:
///   * full RFC-3339 with optional fractional seconds + `Z`
///   * bare `yyyy-MM-dd`
/// Returns nil on unparseable input. Trims whitespace.
internal func parseIsoDate(_ raw: String?) -> Date? {
    guard let value = raw else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return nil }
    let withFractional = ISO8601DateFormatter()
    withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = withFractional.date(from: trimmed) { return d }
    let withoutFractional = ISO8601DateFormatter()
    withoutFractional.formatOptions = [.withInternetDateTime]
    if let d = withoutFractional.date(from: trimmed) { return d }
    let bareDate = DateFormatter()
    bareDate.calendar = Calendar(identifier: .gregorian)
    bareDate.locale = Locale(identifier: "en_US_POSIX")
    bareDate.timeZone = TimeZone(identifier: "UTC")
    bareDate.dateFormat = "yyyy-MM-dd"
    if let d = bareDate.date(from: trimmed) { return d }
    return nil
}

/// Truncates `date` to UTC start-of-day, matching JS
/// `today.setUTCHours(0, 0, 0, 0)`.
internal func utcStartOfDay(_ date: Date) -> Date {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC")!
    return cal.startOfDay(for: date)
}

/// `floor((later − earlier) / 1 day)`. Matches the JS
/// `daysBetween(later, earlier)` in dataHealthRuntimeGuard.ts. No
/// timezone normalization beyond what the caller did upstream.
internal func daysBetween(_ later: Date, _ earlier: Date) -> Int {
    let seconds = later.timeIntervalSince(earlier)
    return Int(floor(seconds / (24.0 * 60.0 * 60.0)))
}

// MARK: - Session lifecycle guard

public struct SessionLifecycleGuardOutcome: Equatable, Sendable {
    /// In-memory cleaned session value. `raw` AppData is untouched.
    public let session: TrainingSession
    /// True if any of the six lifecycle residue fields was rewritten.
    public let changed: Bool
    /// True if `restTimerState.isRunning` was forced to `false`.
    public let clearedRestTimerIsRunning: Bool
    /// True if a non-empty `currentExerciseId` was reset to `""`.
    public let clearedCurrentExerciseId: Bool
    /// True if `currentFocusStepId` was rewritten to `"completed"`.
    public let setCurrentFocusStepIdCompleted: Bool
    /// True if `currentSetIndex` was reset to `-1`.
    public let resetCurrentSetIndex: Bool
    /// True if `focusActualSetDrafts` was emptied.
    public let clearedFocusActualSetDrafts: Bool

    public init(
        session: TrainingSession,
        changed: Bool,
        clearedRestTimerIsRunning: Bool = false,
        clearedCurrentExerciseId: Bool = false,
        setCurrentFocusStepIdCompleted: Bool = false,
        resetCurrentSetIndex: Bool = false,
        clearedFocusActualSetDrafts: Bool = false
    ) {
        self.session = session
        self.changed = changed
        self.clearedRestTimerIsRunning = clearedRestTimerIsRunning
        self.clearedCurrentExerciseId = clearedCurrentExerciseId
        self.setCurrentFocusStepIdCompleted = setCurrentFocusStepIdCompleted
        self.resetCurrentSetIndex = resetCurrentSetIndex
        self.clearedFocusActualSetDrafts = clearedFocusActualSetDrafts
    }
}

public func applySessionLifecycleGuard(_ session: TrainingSession) -> SessionLifecycleGuardOutcome {
    guard session.completed == true else {
        return SessionLifecycleGuardOutcome(session: session, changed: false)
    }

    var nextRestTimer = session.restTimerState
    var clearedRestTimerIsRunning = false
    if let restTimer = session.restTimerState,
       case .object(let obj) = restTimer,
       obj["isRunning"]?.boolValue == true {
        let rewritten = obj.entries.map { entry -> OrderedJSONObject.Entry in
            if entry.key == "isRunning" {
                return OrderedJSONObject.Entry(key: "isRunning", value: .bool(false))
            }
            return entry
        }
        nextRestTimer = .object(OrderedJSONObject(entries: rewritten))
        clearedRestTimerIsRunning = true
    }

    let clearedCurrentExerciseId: Bool
    let nextCurrentExerciseId: String?
    if let id = session.currentExerciseId, !id.isEmpty {
        clearedCurrentExerciseId = true
        nextCurrentExerciseId = ""
    } else {
        clearedCurrentExerciseId = false
        nextCurrentExerciseId = session.currentExerciseId
    }

    let setCurrentFocusStepIdCompleted: Bool
    let nextCurrentFocusStepId: String?
    if let id = session.currentFocusStepId, !id.isEmpty, id != "completed" {
        setCurrentFocusStepIdCompleted = true
        nextCurrentFocusStepId = "completed"
    } else {
        setCurrentFocusStepIdCompleted = false
        nextCurrentFocusStepId = session.currentFocusStepId
    }

    let resetCurrentSetIndex: Bool
    let nextCurrentSetIndex: NumberRepr?
    if let idx = session.currentSetIndex, let i = idx.intValue, i != 0, i != -1 {
        resetCurrentSetIndex = true
        nextCurrentSetIndex = .integer(-1)
    } else {
        resetCurrentSetIndex = false
        nextCurrentSetIndex = session.currentSetIndex
    }

    let clearedFocusActualSetDrafts: Bool
    let nextFocusActualSetDrafts: [ActualSetDraft]?
    if let drafts = session.focusActualSetDrafts, !drafts.isEmpty {
        clearedFocusActualSetDrafts = true
        nextFocusActualSetDrafts = []
    } else {
        clearedFocusActualSetDrafts = false
        nextFocusActualSetDrafts = session.focusActualSetDrafts
    }

    let changed = clearedRestTimerIsRunning
        || clearedCurrentExerciseId
        || setCurrentFocusStepIdCompleted
        || resetCurrentSetIndex
        || clearedFocusActualSetDrafts

    let cleaned: TrainingSession
    if changed {
        cleaned = TrainingSession(
            id: session.id,
            date: session.date,
            startedAt: session.startedAt,
            finishedAt: session.finishedAt,
            durationMin: session.durationMin,
            completed: session.completed,
            earlyEndReason: session.earlyEndReason,
            restTimerState: nextRestTimer,
            currentExerciseId: nextCurrentExerciseId,
            currentFocusStepId: nextCurrentFocusStepId,
            currentSetIndex: nextCurrentSetIndex,
            focusSessionComplete: session.focusSessionComplete,
            focusCompletedStepIds: session.focusCompletedStepIds,
            focusActualSetDrafts: nextFocusActualSetDrafts,
            focusWarmupSetLogs: session.focusWarmupSetLogs,
            exercises: session.exercises,
            _unknown: session._unknown
        )
    } else {
        cleaned = session
    }

    return SessionLifecycleGuardOutcome(
        session: cleaned,
        changed: changed,
        clearedRestTimerIsRunning: clearedRestTimerIsRunning,
        clearedCurrentExerciseId: clearedCurrentExerciseId,
        setCurrentFocusStepIdCompleted: setCurrentFocusStepIdCompleted,
        resetCurrentSetIndex: resetCurrentSetIndex,
        clearedFocusActualSetDrafts: clearedFocusActualSetDrafts
    )
}

// MARK: - Duration guard

public struct DurationGuardOutcome: Equatable, Sendable {
    /// Resolved working duration in minutes — equals raw when in range,
    /// equals rounded span when raw is out of range but span is sane,
    /// nil when both are unusable.
    public let derivedDurationMin: NumberRepr?
    /// True when `derivedDurationMin == nil` because the session is
    /// unrecoverable (both raw and span out of range).
    public let durationInvalid: Bool
    /// The raw `session.durationMin`.
    public let rawDurationMin: NumberRepr?
    /// `finished − started` in minutes, when both timestamps parse.
    public let rawSpanMin: Double?

    public init(
        derivedDurationMin: NumberRepr?,
        durationInvalid: Bool,
        rawDurationMin: NumberRepr?,
        rawSpanMin: Double?
    ) {
        self.derivedDurationMin = derivedDurationMin
        self.durationInvalid = durationInvalid
        self.rawDurationMin = rawDurationMin
        self.rawSpanMin = rawSpanMin
    }
}

public func applyDurationGuard(_ session: TrainingSession) -> DurationGuardOutcome {
    let rawDuration = session.durationMin
    let started = parseIsoDate(session.startedAt)
    let finished = parseIsoDate(session.finishedAt)
    let rawSpanMin: Double?
    if let s = started, let f = finished {
        rawSpanMin = max(0.0, f.timeIntervalSince(s) / 60.0)
    } else {
        rawSpanMin = nil
    }
    let impossible = Double(DataHealthConstants.impossibleDurationMin)
    let durationOutOfRange: Bool
    if let raw = rawDuration?.doubleValue {
        durationOutOfRange = raw > impossible
    } else {
        durationOutOfRange = false
    }
    let spanOutOfRange: Bool
    if let span = rawSpanMin {
        spanOutOfRange = span > impossible * 1.5
    } else {
        spanOutOfRange = false
    }
    if !durationOutOfRange && !spanOutOfRange {
        return DurationGuardOutcome(
            derivedDurationMin: rawDuration,
            durationInvalid: false,
            rawDurationMin: rawDuration,
            rawSpanMin: rawSpanMin
        )
    }
    if let span = rawSpanMin, span <= impossible {
        let rounded = Int64(span.rounded())
        return DurationGuardOutcome(
            derivedDurationMin: .integer(rounded),
            durationInvalid: false,
            rawDurationMin: rawDuration,
            rawSpanMin: rawSpanMin
        )
    }
    return DurationGuardOutcome(
        derivedDurationMin: nil,
        durationInvalid: true,
        rawDurationMin: rawDuration,
        rawSpanMin: rawSpanMin
    )
}

// MARK: - Today status guard

public struct TodayStatusGuardOutcome: Equatable, Sendable {
    public let ignoredForCurrentReadiness: Bool
    public let daysOld: Int?
    public let observedDate: String?

    public init(
        ignoredForCurrentReadiness: Bool,
        daysOld: Int? = nil,
        observedDate: String? = nil
    ) {
        self.ignoredForCurrentReadiness = ignoredForCurrentReadiness
        self.daysOld = daysOld
        self.observedDate = observedDate
    }
}

public func applyTodayStatusGuard(
    _ appData: AppData,
    clock: RuntimeGuardClock = defaultGuardClock
) -> TodayStatusGuardOutcome {
    let dateString = appData.todayStatus.date
    guard let raw = dateString, !raw.isEmpty else {
        return TodayStatusGuardOutcome(ignoredForCurrentReadiness: false)
    }
    guard let parsed = parseIsoDate(raw) else {
        return TodayStatusGuardOutcome(
            ignoredForCurrentReadiness: false,
            daysOld: nil,
            observedDate: raw
        )
    }
    let today = utcStartOfDay(clock.now())
    let days = daysBetween(today, parsed)
    if days > DataHealthConstants.todayStatusStaleDays {
        return TodayStatusGuardOutcome(
            ignoredForCurrentReadiness: true,
            daysOld: days,
            observedDate: raw
        )
    }
    return TodayStatusGuardOutcome(
        ignoredForCurrentReadiness: false,
        daysOld: days,
        observedDate: raw
    )
}

// MARK: - Health data guard

public struct HealthDataGuardOutcome: Equatable, Sendable {
    public let staleForReadiness: Bool
    public let latestSampleAt: String?
    public let daysOld: Int?
    public let useHealthDataForReadiness: Bool

    public init(
        staleForReadiness: Bool,
        latestSampleAt: String? = nil,
        daysOld: Int? = nil,
        useHealthDataForReadiness: Bool
    ) {
        self.staleForReadiness = staleForReadiness
        self.latestSampleAt = latestSampleAt
        self.daysOld = daysOld
        self.useHealthDataForReadiness = useHealthDataForReadiness
    }
}

private func latestHealthDate(_ appData: AppData) -> Date? {
    var maxDate: Date?
    for sample in appData.healthMetricSamples {
        if let parsed = parseIsoDate(sample.startDate) {
            if let cur = maxDate { maxDate = max(cur, parsed) } else { maxDate = parsed }
        }
    }
    if let workouts = appData.root["importedWorkoutSamples"]?.arrayValue {
        for entry in workouts {
            guard case .object(let obj) = entry else { continue }
            if let parsed = parseIsoDate(obj["startDate"]?.stringValue) {
                if let cur = maxDate { maxDate = max(cur, parsed) } else { maxDate = parsed }
            }
        }
    }
    return maxDate
}

public func applyHealthDataGuard(
    _ appData: AppData,
    clock: RuntimeGuardClock = defaultGuardClock
) -> HealthDataGuardOutcome {
    let integration = appData.settings.healthIntegrationSettings?.objectValue
    let rawFlag: Bool? = integration?["useHealthDataForReadiness"]?.boolValue
    let useHealthDataForReadiness: Bool = rawFlag ?? true
    guard let latest = latestHealthDate(appData) else {
        return HealthDataGuardOutcome(
            staleForReadiness: false,
            useHealthDataForReadiness: useHealthDataForReadiness
        )
    }
    let today = utcStartOfDay(clock.now())
    let days = daysBetween(today, latest)
    let stale = useHealthDataForReadiness && days > DataHealthConstants.healthDataStaleDays
    let isoFormatter = ISO8601DateFormatter()
    isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return HealthDataGuardOutcome(
        staleForReadiness: stale,
        latestSampleAt: isoFormatter.string(from: latest),
        daysOld: days,
        useHealthDataForReadiness: useHealthDataForReadiness
    )
}

// MARK: - Issue score cap

public struct IssueScoreCapChange: Equatable, Sendable {
    public let key: String
    public let before: Double
    public let after: Int

    public init(key: String, before: Double, after: Int) {
        self.key = key
        self.before = before
        self.after = after
    }
}

public struct IssueScoreCapOutcome: Equatable, Sendable {
    /// `cappedScores` is a verbatim issueScores map with values capped
    /// to the hard or soft limit. Preserves all original keys.
    public let cappedScores: OrderedJSONObject
    public let changes: [IssueScoreCapChange]
    public let movementFlagsAllGood: Bool

    public init(
        cappedScores: OrderedJSONObject,
        changes: [IssueScoreCapChange],
        movementFlagsAllGood: Bool
    ) {
        self.cappedScores = cappedScores
        self.changes = changes
        self.movementFlagsAllGood = movementFlagsAllGood
    }
}

private func movementFlagsAllGood(_ screening: ScreeningProfile) -> Bool {
    guard case .object(let flags) = (screening.movementFlags ?? .null) else { return false }
    if flags.entries.isEmpty { return false }
    return flags.entries.allSatisfy { entry in
        entry.value.stringValue == "good"
    }
}

private func noPainOrRestriction(_ screening: ScreeningProfile) -> Bool {
    if !(screening.painTriggers ?? []).isEmpty { return false }
    if !(screening.restrictedExercises ?? []).isEmpty { return false }
    return true
}

public func applyIssueScoreCap(_ screening: ScreeningProfile) -> IssueScoreCapOutcome {
    let adaptiveObj = screening.adaptiveState?.objectValue
    let issueScoresObj = adaptiveObj?["issueScores"]?.objectValue ?? OrderedJSONObject()
    let allGood = movementFlagsAllGood(screening) && noPainOrRestriction(screening)
    let softCappable = allGood
    var changes: [IssueScoreCapChange] = []
    let softCap = DataHealthConstants.issueScoreSoftCap
    let hardCap = DataHealthConstants.issueScoreHardCap
    let rewritten: [OrderedJSONObject.Entry] = issueScoresObj.entries.map { entry in
        guard let n = entry.value.doubleValue, !n.isNaN else {
            return entry
        }
        if softCappable, n > Double(softCap) {
            changes.append(IssueScoreCapChange(key: entry.key, before: n, after: softCap))
            return OrderedJSONObject.Entry(key: entry.key, value: .number(.integer(Int64(softCap))))
        }
        if n > Double(hardCap) {
            changes.append(IssueScoreCapChange(key: entry.key, before: n, after: hardCap))
            return OrderedJSONObject.Entry(key: entry.key, value: .number(.integer(Int64(hardCap))))
        }
        return entry
    }
    return IssueScoreCapOutcome(
        cappedScores: OrderedJSONObject(entries: rewritten),
        changes: changes,
        movementFlagsAllGood: allGood
    )
}

// MARK: - Performance drop guard

public struct PerformanceDropOutcome: Equatable, Sendable {
    public let filteredDrops: [String]
    public let removed: [String]

    public init(filteredDrops: [String], removed: [String]) {
        self.filteredDrops = filteredDrops
        self.removed = removed
    }
}

public func applyPerformanceDropGuard(
    _ screening: ScreeningProfile,
    history: [TrainingSession]
) -> PerformanceDropOutcome {
    let drops: [String] = screening.adaptiveState?.objectValue?["performanceDrops"]?
        .arrayValue?.compactMap { $0.stringValue } ?? []
    if drops.isEmpty {
        return PerformanceDropOutcome(filteredDrops: [], removed: [])
    }
    let recent = history.suffix(4)
    var filtered: [String] = []
    var removed: [String] = []
    for exerciseId in drops {
        var observedCount = 0
        var onTargetCount = 0
        for session in recent {
            for exercise in (session.exercises ?? []) {
                if exercise.actualExerciseId == exerciseId || exercise.id == exerciseId {
                    observedCount += 1
                    let sets = exercise.sets ?? []
                    let completed = sets.filter { $0.done == true }.count
                    if completed >= 2 { onTargetCount += 1 }
                }
            }
        }
        if observedCount >= 2 && onTargetCount >= 2 {
            removed.append(exerciseId)
        } else {
            filtered.append(exerciseId)
        }
    }
    return PerformanceDropOutcome(filteredDrops: filtered, removed: removed)
}

// MARK: - Legacy advice strip

public struct LegacyAdviceStripExerciseOutcome: Equatable, Sendable {
    public let exercise: ExercisePrescription
    public let changed: Bool

    public init(exercise: ExercisePrescription, changed: Bool) {
        self.exercise = exercise
        self.changed = changed
    }
}

public func stripLegacyAdviceFromExercise(_ exercise: ExercisePrescription) -> LegacyAdviceStripExerciseOutcome {
    var changed = false
    var nextSuggestion = exercise.suggestion
    var nextAdjustment = exercise.adjustment
    var nextWarning = exercise.warning
    var nextPrescription = exercise.prescription
    if let s = exercise.suggestion, !s.isEmpty {
        nextSuggestion = nil
        changed = true
    }
    if let s = exercise.adjustment, !s.isEmpty {
        nextAdjustment = nil
        changed = true
    }
    if let s = exercise.warning, !s.isEmpty {
        nextWarning = nil
        changed = true
    }
    if let prescription = exercise.prescription,
       case .object(let prescObj) = prescription,
       prescObj["weeklyAdjustment"]?.stringValue != nil {
        nextPrescription = .object(prescObj.withoutKeys(["weeklyAdjustment"]))
        changed = true
    }
    if !changed { return LegacyAdviceStripExerciseOutcome(exercise: exercise, changed: false) }
    let cleaned = ExercisePrescription(
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        originalExerciseId: exercise.originalExerciseId,
        actualExerciseId: exercise.actualExerciseId,
        displayExerciseId: exercise.displayExerciseId,
        recordExerciseId: exercise.recordExerciseId,
        sets: exercise.sets,
        warmupSets: exercise.warmupSets,
        plannedSets: exercise.plannedSets,
        prescription: nextPrescription,
        suggestion: nextSuggestion,
        adjustment: nextAdjustment,
        warning: nextWarning,
        explanations: exercise.explanations,
        _unknown: exercise._unknown
    )
    return LegacyAdviceStripExerciseOutcome(exercise: cleaned, changed: true)
}

public struct LegacyAdviceStripSessionOutcome: Equatable, Sendable {
    public let session: TrainingSession
    public let changed: Bool

    public init(session: TrainingSession, changed: Bool) {
        self.session = session
        self.changed = changed
    }
}

public func stripLegacyAdviceFromSession(_ session: TrainingSession) -> LegacyAdviceStripSessionOutcome {
    var changed = false
    var nextUnknown = session._unknown
    if let explanations = session._unknown["explanations"]?.arrayValue, !explanations.isEmpty {
        nextUnknown = nextUnknown
            .withoutKeys(["explanations"])
            .appending([.init(key: "explanations", value: .array([]))])
        changed = true
    }
    if let deload = session._unknown["deloadDecision"], !deload.isNull {
        nextUnknown = nextUnknown.withoutKeys(["deloadDecision"])
        changed = true
    }
    var nextExercises = session.exercises
    if let exercises = session.exercises {
        var anyExerciseChanged = false
        var stripped: [ExercisePrescription] = []
        stripped.reserveCapacity(exercises.count)
        for ex in exercises {
            let result = stripLegacyAdviceFromExercise(ex)
            if result.changed { anyExerciseChanged = true }
            stripped.append(result.exercise)
        }
        if anyExerciseChanged {
            nextExercises = stripped
            changed = true
        }
    }
    if !changed { return LegacyAdviceStripSessionOutcome(session: session, changed: false) }
    let cleaned = TrainingSession(
        id: session.id,
        date: session.date,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        durationMin: session.durationMin,
        completed: session.completed,
        earlyEndReason: session.earlyEndReason,
        restTimerState: session.restTimerState,
        currentExerciseId: session.currentExerciseId,
        currentFocusStepId: session.currentFocusStepId,
        currentSetIndex: session.currentSetIndex,
        focusSessionComplete: session.focusSessionComplete,
        focusCompletedStepIds: session.focusCompletedStepIds,
        focusActualSetDrafts: session.focusActualSetDrafts,
        focusWarmupSetLogs: session.focusWarmupSetLogs,
        exercises: nextExercises,
        _unknown: nextUnknown
    )
    return LegacyAdviceStripSessionOutcome(session: cleaned, changed: true)
}

// MARK: - Runtime flags (read-only in iOS-3A)

/// Reads the `dataHealthRuntimeFlags` object out of `appData.settings`.
/// iOS-3B will own a `writeRuntimeFlags` counterpart that returns a
/// rebuilt AppData; iOS-3A only needs read.
public func readRuntimeFlags(_ appData: AppData) -> OrderedJSONObject {
    appData.settings.dataHealthRuntimeFlags?.objectValue ?? OrderedJSONObject()
}
