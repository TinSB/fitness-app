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
// `IronPathDomain.PlanDisplay` and all branch logic in
// `IronPathDataHealth.resolvePlanDisplayState` (both pure + unit-tested); this view only
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
import IronPathDomain
import IronPathDataHealth
import IronPathPersistence

/// Honest in-RAM status of the most recent program-config edit save — no fake success
/// (master §15.4). `.idle` until the user explicitly saves. Mirrors EDIT-1/EDIT-3's
/// `ProfileEditSaveStatus` (kept separate so the Plan surface surfaces only its own
/// confirmation).
enum PlanEditSaveStatus: Equatable {
    case idle
    case saved
    case failed(String)
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
