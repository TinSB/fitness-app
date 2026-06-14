import SwiftUI
import RedeL10n
import RedeTrainingDecision

// Today — 按 rede-app.html #s-today 复原。
// M2-3：引擎真数据接入（裁决+处方），视觉与 M0-2 静态复原完全一致、只换数据源。
// 文案走 RedeL10n 双语 key/模板（引擎零文案）；重量 kg 口径（FR-SE1 落地前不硬编码 lb）。

struct TodayTabView: View {
    let onStartTraining: () -> Void

    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore
    @State private var reasonExpanded = false
    @State private var showSettings = false

    private var model: TodayModel? { sessionStore.todayModel }

    private var isUnreadable: Bool {
        if case .unreadable? = sessionStore.todayOutcome { return true }
        return false
    }

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(
                    title: s.todayTitle,
                    subtitle: model.map { s.dateLine($0.now) } ?? "",
                    trailingIcon: "gearshape",
                    onTrailingTap: { showSettings = true }
                )

                heroCard
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 20)

                receiptSection
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, RedeSpace.section)

                RuleDivider()

                progressRail
                    .padding(.horizontal, RedeSpace.page)
            }
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
        .task { if sessionStore.todayOutcome == nil { await sessionStore.loadToday() } }
        .alert(s.resumeSessionTitle, isPresented: Binding(
            get: { sessionStore.pendingDraft != nil },
            // 系统 Cancel/滑走 = 稍后再说：清提示但保留 draft 文件，下次启动再问
            set: { if !$0 { sessionStore.pendingDraft = nil } }
        )) {
            Button(s.resumeSessionContinue) {
                sessionStore.restorePendingDraft()
                onStartTraining()
            }
            Button(s.resumeSessionDiscard, role: .destructive) {
                sessionStore.discardPendingDraft()
            }
            // 显式取消（=稍后再说）：不给的话 SwiftUI 注入系统 Cancel，跟随设备
            // 语言而非 app 内语言；动作留空，binding set(false) 负责清提示留 draft
            Button(s.resumeSessionLater, role: .cancel) {}
        } message: {
            Text(s.resumeSessionMessage)
        }
        .sheet(isPresented: $showSettings) {
            // 工艺重做（2026-06-10）：内容超半屏，补 .large 档 + 拖拽指示条
            SettingsSheet(store: localeStore)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - 引擎数据投影（纯展示取值）

    private var callCode: String { model?.verdict.call.rawValue ?? "train" }
    private var reasonCode: String { model?.verdict.reason.code ?? "noHistoryCalibration" }
    private var firstExercise: ExercisePrescriptionPlan? { model?.prescription?.exercises.first }

    private var pillFill: Color {
        if isUnreadable { return .redeT4 }
        switch callCode {
        case "light", "deload": return .redeEmber2
        case "rest": return .redeT4
        default: return .redeRec
        }
    }

    private var pillText: Color {
        if isUnreadable { return .redeT3 }
        switch callCode {
        case "light", "deload": return .redeEmber2
        case "rest": return .redeT3
        default: return .redeRec2
        }
    }

    private var gapDays: Int? {
        guard let signals = model?.verdict.signals else { return nil }
        for signal in signals {
            if case .daysSinceLastSession(let days) = signal { return days }
        }
        return nil
    }

    private var consecutiveDays: Int? {
        guard let signals = model?.verdict.signals else { return nil }
        for signal in signals {
            if case .consecutiveTrainingDays(let days) = signal { return days }
        }
        return nil
    }

    private var signalLineText: String {
        guard let signals = model?.verdict.signals else { return s.signalLine(gapDays: nil, sessionsLast7: 0, planned: 0) }
        var last7 = 0
        var planned = 0
        var hasHistory = false
        for signal in signals {
            switch signal {
            case .sessionsInLast7Days(let count): last7 = count
            case .plannedDaysPerWeek(let days): planned = days
            case .daysSinceLastSession: hasHistory = true
            default: break
            }
        }
        return s.signalLine(gapDays: hasHistory ? gapDays : nil, sessionsLast7: last7, planned: planned)
    }

    private var changeLineText: String {
        guard let first = firstExercise else { return s.changeLineNone }
        return changeLine(for: first)
    }

    /// 单动作变化行（任意动作复用，wave-12 提炼）：原仅头牌动作内联，现抽出供里程摘要按动作调用。
    private func changeLine(for ex: ExercisePrescriptionPlan) -> String {
        // 辅助毕业 / 负重回退（wave-9/11）：必须**前置**——切换那刻引擎已切自重孪生
        //（loadType=bodyweight），靠 reason 区分，否则被下面 bodyweight 分支吞掉、丢文案。
        if ex.reason == .assistedGraduated {
            return s.changeLineAssistedGraduated(exerciseName: localeStore.exerciseName(ex.exerciseId))
        }
        if ex.reason == .bodyweightPlusDegraded {
            return s.changeLineBodyweightPlusDegraded(exerciseName: localeStore.exerciseName(ex.exerciseId), reps: ex.targetReps)
        }
        if ex.loadType == "bodyweight" || ex.loadType == "band" {
            // 自重/弹力带共用按次数 change 行；弹力带（wave-12）到顶分叉换带提示。
            let isBand = ex.loadType == "band"
            return s.changeLineBodyweight(
                exerciseName: localeStore.exerciseName(ex.exerciseId),
                change: ex.change.rawValue,
                reps: ex.targetReps,
                atCeiling: ex.reason == (isBand ? .bandCeilingReached : .bodyweightCeilingReached),
                isBand: isBand
            )
        }
        if ex.loadType == "assisted" {
            return s.changeLineAssisted(
                exerciseName: localeStore.exerciseName(ex.exerciseId),
                change: ex.change.rawValue,
                fromKg: ex.previousWeightKg.map(s.formatKg),
                toKg: s.formatKg(ex.targetWeightKg)
            )
        }
        if ex.loadType == "bodyweight-plus" {
            return s.changeLineBodyweightPlus(
                exerciseName: localeStore.exerciseName(ex.exerciseId),
                change: ex.change.rawValue,
                fromKg: ex.previousWeightKg.map(s.formatKg),
                toKg: s.formatKg(ex.targetWeightKg)
            )
        }
        return s.changeLine(
            exerciseName: localeStore.exerciseName(ex.exerciseId),
            change: ex.change.rawValue,
            fromKg: ex.previousWeightKg.map(s.formatKg),
            toKg: s.formatKg(ex.targetWeightKg)
        )
    }

    /// 里程摘要（wave-12，owner 拍板 B）：头牌变化行只覆盖当日第一个动作，配件类（弹力带/自重/
    /// 辅助/负重自重）排不到首位，其里程事件（换带/加配重/毕业/回退）会被吞掉。这里扫全表把
    /// **非头牌**且命中里程的动作单列，复用同一变化行文案。只列里程事件、不列普通进阶——避免每个
    /// 配件每场都刷屏（高信号优先）。
    private var milestoneNotes: [String] {
        guard let exercises = model?.prescription?.exercises, exercises.count > 1 else { return [] }
        return exercises.dropFirst().filter { isMilestone($0.reason) }.map { changeLine(for: $0) }
    }

    /// 里程事件 = 引擎里那几个一次性/转折性的 reason（到顶/毕业/回退）；普通进阶不算。
    private func isMilestone(_ reason: PrescriptionReason) -> Bool {
        switch reason {
        case .bandCeilingReached, .bodyweightCeilingReached, .assistedGraduated, .bodyweightPlusDegraded:
            return true
        default:
            return false
        }
    }

    // HERO = 判断块(判断句唯一最大元素 + ember 左缘唯一口音)
    private var heroCard: some View {
        ForgedCard(emberBarInset: 18, showReg: true) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 7) {
                    Circle().fill(pillFill).frame(width: 7, height: 7)
                    Overline(text: isUnreadable ? s.dataUnreadableStatus : s.verdictStatus(call: callCode), color: pillText)
                }

                Text(isUnreadable ? s.dataUnreadableHeadline : s.verdictHeadline(
                    call: callCode,
                    reasonCode: reasonCode,
                    dayName: model?.prescription.map { s.trainingDayName($0.dayCode) } ?? "",
                    gapDays: gapDays,
                    consecutiveDays: consecutiveDays
                ))
                .font(.redeHeadline)
                .tracking(RedeTracking.headline)
                .lineSpacing(22 * 0.3)
                .foregroundStyle(Color.redeT1)
                .lineLimit(3)
                .padding(.top, 11)

                // 里程摘要（wave-12，owner 拍板 B）：非头牌动作的换带/加配重/毕业/回退提示——
                // 头牌变化行只盖第一个动作，配件类（弹力带等）排不到首位，故单列于此。纯文本行，不占卡预算。
                if !milestoneNotes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        // 以位置为 id（审查 MINOR）：里程文案虽含动作名极难撞，但 id:\.self 对非保证唯一的
                        // 字符串列表是 SwiftUI 已知坑（撞 id 会丢行）；按 offset 走彻底消除。
                        ForEach(Array(milestoneNotes.enumerated()), id: \.offset) { _, note in
                            HStack(alignment: .top, spacing: 6) {
                                Rectangle().fill(Color.redeEmber2).frame(width: 3, height: 3)
                                    .padding(.top, 7)
                                Text(note)
                                    .font(.redeCaption)
                                    .foregroundStyle(Color.redeT3)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.top, 10)
                }

                // Load Plate(20px 次级读数)——rest 日无处方时整块隐藏
                if let first = firstExercise {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 0) {
                            Overline(text: s.todayStartHere, color: .redeEmber2)
                            Text(localeStore.exerciseName(first.exerciseId))
                                .font(.redeSubhead)
                                .foregroundStyle(Color.redeT1)
                                .padding(.top, 7)
                            HStack(alignment: .bottom, spacing: 6) {
                                Text(s.heroNumber(loadType: first.loadType, weightKg: first.targetWeightKg, reps: first.targetReps))
                                    .font(.system(size: 20, weight: .semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Color.redeT1)
                                Text(s.heroDetail(loadType: first.loadType, reps: first.targetReps, rir: Int(first.targetRir)))
                                    .font(.redeCallout)
                                    .monospacedDigit()
                                    .foregroundStyle(Color.redeT3)
                                    .padding(.bottom, 3)
                            }
                            .padding(.top, 5)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 8) {
                            if let second = model?.prescription?.exercises.dropFirst().first {
                                Text(s.thenLine(localeStore.exerciseName(second.exerciseId)))
                                    .font(.redeCaption)
                                    .monospacedDigit()
                                    .foregroundStyle(Color.redeT3)
                            }
                            if let third = model?.prescription?.exercises.dropFirst(2).first {
                                HStack(spacing: 5) {
                                    Rectangle().fill(Color.redeNeu).frame(width: 16, height: 2)
                                    Text(s.thenLine(localeStore.exerciseName(third.exerciseId)))
                                        .font(.redeCaption)
                                        .monospacedDigit()
                                        .foregroundStyle(Color.redeT3)
                                }
                            }
                        }
                    }
                    .padding(.top, RedeSpace.section)
                    .overlay(alignment: .top) {
                        Rectangle().fill(Color.redeHair).frame(height: 1)
                            .padding(.top, 10)
                    }

                    EmbButton(icon: "play.fill", title: s.startTraining, action: onStartTraining)
                        .padding(.top, 16)
                }
            }
            .padding(.leading, 13)
            .padding(.vertical, 18)
            .padding(.horizontal, RedeSpace.card)
        }
    }

    // Receipt 渐进披露
    private var receiptSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Overline(text: s.todayReceiptTitle)
                Spacer()
                Overline(text: s.todayReceiptTag).monospacedDigit()
            }

            Text(isUnreadable ? s.dataUnreadableReceipt : s.receiptConclusion(call: callCode, reasonCode: reasonCode))
                .font(.redeBody)
                .lineSpacing(14 * 0.45)
                .foregroundStyle(Color.redeT1)
                .padding(.top, 8)

            Button {
                withAnimation(.easeInOut(duration: 0.25)) { reasonExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Text(reasonExpanded ? s.todayHideReason : s.todayWhyThisCall)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 15))
                        .rotationEffect(.degrees(reasonExpanded ? 180 : 0))
                }
                .font(.redeBody)
                .foregroundStyle(Color.redeT3)
                .frame(minHeight: RedeShape.controlHeight)
            }
            .buttonStyle(.plain)

            if reasonExpanded {
                Grid(alignment: .topLeading, horizontalSpacing: 14, verticalSpacing: 8) {
                    GridRow {
                        Overline(text: s.receiptSignal).padding(.top, 3)
                        Text(signalLineText)
                            .font(.redeCallout).monospacedDigit()
                            .foregroundStyle(Color.redeT2)
                    }
                    GridRow {
                        Overline(text: s.receiptChange).padding(.top, 3)
                        Text(changeLineText)
                            .font(.redeCallout).monospacedDigit()
                            .foregroundStyle(Color.redeT2)
                    }
                    GridRow {
                        Overline(text: s.receiptControl).padding(.top, 3)
                        // 整面板（2026-06-11）：去描边小框（A3 卡墙微缩版）——
                        // 文字级 + 竖刻线分隔，刻度轨轨头 .rop 同款语法
                        HStack(spacing: 12) {
                            controlOp(s.controlApply)
                            opTick
                            controlOp(s.controlHold)
                            opTick
                            controlOp(s.controlSwap)
                        }
                    }
                }
                .padding(.top, 6)
            }
        }
    }

    private func controlOp(_ title: String) -> some View {
        Text(title)
            .font(.redeCaption)
            .foregroundStyle(Color.redeT2)
            .frame(minHeight: RedeShape.controlHeight)
    }

    private var opTick: some View {
        Rectangle().fill(Color.redeEtch).frame(width: 1, height: 8)
    }

    // Progress Rail: last → today → next
    private var progressRail: some View {
        VStack(alignment: .leading, spacing: 14) {
            Overline(text: firstExercise.map { s.railTitle(localeStore.exerciseName($0.exerciseId)) } ?? s.todayRailTitle)
            ZStack(alignment: .top) {
                GeometryReader { geo in
                    Rectangle()
                        .fill(Color.redeHair)
                        .frame(width: geo.size.width * 0.84, height: 2)
                        .offset(x: geo.size.width * 0.08, y: 7)
                }
                .frame(height: 16)

                HStack(alignment: .top, spacing: 0) {
                    railNode(dot: AnyView(Circle().fill(Color.redeT4).frame(width: 14, height: 14)),
                             value: s.railValue(loadType: firstExercise?.loadType ?? "external", weightKg: model?.railLast?.weightKg, reps: model?.railLast?.reps),
                             valueColor: .redeT3,
                             label: model?.railLast.map { s.shortDate(fromISO: $0.dateISO) } ?? "—",
                             labelColor: .redeT4)
                    railNode(dot: AnyView(RingDot()),
                             value: s.railValue(loadType: firstExercise?.loadType ?? "external", weightKg: firstExercise?.targetWeightKg, reps: firstExercise?.targetReps),
                             valueColor: .redeT1,
                             label: s.railToday, labelColor: .redeEmber2)
                    railNode(dot: AnyView(
                        Circle().fill(Color.redeSurface)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().stroke(Color.redeNextDot, lineWidth: 2))),
                             value: s.railValue(loadType: firstExercise?.loadType ?? "external", weightKg: firstExercise?.nextProjectedWeightKg, reps: firstExercise.map { $0.repLowerBound }),
                             valueColor: .redeT3,
                             label: s.railNext, labelColor: .redeT4)
                }
            }
        }
    }

    private func railNode(dot: AnyView, value: String, valueColor: Color, label: String, labelColor: Color) -> some View {
        VStack(spacing: 8) {
            dot.frame(height: 14)
            Text(value)
                .font(.redeCallout)
                .monospacedDigit()
                .foregroundStyle(valueColor)
            Overline(text: label, color: labelColor)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    TodayTabView(onStartTraining: {})
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
