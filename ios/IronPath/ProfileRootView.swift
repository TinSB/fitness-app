// ProfileRootView — iOS-17B Profile Surface V1;
// Profile real-AppData read path V1 switches it from sample to REAL data.
//
// 我的 (Profile) tab. Read-only rendering of the profile / unit / screening
// / settings Domain values + the latest Apple-Health body weight, with a
// local-only display-unit toggle.
//
// Data source (Profile real-AppData read path V1): this surface now reads the
// user's REAL on-device canonical AppData — the SAME store the write path uses
// (`JSONFileAppDataStore.applicationSupport()`, §8) — replacing iOS-17B's fixed
// sample. The thin `@MainActor ProfileRealDataModel` below opts the running app
// into that store, loads it READ-ONLY, routes the document through DataHealth
// `buildCleanAppDataView` (the §10 chokepoint), and delegates the whole transform
// to the pure package resolver:
//   AppData → buildCleanAppDataView → resolveProfileDisplayState → ProfileDisplayState
// — raw AppData NEVER reaches the surface (it always passes through the clean view
// first, §10). Honest states (§15.4): no canonical file yet / first launch / a
// loaded-but-profile-less document → an empty state; a present-but-unreadable
// document → a degrade state (the document is left untouched — this path NEVER
// writes). All branch logic lives in `IronPathDataHealth.resolveProfileDisplayState`
// (pure + unit-tested) and the derived "latest body weight" selection in
// `IronPathDomain.ProfileDisplayData`; this view only renders + formats (via
// `ProfileDisplay`). No engine touched, no golden touched.
//
// The latest body weight shown here is the DERIVED latest `body_weight`
// HealthMetricSample (HK-1), distinct from the user's self-entered
// `userProfile.weightKg`; the native engine does not port `healthSummaryEngine`,
// so it is selected directly for display (§8.2). The HealthKit import/export +
// rest/training reminder sections are unchanged and always available (user-gated
// actions independent of profile data).
//
// === iOS-17S Tab Shell Scaffold V1 · parallel-line integration contract ===
// This slice fills ONLY this RootView's body + the package logic it renders.
// It does NOT edit ContentView (the shell), another tab's RootView,
// FocusMode*, or project.pbxproj. Keep the app layer thin (master
// §5/§15/§19.3): rendering + wiring only, no business logic; the only IO is the
// sanctioned read-only canonical store load, delegated to the store.

import Foundation
import SwiftUI
import IronPathDomain
import IronPathNotifications
import IronPathHealthKit
import IronPathPersistence
import IronPathDataHealth

/// Honest in-RAM status of the most recent profile edit save — no fake success
/// (master §15.4). `.idle` until the user explicitly saves.
enum ProfileEditSaveStatus: Equatable {
    case idle
    case saved
    case failed(String)
}

/// In-RAM editable form for the nine profile scalar fields (two-step 编辑→保存).
/// Every field is a String so it binds to a `TextField`; parsed back to typed
/// `UserProfile` values on save. `weightText` is in `unit` (the display unit captured
/// when editing began) and is converted to kg via the single `WeightConversion`
/// home. Pure value type — no IO; nothing is persisted until the explicit 保存.
private struct ProfileEditForm: Equatable {
    var name = ""
    var sex = ""
    var ageText = ""
    var heightCmText = ""
    var weightText = ""
    var unit: WeightUnit = .kg
    var trainingLevel = ""
    var primaryGoal = ""
    var weeklyDaysText = ""
    var sessionMinText = ""

    /// Seed the form from the loaded canonical profile, with 体重 shown in the
    /// current display unit (kg/lb).
    static func seeded(from p: UserProfile, displayUnit: WeightUnit) -> ProfileEditForm {
        ProfileEditForm(
            name: p.name ?? "",
            sex: p.sex ?? "",
            ageText: Self.intText(p.age),
            heightCmText: Self.intText(p.heightCm),
            weightText: Self.weightText(p.weightKg, unit: displayUnit),
            unit: displayUnit,
            trainingLevel: p.trainingLevel ?? "",
            primaryGoal: p.primaryGoal ?? "",
            weeklyDaysText: Self.intText(p.weeklyTrainingDays),
            sessionMinText: Self.intText(p.sessionDurationMin)
        )
    }

    /// Apply the edited scalars onto the base profile (preserving id / injuryFlags /
    /// painNotes / the profile's own open bag). 体重 is converted from the entry unit
    /// to kg for storage; 身高 is cm. Blank → honest nil ("not set").
    func applied(onto base: UserProfile) -> UserProfile {
        base.withScalarFields(
            name: Self.trimmedOrNil(name),
            sex: Self.trimmedOrNil(sex),
            age: Self.intRepr(ageText),
            heightCm: Self.intRepr(heightCmText),
            weightKg: Self.weightKgRepr(weightText, unit: unit),
            trainingLevel: Self.trimmedOrNil(trainingLevel),
            primaryGoal: Self.trimmedOrNil(primaryGoal),
            weeklyTrainingDays: Self.intRepr(weeklyDaysText),
            sessionDurationMin: Self.intRepr(sessionMinText)
        )
    }

    private static func trimmedOrNil(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
    private static func intText(_ n: NumberRepr?) -> String {
        guard let n else { return "" }
        if let i = n.intValue { return String(i) }
        return Self.decimalText(n.doubleValue)
    }
    private static func intRepr(_ s: String) -> NumberRepr? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, let i = Int(t) else { return nil }
        return .integer(Int64(i))
    }
    private static func weightText(_ kg: NumberRepr?, unit: WeightUnit) -> String {
        guard let kg, let shown = WeightConversion.fromKilograms(kg.doubleValue, to: unit) else { return "" }
        return Self.decimalText(shown)
    }
    private static func weightKgRepr(_ s: String, unit: WeightUnit) -> NumberRepr? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, let entered = Double(t),
              let kg = WeightConversion.toKilograms(entered, from: unit) else { return nil }
        return .double(kg)
    }
    /// Compact fixed-point (1 decimal), trailing `.0` trimmed. C-locale `.`.
    private static func decimalText(_ v: Double) -> String {
        var s = String(format: "%.1f", v)
        if s.hasSuffix(".0") { s.removeLast(2) }
        return s
    }
}

/// Thin @MainActor view-model for the 我的 surface's REAL canonical-AppData read.
/// It owns ONLY the wiring + IO seam (master §5/§15): it opts the running app into
/// the sanctioned canonical store and delegates the AppData → clean view → display
/// transform to the pure `resolveProfileDisplayState`. It NEVER touches FileManager
/// directly (the store does all disk IO), NEVER writes, and surfaces an honest state
/// for every failure — no crash, no fabricated profile, no overwrite. Mirrors the
/// 今日 surface's `TodayRealDataModel`.
@MainActor
final class ProfileRealDataModel: ObservableObject {
    @Published private(set) var state: ProfileDisplayState

