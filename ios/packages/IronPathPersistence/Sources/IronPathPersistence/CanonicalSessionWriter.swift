// CanonicalSessionWriter — iOS-17A Native Per-Set Logging Mega V1 (iOS-17c);
// HK-1 added the body-weight import entry point on the SAME path.
//
// THE single native canonical-AppData WRITE PATH (§8). It appends new local data
// to canonical `AppData` and persists it through the sanctioned `AppDataStore`
// (JSON-on-disk, atomic, backup). Two typed entry points share ONE gated
// orchestration (`performGatedAppend`) — they are NOT separate write paths:
//   • `appendCompletedSession` — a freshly completed `TrainingSession` (built by
//     IronPathDomain.NativeCompletedSessionBuilder from the in-RAM per-set
//     capture) → `AppData.history` (iOS-17A).
//   • `appendHealthMetricSample` — one externally-imported `HealthMetricSample`
//     (an Apple Health body-weight reading, kg-stored) → `AppData.healthMetricSamples`
//     (HK-1). Idempotent by content id.
//
// This is NOT a full AppData restore (§14): it appends NEWLY-CREATED local data
// the user just performed — it never replaces/merges an external/backup document.
// The repair-apply pipeline (load → snapshot → backup → apply → save) stays
// deferred; this writer only appends + saves.
//
// Boundary contract (mirrors the store guarantees, made explicit at the seam):
//   • Load existing first; a present-but-UNREADABLE document is NOT overwritten
//     (honest failure — never destroy data we cannot parse). A missing file is a
//     legitimate first install → start from `baseIfMissing` (AppData.emptyCurrent()).
//   • DataHealth gate (INJECTED as `validate`) must accept the candidate before
//     any write. The gate is supplied by the caller so this package keeps its
//     single dependency edge (Persistence → Domain) — it does not import DataHealth.
//   • Backup-before-overwrite: when a prior file exists, `store.backup()` runs
//     BEFORE `store.save()`, so the timestamped `.backup-…` copy is the rollback.
//   • Atomic write + no fake success: `store.save` is atomic; every failure THROWS
//     and nothing is reported as saved.
//
// Pure orchestration over the injected `AppDataStore` + `validate` closure — no
// FileManager here (all disk IO is the store's), no clock, no network, no cloud.

import Foundation
import IronPathDomain

/// Outcome of a successful canonical write.
public struct PerformedSessionWriteResult: Equatable, Sendable {
    /// True when no prior on-disk document existed and `baseIfMissing` seeded the
    /// first write (no backup is possible/needed on a first install).
    public let createdNewStore: Bool
    /// The backup file created before overwrite (the rollback copy), or nil on a
    /// first write where there was nothing to back up.
    public let backupURL: URL?

    public init(createdNewStore: Bool, backupURL: URL?) {
        self.createdNewStore = createdNewStore
        self.backupURL = backupURL
    }
}

/// Honest, typed failures. Each leaves the on-disk document in a safe state:
/// either untouched (load/validation/backup failed before save) or atomically
/// replaced only on a clean save.
public enum CanonicalSessionWriteError: Error, Equatable, Sendable {
    /// A file exists but could not be loaded/decoded — refuse to overwrite it.
    case existingDocumentUnreadable(String)
    /// The injected DataHealth gate rejected the candidate (would be unhealthy /
    /// stripped on reload). Nothing was written.
    case validationRejected
    /// Backup-before-overwrite failed; the prior document is intact and no new
    /// write was attempted.
    case backupFailed(String)
    /// The atomic save itself failed; the prior document (and its backup) survive.
    case saveFailed(String)
}

public struct CanonicalSessionWriter {
    private let store: AppDataStore

    public init(store: AppDataStore) {
        self.store = store
    }

    /// Append `session` to canonical `AppData.history` and persist.
    ///
    /// - Parameters:
    ///   - session: the completed session to append (built by the Domain builder).
    ///   - baseIfMissing: the document to seed when no file exists yet
    ///     (defaults to a minimal current-schema empty AppData).
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate
    ///     (→ `.validationRejected`, nothing written).
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func appendCompletedSession(
        _ session: TrainingSession,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedAppend(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.appendingHistorySession(session) },
            validate: validate
        )
    }

    /// HK-1: append one externally-imported `HealthMetricSample` (e.g. an Apple
    /// Health body-weight reading, kg-stored) to canonical
    /// `AppData.healthMetricSamples` and persist — through the SAME sanctioned,
    /// DataHealth-gated write path as `appendCompletedSession` (§8 rule 4: NOT a
    /// second/parallel write path). The candidate builder is the pure open-bag
    /// `AppData.appendingHealthMetricSample` (idempotent by content id), so a
    /// re-import of the same reading is a clean no-op that still round-trips
    /// through load → gate → save.
    ///
    /// - Parameters:
    ///   - sample: the imported sample to append (built by the pure
    ///     `IronPathHealthKit` mapper from a `BodyMassReading`).
    ///   - baseIfMissing: the document to seed when no file exists yet.
    ///   - validate: the DataHealth gate. Return `false` to reject the candidate.
    /// - Returns: what happened (first write? backup taken?).
    @discardableResult
    public func appendHealthMetricSample(
        _ sample: HealthMetricSample,
        baseIfMissing: AppData = .emptyCurrent(),
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        try performGatedAppend(
            baseIfMissing: baseIfMissing,
            buildCandidate: { $0.appendingHealthMetricSample(sample) },
            validate: validate
        )
    }

    /// The single gated-append orchestration shared by every canonical write entry
    /// point above. `buildCandidate` is the only thing that varies (which open-bag
    /// transform produces the candidate); the load → gate → backup → atomic save →
    /// honest-throw contract is identical for all of them, so there is exactly ONE
    /// write path (§8.1).
    private func performGatedAppend(
        baseIfMissing: AppData,
        buildCandidate: (AppData) -> AppData,
        validate: (AppData) -> Bool
    ) throws -> PerformedSessionWriteResult {
        // 1) Load existing, or seed the first write. A present-but-unreadable file
        //    is a hard stop — overwriting it would destroy unparseable user data.
        let existing: AppData
        let createdNew: Bool
        if store.hasExistingFile {
            do {
                existing = try store.load()
                createdNew = false
            } catch {
                throw CanonicalSessionWriteError.existingDocumentUnreadable("\(error)")
            }
        } else {
            existing = baseIfMissing
            createdNew = true
        }

        // 2) Build the candidate (pure, open-bag preserving append).
        let candidate = buildCandidate(existing)

        // 3) DataHealth gate. No fake success — a rejected candidate is never saved.
        guard validate(candidate) else {
            throw CanonicalSessionWriteError.validationRejected
        }

        // 4) Backup-before-overwrite (rollback) when a prior file exists.
        var backupURL: URL?
        if !createdNew {
            do {
                backupURL = try store.backup()
            } catch {
                throw CanonicalSessionWriteError.backupFailed("\(error)")
            }
        }

        // 5) Atomic save. A throw here leaves the prior file + its backup intact.
        do {
            try store.save(candidate)
        } catch {
            throw CanonicalSessionWriteError.saveFailed("\(error)")
        }

        return PerformedSessionWriteResult(createdNewStore: createdNew, backupURL: backupURL)
    }
}
