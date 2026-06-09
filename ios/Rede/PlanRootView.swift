// PlanRootView — 计划 (Plan) real-AppData read path V1.
//
// The 计划 tab renders a READ-ONLY, restrained view of the user's REAL plan, REUSING
// the Today (#437) / Profile (#438) / History (#439) canonical read path:
//   load → buildCleanAppDataView → resolve  (the §10 chokepoint)
// The thin `@MainActor PlanRealDataModel` opts the running app into the SAME sanctioned
// canonical store the write path uses (`JSONFileAppDataStore.applicationSupport()`, §8),
// loads it READ-ONLY, routes the document through DataHealth `buildCleanAppDataView`, and
// delegates the whole transform to the pure package resolver:
//   AppData → buildCleanAppDataView → resolvePlanDisplayState → PlanDisplayState
// — raw AppData NEVER reaches the surface (it always passes through the clean view first,
// §10). Honest states (§15.4): no canonical file yet / first launch / a loaded-but-plan-
// less document → an empty state; a present-but-unreadable document → a degrade state
// (the document is left untouched — this path NEVER writes). All field selection lives in
// `RedeDomain.PlanDisplay` and all branch logic in
// `RedeDataHealth.resolvePlanDisplayState` (both pure + unit-tested); this view only
// renders + formats rows. No engine touched, no golden touched, nothing persisted.
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// This slice fills ONLY this RootView's body + the package logic it renders. It does NOT
// edit ContentView (the shell — the zero-arg `init()` keeps its `PlanRootView()` call
// unchanged), another tab's RootView, FocusMode*, or project.pbxproj. Keep the app layer
// thin (master §5/§15/§19.3): rendering + wiring only, no business logic; the only IO is
// the sanctioned read-only canonical store load, delegated to the store.

import Foundation
import SwiftUI
import RedeDomain
import RedeDataHealth
import RedePersistence
import RedeTrainingDecision

/// Honest in-RAM status of the most recent program-config edit save — no fake success
/// (master §15.4). `.idle` until the user explicitly saves. Mirrors EDIT-1/EDIT-3's
/// `ProfileEditSaveStatus` (kept separate so the Plan surface surfaces only its own
/// confirmation).
enum PlanEditSaveStatus: Equatable {
    case idle
    case saved
    case failed(String)
}

/// Honest outcome of a PA-2 Plan-Adaptive apply / rollback write — no fake success
/// (master §15.4). Returned by the streaming methods so a caller (UI or test) can react
/// without reading `@Published` status. `.rejected` is an HONEST non-write the engine /
/// snapshot guard produced (e.g. the source template changed → `expired`, or there is no
/// snapshot to roll back); `.failed` is a thrown write/validation/backup/decode error;
/// `.noStore` means no live writable canonical store (previews/tests) — none of these
/// ever persisted anything.
enum ProgramAdjustmentWriteOutcome: Equatable {
    case applied
    case rejected(String)
    case failed(String)
    case noStore
}

/// In-RAM editable form for the three program-template scalar config fields (two-step
/// 编辑→保存): 主要目标 `primaryGoal` / 分项 `splitType` / 每周天数 `daysPerWeek`. Every
/// field is a String so it binds to a `TextField`; parsed back to typed values on save.
/// Pure value type — no IO; nothing is persisted until the explicit 保存. Mirrors
/// EDIT-1's `ProfileEditForm`.
private struct ProgramConfigEditForm: Equatable {
    var primaryGoal = ""
    var splitType = ""
    var daysPerWeekText = ""

    /// Seed the form from the resolved (cleaned) plan display values. The actual
    /// open-bag base for the write is the freshly-loaded on-disk `programTemplate`
    /// (read inside `AppData.withUpdatedProgramConfig`), so only these three scalars are
    /// ever taken from the form.
    static func seeded(from plan: PlanDisplay) -> ProgramConfigEditForm {
        ProgramConfigEditForm(
            primaryGoal: plan.primaryGoal ?? "",
            splitType: plan.splitType ?? "",
            daysPerWeekText: plan.daysPerWeek.map(String.init) ?? ""
        )
    }

