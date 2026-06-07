// TodayRootView — iOS-17C Plan + Today Read-only Surface V1;
// Today real-AppData read path V1 switches it from sample to REAL data.
//
// 今日 (Today) tab mount point. Renders a READ-ONLY readiness summary derived from
// the real TrainingDecision engine output, plus an honest entry into 训练.
//
// Data source (Today real-AppData read path V1): this surface now reads the user's
// REAL on-device canonical AppData — the SAME store `CanonicalSessionWriter` writes
// (`JSONFileAppDataStore.applicationSupport()`, §8). The thin `TodayRealDataModel`
// below opts the running app into that store, loads it READ-ONLY, and delegates the
// whole transform to the pure package resolver:
//   AppData → buildCleanAppDataView → createCleanTrainingDecisionInput
//          → buildTrainingDecisionFromCleanInput → TodayReadinessSummary
// — raw AppData NEVER reaches the engine (it always passes through the DataHealth
// clean view first, §10/§11). Honest states (§15.4): no canonical file yet / no
// training baseline → an empty state; a present-but-unreadable document → a degrade
// state (the document is left untouched — this path NEVER writes). All branch logic
// lives in IronPathTrainingDecision.resolveTodayReadinessState (pure + unit-tested);
// this view only renders. The engine is read, never changed (no golden touched).
//
// W-1: this surface also PUBLISHES a small DERIVED read-only readiness snapshot to
// the App Group for the home-screen widget (a derived share file via the
// IronPathWidgetShared seam — never canonical AppData, never a source of truth,
// §8/§12) — now with the user's REAL readiness when available (W-2 anticipated this
// once a canonical read path landed), and nothing when there is no real readiness.
// See WidgetSnapshotWriterModel.
//
// Training entry: the five-tab shell's selected tab is ContentView-private state,
// and the iOS-17S parallel-line contract forbids editing the shell from a tab
// fill, so this slice does NOT switch tabs programmatically. The CTA honestly
// directs the user to the 训练 tab instead of faking navigation. A real
// cross-tab jump is a follow-up that must be made in the shell-owning slice.
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// Each *RootView is the SINGLE app-layer mount point for its tab in the
// ContentView TabView shell (今日 / 训练 / 记录 / 计划 / 我的). A parallel line
// fills a tab by replacing ONLY this RootView's body and the package logic it
// renders. Do NOT edit ContentView (the shell), another tab's RootView, or
// project.pbxproj from a tab-fill slice — the shell + pbxproj registration are
// owned by iOS-17S. Keep the app layer thin (master §5/§15/§19.3): no business
// logic, no persistence, no network/cloud/auth/HealthKit/WebView here.

import SwiftUI
import IronPathDomain
import IronPathDataHealth
import IronPathPersistence
import IronPathTrainingDecision

/// Thin @MainActor view-model for the 今日 surface's REAL canonical-AppData read.
/// It owns ONLY the wiring + IO seam (master §5/§15): it opts the running app into
/// the sanctioned canonical store and delegates the AppData → clean view → engine →
/// summary transform to the pure `resolveTodayReadinessState`. It NEVER touches
/// FileManager directly (the store does all disk IO), NEVER writes, and surfaces an
/// honest state for every failure — no crash, no fabricated readiness, no overwrite.
@MainActor
final class TodayRealDataModel: ObservableObject {
    @Published private(set) var state: TodayReadinessState

    /// The sanctioned canonical store (the §8 source of truth). Optional so
    /// previews/tests opt OUT of disk entirely; the running app injects the
    /// Application Support store on launch. All disk IO is delegated to the store.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()`
    /// in previews/tests).
    private let now: () -> Date
    /// True for the running app (live loading enabled); false for pinned previews.
    private let isLive: Bool

    /// Live initializer (the running app): honest `.empty` until `reload()` reads the
    /// canonical store, which is opted in on launch via `activateLiveSourceIfNeeded()`.
    init(now: @escaping () -> Date = { Date() }) {
        self.state = .empty
        self.store = nil
        self.now = now
        self.isLive = true
    }

    /// Preview/test initializer: pins a fixed state and disables live loading, so a
    /// preview renders a chosen state without ever reading the real on-disk document.
    init(previewState: TodayReadinessState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews (keeps live sinks off).
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the
    /// `CanonicalSessionWriter` writes (Application Support / `IronPathAppData`),
    /// pointing the read path at the real source of truth. Idempotent; `#if os(iOS)`
    /// + the live guard keep previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → engine →
    /// summary (in `resolveTodayReadinessState`). NEVER writes, NEVER overwrites an
    /// unreadable document, NEVER crashes — every failure becomes an honest state.
    /// A SINGLE `instant` drives both the clean view's guard clock and the engine's
    /// reference time, so the read is internally consistent.
    func reload() {
        guard isLive else { return }
        let instant = now()
        state = resolveTodayReadinessState(readOutcome(now: instant), now: instant)
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint — the
    /// TrainingDecision package may not build the clean view itself, so the app layer
    /// does it here, mirroring `FocusModePreviewData`). Reads the canonical store and,
    /// on success, routes the document through `buildCleanAppDataView` with a guard
    /// clock built from `now`. No write: a missing file (or no live source) →
    /// `.missing`; a present-but-unreadable document → `.unreadable` (left untouched on
    /// disk, never overwritten — raw AppData never reaches the engine).
    private func readOutcome(now: Date) -> TodayAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }
}

/// Thin @MainActor view-model for the 今日 surface's READ-ONLY 训练洞察 (insights)
/// block (AN-7). Same shape + IO seam as `TodayRealDataModel`: it opts the running app
/// into the SAME sanctioned canonical store, loads it READ-ONLY, builds the DataHealth
/// clean view (the §10 chokepoint), and delegates the clean-view → analytics →
/// `TrainingInsightsSummary` transform to the pure `resolveTrainingInsightsState`. It
/// NEVER touches FileManager directly, NEVER writes, and surfaces an honest state for
/// every failure. Kept SEPARATE from the readiness model so the insights block is a
/// pure, isolated addition — the existing readiness path is untouched.
@MainActor
final class TrainingInsightsModel: ObservableObject {
    @Published private(set) var state: TrainingInsightsState

