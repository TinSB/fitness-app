import SwiftUI
import RedeL10n
import RedeTrainingDecision

// Plan — FR-PL1 诚实占位 + FR-PL2 S5 周期条（2026-06-15）。
// 页面只展示真数据：来自引导的模板事实行（分化 × 每周天数）；当周期化引擎开启且有真历史时，
// 追加一条「当前周期」周期条（4 周块·当前周 ember·相位角色）——相位从真历史现算（FR-PL1：
// 不编排期、不画假进度），与今日页处方走同一锚点。关闭或空历史 → 退回诚实占位（不显示周期条）。
// 整面板公理：本页 0 ForgedCard 预算——周期条用 ember 轨/节点原语，不开卡。

struct PlanTabView: View {
    let onGoToday: () -> Void

    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var template: SessionStore.TemplateFacts?
    @State private var cycle: MesocycleCycleState?
    /// FR-PL2：本周/下周训练日排期（只读派生；空 = 无模板/不可读，退占位）。
    @State private var projection: [[PlanDayProjection]] = []
    /// FR-PL3/4：计划调整提案 / 已采纳态（只读派生；.none = 不显示调整区）。
    @State private var adjustment: SessionStore.PlanAdjustmentState = .none
    /// 触感脉冲计数（采纳/回滚=成功确认，暂不=轻选择）：成功分支自增触发 .sensoryFeedback。
    @State private var commitPulse = 0
    @State private var selectPulse = 0
    /// FR-PL6：正在编辑的训练日（非 nil = 弹出编辑器 sheet）。
    @State private var editingDay: PlanEditTarget?
    /// FR-PL7②：是否打开训练日顺序编辑器 sheet。
    @State private var showSequenceEditor = false
    /// K2：是否打开动作库浏览器 sheet（入口只在计划页——系统逻辑 §7 大型动作浏览禁入 Train）。
    @State private var showLibrary = false

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: s.planTitle)

                if let facts = template, let split = facts.splitType, let days = facts.daysPerWeek {
                    // 真计划摘要（分化 · 天数 · 目标 + 背景 · 器械）——重做 2026-06-15「密而干净」。
                    // goal 缺失不丢整块摘要（审查 P1）：onbVerdict 内部 fallback general，同 OnboardingView。
                    VStack(alignment: .leading, spacing: 10) {
                        Text(s.onbVerdict(splitCode: split, days: days, goalCode: facts.goal ?? "general"))
                            .font(.redeHeadline)
                            .tracking(RedeTracking.headline)
                            .foregroundStyle(Color.redeT1)
                            .fixedSize(horizontal: false, vertical: true)
                        if let ctx = planContextLine(facts) {
                            Text(ctx)
                                .font(.redeCallout)
                                .foregroundStyle(Color.redeT3)
                        }
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 24)

                    RuleDivider()

                    if showsAdjustmentCard {
                        // FR-PL3/4：计划调整提案（采纳/暂不）或已采纳态（可撤）。紧贴计划摘要——
                        // 改的正是摘要里的「每周天数」。0 卡公理：用 surface 原语（非 ForgedCard）。
                        adjustmentSection
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, 12)
                            // 卡进出（暂不/采纳/回滚）= 上方滑入 + 淡入，不硬闪（reduceMotion 守卫）。
                            .transition(reduceMotion ? .identity : .opacity.combined(with: .move(edge: .top)))
                        if cycle != nil || !projection.isEmpty {
                            RuleDivider().padding(.top, 12)
                        }
                    }

                    if let cycle {
                        // FR-PL2 S5：真周期条（周期化开启且有真历史时）
                        MesocycleCycleBar(state: cycle, s: s)
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, 8)
                    }

                    // FR-PL2：本周/下周排期（只读派生；有模板即展示，与今日页处方同源）
                    if !projection.isEmpty {
                        if cycle != nil { RuleDivider() }
                        weekScheduleSection
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, cycle != nil ? 8 : 4)
                        // FR-PL7②：调整训练日先后顺序入口（开放行下钻顺序编辑器）。
                        daySequenceEntryRow
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, 8)
                        // K2：动作库入口（同款行式披露语法，非按钮非卡；唯一入口——裁定 1）。
                        libraryEntryRow
                            .padding(.horizontal, RedeSpace.page)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        if projection.isEmpty {
                            // 无排期（理论不达）→ 诚实占位 + 空态主按钮（§12.5 空态承接）
                            Text(s.planEmptyNote)
                                .font(.redeCallout)
                                .foregroundStyle(Color.redeT3)
                            EmbButton(icon: "arrow.left", title: s.trainEmptyAction, action: onGoToday)
                                .padding(.top, 4)
                        } else {
                            // 有真排期 →「回今日」降为文字链（大主按钮只留给空态，owner 拍板）。
                            Text(s.planScheduleNote)
                                .font(.redeCallout)
                                .foregroundStyle(Color.redeT3)
                            Button(action: onGoToday) {
                                HStack(spacing: 6) {
                                    Text(s.planBackToToday)
                                    Image(systemName: "chevron.right").font(.redeCaption)
                                }
                                .font(.redeCallout)
                                .foregroundStyle(Color.redeT3)
                                .frame(minHeight: RedeShape.controlHeight, alignment: .leading)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.redePressable)
                        }
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 16)
                } else {
                    // 无模板（理论上引导后必有）：原诚实占位兜底
                    VStack(alignment: .leading, spacing: 12) {
                        Text(s.planEmptyHeadline)
                            .font(.redeHeadline)
                            .tracking(RedeTracking.headline)
                            .foregroundStyle(Color.redeT1)
                        Text(s.planEmptyNote)
                            .font(.redeCallout)
                            .foregroundStyle(Color.redeT3)
                        EmbButton(icon: "arrow.left", title: s.trainEmptyAction, action: onGoToday)
                            .padding(.top, 4)
                    }
                    .padding(.horizontal, RedeSpace.page)
                    .padding(.top, 24)
                }
            }
            .padding(.bottom, RedeSpace.bottomBar)
        }
        .background(Color.redeBase)
        .sensoryFeedback(.success, trigger: commitPulse)   // 采纳 / 改回成功 = 提交确认
        .sensoryFeedback(.selection, trigger: selectPulse) // 暂不 = 轻选择
        // 调整卡进出 + 采纳/回滚后的提案↔已采纳态切换 + 排期变化，统一交叉过渡（reduceMotion 守卫）。
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: showsAdjustmentCard)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: adjustment)
        // 写失败提示出现/消失也淡入（与今日页 coachSaveErrorText 对等，审查 M-1）。
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: sessionStore.planSaveErrorText)
        .task {
            await reload()
            // 截图/UI 验证钩子（同 RootTabView -autoStartSession 先例）：
            // simctl launch ... -initialTab plan -autoOpenPlanEditor push-a | -autoOpenDaySequenceEditor
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "-autoOpenPlanEditor"), args.indices.contains(i + 1) {
                editingDay = PlanEditTarget(dayCode: args[i + 1])
            } else if args.contains("-autoOpenDaySequenceEditor") {
                showSequenceEditor = true
            }
        }
        // FR-PL6：训练日编辑器（增删换/重排/预览/采纳·恢复默认）；采纳后 reload 刷新排期。
        .sheet(item: $editingDay) { target in
            PlanDayEditorView(dayCode: target.dayCode, onApplied: { Task { await reload() } })
        }
        // FR-PL7②：训练日顺序编辑器；采纳后 reload 刷新排期。
        .sheet(isPresented: $showSequenceEditor) {
            PlanDaySequenceEditorView(onApplied: { Task { await reload() } })
        }
        // K2：动作库浏览器（只读目录，无采纳/写入）。
        .sheet(isPresented: $showLibrary) {
            ExerciseLibraryView()
        }
    }

    /// K2：动作库入口行（「调整训练日顺序」同款开放行语法）。计数 = 目录在架条目。
    private var libraryEntryRow: some View {
        let count = ExerciseCatalog.minimal.entries.filter { !$0.deprecated }.count
        return Button { showLibrary = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "list.bullet").font(.redeCaption).foregroundStyle(Color.redeT3)
                Text(s.exerciseLibraryEntry(count)).font(.redeSubhead).foregroundStyle(Color.redeT1)
                Spacer()
                Image(systemName: "chevron.right").font(.redeCaption).foregroundStyle(Color.redeT4)
            }
            .frame(minHeight: RedeShape.controlHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .accessibilityElement(children: .combine)
    }

    /// 一次后台读、同步一起赋值（审查 MINOR-1）：避免分批到达时闪占位。
    /// 采纳/回滚后复用此函数刷新（写入口已落库 + loadToday，这里重读派生让计划页跟上）。
    private func reload() async {
        let loaded = await Task.detached {
            (SessionStore.loadTemplateFacts(), SessionStore.loadCycleState(),
             SessionStore.loadPlanProjection(), SessionStore.loadPlanAdjustmentState())
        }.value
        template = loaded.0
        cycle = loaded.1
        projection = loaded.2
        adjustment = loaded.3
    }

    /// 背景 · 器械（真数据，引导选项标题）；缺则 nil。
    private func planContextLine(_ facts: SessionStore.TemplateFacts) -> String? {
        var parts: [String] = []
        if let level = facts.level { parts.append(s.onbLevelOption(level).title) }
        if let equip = facts.equipment { parts.append(s.onbEquipOption(equip).title) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: - 计划调整（FR-PL3 提案 / FR-PL4 可撤）

    /// 已采纳记录永远展示（撤销入口）；待采纳提案在本会话「暂不」后隐藏。
    private var showsAdjustmentCard: Bool {
        if adjustment.activeTo != nil { return true }
        if adjustment.proposal != nil { return !sessionStore.planProposalSnoozed }
        return false
    }

    @ViewBuilder
    private var adjustmentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let activeTo = adjustment.activeTo {
                adjustmentActiveCard(to: activeTo)
            } else if let proposal = adjustment.proposal {
                adjustmentProposalCard(proposal)
            }
            // 写失败如实呈现（FR-TR8 红线：绝不静默假成功）；读计划专属字段，隔离于全局/教练错误。
            if let errorText = sessionStore.planSaveErrorText {
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.saveFailedLine)
                        .font(.redeCaption).foregroundStyle(Color.redeRisk)
                    Text(errorText)
                        .font(.redeCaption).foregroundStyle(Color.redeT4)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    /// 待采纳提案卡：信号 + 影响（before→after 频率 + 调整后本周训练日）+ 调整/暂不。
    private func adjustmentProposalCard(_ p: PlanAdjustmentProposal) -> some View {
        adjustmentCardSurface {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.redeT3) // ember 收敛：分类图标用中性，橙留给采纳 CTA（同教练卡）
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(s.planAdjustOverline)
                            .font(.redeSubhead).foregroundStyle(Color.redeT1)
                        Text(s.planAdjustReduceBody(from: p.fromDaysPerWeek, to: p.toDaysPerWeek))
                            .font(.redeCaption).foregroundStyle(Color.redeT3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Text(s.planAdjustFromTo(from: p.fromDaysPerWeek, to: p.toDaysPerWeek))
                    .font(.redeCallout).monospacedDigit().foregroundStyle(Color.redeT2)
                if !adjustment.proposedWeekDays.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(s.planAdjustAfterLabel)
                            .font(.redeOverline).tracking(RedeTracking.overline)
                            .foregroundStyle(Color.redeT3)
                        Text(adjustment.proposedWeekDays.map { s.trainingDayName($0.dayCode) }.joined(separator: " · "))
                            .font(.redeCaption).foregroundStyle(Color.redeT2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                HStack {
                    Button(s.planAdjustAdopt) {
                        Task {
                            if await sessionStore.applyFrequencyAdjustment(
                                fromDaysPerWeek: p.fromDaysPerWeek, toDaysPerWeek: p.toDaysPerWeek
                            ) {
                                commitPulse += 1
                                await reload()
                            }
                        }
                    }
                    .font(.redeCaption.weight(.semibold)).foregroundStyle(Color.redeEmber2)
                    .buttonStyle(.redePressable).disabled(sessionStore.isSaving)
                    Spacer()
                    Button(s.planAdjustDismiss) {
                        selectPulse += 1
                        sessionStore.planProposalSnoozed = true
                    }
                    .font(.redeCaption).foregroundStyle(Color.redeT4)
                    .buttonStyle(.redePressable).disabled(sessionStore.isSaving)
                }
            }
        }
    }

    /// 已采纳态卡：现状 + 改回原计划（单步即时回滚）。
    private func adjustmentActiveCard(to: Int) -> some View {
        adjustmentCardSurface {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.redeT3) // ember 收敛：分类图标用中性，橙留给"改回原计划"CTA
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(s.planAdjustActiveOverline)
                            .font(.redeSubhead).foregroundStyle(Color.redeT1)
                        Text(s.planAdjustActiveBody(to: to))
                            .font(.redeCaption).foregroundStyle(Color.redeT3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Button(s.planAdjustUndo) {
                    Task {
                        if await sessionStore.rollbackPlanAdjustment() {
                            // 回滚 = 用户明确否决本次建议 → 本会话不再就同一提案复弹（尊重决定，不复推销）。
                            sessionStore.planProposalSnoozed = true
                            commitPulse += 1
                            await reload()
                        }
                    }
                }
                .font(.redeCaption.weight(.semibold)).foregroundStyle(Color.redeEmber2)
                .buttonStyle(.redePressable).disabled(sessionStore.isSaving)
            }
        }
    }

    /// 调整卡通用 surface（与今日页教练卡同语言）：整面板公理——去通用圆角描边盒子，蚀刻在 base 上，
    /// 顶部一条发丝线收边、内容直落底面（§12.1 禁通用圆角描边框；与今日页教练卡同款，全 app 一致）。
    private func adjustmentCardSurface<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .top) {
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }
    }

    // MARK: - 本周/下周排期（FR-PL2；0 卡，纯文本行；训练日名 + 动作数 + 模式构成）

    private var weekScheduleSection: some View {
        // T2 排期折叠（2026-07-05）：逐日渲染会让同一训练日类型的构成随周×天逐字
        // 重复（上/下肢 4 天 = 8 行里重复 4 遍）。折叠为「分段序列 + 类型一次展开」：
        // 先后顺序看序列行（保「接下来/再往后」分段语义），构成与下钻编辑（FR-PL6）
        // 看类型行。digest 为包内纯函数（PlanScheduleDigestBuilder，含单测）。
        let digest = PlanScheduleDigestBuilder.digest(from: projection)
        return VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(digest.segments.enumerated()), id: \.offset) { segIdx, seg in
                VStack(alignment: .leading, spacing: 6) {
                    Text(segIdx == 0 ? s.planScheduleThisWeek : s.planScheduleNextWeek)
                        .font(.redeOverline)
                        .tracking(RedeTracking.overline)
                        .foregroundStyle(Color.redeT3)
                    Text(seg.map(s.trainingDayName).joined(separator: " · "))
                        .font(.redeCallout)
                        .foregroundStyle(Color.redeT2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(s.planDayTypesHeader)
                    .font(.redeOverline)
                    .tracking(RedeTracking.overline)
                    .foregroundStyle(Color.redeT3)
                ForEach(digest.dayTypes, id: \.dayCode) { day in
                    dayScheduleRow(day)
                }
            }
        }
    }

    /// FR-PL7②：训练日顺序编辑入口（开放行，点开顺序编辑器 sheet）。
    private var daySequenceEntryRow: some View {
        Button { showSequenceEditor = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "arrow.up.arrow.down").font(.redeCaption).foregroundStyle(Color.redeT3)
                Text(s.planSeqEditEntry).font(.redeSubhead).foregroundStyle(Color.redeT1)
                Spacer()
                Image(systemName: "chevron.right").font(.redeCaption).foregroundStyle(Color.redeT4)
            }
            .frame(minHeight: RedeShape.controlHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .accessibilityElement(children: .combine)
        .accessibilityHint(s.planSeqEditEntryHint)
    }

    private func dayScheduleRow(_ day: PlanDayProjection) -> some View {
        // FR-PL6：开放行下钻编辑器（点整行；右侧 chevron 提示可编辑）。
        Button { editingDay = PlanEditTarget(dayCode: day.dayCode) } label: {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(s.trainingDayName(day.dayCode))
                        .font(.redeSubhead)
                        .foregroundStyle(Color.redeT1)
                    Spacer()
                    Text(s.planDayExercises(day.exerciseCount))
                        .font(.redeCaption).monospacedDigit()
                        .foregroundStyle(Color.redeT4)
                    Image(systemName: "chevron.right").font(.redeCaption).foregroundStyle(Color.redeT4)
                }
                Text(day.patternCodes.map(s.movementPatternLabel).joined(separator: " · "))
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .accessibilityElement(children: .combine)
        .accessibilityHint(s.planEditDayHint)
    }
}

