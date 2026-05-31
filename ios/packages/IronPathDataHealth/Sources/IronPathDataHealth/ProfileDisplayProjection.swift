// ProfileDisplayProjection — Profile real-AppData read path V1.
//
// The pure outcome→state resolver for the 我的 (Profile) surface — the read-side
// companion to the Today read path (`IronPathTrainingDecision.resolveTodayReadinessState`),
// but Profile is NOT engine-related, so it lives here in DataHealth (the owner of
// `CleanAppDataView`, §10) rather than in the engine package, keeping the import
// graph a DAG (`DataHealth → Domain` only; no new edge).
//
// HARD CONTRACT (master §10): the surface renders a CLEANED view, never raw
// AppData. The `.loaded` outcome carries a `CleanAppDataView` (built by the thin
// app-layer loader via `buildCleanAppDataView`, the §10 chokepoint), so a caller
// CANNOT resolve a state without first routing the document through DataHealth —
// the gating is structural, not a convention. The actual display SELECTION + the
// derived latest body weight live in the pure `IronPathDomain.ProfileDisplayData`
// (Foundation-only, separately unit-tested); this resolver only maps load outcomes
// to honest states and pulls the cleaned pieces out of the view.
//
// Honesty (master §15.4): `.missing` (no canonical file yet / first launch / no
// live source) → `.empty`; a loaded view with NO user-meaningful profile content →
// `.empty` (an honest "还没有资料/基线", never a page of placeholders); `.unreadable`
// (a present but unparseable document) → `.unavailable` (degrade — the document is
// left UNTOUCHED, never overwritten; this read path never writes); a loaded view
// WITH content → `.ready(data)`. The loader supplies the outcome (the only IO);
// this is pure and reproducible.

import Foundation
import IronPathDomain

/// The outcome of attempting to read + clean the canonical AppData document,
/// produced by the thin app-layer loader (the ONLY IO + the DataHealth clean-view
/// construction). Kept separate from the resolved state so the branch logic below
/// stays pure and fully testable without a live store. Mirrors
/// `TodayAppDataLoadOutcome`.
public enum ProfileAppDataLoadOutcome: Sendable {
    /// No canonical file exists yet (first launch) — or no live source is wired
    /// (previews/tests). An honest "no data" signal, never an error.
    case missing
    /// A canonical file exists but could not be loaded/decoded. The document is
    /// preserved untouched (this read path NEVER writes) — surface an honest degrade.
    case unreadable
    /// A canonical document loaded AND was routed through DataHealth
    /// `buildCleanAppDataView` by the loader. Only the clean view reaches display.
    case loaded(CleanAppDataView)
}

/// The resolved 我的 display state the thin SwiftUI layer renders verbatim.
public enum ProfileDisplayState: Equatable, Sendable {
    /// Real profile read-model computed from the user's cleaned canonical AppData.
    case ready(ProfileDisplayData)
    /// No usable canonical data yet (missing file / first launch / a loaded document
    /// with no profile content) — show an honest empty state, never a fabricated
    /// profile.
    case empty
    /// A canonical document exists but is unreadable — honest degrade. The document
    /// is left untouched (read-only path; never overwritten).
    case unavailable
}

/// Pure resolver: maps a load outcome to the rendered state. The loaded view has
/// already passed through DataHealth (master §10); this resolver only reads from the
/// clean view (CLEANED screening + the document's `raw` profile/unit/settings scalars
/// + the `raw` health-metric time series for the derived latest body weight) and
/// answers the honest empty-state question via `ProfileDisplayData.hasAnyContent`.
public func resolveProfileDisplayState(_ outcome: ProfileAppDataLoadOutcome) -> ProfileDisplayState {
    switch outcome {
    case .missing:
        return .empty
    case .unreadable:
        return .unavailable
    case .loaded(let cleanView):
        let data = ProfileDisplayData.make(
            profile: cleanView.raw.userProfile,
            unitSettings: cleanView.raw.unitSettings,
            // Use the DataHealth-CLEANED screening (capped issueScores / filtered
            // performanceDrops), never raw.screeningProfile.
            screening: cleanView.cleanedScreening,
            appSettings: cleanView.raw.settings,
            healthMetricSamples: cleanView.raw.healthMetricSamples
        )
        // A loaded-but-empty document (first launch / no profile yet) has no baseline
        // to show → honest empty, rather than presenting placeholders as a profile.
        return data.hasAnyContent ? .ready(data) : .empty
    }
}
