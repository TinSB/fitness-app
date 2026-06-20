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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var reasonExpanded = false
    @State private var showSettings = false
    /// FR-EX2：点开的动作详情目标（nil = 未打开）。
    @State private var detailTarget: ExerciseDetailTarget?
    /// FR-T5 切片6c：采纳后的撤销条（瞬态，挂今日页根 overlay，独立于教练卡生命周期——
    /// 抗"写后 reload 卡消失"导致撤销入口蒸发）。约 5s 自动淡出。
    @State private var undoBanner: UndoBanner?
    /// 触感脉冲（采纳/撤销=成功确认，暂不/展开折叠=轻选择）：成功分支自增触发 .sensoryFeedback。
    @State private var commitPulse = 0
    @State private var selectPulse = 0

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
            .padding(.bottom, RedeSpace.bottomBar)
        }
        .background(Color.redeBase)
        // 切片6c：撤销条挂今日页根、避开 tab 栏；独立于教练卡，卡 reload 消失也不丢撤销入口。
        .overlay(alignment: .bottom) {
            if let banner = undoBanner {
                undoBannerView(banner)
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: undoBanner?.id)
        // 教练卡 / 写失败提示的出现消失（采纳/暂不后随 reload 变化）= 过渡，不硬闪（reduceMotion 守卫）。
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: coachAction?.actionKey)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: sessionStore.coachSaveErrorText)
        .sensoryFeedback(.success, trigger: commitPulse)   // 采纳 / 撤销成功 = 提交确认
        .sensoryFeedback(.selection, trigger: selectPulse) // 暂不 / 展开折叠 = 轻选择
        .task {
            sessionStore.coachSaveErrorText = nil // 进页清教练写错误（新视图干净起步；隔离于全局 saveErrorText）
            if sessionStore.todayOutcome == nil { await sessionStore.loadToday() }
        }
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
        .sheet(item: $detailTarget) { target in
            exerciseDetailSheet(target)
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
        // 里程事件（到顶/毕业/回退）与换动作教练卡触发同口径——共用 PrescriptionReason 穷举判定，
        // 新增 case 时编译器强制同步（审查：消除跨文件 default:false 无声漂移）。
        return exercises.dropFirst().filter { $0.reason.isCeilingOrGraduationMilestone }.map { changeLine(for: $0) }
    }

    private var dayName: String {
        model?.prescription.map { s.trainingDayName($0.dayCode) } ?? ""
    }

    /// FR-T5 教练卡（切片6b）：引擎已按优先级排序并降频，每屏只取首条（设计 ≤1）。
    private var coachAction: CoachAction? { model?.coachActions.first }

    // MARK: - 今日页（密而干净，2026-06-15 owner 拍板）：状态 + 全天清单 + 依据

    private var todayContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            contextLine
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 4)

            // 切片6c 红线：今日页教练写入（采纳/撤销/暂不处理）失败时如实呈现，绝不静默假成功
            //（与 TrainTabView 收尾页同口径：saveFailedLine + 明细；下次教练写入开写自动清空）。
            // 读教练专属 coachSaveErrorText，与全局 saveErrorText 隔离——不抢显训练/设置写失败（审查 MAJOR）。
            if let errorText = sessionStore.coachSaveErrorText {
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.saveFailedLine)
                        .font(.redeCaption).foregroundStyle(Color.redeRisk)
                    Text(errorText)
                        .font(.redeCaption).foregroundStyle(Color.redeT4)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, 8)
                .transition(reduceMotion ? .identity : .opacity) // 写失败提示淡入，不硬闪
            }

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

                if let action = coachAction {
                    coachCard(action)
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 12)
                        // 教练卡进出（采纳/暂不后随 reload 出现/消失）= 上方滑入 + 淡入，不硬闪。
                        .transition(reduceMotion ? .identity : .opacity.combined(with: .move(edge: .top)))
                }

                RuleDivider()

                ForEach(Array(exercises.enumerated()), id: \.offset) { idx, ex in
                    Button {
                        detailTarget = ExerciseDetailTarget(id: ex.exerciseId)
                    } label: {
                        exerciseRow(ex, isCurrent: idx == activeExerciseIndex)
                            .contentShape(Rectangle()) // 整行可点（含 Spacer 空白）+ 按压反馈覆盖全行
                    }
                    .buttonStyle(.redePressableRow)
                    .accessibilityHint(s.exerciseDetailHint)
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
                    HStack(spacing: 6) {
                        Text(localeStore.exerciseName(ex.exerciseId))
                            .font(.redeSubhead)
                            .foregroundStyle(Color.redeT1)
                        // 切片6c：该动作是某到顶动作的替代 → 「已换」微标（长存、读落库 map）；点行进 detail 可换回。
                        if swapOriginalId(for: ex.exerciseId) != nil {
                            Overline(text: s.exerciseSwappedBadge, color: .redeEmber2)
                        }
                    }
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
                // 增量 = 吸附后目标 − 吸附后上次（两端同梯子，差才是真实可配增量）；箭头用 SFSymbol
                let amount: String = (isRep || ex.previousWeightKg == nil)
                    ? ""
                    : " \(s.formatKg(abs(LoadDisplay.snap(ex.targetWeightKg, loadType: ex.loadType, equipment: ex.equipment, s) - LoadDisplay.snap(ex.previousWeightKg ?? 0, loadType: ex.loadType, equipment: ex.equipment, s))))"
                Text("\(Image(systemName: "arrow.up"))\(amount)").font(.redeCaption).monospacedDigit().foregroundStyle(Color.redeEmber)
            case "ease":
                Text(Image(systemName: "arrow.down")).font(.redeCaption).foregroundStyle(Color.redeEmber2)
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
                selectPulse += 1
                // reduce-motion 守卫，与训练页/设置页折叠动画口径一致（无障碍）
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.25)) { reasonExpanded.toggle() }
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
                .contentShape(Rectangle())
            }
            .buttonStyle(.redePressable)
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

    // MARK: - 教练卡（FR-T5 切片6b；首个用户可见教练动作 — 只读卡 + 暂不处理）

    /// 教练卡：信号+影响双语句 + 「暂不处理」（降频入口）。采纳/撤销在切片6c 接。
    /// 视觉用 redeSurface 子面，不用 ForgedCard——保留 hero 判断牌的整面板公理预算（budget 1）。
    /// 仅在有处方的分支渲染：6b 能出的两类卡（换动作=源自处方到顶 reason、补量=仅 train/light）
    /// 都以"今日有处方"为前提，故 rest/无处方/unreadable 分支不渲染卡 = 设计取舍，非遗漏（审查 MINOR-2）。
    private func coachCard(_ action: CoachAction) -> some View {
        let exName = action.exerciseId.map { localeStore.exerciseName($0) } ?? ""
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 9) {
                Image(systemName: coachIcon(action.kind))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.redeT3) // ember 收敛：图标是分类标识非"下一步"，橙留给采纳 CTA（§1.3）
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.coachCardTitle(reasonCode: action.reasonCode, exerciseName: exName))
                        .font(.redeSubhead)
                        .foregroundStyle(Color.redeT1)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(s.coachCardBody(reasonCode: action.reasonCode, exerciseName: exName, count: action.count))
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack {
                coachAdoptButton(action, exerciseName: exName)
                Spacer()
                Button(s.coachDismissLabel) {
                    selectPulse += 1
                    Task { await sessionStore.dismissCoachAction(actionKey: action.actionKey) }
                }
                .font(.redeCaption)
                .foregroundStyle(Color.redeT4)
                .buttonStyle(.redePressable)
                .disabled(sessionStore.isSaving)
            }
        }
        // 整面板公理：去通用圆角描边盒子，蚀刻在 base 上——顶部一条发丝线收边、内容直落底面
        //（owner UX 反馈"卡片描边=AI 味"，§12.1 禁通用圆角描边框）。下方既有 RuleDivider 收尾。
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.redeHair2).frame(height: 1)
        }
    }

    private func coachIcon(_ kind: CoachActionKind) -> String {
        switch kind {
        case .dataReview: return "checklist"
        case .exerciseSwap: return "arrow.triangle.2.circlepath"
        case .volumeBoost: return "plus.circle"
        }
    }

    /// 采纳类强调按钮统一样式（卡主 CTA + 撤销条共用）；写进行中 .disabled 给诚实反馈，不静默吞点击。
    private func adoptCTA(_ title: String, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.redeCaption.weight(.semibold))
            .foregroundStyle(Color.redeEmber2)
            .buttonStyle(.redePressable)
            .disabled(sessionStore.isSaving)
    }

    /// 采纳主 CTA（切片6c）：换动作→打开替代列表（detail sheet 换动作意图）；补量→直接记一次。
    @ViewBuilder
    private func coachAdoptButton(_ action: CoachAction, exerciseName: String) -> some View {
        switch action.kind {
        case .exerciseSwap:
            // 引擎保证：exerciseSwap 的 exerciseId 恒非 nil（CoachActionEngine 从 [String] stalledExerciseIds 构造）。
            // 故此 if-let 不会落空成"无采纳 CTA 的半残卡"；保留可选解包仅为类型安全（审查 NIT）。
            if let exerciseId = action.exerciseId {
                adoptCTA(s.coachAdoptSwapLabel) {
                    detailTarget = ExerciseDetailTarget(id: exerciseId, swapIntent: true)
                }
            }
        case .volumeBoost:
            // 诚实：采纳=记录本周已承认补量（不加训练、不改处方）→ 引擎本周抑制本卡。
            // 用 Date()（当场取时）而非 model.now（加载时快照）算本周锚点——避免跨午夜/跨周会话存活时
            // 写错周 key、reload 后卡立刻重弹（审查 MINOR）。撤销用同一 week（存进 banner）保持一致。
            adoptCTA(s.coachAdoptVolumeLabel) {
                let week = WeekAnchor.isoWeekStart(Date())
                Task {
                    if await sessionStore.applyVolumeBoost(weekStartISO: week) {
                        commitPulse += 1
                        undoBanner = UndoBanner(kind: .volume(weekStartISO: week), text: s.volumeAckToast)
                    }
                }
            }
        case .dataReview:
            // 修数据采纳=跨页核对，待 Today 算 DataQualityReport 让 dataFindingCount>0 后随该切片连卡带跳转一起做。
            EmptyView()
        }
    }

    /// 采纳后撤销条：正文 + 「撤销」（反向 gated 写）；约 5s 自动淡出，写进行中禁用撤销。
    private func undoBannerView(_ banner: UndoBanner) -> some View {
        HStack(spacing: 12) {
            Text(banner.text)
                .font(.redeCaption).foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            adoptCTA(s.coachUndoLabel) {
                Task { await undoAdoption(banner) }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 11)
        // 浮层 toast 需背景才可读，故保留 raised 填充；但去掉描边框（§12.1 禁通用圆角描边框）。
        .background(
            RoundedRectangle(cornerRadius: RedeShape.cardRadius, style: .continuous)
                .fill(Color.redeRaised)
        )
        .padding(.horizontal, RedeSpace.page)
        .padding(.bottom, RedeSpace.bottomBar + 8)
        .transition(.opacity)
        .task(id: banner.id) {
            try? await Task.sleep(for: .seconds(5))
            // 撤销写进行中（isSaving）不自毁——否则 5s 定时器会与撤销写竞争，写失败后撤销条已消失、
            // 用户失去重试入口（补量撤销无持久兜底，审查 MAJOR）。撤销失败时撤销条留存供再试。
            if undoBanner?.id == banner.id, !sessionStore.isSaving { undoBanner = nil }
        }
    }

    private func undoAdoption(_ banner: UndoBanner) async {
        let ok: Bool
        switch banner.kind {
        case .swap(let originalId): ok = await sessionStore.removeExerciseSubstitution(originalId: originalId)
        case .volume(let week): ok = await sessionStore.removeVolumeBoost(weekStartISO: week)
        }
        // 撤销写失败保留撤销条（错误面已如实呈现），用户可再试——尤其补量撤销无持久兜底入口（审查 MAJOR）。
        if ok {
            commitPulse += 1
            undoBanner = nil
        }
    }

    /// 该动作当前是哪个到顶动作的替代（actualId→originalId 反查落库覆盖 map）；非替代返回 nil。
    private func swapOriginalId(for exerciseId: String) -> String? {
        model?.substitutions.first { $0.value == exerciseId }?.key
    }

    // MARK: - 动作详情（FR-EX2；只读元数据 + 同族替代，主界面不堆元数据）

    private struct ExerciseDetailTarget: Identifiable {
        let id: String              // id = exerciseId
        var swapIntent: Bool = false // 切片6c：教练卡「换个动作」入口 = true → 替代列表升级为可点采纳
    }

    /// 切片6c：采纳后撤销条。kind 携带反向写所需 key；id 供动画/自毁去重。
    private struct UndoBanner: Identifiable {
        enum Kind {
            case swap(originalId: String)
            case volume(weekStartISO: String)
        }
        let id = UUID()
        let kind: Kind
        let text: String
    }

    private func exerciseDetailSheet(_ target: ExerciseDetailTarget) -> some View {
        let exerciseId = target.id
        let entry = ExerciseCatalog.minimal.entry(id: exerciseId)
        // 该动作若是某到顶动作的替代 → 顶部露「换回原动作」撤销入口（持久，与即时 toast 互补）。
        let revertOriginalId = swapOriginalId(for: exerciseId)
        return ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                Text(localeStore.exerciseName(exerciseId))
                    .font(.redeHeadline)
                    .tracking(RedeTracking.headline)
                    .foregroundStyle(Color.redeT1)

                if let originalId = revertOriginalId {
                    adoptCTA(s.swapRevertHint(originalName: localeStore.exerciseName(originalId))) {
                        Task {
                            if await sessionStore.removeExerciseSubstitution(originalId: originalId) { detailTarget = nil }
                        }
                    }
                }

                if let entry {
                    detailRow(s.exerciseDetailType, s.exerciseKindLabel(entry.kind))
                    detailRow(s.exerciseDetailPattern, s.movementPatternLabel(entry.movementPattern))
                    detailRow(s.exerciseDetailPrimary, s.muscleLabel(entry.primaryMuscle))
                    if !entry.secondaryMuscles.isEmpty {
                        detailRow(s.exerciseDetailSecondary, s.muscleListLabel(entry.secondaryMuscles))
                    }
                    detailRow(s.exerciseDetailEquipment, s.equipmentLabel(entry.equipment))
                    VStack(alignment: .leading, spacing: 6) {
                        // 换动作意图：标题换成选择提示，替代项升级为可点采纳行（选中即写，撤销兜底，无二次确认）。
                        Overline(text: target.swapIntent ? s.swapPickerHint : s.exerciseDetailAlternatives)
                        let alts = alternatives(for: entry)
                        if alts.isEmpty {
                            Text(s.exerciseDetailNoAlternatives)
                                .font(.redeBody).foregroundStyle(Color.redeT3)
                        } else if target.swapIntent {
                            ForEach(alts, id: \.self) { altId in
                                Button {
                                    // root-collapse：若当前动作本身是某动作的替代，覆盖写在**根 originalId** 上，
                                    // 不建 B→C 链（避免 A→B、B→C 两条 key 语义错位；撤销也回到根，审查 MINOR）。
                                    let rootOriginal = swapOriginalId(for: exerciseId) ?? exerciseId
                                    Task {
                                        if await sessionStore.applyExerciseSubstitution(originalId: rootOriginal, actualId: altId) {
                                            detailTarget = nil
                                            // 诚实：仅当 plan() 真把当前动作换出处方才报「已换成」+ 给撤销；若该替代非此槽
                                            // 合法候选、plan() 优雅回退（处方没变），清掉这条死覆盖、绝不假报成功（审查 MINOR/诚实红线）。
                                            // model 为 nil（无法确认）时默认 false：倾向**保留**刚写盘的覆盖、不误删（审查 MAJOR）。
                                            let stillHasOriginal = model?.prescription?.exercises.contains { $0.exerciseId == exerciseId } ?? false
                                            if stillHasOriginal {
                                                _ = await sessionStore.removeExerciseSubstitution(originalId: rootOriginal)
                                            } else {
                                                commitPulse += 1
                                                undoBanner = UndoBanner(
                                                    kind: .swap(originalId: rootOriginal),
                                                    text: s.swapAdoptedToast(exerciseName: localeStore.exerciseName(altId))
                                                )
                                            }
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Text(localeStore.exerciseName(altId))
                                            .font(.redeBody).foregroundStyle(Color.redeT1)
                                        Spacer()
                                        Image(systemName: "arrow.left.arrow.right")
                                            .font(.redeCaption).foregroundStyle(Color.redeEmber2)
                                    }
                                    .frame(minHeight: RedeShape.controlHeight)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.redePressableRow)
                                .disabled(sessionStore.isSaving)
                            }
                        } else {
                            ForEach(alts, id: \.self) { altId in
                                Text(localeStore.exerciseName(altId))
                                    .font(.redeBody).foregroundStyle(Color.redeT2)
                            }
                        }
                    }
                }
            }
            .padding(RedeSpace.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        // 整面板公理：sheet = 掀开的 base 锻面（同历史明细 sheet 口径）。
        .presentationBackground(Color.redeBase)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Overline(text: label)
            Text(value).font(.redeBody).foregroundStyle(Color.redeT1)
        }
    }

    /// 同族替代动作（共享任一 substitutionGroup、非自身、未退役）；信息性参考，列前几个。
    private func alternatives(for entry: ExerciseCatalogEntry) -> [String] {
        let groups = Set(entry.substitutionGroups)
        return ExerciseCatalog.minimal.entries
            .filter { $0.id != entry.id && !$0.deprecated && !Set($0.substitutionGroups).isDisjoint(with: groups) }
            .sorted { $0.rank < $1.rank }   // 显式 rank 序（审查 Minor-2）：前 6 偏主项/主流器械，不依赖 entries 隐式有序
            .prefix(6)
            .map(\.id)
    }

}

#Preview {
    TodayTabView(onStartTraining: {})
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