/// `.sheet(item:)` 需要 Identifiable 包装 dayCode。
private struct PlanEditTarget: Identifiable { let dayCode: String; var id: String { dayCode } }

// MARK: - 周期条（FR-PL2 S5）— 4 周累积块·当前周 ember·相位角色。0 卡，纯 ember 轨/节点。
struct MesocycleCycleBar: View {
    let state: MesocycleCycleState
    let s: RedeStrings

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(s.planCycleOverline)
                .font(.redeOverline)
                .tracking(RedeTracking.overline)
                .foregroundStyle(Color.redeT3)

            // 轨 + 节点：等宽列对齐，连接线落在首末节点中心，单 ember 标当前周。
            ZStack {
                GeometryReader { geo in
                    let inset = geo.size.width / CGFloat(max(state.blockLengthWeeks, 1)) / 2
                    Rectangle()
                        .fill(Color.redeNeu)
                        .frame(height: 1)
                        .padding(.horizontal, inset)
                        .frame(maxHeight: .infinity, alignment: .center)
                }
                HStack(spacing: 0) {
                    ForEach(Array(state.phases.enumerated()), id: \.offset) { idx, _ in
                        node(idx: idx)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .frame(height: 20)

            // 相位标签（节点下方等宽对齐），当前周 T1、其余 T3。
            HStack(spacing: 0) {
                ForEach(Array(state.phases.enumerated()), id: \.offset) { idx, phase in
                    Text(s.mesoPhaseShort(phase.rawValue))
                        .font(.redeCaption)
                        .foregroundStyle(idx == state.currentWeekInBlock ? Color.redeT1 : Color.redeT3)
                        .frame(maxWidth: .infinity)
                }
            }

            // 相位已在节点下逐个标（当前周高亮）——摘要只留周计数，不重复相位（owner 拍板去重）。
            Text(s.planCycleWeek(week: state.currentWeekInBlock + 1, total: state.blockLengthWeeks))
                .font(.redeCaption)
                .foregroundStyle(Color.redeT2)
        }
    }

    @ViewBuilder
    private func node(idx: Int) -> some View {
        if idx == state.currentWeekInBlock {
            RingDot(size: 12)                                   // 当前周：唯一 ember 口音
        } else if idx < state.currentWeekInBlock {
            Circle().fill(Color.redeT3).frame(width: 8, height: 8)   // 已过周：暗实心
        } else {
            Circle().stroke(Color.redeNextDot, lineWidth: 1.5)
                .frame(width: 8, height: 8)                     // 未来周：空心
        }
    }
}

#Preview {
    PlanTabView(onGoToday: {})
        .environment(LocaleStore())
        .environment(SessionStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}

#Preview("CycleBar · overreach") {
    MesocycleCycleBar(
        state: MesocycleCycleState(
            blockLengthWeeks: 4,
            currentWeekInBlock: 2,
            phases: [.calibrate, .build, .overreach, .deload]
        ),
        s: LocaleStore().strings
    )
    .padding(RedeSpace.page)
    .background(Color.redeBase)
    .preferredColorScheme(.dark)
}
