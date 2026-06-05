// FocusModePreviewData — iOS-6 Focus Mode Sample Selector V1.
//
// Deterministic, in-memory sample input that feeds the real
// IronPathTrainingDecision engine entry. No Date(), no IO, no AppData mutation,
// no network, no HealthKit, no CloudSync. Identical inputs every launch ->
// identical TrainingDecisionCoreSlice every launch.
//
// Pipeline mirrors the engine's own clean-input contract:
//   AppData (synthesized) -> buildCleanAppDataView -> createCleanTrainingDecisionInput
//   -> buildTrainingDecisionFromCleanInput -> TrainingDecisionCoreSlice
//
// iOS-6 adds a scenario dimension. Three scenarios drive the same engine
// pipeline with different deterministic inputs:
//   .normal           — recent history (2d / 9d), no acute pain -> base/normal-session.
//   .productiveFloor  — long gap (34d / 20d), no acute pain -> reentry phase,
//                       reentryProductive intent. Compound role floors stay at 2,
//                       so compounds do NOT all collapse to 1 set.
//   .severeRest       — recent history (5d / 2d) + acutePainReported=true ->
//                       severeRest intent. Conservative path; compounds may show 1 set.
//
// FU-1 also makes this file the Focus DATA-PROVIDER layer (NOT just the sample):
// alongside the deterministic `FocusModePreviewData` sample it hosts `FocusModeLiveData`,
// the thin @MainActor view-model that runs the SAME engine pipeline over the user's REAL
// canonical AppData (read-only). The shell (FocusModeShellView) stays a pure presentation
// surface free of any AppData / DataHealth / engine-clean-input token — exactly the
// established Focus boundary (the engine pipeline is invoked HERE, in the data provider, the
// shell only renders the resulting slice). `FocusModePreviewData` itself stays sample-only,
// for previews/tests.

import Foundation
import IronPathDomain
import IronPathDataHealth
import IronPathPersistence
import IronPathTrainingDecision

enum FocusModeSampleScenario: String, CaseIterable, Identifiable {
    case normal
    case productiveFloor
    case severeRest
    case deloadWeek

    var id: String { rawValue }

    var displayLabel: String {
        switch self {
        case .normal: return "普通训练 / Normal"
        case .productiveFloor: return "回归保底 / Productive Floor"
        case .severeRest: return "严重恢复 / Severe Rest"
        case .deloadWeek: return "减载周 / Deload Week"
        }
    }

    var shortLabel: String {
        switch self {
        case .normal: return "普通"
        case .productiveFloor: return "回归保底"
        case .severeRest: return "严重恢复"
        case .deloadWeek: return "减载周"
        }
    }

    var explanation: String {
        switch self {
        case .normal:
            return "普通训练样例"
        case .productiveFloor:
            return "回归/恢复训练下，复合动作仍保留最低有效组数"
        case .severeRest:
            return "严重恢复压力下，1 组保守路径是允许的"
        case .deloadWeek:
            return "显式减载周：explicitDeloadAssigned=true 触发 deload-week 意图"
        }
    }
}

enum FocusModePreviewData {

    static let referenceClockIso = "2026-05-27T10:00:00.000Z"
    static let referenceDateOnly = "2026-05-27"

    private static let utc = TimeZone(identifier: "UTC")!