    /// Trimmed 主要目标; blank → honest nil ("not set").
    var parsedPrimaryGoal: String? { Self.trimmedOrNil(primaryGoal) }
    /// Trimmed 分项; blank → honest nil.
    var parsedSplitType: String? { Self.trimmedOrNil(splitType) }
    /// 每周天数 as an integer `NumberRepr`; blank / non-integer → honest nil.
    var parsedDaysPerWeek: NumberRepr? { Self.intRepr(daysPerWeekText) }

    private static func trimmedOrNil(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
    private static func intRepr(_ s: String) -> NumberRepr? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, let i = Int(t) else { return nil }
        return .integer(Int64(i))
    }
}

/// Thin @MainActor view-model for the 计划 surface's REAL canonical-AppData read.
/// It owns ONLY the wiring + IO seam (master §5/§15): it opts the running app into the
/// sanctioned canonical store and delegates the AppData → clean view → display transform
/// to the pure `resolvePlanDisplayState`. It NEVER touches FileManager directly (the store
/// does all disk IO), NEVER writes, and surfaces an honest state for every failure — no
/// crash, no fabricated plan, no overwrite. Mirrors `ProfileRealDataModel`.
@MainActor
final class PlanRealDataModel: ObservableObject {
    @Published private(set) var state: PlanDisplayState

