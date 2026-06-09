// TodayRealReadiness — Today real-AppData read path V1.
//
// The FIRST native canonical-AppData READ-for-DISPLAY path. Until now the
// canonical store was WRITTEN (`CanonicalSessionWriter`, §8.1) and read only as a
// load-before-append seam; the 今日 surface computed readiness from a fixed
// deterministic SAMPLE (`FocusModePreviewData`). This file adds the pure, testable
// orchestration that turns an already-cleaned canonical view into the same
// `TodayReadinessSummary` the surface renders — but from the user's REAL on-device
// data. It does NOT write, does NOT change the engine, and touches no parity golden
// (additive presentation/orchestration — master §19.2).
//
// HARD CONTRACT (master §10/§11): the engine receives a clean view, never raw
// AppData — and, per the TrainingDecision boundary, THIS package never CONSTRUCTS
// the clean view. The thin app-layer loader builds it via DataHealth
// `buildCleanAppDataView` (the §10 chokepoint) and hands the resolver the resulting
// `CleanAppDataView`; the resolver mints the branded `CleanTrainingDecisionInput`
// from it and feeds `buildTrainingDecisionFromCleanInput`. Determinism is preserved
// (§11.2): the instant is INJECTED (`now`) — the engine's `nowIso` derives from it
// (and the loader builds the clean view's guard clock from the SAME instant), never
// an ambient `Date()` here.
//
// Honesty (master §15.4): the load outcomes map to honest states — `.missing` (no
// canonical file yet / first launch / no live source) and a loaded-but-empty
// (no cleaned history) view → `.empty` (no training baseline to compute from),
// `.unreadable` (a present but unparseable document) → `.unavailable` (degrade,
// never crash, never overwrite), and a clean view WITH cleaned history →
// `.ready(summary)`. The loader supplies the outcome (the only IO); this is pure.

import Foundation
import RedeDomain
import RedeDataHealth

/// The outcome of attempting to read + clean the canonical AppData document,
/// produced by the thin app-layer loader (the ONLY IO + the DataHealth clean-view
/// construction, which by the TrainingDecision boundary cannot happen in this
/// package). Kept separate from the resolved state so the branch logic below stays
/// pure and fully testable without a live store.
public enum TodayAppDataLoadOutcome: Sendable {
    /// No canonical file exists yet (first launch) — or no live source is wired
    /// (previews/tests). An honest "no data" signal, never an error.
    case missing
    /// A canonical file exists but could not be loaded/decoded. The document is
    /// preserved untouched (this read path NEVER writes) — surface an honest degrade.
    case unreadable
    /// A canonical document loaded AND was routed through DataHealth
    /// `buildCleanAppDataView` by the loader. Only the clean view reaches the engine.
    case loaded(CleanAppDataView)
}

/// The resolved 今日 readiness state the thin SwiftUI layer renders verbatim.
/// `Equatable`/`Sendable` because `TodayReadinessSummary` already is.
public enum TodayReadinessState: Equatable, Sendable {
    /// Real readiness computed from the user's cleaned canonical AppData.
    case ready(TodayReadinessSummary)
    /// No usable canonical data yet (missing file / first launch / no cleaned
    /// history) — show an honest empty state, never a fabricated readiness.
    case empty
    /// A canonical document exists but is unreadable — honest degrade. The document
    /// is left untouched (read-only path; never overwritten).
    case unavailable
}

/// Pure resolver: maps a load outcome to the rendered state. The loaded view has
/// already passed through DataHealth (master §10); the resolver only mints the
/// branded input and reads the engine output (master §11). `now` is the injected
/// instant — it MUST match the instant the loader used to build the clean view's
/// guard clock, so the result is reproducible for a given (`outcome`, `now`).
public func resolveTodayReadinessState(
    _ outcome: TodayAppDataLoadOutcome,
    now: Date
) -> TodayReadinessState {
    switch outcome {
    case .missing:
        return .empty
    case .unreadable:
        return .unavailable
    case .loaded(let cleanView):
        // No cleaned training history => no real baseline to compute readiness from.
        // Honest empty rather than presenting the engine's bare defaults as a result.
        guard !cleanView.cleanedHistory.isEmpty else { return .empty }
        // §11: only the branded CleanTrainingDecisionInput (minted from the clean
        // view) feeds the engine. V1 reads the real history / todayStatus / screening
        // / plan that the factory pulls from the clean view; the optional metadata
        // flags (template, acute-pain/injury/illness/deload) are not yet sourced from
        // a real check-in and stay nil — an honest V1 scope, not a fabricated value.
        let input = createCleanTrainingDecisionInput(
            cleanView: cleanView,
            metadata: CleanTrainingDecisionInputMetadata(nowIso: todayReferenceIso8601UTC(now))
        )
        let slice = buildTrainingDecisionFromCleanInput(input)
        return .ready(TodayReadinessSummary(slice: slice, todayStatus: cleanView.raw.todayStatus))
    }
}

/// UTC ISO-8601 with fractional seconds (matches the engine's parity-clock format,
/// e.g. `2026-05-27T10:00:00.000Z`). The engine reads `nowIso.prefix(10)` as the
/// reference day and parses the instant for session-gap math; UTC keeps the whole
/// pipeline on the codebase's existing UTC-day convention.
private func todayReferenceIso8601UTC(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    formatter.timeZone = TimeZone(identifier: "UTC")
    return formatter.string(from: date)
}