    /// The sanctioned canonical store (the §8 source of truth). Optional so
    /// previews/tests opt OUT of disk entirely; the running app injects the
    /// Application Support store on appear. All disk IO is delegated to the store.
    private var store: AppDataStore?
    /// Injectable clock; only invoked on the live read path (never an inline `Date()`
    /// in previews/tests).
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
    init(previewState: ProfileDisplayState) {
        self.state = previewState
        self.store = nil
        self.now = { Date() }
        self.isLive = false
    }

    /// True for the running app; false for pinned previews.
    var isLiveLoadEnabled: Bool { isLive }

    /// Opt the RUNNING app into the SAME sanctioned canonical store the write path
    /// uses (Application Support / `IronPathAppData`), pointing the read path at the
    /// real source of truth. Idempotent; `#if os(iOS)` + the live guard keep
    /// previews/tests off disk.
    func activateLiveSourceIfNeeded() {
        guard isLive else { return }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// Read-only refresh: canonical AppData → DataHealth clean view → display state
    /// (in `resolveProfileDisplayState`). NEVER writes, NEVER overwrites an unreadable
    /// document, NEVER crashes — every failure becomes an honest state.
    func reload() {
        guard isLive else { return }
        state = resolveProfileDisplayState(readOutcome(now: now()))
    }

    /// The ONLY IO + the DataHealth clean-view construction (the §10 chokepoint, which
    /// the DataHealth-side resolver may not perform itself — the app layer does it
    /// here, mirroring `TodayRealDataModel`). Reads the canonical store and, on
    /// success, routes the document through `buildCleanAppDataView` with a guard clock
    /// built from `now`. No write: a missing file (or no live source) → `.missing`; a
    /// present-but-unreadable document → `.unreadable` (left untouched on disk, never
    /// overwritten — raw AppData never reaches the surface).
    private func readOutcome(now: Date) -> ProfileAppDataLoadOutcome {
        guard let store, store.hasExistingFile else { return .missing }
        let appData: AppData
        do {
            appData = try store.load()
        } catch {
            return .unreadable
        }
        return .loaded(buildCleanAppDataView(appData, clock: FixedRuntimeGuardClock(now)))
    }

    // MARK: - EDIT-1: profile scalar edit (sanctioned, DataHealth-gated write)

    /// Honest status of the most recent profile edit save (§15.4). `.idle` until the
    /// user explicitly saves; never a fake success.
    @Published private(set) var saveStatus: ProfileEditSaveStatus = .idle

    /// Reset the save status (e.g. when (re)entering or leaving edit mode).
    func clearSaveStatus() { saveStatus = .idle }

    /// Persist a profile scalar edit through the SAME sanctioned, DataHealth-gated
    /// write path as every other canonical write (§8): load existing → defensive
    /// `buildCleanAppDataView` re-validation → backup-before-overwrite → atomic save
    /// → honest fail. NEVER writes on previews/tests (no live store). Honest status,
    /// no fake success. Returns true iff the edit committed.
    @discardableResult
    func saveProfileEdit(_ edited: UserProfile) -> Bool {
        guard isLive else { saveStatus = .failed("当前环境不可保存"); return false }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
        guard let store else { saveStatus = .failed("没有可写入的本机存储"); return false }
        let writer = CanonicalSessionWriter(store: store)
        do {
            try writer.updateProfile(edited) { candidate in
                // Defensive §10 gate: re-encode → re-decode (re-runs the SchemaVersion
                // guard) → DataHealth clean view; accept ONLY if the edited profile
                // survives byte-identical (canonical emit is key-order-independent).
                // No fake success — an invariant-breaking candidate is never written.
                guard let bytes = try? candidate.canonicalJSONData(),
                      let reDecoded = try? AppData(decoding: bytes) else { return false }
                let cleaned = buildCleanAppDataView(reDecoded)
                guard let a = try? cleaned.raw.userProfile.encoded().canonicalJSONData(),
                      let b = try? edited.encoded().canonicalJSONData() else { return false }
                return a == b
            }
            saveStatus = .saved
            reload()   // refresh every section (and other tabs on next appear) from fresh truth
            return true
        } catch {
            saveStatus = .failed(Self.saveErrorMessage(error))
            return false
        }
    }

    // MARK: - EDIT-2: display-unit preference edit (sanctioned, DataHealth-gated write)

    /// Honest in-RAM status of the most recent display-unit save (§15.4) — SEPARATE
    /// from `saveStatus` so a unit toggle never surfaces a confirmation in the profile
    /// edit section. `.idle` until the user explicitly toggles; never a fake success.
    @Published private(set) var unitSaveStatus: ProfileEditSaveStatus = .idle

    /// The display unit currently persisted in the loaded canonical document — the
    /// seed/source-of-truth for the toggle: `displayUnit` if set, else the legacy
    /// `weightUnit`, else kg. Lets the view tell a real user toggle apart from the
    /// one-time programmatic seed (skip a redundant write) and snap back on failure.
    var persistedDisplayUnit: WeightUnit {
        guard case .ready(let data) = state else { return .kg }
        return data.unitSettings.displayUnit ?? data.unitSettings.weightUnit ?? .kg
    }

    /// Persist a display-unit preference change through the SAME sanctioned,
    /// DataHealth-gated write path as every other canonical write (§8): load existing
    /// → rewrite ONLY `unitSettings.displayUnit` on the on-disk truth (weightUnit +
    /// open-bag preserved) → defensive `buildCleanAppDataView` re-validation →
    /// backup-before-overwrite → atomic save → honest fail. STORAGE STAYS KG — only
    /// the display preference is persisted. NEVER writes on previews/tests (no live
    /// store). Honest status, no fake success. Returns true iff the edit committed.
    @discardableResult
    func saveDisplayUnit(_ newUnit: WeightUnit) -> Bool {
        guard isLive else { unitSaveStatus = .failed("当前环境不可保存"); return false }
        #if os(iOS)
        if store == nil { store = JSONFileAppDataStore.applicationSupport() }
        #endif
        guard let store else { unitSaveStatus = .failed("没有可写入的本机存储"); return false }
        let writer = CanonicalSessionWriter(store: store)
        do {
            try writer.updateUnitSettings(displayUnit: newUnit) { candidate in
                // Defensive §10 gate: re-encode → re-decode (re-runs the SchemaVersion
                // guard) → DataHealth clean view; accept ONLY if the chosen display
                // unit survives AND the unitSettings object is byte-identical pre/post
                // clean (open-bag intact). No fake success — an invariant-breaking
                // candidate is never written.
                guard let bytes = try? candidate.canonicalJSONData(),
                      let reDecoded = try? AppData(decoding: bytes) else { return false }
                let cleaned = buildCleanAppDataView(reDecoded)
                guard cleaned.raw.unitSettings.displayUnit == newUnit else { return false }
                guard let a = try? cleaned.raw.unitSettings.encoded().canonicalJSONData(),
                      let b = try? candidate.unitSettings.encoded().canonicalJSONData() else { return false }
                return a == b
            }
            unitSaveStatus = .saved
            reload()   // refresh every section (and other tabs on next appear) from fresh truth
            return true
        } catch {
            unitSaveStatus = .failed(Self.saveErrorMessage(error))
            return false
        }
    }

    private static func saveErrorMessage(_ error: Error) -> String {
        guard let e = error as? CanonicalSessionWriteError else {
            return "保存失败:\(error.localizedDescription)"
        }
        switch e {
        case .existingDocumentUnreadable:
            return "本机资料无法读取,为防数据丢失未作任何改动"
        case .validationRejected:
            return "改动未通过数据校验,未保存"
        case .backupFailed:
            return "备份失败,原始数据已保留,未保存"
        case .saveFailed:
            return "写入失败,未保存"
        }
    }
}

struct ProfileRootView: View {
    @StateObject private var model: ProfileRealDataModel