    /// The sanctioned canonical store (the §8 source of truth). Optional so previews/tests
    /// opt OUT of disk entirely; the running app injects the Application Support store on
    /// appear. All disk IO is delegated to the store.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()` in
    /// previews/tests).
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
    init(previewState: PlanDisplayState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the write path uses
    /// (Application Support / `IronPathAppData`), pointing the read path at the real source
    /// of truth. Idempotent; `#if os(iOS)` + the live guard keep previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → display state (in
    /// `resolvePlanDisplayState`). NEVER writes, NEVER overwrites an unreadable document,
    /// NEVER crashes — every failure becomes an honest state.
    func reload() {
        guard isLive else { return }
        state = resolvePlanDisplayState(readOutcome(now: now()))
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint the app
    /// layer performs, mirroring `ProfileRealDataModel`). No write: a missing file (or no
    /// live source) → `.missing`; a present-but-unreadable document → `.unreadable` (left
    /// untouched on disk, never overwritten — raw AppData never reaches the surface).
    private func readOutcome(now: Date) -> PlanAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }

    // MARK: - EDIT-4: program config scalar edit (sanctioned, DataHealth-gated write)

    /// Honest in-RAM status of the most recent program-config edit save (§15.4). `.idle`
    /// until the user explicitly saves; never a fake success.
    @Published private(set) var programConfigSaveStatus: PlanEditSaveStatus = .idle

    /// Reset the save status (e.g. when (re)entering or leaving edit mode).
    func clearProgramConfigSaveStatus() { programConfigSaveStatus = .idle }

    /// Persist a program-config scalar edit (主要目标 / 分项 / 每周天数) through the SAME
    /// sanctioned, DataHealth-gated write path as every other canonical write (§8): load
    /// existing → rewrite ONLY the three user scalars on the freshly-loaded on-disk
    /// `programTemplate` (id / userId / the engine-managed correctionStrategy /
    /// functionalStrategy blobs + unknown keys preserved) → defensive
    /// `buildCleanAppDataView` re-validation → backup-before-overwrite → atomic save →
    /// honest fail. The engine-managed STRUCTURED plan (mesocycle weeks / prescriptions)
    /// is NEVER touched. NEVER writes on previews/tests (no live store). Honest status,
    /// no fake success. Returns true iff the edit committed.
    @discardableResult
    func saveProgramConfigEdit(
        primaryGoal: String?,
        splitType: String?,
        daysPerWeek: NumberRepr?
    ) -> Bool {
        guard isLive else { programConfigSaveStatus = .failed("当前环境不可保存"); return false }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
        guard let store else { programConfigSaveStatus = .failed("没有可写入的本机存储"); return false }
        let writer = CanonicalSessionWriter(store: store)
        do {
            try writer.updateProgramConfig(
                primaryGoal: primaryGoal, splitType: splitType, daysPerWeek: daysPerWeek
            ) { candidate in
                // Defensive §10 gate: re-encode → re-decode (re-runs the SchemaVersion
                // guard) → DataHealth clean view; accept ONLY if the candidate's
                // programTemplate survives byte-identical (canonical emit is key-order-
                // independent). We compare the clean view's RAW program (NOT a cleaned
                // form): `buildCleanAppDataView` leaves `programTemplate` untouched, so
                // RAW is the correct reference and avoids coupling the gate to any future
                // program cleaning (the EDIT-3 raw-comparison pattern). No fake success —
                // an invariant-breaking candidate is never written.
                guard let bytes = try? candidate.canonicalJSONData(),
                      let reDecoded = try? AppData(decoding: bytes) else { return false }
                let cleaned = buildCleanAppDataView(reDecoded)
                let program = cleaned.raw.programTemplate
                // The three edited scalars are exactly what we intended…
                guard program.primaryGoal == primaryGoal,
                      program.splitType == splitType,
                      program.daysPerWeek == daysPerWeek else { return false }
                // …and the whole programTemplate (engine-managed strategies + unknown
                // keys included) survives the clean view's RAW projection byte-identically.
                guard let a = try? program.encoded().canonicalJSONData(),
                      let b = try? candidate.programTemplate.encoded().canonicalJSONData() else { return false }
                return a == b
            }
            programConfigSaveStatus = .saved
            reload()   // refresh the surface (and other tabs on next appear) from fresh truth
            return true
        } catch {
            programConfigSaveStatus = .failed(Self.saveErrorMessage(error))
            return false
        }
    }

    // MARK: - PA-2: Plan-Adaptive apply-write (createDraft → diff preview → applyDraft → gated write; + rollback)

    /// Honest in-RAM status of the most recent PA apply / rollback write (§15.4). `.idle`
    /// until the user explicitly applies / rolls back; never a fake success.
    @Published private(set) var programAdjustmentStatus: PlanEditSaveStatus = .idle

    /// The history item produced by the most recent successful APPLY, kept in RAM so the
    /// UI can offer a "撤销上次调整" (rollback) entry. Cleared once rolled back. (The full
    /// PA history read surface — `programAdjustmentHistory` — is a separate read slice;
    /// this write slice only remembers what it just applied this session.)
    @Published private(set) var lastAppliedAdjustment: ProgramAdjustmentHistoryItem?

    /// Reset the PA apply status + the in-RAM last-applied item (e.g. on leaving the surface).
    func clearProgramAdjustmentStatus() {
        programAdjustmentStatus = .idle
        lastAppliedAdjustment = nil
    }

    /// READ-ONLY preview: build the adjustment draft + its `diffPreview` from the weekly
    /// recommendations (consuming the ported PA-1 `createAdjustmentDraftFromRecommendations`,
    /// `asOfIso` INJECTED — no `Date()`). This NEVER writes (the `buildAdjustmentDiff` the
    /// draft carries previews on clones, §11). The current on-disk `programTemplate` is read
    /// read-only as the diff base; `nil` when no live source (previews/tests). Returns the
    /// draft whose `.diffPreview` the UI renders before any explicit apply.
    func previewWeeklyProgramAdjustment(
        recommendations: [WeeklyActionRecommendation],
        sourceTemplate: TrainingTemplate,
        templates: [TrainingTemplate],
        asOfIso: String
    ) -> ProgramAdjustmentDraft {
        let context = ProgramAdjustmentEngine.AdjustmentDraftContext(
            programTemplate: currentProgramTemplateReadOnly(),
            templates: templates
        )
        return ProgramAdjustmentEngine.createAdjustmentDraftFromRecommendations(
            recommendations,
            sourceProgramTemplate: sourceTemplate,
            context: context,
            nowIso: asOfIso
        )
    }

    /// Apply a previewed adjustment draft and persist the new `programTemplate` through the
    /// SAME sanctioned, DataHealth-gated write path as every other canonical write (§8): run
    /// the ported PA-1 `applyAdjustmentDraft` (`asOfIso` / `historyIdSeed` INJECTED — no
    /// `Date()`/randomness) over the FRESH on-disk `programTemplate`; a stale source-template
    /// snapshot hash → honest `expired`, NOTHING written; on success decode the lossless
    /// `updatedProgramTemplate` and write it via
    /// `CanonicalSessionWriter.applyProgramAdjustment` with the defensive §10 clean-view
    /// gate → backup → atomic save → honest fail → reload. NEVER writes on previews/tests
    /// (no live store). No fake success. Two-step + explicit: the caller only invokes this
    /// after the user confirms the read-only diff.
    @discardableResult
    func applyWeeklyProgramAdjustment(
        draft: ProgramAdjustmentDraft,
        sourceTemplate: TrainingTemplate,
        templates: [TrainingTemplate],
        asOfIso: String,
        historyIdSeed: String
    ) -> ProgramAdjustmentWriteOutcome {
        guard isLive else {
            programAdjustmentStatus = .failed("当前环境不可保存")
            return .noStore
        }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
        guard let store else {
            programAdjustmentStatus = .failed("没有可写入的本机存储")
            return .noStore
        }
        // PA-1 pure: build the applied program over the FRESH on-disk template. The
        // snapshot-hash guard inside makes a stale source → `expired` (honest, NO write).
        let result = ProgramAdjustmentEngine.applyAdjustmentDraft(
            draft,
            sourceProgramTemplate: sourceTemplate,
            currentProgramTemplate: currentProgramTemplateReadOnly(),
            templates: templates,
            nowIso: asOfIso,
            historyIdSeed: historyIdSeed
        )
        guard result.ok, let updatedJSON = result.updatedProgramTemplate, let historyItem = result.historyItem else {
            let message = result.message ?? "计划调整失败，请重新生成预览。"
            programAdjustmentStatus = .failed(message)
            return .rejected(message)
        }
        // `updatedProgramTemplate` is the lossless raw program object; decode (open-bag) to
        // the typed value the write seam takes (round-trip-faithful, PA-S1).
        guard let updatedProgram = try? ProgramTemplate(decoding: updatedJSON) else {
            programAdjustmentStatus = .failed("调整结果无法解析，未保存")
            return .failed("调整结果无法解析，未保存")
        }
        let writer = CanonicalSessionWriter(store: store)
        do {
            try writer.applyProgramAdjustment(updatedProgramTemplate: updatedProgram, validate: Self.acceptsProgramTemplateWrite)
            programAdjustmentStatus = .saved
            lastAppliedAdjustment = historyItem
            reload()   // refresh the surface from fresh truth; the engine recomputes from the new template
            return .applied
        } catch {
            let message = Self.saveErrorMessage(error)
            programAdjustmentStatus = .failed(message)
            return .failed(message)
        }
    }

    /// Roll back a previously-applied adjustment by restoring its source snapshot through
    /// the SAME write seam (a sanctioned MUTATION, NOT a §14 full restore): run the ported
    /// PA-1 `rollbackAdjustment` (`asOfIso` INJECTED) → write the restored snapshot
    /// `programTemplate` via `CanonicalSessionWriter.applyProgramAdjustment` with the SAME
    /// defensive §10 gate → reload. A history item with no snapshot → honest `rejected`,
    /// NOTHING written. NEVER writes on previews/tests. No fake success.
    @discardableResult
    func rollbackWeeklyProgramAdjustment(
        historyItem: ProgramAdjustmentHistoryItem,
        asOfIso: String
    ) -> ProgramAdjustmentWriteOutcome {
        guard isLive else {
            programAdjustmentStatus = .failed("当前环境不可保存")
            return .noStore
        }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
        guard let store else {
            programAdjustmentStatus = .failed("没有可写入的本机存储")
            return .noStore
        }
        let rollback = ProgramAdjustmentEngine.rollbackAdjustment(historyItem, nowIso: asOfIso)
        guard let restored = rollback.restoredProgramTemplate else {
            programAdjustmentStatus = .failed("没有可回滚的原始模板快照，未改动")
            return .rejected("没有可回滚的原始模板快照，未改动")
        }
        let writer = CanonicalSessionWriter(store: store)
        do {
            try writer.applyProgramAdjustment(updatedProgramTemplate: restored, validate: Self.acceptsProgramTemplateWrite)
            programAdjustmentStatus = .saved
            lastAppliedAdjustment = nil   // the applied experiment was rolled back
            reload()
            return .applied
        } catch {
            let message = Self.saveErrorMessage(error)
            programAdjustmentStatus = .failed(message)
            return .failed(message)
        }
    }

    /// The current on-disk `programTemplate` as the engine input (read-only load). `nil`
    /// when no live store / no file / unreadable — the PA engine then defaults internally.
    /// NEVER writes.
    private func currentProgramTemplateReadOnly() -> ProgramTemplate? {
        guard let store, store.hasExistingFile, let appData = try? store.load() else { return nil }
        return appData.programTemplate
    }

    /// ISO-8601 instant from the INJECTED clock (`now`), `.SSSZ`-precision/UTC — the
    /// app-layer clock seam the PA engines consume as `nowIso` (never an inline wall
    /// clock; mirrors `FocusModeMvpState.iso8601`). Deterministic when `now` is pinned.
    func nowIso() -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fmt.timeZone = TimeZone(identifier: "UTC")
        return fmt.string(from: now())
    }

