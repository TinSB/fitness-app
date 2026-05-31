// HistoryDisplayProjection — History real-AppData read path V1.
//
// The pure outcome→state resolver for the 记录 (History) surface — the read-side
// companion to the Today (#437) and Profile (#438) read paths. Like Profile's (the
// 记录 surface is NOT engine-related) it lives here in DataHealth, the owner of
// `CleanAppDataView` (§10), rather than in the engine package — keeping the import
// graph a DAG (`DataHealth → Domain` only; no new edge, and crucially NO edge to
// `IronPathLocalSnapshot`).
//
// HARD CONTRACT (master §10): the surface renders a CLEANED view, never raw
// AppData. The `.loaded` outcome carries a `CleanAppDataView` (built by the thin
// app-layer loader via `buildCleanAppDataView`, the §10 chokepoint), so a caller
// CANNOT resolve a state without first routing the document through DataHealth.
// Native completed sessions are read from the CLEANED `cleanedHistory`; the derived
// Apple-Health imports ride in `raw.importedWorkoutSamples` (the document that
// PASSED the clean-view ingress — the same pattern Profile uses for
// `raw.healthMetricSamples`). The unified MERGE + DEDUP + ORDER is the pure
// `IronPathDomain.CompletedTrainingTimeline`.
//
// === supplementalNatives (no-loss merge, no LocalSnapshot coupling) ===
// A native completion logged WITHOUT per-set detail never reaches canonical
// `history` (the writer skips it). The thin app layer reads those from the local
// Focus snapshot store and passes them here as neutral `SupplementalNativeCompletion`
// values; the timeline merges them in, DEDUPED BY ID against canonical (canonical
// wins). This resolver therefore stays pure and free of any `IronPathLocalSnapshot`
// import. When the canonical document is MISSING but snapshot-only completions
// exist, the resolver still resolves to `.ready` — it loses nothing.
//
// Honesty (master §15.4): `.missing` with no supplemental → `.empty`; `.unreadable`
// → `.unavailable` (an honest degrade — the document is left UNTOUCHED, never
// overwritten; this read path never writes); a loaded/merged timeline with rows →
// `.ready`. The loader supplies the outcome (the only IO); this is pure and
// reproducible.

import Foundation
import IronPathDomain

/// The outcome of attempting to read + clean the canonical AppData document,
/// produced by the thin app-layer loader (the ONLY IO + the DataHealth clean-view
/// construction). Kept separate from the resolved state so the branch logic below
/// stays pure and fully testable without a live store. Mirrors
/// `ProfileAppDataLoadOutcome` / `TodayAppDataLoadOutcome`.
public enum HistoryAppDataLoadOutcome: Sendable {
    /// No canonical file exists yet (first launch) — or no live source is wired
    /// (previews/tests). An honest "no canonical data" signal, never an error.
    case missing
    /// A canonical file exists but could not be loaded/decoded. The document is
    /// preserved untouched (this read path NEVER writes) — surface an honest degrade.
    case unreadable
    /// A canonical document loaded AND was routed through DataHealth
    /// `buildCleanAppDataView` by the loader. Only the clean view reaches display.
    case loaded(CleanAppDataView)
}

/// The resolved 记录 display state the thin SwiftUI layer renders verbatim.
public enum HistoryDisplayState: Equatable, Sendable {
    /// The unified completed-training timeline (native + imports), most-recent-first.
    case ready(CompletedTrainingTimeline)
    /// No completed training to show — a missing file / first launch with no
    /// snapshot-only completions, or a loaded document with no completed sessions,
    /// no imports, and no supplemental. An honest empty state, never fabricated rows.
    case empty
    /// A canonical document exists but is unreadable — an honest degrade. The
    /// document is left untouched (read-only path; never overwritten).
    case unavailable
}

/// Pure resolver: maps a load outcome (+ any snapshot-only native completions) to
/// the rendered state. The loaded view has already passed through DataHealth (§10);
/// natives are read from the CLEANED `cleanedHistory`, imports from the cleaned
/// view's `raw` bag (which passed the clean-view ingress). The MERGE / DEDUP /
/// ORDER is the pure `CompletedTrainingTimeline`.
public func resolveHistoryDisplayState(
    _ outcome: HistoryAppDataLoadOutcome,
    supplementalNatives: [SupplementalNativeCompletion] = []
) -> HistoryDisplayState {
    switch outcome {
    case .unreadable:
        // Canonical source of truth present but broken → an honest whole-tab degrade
        // (never a partial render that could imply the canonical data loaded). The
        // document is left untouched; the snapshots are not lost (the user can retry).
        return .unavailable
    case .missing:
        // No canonical document yet — but snapshot-only completions may exist, so we
        // still merge (losing nothing). An all-empty merge → the honest empty state.
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: [],
            supplementalNatives: supplementalNatives,
            importedWorkouts: []
        )
        return timeline.isEmpty ? .empty : .ready(timeline)
    case .loaded(let cleanView):
        let timeline = CompletedTrainingTimeline.make(
            canonicalHistory: cleanView.cleanedHistory,
            supplementalNatives: supplementalNatives,
            importedWorkouts: cleanView.raw.importedWorkoutSamples
        )
        return timeline.isEmpty ? .empty : .ready(timeline)
    }
}
