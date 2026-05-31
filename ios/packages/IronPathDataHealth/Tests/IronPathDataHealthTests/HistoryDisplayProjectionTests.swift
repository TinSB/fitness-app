// HistoryDisplayProjectionTests — History real-AppData read path V1.
//
// Covers the PURE outcome→state branch logic only (no IO, no live store): the thin
// app-layer loader supplies the `HistoryAppDataLoadOutcome` (already routed through
// the GENUINE `buildCleanAppDataView`) plus any snapshot-only supplemental natives;
// this resolver maps them to an honest rendered state. AppData fixtures are built in
// memory from JSON and run through the real clean view, so the test proves native
// sessions reach the timeline THROUGH DataHealth — raw AppData never bypasses the
// clean view (§10) — and that the no-loss merge + dedup behaves.

import XCTest
import IronPathDomain
@testable import IronPathDataHealth

final class HistoryDisplayProjectionTests: XCTestCase {

    private func appData(_ json: String) throws -> AppData {
        try AppData(decoding: Data(json.utf8))
    }

    /// A document with two completed native sessions + one Apple-Health import.
    private func populatedJSON() -> String {
        """
        {
          "schemaVersion": \(SchemaVersion.current.rawValue),
          "history": [
            { "id": "s-old", "finishedAt": "2026-05-10T10:00:00.000Z",
              "completed": true, "focusSessionComplete": true,
              "exercises": [ { "id": "bench", "exerciseId": "bench", "name": "卧推",
                "sets": [ { "setIndex": 0, "done": true }, { "setIndex": 1, "done": true } ] } ] },
            { "id": "s-new", "finishedAt": "2026-05-28T10:00:00.000Z",
              "completed": true, "focusSessionComplete": true,
              "exercises": [ { "id": "squat", "exerciseId": "squat", "name": "深蹲",
                "sets": [ { "setIndex": 0, "done": true } ] } ] }
          ],
          "importedWorkoutSamples": [
            { "id": "w1", "source": "healthkit_import", "workoutType": "running",
              "startDate": "2026-05-30T07:00:00.000Z", "durationMin": 32 }
          ]
        }
        """
    }

    private func supplemental(_ id: String?, at iso: String?) -> SupplementalNativeCompletion {
        SupplementalNativeCompletion(id: id, occurredAtIso: iso, exerciseCount: 1, performedSetCount: 2)
    }

    // MARK: - missing

    func test_missing_noSupplemental_resolvesToEmpty() {
        XCTAssertEqual(resolveHistoryDisplayState(.missing), .empty)
    }

    /// No canonical file yet, but a snapshot-only completion exists → it must STILL
    /// be shown (the unified timeline loses nothing even before the first canonical write).
    func test_missing_withSupplemental_resolvesToReady() {
        let state = resolveHistoryDisplayState(.missing, supplementalNatives: [supplemental("only-local", at: "2026-05-20T08:00:00.000Z")])
        guard case .ready(let timeline) = state else { return XCTFail("expected .ready") }
        XCTAssertEqual(timeline.entries.count, 1)
        guard case .native(let native) = timeline.entries[0] else { return XCTFail("expected native") }
        XCTAssertEqual(native.id, "only-local")
    }

    // MARK: - unreadable → unavailable (present but unparseable; never overwritten)

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolveHistoryDisplayState(.unreadable), .unavailable)
    }

    // MARK: - loaded-but-empty document → empty

    func test_loadedEmptyDocument_resolvesToEmpty() {
        let cleanView = buildCleanAppDataView(.emptyCurrent())
        XCTAssertEqual(resolveHistoryDisplayState(.loaded(cleanView)), .empty)
    }

    // MARK: - loaded with native history + imports → ready, unified + ordered

    func test_loadedWithHistoryAndImports_resolvesToReadyUnifiedOrdered() throws {
        let cleanView = buildCleanAppDataView(try appData(populatedJSON()))
        guard case .ready(let timeline) = resolveHistoryDisplayState(.loaded(cleanView)) else {
            return XCTFail("expected .ready for a populated document")
        }
        // Three rows: import (newest) → s-new → s-old, most-recent-first across sources.
        let ordered: [(CompletedTrainingSource, String?)] = timeline.entries.map { entry in
            switch entry {
            case .native(let native): return (.native, native.id)
            case .imported(let workout): return (.appleHealth, workout.id)
            }
        }
        XCTAssertEqual(ordered.map(\.0), [.appleHealth, .native, .native])
        XCTAssertEqual(ordered.map(\.1), ["w1", "s-new", "s-old"])
    }

    /// Structural §10 proof: the resolver builds the timeline from the clean view's
    /// CLEANED `cleanedHistory` + the cleaned view's `raw.importedWorkoutSamples`,
    /// never raw history directly. The ready timeline equals the one built from
    /// exactly those cleaned pieces.
    func test_loadedReadsCleanedHistory_notRaw() throws {
        let cleanView = buildCleanAppDataView(try appData(populatedJSON()))
        let expected = CompletedTrainingTimeline.make(
            canonicalHistory: cleanView.cleanedHistory,
            supplementalNatives: [],
            importedWorkouts: cleanView.raw.importedWorkoutSamples
        )
        guard case .ready(let timeline) = resolveHistoryDisplayState(.loaded(cleanView)) else {
            return XCTFail("expected .ready")
        }
        XCTAssertEqual(timeline, expected)
    }

    // MARK: - dedup by id through the resolver (canonical wins)

    func test_loadedDedupesSupplementalAgainstCanonical() throws {
        let cleanView = buildCleanAppDataView(try appData(populatedJSON()))
        // Supplement BOTH an existing canonical id (s-new → must be deduped) and a
        // brand-new snapshot-only id (must be kept).
        let state = resolveHistoryDisplayState(.loaded(cleanView), supplementalNatives: [
            supplemental("s-new", at: "2026-05-28T10:00:00.000Z"),
            supplemental("snap-only", at: "2026-05-15T10:00:00.000Z"),
        ])
        guard case .ready(let timeline) = state else { return XCTFail("expected .ready") }
        // 2 canonical natives + 1 import + 1 snapshot-only (s-new deduped) = 4.
        XCTAssertEqual(timeline.entries.count, 4)
        let nativeIds = timeline.entries.compactMap { entry -> String? in
            if case .native(let native) = entry { return native.id }
            return nil
        }
        XCTAssertEqual(nativeIds.filter { $0 == "s-new" }.count, 1, "s-new must appear once (canonical wins)")
        XCTAssertTrue(nativeIds.contains("snap-only"))
    }

    // MARK: - determinism

    func test_resolution_isDeterministic() throws {
        let cleanView = buildCleanAppDataView(try appData(populatedJSON()))
        XCTAssertEqual(
            resolveHistoryDisplayState(.loaded(cleanView)),
            resolveHistoryDisplayState(.loaded(cleanView))
        )
    }
}
