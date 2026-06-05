// FocusModeShellView — iOS-8 Native Local Training MVP Mega Migration V1.
//
// Top-level SwiftUI shell for the native Focus demo. THREE stages, driven by
// FocusModeMvpState.stage:
//
//   .plan
//     Header, scenario picker (普通/回归保底/严重恢复/减载周), explanation,
//     FocusModeStatusSurfaceView (准备度/风险/训练调整/减载档位 — iOS-8 live deload),
//     today exercise list, "开始训练" / "重置样例", footer.
//
//   .inSession
//     Back link + scenario badge, FocusSessionProgressView (aggregate),
//     current-exercise FocusSetChecklistView ("完成本组" clamps in memory),
//     上一动作/下一动作, status surface, FocusSessionCompletionView
//     ("完成本次训练" -> in-RAM snapshot), "重置样例"/"结束训练", footer.
//
//   .completed
//     FocusSavedSessionPreviewView — the in-RAM saved-session preview
//     (completed exercises, sets, sessionIntent, activePhase, deload, timestamp),
//     "再来一次".
//
// 100% in-memory; never writes AppData, never persists to disk. The slice is
// recomputed via FocusModePreviewData on each scenario change — same scenario
// in, same slice out (deterministic). On-disk JSON save is a deferred follow-up.

import SwiftUI
import IronPathTrainingDecision

struct FocusModeShellView: View {
    @StateObject private var state = FocusModeMvpState()
    // N-1: LOCAL rest-timer reminder view-model, kept SEPARATE from the in-RAM
    // FocusModeMvpState so the state's no-disk / no-platform-dep guards stay
    // intact. It owns the LOCAL notification scheduler via the IronPathNotifications
    // seam; previews/tests never opt into a live scheduler (status stays idle).
    @StateObject private var restReminder = RestReminderModel()
    // FU-1: the REAL canonical-AppData read for today's training (the IO + clean-view seam
    // lives in `FocusModeLiveData`, NOT in this presentation shell — the shell stays free of any
    // AppData / DataHealth / engine-clean-input token, mirroring how the sample slice is supplied
    // by `FocusModePreviewData`). The running app reads the live store; previews/tests pin a state
    // and drive the deterministic sample path.
    @StateObject private var live: FocusModeLiveData

    /// The running app constructs the default live model. `@MainActor` so it can build the
    /// main-actor-isolated view-model (SwiftUI always builds views on the main actor); `state`
    /// and `restReminder` keep their inline defaults.
    @MainActor init() {
        _live = StateObject(wrappedValue: FocusModeLiveData())
    }

    /// Previews/tests inject a pinned live model (e.g. `FocusModeLiveData(previewState:)`). A
    /// pinned-empty model (the default preview) keeps `isLiveLoadEnabled == false`, so the shell
    /// drives the deterministic `FocusModePreviewData` sample + the scenario picker exactly as
    /// before — no device store is read.
    @MainActor init(live: FocusModeLiveData) {
        _live = StateObject(wrappedValue: live)
    }

    /// FU-1: the resolved live training plan when the running app has REAL data; nil in
    /// previews/tests (the deterministic sample path) AND for the live empty/unavailable states
    /// (which the body renders as honest cards, so the sample fallback below is never reached live).
    private var livePlan: FocusTrainingPlan? {
        if case .ready(let plan) = live.state { return plan }
        return nil
    }

    /// The slice the surface renders: the REAL resolved slice when live data is ready, else the
    /// deterministic sample (previews/tests). In the running app, when there is no live plan the
    /// body shows an honest empty/unavailable card and never reads this — so the sample is a
    /// preview-only fallback, never live sample data leaking onto a real device.
    private var slice: TrainingDecisionCoreSlice {
        if let plan = livePlan { return plan.slice }
        return FocusModePreviewData.sampleCoreSlice(for: state.selectedScenario)
    }

    private var rows: [FocusModeExerciseRow] {
        // Live: the resolved today's-template exercises; preview/test: the deterministic sample.
        let templates = livePlan?.templateExercises ?? FocusModePreviewData.sampleTemplateExercises()
        return Self.buildRows(slice: slice, templates: templates)
    }

    private var totalTargetSets: Int {
        rows.reduce(0) { $0 + $1.targetSets }
    }

    private var totalCompletedSets: Int {
        state.totalCompletedSets(for: rows.map(\.id))
    }

    private var currentRow: FocusModeExerciseRow? {
        guard !rows.isEmpty else { return nil }
        let clamped = min(max(0, state.selectedExerciseIndex), rows.count - 1)
        return rows[clamped]
    }

