// CleanAppDataView — iOS-3A Data Health Runtime Foundation V1.
//
// Read-only projection of an `AppData` value. Carries:
//   * the original `raw` AppData (NEVER mutated)
//   * the per-session DurationGuardOutcomes
//   * the AppData-level today / health / issue / drop outcomes
//   * the in-memory "cleaned" projection of history + activeSession +
//     screeningProfile, built by applying the runtime guards as pure
//     value transformations
//   * a `CleanAppDataViewDiagnostics` summary suitable for the
//     iOS-3B repair-orchestrator to consume without re-running guards
//
// The cleaned projection is built as new Swift value-typed structs —
// nothing in `raw` is rewritten, and `raw.canonicalJSONData()` is
// unaffected. Downstream consumers (iOS-4 TrainingDecision, iOS-5
// Focus Mode) read from CleanAppDataView and never touch raw.history
// directly.
//
// Mirrors `retired web reference`.

import Foundation
import IronPathDomain

public struct CleanAppDataViewDiagnostics: Equatable, Sendable {
    public let lifecycleResidueSessionIds: [String]
    public let legacyAdviceSessionIds: [String]
    public let invalidDurationSessionIds: [String]
    public let cappedIssueScoreKeys: [String]
    public let staleTodayStatus: Bool
    public let staleHealthData: Bool
    public let filteredPerformanceDropIds: [String]

    public init(
        lifecycleResidueSessionIds: [String],
        legacyAdviceSessionIds: [String],
        invalidDurationSessionIds: [String],
        cappedIssueScoreKeys: [String],
        staleTodayStatus: Bool,
        staleHealthData: Bool,
        filteredPerformanceDropIds: [String]
    ) {
        self.lifecycleResidueSessionIds = lifecycleResidueSessionIds
        self.legacyAdviceSessionIds = legacyAdviceSessionIds
        self.invalidDurationSessionIds = invalidDurationSessionIds
        self.cappedIssueScoreKeys = cappedIssueScoreKeys
        self.staleTodayStatus = staleTodayStatus
        self.staleHealthData = staleHealthData
        self.filteredPerformanceDropIds = filteredPerformanceDropIds
    }
}

public struct CleanAppDataView: Equatable, Sendable {
    /// The original AppData value. iOS-3A NEVER mutates this — it is
    /// the source-of-truth for round-trip parity and snapshot hash.
    public let raw: AppData

    /// In-memory cleaned history sessions. Each entry has lifecycle
    /// residue cleared, legacy advice stripped, and duration override
    /// applied where the guard fired. Never written back to `raw`.
    public let cleanedHistory: [TrainingSession]

    /// In-memory cleaned active session (same projection as
    /// `cleanedHistory`), nil if `raw.activeSession` is nil.
    public let cleanedActiveSession: TrainingSession?

    /// In-memory cleaned screening profile — `adaptiveState.issueScores`
    /// values are capped and `adaptiveState.performanceDrops` is
    /// filtered. Identical to `raw.screeningProfile` when no changes.
    public let cleanedScreening: ScreeningProfile

    /// Per-session DurationGuardOutcome keyed by `session.id`. Sessions
    /// without an id are not represented here (matches the legacy web schema behaviour
    /// — legacy web schema keys by `session.id` directly).
    public let durations: [String: DurationGuardOutcome]

    public let todayStatus: TodayStatusGuardOutcome
    public let healthData: HealthDataGuardOutcome
    public let issueScoreCap: IssueScoreCapOutcome
    public let performanceDrops: PerformanceDropOutcome

    public let diagnostics: CleanAppDataViewDiagnostics

    public init(
        raw: AppData,
        cleanedHistory: [TrainingSession],
        cleanedActiveSession: TrainingSession?,
        cleanedScreening: ScreeningProfile,
        durations: [String: DurationGuardOutcome],
        todayStatus: TodayStatusGuardOutcome,
        healthData: HealthDataGuardOutcome,
        issueScoreCap: IssueScoreCapOutcome,
        performanceDrops: PerformanceDropOutcome,
        diagnostics: CleanAppDataViewDiagnostics
    ) {
        self.raw = raw
        self.cleanedHistory = cleanedHistory
        self.cleanedActiveSession = cleanedActiveSession
        self.cleanedScreening = cleanedScreening
        self.durations = durations
        self.todayStatus = todayStatus
        self.healthData = healthData
        self.issueScoreCap = issueScoreCap
        self.performanceDrops = performanceDrops
        self.diagnostics = diagnostics
    }

    /// True if at least one of the diagnostic buckets reported a change.
    /// iOS-3B uses this as the gate before invoking auto-repairs.
    public var hasDirtyData: Bool {
        let d = diagnostics
        if !d.lifecycleResidueSessionIds.isEmpty { return true }
        if !d.legacyAdviceSessionIds.isEmpty { return true }
        if !d.invalidDurationSessionIds.isEmpty { return true }
        if !d.cappedIssueScoreKeys.isEmpty { return true }
        if d.staleTodayStatus { return true }
        if d.staleHealthData { return true }
        if !d.filteredPerformanceDropIds.isEmpty { return true }
        return false
    }
}