    /// Defensive §10 gate for a PA programTemplate write: re-run the candidate through the
    /// SAME read-only DataHealth ingress the other edits use (`processIncomingAppData` →
    /// `cleanView`, the #448 single-chokepoint lesson — never persist a raw AppData) and
    /// accept ONLY when the candidate's WHOLE new `programTemplate` survives the clean
    /// view's RAW projection byte-identically (canonical emit is key-order-independent;
    /// `buildCleanAppDataView` leaves `programTemplate` untouched, so RAW is the correct
    /// reference). No fake success — an invariant-breaking candidate is never written.
    /// `static` (it reads only the candidate + pure functions) so it passes as the plain
    /// `(AppData) -> Bool` gate without main-actor isolation friction.
    private static func acceptsProgramTemplateWrite(_ candidate: AppData) -> Bool {
        guard let ingress = try? processIncomingAppData(
            appData: candidate,
            source: .postSessionComplete,
            options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
        ) else { return false }
        guard let cleaned = try? ingress.cleanView.raw.programTemplate.encoded().canonicalJSONData(),
              let intended = try? candidate.programTemplate.encoded().canonicalJSONData() else { return false }
        return cleaned == intended
    }

    private static func saveErrorMessage(_ error: Error) -> String {
        guard let e = error as? CanonicalSessionWriteError else {
            return "保存失败:\(error.localizedDescription)"
        }
        switch e {
        case .existingDocumentUnreadable:
            return "本机计划无法读取,为防数据丢失未作任何改动"
        case .validationRejected:
            return "改动未通过数据校验,未保存"
        case .backupFailed:
            return "备份失败,原始数据已保留,未保存"
        case .saveFailed:
            return "写入失败,未保存"
        }
    }
}