    /// The sanctioned canonical store (the §8 source of truth), read-only. Optional so
    /// previews/tests opt OUT of disk entirely; the running app injects it on appear.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()`).
    private let now: () -> Date
    /// True for the running app (live loading enabled); false for pinned previews.
    private let isLive: Bool

    /// Live initializer (the running app): honest `.empty` until `reload()` reads the
    /// canonical store, opted in on appear via `activateLiveSourceIfNeeded()`.
    init(now: @escaping () -> Date = { Date() }) {
        self.state = .empty
        self.store = nil
        self.now = now
        self.isLive = true
    }

    /// Preview/test initializer: pins a fixed state and disables live loading, so a
    /// preview renders a chosen state without ever reading the real on-disk document.
    init(previewState: TrainingInsightsState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the write path uses
    /// (Application Support / `IronPathAppData`). Idempotent; `#if os(iOS)` + the live
    /// guard keep previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → analytics engines
    /// → insights summary (in `resolveTrainingInsightsState`). NEVER writes, NEVER
    /// overwrites an unreadable document, NEVER crashes — every failure → honest state.
    /// A SINGLE `instant` drives both the clean view's guard clock and the engines'
    /// reference time, so the read is internally consistent.
    func reload() {
        guard isLive else { return }
        let instant = now()
        state = resolveTrainingInsightsState(readOutcome(now: instant), now: instant)
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint the app
    /// layer performs, mirroring `TodayRealDataModel`). No write: a missing file (or no
    /// live source) → `.missing`; a present-but-unreadable document → `.unreadable`
    /// (left untouched on disk, never overwritten — raw AppData never reaches the
    /// engines).
    private func readOutcome(now: Date) -> InsightsAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }
}

/// Thin @MainActor view-model for the 今日 surface's READ-ONLY 下次训练/恢复 (scheduling)
/// block (SC-D). Same shape + IO seam as `TrainingInsightsModel`: it opts the running app
/// into the SAME sanctioned canonical store, loads it READ-ONLY, builds the DataHealth clean
/// view (the §10 chokepoint), and delegates the clean-view → schedulers →
/// `NextWorkoutScheduleSummary` transform to the pure `resolveNextWorkoutScheduleState`. It
/// NEVER touches FileManager directly, NEVER writes, and surfaces an honest state for every
/// failure. Kept SEPARATE from the readiness / insights models so the scheduling block is a
/// pure, isolated addition — the existing read paths are untouched.
@MainActor
final class NextWorkoutScheduleModel: ObservableObject {
    @Published private(set) var state: NextWorkoutScheduleState

    /// The sanctioned canonical store (the §8 source of truth), read-only. Optional so
    /// previews/tests opt OUT of disk entirely; the running app injects it on appear.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()`).
    private let now: () -> Date
    /// True for the running app (live loading enabled); false for pinned previews.
    private let isLive: Bool

    /// Live initializer (the running app): honest `.empty` until `reload()` reads the
    /// canonical store, opted in on appear via `activateLiveSourceIfNeeded()`.
    init(now: @escaping () -> Date = { Date() }) {
        self.state = .empty
        self.store = nil
        self.now = now
        self.isLive = true
    }

    /// Preview/test initializer: pins a fixed state and disables live loading, so a preview
    /// renders a chosen state without ever reading the real on-disk document.
    init(previewState: NextWorkoutScheduleState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the write path uses
    /// (Application Support / `IronPathAppData`). Idempotent; `#if os(iOS)` + the live guard
    /// keep previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → schedulers → schedule
    /// summary (in `resolveNextWorkoutScheduleState`). NEVER writes, NEVER overwrites an
    /// unreadable document, NEVER crashes — every failure → honest state. A SINGLE `instant`
    /// drives both the clean view's guard clock and the schedulers' reference time, so the
    /// read is internally consistent.
    func reload() {
        guard isLive else { return }
        let instant = now()
        state = resolveNextWorkoutScheduleState(readOutcome(now: instant), now: instant)
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint the app layer
    /// performs, mirroring `TrainingInsightsModel`). No write: a missing file (or no live
    /// source) → `.missing`; a present-but-unreadable document → `.unreadable` (left untouched
    /// on disk, never overwritten — raw AppData never reaches the schedulers).
    private func readOutcome(now: Date) -> NextWorkoutAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }
}

/// The honest outcome of a CC-5 gated dismiss write (mirrors `FocusModeMvpState.LoggedSetEditOutcome`).
enum CoachActionDismissOutcome: Equatable {
    /// The dismiss intent was persisted through a real, gated, atomic write.
    case dismissed
    /// Canonical persistence was unavailable, or the write/validation failed — never a fake success.
    case failed(String)
}

/// Thin @MainActor view-model for the 今日 surface's 教练建议 (coach action) block: CC-4 READ + CC-5
/// dismiss WRITE. Same shape + IO seam as `TrainingInsightsModel` / `NextWorkoutScheduleModel`: it opts
/// the running app into the SAME sanctioned canonical store, loads it READ-ONLY, builds the DataHealth
/// clean view (the §10 chokepoint), and delegates the clean-view → coach-action engine →
/// `CoachActionSurfaceSummary` transform to the pure `resolveCoachActionState`. It NEVER touches
/// FileManager directly and surfaces an honest state for every failure. Kept SEPARATE from the other
/// read models so the coach-action block is an isolated addition — the existing read paths are untouched.
///
/// CC-5 adds the coach-action capstone's ONE source-truth WRITE: `dismissCoachAction` records the user's
/// intent to "暂不处理" through the SAME sanctioned `CanonicalSessionWriter` gated path the edits use (§8
/// rule 4: NOT a second write path), with the SAME defensive `processIncomingAppData` → clean-view gate
/// (never raw AppData, #448). It persists ONLY the user intent `{ actionId, dismissedAt, scope }` (input,
/// NOT output, §11) — never an engine result; `dismissedAt` is the INJECTED civil day (no wall clock,
/// §11.2). Read-side hiding of dismissed actions is the later CC-6 read-filter.
@MainActor
final class CoachActionSurfaceModel: ObservableObject {
    @Published private(set) var state: CoachActionSurfaceState