    /// Engine-derived completed lines for the in-RAM completion snapshot.
    private var completedLines: [FocusCompletedExerciseLine] {
        rows.map { row in
            FocusCompletedExerciseLine(
                id: row.id,
                name: row.name,
                role: roleLabel(row.role),
                completedSets: state.completedSets(for: row.id),
                targetSets: row.targetSets
            )
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                stageContent
                footer
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(Color(.systemBackground).ignoresSafeArea())
        // iOS-9: load the latest saved session + history from the app-local JSON
        // store on launch. iOS-14: opt the RUNNING app into the real wall-clock
        // first, so saved timestamps + history grouping reflect real days (tests/
        // previews keep the deterministic default). iOS-17A: opt the RUNNING app
        // into canonical-AppData persistence (the source of truth, §8) so completed
        // sessions are written to the real on-disk document; previews/tests leave
        // it unset and never touch the canonical store.
        .task {
            // FU-1: opt the running app into the SAME sanctioned canonical store the
            // completion write uses and read TODAY'S TRAINING from it (read-only). The
            // slice + today list now come from the user's real data, not the sample.
            // Previews/tests pin their state and never touch the on-disk document.
            live.activateLiveSourceIfNeeded()
            live.reload()
            state.useSystemClock()
            state.useApplicationSupportAppDataStore()
            state.loadSavedSessions()
            // N-1: opt the running app into the real LOCAL notification scheduler
            // (previews/tests stay unopted). Authorization itself stays user-gated
            // by the RestReminderSection button — this only wires the live scheduler.
            restReminder.activateLiveSchedulerIfNeeded()
        }
    }

    /// FU-1: in the RUNNING app, when there is no live training plan (no canonical file →
    /// `.empty`; a present-but-unreadable document → `.unavailable`) the surface shows an honest
    /// card — never sample data, never a fabricated session. Otherwise — and ALWAYS in
    /// previews/tests (`isLiveLoadEnabled == false`) — it drives the plan → in-session →
    /// completed flow over the resolved (or deterministic sample) slice.
    @ViewBuilder
    private var stageContent: some View {
        if live.isLiveLoadEnabled, livePlan == nil {
            switch live.state {
            case .unavailable:
                unavailableCard
            default:
                emptyCard
            }
        } else {
            switch state.stage {
            case .plan:
                planBody
            case .inSession:
                inSessionBody
            case .completed:
                completedBody
            }
        }
    }

    // MARK: - FU-1 honest live states (no canonical data / unreadable)

    /// §15.4 empty state: no canonical training data yet. Honest "no data", never a fabricated
    /// today's training. A retry re-reads the store (e.g. right after first-launch seeding).
    private var emptyCard: some View {
        infoCard(
            title: "还没有训练数据",
            message: "本机还没有可用的训练数据。设置好训练计划或完成首次训练后，这里会根据你本机的真实记录显示今日训练。",
            actionTitle: "重试",
            action: { live.reload() }
        )
    }

    /// §15.4 degrade: a canonical document exists but is unreadable. The document is left
    /// untouched (this surface never overwrites unreadable data) and the user can retry.
    private var unavailableCard: some View {
        infoCard(
            title: "暂时无法读取数据",
            message: "本机训练数据暂时无法读取。已保留原始数据未作任何改动，可稍后重试。",
            actionTitle: "重试",
            action: { live.reload() }
        )
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

    // MARK: - Completed preview

    @ViewBuilder
    private var completedBody: some View {
        if let summary = state.completedSummary {
            VStack(alignment: .leading, spacing: 12) {
                saveStatusBanner
                canonicalSaveBanner
                FocusSavedSessionPreviewView(
                    summary: summary,
                    saved: state.saveStatus == .saved,
                    onStartNew: {
                        state.startNewSession()
                        // N-1: starting over clears any pending rest reminder.
                        Task { await restReminder.cancelRestReminder() }
                    }
                )
            }
        } else {
            planBody
        }
    }

    /// Honest save feedback on the completed screen. `.failed` never reads as
    /// success — it shows the error and notes the in-RAM preview still works.
    @ViewBuilder
    private var saveStatusBanner: some View {
        switch state.saveStatus {
        case .saved:
            Text("已保存到本机 · 可在计划页查看历史")
                .font(.footnote)
                .foregroundStyle(.green)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.green.opacity(0.12)))
        case .failed(let message):
            Text("本地保存失败：\(message) · 本次预览仍可用")
                .font(.footnote)
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.red.opacity(0.12)))
        case .idle:
            EmptyView()
        }
    }

    /// iOS-17A: honest feedback for the CANONICAL AppData write (the source of
    /// truth, §8), independent of the LocalSnapshot history banner above. A
    /// canonical failure NEVER reads as success; `.skipped` honestly states that
    /// nothing was written because no per-set detail was logged; `.idle` (previews/
    /// tests not opted into canonical persistence) shows nothing.
    @ViewBuilder
    private var canonicalSaveBanner: some View {
        switch state.canonicalSaveStatus {
        case .saved:
            Text("逐组成绩已写入训练记录（本机 · 源数据）")
                .font(.footnote)
                .foregroundStyle(.green)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.green.opacity(0.12)))
        case .skipped:
            Text("本次未记录逐组成绩（未填写重量/次数/RIR）")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.10)))
        case .failed(let message):
            Text("训练记录写入失败：\(message) · 本机历史与预览仍可用")
                .font(.footnote)
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.red.opacity(0.12)))
        case .idle:
            EmptyView()
        }
    }

    // MARK: - Plan mode

    private var planBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            header

            // FU-1: the deterministic-sample scenario picker is a previews/tests-only affordance.
            // In the LIVE app the slice comes from the user's real data, so the picker is hidden
            // (it would only swap sample inputs). The source is KEPT for previews/tests (and the
            // static guard that pins the segmented FocusModeSampleScenario picker).
            if !live.isLiveLoadEnabled {
                scenarioSelector
            }

            FocusModeStatusSurfaceView(slice: slice)

            exerciseListSection

            actionStack

            FocusSavedSessionHistoryView(state: state)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("IronPath Native Focus")
                .font(.largeTitle.weight(.semibold))
            Text("Native SwiftUI · TrainingDecision V1")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var scenarioSelector: some View {
        VStack(alignment: .leading, spacing: 6) {
            Picker("样例", selection: scenarioBinding) {
                ForEach(FocusModeSampleScenario.allCases) { item in
                    Text(item.shortLabel).tag(item)
                }
            }
            .pickerStyle(.segmented)

            Text(state.selectedScenario.explanation)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var scenarioBinding: Binding<FocusModeSampleScenario> {
        Binding(
            get: { state.selectedScenario },
            set: { state.setScenario($0) }
        )
    }

    private var exerciseListSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("今日动作")
                    .font(.headline)
                Spacer()
                if let minSets = slice.minTargetSets {
                    Text("最少 \(minSets) 组")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            if rows.isEmpty {
                Text("没有可显示的动作")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(rows) { row in
                        FocusModeExerciseCard(
                            row: row,
                            completedSets: state.completedSets(for: row.id)
                        )
                    }
                }
            }
        }
    }

    private var actionStack: some View {
        VStack(spacing: 8) {
            Button {
                state.startSession()
            } label: {
                Text("开始训练")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(rows.isEmpty)

            Button {
                state.resetProgress()
            } label: {
                Text("重置样例")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - In-session mode

    private var inSessionBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            inSessionHeader

            if state.isRestoredDraft {
                restoredDraftBanner
            }

            FocusSessionProgressView(
                totalCompleted: totalCompletedSets,
                totalTarget: totalTargetSets
            )

            currentExerciseSection

            navigationStack

            RestReminderSection(model: restReminder)

            FocusModeStatusSurfaceView(slice: slice)

            FocusSessionCompletionView(
                totalCompleted: totalCompletedSets,
                totalTarget: totalTargetSets,
                onCompleteSession: {
                    state.completeSession(slice: slice, lines: completedLines)
                    // N-1: finishing the session cancels any pending rest reminder.
                    Task { await restReminder.cancelRestReminder() }
                }
            )

            sessionActionStack
        }
    }

    /// iOS-11: shown when the in-session draft was restored from a saved local
    /// snapshot (continue-a-saved-session). iOS-13: also surfaces reconciliation
    /// drift (saved exercises skipped / new exercises added). Local-only draft.
    @ViewBuilder
    private var restoredDraftBanner: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("已恢复本机草稿 · 继续训练（仅本机 · 未写入云端）")
                .font(.footnote)
            if let r = state.restoreReconciliation, r.hasDrift {
                Text("注意：\(r.unmatchedSnapshotIds.count) 个旧动作已跳过（已不在该样例中），\(r.missingCurrentIds.count) 个新动作从 0 组开始")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(.blue)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.blue.opacity(0.12)))
    }

    private var inSessionHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            Button {
                state.endSession()
                // N-1: leaving the session cancels any pending rest reminder.
                Task { await restReminder.cancelRestReminder() }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.left")
                    Text("返回")
                }
                .font(.subheadline)
            }
            Spacer()
            Text(state.selectedScenario.shortLabel)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.secondary.opacity(0.15))
                )
        }
    }

    @ViewBuilder
    private var currentExerciseSection: some View {
        if let row = currentRow {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text("当前动作")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("第 \(state.selectedExerciseIndex + 1) / \(rows.count) 个")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                FocusSetChecklistView(
                    exerciseName: row.name,
                    exerciseMuscle: row.muscle,
                    roleLabel: roleLabel(row.role),
                    targetSets: row.targetSets,
                    completedSets: state.completedSets(for: row.id),
                    displayUnit: $state.captureDisplayUnit,
                    onCompleteSet: { weight, reps, rir in
                        // iOS-17b: capture the per-set entry into in-RAM
                        // ActualSetDraft (kg-stored) AND advance the count via the
                        // unchanged path. Blank fields → nil (honest degrade).
                        state.captureSet(
                            for: row.id,
                            target: row.targetSets,
                            weightInDisplayUnit: weight,
                            reps: reps,
                            rir: rir
                        )
                        // N-1: a completed set begins the rest before the NEXT set in
                        // this exercise → schedule a LOCAL reminder (a same-id reschedule
                        // replaces any pending one). If the exercise just completed there
                        // is no next set here, so cancel instead. No-op unless the user
                        // enabled reminders.
                        let completedAfter = state.completedSets(for: row.id)
                        if completedAfter < row.targetSets {
                            let nextSet = completedAfter + 1
                            Task {
                                await restReminder.scheduleRestReminder(
                                    exerciseRoleRawValue: row.role.rawValue,
                                    exerciseName: row.name,
                                    nextSetNumber: nextSet
                                )
                            }
                        } else {
                            Task { await restReminder.cancelRestReminder() }
                        }
                    }
                )
            }
        } else {
            Text("没有可显示的动作")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var navigationStack: some View {
        if rows.count > 1 {
            VStack(alignment: .leading, spacing: 6) {
                if let nextRow = nextRow() {
                    Text("下一动作：\(nextRow.name)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    Button {
                        state.moveToPreviousExercise()
                        // N-1: switching exercises supersedes the prior set's rest.
                        Task { await restReminder.cancelRestReminder() }
                    } label: {
                        Text("上一动作")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.bordered)
                    .disabled(state.selectedExerciseIndex <= 0)

                    Button {
                        state.moveToNextExercise(totalCount: rows.count)
                        // N-1: switching exercises supersedes the prior set's rest.
                        Task { await restReminder.cancelRestReminder() }
                    } label: {
                        Text("下一动作")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(state.selectedExerciseIndex >= rows.count - 1)
                }
            }
        }
    }

    private var sessionActionStack: some View {
        VStack(spacing: 8) {
            Button {
                state.resetProgress()
                // N-1: resetting progress clears any pending rest reminder.
                Task { await restReminder.cancelRestReminder() }
            } label: {
                Text("重置样例")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.bordered)

            Button {
                state.endSession()
                // N-1: ending training cancels any pending rest reminder.
                Task { await restReminder.cancelRestReminder() }
            } label: {
                Text("结束训练（回到计划）")
                    .font(.subheadline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.bordered)
        }
    }

    private func nextRow() -> FocusModeExerciseRow? {
        let nextIndex = state.selectedExerciseIndex + 1
        guard nextIndex < rows.count else { return nil }
        return rows[nextIndex]
    }

    private func roleLabel(_ role: ExerciseRole) -> String {
        switch role {
        case .mainCompound: return "main-compound"
        case .secondaryCompound: return "secondary-compound"
        case .accessory: return "accessory"
        case .isolation: return "isolation"
        }
    }

    // MARK: - Footer

    private var footer: some View {
        Text("本地 Swift TrainingDecision · 无云同步 · 无 HealthKit")
            .font(.footnote)
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, 8)
    }

    // MARK: - Build rows

    private static func buildRows(
        slice: TrainingDecisionCoreSlice,
        templates: [TrainingDecisionTemplateExercise]
    ) -> [FocusModeExerciseRow] {
        let templateById = Dictionary(uniqueKeysWithValues: templates.map { ($0.id, $0) })
        return slice.perExercise.compactMap { target in
            guard let template = templateById[target.exerciseId] else { return nil }
            let floor = slice.exerciseRoleFloors[target.role] ?? 1
            return FocusModeExerciseRow(
                id: target.exerciseId,
                name: template.name,
                muscle: template.muscle,
                kind: template.kind,
                role: target.role,
                targetSets: target.targetSets,
                roleFloor: floor
            )
        }
    }
}

// FU-1: the running app uses `FocusModeShellView()` (live canonical read). Previews inject a
// pinned live model so `isLiveLoadEnabled == false` — the shell then drives the deterministic
// `FocusModePreviewData` sample + the scenario picker (the original iOS-5/6 preview behavior),
// with NO device store read.
#Preview {
    FocusModeShellView(live: FocusModeLiveData(previewState: .empty))
}
