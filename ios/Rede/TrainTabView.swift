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

    // 休息倒计时单一真相在 SessionStore.restCountdown（墙钟锚点，跨切页/切应用存活）；
    // 本层只渲染。restTick 每秒由计时 task 递增，驱动按墙钟重算剩余并重绘——
    // 不用 TimelineView，因其在「切出应用再回」时不保证恢复逐秒刷新（owner 2026-06-15 反馈）；
    // scenePhase 让计时 task 在回前台时重启（同切 tab 重建视图的效果），既追平剩余又续走。
    @Environment(\.scenePhase) private var scenePhase
    @State private var restTick = 0
    @State private var showAdjust = false
    /// 用户在本组是否做过有效调整（用户真机反馈修复 2026-06-10）：
    /// 关面板 = 收起控件，不丢弃决定——暂存值随本组保留直到打勾/跳过/换动作。
    /// 撤销路径是「跟随」站点（回引擎默认），不由关面板承担。
    @State private var hasAdjustment = false
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
        // 会话边界：换场（结束/新开训练）后旧暂存绝不滞留到新会话首组
        .onChange(of: sessionStore.sessionStartedAt) { _, _ in clearAdjustment() }
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
            Text(exercise.map { localeStore.exerciseName($0.exerciseId) } ?? "")
                .font(.redeSubhead)
                .foregroundStyle(Color.redeT2)

            Button(action: { startAdjust(targetKg: targetKg, recommendation: recommendation) }) {
                let staging = showAdjust || hasAdjustment
                let heroReps = staging ? adjustReps : (recommendation?.targetReps ?? exercise?.sets.first?.targetReps ?? 0)
                HStack(alignment: .bottom, spacing: 8) {
                    // 三态大数字（wave-9）：自重=次数、辅助=「辅助 N」、其余=重量。
                    Text(s.heroNumber(
                        loadType: flow.currentExercise?.loadType ?? "external",
                        weightKg: LoadDisplay.snap(staging ? adjustWeight : targetKg,
                                                   exerciseId: flow.currentExercise?.exerciseId ?? "", s),
                        reps: heroReps
                    ))
                        .font(.redeDisplay)
                        .monospacedDigit()
                        .foregroundStyle(Color.redeT1)
                        .contentTransition(.numericText(value: currentIsRepBased ? Double(heroReps) : (staging ? adjustWeight : targetKg)))
                        .animation(reduceMotion ? nil : .easeOut(duration: 0.2),
                                   value: currentIsRepBased ? Double(heroReps) : (staging ? adjustWeight : targetKg))
                    Text(currentIsRepBased
                         ? s.trainLoadSuffixBodyweight(targetRir: staging ? adjustRir.map(Double.init) : (recommendation?.targetRir ?? 2))
                         : s.trainLoadSuffix(
                            targetReps: staging ? adjustReps : (recommendation?.targetReps ?? 0),
                            targetRir: staging ? adjustRir.map(Double.init) : (recommendation?.targetRir ?? 2)
                    ))
                    .font(.redeCallout)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT3)
                    .padding(.bottom, 8)
                    // 可调暗示（FR-TR2 可见性）；已调整且收起 = ember（「被采纳的调整」合法口音）
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 13))
                        .foregroundStyle(hasAdjustment && !showAdjust ? Color.redeEmber : Color.redeT4)
                        .padding(.bottom, 10)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // 跟上次比（基调微调 2026-06-15）：卡片内多一行「上次 W×N + 升降」，基调不动。
            // 首练 change=start 显式切断（审查 M1）；其余按 loadType 取 L10n 上次行。
            if let p = currentPrescription(flow), p.change.rawValue != "start",
               let prev = s.lastRefLine(loadType: p.loadType,
                                        prevWeightKg: p.previousWeightKg.map { LoadDisplay.snap($0, loadType: p.loadType, equipment: p.equipment, s) },
                                        prevReps: p.previousTopReps) {
                HStack(spacing: 6) {
                    Text(prev)
                        .font(.redeCaption).monospacedDigit()
                        .foregroundStyle(Color.redeT4)
                    changeTag(p.change.rawValue)
                }
                .padding(.top, 6)
            }

            if !hasUsedQuickAdjust && !showAdjust {
                Text(currentIsAssisted ? s.adjustDiscoverHintAssisted : (currentIsBodyweightPlus ? s.adjustDiscoverHintBodyweightPlus : (currentIsRepBased ? s.adjustDiscoverHintBodyweight : s.adjustDiscoverHint)))
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
                    : (currentIsAssisted
                       ? s.nextSetWhyAssisted(reasonCode: recommendation?.reason.code ?? "onPlan")
                       : (currentIsBodyweightPlus
                          ? s.nextSetWhyBodyweightPlus(reasonCode: recommendation?.reason.code ?? "onPlan", fromKg: flow.completedInCurrentExercise.last.map { LoadDisplay.weight($0.weightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s) })
                          : (currentIsRepBased
                             ? s.nextSetWhyBodyweight(reasonCode: recommendation?.reason.code ?? "onPlan")
                             : s.nextSetWhy(
                                  reasonCode: recommendation?.reason.code ?? "onPlan",
                                  fromKg: flow.completedInCurrentExercise.last.map { LoadDisplay.weight($0.weightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s) }
                              ))))))
                .font(.redeCallout)
                .foregroundStyle(Color.redeT3)
                .padding(.top, 10)

            HStack(spacing: 8) {
                SteelButton(
                    title: currentIsAssisted
                        ? s.holdLabelAssisted(kg: LoadDisplay.weight(plannedWeight(flow), exerciseId: flow.currentExercise?.exerciseId ?? "", s), holding: flow.isHolding)
                        : (currentIsBodyweightPlus
                            ? s.holdLabelBodyweightPlus(kg: LoadDisplay.weight(plannedWeight(flow), exerciseId: flow.currentExercise?.exerciseId ?? "", s), holding: flow.isHolding)
                            : (currentIsRepBased
                                ? s.holdLabelBodyweight(reps: flow.currentRecommendation?.targetReps ?? plannedSetReps(flow), holding: flow.isHolding)
                                : s.holdLabel(kg: LoadDisplay.weight(plannedWeight(flow), exerciseId: flow.currentExercise?.exerciseId ?? "", s), holding: flow.isHolding))),
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

    // MARK: - 跟上次比（基调微调 2026-06-15；L10n 债同今日/进展：中文串暂在视图层）

    /// 当前动作的处方条目（含「上次」素材）；换动作后原 id 不匹配 → nil（不显示上次行）。
    private func currentPrescription(_ flow: TrainFlowState) -> ExercisePrescriptionPlan? {
        flow.prescription.exercises.first { $0.exerciseId == flow.currentExercise?.exerciseId }
    }

    @ViewBuilder
    private func changeTag(_ change: String) -> some View {
        if let tag = s.trainChangeTag(change) {
            let color: Color = change == "ease" ? .redeEmber2 : (change == "hold" ? .redeT4 : .redeEmber)
            Text(tag).font(.redeCaption).foregroundStyle(color)
        }
    }

    private func restState(_ flow: TrainFlowState) -> some View {
        // 倒计时与进度条按墙钟逐秒重算：剩余值算自 SessionStore 的绝对结束时刻；
        // 读 restTick（每秒由 runRestTimer 递增）建立每秒重绘依赖（墙钟剩余非 @Observable）。
        _ = restTick
        let remaining = sessionStore.restRemainingSeconds
        return VStack(spacing: 10) {
            Overline(text: s.restLabel, color: .redeRec2)
            Text(formattedRest(remaining))
                .font(.redeDisplay)
                .monospacedDigit()
                .foregroundStyle(Color.redeT1)
                // VoiceOver 念「休息，剩 1:57」整条，数字随墙钟更新；下方进度条是同信息的视觉冗余
                .accessibilityLabel("\(s.restLabel)，\(formattedRest(remaining))")
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color(redeHex: 0x231F19)).frame(height: 4)
                    // 进度填充用主题琥珀橙（同今日页当前动作条/hero 口音），略加粗到 4pt
                    Capsule().fill(Color.redeEmber)
                        .frame(width: geo.size.width * sessionStore.restFraction, height: 4)
                        .animation(.linear(duration: 1), value: remaining)
                }
            }
            .frame(width: 180, height: 4)
            .accessibilityHidden(true) // 进度条是倒计时数字的视觉冗余，避免 VoiceOver 重复噪声

            Text(restPreviewText(flow))
                .font(.redeCallout)
                .monospacedDigit()
                .foregroundStyle(Color.redeT3)

            HStack(spacing: 8) {
                SteelButton(title: s.restAdd30, action: { sessionStore.addRestTime(30) })
                SteelButton(title: sessionStore.restIsPaused ? s.restResume : s.restPause,
                            isOn: sessionStore.restIsPaused,
                            action: { sessionStore.toggleRestPause() })
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
            return next.map { s.restNextExercise(localeStore.exerciseName($0.exerciseId)) } ?? ""
        }
        guard let rec = flow.currentRecommendation else { return "" }
        if flow.currentExercise?.loadType == "bodyweight" || flow.currentExercise?.loadType == "band" {
            return s.restNextPreviewBodyweight(setNumber: rec.setIndex, reps: rec.targetReps)
        }
        if flow.currentExercise?.loadType == "assisted" {
            return s.restNextPreviewAssisted(setNumber: rec.setIndex, kg: LoadDisplay.weight(rec.targetWeightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s), reps: rec.targetReps)
        }
        if flow.currentExercise?.loadType == "bodyweight-plus" {
            return s.restNextPreviewBodyweightPlus(setNumber: rec.setIndex, kg: LoadDisplay.weight(rec.targetWeightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s), reps: rec.targetReps)
        }
        return s.restNextPreview(setNumber: rec.setIndex, kg: LoadDisplay.weight(rec.targetWeightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s), reps: rec.targetReps)
    }

    // MARK: - 快改刻度轨（FR-TR2 两击内；M5-3 拍板设计 = rede-app.html #533）
    // 档位由 AdjustOptionsBuilder（包内纯函数）生成；预演 = 落盘同规则（AdjustPreview）。
    // ember 口音纪律：面板内唯一 ember = 指针；预演 tick 用中性色。

    private func adjustPanel(_ flow: TrainFlowState) -> some View {
        let options = adjustOptions(flow)
        return VStack(alignment: .leading, spacing: 0) {
            if !currentIsRepBased {
                // 自重无重量轴：隐藏重量刻度轨/±/精确，次数带成为主控（wave-6 UI 片）
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
            }
            Overline(text: s.adjustReps)
                .padding(.top, currentIsRepBased ? 0 : 14)
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

    /// 当前动作的渐进一档（目录步长随计划透传；无会话时回退引擎默认）。
    private var currentStepKg: Double {
        flow?.currentExercise?.stepKg ?? AdjustOptionsBuilder.stepKg
    }

    /// 纯次数动作（无重量轴）：自重（wave-6）+ 弹力带（wave-12，A 案按次数进阶）——
    /// big hero 显次数、组行重量列显「—」。两者 train 显示完全一致（NextSetEngine 无到顶
    /// reason，故 train 侧零分叉；到顶换带提示只在今日页 change 行）。
    private var currentIsRepBased: Bool {
        let lt = flow?.currentExercise?.loadType
        return lt == "bodyweight" || lt == "band"
    }
    /// 辅助器械（wave-9）：有重量轴（=辅助量），显示带「辅助」前缀，不像自重隐藏重量列。
    private var currentIsAssisted: Bool { flow?.currentExercise?.loadType == "assisted" }
    /// 负重自重（wave-11）：有重量轴（=外挂负重），显示带「负重 +」前缀，方向同 external。
    private var currentIsBodyweightPlus: Bool { flow?.currentExercise?.loadType == "bodyweight-plus" }
    /// 负荷单元格文案（wave-9/11）：辅助/负重冠前缀。视觉档位/组表行已靠表头标列显裸值
    /// （避免窄格截断），故本助手现仅 VoiceOver 用——孤立朗读带前缀比裸值清楚。
    private func loadCellText(_ kg: Double) -> String {
        let w = LoadDisplay.snap(kg, exerciseId: flow?.currentExercise?.exerciseId ?? "", s)
        if currentIsAssisted { return s.assistValue(s.formatKg(w)) }
        if currentIsBodyweightPlus { return s.weightedValue(s.formatKg(w)) }
        return s.formatKg(w)
    }
    /// 小结顶组文案（wave-6/11）：按顶组动作 loadType 分发——自重只显次数、负重自重冠「负重 +」。
    private func summaryTopSetText(_ top: SessionSummary.TopSet) -> String {
        let name = localeStore.exerciseName(top.exerciseId)
        switch ExerciseCatalog.minimal.entry(id: top.exerciseId)?.loadType {
        case "bodyweight", "band": return s.summaryTopSetBodyweight(name: name, reps: top.reps)   // wave-12：弹力带同自重只显次数
        case "bodyweight-plus": return s.summaryTopSetBodyweightPlus(name: name, kg: LoadDisplay.weight(top.weightKg, exerciseId: top.exerciseId, s), reps: top.reps)
        default: return s.summaryTopSet(name: name, kg: LoadDisplay.weight(top.weightKg, exerciseId: top.exerciseId, s), reps: top.reps)
        }
    }

    private func adjustOptions(_ flow: TrainFlowState) -> [AdjustOption] {
        // 单位原生（2026-06-15）：档位取真实梯子相邻格，按当前动作器械×显示单位。
        let exerciseId = flow.currentExercise?.exerciseId ?? ""
        let equip = LoadGrid.gridEquipment(
            loadType: flow.currentExercise?.loadType ?? "external",
            equipment: ExerciseCatalog.minimal.entry(id: exerciseId)?.equipment ?? "dumbbell"
        )
        return AdjustOptionsBuilder.options(
            followKg: flow.currentTargetWeightKg ?? 0,
            lastActualKg: flow.completedInCurrentExercise.last?.weightKg,
            plannedKg: plannedWeight(flow),
            equipment: equip,
            unit: LoadUnit(unitSystem: s.unit.rawValue)
        )
    }

    /// 头行：重量标签 + 弱化文字级微调（−/＋ 一档、精确输入），不与档位竞争视觉。
    private var railHeader: some View {
        HStack(spacing: 0) {
            Overline(text: currentIsAssisted ? s.adjustAssist : (currentIsBodyweightPlus ? s.adjustWeighted : s.adjustWeight))
            Spacer()
            railOp("−") { stepAdjustWeight(-currentStepKg) }
            railDivider
            railOp("＋") { stepAdjustWeight(currentStepKg) }
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
        hasAdjustment = true
        adjustWeightText = s.formatKg(adjustWeight)
    }

    /// 刻度轨：一档细刻（动作步长）/ 整 10kg 主刻；站点按真实比例落位（最小间距保护）；
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
                    let fine = currentStepKg
                    var v = (layout.lo / fine).rounded(.up) * fine
                    while v <= layout.hi {
                        let x = layout.trueX(v)
                        let major = v.truncatingRemainder(dividingBy: 10) == 0
                        var tick = Path()
                        tick.move(to: CGPoint(x: x, y: tickTop))
                        tick.addLine(to: CGPoint(x: x, y: tickTop + (major ? 10 : 6)))
                        ctx.stroke(tick, with: .color(Color.redeHair), lineWidth: 1)
                        v += fine
                    }
                }
                .accessibilityHidden(true)

                ForEach(Array(options.enumerated()), id: \.element.weightKg) { index, option in
                    let selected = adjustWeight == option.weightKg
                    Button(action: { selectStation(option) }) {
                        VStack(spacing: 2) {
                            Overline(text: currentIsAssisted ? s.adjustOptionLabelAssisted(option.role.rawValue) : s.adjustOptionLabel(option.role.rawValue),
                                     color: selected ? .redeT3 : .redeT4)
                                .lineLimit(1)
                                .fixedSize()   // 标签不截断（可视超出命中框，命中区不变）
                            // 刻度轨表头已标「辅助」→ 档位显裸值（与 external 在「重量」表头下一致；
                            // 56pt 窄格放不下「辅助 60」会截断）。VoiceOver 仍带前缀见下。
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
                    .accessibilityLabel("\(currentIsAssisted ? s.adjustOptionLabelAssisted(option.role.rawValue) : s.adjustOptionLabel(option.role.rawValue)) \(loadCellText(option.weightKg)) \(s.unitLabel)")
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
        hasAdjustment = true
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
            // 整面板（2026-06-11 欠账清尾）：输入可供性改 baseline 刻线式
            // （与刻度轨同族），不再是圆角填充盒；聚焦时基线提亮
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(weightFieldFocused ? Color.redeSteel : Color.redeEtch)
                    .frame(height: weightFieldFocused ? 2 : 1)
            }
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
    /// M5-2 FR-SE1：输入按当前显示单位理解（lb 输入 → 换算回 canonical kg 存）；
    /// 文本未改动时不重解析——防 lb 往返换算漂移（显示取 0.5 lb 步进，反解会偏移原 kg 值）。
    private func commitWeightText() {
        guard adjustWeightText != s.formatKg(adjustWeight) else { return }
        if let parsed = Double(adjustWeightText.replacingOccurrences(of: ",", with: ".")), parsed >= 0 {
            adjustWeight = s.unit == .lb ? parsed / 2.204_622_621_8 : parsed
            hasAdjustment = true
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
                Button(action: { adjustReps = n; hasAdjustment = true; selectionPulse += 1 }) {
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
                .accessibilityLabel("\(n)")
                .accessibilityAddTraits(n == adjustReps ? .isSelected : [])
            }
        }
    }

    /// RIR 直选带：「—」= 不记（引擎不猜）；0/1 = 力竭回退区 caution 微标。
    private var rirStrip: some View {
        let cells: [Int?] = [nil, 0, 1, 2, 3, 4, 5]
        return HStack(spacing: 0) {
            ForEach(Array(cells.enumerated()), id: \.offset) { index, value in
                if index > 0 { stripDivider }
                Button(action: { adjustRir = value; hasAdjustment = true; selectionPulse += 1 }) {
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
                .accessibilityAddTraits(value == adjustRir ? .isSelected : [])
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
            text = (currentIsAssisted
                    ? s.adjustPreviewNextAssisted(kg: s.formatKg(projection.targetWeightKg))
                    : (currentIsBodyweightPlus
                       ? s.adjustPreviewNextBodyweightPlus(kg: s.formatKg(projection.targetWeightKg))
                       : (currentIsRepBased
                          ? s.adjustPreviewNextBodyweight(reps: projection.targetReps)
                          : s.adjustPreviewNext(kg: s.formatKg(projection.targetWeightKg)))))
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
                if !currentIsRepBased {
                    Overline(text: currentIsAssisted ? s.trainColAssist : (currentIsBodyweightPlus ? s.trainColWeighted : s.trainColWeight)).frame(maxWidth: .infinity, alignment: .leading)
                }
                // 自重无重量列：次数接管弹性空间（整列移除而非留空，2026-06-13 owner 反馈）
                Overline(text: s.trainColReps).frame(maxWidth: currentIsRepBased ? .infinity : 60, alignment: .leading)
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
                        weight: LoadDisplay.weight(obs.weightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s),
                        reps: "\(obs.reps)",
                        rir: obs.rir.map { s.formatRir($0) } ?? "—",
                        marker: .done,
                        hideWeight: currentIsRepBased
                    )
                case .skipped:
                    setRow(
                        number: plannedSet.index,
                        weight: LoadDisplay.weight(plannedSet.targetWeightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s),
                        reps: "\(plannedSet.targetReps)",
                        rir: "—",
                        marker: .skipped,
                        hideWeight: currentIsRepBased
                    )
                case .active:
                    // 活动行与 hero 卡同源（用户真机反馈 2026-06-10：不能卡片跟随了表里还是计划值）：
                    // 暂存调整 > 引擎建议 > 计划值
                    let staging = showAdjust || hasAdjustment
                    let rec = flow.currentRecommendation
                    setRow(
                        number: plannedSet.index,
                        weight: LoadDisplay.weight(staging ? adjustWeight : (rec?.targetWeightKg ?? plannedSet.targetWeightKg), exerciseId: flow.currentExercise?.exerciseId ?? "", s),
                        reps: "\(staging ? adjustReps : (rec?.targetReps ?? plannedSet.targetReps))",
                        rir: "—",
                        marker: .active,
                        hideWeight: currentIsRepBased
                    )
                case .pending:
                    // 未来行 = 引擎默认轨迹（执行事实是基线：按当前目标延续；不含未打勾的暂存——
                    // 暂存只在打勾后才会改变轨迹，回流合同口径）
                    setRow(
                        number: plannedSet.index,
                        weight: LoadDisplay.weight(flow.currentTargetWeightKg ?? plannedSet.targetWeightKg, exerciseId: flow.currentExercise?.exerciseId ?? "", s),
                        reps: "\(plannedSet.targetReps)",
                        rir: "—",
                        marker: .pending,
                        hideWeight: currentIsRepBased
                    )
                }
            }
        }
    }

    private enum RowMarker { case done, skipped, active, pending }

    private func setRow(number: Int, weight: String, reps: String, rir: String, marker: RowMarker, hideWeight: Bool = false) -> some View {
        let textColor: Color = switch marker {
        case .done: .redeT2
        case .active: .redeT1
        case .skipped, .pending: .redeT4
        }
        let isActive = marker == .active
        return HStack {
            Text("\(number)").frame(width: 44, alignment: .leading)
            if !hideWeight {
                Text("\(weight) \(s.unitLabel)").frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(reps).frame(maxWidth: hideWeight ? .infinity : 60, alignment: .leading)
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
                Text(s.restNextExercise(localeStore.exerciseName(next.exerciseId)) + " · \(next.sets.count) × \(next.sets.first?.targetReps ?? 0)")
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

    // 整面板（2026-06-11）：空态是「道歉」不是「判断」，不配 hero 铭牌——
    // 开放式直落 base（与 Progress 空态语法统一）
    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(s.trainEmptyTitle)
                .font(.redeHeadline)
                .tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
            if sessionStore.todayModel != nil, sessionStore.todayModel?.prescription == nil {
                Text(s.trainRestDayNote).font(.redeCallout).foregroundStyle(Color.redeT3)
            }
            EmbButton(icon: "arrow.left", title: s.trainEmptyAction, action: onGoToday)
                .padding(.top, 4)
        }
        .padding(.top, 24)
    }

    // MARK: - Sheets

    // 整面板公理（拍板 2026-06-11）：sheet = 掀开的 base 锻面，不是弹出的大卡。
    // 动作列表 = 开放行（文字+chevron+hairline，affordance 三件套），不堆描边按钮。

    /// 开放动作行：文字级 + chevron + hairline 分隔（最后一行由调用方控制）。
    private func sheetActionRow(_ title: String, divider: Bool = true, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack {
                    Text(title)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeT2)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.redeT4)
                        .accessibilityHidden(true) // 装饰性 affordance；行 Button 已承载动作
                }
                .frame(minHeight: 44)
                if divider {
                    Rectangle().fill(Color.redeHair2).frame(height: 1)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var moreSheet: some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: s.skipSetAction)
                .padding(.top, 18)
            VStack(spacing: 0) {
                ForEach(Array(["equipmentBusy", "painDiscomfort", "fatigue", "timeShort"].enumerated()), id: \.element) { idx, code in
                    sheetActionRow(s.skipReasonLabel(code), divider: idx < 3) { skipSet(code) }
                }
            }
            .padding(.top, 4)
            EngraveDivider().padding(.vertical, 12)
            sheetActionRow(s.skipExerciseAction) { skipExercise() }
            sheetActionRow(s.swapExerciseAction, divider: false) {
                showMoreSheet = false
                showSwapSheet = true
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .presentationDetents([.height(380)])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.redeBase)
    }

    private var swapSheet: some View {
        VStack(alignment: .leading, spacing: 0) {
            Overline(text: s.swapExerciseAction)
                .padding(.top, 18)
            if let candidates = flow?.replacementCandidates, !candidates.isEmpty {
                // bug 修复（2026-06-14，真机抓到）：候选随内容扩充可多达 12 项（卧推/划船/深蹲族），
                // 原「普通 VStack + 固定 280pt sheet」放不下又无滚动容器 → 底部动作划不动够不着。
                // 套 ScrollView 让列表可滚（标题固定只滚列表），detents 改可变半屏/全屏。
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(Array(candidates.enumerated()), id: \.element) { idx, id in
                            sheetActionRow(localeStore.exerciseName(id), divider: idx < candidates.count - 1) {
                                clearAdjustment() // 换动作 = 新目标，旧暂存作废
                                sessionStore.apply(.replaceExercise(id))
                                showSwapSheet = false
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            } else {
                Text("—").foregroundStyle(Color.redeT3).padding(.top, 12)
                Spacer()
            }
        }
        .padding(.horizontal, 20)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.redeBase)
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
            // 整面板：次操作降文字级（A2-6），不再双按钮盒并立
            Button(action: { sessionStore.apply(.keepTraining) }) {
                Text(s.keepTraining)
                    .font(.redeBody)
                    .foregroundStyle(Color.redeT3)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // 放弃出口（owner 反馈 2026-06-13）：取消进行中训练、什么都不存
            EngraveDivider().padding(.vertical, 2)
            Button(action: { sessionStore.abandonActiveSession() }) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(s.endWorkoutDiscard)
                        .font(.redeBody)
                        .foregroundStyle(Color.redeRisk)
                    Text(s.endWorkoutDiscardNote)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(20)
        .presentationDetents([.height(360)])
        .presentationDragIndicator(.visible) // 审查 MINOR-2：§12.3 grabber
        .presentationBackground(Color.redeBase)
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
            }
            .padding(.top, 4)

            // 整面板：PR 时刻 = 本弹层唯一铭牌（原型 #sumPRcard 语法，两端统一拍板 2026-06-11）
            if summary?.isPersonalRecord == true, let top = summary?.topSet {
                ForgedCard {
                    HStack(spacing: 11) {
                        Image(systemName: "trophy")
                            .font(.system(size: 20))
                            .foregroundStyle(Color.redeEmber)
                            .accessibilityHidden(true) // 装饰图标；PR 文本已表语义
                        VStack(alignment: .leading, spacing: 2) {
                            Overline(text: s.summaryPr, color: .redeEmber2)
                            Text(summaryTopSetText(top))
                                .font(.redeBody)
                                .foregroundStyle(Color.redeT1)
                        }
                    }
                    .padding(14)
                }
            } else if let top = summary?.topSet {
                Text(summaryTopSetText(top))   // 非 PR 顶组也走三态分发（审查 MAJOR：原内联只判 bodyweight，负重自重裸显）
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
        .presentationDetents([.height(380)])
        .presentationBackground(Color.redeBase)
        .interactiveDismissDisabled(true)
    }

    private func summaryStat(value: String, label: String, valueColor: Color = .redeT1) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(.redeTitle).monospacedDigit().foregroundStyle(valueColor)
            Overline(text: label)
        }
    }

    // MARK: - 行为

    /// 当前指针组的计划次数（自重 hold 标签用）。
    private func plannedSetReps(_ flow: TrainFlowState) -> Int {
        guard let exercise = flow.currentExercise, !exercise.sets.isEmpty else { return 0 }
        let pointer = min(flow.completedInCurrentExercise.count + flow.skippedInCurrentExercise, exercise.sets.count - 1)
        return exercise.sets[pointer].targetReps
    }

    private func plannedWeight(_ flow: TrainFlowState) -> Double {
        guard let exercise = flow.currentExercise, !exercise.sets.isEmpty else { return 0 }
        let pointer = min(flow.completedInCurrentExercise.count + flow.skippedInCurrentExercise, exercise.sets.count - 1)
        return exercise.sets[pointer].targetWeightKg
    }

    private func startAdjust(targetKg: Double, recommendation: NextSetRecommendation?) {
        hasUsedQuickAdjust = true // 提示服务「入口发现」：打开过即达成，与是否真改无关（拍板留痕）
        if !showAdjust, !hasAdjustment { // 已有有效调整时重开面板不重置（保留用户决定）
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

    /// 暂存生命周期终点：打勾 / 跳过 / 换动作——指针换组后旧暂存绝不能滞留。
    private func clearAdjustment() {
        showAdjust = false
        hasAdjustment = false
        showExactField = false
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
        let staging = showAdjust || hasAdjustment // 调整后关面板 = 决定保留（用户真机反馈修复）
        let observation = CompletedSetObservation(
            weightKg: staging ? adjustWeight : target,
            reps: staging ? adjustReps : (recommendation?.targetReps ?? 0),
            // 快改面选「不记」→ nil 落盘（引擎不猜）；本组从未调整维持现状（默认目标 RIR）
            rir: staging ? adjustRir.map(Double.init) : Double(Int(recommendation?.targetRir ?? 2)),
            painReported: flow.painReportedForCurrentSet
        )
        sessionStore.apply(.logSet(observation))
        logPulse += 1
        clearAdjustment()
        painToastVisible = false
        // 进入休息时倒计时由 SessionStore.apply 起锚（见 syncRestCountdown），此处不再手动置位。
    }

    private func registerPain() {
        sessionStore.apply(.reportPain)
        painToastVisible = true
    }

    private func skipSet(_ code: String) {
        showMoreSheet = false
        painToastVisible = false
        guard let reason = SetSkipReason(rawValue: code) else { return }
        clearAdjustment() // 指针换组，旧暂存不得滞留到下一组
        sessionStore.apply(.skipSet(reason))
    }

    private func skipExercise() {
        showMoreSheet = false
        painToastVisible = false
        clearAdjustment()
        sessionStore.apply(.skipExercise(.other))
    }

    private func finishRest() {
        sessionStore.apply(.restFinished) // 清空倒计时锚点在 syncRestCountdown 内
    }

    private func formattedRest(_ remaining: Int) -> String {
        "\(remaining / 60):" + String(format: "%02d", remaining % 60)
    }


    // 含 scenePhase：回前台时 key 变 → task 重启（同切 tab 重建视图），保证追平剩余并续走逐秒刷新。
    private var restTaskKey: String {
        "\(flow?.phase == .resting ? "rest" : "idle")-\(flow?.exerciseIndex ?? 0)-\(flow?.completedInCurrentExercise.count ?? 0)-\(scenePhase == .active ? "fg" : "bg")"
    }

    // 计时 task：每秒递增 restTick 驱动显示按墙钟重算，并在到点时自动进下一组。
    // 切 tab（视图重建）/ 切应用回前台（scenePhase 变 → restTaskKey 变）都会重启本 task；
    // 离屏期间剩余在 SessionStore 墙钟锚点里照常流逝，回来即追平、若已到点立即收尾。
    private func runRestTimer() async {
        guard scenePhase == .active else { return } // 后台不空转
        while !Task.isCancelled, sessionStore.flow?.phase == .resting {
            // 先判后睡：回来若已到点立即收尾推进（不空等 1 秒、不闪 0:00）。
            if !sessionStore.restIsPaused, sessionStore.restRemainingSeconds <= 0 {
                finishRest()
                break
            }
            restTick &+= 1 // 触发墙钟剩余重算重绘
            try? await Task.sleep(nanoseconds: 1_000_000_000)
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
