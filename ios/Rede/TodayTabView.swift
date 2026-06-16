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
                    trailingAccessibilityLabel: s.settingsTitle,
                    onTrailingTap: { showSettings = true }
                )

                todayContent
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
                fromKg: ex.previousWeightKg.map { LoadDisplay.weight($0, loadType: ex.loadType, equipment: ex.equipment, s) },
                toKg: LoadDisplay.weight(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s)
            )
        }
        if ex.loadType == "bodyweight-plus" {
            return s.changeLineBodyweightPlus(
                exerciseName: localeStore.exerciseName(ex.exerciseId),
                change: ex.change.rawValue,
                fromKg: ex.previousWeightKg.map { LoadDisplay.weight($0, loadType: ex.loadType, equipment: ex.equipment, s) },
                toKg: LoadDisplay.weight(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s)
            )
        }
        return s.changeLine(
            exerciseName: localeStore.exerciseName(ex.exerciseId),
            change: ex.change.rawValue,
            fromKg: ex.previousWeightKg.map { LoadDisplay.weight($0, loadType: ex.loadType, equipment: ex.equipment, s) },
            toKg: LoadDisplay.weight(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s)
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

    private var dayName: String {
        model?.prescription.map { s.trainingDayName($0.dayCode) } ?? ""
    }

    // MARK: - 今日页（密而干净，2026-06-15 owner 拍板）：状态 + 全天清单 + 依据

    private var todayContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            contextLine
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 4)

            if isUnreadable {
                unreadableBlock
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 18)
            } else if let exercises = model?.prescription?.exercises, !exercises.isEmpty {
                verdictLine(count: exercises.count)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 14)

                if !milestoneNotes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(milestoneNotes.enumerated()), id: \.offset) { _, note in
                            HStack(alignment: .top, spacing: 6) {
                                Rectangle().fill(Color.redeEmber2).frame(width: 3, height: 3)
                                    .padding(.top, 7)
                                Text(note).font(.redeCaption).foregroundStyle(Color.redeT3)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 8)
                }

                RuleDivider()

                ForEach(Array(exercises.enumerated()), id: \.offset) { idx, ex in
                    exerciseRow(ex, isCurrent: idx == activeExerciseIndex)
                        .padding(.horizontal, RedeSpace.page)
                }

                summaryLine(exercises: exercises)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 14)

                EmbButton(icon: "play.fill", title: s.startTraining, action: onStartTraining)
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 16)

                RuleDivider()

                receiptSection
                    .padding(.horizontal, RedeSpace.page)
            } else {
                restBlock
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 18)
            }
        }
    }

    // 状态行：可以训练 + 本周训练次数（去大写微标签前的唯一头部口音 = 状态点）
    private var contextLine: some View {
        HStack(spacing: 7) {
            Circle().fill(pillFill).frame(width: 7, height: 7)
            Overline(text: isUnreadable ? s.dataUnreadableStatus : s.verdictStatus(call: callCode), color: pillText)
            Spacer()
            Text(signalLineText)
                .font(.redeCaption).monospacedDigit()
                .foregroundStyle(Color.redeT4)
        }
    }

    // 训练日判断行：「推力 A · N 个动作」+ 依据句（顶部，不再用大字号 hero）
    private func verdictLine(count: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            // iOS 26：Text `+` 拼接已弃用，改字符串插值嵌两段各自带色的 Text（两色一行不变）。
            Text("\(Text(dayName).foregroundStyle(Color.redeT1))\(Text(s.verdictExerciseCount(count)).foregroundStyle(Color.redeT3))")
                .font(.redeSubhead)
                .monospacedDigit()
            Text(s.receiptConclusion(call: callCode, reasonCode: reasonCode))
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// 今日清单橙色条跟随实时训练进度（owner 2026-06-15）：训练进行中标当前动作，
    /// 无会话/已收尾退回首个（=下一个要练的）。flow.plan 由本处方 expand，下标一一对应
    /// （TrainTabView「动作 N/总」同源）；换动作就地替换不改下标，故按 index 对位仍准。
    private var activeExerciseIndex: Int {
        guard let flow = sessionStore.flow, flow.phase != .summary else { return 0 }
        return flow.exerciseIndex
    }

    // 单动作行：名称 / 组数·休息·RIR / 目标 / 跟上次比
    private func exerciseRow(_ ex: ExercisePrescriptionPlan, isCurrent: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Rectangle().fill(isCurrent ? Color.redeEmber : Color.clear)
                    .frame(width: 3, height: 18)
                VStack(alignment: .leading, spacing: 3) {
                    Text(localeStore.exerciseName(ex.exerciseId))
                        .font(.redeSubhead)
                        .foregroundStyle(Color.redeT1)
                    Text(s.exerciseMetaLine(sets: ex.sets, restSeconds: ex.restSeconds, rir: ex.targetRir))
                        .font(.redeCaption).monospacedDigit()
                        .foregroundStyle(Color.redeT4)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text(targetSummary(ex))
                        .font(.redeCallout).monospacedDigit()
                        .foregroundStyle(Color.redeT2)
                    lastChangeView(ex)
                }
            }
            .padding(.vertical, 11)
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }

    private func targetSummary(_ ex: ExercisePrescriptionPlan) -> String {
        // §8 显示吸附：目标重量先落「器械×显示单位」真实梯子，再格式化（禁裸换算）。
        s.targetLine(loadType: ex.loadType,
                     weightKg: LoadDisplay.snap(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s),
                     reps: ex.targetReps)
    }

    @ViewBuilder
    private func lastChangeView(_ ex: ExercisePrescriptionPlan) -> some View {
        let isRep = ex.loadType == "bodyweight" || ex.loadType == "band"
        // 上次值同有同无（审查 [4]）由 lastRefLine 内部 guard 保证，缺任一→nil 不显示
        let prevText = s.lastRefLine(
            loadType: ex.loadType,
            prevWeightKg: ex.previousWeightKg.map { LoadDisplay.snap($0, loadType: ex.loadType, equipment: ex.equipment, s) },
            prevReps: ex.previousTopReps)
        HStack(spacing: 6) {
            if let prevText {
                Text(prevText).font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeT4)
            }
            switch ex.change.rawValue {
            case "increase":
                // 幅度取绝对值（审查 [5]）：assisted 进阶=辅助↓（target<prev），直减会出负号；
                // 无重量轴或缺上次值则只给箭头。
                let delta: String = (isRep || ex.previousWeightKg == nil)
                    ? "↑"
                    // 增量 = 吸附后目标 − 吸附后上次（两端同梯子，差才是真实可配增量）
                    : "↑ \(s.formatKg(abs(LoadDisplay.snap(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s) - LoadDisplay.snap(ex.previousWeightKg ?? 0, loadType: ex.loadType, equipment: ex.equipment, s))))"
                Text(delta).font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeEmber)
            case "ease":
                Text("↓").font(.redeCaption).foregroundStyle(Color.redeEmber2)
            case "hold":
                Text(s.holdShort).font(.redeCaption).foregroundStyle(Color.redeT4)
            default:
                Text(s.firstTimeShort).font(.redeCaption).foregroundStyle(Color.redeT4)
            }
        }
    }

    private func summaryLine(exercises: [ExercisePrescriptionPlan]) -> some View {
        let totalSets = exercises.reduce(0) { $0 + $1.sets }
        return Text(s.dailySummaryLine(totalSets: totalSets, exerciseCount: exercises.count))
            .font(.redeCaption).monospacedDigit()
            .foregroundStyle(Color.redeT4)
    }

    // 仅 rest/light/deload 等无动作清单态调用（isUnreadable 已被 unreadableBlock 独占，审查 [2]）
    private var restBlock: some View {
        Text(s.verdictHeadline(
            call: callCode, reasonCode: reasonCode,
            dayName: dayName, gapDays: gapDays, consecutiveDays: consecutiveDays))
            .font(.redeHeadline)
            .tracking(RedeTracking.headline)
            .lineSpacing(22 * 0.3)
            .foregroundStyle(Color.redeT1)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var unreadableBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(s.dataUnreadableHeadline)
                .font(.redeHeadline).tracking(RedeTracking.headline)
                .foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
            Text(s.dataUnreadableReceipt)
                .font(.redeBody).foregroundStyle(Color.redeT3)
        }
    }

    // Receipt 渐进披露
    private var receiptSection: some View {
        VStack(alignment: .leading, spacing: 0) {
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
            .accessibilityHint(reasonExpanded ? s.a11yCollapse : s.a11yExpand)

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

}

#Preview {
    TodayTabView(onStartTraining: {})
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