struct PlanRootView: View {
    @StateObject private var model: PlanRealDataModel
    @State private var showEmptyInfo = false

    /// EDIT-4 two-step edit state: the 模板 Program card stays read-only (#440) until the
    /// user taps 「编辑模板配置」. `programForm` is the in-RAM edit buffer — nothing is
    /// persisted until the explicit 「保存」. The 周期 Mesocycle + 策略 cards stay
    /// read-only (engine-managed structure — never edited here).
    @State private var isEditingProgram = false
    @State private var programForm = ProgramConfigEditForm()

    /// The running app constructs the default live model. `@MainActor` so it can build the
    /// main-actor-isolated model (SwiftUI always builds views on the main actor). Zero-arg
    /// so ContentView's `PlanRootView()` call stays unchanged (iOS-17S).
    @MainActor init() {
        _model = StateObject(wrappedValue: PlanRealDataModel())
    }

    /// Previews/tests inject a pinned model (e.g. `PlanRealDataModel(previewState:)`).
    @MainActor init(model: PlanRealDataModel) {
        _model = StateObject(wrappedValue: model)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                content
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        .task {
            // Opt the running app into the real canonical store and read it (read-only).
            model.activateLiveSourceIfNeeded()
            model.reload()
        }
        .alert("计划 · 暂无数据", isPresented: $showEmptyInfo) {
            Button("好", role: .cancel) {}
        } message: {
            Text("接入真实计划数据后，这里会展示你的训练周期与模板。计划页为只读概览，不读写任何数据。")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("计划")
                .font(.largeTitle.weight(.semibold))
            Text("训练周期与模板概览")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - State-driven content

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .ready(let plan):
            planContent(plan)
        case .empty:
            emptyState
        case .unavailable:
            unavailableState
        }
    }

