// SavedSessionSetDisplayProjectionTests — DEEP-EDIT-1 display-from-canonical V1.
//
// Covers the PURE canonical-first per-set resolver (no IO, no live store). Canonical
// history is built in memory from JSON and run through the GENUINE
// `buildCleanAppDataView`, so the tests prove the projection reads the same cleaned
// `[TrainingSession]` the §10 chokepoint produces — raw AppData never bypasses the
// clean view — and that canonical-hit / canonical-miss / honest-missing behave.

import XCTest
import IronPathDomain
@testable import IronPathDataHealth

final class SavedSessionSetDisplayProjectionTests: XCTestCase {

    /// The DataHealth-CLEANED `[TrainingSession]` for a JSON document — the exact shape
    /// the thin app loader hands the resolver (through `buildCleanAppDataView`, §10).
    private func cleanedHistory(_ json: String) throws -> [TrainingSession] {
        let appData = try AppData(decoding: Data(json.utf8))
        return buildCleanAppDataView(appData).cleanedHistory
    }

    /// A document with ONE completed native session ("focus-1") holding one exercise
    /// ("bench") with two performed sets — set 0 corrected to 65kg×6 RIR1, set 1 left
    /// at 62.5kg×5 RIR0. Mirrors what a DEEP-EDIT-1 correction leaves on disk.
    private func correctedJSON() -> String {
        """
        {
          "schemaVersion": \(SchemaVersion.current.rawValue),
          "history": [
            { "id": "focus-1", "finishedAt": "2026-05-28T10:00:00.000Z",
              "completed": true, "focusSessionComplete": true,
              "exercises": [ { "id": "bench", "exerciseId": "bench", "name": "卧推",
                "sets": [
                  { "setIndex": 0, "weight": 65, "reps": 6, "rir": 1, "done": true },
                  { "setIndex": 1, "weight": 62.5, "reps": 5, "rir": 0, "done": true }
                ] } ] }
          ]
        }
        """
    }

    /// The LocalSnapshot display copy for "focus-1" BEFORE the correction (set 0 still
    /// shows the stale 60kg×8 RIR2). Used as the neutral fallbacks.
    private func staleFallbacks() -> [SavedSessionSetFallback] {
        [
            SavedSessionSetFallback(exerciseId: "bench", setIndex: 0, weightKg: 60, reps: 8, rir: 2),
            SavedSessionSetFallback(exerciseId: "bench", setIndex: 1, weightKg: 62.5, reps: 5, rir: 0),
        ]
    }

    // MARK: - canonical hit → the CORRECTED value (persists past the stale snapshot)