    /// Display-unit preference. Seeded ONCE from the loaded unit settings on first
    /// appear; a later USER toggle PERSISTS it through the sanctioned, DataHealth-gated
    /// write (EDIT-2, `model.saveDisplayUnit`) — storage stays kg, only the display
    /// preference is saved. The one-time seed never writes (no auto-write, §8.3).
    @State private var displayUnit: WeightUnit = .kg
    @State private var didSeedDisplayUnit = false

    /// EDIT-1 two-step edit state: the surface stays #438 read-only until the user
    /// taps 「编辑个人资料」. `form` is the in-RAM edit buffer — nothing is persisted
    /// until the explicit 「保存」.
    @State private var isEditing = false
    @State private var form = ProfileEditForm()

    /// The running app constructs the default live model. `@MainActor` so it can build
    /// the main-actor-isolated model (SwiftUI always builds views on the main actor).
    @MainActor init() {
        _model = StateObject(wrappedValue: ProfileRealDataModel())
    }

    /// Previews/tests inject a pinned model (e.g. `ProfileRealDataModel(previewState:)`).
    @MainActor init(model: ProfileRealDataModel) {
        _model = StateObject(wrappedValue: model)
    }

    var body: some View {
        NavigationStack {
            List {
                // Real profile / units / screening / settings — or an honest empty /
                // degrade state — derived from the user's cleaned canonical AppData.
                profileStateSections
                // HK-1: user-gated, read-only Apple Health body-weight import.
                // Owns its own view-model; the read/write happens only on tap.
                HealthKitBodyWeightImportSection()
                // HK-2: user-gated, read-only Apple Health workout-history import.
                // Imported workouts are DERIVED/display-only (never canonical
                // training, never engine input). Owns its own view-model.
                HealthKitWorkoutImportSection()
                // HK-3: user-gated, idempotent EXPORT of native completed sessions to
                // Apple Health (the first & only write-back). Native-only — never
                // re-exports imported workouts. Owns its own view-model.
                HealthKitWorkoutExportSection()
                // N-2: user-gated, LOCAL-only weekly training reminder. Owns its
                // own view-model; scheduling happens only on tap, via the package
                // seam (no UserNotifications import / no disk here).
                TrainingReminderCard()
            }
            .navigationTitle("我的")
        }
        .task {
            // Opt the running app into the real canonical store and read it (read-only).
            model.activateLiveSourceIfNeeded()
            model.reload()
            seedDisplayUnitIfNeeded()
        }
    }

    // MARK: - State-driven profile sections

    /// The profile area, switched on the resolved read state. The HealthKit + reminder
    /// sections above are always shown regardless of profile data.
    @ViewBuilder
    private var profileStateSections: some View {
        switch model.state {
        case .ready(let data):
            profileSection(data)
            unitSection
            screeningSection(data)
            settingsSection(data)
        case .empty:
            // §15.4: empty state = title + explanation + one action. Honest "no
            // profile yet", never a page of placeholders.
            infoSection(
                title: "还没有个人资料",
                message: "本机还没有可显示的个人资料与基线。完成资料填写后会显示在这里；你也可以在下方从 Apple 健康导入最新体重。",
                actionTitle: "重试",
                action: { reloadFromTap() }
            )
        case .unavailable:
            // §15.4 + data safety: honest degrade. The document is left untouched —
            // this read path never overwrites unreadable data — and the user can retry.
            infoSection(
                title: "暂时无法读取资料",
                message: "本机资料暂时无法读取。已保留原始数据未作任何改动，可稍后重试。",
                actionTitle: "重试",
                action: { reloadFromTap() }
            )
        }
    }

    // MARK: - Sections (real data)

    /// EDIT-1: the profile section is read-only (#438) until the user taps 编辑, then
    /// shows the in-place edit form. Two-step: nothing is written until 保存.
    @ViewBuilder
    private func profileSection(_ data: ProfileDisplayData) -> some View {
        if isEditing {
            editProfileSection(data)
        } else {
            readOnlyProfileSection(data)
        }
    }