    @ViewBuilder
    private func planContent(_ plan: PlanDisplay) -> some View {
        let cycle = Self.cycleRows(plan)
        // 周期 Mesocycle is ENGINE-managed (weeks / dates / phase) — read-only (#440).
        if !cycle.isEmpty {
            card(title: "周期 Mesocycle", rows: cycle)
        }
        // 模板 Program — the three user scalar config fields (主要目标 / 分项 / 每周天数)
        // are editable (EDIT-4), two-step 「编辑→保存」. Always shown in `.ready` so the
        // edit entry point is reachable even when a scalar is unset.
        programCard(plan)
        // 策略 — ENGINE-managed strategy blobs — read-only presence only (#440).
        if plan.hasCorrectionStrategy || plan.hasFunctionalStrategy {
            strategyDisclosure(plan)
        }
        // 计划自适应 (PA-2) — read-only by default (#440); two-step, explicit, non-auto,
        // device-local, rollback-able. The write seam (preview → apply → rollback) lives in
        // the model; the live weekly-recommendation source is a separate read slice, so this
        // surface honestly reflects the current state without fabricating a suggestion.
        planAdjustmentDisclosure
    }

    // MARK: - PA-2 计划自适应 (read-only disclosure; two-step apply / rollback via the model)

    /// A restrained, read-only disclosure for the Plan-Adaptive apply-write feature. It is
    /// explicit + two-step + non-auto by construction: nothing is ever written from here
    /// except the user's explicit 「撤销上次调整」 (rollback) of an adjustment applied THIS
    /// session, which routes through the SAME sanctioned gated write seam. Honest empty:
    /// the weekly-recommendation read surface is a separate slice, so until it lands this
    /// shows an honest "暂无可应用的调整" rather than a fabricated suggestion.
    @ViewBuilder
    private var planAdjustmentDisclosure: some View {
        DisclosureGroup("计划自适应") {
            VStack(alignment: .leading, spacing: 8) {
                Text("根据近期训练自动生成的「下周实验调整」会先给出只读预览，确认后才会写入本机，且可随时撤销。只在本机生效、不联网、不自动应用。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if let applied = model.lastAppliedAdjustment {
                    // An adjustment was applied THIS session — offer an explicit rollback.
                    if let summary = applied.mainChangeSummary, !summary.isEmpty {
                        HStack(alignment: .firstTextBaseline) {
                            Text("已应用").font(.subheadline).foregroundStyle(.secondary)
                            Spacer()
                            Text(summary).font(.subheadline).foregroundStyle(.primary)
                                .multilineTextAlignment(.trailing)
                        }
                    }
                    Button("撤销上次调整") { rollbackLastAdjustment(applied) }
                        .buttonStyle(.bordered)
                } else {
                    Text("本周暂无可应用的计划调整建议。")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                // Honest status (§15.4): a successful apply/rollback or an honest failure.
                switch model.programAdjustmentStatus {
                case .saved:
                    Label("已写入本机", systemImage: "checkmark.circle")
                        .font(.footnote).foregroundStyle(.secondary)
                case .failed(let message):
                    Text(message).font(.footnote).foregroundStyle(.red)
                case .idle:
                    EmptyView()
                }
            }
            .padding(.top, 6)
        }
        .font(.headline)
        .tint(.primary)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    /// Explicit rollback of the adjustment applied this session, through the SAME gated
    /// write seam (a sanctioned MUTATION, not a §14 restore). `asOfIso` is the model's
    /// INJECTED clock — no inline wall clock.
    private func rollbackLastAdjustment(_ historyItem: ProgramAdjustmentHistoryItem) {
        _ = model.rollbackWeeklyProgramAdjustment(historyItem: historyItem, asOfIso: model.nowIso())
    }

    // MARK: - EDIT-4 program card (two-step 编辑 → 保存)

    /// The 模板 Program card: read-only (#440) until the user taps 「编辑模板配置」, then
    /// the in-place edit form. Two-step: nothing is written until 保存.
    @ViewBuilder
    private func programCard(_ plan: PlanDisplay) -> some View {
        if isEditingProgram {
            editProgramCard()
        } else {
            readOnlyProgramCard(plan)
        }
    }

    private func readOnlyProgramCard(_ plan: PlanDisplay) -> some View {
        let rows = Self.programRows(plan)
        return VStack(alignment: .leading, spacing: 10) {
            Text("模板 Program")
                .font(.headline)
            if rows.isEmpty {
                Text("还没有模板配置（主要目标 / 分项 / 每周天数）。点“编辑模板配置”填写。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 6) {
                    ForEach(rows) { row in
                        HStack(alignment: .firstTextBaseline) {
                            Text(row.label).font(.subheadline).foregroundStyle(.secondary)
                            Spacer()
                            Text(row.value).font(.subheadline).foregroundStyle(.primary)
                        }
                    }
                }
            }
            // EDIT-4: honest "已保存" confirmation after a successful gated write.
            if case .saved = model.programConfigSaveStatus {
                Label("已保存", systemImage: "checkmark.circle")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Button("编辑模板配置") { enterProgramEdit(plan) }
                .buttonStyle(.bordered)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    /// EDIT-4: in-place two-step edit of the three program scalar config fields. The
    /// engine-managed structured plan (mesocycle weeks / prescriptions / strategy blobs)
    /// is NOT editable here — the engine owns it.
    private func editProgramCard() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("编辑模板配置")
                .font(.headline)
            programEditRow("主要目标", placeholder: "如:增肌 / 力量", text: $programForm.primaryGoal)
            programEditRow("分项", placeholder: "如:全身 / 推 / 拉 / 腿", text: $programForm.splitType)
            programEditRow("每周天数", placeholder: "天", text: $programForm.daysPerWeekText, numeric: true)

            // No fake success (§15.4): a failed save stays in edit mode and shows why.
            if case .failed(let message) = model.programConfigSaveStatus {
                Text(message).font(.footnote).foregroundStyle(.red)
            }
            HStack {
                Button("保存") { saveProgramEdit() }
                    .buttonStyle(.borderedProminent)
                Spacer()
                Button("取消", role: .cancel) { cancelProgramEdit() }
            }
            Text("两步编辑:改完点“保存”才会写入本机(经数据校验)。仅修改主要目标/分项/每周天数;不影响训练周期(weeks)与引擎策略。")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private func programEditRow(
        _ title: String, placeholder: String, text: Binding<String>, numeric: Bool = false
    ) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.subheadline).foregroundStyle(.secondary)
            Spacer()
            TextField(placeholder, text: text)
                .multilineTextAlignment(.trailing)
                .keyboardType(numeric ? .numberPad : .default)
                .frame(maxWidth: 200)
        }
    }

    // MARK: - EDIT-4 actions (two-step 编辑 → 保存)

    private func enterProgramEdit(_ plan: PlanDisplay) {
        programForm = ProgramConfigEditForm.seeded(from: plan)
        model.clearProgramConfigSaveStatus()
        isEditingProgram = true
    }

    private func cancelProgramEdit() {
        isEditingProgram = false
        model.clearProgramConfigSaveStatus()
    }

    private func saveProgramEdit() {
        if model.saveProgramConfigEdit(
            primaryGoal: programForm.parsedPrimaryGoal,
            splitType: programForm.parsedSplitType,
            daysPerWeek: programForm.parsedDaysPerWeek
        ) {
            isEditingProgram = false   // success → fresh read-only truth (model reloaded)
        }
        // failure: stay in edit mode; model.programConfigSaveStatus carries the honest reason
    }

    // MARK: - Honest empty / degrade states (§15.4)

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("还没有训练计划")
                .font(.headline)
            Text("本机还没有可显示的训练周期或模板。配置计划后会显示在这里。计划页只读展示、不联网、不修改任何已保存的数据。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Button("刷新") { reloadFromTap() }
                    .buttonStyle(.borderedProminent)
                Button("了解计划页") { showEmptyInfo = true }
                    .buttonStyle(.bordered)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private var unavailableState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("暂时无法读取计划")
                .font(.headline)
            Text("本机计划暂时无法读取。已保留原始数据未作任何改动，可稍后重试。")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("重试") { reloadFromTap() }
                .buttonStyle(.borderedProminent)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    // MARK: - Cards

    private func strategyDisclosure(_ plan: PlanDisplay) -> some View {
        DisclosureGroup("策略详情") {
            VStack(alignment: .leading, spacing: 6) {
                strategyRow("矫正策略", present: plan.hasCorrectionStrategy)
                strategyRow("功能策略", present: plan.hasFunctionalStrategy)
            }
            .padding(.top, 6)
        }
        .font(.headline)
        .tint(.primary)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    private func strategyRow(_ label: String, present: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(present ? "已配置" : "未配置")
                .font(.subheadline)
                .foregroundStyle(present ? .primary : .secondary)
        }
    }

    private func card(title: String, rows: [PlanRow]) -> some View {
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
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
    }

    // MARK: - Helpers

    /// Re-run the read-only load on an explicit retry/refresh tap (picks up a plan
    /// configured since first appear).
    private func reloadFromTap() {
        model.activateLiveSourceIfNeeded()
        model.reload()
    }

    /// Cycle rows from the real `PlanDisplay` — each shown only when present, so the
    /// surface stays calm (presentation only; selection lives in `PlanDisplay`).
    private static func cycleRows(_ plan: PlanDisplay) -> [PlanRow] {
        var rows: [PlanRow] = []
        if let phase = plan.phase { rows.append(PlanRow(id: "phase", label: "阶段", value: phase)) }
        if let weeks = plan.weekCount { rows.append(PlanRow(id: "weeks", label: "周数", value: "\(weeks) 周")) }
        if let range = dateRange(plan.startDate, plan.endDate) {
            rows.append(PlanRow(id: "dates", label: "日期", value: range))
        }
        return rows
    }

    private static func programRows(_ plan: PlanDisplay) -> [PlanRow] {
        var rows: [PlanRow] = []
        if let goal = plan.primaryGoal { rows.append(PlanRow(id: "goal", label: "目标", value: goal)) }
        if let split = plan.splitType { rows.append(PlanRow(id: "split", label: "分项", value: split)) }
        if let days = plan.daysPerWeek { rows.append(PlanRow(id: "days", label: "每周", value: "\(days) 天")) }
        return rows
    }

    /// Join the cleaned start/end dates into an honest range; nil when neither exists.
    private static func dateRange(_ start: String?, _ end: String?) -> String? {
        switch (start, end) {
        case let (s?, e?): return "\(s) – \(e)"
        case let (s?, nil): return s
        case let (nil, e?): return e
        case (nil, nil): return nil
        }
    }
}

/// One label/value row in a Plan card (presentation only).
private struct PlanRow: Identifiable, Equatable {
    let id: String
    let label: String
    let value: String
}

#Preview("有计划") {
    PlanRootView(model: PlanRealDataModel(previewState: .ready(
        PlanDisplay(
            phase: "积累期",
            weekCount: 4,
            startDate: "2026-05-04",
            endDate: "2026-05-31",
            primaryGoal: "增肌",
            splitType: "推 / 拉 / 腿",
            daysPerWeek: 4,
            hasCorrectionStrategy: true,
            hasFunctionalStrategy: false
        )
    )))
}

#Preview("空态") {
    PlanRootView(model: PlanRealDataModel(previewState: .empty))
}

#Preview("不可读") {
    PlanRootView(model: PlanRealDataModel(previewState: .unavailable))
}
