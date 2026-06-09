// DataHealthConstants — iOS-3A Data Health Runtime Foundation V1.
//
// Mirrors `retired web reference`. These are the
// thresholds, caps, and ledger limits shared by every Data Health
// runtime guard and (in iOS-3B) by the repair recipes.
//
// Source-of-truth lives in legacy web implementation; iOS-3A only ports the
// constant values needed by the runtime guards. The numeric values
// must stay byte-equal across legacy web schema and Swift — the
// `iosDataHealthRuntimeFoundationStaticGuards` parity test asserts
// this at CI time by parsing the legacy web schema file and re-comparing.

import Foundation

public enum DataHealthConstants {
    /// `todayStatus.date` older than this many days is ignored when
    /// computing current-day readiness. legacy web schema:
    /// `DATA_HEALTH_TODAY_STATUS_STALE_DAYS`.
    public static let todayStatusStaleDays: Int = 3

    /// HealthKit samples (metric + workout) older than this many days
    /// are considered stale for the readiness pipeline. legacy web schema:
    /// `DATA_HEALTH_HEALTH_DATA_STALE_DAYS`.
    public static let healthDataStaleDays: Int = 14

    /// Absolute upper bound on `screening.adaptiveState.issueScores`
    /// values. Anything above this is hard-capped. legacy web schema:
    /// `DATA_HEALTH_ISSUE_SCORE_HARD_CAP`.
    public static let issueScoreHardCap: Int = 50

    /// Soft cap applied only when movementFlags are all "good" AND
    /// pain triggers + restricted exercises are empty. legacy web schema:
    /// `DATA_HEALTH_ISSUE_SCORE_SOFT_CAP`.
    public static let issueScoreSoftCap: Int = 12

    /// Session duration above this many minutes is treated as a
    /// likely background-tab leak. Either repaired via the
    /// finished−started span (when in-range) or the session is
    /// marked durationInvalid. legacy web schema:
    /// `DATA_HEALTH_IMPOSSIBLE_DURATION_MIN`.
    public static let impossibleDurationMin: Int = 240

    /// Fallback duration used by iOS-3B repairs that need a
    /// reasonable default when both rawDuration and span are
    /// unusable. legacy web schema: `DATA_HEALTH_FALLBACK_DURATION_MIN`.
    public static let fallbackDurationMin: Int = 60

    /// Maximum number of `DataHealthRepairLedgerEntry` rows the
    /// ledger holds. Oldest rows are trimmed FIFO past this cap.
    /// legacy web schema: `DATA_HEALTH_LEDGER_MAX_ENTRIES`.
    public static let ledgerMaxEntries: Int = 1000

    /// Idempotency window for repair-apply: if a row with the same
    /// `repairId` + `idempotencyKey` was applied within this many
    /// hours, a re-run is treated as no-op. legacy web schema:
    /// `DATA_HEALTH_LEDGER_IDEMPOTENT_WINDOW_HOURS`.
    public static let ledgerIdempotentWindowHours: Int = 24
}