    private func readOnlyProfileSection(_ data: ProfileDisplayData) -> some View {
        let profile = data.profile
        return Section("个人资料") {
            LabeledContent("姓名", value: ProfileDisplay.text(profile.name))
            LabeledContent("性别", value: ProfileDisplay.sex(profile.sex))
            LabeledContent("年龄", value: ProfileDisplay.integer(profile.age, suffix: " 岁"))
            LabeledContent("身高", value: ProfileDisplay.height(profile.heightCm))
            LabeledContent("体重", value: ProfileDisplay.weight(profile.weightKg, unit: displayUnit))
            // DERIVED latest Apple-Health body weight (HK-1), shown ONLY when present
            // (an honest absence otherwise). Distinct from the self-entered 体重 above.
            if let latestKg = data.latestBodyWeightKg {
                LabeledContent(
                    "最新体重（Apple 健康）",
                    value: ProfileDisplay.weight(.double(latestKg), unit: displayUnit)
                )
            }
            LabeledContent("训练水平", value: ProfileDisplay.trainingLevel(profile.trainingLevel))
            LabeledContent("主要目标", value: ProfileDisplay.text(profile.primaryGoal))
            LabeledContent("每周训练", value: ProfileDisplay.integer(profile.weeklyTrainingDays, suffix: " 天"))
            LabeledContent("单次时长", value: ProfileDisplay.integer(profile.sessionDurationMin, suffix: " 分钟"))

            // Collapsed by default — keep the main list calm (AGENTS UI rules).
            DisclosureGroup("健康备注") {
                LabeledContent("既往伤病", value: ProfileDisplay.list(profile.injuryFlags))
                LabeledContent("疼痛备注", value: ProfileDisplay.list(profile.painNotes))
            }

            // EDIT-1: honest "已保存" confirmation after a successful gated write.
            if case .saved = model.saveStatus {
                Label("已保存", systemImage: "checkmark.circle")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Button("编辑个人资料") { enterEdit(data) }
        }
    }

    /// EDIT-1: in-place two-step edit of the nine profile scalar fields. 体重 is
    /// entered in the current display unit (converted to kg on save); 身高 is cm. The
    /// Apple-Health-derived 最新体重 is NOT editable here (a distinct, derived source).
    private func editProfileSection(_ data: ProfileDisplayData) -> some View {
        Section {
            TextField("姓名", text: $form.name)
            TextField("性别", text: $form.sex)
            editNumberRow("年龄", unit: "岁", text: $form.ageText, decimal: false)
            editNumberRow("身高", unit: "cm", text: $form.heightCmText, decimal: false)
            editNumberRow("体重", unit: form.unit.rawValue, text: $form.weightText, decimal: true)
            TextField("训练水平", text: $form.trainingLevel)
            TextField("主要目标", text: $form.primaryGoal)
            editNumberRow("每周训练", unit: "天", text: $form.weeklyDaysText, decimal: false)
            editNumberRow("单次时长", unit: "分钟", text: $form.sessionMinText, decimal: false)

            // No fake success (§15.4): a failed save stays in edit mode and shows why.
            if case .failed(let message) = model.saveStatus {
                Text(message).font(.footnote).foregroundStyle(.red)
            }
            HStack {
                Button("保存") { saveEdit(data) }
                    .buttonStyle(.borderedProminent)
                Spacer()
                Button("取消", role: .cancel) { cancelEdit() }
            }
        } header: {
            Text("编辑个人资料")
        } footer: {
            Text("两步编辑:改完点“保存”才会写入本机(经数据校验)。体重按上方单位输入、统一以千克存储;此处改的是你自填的体重,与“最新体重(Apple 健康)”是不同来源。")
        }
    }

    private func editNumberRow(
        _ title: String, unit: String, text: Binding<String>, decimal: Bool
    ) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(unit, text: text)
                .multilineTextAlignment(.trailing)
                .keyboardType(decimal ? .decimalPad : .numberPad)
                .frame(maxWidth: 120)
            Text(unit).foregroundStyle(.secondary)
        }
    }

    // MARK: - EDIT-1 actions (two-step 编辑 → 保存)

    private func enterEdit(_ data: ProfileDisplayData) {
        form = ProfileEditForm.seeded(from: data.profile, displayUnit: displayUnit)
        model.clearSaveStatus()
        isEditing = true
    }

    private func cancelEdit() {
        isEditing = false
        model.clearSaveStatus()
    }

    private func saveEdit(_ data: ProfileDisplayData) {
        let edited = form.applied(onto: data.profile)
        if model.saveProfileEdit(edited) {
            isEditing = false   // success → fresh read-only truth (model reloaded)
        }
        // failure: stay in edit mode; model.saveStatus carries the honest reason
    }

    private var unitSection: some View {
        Section {
            Picker("显示单位", selection: $displayUnit) {
                Text(ProfileDisplay.unitName(.kg)).tag(WeightUnit.kg)
                Text(ProfileDisplay.unitName(.lb)).tag(WeightUnit.lb)
            }
            .pickerStyle(.segmented)
            // EDIT-2: a USER toggle persists the display preference (explicit action,
            // never an auto-write — the one-time seed is filtered in persistDisplayUnit).
            .onChange(of: displayUnit) { _, newUnit in
                persistDisplayUnit(newUnit)
            }

            // EDIT-2: honest status of the unit-preference save — no fake success (§15.4).
            if case .saved = model.unitSaveStatus {
                Label("已保存", systemImage: "checkmark.circle")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            if case .failed(let message) = model.unitSaveStatus {
                Text(message).font(.footnote).foregroundStyle(.red)
            }
        } header: {
            Text("单位")
        } footer: {
            Text("重量始终以千克(kg)存储;切换显示单位会把你的偏好经数据校验保存到本机,重启后保持。")
        }
    }

    private func screeningSection(_ data: ProfileDisplayData) -> some View {
        let screening = data.screening
        return Section("筛查") {
            LabeledContent("疼痛触发", value: ProfileDisplay.list(screening.painTriggers))
            LabeledContent("受限动作", value: ProfileDisplay.list(screening.restrictedExercises))
            LabeledContent("纠正优先", value: ProfileDisplay.list(screening.correctionPriority))
        }
    }

    private func settingsSection(_ data: ProfileDisplayData) -> some View {
        let appSettings = data.appSettings
        return Section {
            LabeledContent("训练模式", value: ProfileDisplay.text(appSettings.trainingMode))
            LabeledContent("当前模板", value: ProfileDisplay.text(appSettings.selectedTemplateId))
            LabeledContent("准备度参考健康数据", value: ProfileDisplay.bool(appSettings.useHealthDataForReadiness))
        } header: {
            Text("设置")
        } footer: {
            // Honest disclosure — no fake success (master §15.4). The data above is
            // the user's REAL on-device profile, read-only (cleaned via DataHealth);
            // the 健康数据 section below has its own user-gated Apple Health import.
            Text("以上数据来自本机真实数据（经数据校验 DataHealth）。个人资料可在上方“编辑个人资料”修改并保存到本机；筛查与设置暂为只读显示。")
        }
    }

    /// Honest empty/degrade card as one List section (title + explanation + one action).
    private func infoSection(
        title: String,
        message: String,
        actionTitle: String,
        action: @escaping () -> Void
    ) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.headline)
                Text(message).font(.subheadline).foregroundStyle(.secondary)
            }
            Button(actionTitle, action: action)
        } header: {
            Text("个人资料")
        }
    }

    // MARK: - Helpers

    /// Re-run the read-only load on an explicit retry tap (picks up data imported
    /// since first appear), then re-seed the display unit.
    private func reloadFromTap() {
        model.activateLiveSourceIfNeeded()
        model.reload()
        seedDisplayUnitIfNeeded()
    }

    /// Seed the local display-unit toggle ONCE from the loaded unit settings, so a
    /// later user toggle is never clobbered by a reload.
    private func seedDisplayUnitIfNeeded() {
        guard !didSeedDisplayUnit, case .ready(let data) = model.state else { return }
        displayUnit = data.unitSettings.displayUnit ?? data.unitSettings.weightUnit ?? .kg
        didSeedDisplayUnit = true
    }

    /// EDIT-2: persist a display-unit toggle — but ONLY when it is a real user action.
    /// The one-time programmatic seed (and any pre-seed change) sets `displayUnit` to
    /// the already-persisted value, so it never triggers a write (no auto-write, §8.3).
    /// On a failed save the toggle snaps back to the persisted truth (honest, §15.4).
    private func persistDisplayUnit(_ newUnit: WeightUnit) {
        guard didSeedDisplayUnit else { return }                    // not seeded yet → ignore
        guard newUnit != model.persistedDisplayUnit else { return } // seed / no-op → skip
        if !model.saveDisplayUnit(newUnit) {
            displayUnit = model.persistedDisplayUnit                // save failed → reflect reality
        }
    }
}