    private static var utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = utc
        return c
    }()

    private static func dateOnly(daysBefore gap: Int) -> String {
        let parts = referenceDateOnly.split(separator: "-")
        var comps = DateComponents()
        comps.year = Int(parts[0])
        comps.month = Int(parts[1])
        comps.day = Int(parts[2])
        comps.hour = 12
        let base = utcCalendar.date(from: comps)!
        let target = utcCalendar.date(byAdding: .day, value: -gap, to: base)!
        let fmt = DateFormatter()
        fmt.timeZone = utc
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: target)
    }

    private static func pushATemplateExercises() -> [TrainingDecisionTemplateExercise] {
        [
            TrainingDecisionTemplateExercise(id: "bench-press", name: "平板卧推", muscle: "胸", kind: "compound", sets: 3, repMin: 6, repMax: 8),
            TrainingDecisionTemplateExercise(id: "incline-db-press", name: "上斜哑铃卧推", muscle: "胸", kind: "compound", sets: 3, repMin: 8, repMax: 10),
            TrainingDecisionTemplateExercise(id: "machine-chest-press", name: "器械推胸", muscle: "胸", kind: "machine", sets: 2, repMin: 8, repMax: 12),
            TrainingDecisionTemplateExercise(id: "cable-fly", name: "绳索夹胸", muscle: "胸", kind: "isolation", sets: 2, repMin: 12, repMax: 15),
            TrainingDecisionTemplateExercise(id: "lateral-raise", name: "哑铃侧平举", muscle: "肩", kind: "isolation", sets: 4, repMin: 12, repMax: 20),
            TrainingDecisionTemplateExercise(id: "triceps-pushdown", name: "绳索下压", muscle: "手臂", kind: "isolation", sets: 3, repMin: 10, repMax: 15),
        ]
    }

    private static func todayStatusJSON() -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "sleep", value: .string("一般")),
            .init(key: "energy", value: .string("中")),
            .init(key: "soreness", value: .array([.string("无")])),
            .init(key: "time", value: .string("60")),
            .init(key: "date", value: .string(referenceDateOnly)),
        ]))
    }

    private static func sampleSession(id: String, daysBefore gap: Int) -> TrainingSession {
        TrainingSession(id: id, date: dateOnly(daysBefore: gap), completed: true)
    }

    /// Returns the (later, earlier) day-gaps that drive the scenario.
    /// Larger gap => later session more days ago.
    private static func sessionGaps(for scenario: FocusModeSampleScenario) -> (late: Int, early: Int) {
        switch scenario {
        case .normal:          return (late: 2, early: 9)
        case .productiveFloor: return (late: 20, early: 34)
        case .severeRest:      return (late: 2, early: 5)
        case .deloadWeek:      return (late: 2, early: 9)
        }
    }

    private static func sampleAppData(for scenario: FocusModeSampleScenario) -> AppData {
        let gaps = sessionGaps(for: scenario)
        let history: [JSONValue] = [
            sampleSession(id: "td-late", daysBefore: gaps.late).encoded(),
            sampleSession(id: "td-early", daysBefore: gaps.early).encoded(),
        ]
        let entries: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
            .init(key: "history", value: .array(history)),
            .init(key: "todayStatus", value: todayStatusJSON()),
        ]
        return AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
    }

    private static func fixedClock() -> FixedRuntimeGuardClock {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fmt.timeZone = utc
        let date = fmt.date(from: referenceClockIso) ?? Date(timeIntervalSince1970: 0)
        return FixedRuntimeGuardClock(date)
    }

    static func sampleCoreSlice(for scenario: FocusModeSampleScenario) -> TrainingDecisionCoreSlice {
        let cleanView = buildCleanAppDataView(sampleAppData(for: scenario), clock: fixedClock())
        let acutePain: Bool? = (scenario == .severeRest) ? true : nil
        // .deloadWeek is a pure input-shape change (no engine change): the
        // metadata flag flows through sessionIntentFor to produce
        // sessionIntent == .deloadWeek.
        let explicitDeload: Bool? = (scenario == .deloadWeek) ? true : nil
        let input = createCleanTrainingDecisionInput(
            cleanView: cleanView,
            metadata: CleanTrainingDecisionInputMetadata(
                nowIso: referenceClockIso,
                trainingMode: "hybrid",
                acutePainReported: acutePain,
                explicitDeloadAssigned: explicitDeload,
                templateDurationMin: 60,
                templateExercises: pushATemplateExercises()
            )
        )
        return buildTrainingDecisionFromCleanInput(input)
    }

    static func sampleTemplateExercises() -> [TrainingDecisionTemplateExercise] {
        pushATemplateExercises()
    }
}

/// FU-1: thin @MainActor view-model for the Focus surface's REAL canonical-AppData read.
/// It owns ONLY the wiring + IO seam (master §5/§15), mirroring `TodayRealDataModel` /
/// `NextWorkoutScheduleModel`: it opts the running app into the SAME sanctioned canonical store
/// the completion write uses (`JSONFileAppDataStore.applicationSupport()`, §8), loads it
/// READ-ONLY, builds the DataHealth clean view (the §10 chokepoint), and delegates the
/// clean-view → today's-template → engine → slice transform to the pure
/// `resolveFocusTrainingState`. It NEVER touches FileManager directly, NEVER writes (FU-1 is a
/// read-time wiring only; the empty-templates seed is a read projection, never persisted), NEVER
/// overwrites an unreadable document, and surfaces an honest state for every failure — no crash,
/// no fabricated session.
///
/// It lives in the Focus DATA-PROVIDER file (alongside the `FocusModePreviewData` sample) rather
/// than the shell so the presentation shell stays free of any AppData / DataHealth /
/// engine-clean-input token — the established Focus boundary: the engine pipeline is invoked in
/// the data provider, the shell only renders the resulting slice.
@MainActor
final class FocusModeLiveData: ObservableObject {
    @Published private(set) var state: FocusTrainingState

    /// The sanctioned canonical store (the §8 source of truth), read-only. Optional so
    /// previews/tests opt OUT of disk entirely; the running app injects it on appear.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()` in
    /// previews/tests).
    private let now: () -> Date
    /// True for the running app (live loading enabled); false for pinned previews.
    private let isLive: Bool

    /// Live initializer (the running app): honest `.empty` until `reload()` reads the canonical
    /// store, opted in on appear via `activateLiveSourceIfNeeded()`.
    init(now: @escaping () -> Date = { Date() }) {
        self.state = .empty
        self.store = nil
        self.now = now
        self.isLive = true
    }

    /// Preview/test initializer: pins a fixed state and disables live loading, so a preview
    /// renders a chosen state (or drives the deterministic sample path) without ever reading the
    /// real on-disk document.
    init(previewState: FocusTrainingState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews — the load-bearing flag the shell uses
    /// to choose the LIVE plan vs. the deterministic sample, and to hide the live-irrelevant
    /// scenario picker.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the completion write uses
    /// (Application Support / `IronPathAppData`, §8). Idempotent; `#if os(iOS)` + the live guard
    /// keep previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → today's template → engine →
    /// slice (in `resolveFocusTrainingState`). NEVER writes, NEVER overwrites an unreadable
    /// document, NEVER crashes — every failure → honest state. A SINGLE `instant` drives both the
    /// clean view's guard clock and the engine/scheduler reference time, so the read is internally
    /// consistent.
    func reload() {
        guard isLive else { return }
        let instant = now()
        state = resolveFocusTrainingState(readOutcome(now: instant), now: instant)
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint the app layer
    /// performs, mirroring `TodayRealDataModel`). No write: a missing file (or no live source) →
    /// `.missing`; a present-but-unreadable document → `.unreadable` (left untouched on disk, never
    /// overwritten — raw AppData never reaches the engine).
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