    func test_canonicalHit_prefersCorrectedValueOverStaleSnapshot() throws {
        let history = try cleanedHistory(correctedJSON())
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: "focus-1",
            canonicalHistory: history,
            snapshotFallbacks: staleFallbacks()
        )
        // Set 0: canonical 65kg×6 RIR1 wins over the stale snapshot 60kg×8 RIR2.
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 0)],
            SavedSessionSetDisplayValue(weightKg: 65, reps: 6, rir: 1)
        )
        // Set 1: canonical == snapshot here, still sourced from canonical.
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 1)],
            SavedSessionSetDisplayValue(weightKg: 62.5, reps: 5, rir: 0)
        )
    }

    // MARK: - canonical miss (no matching session) → fall back to the snapshot copy

    func test_noMatchingCanonicalSession_fallsBackToSnapshot() throws {
        // Canonical history has a DIFFERENT session id → snapshot-only session: every
        // set falls back to the LocalSnapshot copy (inherently uneditable).
        let history = try cleanedHistory(correctedJSON())
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: "some-other-snapshot",
            canonicalHistory: history,
            snapshotFallbacks: staleFallbacks()
        )
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 0)],
            SavedSessionSetDisplayValue(weightKg: 60, reps: 8, rir: 2)
        )
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 1)],
            SavedSessionSetDisplayValue(weightKg: 62.5, reps: 5, rir: 0)
        )
    }

    // MARK: - honest missing: empty canonical history → fallbacks unchanged

    func test_emptyCanonicalHistory_returnsFallbacksUnchanged() {
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: "focus-1",
            canonicalHistory: [],
            snapshotFallbacks: staleFallbacks()
        )
        XCTAssertEqual(resolved.count, 2)
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 0)],
            SavedSessionSetDisplayValue(weightKg: 60, reps: 8, rir: 2)
        )
    }

    func test_noFallbacks_returnsEmpty() throws {
        let history = try cleanedHistory(correctedJSON())
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: "focus-1",
            canonicalHistory: history,
            snapshotFallbacks: []
        )
        XCTAssertTrue(resolved.isEmpty)
    }

    // MARK: - partial: canonical has SOME sets, the rest fall back

    func test_partial_canonicalSetHits_unknownSetFallsBack() throws {
        let history = try cleanedHistory(correctedJSON())
        // The snapshot carries a THIRD set (index 2) the canonical session never had
        // (e.g. logged with no metrics → never written canonical) → it must fall back.
        var fallbacks = staleFallbacks()
        fallbacks.append(SavedSessionSetFallback(exerciseId: "bench", setIndex: 2, weightKg: 50, reps: 10, rir: 3))
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: "focus-1",
            canonicalHistory: history,
            snapshotFallbacks: fallbacks
        )
        // Set 0 from canonical (corrected)…
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 0)],
            SavedSessionSetDisplayValue(weightKg: 65, reps: 6, rir: 1)
        )
        // …set 2 (absent from canonical) honestly from the snapshot.
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 2)],
            SavedSessionSetDisplayValue(weightKg: 50, reps: 10, rir: 3)
        )
    }

    // MARK: - exercise matched by `exerciseId` even when `id` differs

    func test_matchesExerciseByExerciseId_whenIdDiffers() throws {
        // Canonical exercise has a different `id` ("ex-uuid-9") but the SAME
        // `exerciseId` ("bench") the snapshot keys on → it must still match.
        let json = """
        {
          "schemaVersion": \(SchemaVersion.current.rawValue),
          "history": [
            { "id": "focus-1", "finishedAt": "2026-05-28T10:00:00.000Z",
              "completed": true, "focusSessionComplete": true,
              "exercises": [ { "id": "ex-uuid-9", "exerciseId": "bench", "name": "卧推",
                "sets": [ { "setIndex": 0, "weight": 70, "reps": 4, "rir": 0, "done": true } ] } ] }
          ]
        }
        """
        let history = try cleanedHistory(json)
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: "focus-1",
            canonicalHistory: history,
            snapshotFallbacks: [SavedSessionSetFallback(exerciseId: "bench", setIndex: 0, weightKg: 60, reps: 8, rir: 2)]
        )
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 0)],
            SavedSessionSetDisplayValue(weightKg: 70, reps: 4, rir: 0)
        )
    }

    // MARK: - honest "not entered": a canonical set with a cleared metric stays nil

    func test_canonicalClearedMetric_isHonestNil_notFabricated() throws {
        // Canonical set 0 has NO reps key (the user cleared it on edit) → reps must be
        // nil in the display value, NOT a fabricated 0 and NOT the stale snapshot 8.
        let json = """
        {
          "schemaVersion": \(SchemaVersion.current.rawValue),
          "history": [
            { "id": "focus-1", "finishedAt": "2026-05-28T10:00:00.000Z",
              "completed": true, "focusSessionComplete": true,
              "exercises": [ { "id": "bench", "exerciseId": "bench", "name": "卧推",
                "sets": [ { "setIndex": 0, "weight": 65, "rir": 1, "done": true } ] } ] }
          ]
        }
        """
        let history = try cleanedHistory(json)
        let resolved = resolveSavedSessionSetDisplay(
            snapshotId: "focus-1",
            canonicalHistory: history,
            snapshotFallbacks: [SavedSessionSetFallback(exerciseId: "bench", setIndex: 0, weightKg: 60, reps: 8, rir: 2)]
        )
        XCTAssertEqual(
            resolved[SavedSessionSetKey(exerciseId: "bench", setIndex: 0)],
            SavedSessionSetDisplayValue(weightKg: 65, reps: nil, rir: 1)
        )
    }
}