#Preview("有资料") {
    ProfileRootView(model: ProfileRealDataModel(previewState: .ready(
        ProfileDisplayData(
            profile: ProfileDisplayPreviewSample.userProfile,
            unitSettings: ProfileDisplayPreviewSample.unitSettings,
            screening: ProfileDisplayPreviewSample.screeningProfile,
            appSettings: ProfileDisplayPreviewSample.appSettings,
            latestBodyWeightKg: 71.8
        )
    )))
}

#Preview("空态") {
    ProfileRootView(model: ProfileRealDataModel(previewState: .empty))
}

#Preview("不可读") {
    ProfileRootView(model: ProfileRealDataModel(previewState: .unavailable))
}

// MARK: - N-2 Training Reminders (local-only weekly reminder)
//
// A user-gated card that schedules REPEATING weekly local training reminders.
// Mirrors the HK-1 section pattern: a self-contained sub-view that owns its own
// `@StateObject` view-model, co-located here to avoid a new app file / pbxproj
// edit (the task's "尽量只编辑 ProfileRootView" / no-new-file preference). The
// view holds NO business logic — all scheduling lives in the pure
// `TrainingReminderPolicy` + the `TrainingReminderScheduling` seam; the model is
// thin glue. It never imports UserNotifications and never touches disk
// (FileManager / UserDefaults): iOS persists the repeating notifications and the
// live state is read back from the notification center.

/// Honest in-RAM status for the training-reminder card — no fake success
/// (master §15.4).
private enum TrainingReminderStatus: Equatable {
    case idle                       // not opted in / auth unknown
    case unavailable                // previews / tests (no live scheduler)
    case requesting                 // authorization in flight
    case authorized                 // authorized, nothing scheduled
    case scheduled(TrainingReminderSchedule)
    case denied
    case failed(String)
}

@MainActor
private final class TrainingReminderModel: ObservableObject {
    @Published private(set) var status: TrainingReminderStatus = .idle
    /// Picker state — in-RAM only, NEVER persisted; re-seeded from the live pending
    /// schedule on appear (iOS persists the repeating notifications, not the app).
    @Published var selectedWeekdays: Set<Int> = []
    @Published var timeOfDay: Date
    @Published private(set) var nextFireText: String?

    /// The local scheduler. Injectable for previews/tests (nil → not opted in); the
    /// running app opts into the real `UserNotificationsTrainingReminderScheduler`
    /// from the card's `.task`.
    private var scheduler: TrainingReminderScheduling?
    private let now: () -> Date
    private let calendar: Calendar

    init(
        scheduler: TrainingReminderScheduling? = nil,
        now: @escaping () -> Date = { Date() },
        calendar: Calendar = .current
    ) {
        self.scheduler = scheduler
        self.now = now
        self.calendar = calendar
        self.timeOfDay = calendar.date(bySettingHour: 19, minute: 0, second: 0, of: now()) ?? now()
    }

    /// Opt the RUNNING app into the real local scheduler (idempotent). Previews/
    /// tests leave it unset so they never touch UserNotifications.
    func activateLiveSchedulerIfNeeded() {
        #if os(iOS)
        if scheduler == nil { scheduler = UserNotificationsTrainingReminderScheduler() }
        #endif
    }

    var isAuthorized: Bool {
        switch status {
        case .authorized, .scheduled: return true
        default: return false
        }
    }

    /// Show the weekday/time pickers once authorized.
    var showsPickers: Bool { isAuthorized }

    /// Offer the enable button before reminders are authorized.
    var showsEnableButton: Bool {
        switch status {
        case .idle, .denied, .failed, .unavailable: return true
        case .requesting, .authorized, .scheduled: return false
        }
    }

    private var hour: Int { calendar.component(.hour, from: timeOfDay) }
    private var minute: Int { calendar.component(.minute, from: timeOfDay) }

    /// On appear: opt in + reflect the LIVE persisted schedule. An empty pending
    /// set keeps `.idle` (honest — we never prompt without a tap).
    func refresh() async {
        activateLiveSchedulerIfNeeded()
        guard let scheduler else { status = .unavailable; return }
        if let schedule = await scheduler.pendingSchedule() {
            apply(schedule)
        }
    }

    /// User-gated: request LOCAL notification authorization and reveal the pickers.
    func enable() async {
        guard let scheduler else { status = .unavailable; return }
        status = .requesting
        switch await scheduler.requestAuthorization() {
        case .authorized:
            if let schedule = await scheduler.pendingSchedule() {
                apply(schedule)
            } else {
                status = .authorized
            }
        case .denied, .notDetermined:
            status = .denied
        case .unavailable:
            status = .unavailable
        }
    }

    /// Replace the scheduled reminders with the current picker selection. Reads the
    /// live schedule back so the displayed state always reflects reality. Honest
    /// `.failed` on a thrown error — never a fabricated success.
    func save() async {
        guard let scheduler, isAuthorized else { return }
        let requests = TrainingReminderPolicy.makeReminders(
            weekdays: selectedWeekdays, hour: hour, minute: minute
        )
        do {
            try await scheduler.replaceReminders(requests)
            if let schedule = await scheduler.pendingSchedule() {
                apply(schedule)
            } else {
                status = .authorized
                nextFireText = nil
            }
        } catch {
            status = .failed(error.localizedDescription)
        }
    }

