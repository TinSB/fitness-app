import SwiftUI
import RedeL10n
import RedeTrainingDecision

// Train — 按 rede-app.html #s-train 复原（M0-2 静态稿 → M3-2 全交互）。
// 视觉合同沿用静态稿；状态转移全在 TrainFlowState（包内有测试），本层只渲染 +
// 跑休息计时器。重量 kg 口径（FR-SE1 前不硬编码 lb）。快改面板按 #533 拍板的
//「刻度轨」原型实现（语义档位 + 预演；档位逻辑在包内 AdjustOptionsBuilder）；
// 登记不适/更多按钮、空态卡仍为保守样式待设计确认。
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
    /// nil = 不记 RIR（引擎不猜；仅快改面可选，默认行为不变）。
    @State private var adjustRir: Int? = 2
    /// 重量直接输入（精细调节；提交时解析并钳制）。
    @State private var adjustWeightText = ""
    @State private var showExactField = false
    /// 触感词汇表（拍板 2026-06-10）：选档 selection / 撞钳制 error / 打勾 success。
    /// selectionPulse 只在用户主动选档时递增——面板打开初始化赋值不触发（审查 MINOR-3）。
    @State private var selectionPulse = 0
    @State private var clampPulse = 0
    @State private var logPulse = 0
    @FocusState private var weightFieldFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// 快改入口一次性提示（用过即永久消失）。
    @AppStorage("hasUsedQuickAdjust") private var hasUsedQuickAdjust = false
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
        .sensoryFeedback(.success, trigger: logPulse)
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
            Button(action: { sessionStore.apply(.requestFinish) }) {
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
                        .contentTransition(.numericText(value: showAdjust ? adjustWeight : targetKg))
                        .animation(reduceMotion ? nil : .easeOut(duration: 0.2),
                                   value: showAdjust ? adjustWeight : targetKg)
                    Text(s.trainLoadSuffix(
                        targetReps: showAdjust ? adjustReps : (recommendation?.targetReps ?? 0),
                        targetRir: showAdjust ? adjustRir.map(Double.init) : (recommendation?.targetRir ?? 2)
                    ))
                    .font(.redeCallout)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT3)
                    .padding(.bottom, 8)
                    // 可调暗示（FR-TR2 可见性：数字必须看起来能点）
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.redeT4)
                        .padding(.bottom, 10)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if !hasUsedQuickAdjust && !showAdjust {
                Text(s.adjustDiscoverHint)
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT4)
                    .padding(.top, 2)
            }

            if showAdjust {
                adjustPanel(flow)
                    .padding(.top, 8)
                    .transition(reduceMotion ? .identity : .opacity)
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
                    action: { sessionStore.apply(.toggleHold) }
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

    // MARK: - 快改刻度轨（FR-TR2 两击内；M5-3 拍板设计 = rede-app.html #533）
    // 档位由 AdjustOptionsBuilder（包内纯函数）生成；预演 = 落盘同规则（AdjustPreview）。
    // ember 口音纪律：面板内唯一 ember = 指针；预演 tick 用中性色。

    private func adjustPanel(_ flow: TrainFlowState) -> some View {
        let options = adjustOptions(flow)
        return VStack(alignment: .leading, spacing: 0) {
            railHeader
                .modifier(CascadeIn(index: 0, enabled: !reduceMotion))
            railZone(options)
                .frame(height: 74)
                .padding(.top, 2)
                .modifier(CascadeIn(index: 1, enabled: !reduceMotion))
            if showExactField {
                exactField
                    .padding(.top, 4)
            }
            Overline(text: s.adjustReps)
                .padding(.top, 14)
                .modifier(CascadeIn(index: 2, enabled: !reduceMotion))
            repsStrip(flow)
                .padding(.top, 2)
                .modifier(CascadeIn(index: 2, enabled: !reduceMotion))
            Overline(text: s.adjustRir)
                .padding(.top, 12)
                .modifier(CascadeIn(index: 3, enabled: !reduceMotion))
            rirStrip
                .padding(.top, 2)
                .modifier(CascadeIn(index: 3, enabled: !reduceMotion))
            previewLine(flow)
                .padding(.top, 12)
                .modifier(CascadeIn(index: 4, enabled: !reduceMotion))
        }
        .sensoryFeedback(.selection, trigger: selectionPulse)
        .sensoryFeedback(.error, trigger: clampPulse)
    }

    private func adjustOptions(_ flow: TrainFlowState) -> [AdjustOption] {
        AdjustOptionsBuilder.options(
            followKg: flow.currentTargetWeightKg ?? 0,
            lastActualKg: flow.completedInCurrentExercise.last?.weightKg,
            plannedKg: plannedWeight(flow)
        )
    }

    /// 头行：重量标签 + 弱化文字级微调（−/＋ 一档、精确输入），不与档位竞争视觉。
    private var railHeader: some View {
        HStack(spacing: 0) {
            Overline(text: s.adjustWeight)
            Spacer()
            railOp("−") { stepAdjustWeight(-AdjustOptionsBuilder.stepKg) }
            railDivider
            railOp("＋") { stepAdjustWeight(AdjustOptionsBuilder.stepKg) }
            railDivider
            Button(action: {
                showExactField.toggle()
                if showExactField { weightFieldFocused = true }
            }) {
                Overline(text: s.adjustExact, color: showExactField ? .redeT1 : .redeT4)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private func railOp(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.redeBody)
                .monospacedDigit()
                .foregroundStyle(Color.redeT3)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var railDivider: some View {
        Rectangle().fill(Color.redeHair).frame(width: 1, height: 9)
    }

    private func stepAdjustWeight(_ delta: Double) {
        let next = adjustWeight + delta
        if next < 0 {
            clampPulse += 1
            adjustWeight = 0
        } else {
            adjustWeight = next
            selectionPulse += 1
        }
        adjustWeightText = s.formatKg(adjustWeight)
    }

    /// 刻度轨：2.5kg 细刻 / 整 10kg 主刻；站点按真实比例落位（最小间距保护）；
    /// ember 指针滑到选中值——选中站点对齐站点，离格值（精确输入）按真实比例。
    private func railZone(_ options: [AdjustOption]) -> some View {
        GeometryReader { geo in
            let layout = RailLayout(values: options.map(\.weightKg), staged: adjustWeight, width: geo.size.width)
            ZStack(alignment: .topLeading) {
                Canvas { ctx, _ in
                    let tickTop: CGFloat = 48
                    var base = Path()
                    base.move(to: CGPoint(x: 0, y: tickTop))
                    base.addLine(to: CGPoint(x: geo.size.width, y: tickTop))
                    ctx.stroke(base, with: .color(Color.redeHair2), lineWidth: 1)
                    var v = (layout.lo / 2.5).rounded(.up) * 2.5
                    while v <= layout.hi {
                        let x = layout.trueX(v)
                        let major = v.truncatingRemainder(dividingBy: 10) == 0
                        var tick = Path()
                        tick.move(to: CGPoint(x: x, y: tickTop))
                        tick.addLine(to: CGPoint(x: x, y: tickTop + (major ? 10 : 6)))
                        ctx.stroke(tick, with: .color(Color.redeHair), lineWidth: 1)
                        v += 2.5
                    }
                }
                .accessibilityHidden(true)

                ForEach(Array(options.enumerated()), id: \.element.weightKg) { index, option in
                    let selected = adjustWeight == option.weightKg
                    Button(action: { selectStation(option) }) {
                        VStack(spacing: 2) {
                            Overline(text: s.adjustOptionLabel(option.role.rawValue),
                                     color: selected ? .redeT3 : .redeT4)
                                .lineLimit(1)
                                .fixedSize()   // 标签不截断（可视超出命中框，命中区不变）
                            Text(s.formatKg(option.weightKg))
                                .font(.system(size: 17, weight: .semibold))
                                .monospacedDigit()
                                .foregroundStyle(selected ? Color.redeT1 : Color.redeT3)
                        }
                        .frame(width: 56, height: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .position(x: layout.stationX[index], y: 22)
                    .accessibilityLabel("\(s.adjustOptionLabel(option.role.rawValue)) \(s.formatKg(option.weightKg)) kg")
                }

                // ember 指针（面板唯一口音）
                VStack(spacing: 0) {
                    RailCaretTriangle().fill(Color.redeEmber).frame(width: 7, height: 5)
                    Rectangle().fill(Color.redeEmber).frame(width: 2, height: 10)
                }
                .position(x: layout.caretX, y: 67)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: layout.caretX)
                .accessibilityHidden(true)
            }
        }
    }

    private func selectStation(_ option: AdjustOption) {
        adjustWeight = option.weightKg
        adjustWeightText = s.formatKg(option.weightKg)
        selectionPulse += 1
    }

    /// 任意精度输入兜底（M4-4 全套保障原样：逗号转点、乱输不收不猜、Done + 失焦 + 打勾强制提交）。
    private var exactField: some View {
        TextField("", text: $adjustWeightText)
            .keyboardType(.decimalPad)
            .focused($weightFieldFocused)
            .font(.redeBody)
            .monospacedDigit()
            .foregroundStyle(Color.redeT1)
            .multilineTextAlignment(.center)
            .frame(width: 76)
            .padding(.vertical, 4)
            .background(Color.redeHair.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .onChange(of: weightFieldFocused) { _, focused in
                if !focused { commitWeightText() }
            }
            .toolbar {
                // decimal 键盘无回车键：给一个明确的提交路径
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(s.adjustDone) {
                        commitWeightText()
                        weightFieldFocused = false
                    }
                }
            }
    }

    /// 文本 → 重量：可解析则钳制 ≥0 收下；不可解析则回显当前值（不猜）。
    private func commitWeightText() {
        if let parsed = Double(adjustWeightText.replacingOccurrences(of: ",", with: ".")), parsed >= 0 {
            adjustWeight = parsed
        }
        adjustWeightText = s.formatKg(adjustWeight)
    }

    /// 次数直选带：以当前值自重心 ±2 一屏五格；计划目标格底部 neu 刻标。
    private func repsStrip(_ flow: TrainFlowState) -> some View {
        let lo = max(1, adjustReps - 2)
        let target = flow.currentRecommendation?.targetReps
        return HStack(spacing: 0) {
            ForEach(lo..<(lo + 5), id: \.self) { n in
                if n > lo { stripDivider }
                Button(action: { adjustReps = n; selectionPulse += 1 }) {
                    Text("\(n)")
                        .font(.redeBody)
                        .monospacedDigit()
                        .foregroundStyle(n == adjustReps ? Color.redeT1 : Color.redeT4)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .overlay(alignment: .bottom) {
                            if n == target {
                                Rectangle().fill(Color.redeNeu).frame(width: 14, height: 2)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// RIR 直选带：「—」= 不记（引擎不猜）；0/1 = 力竭回退区 caution 微标。
    private var rirStrip: some View {
        let cells: [Int?] = [nil, 0, 1, 2, 3, 4, 5]
        return HStack(spacing: 0) {
            ForEach(Array(cells.enumerated()), id: \.offset) { index, value in
                if index > 0 { stripDivider }
                Button(action: { adjustRir = value; selectionPulse += 1 }) {
                    Text(value.map(String.init) ?? s.adjustRirSkip)
                        .font(.redeBody)
                        .monospacedDigit()
                        .foregroundStyle(value == adjustRir ? Color.redeT1 : Color.redeT4)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .overlay(alignment: .bottom) {
                            if let value, value <= 1 {
                                Rectangle().fill(Color.redeCaution.opacity(0.5)).frame(width: 14, height: 2)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(value.map { "RIR \($0)" } ?? "RIR —")
            }
        }
    }

    private var stripDivider: some View {
        Rectangle().fill(Color.redeHair2).frame(width: 1, height: 8)
    }

    /// 后果预演：与落盘同一引擎函数求值，预演说什么打勾后就发生什么（合同测试钉死）。
    private func previewLine(_ flow: TrainFlowState) -> some View {
        let staged = CompletedSetObservation(
            weightKg: adjustWeight,
            reps: adjustReps,
            rir: adjustRir.map(Double.init),
            painReported: flow.painReportedForCurrentSet
        )
        let projection = flow.currentExercise.flatMap {
            AdjustPreview.project(plan: $0, completed: flow.completedInCurrentExercise, staged: staged)
        }
        let text: String
        if let projection {
            let note = s.adjustPreviewNote(reasonCode: projection.reason.code)
            text = s.adjustPreviewNext(kg: s.formatKg(projection.targetWeightKg))
                + (note.map { " — \($0)" } ?? "")
        } else {
            text = s.adjustPreviewComplete
        }
        return HStack(spacing: 6) {
            Rectangle().fill(Color.redeNeu).frame(width: 11, height: 2)
            Text(text).font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeT3)
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: text)
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
                        sessionStore.apply(.replaceExercise(id))
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
            set: { if !$0 { sessionStore.apply(.keepTraining) } }
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
                sessionStore.apply(.confirmEnd(.timeUp))
            })
            SteelButton(title: s.keepTraining, action: { sessionStore.apply(.keepTraining) })
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
        hasUsedQuickAdjust = true // 提示服务「入口发现」：打开过即达成，与是否真改无关（拍板留痕）
        if !showAdjust {
            adjustWeight = targetKg
            adjustWeightText = s.formatKg(targetKg)
            adjustReps = max(1, recommendation?.targetReps ?? 1)
            adjustRir = Int(recommendation?.targetRir ?? 2)
            showExactField = false
        }
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) {
            showAdjust.toggle()
        }
    }

    private func logCurrentSet() {
        guard let flow else { return }
        // 打勾前先收下文本框最新内容（decimal 键盘无回车，失焦时序不可靠——
        // 不提交会静默记旧值，审查 MAJOR）
        if showAdjust {
            commitWeightText()
            weightFieldFocused = false
        }
        let target = flow.currentTargetWeightKg ?? 0
        let recommendation = flow.currentRecommendation
        let observation = CompletedSetObservation(
            weightKg: showAdjust ? adjustWeight : target,
            reps: showAdjust ? adjustReps : (recommendation?.targetReps ?? 0),
            // 快改面选「不记」→ nil 落盘（引擎不猜）；未开快改维持现状（默认目标 RIR）
            rir: showAdjust ? adjustRir.map(Double.init) : Double(Int(recommendation?.targetRir ?? 2)),
            painReported: flow.painReportedForCurrentSet
        )
        sessionStore.apply(.logSet(observation))
        logPulse += 1
        showAdjust = false
        painToastVisible = false
        if sessionStore.flow?.phase == .resting {
            restRemaining = sessionStore.flow?.restSecondsPlanned ?? 0
            restPaused = false
        }
    }

    private func registerPain() {
        sessionStore.apply(.reportPain)
        painToastVisible = true
    }

    private func skipSet(_ code: String) {
        showMoreSheet = false
        painToastVisible = false
        guard let reason = SetSkipReason(rawValue: code) else { return }
        sessionStore.apply(.skipSet(reason))
    }

    private func skipExercise() {
        showMoreSheet = false
        painToastVisible = false
        sessionStore.apply(.skipExercise(.other))
    }

    private func finishRest() {
        restRemaining = 0
        sessionStore.apply(.restFinished)
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

// MARK: - 刻度轨辅助（纯渲染几何，无状态）

/// 站点落位：真实比例 + 最小间距保护（命中区不重叠；刻度本身保持线性）。
private struct RailLayout {
    let lo: Double
    let hi: Double
    let width: CGFloat
    let stationX: [CGFloat]
    let caretX: CGFloat

    private static let minGap: CGFloat = 66   // 英文长标签（LIGHTER/HEAVIER）不截断所需的站距
    private static let edgeInset: CGFloat = 34

    init(values: [Double], staged: Double, width: CGFloat) {
        let loV = Swift.min(values.min() ?? staged, staged) - 5
        let hiV = Swift.max(Swift.max(values.max() ?? staged, staged) + 5, loV + 0.001)
        self.lo = loV
        self.hi = hiV
        self.width = width

        var xs = values.map { Self.proportionalX($0, lo: loV, hi: hiV, width: width) }
        if xs.count > 1 {
            for i in 1..<xs.count { xs[i] = Swift.max(xs[i], xs[i - 1] + Self.minGap) }
            if let last = xs.last, last > width - Self.edgeInset {
                xs[xs.count - 1] = width - Self.edgeInset
                for i in stride(from: xs.count - 2, through: 0, by: -1) {
                    xs[i] = Swift.min(xs[i], xs[i + 1] - Self.minGap)
                }
            }
        }
        xs = xs.map { Swift.min(Swift.max($0, Self.edgeInset), width - Self.edgeInset) }
        if xs.count > 1 {
            // 左缘钳制可能再次破坏最小间距（审查 MINOR-1）：末跑一次正向 pass 恢复保证；
            // 极窄轨道下右端可超出 inset（视觉贴边），命中区仍互不重叠
            for i in 1..<xs.count { xs[i] = Swift.max(xs[i], xs[i - 1] + Self.minGap) }
        }
        self.stationX = xs

        // 指针：选中站点对齐站点（含间距修正）；离格值（精确输入）按真实比例
        if let index = values.firstIndex(of: staged) {
            self.caretX = xs[index]
        } else {
            self.caretX = Swift.min(Swift.max(Self.proportionalX(staged, lo: loV, hi: hiV, width: width), 2), width - 2)
        }
    }

    func trueX(_ value: Double) -> CGFloat {
        Self.proportionalX(value, lo: lo, hi: hi, width: width)
    }

    private static func proportionalX(_ value: Double, lo: Double, hi: Double, width: CGFloat) -> CGFloat {
        CGFloat((value - lo) / (hi - lo)) * width
    }
}

private struct RailCaretTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

/// 面板展开时的 35ms 级联入场（拍板动效；reduced-motion 下直接显示）。
private struct CascadeIn: ViewModifier {
    let index: Int
    let enabled: Bool
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 4)
            .onAppear {
                guard enabled else {
                    shown = true
                    return
                }
                withAnimation(.easeOut(duration: 0.22).delay(Double(index) * 0.035)) {
                    shown = true
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