    /// The sanctioned canonical store (the §8 source of truth), read-only. Optional so previews/tests
    /// opt OUT of disk entirely; the running app injects it on appear.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()`).
    private let now: () -> Date
    /// True for the running app (live loading enabled); false for pinned previews.
    private let isLive: Bool

    /// Live initializer (the running app): honest `.empty` until `reload()` reads the canonical store,
    /// opted in on appear via `activateLiveSourceIfNeeded()`.
    init(now: @escaping () -> Date = { Date() }) {
        self.state = .empty
        self.store = nil
        self.now = now
        self.isLive = true
    }

    /// Preview/test initializer: pins a fixed state and disables live loading, so a preview renders a
    /// chosen state without ever reading the real on-disk document.
    init(previewState: CoachActionSurfaceState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the write path uses (Application
    /// Support / `IronPathAppData`). Idempotent; `#if os(iOS)` + the live guard keep previews/tests off
    /// disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → coach-action engine → coach-action
    /// summary (in `resolveCoachActionState`). NEVER writes, NEVER overwrites an unreadable document,
    /// NEVER crashes — every failure → honest state. A SINGLE `instant` drives both the clean view's
    /// guard clock and the engine's reference time (the §11.2 injected nowIso), so the read is internally
    /// consistent.
    func reload() {
        guard isLive else { return }
        let instant = now()
        state = resolveCoachActionState(readOutcome(now: instant), now: instant)
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint the app layer performs,
    /// mirroring `TrainingInsightsModel`). No write: a missing file (or no live source) → `.missing`; a
    /// present-but-unreadable document → `.unreadable` (left untouched on disk, never overwritten — raw
    /// AppData never reaches the engine).
    private func readOutcome(now: Date) -> CoachActionAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }

    // MARK: - CC-5 dismiss WRITE (coach-action capstone; same gated path as the edits)

    /// CC-5: record the user's intent to dismiss coach action `actionId` for today ("暂不处理") and
    /// persist it through the SAME sanctioned canonical-AppData write path the edits use (§8 rule 4:
    /// NOT a second write path), via `CanonicalSessionWriter.dismissCoachAction`. The dismissed value
    /// is the user's OWN intent `{ actionId, dismissedAt, scope }` (input, NOT output, §11) — this
    /// never writes a coach-action engine result, the `mesocyclePlan` weeks blob, or any computed field.
    ///
    /// `today` is the LOCAL civil calendar day derived from the INJECTED clock (never a bare `Date()`)
    /// — the mirror of `todayKey()` / `toLocalDateKey()` (engineUtils.ts:30). The write path itself
    /// reads no clock; it receives the string (§11.2 / red-line #4).
    ///
    /// Honest result: `.failed(_)` when canonical persistence is not opted in (previews/tests) OR on any
    /// thrown write/validation error (never a fake success); `.dismissed` only after a real, gated,
    /// atomic write. The injected DataHealth gate re-validates — against the FRESHLY-LOADED on-disk
    /// document, routed through the SAME read-only `processIncomingAppData` → clean view (never raw
    /// AppData, #448) — that the dismissed intent landed in the effective dismissed list before the
    /// write commits; a rejected candidate is never written. The on-disk document is left intact on
    /// failure (backup-before-overwrite / atomic save).
    func dismissCoachAction(actionId: String) -> CoachActionDismissOutcome {
        guard isLive, let store else {
            // Canonical persistence not opted in (previews/tests) — honest failure, never a fake success.
            return .failed("没有可写入的本机存储")
        }
        // `today` injected from the model's clock (no bare `Date()`): the LOCAL civil day, mirroring
        // engineUtils.ts todayKey() / toLocalDateKey() — `local.toISOString().slice(0,10)`.
        let today = Self.civilDayKey(now())
        let writer = CanonicalSessionWriter(store: store)
        do {
            try writer.dismissCoachAction(actionId: actionId, today: today) { candidate in
                // Defensive DataHealth gate (§10): re-run the candidate through the SAME sanctioned,
                // read-only DataHealth ingress the edits use (`processIncomingAppData` → its `cleanView`),
                // never raw AppData (#448). Accept ONLY when the dismissed intent landed in the
                // candidate's effective dismissed list (read priority root||settings). No fake success.
                guard let result = try? processIncomingAppData(
                    appData: candidate,
                    source: .postSessionComplete,
                    options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
                ) else { return false }
                return Self.dismissLanded(result.cleanView.raw, actionId: actionId, today: today)
            }
            // Re-read the persisted document so the surface reflects the write (read-side hiding of a
            // dismissed action is the later CC-6 read-filter; this slice persists + confirms via toast).
            reload()
            return .dismissed
        } catch {
            return .failed(Self.dismissErrorMessage(error))
        }
    }

    /// True when `raw`'s effective dismissed list (read priority `root || settings`,
    /// enginePipeline.ts:102) contains an entry for `actionId` dismissed `'today'` on `today`'s civil
    /// day. Reads `cleanView.raw` — which is the candidate VERBATIM (the clean view never mutates raw),
    /// so this confirms exactly what the gated save will commit.
    private static func dismissLanded(_ raw: AppData, actionId: String, today: String) -> Bool {
        let effective: [JSONValue] =
            raw.root["dismissedCoachActions"]?.arrayValue
            ?? raw.settings.dismissedCoachActions?.arrayValue
            ?? []
        return effective.contains { item in
            guard let obj = item.objectValue else { return false }
            return obj["scope"]?.stringValue == "today"
                && obj["actionId"]?.stringValue == actionId
                && String((obj["dismissedAt"]?.stringValue ?? "").prefix(10)) == today
        }
    }

    /// The LOCAL civil calendar day `YYYY-MM-DD` for `date` — the Swift mirror of `todayKey()` /
    /// `toLocalDateKey()` (engineUtils.ts:30, `local.toISOString().slice(0,10)`). Derived from the
    /// INJECTED clock; the write path itself reads no clock (§11.2 / red-line #4).
    private static func civilDayKey(_ date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Map a canonical write failure to an honest, user-facing Chinese message. Unknown errors fall
    /// back to their `localizedDescription` — never a fabricated success.
    private static func dismissErrorMessage(_ error: Error) -> String {
        if let writeError = error as? CanonicalSessionWriteError {
            switch writeError {
            case .existingDocumentUnreadable:
                return "本机数据无法读取，未改动（不会覆盖无法解析的数据）"
            case .validationRejected:
                return "操作未通过本机数据校验，未保存"
            case .backupFailed:
                return "备份失败，未保存（原数据保持不变）"
            case .saveFailed:
                return "写入失败，未保存（原数据保持不变）"
            }
        }
        return error.localizedDescription
    }
}

struct TodayRootView: View {
    @StateObject private var model: TodayRealDataModel

    /// READ-ONLY 训练洞察 (AN-7). A second, isolated @StateObject (the `widgetWriter`
    /// precedent) so the insights block adds nothing to the existing readiness path.
    @StateObject private var insights: TrainingInsightsModel

    /// READ-ONLY 下次训练/恢复 (SC-D). A third, isolated @StateObject so the scheduling block
    /// adds nothing to the existing readiness / insights paths.
    @StateObject private var schedule: NextWorkoutScheduleModel

    /// READ-ONLY 教练建议 (CC-4). A fourth, isolated @StateObject so the coach-action block adds
    /// nothing to the existing readiness / insights / scheduling paths.
    @StateObject private var coach: CoachActionSurfaceModel

    @State private var showTrainingEntry = false

    /// CC-5: the honest result of a gated dismiss write, surfaced as a confirmation/error notice
    /// (the toast mirror of the legacy web app `showAppToast`). Non-nil drives the notice alert below.
    @State private var dismissNoticeText: String?

    // W-1: publishes a small DERIVED read-only readiness snapshot to the App Group
    // for the home-screen widget. It just packs the already-computed `summary`
    // strings — no engine call, and it NEVER writes canonical AppData.
    @StateObject private var widgetWriter = WidgetSnapshotWriterModel()

    /// The running app constructs the default live model. `@MainActor` so it can
    /// build the main-actor-isolated model (SwiftUI always builds views on the main
    /// actor); a default-argument form is impossible because default args are
    /// type-checked as nonisolated.
    @MainActor init() {
        _model = StateObject(wrappedValue: TodayRealDataModel())
        _insights = StateObject(wrappedValue: TrainingInsightsModel())
        _schedule = StateObject(wrappedValue: NextWorkoutScheduleModel())
        _coach = StateObject(wrappedValue: CoachActionSurfaceModel())
    }

    /// Previews/tests inject a pinned readiness model (e.g.
    /// `TodayRealDataModel(previewState:)`). The insights + scheduling blocks default to an
    /// honest pinned-empty (no disk) so existing readiness previews keep their call site; an
    /// insights/scheduling-specific preview uses `init(model:insights:schedule:)` below.
    @MainActor init(model: TodayRealDataModel) {
        _model = StateObject(wrappedValue: model)
        _insights = StateObject(wrappedValue: TrainingInsightsModel(previewState: .empty))
        _schedule = StateObject(wrappedValue: NextWorkoutScheduleModel(previewState: .empty))
        _coach = StateObject(wrappedValue: CoachActionSurfaceModel(previewState: .empty))
    }

    /// Previews/tests inject pinned readiness + insights models. The scheduling block
    /// defaults to an honest pinned-empty (no disk) so existing insights previews keep their
    /// call site; a scheduling-specific preview uses `init(model:insights:schedule:)` below.
    /// (Built in the @MainActor body, not a default argument — default args are type-checked
    /// as nonisolated, which cannot build the main-actor-isolated model.)
    @MainActor init(model: TodayRealDataModel, insights: TrainingInsightsModel) {
        _model = StateObject(wrappedValue: model)
        _insights = StateObject(wrappedValue: insights)
        _schedule = StateObject(wrappedValue: NextWorkoutScheduleModel(previewState: .empty))
        _coach = StateObject(wrappedValue: CoachActionSurfaceModel(previewState: .empty))
    }

    /// Previews/tests inject pinned readiness + insights + scheduling models (all off-disk). The
    /// coach-action block defaults to an honest pinned-empty; a coach-specific preview uses
    /// `init(model:insights:schedule:coach:)` below.
    @MainActor init(
        model: TodayRealDataModel,
        insights: TrainingInsightsModel,
        schedule: NextWorkoutScheduleModel
    ) {
        _model = StateObject(wrappedValue: model)
        _insights = StateObject(wrappedValue: insights)
        _schedule = StateObject(wrappedValue: schedule)
        _coach = StateObject(wrappedValue: CoachActionSurfaceModel(previewState: .empty))
    }

    /// Previews/tests inject pinned readiness + insights + scheduling + coach-action models (all off-disk).
    @MainActor init(
        model: TodayRealDataModel,
        insights: TrainingInsightsModel,
        schedule: NextWorkoutScheduleModel,
        coach: CoachActionSurfaceModel
    ) {
        _model = StateObject(wrappedValue: model)
        _insights = StateObject(wrappedValue: insights)
        _schedule = StateObject(wrappedValue: schedule)
        _coach = StateObject(wrappedValue: coach)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                content
                scheduleSection
                insightsSection
                coachActionSection
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        // Honest, self-contained disclosure — no fake tab switch, no data write.
        .alert("前往「训练」", isPresented: $showTrainingEntry) {
            Button("好", role: .cancel) {}
        } message: {
            Text("在底部导航栏点按「训练」即可进入专注训练。今日页为只读概览，不读写训练记录。")
        }
        // CC-5: honest confirmation / failure of the gated dismiss write (the toast mirror).
        .alert(
            "教练建议",
            isPresented: Binding(
                get: { dismissNoticeText != nil },
                set: { if !$0 { dismissNoticeText = nil } }
            )
        ) {
            Button("好", role: .cancel) { dismissNoticeText = nil }
        } message: {
            Text(dismissNoticeText ?? "")
        }
        .task {
            // Opt the running app into the real canonical store and read it (read-only).
            model.activateLiveSourceIfNeeded()
            model.reload()
            // AN-7: the 训练洞察 block reads the SAME canonical store read-only and
            // computes its summary from the DataHealth clean view (§10/§11). Guarded by
            // its own live flag, so previews/tests stay off disk.
            insights.activateLiveSourceIfNeeded()
            insights.reload()
            // SC-D: the 下次训练/恢复 block reads the SAME canonical store read-only and
            // computes its summary from the DataHealth clean view (§10/§11). Guarded by its
            // own live flag, so previews/tests stay off disk.
            schedule.activateLiveSourceIfNeeded()
            schedule.reload()
            // CC-4: the 教练建议 block reads the SAME canonical store read-only and computes its
            // coach actions from the DataHealth clean view (§10/§11), injecting the §11.2 nowIso.
            // Guarded by its own live flag, so previews/tests stay off disk. CC-5: the same model
            // also opts into the SAME store for the gated dismiss WRITE (user taps "暂不处理").
            coach.activateLiveSourceIfNeeded()
            coach.reload()
            // Previews/tests pin their state and never touch the live App Group sink.
            guard model.isLiveLoadEnabled else { return }
            // W-1/W-2: publish a DERIVED read-only readiness snapshot for the widget
            // (App Group) ONLY when we have a REAL readiness (§8/§12). On empty /
            // unavailable we publish nothing — the widget keeps its prior snapshot /
            // placeholder, never a fabricated readiness. This writes a small derived
            // share file ONLY — never canonical AppData, never a source of truth.
            widgetWriter.activateLiveSinksIfNeeded()
            if case .ready(let summary) = model.state {
                widgetWriter.publish(
                    headline: summary.headline,
                    advice: summary.advice,
                    rows: summary.decisionRows.map { ($0.label, $0.value) }
                )
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("今日")
                .font(.largeTitle.weight(.semibold))
            if case .ready(let summary) = model.state {
                Text(summary.headline)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.primary)
                Text(summary.advice)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .ready(let summary):
            realDataNote
            card(title: "准备度概览", rows: summary.decisionRows)
            card(title: "今日状态", rows: summary.statusRows)
            startTrainingButton
        case .empty:
            // §15.4: empty state = title + explanation + one action. Honest "no data",
            // never a fabricated readiness.
            infoCard(
                title: "还没有训练数据",
                message: "完成一次训练并保存后，这里会根据你本机的真实记录显示今日准备度。",
                actionTitle: "前往「训练」",
                action: { showTrainingEntry = true }
            )
        case .unavailable:
            // §15.4 + data safety: honest degrade. The document is left untouched —
            // this read path never overwrites unreadable data — and the user can retry.
            infoCard(
                title: "暂时无法读取数据",
                message: "本机训练数据暂时无法读取。已保留原始数据未作任何改动，可稍后重试。",
                actionTitle: "重试",
                action: { model.reload() }
            )
        }
    }

    private var realDataNote: some View {
        Text("基于你本机的真实训练数据，经数据校验（DataHealth）后由训练决策引擎计算。")
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var startTrainingButton: some View {
        Button {
            showTrainingEntry = true
        } label: {
            Text("开始今天的训练")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.borderedProminent)
        .padding(.top, 4)
    }

    private func card(title: String, rows: [SurfaceRow]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            VStack(spacing: 6) {
                ForEach(rows) { row in
                    HStack(alignment: .firstTextBaseline) {
                        Text(row.label)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(row.value)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    // MARK: - SC-D 下次训练/恢复 (read-only scheduling surface)

    /// The READ-ONLY 下次训练/恢复 block. Renders the SC-C `buildNextWorkoutRecommendation`
    /// output + its nested SC-A recovery recommendation the pure
    /// `resolveNextWorkoutScheduleState` produced from the DataHealth clean view (§10/§11).
    /// On `.empty` / `.unavailable` it renders nothing — the readiness `content` above already
    /// shows the honest no-data / degrade state for the same canonical store, so a second one
    /// here would be redundant.
    @ViewBuilder
    private var scheduleSection: some View {
        if case .ready(let summary) = schedule.state {
            scheduleContent(summary)
        }
    }

    private func scheduleContent(_ summary: NextWorkoutScheduleSummary) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("下次训练")
                .font(.title3.weight(.semibold))
            Text("基于你本机的真实训练记录（经 DataHealth 数据校验后只读派生），由调度引擎计算。本区只读展示，不修改任何已保存的数据或计划。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            nextWorkoutCard(summary)
            if let recovery = summary.recovery {
                recoveryCard(recovery)
            }
        }
    }

    /// 下次训练 — the recommended day headline + kind, the at-a-glance rows, the engine's
    /// reason, any override explanation, warnings, and alternatives.
    private func nextWorkoutCard(_ summary: NextWorkoutScheduleSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(summary.headline).font(.headline)
                Spacer()
                Text(summary.kindLabel)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            rowStack(summary.scheduleRows)
            Text(summary.reason)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let override = summary.overrideReason, !override.isEmpty {
                Text(override)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if !summary.warnings.isEmpty {
                Text("注意事项")
                    .font(.subheadline.weight(.medium))
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(summary.warnings.enumerated()), id: \.offset) { _, warning in
                        bulletLine(warning)
                    }
                }
            }
            if !summary.alternatives.isEmpty {
                Text("备选训练日")
                    .font(.subheadline.weight(.medium))
                    .padding(.top, 2)
                rowStack(summary.alternatives)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    /// 恢复感知推荐 — the nested recovery recommendation's title/summary + kind/conflict rows +
    /// affected areas + reasons.
    private func recoveryCard(_ recovery: NextWorkoutScheduleSummary.RecoverySection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("恢复感知推荐").font(.headline)
            Text(recovery.title)
                .font(.subheadline.weight(.medium))
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(recovery.summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            rowStack([
                SurfaceRow(id: "recovery-kind", label: "恢复建议", value: recovery.kindLabel),
                SurfaceRow(id: "recovery-conflict", label: "恢复冲突", value: recovery.conflictLabel),
            ])
            if !recovery.affectedAreas.isEmpty {
                rowStack([
                    SurfaceRow(id: "recovery-areas", label: "相关部位", value: recovery.affectedAreas.joined(separator: "、")),
                ])
            }
            if !recovery.reasons.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(recovery.reasons.enumerated()), id: \.offset) { _, reason in
                        bulletLine(reason)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    // MARK: - AN-7 训练洞察 (read-only analytics surface)

    /// The READ-ONLY 训练洞察 block. Renders the AN-1…6 analytics outputs the pure
    /// `resolveTrainingInsightsState` produced from the DataHealth clean view (§10/§11).
    /// On `.empty` / `.unavailable` it renders nothing — the readiness `content` above
    /// already shows the honest no-data / degrade state for the same canonical store,
    /// so a second one here would be redundant.
    @ViewBuilder
    private var insightsSection: some View {
        if case .ready(let summary) = insights.state {
            insightsContent(summary)
        }
    }

    private func insightsContent(_ summary: TrainingInsightsSummary) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("训练洞察")
                .font(.title3.weight(.semibold))
            Text("基于你本机的真实训练记录（经 DataHealth 数据校验后只读派生），由分析引擎计算。本区只读展示，不修改任何已保存的数据。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            insightCard(title: "连续打卡", rows: summary.streakRows, emptyText: "数据不足")
            insightCard(title: "近期 PR", rows: summary.prRows, emptyText: "近期窗口内暂无新的个人纪录。")
            insightCard(title: "趋势", rows: summary.trendRows, emptyText: "核心动作暂无足够数据生成趋势。")
            muscleInsightCard(summary)
            intelligenceCard(summary)
        }
    }

    /// A titled card of labeled rows, or an honest one-line placeholder when empty.
    private func insightCard(title: String, rows: [SurfaceRow], emptyText: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            if rows.isEmpty {
                Text(emptyText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                rowStack(rows)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    /// 肌群平衡 — the engine headline (over/under-worked summary) above the score /
    /// effective-set / per-muscle rows.
    private func muscleInsightCard(_ summary: TrainingInsightsSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("肌群平衡").font(.headline)
            Text(summary.muscleHeadline)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            rowStack(summary.muscleRows)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    /// 智能摘要 — key insights (always ≥1), flagged plateaus, and recommended actions.
    private func intelligenceCard(_ summary: TrainingInsightsSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("智能摘要").font(.headline)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(summary.keyInsights.enumerated()), id: \.offset) { _, insight in
                    bulletLine(insight)
                }
            }
            if !summary.plateauRows.isEmpty {
                Text("平台期信号")
                    .font(.subheadline.weight(.medium))
                    .padding(.top, 2)
                rowStack(summary.plateauRows)
            }
            if !summary.recommendedActions.isEmpty {
                Text("建议下一步")
                    .font(.subheadline.weight(.medium))
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(summary.recommendedActions.enumerated()), id: \.offset) { _, action in
                        bulletLine(action)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    // MARK: - CC-4 教练建议 (read-only coach-action surface)

    /// The READ-ONLY 教练建议 block. Renders the `CoachActionEngine.buildCoachActions` output the pure
    /// `resolveCoachActionState` produced from the DataHealth clean view (§10/§11), mirrored from the legacy web app
    /// CoachActionCard / CoachActionList. On `.empty` / `.unavailable` it renders nothing — the readiness
    /// `content` above already shows the honest no-data / degrade state for the same canonical store.
    @ViewBuilder
    private var coachActionSection: some View {
        if case .ready(let summary) = coach.state {
            coachActionContent(summary)
        }
    }

    private func coachActionContent(_ summary: CoachActionSurfaceSummary) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(summary.title)
                .font(.title3.weight(.semibold))
            Text(summary.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("基于你本机的真实训练记录（经 DataHealth 数据校验后只读派生），由教练动作引擎计算。本区只读展示，不修改任何已保存的数据或计划。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            if summary.actions.isEmpty {
                Text(summary.emptyText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(.secondarySystemBackground))
                    )
            } else {
                ForEach(summary.actions) { row in
                    coachActionCard(row)
                }
            }
        }
    }

    /// A single coach-action card mirroring the legacy web app `CoachActionCard`: title + source, the
    /// priority/status badges, the description, the 需要确认/只查看 (+ 可撤销) line, an optional disabled
    /// reason, the read-only primary entry label, and the "暂不处理" dismiss button — CC-5 wires it to
    /// the SAME sanctioned gated dismiss write, surfacing the honest result via `dismissNoticeText`.
    private func coachActionCard(_ row: CoachActionSurfaceSummary.ActionRow) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(row.title)
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(row.sourceLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 8) {
                coachTag(row.priorityLabel)
                coachTag(row.statusLabel)
            }
            Text(row.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 8) {
                coachTag(row.confirmationLabel)
                if let reversible = row.reversibleLabel {
                    coachTag(reversible)
                }
            }
            if let disabled = row.disabledReason {
                Text(disabled)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            // The primary entry is a read-only label (no cross-tab navigation in this slice); the
            // "暂不处理" control is now an ACTIVE button — CC-5 persists the dismiss through the
            // sanctioned gated write and surfaces the honest result (success toast or failure).
            HStack(spacing: 8) {
                Text(row.primaryLabel)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
                Button(row.secondaryLabel) {
                    switch coach.dismissCoachAction(actionId: row.id) {
                    case .dismissed:
                        dismissNoticeText = "已暂不处理，今天不再提醒。"
                    case .failed(let message):
                        dismissNoticeText = message
                    }
                }
                .font(.subheadline.weight(.medium))
                .buttonStyle(.borderless)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    /// A small read-only pill tag (mirrors the legacy web app StatusBadge; the read-only surface does not color
    /// by tone — the label text carries the meaning).
    private func coachTag(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                Capsule().fill(Color(.tertiarySystemBackground))
            )
    }

    /// Shared label/value row stack (mirrors `card(rows:)`).
    private func rowStack(_ rows: [SurfaceRow]) -> some View {
        VStack(spacing: 6) {
            ForEach(rows) { row in
                HStack(alignment: .firstTextBaseline) {
                    Text(row.label)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(row.value)
                        .font(.subheadline)
                        .foregroundStyle(.primary)
                }
            }
        }
    }

    /// A small leading-bullet line for free-text insight / action strings.
    private func bulletLine(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text("·").font(.subheadline).foregroundStyle(.secondary)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func infoCard(
        title: String,
        message: String,
        actionTitle: String,
        action: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button(action: action) {
                Text(actionTitle)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 2)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }
}

#Preview("有数据") {
    TodayRootView(model: TodayRealDataModel(previewState: .ready(
        TodayReadinessSummary(
            slice: FocusModePreviewData.sampleCoreSlice(for: .normal),
            todayStatus: TodayStatus(
                date: FocusModePreviewData.referenceDateOnly,
                sleep: "一般",
                energy: "中",
                time: "60",
                soreness: ["无"]
            )
        )
    )))
}

#Preview("空态") {
    TodayRootView(model: TodayRealDataModel(previewState: .empty))
}

#Preview("不可读") {
    TodayRootView(model: TodayRealDataModel(previewState: .unavailable))
}

#Preview("含洞察") {
    TodayRootView(
        model: TodayRealDataModel(previewState: .ready(
            TodayReadinessSummary(
                slice: FocusModePreviewData.sampleCoreSlice(for: .normal),
                todayStatus: TodayStatus(
                    date: FocusModePreviewData.referenceDateOnly,
                    sleep: "一般",
                    energy: "中",
                    time: "60",
                    soreness: ["无"]
                )
            )
        )),
        insights: TrainingInsightsModel(previewState: .ready(TodayInsightsPreviewData.summary))
    )
}

/// Deterministic preview-only sample for the 训练洞察 block. NOT canonical AppData and
/// never written to disk — it only feeds the SwiftUI preview so it renders without a
/// device store. Built through the GENUINE public summary init (the same path the live
/// resolver uses), so the preview reflects real engine output. The synthetic bench-press
/// history rises weekly so PR / trend populate honestly.
private enum TodayInsightsPreviewData {
    private static func benchSession(id: String, date: String, weight: Int64) -> TrainingSession {
        TrainingSession(
            id: id,
            date: date,
            finishedAt: "\(date)T10:00:00.000Z",
            completed: true,
            focusSessionComplete: true,
            exercises: [
                ExercisePrescription(
                    id: "bench-press",
                    exerciseId: "bench-press",
                    name: "平板卧推",
                    sets: [
                        TrainingSetLog(setIndex: .integer(0), weight: .integer(weight), reps: .integer(6), techniqueQuality: "good", done: true),
                        TrainingSetLog(setIndex: .integer(1), weight: .integer(weight), reps: .integer(6), techniqueQuality: "good", done: true),
                        TrainingSetLog(setIndex: .integer(2), weight: .integer(weight), reps: .integer(6), techniqueQuality: "good", done: true),
                    ]
                ),
            ]
        )
    }

    /// Oldest-first (canonical order); the summary init reverses it internally.
    static let summary = TrainingInsightsSummary(
        cleanedHistory: [
            benchSession(id: "bp-1", date: "2026-05-13", weight: 60),
            benchSession(id: "bp-2", date: "2026-05-20", weight: 64),
            benchSession(id: "bp-3", date: "2026-05-27", weight: 68),
            benchSession(id: "bp-4", date: "2026-06-02", weight: 72),
        ],
        nowIso: "2026-06-03T10:00:00.000Z"
    )
}

#Preview("含下次训练") {
    TodayRootView(
        model: TodayRealDataModel(previewState: .ready(
            TodayReadinessSummary(
                slice: FocusModePreviewData.sampleCoreSlice(for: .normal),
                todayStatus: TodayStatus(
                    date: FocusModePreviewData.referenceDateOnly,
                    sleep: "一般",
                    energy: "中",
                    time: "60",
                    soreness: ["无"]
                )
            )
        )),
        insights: TrainingInsightsModel(previewState: .empty),
        schedule: NextWorkoutScheduleModel(previewState: .ready(TodaySchedulePreviewData.summary))
    )
}

/// Deterministic preview-only sample for the 下次训练/恢复 block. NOT canonical AppData and
/// never written to disk — it only feeds the SwiftUI preview so it renders without a device
/// store. Built through the GENUINE public summary init (the same path the live resolver uses),
/// so the preview reflects the real scheduler output shape — a 调整后训练 recommendation that
/// overrode the planned push day for a recovery-aware pull day.
private enum TodaySchedulePreviewData {
    static let summary: NextWorkoutScheduleSummary = {
        let recovery = RecoveryAwareScheduler.RecoveryAwareRecommendation(
            kind: .modifiedTrain,
            templateId: "pull-a",
            templateName: "拉力 A",
            title: "今日建议：拉力 A（适度调整）",
            summary: "肩部近期有轻微不适，建议优先安排拉力动作并降低推举类负荷。",
            conflictLevel: .low,
            affectedAreas: ["肩"],
            reasons: ["肩部近 3 天有不适记录", "推举类动作与该部位冲突，建议本次减量执行"],
            suggestedChanges: [],
            templateRecoveryConflict: nil,
            requiresConfirmationToOverride: false
        )
        let recommendation = NextWorkoutScheduler.NextWorkoutRecommendation(
            kind: .modifiedTrain,
            plannedTemplateId: "push-a",
            plannedTemplateName: "推力 A",
            recommendedTemplateId: "pull-a",
            overrideReason: "原计划下次是 推力 A，但近期肩部不适与该训练日冲突，因此当前建议改为 拉力 A。",
            templateId: "pull-a",
            templateName: "拉力 A",
            confidence: .medium,
            reason: "按计划轮转判断：已完成上一轮推力日，下一日为拉力 A。结合近期恢复信号做了适度调整。",
            warnings: ["肩部近期有不适记录，建议避免直接安排高风险训练日。"],
            conflictLevel: .low,
            recovery: recovery,
            alternatives: [
                NextWorkoutScheduler.NextWorkoutRecommendation.Alternative(
                    templateId: "legs-a",
                    templateName: "腿部 A",
                    reason: "作为备选训练日，可在时间、器械或恢复状态变化时手动选择。"
                ),
            ]
        )
        return NextWorkoutScheduleSummary(recommendation: recommendation)
    }()
}

#Preview("含教练动作") {
    TodayRootView(
        model: TodayRealDataModel(previewState: .ready(
            TodayReadinessSummary(
                slice: FocusModePreviewData.sampleCoreSlice(for: .normal),
                todayStatus: TodayStatus(
                    date: FocusModePreviewData.referenceDateOnly,
                    sleep: "一般",
                    energy: "中",
                    time: "60",
                    soreness: ["无"]
                )
            )
        )),
        insights: TrainingInsightsModel(previewState: .empty),
        schedule: NextWorkoutScheduleModel(previewState: .empty),
        coach: CoachActionSurfaceModel(previewState: .ready(TodayCoachActionPreviewData.summary))
    )
}

/// Deterministic preview-only sample for the 教练建议 block. NOT canonical AppData and never written to
/// disk — it only feeds the SwiftUI preview so it renders without a device store. Built through the
/// GENUINE public `CoachActionSurfaceSummary` init over sample coach actions (the same projection the
/// live resolver uses), so the preview reflects the real presentation output — a pending next-workout
/// entry plus a recovery adjustment that requires confirmation.
private enum TodayCoachActionPreviewData {
    static let summary = CoachActionSurfaceSummary(actions: [
        CoachActionEngine.CoachAction(
            id: "next-workout-push-a",
            title: "查看下次训练：推力 A",
            description: "打开下次训练建议详情，确认后再开始。",
            source: "nextWorkout",
            actionType: "open_next_workout",
            priority: "low",
            status: "pending",
            requiresConfirmation: false,
            reversible: false,
            createdAt: "2026-06-03T10:00:00.000Z",
            targetId: "push-a",
            targetType: "template",
            reason: "按计划轮转判断：已完成上一轮拉力日，下一日为推力 A。"
        ),
        CoachActionEngine.CoachAction(
            id: "recovery-modified_train-pull-a",
            title: "采用恢复保守版",
            description: "肩部近期有轻微不适，建议优先安排拉力动作并降低推举类负荷。",
            source: "recovery",
            actionType: "apply_temporary_session_adjustment",
            priority: "high",
            status: "pending",
            requiresConfirmation: true,
            reversible: true,
            createdAt: "2026-06-03T10:00:00.000Z",
            targetId: "pull-a",
            targetType: "template",
            reason: "肩部近 3 天有不适记录，本次建议减量执行。",
            confirmTitle: "采用本次保守训练？",
            confirmDescription: "只影响本次训练，不会修改原模板。"
        ),
    ])
}