    /// Turn reminders off (cancel all of ours). Stays authorized so the user can
    /// re-save without re-prompting.
    func disable() async {
        guard let scheduler, isAuthorized else { return }
        await scheduler.cancelAll()
        status = .authorized
        nextFireText = nil
    }

    private func apply(_ schedule: TrainingReminderSchedule) {
        selectedWeekdays = schedule.weekdays
        timeOfDay = calendar.date(
            bySettingHour: schedule.hour, minute: schedule.minute, second: 0, of: now()
        ) ?? timeOfDay
        status = .scheduled(schedule)
        nextFireText = Self.nextFireText(schedule: schedule, now: now(), calendar: calendar)
    }

    private static func nextFireText(schedule: TrainingReminderSchedule, now: Date, calendar: Calendar) -> String? {
        guard let date = TrainingReminderPolicy.nextFireDate(
            weekdays: schedule.weekdays, hour: schedule.hour, minute: schedule.minute,
            now: now, calendar: calendar
        ) else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.setLocalizedDateFormatFromTemplate("EEEE HH:mm")
        return formatter.string(from: date)
    }
}

private struct TrainingReminderCard: View {
    @StateObject private var model = TrainingReminderModel()

    /// Display order (Monday-first, Chinese) → Calendar weekday (1 = Sun … 7 = Sat).
    private static let weekdays: [(weekday: Int, label: String)] = [
        (2, "一"), (3, "二"), (4, "三"), (5, "四"), (6, "五"), (7, "六"), (1, "日"),
    ]

    var body: some View {
        Section {
            if model.showsEnableButton {
                Button {
                    Task { await model.enable() }
                } label: {
                    HStack {
                        Label("开启训练提醒", systemImage: "bell.badge")
                        Spacer()
                        if case .requesting = model.status { ProgressView() }
                    }
                }
            }

            if model.showsPickers {
                weekdayRow
                DatePicker("提醒时间", selection: $model.timeOfDay, displayedComponents: .hourAndMinute)
                actionRow
            }

            if let line = statusLine {
                Text(line)
                    .font(.footnote)
                    .foregroundStyle(statusIsError ? .red : .secondary)
            }
        } header: {
            Text("训练提醒")
        } footer: {
            Text("按选定的星期与时间，在本机重复提醒你训练 · 不联网 · 无远程推送。提醒由系统在设备上保存与触发。")
        }
        .task { await model.refresh() }
    }

    private var weekdayRow: some View {
        HStack(spacing: 6) {
            ForEach(Self.weekdays, id: \.weekday) { day in
                let isOn = model.selectedWeekdays.contains(day.weekday)
                Button {
                    if isOn { model.selectedWeekdays.remove(day.weekday) }
                    else { model.selectedWeekdays.insert(day.weekday) }
                } label: {
                    Text(day.label)
                        .font(.footnote.weight(.medium))
                        .frame(maxWidth: .infinity, minHeight: 32)
                }
                .buttonStyle(.bordered)
                .tint(isOn ? .accentColor : .secondary)
            }
        }
    }

    private var actionRow: some View {
        HStack {
            Button("保存提醒") {
                Task { await model.save() }
            }
            .buttonStyle(.borderedProminent)
            Spacer()
            if case .scheduled = model.status {
                Button("关闭训练提醒", role: .destructive) {
                    Task { await model.disable() }
                }
            }
        }
    }

    private var statusIsError: Bool {
        if case .failed = model.status { return true }
        return false
    }

    private var statusLine: String? {
        switch model.status {
        case .idle:
            return "开启后，可选择星期与时间，在本机重复提醒你训练。"
        case .unavailable:
            return "当前环境不安排通知。"
        case .requesting:
            return "正在请求通知授权…"
        case .authorized:
            return model.selectedWeekdays.isEmpty
                ? "已授权 · 选择至少一天并点“保存提醒”。"
                : "已授权 · 点“保存提醒”以安排本机提醒。"
        case .scheduled(let schedule):
            var line = "已设 · 每周 \(Self.weekdaysLabel(schedule.weekdays)) \(Self.timeLabel(schedule))"
            if let next = model.nextFireText { line += " · 下次：\(next)" }
            return line
        case .denied:
            return "通知未授权 · 可在系统设置中开启后再试。"
        case .failed(let message):
            return "操作失败：\(message)"
        }
    }

    private static func weekdaysLabel(_ selected: Set<Int>) -> String {
        weekdays.filter { selected.contains($0.weekday) }.map(\.label).joined(separator: "、")
    }

    private static func timeLabel(_ schedule: TrainingReminderSchedule) -> String {
        String(format: "%02d:%02d", schedule.hour, schedule.minute)
    }
}

// MARK: - HK-2 Apple Health Workout-History Import (read-only, derived/display-only)
//
// A user-gated card that reads recent Apple Health WORKOUTS (type / start–end /
// duration / energy) and stores them as DERIVED, source-tagged
// (`source: "healthkit_import"`) records in `AppData.importedWorkoutSamples` —
// a bag SEPARATE from canonical `history`. These rows are DISPLAY-ONLY: they are
// never canonical native sessions and never feed the `IronPathTrainingDecision`
// engine (readiness / e1RM). Mirrors the HK-1 section pattern and is co-located in
// `ProfileRootView` to avoid a new app file / `project.pbxproj` edit (the N-2
// no-new-file precedent). The view holds NO business logic — the import + gated
// write live in the packages; the model is thin glue. It never imports HealthKit
// (it uses the `WorkoutSampleSource` seam) and never touches FileManager directly
// (the store does); the real `HealthKitWorkoutSource` is constructed only
// `#if os(iOS)`.

/// Honest in-RAM status for the workout-history import — no fake success
/// (master §15.4).
private enum WorkoutImportStatus: Equatable {
    case idle
    case importing
    case imported(count: Int)
    case noData
    case unavailable
    case failed(String)
}

@MainActor
private final class HealthKitWorkoutImportModel: ObservableObject {
    @Published private(set) var status: WorkoutImportStatus = .idle
    /// The imported workout summaries currently shown (read back from the canonical
    /// store after a write, or on appear). Display-only.
    @Published private(set) var workouts: [ImportedWorkoutSample] = []

    /// The Apple-Health read source. Injectable for previews/tests (nil → not opted
    /// in). The running app opts into the real `HealthKitWorkoutSource` on first tap.
    private var source: WorkoutSampleSource?
    /// The sanctioned canonical AppData store (source of truth, §8). Injectable; nil
    /// until opted in.
    private var appDataStore: AppDataStore?
    /// Injectable import-time clock. Only invoked on the live import path.
    private let now: () -> Date

