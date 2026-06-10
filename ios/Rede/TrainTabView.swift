import SwiftUI
import RedeL10n
import RedeTrainingDecision

// Train — 按 rede-app.html #s-train 复原（M0-2 静态稿 → M3-2 全交互）。
// 视觉合同沿用静态稿；状态转移全在 TrainFlowState（包内有测试），本层只渲染 +
// 跑休息计时器。重量 kg 口径（FR-SE1 前不硬编码 lb）。无原型依据的新增控件
//（快改行、登记不适/更多按钮、空态卡）取最保守样式，已在 DEV_LOG 留痕待设计确认。
// 完成落盘归 M3-3；本页到小结为止（FR-TR8 前半）。

struct TrainTabView: View {
    var onGoToday: () -> Void = {}

    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore

    @State private var restRemaining = 0
    @State private var restPaused = false
    @State private var showAdjust = false
    @State private var adjustWeight: Double = 0
    @State private var adjustReps = 0
    @State private var adjustRir = 2
    @State private var showMoreSheet = false
    @State private var showSwapSheet = false
    @State private var painToastVisible = false

    private var s: RedeStrings { localeStore.strings }
    private var flow: TrainFlowState? { sessionStore.flow }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let flow {
                    header(flow)
                    progressBar(flow)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 10)
                    heroCard(flow)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 16)
                    if painToastVisible {
                        painNotice
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, 10)
                    }
                    setTable(flow)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, RedeSpace.section)
                    nextUpLine(flow)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 12)
                } else {
                    emptyState
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 24)
                }
            }
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
        .task(id: restTaskKey) { await runRestTimer() }
        .sheet(isPresented: $showMoreSheet) { moreSheet }
        .sheet(isPresented: $showSwapSheet) { swapSheet }
        .sheet(isPresented: confirmBinding) { confirmSheet }
        .sheet(isPresented: summaryBinding) { summarySheet }
    }

    // MARK: - Header + 进度

    private func header(_ flow: TrainFlowState) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(s.trainingDayName(flow.plan.dayCode))
                    .font(.redeTitle)
                    .foregroundStyle(Color.redeT1)
                Overline(text: s.trainProgress(
                    exercise: flow.progress.exerciseNumber,
                    exerciseTotal: flow.progress.exerciseTotal,
                    set: flow.progress.setNumber,
                    setTotal: flow.progress.setTotal
                ))
            }
            Spacer()
            Button(action: { sessionStore.flow?.requestFinish() }) {
                Text(s.trainFinish)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT3)
                    .frame(minHeight: RedeShape.controlHeight)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, RedeSpace.page)
        .padding(.top, 14)
    }

    private var overallFraction: Double {
        guard let flow else { return 0 }
        let total = flow.plan.exercises.reduce(0) { $0 + $1.sets.count }
        guard total > 0 else { return 0 }
        let done = flow.observationsByExercise.values.reduce(0) { $0 + $1.count } + flow.skippedSets.count
        return min(1, Double(done) / Double(total))
    }

    private func progressBar(_ flow: TrainFlowState) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2).fill(Color(redeHex: 0x1B1813)).frame(height: 3)
                RoundedRectangle(cornerRadius: 2).fill(Color.redeNeu)
                    .frame(width: geo.size.width * overallFraction, height: 3)
            }
        }
        .frame(height: 3)
    }

    // MARK: - Hero（set ⇄ rest 原地 morph，固定 frame）

    private func heroCard(_ flow: TrainFlowState) -> some View {
        ForgedCard(emberBarInset: 18, showReg: true) {
            ZStack(alignment: .topLeading) {
                setState(flow)
                    .opacity(flow.phase == .resting ? 0 : 1)
                    .scaleEffect(flow.phase == .resting ? 0.98 : 1)
                restState(flow)
                    .opacity(flow.phase == .resting ? 1 : 0)
                    .scaleEffect(flow.phase == .resting ? 1 : 0.98)
            }
            .animation(.easeInOut(duration: 0.22), value: flow.phase)
            .frame(minHeight: 245, alignment: .topLeading)
            .padding(.leading, 13)
            .padding(.vertical, 18)
            .padding(.horizontal, RedeSpace.card)
        }
    }

    private func setState(_ flow: TrainFlowState) -> some View {
        let targetKg = flow.currentTargetWeightKg ?? 0
        let exercise = flow.currentExercise
        let recommendation = flow.currentRecommendation
        return VStack(alignment: .leading, spacing: 0) {
            Text(exercise.map { s.exerciseName($0.exerciseId) } ?? "")
                .font(.redeSubhead)
                .foregroundStyle(Color.redeT2)

            Button(action: { startAdjust(targetKg: targetKg, recommendation: recommendation) }) {
                HStack(alignment: .bottom, spacing: 8) {
                    Text(s.formatKg(showAdjust ? adjustWeight : targetKg))
                        .font(.redeDisplay)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                    Text(s.trainLoadSuffix(
                        targetReps: showAdjust ? adjustReps : (recommendation?.targetReps ?? 0),
                        targetRir: showAdjust ? Double(adjustRir) : (recommendation?.targetRir ?? 2)
                    ))
                    .font(.redeCallout)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT3)
                    .padding(.bottom, 8)
                }
            }
            .buttonStyle(.plain)

            if showAdjust {
                adjustRow
                    .padding(.top, 8)
            }

            Text(flow.isHolding
                 ? s.holdWhyLine
                 : (flow.completedInCurrentExercise.isEmpty
                    ? s.firstSetWhy
                    : s.nextSetWhy(
                        reasonCode: recommendation?.reason.code ?? "onPlan",
                        fromKg: flow.completedInCurrentExercise.last.map { s.formatKg($0.weightKg) }
                    )))
                .font(.redeCallout)
                .foregroundStyle(Color.redeT3)
                .padding(.top, 10)

            HStack(spacing: 8) {
                SteelButton(
                    title: s.holdLabel(kg: s.formatKg(plannedWeight(flow)), holding: flow.isHolding),
                    isOn: flow.isHolding,
                    action: { sessionStore.flow?.toggleHold() }
                )
                SteelButton(title: s.painAction, action: registerPain)
                SteelButton(title: s.moreActions, action: { showMoreSheet = true })
            }
            .padding(.top, 14)

            EmbButton(icon: "checkmark", title: s.trainLogSet, action: logCurrentSet)
                .padding(.top, 12)
        }
    }

    private func restState(_ flow: TrainFlowState) -> some View {
        VStack(spacing: 10) {
            Overline(text: s.restLabel, color: .redeRec2)
            Text(formattedRest)
                .font(.redeDisplay)
                .monospacedDigit()
                .foregroundStyle(Color.redeT1)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color(redeHex: 0x231F19)).frame(height: 3)
                    Rectangle().fill(Color.redeNeu)
                        .frame(width: geo.size.width * restFraction, height: 3)
                        .animation(.linear(duration: 1), value: restRemaining)
                }
            }
            .frame(width: 180, height: 3)

            Text(restPreviewText(flow))
                .font(.redeCallout)
                .monospacedDigit()
                .foregroundStyle(Color.redeT3)

            HStack(spacing: 8) {
                SteelButton(title: s.restAdd30, action: { restRemaining += 30 })
                SteelButton(title: restPaused ? s.restResume : s.restPause, isOn: restPaused,
                            action: { restPaused.toggle() })
                EmbButton(icon: "forward.fill", title: s.restNextSet, iconSize: 13, fontSize: 14,
                          action: finishRest)
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }

    private func restPreviewText(_ flow: TrainFlowState) -> String {
        if let exercise = flow.currentExercise,
           flow.completedInCurrentExercise.count + flow.skippedInCurrentExercise >= exercise.sets.count {
            let next = flow.plan.exercises.indices.contains(flow.exerciseIndex + 1)
                ? flow.plan.exercises[flow.exerciseIndex + 1] : nil
            return next.map { s.restNextExercise(s.exerciseName($0.exerciseId)) } ?? ""
        }
        guard let rec = flow.currentRecommendation else { return "" }
        return s.restNextPreview(setNumber: rec.setIndex, kg: s.formatKg(rec.targetWeightKg), reps: rec.targetReps)
    }

    // MARK: - 快改（FR-TR2：两次点击内改重量/次数/RIR）

    private var adjustRow: some View {
        HStack(spacing: 14) {
            adjustCell(label: s.adjustWeight, value: s.formatKg(adjustWeight),
                       minus: { adjustWeight = max(2.5, adjustWeight - 2.5) },
                       plus: { adjustWeight += 2.5 })
            adjustCell(label: s.adjustReps, value: "\(adjustReps)",
                       minus: { adjustReps = max(1, adjustReps - 1) },
                       plus: { adjustReps += 1 })
            adjustCell(label: s.adjustRir, value: "\(adjustRir)",
                       minus: { adjustRir = max(0, adjustRir - 1) },
                       plus: { adjustRir = min(5, adjustRir + 1) })
        }
    }

    private func adjustCell(label: String, value: String, minus: @escaping () -> Void, plus: @escaping () -> Void) -> some View {
        VStack(spacing: 5) {
            Overline(text: label)
            HStack(spacing: 7) {
                SteelButton(title: "−", action: minus)
                Text(value).font(.redeBody).monospacedDigit().foregroundStyle(Color.redeT1)
                SteelButton(title: "＋", action: plus)
            }
        }
    }

    // MARK: - 组表（沿用 M0-2 行渲染）

    /// 行状态：跳过的组（按 setIndex 留痕）原位显示跳过标记；完成的组按顺序
    /// 映射到未跳过的行；指针行高亮（MAJOR 修复：跳过后不再错位挂数据）。
    private enum RowStatus {
        case done(CompletedSetObservation)
        case skipped
        case active
        case pending
    }

    private func rowStatuses(_ flow: TrainFlowState) -> [RowStatus] {
        guard let exercise = flow.currentExercise else { return [] }
        let skippedIndices = Set(
            flow.skippedSets.filter { $0.exerciseId == exercise.exerciseId }.map(\.setIndex)
        )
        let pointer = flow.completedInCurrentExercise.count + flow.skippedInCurrentExercise
        var completedCursor = 0
        return exercise.sets.indices.map { index in
            let number = index + 1
            if skippedIndices.contains(number) { return .skipped }
            if index < pointer, completedCursor < flow.completedInCurrentExercise.count {
                let obs = flow.completedInCurrentExercise[completedCursor]
                completedCursor += 1
                return .done(obs)
            }
            if index == pointer, flow.phase != .summary { return .active }
            return .pending
        }
    }

    private func setTable(_ flow: TrainFlowState) -> some View {
        let exercise = flow.currentExercise
        let statuses = rowStatuses(flow)
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Overline(text: s.trainColSet).frame(width: 44, alignment: .leading)
                Overline(text: s.trainColWeight).frame(maxWidth: .infinity, alignment: .leading)
                Overline(text: s.trainColReps).frame(width: 60, alignment: .leading)
                Overline(text: s.trainColRir).frame(width: 44, alignment: .leading)
                Spacer().frame(width: 22)
            }
            .padding(.bottom, 7)

            ForEach(Array((exercise?.sets ?? []).enumerated()), id: \.offset) { index, plannedSet in
                let status = statuses.indices.contains(index) ? statuses[index] : .pending
                switch status {
                case .done(let obs):
                    setRow(
                        number: plannedSet.index,
                        weight: s.formatKg(obs.weightKg),
                        reps: "\(obs.reps)",
                        rir: obs.rir.map { s.formatRir($0) } ?? "—",
                        marker: .done
                    )
                case .skipped:
                    setRow(
                        number: plannedSet.index,
                        weight: s.formatKg(plannedSet.targetWeightKg),
                        reps: "\(plannedSet.targetReps)",
                        rir: "—",
                        marker: .skipped
                    )
                case .active:
                    setRow(
                        number: plannedSet.index,
                        weight: s.formatKg(plannedSet.targetWeightKg),
                        reps: "\(plannedSet.targetReps)",
                        rir: "—",
                        marker: .active
                    )
                case .pending:
                    setRow(
                        number: plannedSet.index,
                        weight: s.formatKg(plannedSet.targetWeightKg),
                        reps: "\(plannedSet.targetReps)",
                        rir: "—",
                        marker: .pending
                    )
                }
            }
        }
    }

    private enum RowMarker { case done, skipped, active, pending }

    private func setRow(number: Int, weight: String, reps: String, rir: String, marker: RowMarker) -> some View {
        let textColor: Color = switch marker {
        case .done: .redeT2
        case .active: .redeT1
        case .skipped, .pending: .redeT4
        }
        let isActive = marker == .active
        return HStack {
            Text("\(number)").frame(width: 44, alignment: .leading)
            Text("\(weight) kg").frame(maxWidth: .infinity, alignment: .leading)
            Text(reps).frame(width: 60, alignment: .leading)
            Text(rir).frame(width: 44, alignment: .leading)
            Group {
                switch marker {
                case .done:
                    Image(systemName: "checkmark").font(.system(size: 14)).foregroundStyle(Color.redeT4)
                case .skipped:
                    Image(systemName: "minus").font(.system(size: 14)).foregroundStyle(Color.redeT4)
                case .active:
                    Circle().fill(Color.redeEmber).frame(width: 7, height: 7)
                case .pending:
                    Color.clear
                }
            }
            .frame(width: 22, alignment: .trailing)
        }
        .font(.redeBody)
        .monospacedDigit()
        .foregroundStyle(textColor)
        .strikethrough(marker == .skipped, color: .redeT4)
        .padding(.vertical, 9)
        .padding(.leading, isActive ? 8 : 0)
        .overlay(alignment: .leading) {
            if isActive { Rectangle().fill(Color.redeEmber).frame(width: 2).padding(.leading, -10) }
        }
        .overlay(alignment: .bottom) { Rectangle().fill(Color.redeHair2).frame(height: 1) }
    }

    private func nextUpLine(_ flow: TrainFlowState) -> some View {
        let next = flow.plan.exercises.indices.contains(flow.exerciseIndex + 1)
            ? flow.plan.exercises[flow.exerciseIndex + 1] : nil
        return Group {
            if let next {
                Text(s.restNextExercise(s.exerciseName(next.exerciseId)) + " · \(next.sets.count) × \(next.sets.first?.targetReps ?? 0)")
                    .font(.redeCaption)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT4)
            }
        }
    }

    // MARK: - 疼痛提示 / 空态

    private var painNotice: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(s.painRegistered).font(.redeCallout).foregroundStyle(Color.redeT2)
            Text(s.painAdvisory).font(.redeCaption).foregroundStyle(Color.redeT3)
        }
    }

    private var emptyState: some View {
        ForgedCard(emberBarInset: 18) {
            VStack(alignment: .leading, spacing: 12) {
                Text(s.trainEmptyTitle)
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)
                if sessionStore.todayModel != nil, sessionStore.todayModel?.prescription == nil {
                    Text(s.trainRestDayNote).font(.redeCallout).foregroundStyle(Color.redeT3)
                }
                EmbButton(icon: "arrow.left", title: s.trainEmptyAction, action: onGoToday)
            }
            .padding(.leading, 13)
            .padding(.vertical, 18)
            .padding(.horizontal, RedeSpace.card)
        }
    }

    // MARK: - Sheets

    private var moreSheet: some View {
        VStack(alignment: .leading, spacing: 14) {
            Overline(text: s.skipSetAction)
            HStack(spacing: 7) {
                ForEach(["equipmentBusy", "painDiscomfort", "fatigue", "timeShort"], id: \.self) { code in
                    SteelButton(title: s.skipReasonLabel(code), action: { skipSet(code) })
                }
            }
            Divider().overlay(Color.redeHair)
            SteelButton(title: s.skipExerciseAction, action: skipExercise)
            SteelButton(title: s.swapExerciseAction, action: {
                showMoreSheet = false
                showSwapSheet = true
            })
            Spacer()
        }
        .padding(20)
        .presentationDetents([.height(280)])
        .presentationBackground(Color.redeSurface)
    }

    private var swapSheet: some View {
        VStack(alignment: .leading, spacing: 14) {
            Overline(text: s.swapExerciseAction)
            if let candidates = flow?.replacementCandidates, !candidates.isEmpty {
                ForEach(candidates, id: \.self) { id in
                    SteelButton(title: s.exerciseName(id), action: {
                        sessionStore.flow?.replaceCurrentExercise(with: id)
                        showSwapSheet = false
                    })
                }
            } else {
                Text("—").foregroundStyle(Color.redeT3)
            }
            Spacer()
        }
        .padding(20)
        .presentationDetents([.height(240)])
        .presentationBackground(Color.redeSurface)
    }

    private var confirmBinding: Binding<Bool> {
        Binding(
            get: { sessionStore.flow?.phase == .confirmEnd },
            set: { if !$0 { sessionStore.flow?.keepTraining() } }
        )
    }

    private var confirmSheet: some View {
        let remaining = (flow?.plan.exercises.count ?? 0) - (flow?.exerciseIndex ?? 0) - 1
        return VStack(alignment: .leading, spacing: 10) {
            Overline(text: s.endWorkoutTitle, color: .redeRisk)
            Text(s.endWorkoutRemaining(exercisesLeft: max(0, remaining)))
                .font(.redeHeadline)
                .foregroundStyle(Color.redeT1)
            Text(s.endWorkoutKeptNote).font(.redeCallout).foregroundStyle(Color.redeT3)
            EmbButton(icon: nil, title: s.endWorkoutConfirm, action: {
                sessionStore.flow?.confirmEnd(reason: .timeUp)
            })
            SteelButton(title: s.keepTraining, action: { sessionStore.flow?.keepTraining() })
            Spacer()
        }
        .padding(20)
        .presentationDetents([.height(260)])
        .presentationBackground(Color.redeSurface)
    }

    private var summaryBinding: Binding<Bool> {
        Binding(
            get: { sessionStore.flow?.phase == .summary },
            set: { _ in }
        )
    }

    private var summarySheet: some View {
        let summary = sessionStore.sessionSummary
        return VStack(alignment: .leading, spacing: 12) {
            Overline(text: s.summaryTitle, color: .redeRec2)
            Text(s.trainingDayName(flow?.plan.dayCode ?? ""))
                .font(.redeHeadline)
                .foregroundStyle(Color.redeT1)
            Text(s.summaryMeta(minutes: (summary?.durationSeconds ?? 0) / 60))
                .font(.redeCallout)
                .foregroundStyle(Color.redeT3)

            HStack(spacing: 20) {
                summaryStat(value: s.formatKg(summary?.totalVolumeKg ?? 0), label: s.summaryVolume)
                summaryStat(value: "\(summary?.completedSetCount ?? 0)", label: s.summarySets)
                if summary?.isPersonalRecord == true {
                    summaryStat(value: "1", label: s.summaryPr, valueColor: .redeEmber)
                }
            }
            .padding(.top, 4)

            if let top = summary?.topSet {
                Text(s.summaryTopSet(name: s.exerciseName(top.exerciseId), kg: s.formatKg(top.weightKg), reps: top.reps))
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeT2)
            }

            if let errorText = sessionStore.saveErrorText {
                Text(s.saveFailedLine)
                    .font(.redeCallout)
                    .foregroundStyle(Color.redeRisk)
                Text(errorText)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                    .lineLimit(2)
            }
            EmbButton(icon: nil, title: sessionStore.saveErrorText == nil ? s.summarySaveAndFinish : s.summaryRetrySave, action: {
                Task {
                    if await sessionStore.completeAndPersistSession() {
                        onGoToday()
                    }
                }
            })
            .disabled(sessionStore.isSaving)
            .opacity(sessionStore.isSaving ? 0.5 : 1)
            Spacer()
        }
        .padding(20)
        .presentationDetents([.height(320)])
        .presentationBackground(Color.redeSurface)
        .interactiveDismissDisabled(true)
    }

    private func summaryStat(value: String, label: String, valueColor: Color = .redeT1) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(.redeTitle).monospacedDigit().foregroundStyle(valueColor)
            Overline(text: label)
        }
    }

    // MARK: - 行为

    private func plannedWeight(_ flow: TrainFlowState) -> Double {
        guard let exercise = flow.currentExercise, !exercise.sets.isEmpty else { return 0 }
        let pointer = min(flow.completedInCurrentExercise.count + flow.skippedInCurrentExercise, exercise.sets.count - 1)
        return exercise.sets[pointer].targetWeightKg
    }

    private func startAdjust(targetKg: Double, recommendation: NextSetRecommendation?) {
        if !showAdjust {
            adjustWeight = targetKg
            adjustReps = max(1, recommendation?.targetReps ?? 1)
            adjustRir = Int(recommendation?.targetRir ?? 2)
        }
        showAdjust.toggle()
    }

    private func logCurrentSet() {
        guard let flow else { return }
        let target = flow.currentTargetWeightKg ?? 0
        let recommendation = flow.currentRecommendation
        let observation = CompletedSetObservation(
            weightKg: showAdjust ? adjustWeight : target,
            reps: showAdjust ? adjustReps : (recommendation?.targetReps ?? 0),
            rir: Double(showAdjust ? adjustRir : Int(recommendation?.targetRir ?? 2)),
            painReported: flow.painReportedForCurrentSet
        )
        sessionStore.flow?.logSet(observation)
        showAdjust = false
        painToastVisible = false
        if sessionStore.flow?.phase == .resting {
            restRemaining = sessionStore.flow?.restSecondsPlanned ?? 0
            restPaused = false
        }
    }

    private func registerPain() {
        sessionStore.flow?.reportPain()
        painToastVisible = true
    }

    private func skipSet(_ code: String) {
        showMoreSheet = false
        painToastVisible = false
        guard let reason = SetSkipReason(rawValue: code) else { return }
        sessionStore.flow?.skipSet(reason: reason)
    }

    private func skipExercise() {
        showMoreSheet = false
        painToastVisible = false
        sessionStore.flow?.skipExercise(reason: .other)
    }

    private func finishRest() {
        restRemaining = 0
        sessionStore.flow?.restFinished()
    }

    private var formattedRest: String {
        "\(restRemaining / 60):" + String(format: "%02d", restRemaining % 60)
    }

    private var restFraction: Double {
        let planned = max(1, flow?.restSecondsPlanned ?? 1)
        return min(1, Double(restRemaining) / Double(planned))
    }

    private var restTaskKey: String {
        "\(flow?.phase == .resting ? "rest" : "idle")-\(flow?.exerciseIndex ?? 0)-\(flow?.completedInCurrentExercise.count ?? 0)"
    }

    private func runRestTimer() async {
        guard flow?.phase == .resting else { return }
        while !Task.isCancelled, sessionStore.flow?.phase == .resting {
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            guard !restPaused else { continue }
            if restRemaining > 1 {
                restRemaining -= 1
            } else {
                finishRest()
                break
            }
        }
    }
}

#Preview {
    TrainTabView()
        .environment(LocaleStore())
        .environment(SessionStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
