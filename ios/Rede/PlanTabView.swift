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
    /// FR-PL7②/③：是否打开训练日编排编辑器 sheet。
    @State private var showSequenceEditor = false
    /// K2：是否打开动作库浏览器 sheet（入口只在计划页——系统逻辑 §7 大型动作浏览禁入 Train）。
    @State private var showLibrary = false
    /// K5：各训练日码最近一次完成日期（canonical templateId 直读；无键 = 从未练过不显示）。
    @State private var lastTrainedByDay: [String: String] = [:]
    /// K5：累计事实（自首场起 ISO 周跨度 + 去重训练天数；nil = 无历史不渲染）。
    @State private var tenure: (weeks: Int, days: Int)?
    /// 每个训练日码的真实动作 id（详情行要同时渲染名字与「主肌群 · 器械」）。
    @State private var exerciseIdsByDay: [String: [String]] = [:]
    /// 循环死区（2026-08-12，真实用户撞出来的）：当前配置下轮不到的训练日。
    /// **只有这一个真源**：关掉每周重开后 loadDeadZone 必然返回 nil，提示自然消失。
    /// 曾经加过一个 deadZoneCleared 乐观态做即时隐藏——它和 reload() 打架
    /// （reload 重新算出非 nil 就把清除态冲掉），提示永远不消失。实拍抓到，删。
    @State private var deadZone: PlanReachability.Report?
    /// 当前展开的训练日（nil = 用下一场）。竞品对照 Alpha Progression：五天是顶部一排 tab，
    /// 下面只展开一天——把五天的动作全铺开就是一堵均匀的文字墙。
    @State private var selectedDay: String?

    private var s: RedeStrings { localeStore.strings }

    /// -planDeadZoneFixture <轮不到的日码，逗号分隔>[:每周场次:序列长度]
    private static var deadZoneFixture: PlanReachability.Report? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-planDeadZoneFixture"), args.indices.contains(i + 1)
        else { return nil }
        let parts = args[i + 1].split(separator: ":", omittingEmptySubsequences: false)
        let days = parts[0].split(separator: ",").map(String.init)
        guard !days.isEmpty else { return nil }
        return PlanReachability.Report(
            unreachable: days,
            weeklySessions: parts.count > 1 ? (Int(parts[1]) ?? 2) : 2,
            sequenceLength: parts.count > 2 ? (Int(parts[2]) ?? 4) : 4)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: s.planTitle)

                if let facts = template, let split = facts.splitType, let days = facts.daysPerWeek {
                    // 真计划摘要（分化 · 天数 · 目标 + 背景 · 器械）——重做 2026-06-15「密而干净」。
                    // goal 缺失不丢整块摘要（审查 P1）：onbVerdict 内部 fallback general，同 OnboardingView。
                    VStack(alignment: .leading, spacing: 10) {
                        Text(s.planHeroHeadline(
                            isCustomizedDaySequence: facts.isCustomizedDaySequence,
                            splitCode: split,
                            days: days,
                            goalCode: facts.goal ?? "general"
                        ))
                            .font(.redeHeadline)
                            .tracking(RedeTracking.headline)
                            .foregroundStyle(Color.redeT1)
                            .fixedSize(horizontal: false, vertical: true)
                        // K5 累计事实行（cleanView.sessions 去重天数 + 首场日期派生；
                        // 单位=天——裁定 3；无历史不渲染）。
                        Group {
                            // 竞品对照 RP Hypertrophy：周期位置是导航栏里的一行「WEEK 5 DAY 1」，
                            // 不是半屏的相位 stepper。这里降成 hero 第二行；相位名（构建/过载/减载）
                            // 是引擎术语，用户不据此行动，随四节点轨一起撤。
                            if let cycle {
                                Text(s.mesoPhaseShort(cycle.currentPhase.rawValue) + " · "
                                     + s.planCycleWeek(week: cycle.currentWeekInBlock + 1,
                                                       total: cycle.blockLengthWeeks))
                                    .font(.redeCallout)
                                    .monospacedDigit()
                                    .foregroundStyle(Color.redeT2)
                            }
                            if let ctx = planContextLine(facts) {
                                Text(ctx)
                                    .font(.redeCaption)
                                    .foregroundStyle(Color.redeT4)
                            }
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

                    if let deadZone {
                        deadZoneNotice(deadZone)
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, 14)
                            .transition(reduceMotion ? .identity : .opacity)
                    }

                    // FR-PL2：本周/下周排期（只读派生；有模板即展示，与今日页处方同源）
                    if !projection.isEmpty {
                        weekScheduleSection
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, 4)
                        // FR-PL7②/③：训练日编排入口（开放行下钻编辑器）。
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
                            if let tenure {
                                // 累计成就不是这一页的主线（这一页回答「我的循环长什么样、下一场是哪个」），
                                // 但它仍值得看见——从 hero 挪到页脚，保留读数字号。
                                StatStrip(columns: [
                                    StatColumn(label: s.planTenureColSpan,
                                               value: "\(tenure.weeks)", unit: s.planTenureUnitWeek),
                                    StatColumn(label: s.planTenureColTrained,
                                               value: "\(tenure.days)", unit: s.planTenureUnitDay),
                                ], valueSize: 22)
                                .padding(.bottom, 4)
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel(s.planTenureLine(weeks: tenure.weeks, days: tenure.days))
                            }
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
        // FR-TR14：Today「存进计划」/撤销成功后 revision 变化，显式重读 projection；
        // 失败不递增。即使将来 tab 改为常驻，也不依赖当前 switch 重建的偶然刷新。
        .task(id: sessionStore.completedSessionPlanRevision) {
            await reload()
            // 截图/UI 验证钩子（同 RootTabView -autoStartSession 先例）：
            // simctl launch ... -initialTab plan -autoOpenPlanEditor push-a | -autoOpenDaySequenceEditor
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "-autoOpenPlanEditor"), args.indices.contains(i + 1) {
                editingDay = PlanEditTarget(dayCode: args[i + 1])
            } else if args.contains("-autoOpenDaySequenceEditor") {
                showSequenceEditor = true
            } else if args.contains("-autoOpenLibrary") {
                // K2 截图钩子：自动打开动作库浏览器（simctl 无法点击 UI）。
                showLibrary = true
            }
        }
        // FR-PL6：训练日编辑器（增删换/重排/预览/采纳·恢复默认）；采纳后 reload 刷新排期。
        .sheet(item: $editingDay) { target in
            PlanDayEditorView(dayCode: target.dayCode, onApplied: { Task { await reload() } })
        }
        // FR-PL7②/③：训练日编排编辑器；采纳后 reload 刷新排期。
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
                    .accessibilityHidden(true)   // 装饰性 affordance（审查 NIT，与同屏行拉平）
            }
            .frame(minHeight: RedeShape.controlHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.redePressableRow)
        .accessibilityElement(children: .combine)
        .accessibilityHint(s.exerciseLibraryHint)
    }

    /// 一次后台读、同步一起赋值（审查 MINOR-1）：避免分批到达时闪占位。
    /// 采纳/回滚后复用此函数刷新（写入口已落库 + loadToday，这里重读派生让计划页跟上）。
    private func reload() async {
        let loaded = await Task.detached {
            (SessionStore.loadTemplateFacts(), SessionStore.loadCycleState(),
             SessionStore.loadPlanProjection(), SessionStore.loadPlanAdjustmentState(),
             SessionStore.loadDayLastTrainedDates(), SessionStore.loadTrainingTenure(),
             SessionStore.loadDeadZone())
        }.value
        template = loaded.0
        cycle = loaded.1
        projection = loaded.2
        adjustment = loaded.3
        lastTrainedByDay = loaded.4
        tenure = loaded.5
        // 截图/验收夹具（沿 -appUpdateFixture / -weeklyCoachReviewFixture 先例）：
        // 死区需要「每周重开 + 序列长于实际频率 + 连续两周以上」才成立，真机造这个状态成本很高。
        // 夹具只替换这一个只读派生值，不写盘、不影响任何真实用户路径。
        deadZone = Self.deadZoneFixture ?? loaded.6
        do {
            let codes = PlanScheduleDigestBuilder.digest(from: loaded.2).dayTypes.map(\.dayCode)
            let ids = await Task.detached {
                Dictionary(uniqueKeysWithValues: codes.map {
                    ($0, SessionStore.loadDayEditorContext(dayCode: $0)?.currentExerciseIds ?? [])
                })
            }.value
            exerciseIdsByDay = ids
        }
    }

    /// 背景 · 器械（真数据，引导选项标题）；缺则 nil。
    private func planContextLine(_ facts: SessionStore.TemplateFacts) -> String? {
        var parts: [String] = []
        if let level = facts.level { parts.append(s.onbLevelOption(level).title) }
        if let equip = facts.equipment { parts.append(s.onbEquipOption(equip).title) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: - 计划调整（FR-PL3 提案 / FR-PL4 可撤）

    /// 已采纳栈顶永远展示（撤销入口）；待采纳提案按 kind 在本会话「暂不」后隐藏。
    private var showsAdjustmentCard: Bool {
        if adjustment.activeTo != nil { return true }
        if let proposal = adjustment.proposal {
            return !sessionStore.isPlanProposalSnoozed(proposal.kind)
        }
        return false
    }

    @ViewBuilder
    private var adjustmentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 裁定：提案在上、已采纳收据/撤销在下；不同 kind 可同屏。
            if let proposal = adjustment.proposal,
               !sessionStore.isPlanProposalSnoozed(proposal.kind) {
                adjustmentProposalCard(proposal)
            }
            if let activeTo = adjustment.activeTo {
                adjustmentActiveCard(to: activeTo, kind: adjustment.activeKind)
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
                        Text(proposalBody(p))
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
                                kind: p.kind,
                                fromDaysPerWeek: p.fromDaysPerWeek,
                                toDaysPerWeek: p.toDaysPerWeek
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
                        sessionStore.snoozePlanProposal(p.kind)
                    }
                    .font(.redeCaption).foregroundStyle(Color.redeT4)
                    .buttonStyle(.redePressable).disabled(sessionStore.isSaving)
                }
            }
        }
    }

    private func proposalBody(_ proposal: PlanAdjustmentProposal) -> String {
        switch proposal.kind {
        case .reduceFrequency:
            s.planAdjustReduceBody(
                from: proposal.fromDaysPerWeek,
                to: proposal.toDaysPerWeek
            )
        case .increaseFrequency:
            s.planAdjustIncreaseBody(
                observed: proposal.observedDaysPerWeek,
                from: proposal.fromDaysPerWeek,
                to: proposal.toDaysPerWeek
            )
        }
    }

    /// 已采纳态卡：现状 + 改回原计划（每次 pop 一层）。
    private func adjustmentActiveCard(to: Int, kind: PlanAdjustmentProposal.Kind?) -> some View {
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
                            // 回滚 = 用户明确否决该方向；只 snooze 被弹出的 kind，不吞掉反向提案。
                            if let kind { sessionStore.snoozePlanProposal(kind) }
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
        loopSection(PlanScheduleDigestBuilder.digest(from: projection))
    }

    /// 循环死区提示。事实 → 依据 → 一个动作，与今日页收据同语法；不指责、不说「你应该」。
    ///
    /// 为什么值得占这个位置：这是**用户自己看不出来的因果**。他只会觉得「好像很久没练腿了」，
    /// 而真正的原因是「每周重新开始循环」这个开关 + 他的实际频率短于序列长度。
    /// 引擎的 reduceFrequency 提案解决不了它（序列长度与 daysPerWeek 解耦），
    /// 采纳之后反而连「没练够」的信号都消失。所以这条必须自己说。
    @ViewBuilder
    private func deadZoneNotice(_ report: PlanReachability.Report) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(s.planDeadZoneTitle(report.unreachable.map(s.trainingDayName)))
                .font(.redeSubhead)
                .foregroundStyle(Color.redeT1)
                .fixedSize(horizontal: false, vertical: true)
            Text(s.planDeadZoneReason(weeklySessions: report.weeklySessions,
                                      sequenceLength: report.sequenceLength))
                .font(.redeCaption)
                .foregroundStyle(Color.redeT3)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                Task {
                    guard await sessionStore.saveWeeklyCycleRestart(false) else { return }
                    commitPulse += 1
                    await sessionStore.loadToday()
                    await reload()   // 提示的消失由重算结果驱动，不做乐观隐藏
                }
            } label: {
                HStack(spacing: 6) {
                    Text(s.planDeadZoneAction)
                    Image(systemName: "chevron.right").font(.system(size: 10, weight: .medium))
                }
                .font(.redeCallout)
                .foregroundStyle(Color.redeEmber2)
                .frame(minHeight: RedeShape.controlHeight, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.redePressable)
        }
        .accessibilityElement(children: .combine)
    }

    /// 训练日区（比稿 v3，竞品对照 Alpha Progression）。
    ///
    /// v2 把五天的动作名全铺在一页，结果是一堵均匀的文字墙——信息是重组了，
    /// 但没有视觉分组也没有字阶，所以照样难看。Alpha Progression（功能上离 Rede 最近的）
    /// 的做法是：**训练日做成顶部一排 tab，下面只展开当前那一天**，动作按行列出、
    /// 右侧挂属性。LADDER 与 Hevy 也都是「先给下一场，其余让位」。
    ///
    /// 于是这一版：
    /// · 五天 → 一排可横滑药丸（默认停在下一场），页面不再同时承载五份内容；
    /// · 展开的那一天有真正的字阶跳跃（日名 22 / 动作名 15 / 属性 11）；
    /// · 动作行右侧是「主肌群 · 器械」——目录真值，不是引擎的模式分类学。
    private func loopSection(_ digest: PlanScheduleDigest) -> some View {
        let days = digest.dayTypes
        let nextCode = days.first?.dayCode
        let current = days.first { $0.dayCode == (selectedDay ?? nextCode) } ?? days.first
        return VStack(alignment: .leading, spacing: 0) {
            dayPills(days, currentCode: current?.dayCode, nextCode: nextCode)
            if let current { dayDetail(current, isNext: current.dayCode == nextCode) }
        }
    }

    /// 训练日药丸条：横滑，选中 = redeHair 药丸（与设置页／进展页同一套裸药丸语言）。
    private func dayPills(_ days: [PlanDayProjection], currentCode: String?, nextCode: String?) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(days, id: \.dayCode) { day in
                    let on = day.dayCode == currentCode
                    Button {
                        guard !on else { return }
                        withAnimation(reduceMotion ? nil : .spring(response: 0.28, dampingFraction: 0.88)) {
                            selectedDay = day.dayCode
                        }
                    } label: {
                        Text(s.trainingDayName(day.dayCode))
                            .font(.system(size: 13, weight: on ? .semibold : .medium))
                            .foregroundStyle(on ? Color.redeT1 : Color.redeT4)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 32)
                            .background { if on { Capsule(style: .continuous).fill(Color.redeHair) } }
                            .frame(minHeight: RedeShape.controlHeight)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.redePressableRow)
                    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.horizontal, RedeSpace.page)
        }
        .padding(.horizontal, -RedeSpace.page)   // 药丸条可滑到页边，不被页边距切住
    }

    private func dayDetail(_ day: PlanDayProjection, isNext: Bool) -> some View {
        let ids = exerciseIdsByDay[day.dayCode] ?? []
        return VStack(alignment: .leading, spacing: 0) {
            // 药丸条里已经写着当前是哪一天，详情再放一个同名大标题是白重复一遍
            //（Alpha Progression 有这个重复，但它的 tab 条会滚出视野、标题才需要锚点；
            // Rede 的药丸条就贴在上面，重复读起来只是吵）。所以这里只留一行元信息。
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if isNext {
                    Text(s.planNextTag)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.redeEmber2)
                    Text("·").font(.redeCaption).foregroundStyle(Color.redeT4)
                }
                Text(s.planDayMeta(count: day.exerciseCount,
                                   lastDate: lastTrainedByDay[day.dayCode].map { s.shortDate(fromISO: $0) }))
                    .font(.redeCaption)
                    .monospacedDigit()
                    .foregroundStyle(Color.redeT4)
                Spacer()
            }
            .padding(.top, 12)

            VStack(spacing: 0) {
                ForEach(ids, id: \.self) { id in
                    exerciseRow(id)
                    if id != ids.last {
                        Rectangle().fill(Color.redeHair2).frame(height: 1)
                    }
                }
            }
            .padding(.top, 10)

            Button { editingDay = PlanEditTarget(dayCode: day.dayCode) } label: {
                HStack(spacing: 8) {
                    Image(systemName: "square.and.pencil").font(.redeCaption).foregroundStyle(Color.redeT3)
                    Text(s.planDayEditEntry).font(.redeSubhead).foregroundStyle(Color.redeT1)
                    Spacer()
                    Image(systemName: "chevron.right").font(.redeCaption).foregroundStyle(Color.redeT4)
                }
                .frame(minHeight: RedeShape.controlHeight)
                .contentShape(Rectangle())
            }
            .buttonStyle(.redePressableRow)
            .accessibilityHint(s.planEditDayHint)
        }
        .id(day.dayCode)
        .transition(reduceMotion ? .identity : .opacity)
    }

    private func exerciseRow(_ id: String) -> some View {
        let entry = ExerciseCatalog.minimal.entry(id: id)
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(localeStore.exerciseName(id))
                .font(.redeBody)
                .foregroundStyle(Color.redeT2)
            Spacer(minLength: 8)
            if let entry {
                Text(s.planExerciseAttrs(muscle: entry.primaryMuscle, equipment: entry.equipment))
                    .font(.system(size: 11))
                    .foregroundStyle(Color.redeT4)
            }
        }
        .frame(minHeight: 38)
    }

    /// FR-PL7②/③：训练日编排入口（开放行，点开编辑器 sheet）。
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
}

/// `.sheet(item:)` 需要 Identifiable 包装 dayCode。
private struct PlanEditTarget: Identifiable { let dayCode: String; var id: String { dayCode } }