    init(
        source: WorkoutSampleSource? = nil,
        appDataStore: AppDataStore? = nil,
        now: @escaping () -> Date = { Date() }
    ) {
        self.source = source
        self.appDataStore = appDataStore
        self.now = now
    }

    private func optInToStoreIfNeeded() {
        if appDataStore == nil { appDataStore = JSONFileAppDataStore.applicationSupport() }
    }

    /// Opt the RUNNING app into the real Apple-Health source + the canonical store.
    /// Idempotent; called lazily from the first import tap so previews/tests stay
    /// free of HealthKit + disk.
    private func optInToLiveSourcesIfNeeded() {
        #if os(iOS)
        if source == nil { source = HealthKitWorkoutSource() }
        optInToStoreIfNeeded()
        #endif
    }

    /// Read-only: reflect already-imported workouts on appear. No HealthKit, no auth
    /// prompt, no write. Previews/tests that never opt into a store stay empty.
    func loadExisting() {
        #if os(iOS)
        optInToStoreIfNeeded()
        #endif
        guard let appDataStore, appDataStore.hasExistingFile,
              let loaded = try? appDataStore.load() else { return }
        workouts = loaded.importedWorkoutSamples
    }

    /// User-gated import: request read authorization, read recent workouts, and
    /// append them to canonical `AppData.importedWorkoutSamples` (DERIVED,
    /// display-only) through the HK-1/iOS-17A DataHealth-gated batch write path.
    func importWorkouts() async {
        optInToLiveSourcesIfNeeded()
        guard let source, let appDataStore else {
            status = .unavailable   // previews/tests never opt in
            return
        }
        status = .importing
        do {
            let samples = try await HealthKitWorkoutImporter(source: source)
                .importRecentWorkouts(importedAt: now())
            guard !samples.isEmpty else {
                // No workouts (none recorded, or read access not granted — Apple
                // Health hides denial). Honest "nothing to import".
                status = .noData
                refreshDisplay(from: appDataStore)
                return
            }
            let importedIds = Set(samples.compactMap { $0.id })
            let writer = CanonicalSessionWriter(store: appDataStore)
            try writer.appendImportedWorkoutSamples(samples) { candidate in
                // DataHealth gate (§10): route the candidate through the read-only
                // clean-view ingress (no mutation, no auto-repair) and accept ONLY
                // when every imported workout survives the clean view's read intact.
                // No fake success — a rejected candidate is never written.
                guard let result = try? processIncomingAppData(
                    appData: candidate,
                    source: .importRestore,
                    options: AppDataIngressOptions(allowMutation: false, allowAutoRepair: false)
                ) else { return false }
                let present = Set(result.cleanView.raw.importedWorkoutSamples.compactMap { $0.id })
                return importedIds.isSubset(of: present)
            }
            refreshDisplay(from: appDataStore)
            status = .imported(count: samples.count)
        } catch {
            // No fake success: the on-disk canonical document is left intact
            // (backup-before-overwrite / atomic save guarantee no partial state).
            status = .failed(error.localizedDescription)
        }
    }

    private func refreshDisplay(from store: AppDataStore) {
        if let loaded = try? store.load() { workouts = loaded.importedWorkoutSamples }
    }
}

private struct HealthKitWorkoutImportSection: View {
    @StateObject private var model = HealthKitWorkoutImportModel()

    var body: some View {
        Section {
            Button {
                Task { await model.importWorkouts() }
            } label: {
                HStack {
                    Label("从 Apple 健康导入训练历史", systemImage: "figure.run.square.stack")
                    Spacer()
                    if isImporting { ProgressView() }
                }
            }
            .disabled(isImporting)

            if let line = statusLine {
                Text(line)
                    .font(.footnote)
                    .foregroundStyle(statusIsError ? .red : .secondary)
            }

            ForEach(model.workouts.indices, id: \.self) { index in
                workoutRow(model.workouts[index])
            }
        } header: {
            Text("Apple 健康训练历史")
        } footer: {
            Text("仅在你授权后，从 Apple 健康只读读取过往训练摘要（类型 / 时间 / 时长 / 能量 / 距离 / 平均·最高心率），作为“来自 Apple 健康”的派生记录存入本机。读取心率需要你额外授权；数据不出本设备，绝不写回 Apple 健康；这些记录仅供查看，不计入训练历史，也不影响训练计划与准备度。")
        }
        .task { model.loadExisting() }
    }

    private func workoutRow(_ workout: ImportedWorkoutSample) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(HealthKitWorkoutMapper.displayLabel(forWorkoutType: workout.workoutType))
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text("来自 Apple 健康")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Text(Self.subtitle(workout))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private static func subtitle(_ workout: ImportedWorkoutSample) -> String {
        var parts: [String] = []
        // ISO date portion only (e.g. "2026-05-27") — honest, parser-free.
        if let iso = workout.startDate, iso.count >= 10 { parts.append(String(iso.prefix(10))) }
        if let minutes = workout.durationMin?.doubleValue {
            parts.append("\(Int(minutes.rounded())) 分钟")
        }
        if let kcal = workout.activeEnergyKcal?.doubleValue {
            parts.append("\(Int(kcal.rounded())) 千卡")
        }
        // HK-2b: distance + heart rate, shown ONLY when the import recorded them
        // (a missing field is honestly absent, never a fabricated 0).
        if let meters = workout.distanceMeters?.doubleValue {
            parts.append(Self.distanceText(meters))
        }
        if let hr = Self.heartRateText(avg: workout.avgHeartRate?.doubleValue,
                                       max: workout.maxHeartRate?.doubleValue) {
            parts.append(hr)
        }
        return parts.isEmpty ? "—" : parts.joined(separator: " · ")
    }

    /// Distance for display: kilometers (1 decimal) at ≥1 km, otherwise whole meters.
    /// Pure presentation — the stored value stays SI meters.
    private static func distanceText(_ meters: Double) -> String {
        if meters >= 1000 {
            return String(format: "%.1f 公里", meters / 1000)
        }
        return "\(Int(meters.rounded())) 米"
    }

    /// Heart rate for display: "心率 平均/最高 bpm" when both are present, otherwise
    /// whichever was recorded; nil when neither (the row simply omits it).
    private static func heartRateText(avg: Double?, max: Double?) -> String? {
        switch (avg, max) {
        case let (avg?, max?):
            return "心率 \(Int(avg.rounded()))/\(Int(max.rounded())) bpm"
        case let (avg?, nil):
            return "平均心率 \(Int(avg.rounded())) bpm"
        case let (nil, max?):
            return "最高心率 \(Int(max.rounded())) bpm"
        case (nil, nil):
            return nil
        }
    }

    private var isImporting: Bool {
        if case .importing = model.status { return true }
        return false
    }

    private var statusIsError: Bool {
        if case .failed = model.status { return true }
        return false
    }

    private var statusLine: String? {
        switch model.status {
        case .idle:
            return model.workouts.isEmpty ? "点按上方按钮，从 Apple 健康导入过往训练摘要。" : nil
        case .importing:
            return nil
        case .imported(let count):
            return "已从 Apple 健康读取 \(count) 条训练。"
        case .noData:
            return "Apple 健康中没有可导入的训练，或未授权读取。"
        case .unavailable:
            return "当前环境不读取健康数据。"
        case .failed(let message):
            return "导入失败：\(message)"
        }
    }
}

// MARK: - HK-3 Apple Health Workout EXPORT (write-back, user-triggered, idempotent)
//
// A user-gated card that EXPORTS IronPath's own native completed sessions
// (`AppData.history`) to Apple Health as `HKWorkout`s — the first and only write-back
// in the HealthKit boundary. Mirrors the HK-2 import section, co-located here to avoid
// a new app file / `project.pbxproj` edit (the N-2 / HK-2 precedent). The view holds NO
// business logic: the NATIVE-ONLY mapping is the pure `HealthKitWorkoutExporter`; the
// real `HKWorkout` build + `HKHealthStore.save` is the `#if os(iOS)`
// `HealthKitWorkoutSource` (behind the `WorkoutExportSink` seam); the model is thin
// glue. It never imports HealthKit and never reads the DERIVED `importedWorkoutSamples`
// bag (structural no-loop-back). Export happens ONLY on an explicit tap (never
// automatically), is idempotent (a session already in Health is skipped, queried by a
// metadata tag), and is device-local (no network/cloud). Honest status — duplicates /
// failures are shown, never a fake success (master §15.4).

/// Honest in-RAM status for the workout export — no fake success (master §15.4).
private enum WorkoutExportStatus: Equatable {
    case idle
    case exporting
    case exported(WorkoutExportSummary)
    case noData
    case unavailable
    case failed(String)
}

@MainActor
private final class HealthKitWorkoutExportModel: ObservableObject {
    @Published private(set) var status: WorkoutExportStatus = .idle

    /// The Apple-Health export sink. Injectable for previews/tests (nil → not opted in);
    /// the running app opts into the real `HealthKitWorkoutSource` on first tap.
    private var sink: WorkoutExportSink?
    /// The sanctioned canonical AppData store (source of truth, §8). READ-ONLY here —
    /// export reads native history and NEVER writes AppData. Injectable; nil until opted in.
    private var appDataStore: AppDataStore?

    init(sink: WorkoutExportSink? = nil, appDataStore: AppDataStore? = nil) {
        self.sink = sink
        self.appDataStore = appDataStore
    }

    /// Opt the RUNNING app into the real Apple-Health export sink + the canonical store.
    /// Idempotent; called lazily from the first export tap so previews/tests stay free of
    /// HealthKit + disk.
    private func optInToLiveSourcesIfNeeded() {
        #if os(iOS)
        if sink == nil { sink = HealthKitWorkoutSource() }
        if appDataStore == nil { appDataStore = JSONFileAppDataStore.applicationSupport() }
        #endif
    }

    /// User-gated export: read native completed sessions from canonical `AppData.history`,
    /// map them (NATIVE-ONLY) to export requests, and write any not-yet-exported session to
    /// Apple Health as an `HKWorkout`. Idempotent + device-local. Honest status.
    func exportWorkouts() async {
        optInToLiveSourcesIfNeeded()
        guard let sink, let appDataStore else {
            status = .unavailable   // previews/tests never opt in
            return
        }
        status = .exporting
        // Source = canonical native history ONLY (never the derived importedWorkoutSamples
        // bag → structural no-loop-back).
        let sessions = (try? appDataStore.load())?.history ?? []
        let requests = HealthKitWorkoutExporter.exportRequests(forNativeHistory: sessions)
        guard !requests.isEmpty else {
            status = .noData
            return
        }
        do {
            try await sink.requestExportAuthorization()
            let summary = try await sink.export(requests)
            status = .exported(summary)
        } catch {
            // No fake success — a thrown error (e.g. authorization could not be made) is
            // surfaced honestly; nothing partial is claimed.
            status = .failed(error.localizedDescription)
        }
    }
}

private struct HealthKitWorkoutExportSection: View {
    @StateObject private var model = HealthKitWorkoutExportModel()

    var body: some View {
        Section {
            Button {
                Task { await model.exportWorkouts() }
            } label: {
                HStack {
                    Label("写回 Apple 健康", systemImage: "square.and.arrow.up")
                    Spacer()
                    if isExporting { ProgressView() }
                }
            }
            .disabled(isExporting)

            if let line = statusLine {
                Text(line)
                    .font(.footnote)
                    .foregroundStyle(statusIsError ? .red : .secondary)
            }
        } header: {
            Text("写回 Apple 健康")
        } footer: {
            Text("仅在你点按后，把本机已完成的训练写回 Apple 健康（作为训练记录）。只写训练、绝不写其它健康数据；重复写回会按会话标识自动跳过（幂等）；数据不出本设备、不联网。从 Apple 健康导入的训练绝不会被再次写回。")
        }
    }

    private var isExporting: Bool {
        if case .exporting = model.status { return true }
        return false
    }

    private var statusIsError: Bool {
        switch model.status {
        case .failed:
            return true
        case .exported(let summary):
            return summary.failed > 0
        default:
            return false
        }
    }

    private var statusLine: String? {
        switch model.status {
        case .idle:
            return "点按上方按钮，把本机已完成的训练写回 Apple 健康。"
        case .exporting:
            return nil
        case .exported(let summary):
            return Self.summaryLine(summary)
        case .noData:
            return "本机暂无可写回的已完成训练。"
        case .unavailable:
            return "当前环境不写回健康数据。"
        case .failed(let message):
            return "写回失败：\(message)"
        }
    }

    /// Honest one-line summary of an export run (exported / skipped-duplicate / failed).
    private static func summaryLine(_ summary: WorkoutExportSummary) -> String {
        if summary.exported == 0 && summary.failed == 0 && summary.skippedDuplicate > 0 {
            return "已全部写回过 · 跳过 \(summary.skippedDuplicate) 条重复。"
        }
        var parts: [String] = ["已写回 \(summary.exported) 条"]
        if summary.skippedDuplicate > 0 { parts.append("跳过 \(summary.skippedDuplicate) 条重复") }
        if summary.failed > 0 { parts.append("失败 \(summary.failed) 条") }
        return parts.joined(separator: " · ") + "。"
    }
}
