import SwiftUI
import RedeL10n
import RedeDomain
import RedeTrainingDecision

// FR-PL6/PL7① 训练日编辑器（切片 S9）。从计划页点训练日下钻：
// 增删换动作 + 同日内上移/下移重排 → 预览肌群频率影响（护栏：提示不强制）→ 采纳 / 恢复默认。
// 2026-07-20 撤销/恢复批：移除可逐步撤回（sheet 内撤销条，纯模型 PlanDayEditUndoModel）；
// 「恢复默认」常驻（列表==默认置灰）且暂存化——点击只重置工作副本，落盘统一走「采纳修改」，
// 列表==默认时采纳按 PlanDayEditRules 收敛（清自定义记录 / 无操作），不写与默认等值的冗余自定义。
// 2026-07-20 操作区批（裁定 A/B）：采纳=EmbButton 全宽唯一主操作（无改动时 disabled）+
// 恢复默认右对齐安静文字行 + 取消上移右上 ✕（What's New 先例）；四动作系统触感（pulse 纪律）。
// 定位「编辑教练给的计划」：起点 = 该日默认处方；引擎仍算重量/进阶（决策在前不破坏）。
// 整面板公理：sheet 内 0 ForgedCard——开放行 + 发丝线 + 单一 ember 主操作（采纳）。

struct PlanDayEditorView: View {
    let dayCode: String
    let onApplied: () -> Void   // 采纳/恢复后让计划页 reload() 刷新派生

    @Environment(\.dismiss) private var dismiss
    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore

    @State private var exerciseIds: [String] = []     // 工作副本（数组顺序 = 训练顺序）
    @State private var defaultIds: [String] = []      // 教练默认日序（恢复默认的暂存目标 + 置灰基线）
    @State private var initialIds: [String] = []      // 打开时初始列表（无改动判定基线——采纳 disabled 依据）
    @State private var undoModel = PlanDayEditUndoModel() // 移除撤销栈（纯模型，见 PlanDayEditModelTests）
    @State private var wasCustomized = false
    @State private var scenario: String?
    @State private var impact: PlanCustomizationImpact.Summary?
    @State private var swapTarget: String?            // 正在换的动作 id（驱动候选 sheet）
    @State private var showAddPicker = false          // FR-PL6 S9b 添加动作选择器
    @State private var loaded = false
    @State private var impactTask: Task<Void, Never>? // 取消上一次影响计算，防乱序覆盖（审查 MINOR）

    // 整行长按拖动重排状态（与 PlanDaySequenceEditorView 同一套防抖逻辑，保持同步）：
    // 拖动期间不改 exerciseIds；被拖行 dragTranslation 瞬时跟手；坐标系 .global 防自激抖；
    // 让位行 gapOffset 在 withAnimation 平滑开槽；松手提交一次。长按用来和滚动/下滑关面板区分。
    @State private var draggingId: String?
    @State private var dragStartIndex: Int?
    @State private var dragTranslation: CGFloat = 0
    @State private var dropTargetIndex = 0
    @State private var liftPulse = 0
    @State private var movePulse = 0
    // 2026-07-20 操作区批（裁定 B）触感脉冲：单调自增计数器（设计语言 §16 pulse 纪律）。
    @State private var removeUndoPulse = 0   // 移除 / 撤销还原 = 轻震
    @State private var restorePulse = 0      // 恢复默认 = 中震
    @State private var applyPulse = 0        // 采纳成功 = success 提交确认
    private let rowHeight: CGFloat = RedeShape.controlHeight

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                VStack(alignment: .leading, spacing: 4) {
                    // 取消上移右上 ✕ 与标题同行（What's New sheet header 先例，裁定 A）；
                    // 底部不再有取消文字钮；下滑关面板 = 同一取消语义（暂存不落盘天然安全）。
                    HStack(spacing: 8) {
                        Text(s.trainingDayName(dayCode))
                            .font(.redeHeadline).tracking(RedeTracking.headline).foregroundStyle(Color.redeT1)
                        Spacer()
                        closeButton
                    }
                    Text(s.planEditSubtitle)
                        .font(.redeCaption).foregroundStyle(Color.redeT3)
                        .fixedSize(horizontal: false, vertical: true)
                }

                exerciseList

                // FR-PL6 S9b：添加同 pattern 族动作（按器械场景过滤、排除已用；引擎仍算负荷/进阶）。
                Button { showAddPicker = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle").font(.redeCaption).foregroundStyle(Color.redeEmber2)
                        Text(s.planEditAddExercise).font(.redeCallout).foregroundStyle(Color.redeEmber2)
                        Spacer()
                    }
                    .frame(minHeight: RedeShape.controlHeight).contentShape(Rectangle())
                }
                .buttonStyle(.redePressable)
                .disabled(sessionStore.isSaving || !loaded) // 载入前 scenario 仍 nil，禁点防短暂未过滤候选（审查 MINOR）
                .accessibilityLabel(s.planEditAddExercise)

                impactSection

                undoBar

                if let err = sessionStore.planSaveErrorText {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.saveFailedLine).font(.redeCaption).foregroundStyle(Color.redeRisk)
                        Text(err).font(.redeCaption).foregroundStyle(Color.redeT4)
                            .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    }
                }

                actionRow
            }
            .padding(RedeSpace.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .presentationBackground(Color.redeBase)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .sensoryFeedback(.impact, trigger: liftPulse)     // 抓起一行 = 轻震
        .sensoryFeedback(.selection, trigger: movePulse)  // 每跨一行 = 轻 tick
        .sensoryFeedback(.impact(weight: .light), trigger: removeUndoPulse)   // 移除/撤销还原 = 轻震
        .sensoryFeedback(.impact(weight: .medium), trigger: restorePulse)     // 恢复默认 = 中震
        .sensoryFeedback(.success, trigger: applyPulse)                       // 采纳成功 = 提交确认
        .task {
            if !loaded { await load() }
            // 截图/UI 验证钩子（同 PlanTabView -autoOpenPlanEditor 先例）：-autoOpenAddPicker 自动弹添加选择器。
            if CommandLine.arguments.contains("-autoOpenAddPicker") { showAddPicker = true }
            // 2026-07-20 撤销/恢复批钩子（仅测试脚手架，驱动真实 remove/undo/restore/apply 路径）：
            // -autoRemoveFirstExercise N 连移除 N 次首行；-autoUndoRemoval 撤销一次；
            // -autoRestoreDefault 恢复默认（暂存）；-autoApplyPlanEdit 采纳（含收敛落盘）。
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "-autoRemoveFirstExercise"), args.indices.contains(i + 1),
               let n = Int(args[i + 1]) {
                for _ in 0..<n { if let first = exerciseIds.first { remove(first) } }
            }
            if args.contains("-autoUndoRemoval") { undoRemoval() }
            if args.contains("-autoRestoreDefault") { restoreToDefault() }
            if args.contains("-autoApplyPlanEdit") { await apply() }
        }
        .sheet(item: Binding(get: { swapTarget.map(SwapPick.init) }, set: { swapTarget = $0?.id })) { pick in
            swapSheet(for: pick.id)
        }
        .sheet(isPresented: $showAddPicker) { addSheet }
    }

    // MARK: 动作清单（开放行：整行长按拖动重排 + 换/移除按钮；上下移留作无障碍动作）

    private var exerciseList: some View {
        VStack(alignment: .leading, spacing: 0) {
            if exerciseIds.isEmpty {
                Text(s.planEditEmptyDay).font(.redeBody).foregroundStyle(Color.redeT3)
                    .padding(.vertical, 8)
            } else {
                ForEach(Array(exerciseIds.enumerated()), id: \.element) { idx, id in
                    exerciseRow(idx: idx, id: id)
                }
            }
        }
    }

    private func exerciseRow(idx: Int, id: String) -> some View {
        let isDragging = draggingId == id
        // 被拖行偏移=跟手位移；其他行偏移=让位空位（同顺序编辑器的 gap 防抖架构）。
        let yOffset = isDragging ? dragTranslation : gapOffset(forIndex: idx)
        let name = localeStore.exerciseName(id)
        return HStack(spacing: 12) {
            Text(name)
                .font(.redeBody).foregroundStyle(Color.redeT1)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                // 重排无障碍动作挂在动作名上（不 combine，保留换/移除按钮各自的 VoiceOver）。
                .accessibilityElement()
                .accessibilityLabel(name)
                .accessibilityActions {
                    if idx > 0 { Button(s.planEditMoveUp) { move(id: id, by: -1) } }
                    if idx < exerciseIds.count - 1 { Button(s.planEditMoveDown) { move(id: id, by: 1) } }
                }
            iconButton("arrow.left.arrow.right", s.planEditSwap + " " + name) { swapTarget = id }
            iconButton("minus.circle", s.planEditRemove + " " + name) { remove(id) }
        }
        .frame(height: rowHeight)
        .background(isDragging ? Color.redeBase : Color.clear)  // 抬起时不透明，盖住相邻行与发丝线
        .overlay(alignment: .top) {
            if idx > 0 && !isDragging { Rectangle().fill(Color.redeHair2).frame(height: 1) }
        }
        .contentShape(Rectangle())
        .shadow(color: Color.black.opacity(isDragging ? 0.32 : 0),
                radius: isDragging ? 8 : 0, y: isDragging ? 4 : 0)
        .offset(y: yOffset)
        .zIndex(isDragging ? 1 : 0)
        .gesture(reorderGesture(id: id))   // 长按整行拖动重排（换/移除按钮仍可点）
        .disabled(sessionStore.isSaving)
    }

    private func iconButton(_ icon: String, _ label: String, enabled: Bool = true, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.redeCaption)
                .foregroundStyle(enabled ? Color.redeT3 : Color.redeT4.opacity(0.4))
                .frame(width: 30, height: RedeShape.controlHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.redePressable)
        .disabled(!enabled || sessionStore.isSaving)
        .accessibilityLabel(label)
    }

    // MARK: 影响预览（护栏：提示不强制）

    @ViewBuilder
    private var impactSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Overline(text: s.planEditImpactTitle)
            if let dropped = impact?.droppedBelowTwice, !dropped.isEmpty {
                Text(s.planEditMuscleFrequencyWarning(muscles: dropped.map(s.muscleLabel)))
                    .font(.redeCaption).foregroundStyle(Color.redeRisk)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text(s.planEditImpactOk).font(.redeCaption).foregroundStyle(Color.redeT3)
            }
        }
    }

    // MARK: 移除撤销条（2026-07-20 owner 实机反馈：误删要能一键撤回）

    /// 栈非空时常驻（逐次点击逐个还原、栈空消失）；开放行式、零卡零图标零小字；
    /// 条上唯一 ember 是「撤销」动作词，正文 t3（视觉纪律见交接件裁定 A）。
    @ViewBuilder
    private var undoBar: some View {
        if let lastId = undoModel.lastRemovedId {
            let name = localeStore.exerciseName(lastId)
            HStack(spacing: 12) {
                Text(s.planEditRemovedLine(name))
                    .font(.redeCaption).foregroundStyle(Color.redeT3)
                    .lineLimit(1)
                Spacer()
                Button(s.coachUndoLabel) { undoRemoval() }
                    .font(.redeCaption.weight(.semibold)).foregroundStyle(Color.redeEmber2)
                    .buttonStyle(.redePressable)
                    .disabled(sessionStore.isSaving)
                    .accessibilityLabel(s.planEditRemovedUndoA11y(name))
            }
            .frame(minHeight: RedeShape.controlHeight)
            .transition(.opacity)
        }
    }

    // MARK: 采纳 / 恢复默认 / 取消（2026-07-20 操作区批，裁定 A）

    /// 右上 ✕ 取消（What's New sheet 先例：xmark 13 semibold / t2 / controlHeight² / redePressable）。
    private var closeButton: some View {
        Button { undoModel.clear(); dismiss() } label: {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.redeT2)
                .frame(width: RedeShape.controlHeight, height: RedeShape.controlHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.redePressable)
        .disabled(sessionStore.isSaving)
        .accessibilityLabel(s.planEditCancel)
        .accessibilityIdentifier("plan-day-editor-close")
    }

    private var actionRow: some View {
        // 结构（自上而下）：「恢复默认」右对齐安静文字行 + 「采纳修改」EmbButton 全宽主操作。
        // 恢复默认常驻（不随 wasCustomized 隐藏，防布局跳动）；列表==教练默认时置灰——
        // 置灰须显式换色（redePressable 不自带禁用变暗；同 iconButton 口径）。语义=暂存：
        // 只重置工作副本、留在 sheet，落盘仍走「采纳修改」。
        let restoreDisabled = sessionStore.isSaving || !loaded
            || PlanDayEditRules.isAtDefault(working: exerciseIds, defaults: defaultIds)
        // 采纳=面板唯一大 ember 面（同 What's New「继续」/设置保存先例，checkmark + 0.45 禁用透明）；
        // 无改动（工作副本==打开时初始列表）时 disabled——无改动没有「采纳」可言。
        let applyDisabled = sessionStore.isSaving || exerciseIds.isEmpty
            || !PlanDayEditRules.hasChanges(working: exerciseIds, initial: initialIds)
        return VStack(spacing: 4) {
            HStack {
                Spacer()
                Button(s.planEditRestoreDefault) { restoreToDefault() }
                    .font(.redeCaption)
                    .foregroundStyle(restoreDisabled ? Color.redeT4.opacity(0.4) : Color.redeT3)
                    .buttonStyle(.redePressable)
                    .disabled(restoreDisabled)
            }
            .frame(minHeight: RedeShape.controlHeight)
            EmbButton(icon: "checkmark", title: s.planEditApply) { Task { await apply() } }
                .disabled(applyDisabled)
                .opacity(applyDisabled ? 0.45 : 1)
        }
    }

    // MARK: 换动作候选 sheet（同替代族；排除已在清单的）

    private func swapSheet(for id: String) -> some View {
        // FR-EQ1：候选须守器械场景白名单（家用哑铃用户不推荐器械动作）——同今日页换动作口径。
        let candidates = ExerciseReplacementEngine.candidates(
            for: id, excluding: Set(exerciseIds),
            allowedEquipment: EquipmentAccess.allowed(for: scenario)
        )
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(s.planEditSwap).font(.redeHeadline).foregroundStyle(Color.redeT1)
                    .padding(.bottom, 8)
                if candidates.isEmpty {
                    Text(s.exerciseDetailNoAlternatives).font(.redeBody).foregroundStyle(Color.redeT3)
                } else {
                    ForEach(Array(candidates.enumerated()), id: \.element) { i, cand in
                        if i > 0 { Rectangle().fill(Color.redeHair2).frame(height: 1) }
                        Button { swap(id, to: cand) } label: {
                            HStack {
                                Text(localeStore.exerciseName(cand)).font(.redeBody).foregroundStyle(Color.redeT1)
                                Spacer()
                                Image(systemName: "arrow.left.arrow.right").font(.redeCaption).foregroundStyle(Color.redeEmber2)
                            }
                            .frame(minHeight: RedeShape.controlHeight).contentShape(Rectangle())
                        }
                        .buttonStyle(.redePressableRow)
                    }
                }
            }
            .padding(RedeSpace.page).frame(maxWidth: .infinity, alignment: .leading)
        }
        .presentationBackground(Color.redeBase)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    // MARK: 添加动作 sheet（S9b：同 pattern 族候选；守器械白名单；排除已用）

    @ViewBuilder
    private var addSheet: some View {
        let candidates = TodayPrescriptionEngine.addCandidates(
            dayCode: dayCode, currentIds: exerciseIds, equipmentScenario: scenario
        )
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(s.planEditAddExercise).font(.redeHeadline).foregroundStyle(Color.redeT1)
                    .padding(.bottom, 8)
                if candidates.isEmpty {
                    Text(s.planEditAddNoneLeft).font(.redeBody).foregroundStyle(Color.redeT3)
                } else {
                    // 选完即从列表消失（candidates 随 exerciseIds 重算）→ sheet 不关，可连加多个。
                    ForEach(Array(candidates.enumerated()), id: \.element) { i, cand in
                        if i > 0 { Rectangle().fill(Color.redeHair2).frame(height: 1) }
                        Button { add(cand) } label: {
                            HStack {
                                Text(localeStore.exerciseName(cand)).font(.redeBody).foregroundStyle(Color.redeT1)
                                Spacer()
                                Image(systemName: "plus.circle").font(.redeCaption).foregroundStyle(Color.redeEmber2)
                            }
                            .frame(minHeight: RedeShape.controlHeight).contentShape(Rectangle())
                        }
                        .buttonStyle(.redePressableRow)
                        .accessibilityLabel(s.planEditAddExercise + " " + localeStore.exerciseName(cand))
                    }
                }
            }
            .padding(RedeSpace.page).frame(maxWidth: .infinity, alignment: .leading)
        }
        .presentationBackground(Color.redeBase)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: 行为

    private func load() async {
        sessionStore.planSaveErrorText = nil // 开编辑即清旧错（防上次失败残留到本次，审查 M-2）
        let dc = dayCode
        let ctx = await Task.detached { SessionStore.loadDayEditorContext(dayCode: dc) }.value // 磁盘读 off-main
        guard let ctx else { loaded = true; return }
        // 去重保序：防历史写入含重复 id 时 ForEach(\.element) 渲染错乱（审查 M-3）。
        var seen = Set<String>()
        exerciseIds = ctx.currentExerciseIds.filter { seen.insert($0).inserted }
        initialIds = exerciseIds   // 无改动判定基线 = 去重后的打开时列表
        defaultIds = ctx.defaultExerciseIds
        wasCustomized = ctx.isCustomized
        scenario = ctx.equipmentScenario
        recomputeImpact()
        loaded = true
    }

    /// 无障碍重排：按 id 实时定位再单步 swap（不依赖捕获的 idx）。
    private func move(id: String, by delta: Int) {
        guard let idx = exerciseIds.firstIndex(of: id) else { return }
        let target = idx + delta
        guard exerciseIds.indices.contains(target) else { return }
        exerciseIds.swapAt(idx, target)
        recomputeImpact()
    }

    // MARK: 整行长按拖动重排（gap 防抖架构，与 PlanDaySequenceEditorView 同步维护）

    /// 让位偏移：被拖行从 start 移到 dropTargetIndex，给被它跨过的行让出一个行高的空位（落定时零位移、无缝）。
    private func gapOffset(forIndex i: Int) -> CGFloat {
        guard let start = dragStartIndex, i != start else { return 0 }
        let t = dropTargetIndex
        if start < t { return (i > start && i <= t) ? -rowHeight : 0 }
        if start > t { return (i >= t && i < start) ? rowHeight : 0 }
        return 0
    }

    /// 落点下标，带迟滞死区（交界 ±0.2 行内不翻，防边界抖）。以当前 dropTargetIndex 为锚；while 兜多槽。
    private func targetIndex(start: Int) -> Int {
        let p = dragTranslation / rowHeight
        var rel = dropTargetIndex - start
        let m = 0.2
        while p > Double(rel) + 0.5 + m { rel += 1 }
        while p < Double(rel) - 0.5 - m { rel -= 1 }
        return max(0, min(exerciseIds.count - 1, start + rel))
    }

    /// 整行长按 0.2s 抬起 → 拖动。长按用来和"快速滑动=滚动/下滑关面板"区分（整行可拖必须如此）。
    /// 拖动期间不改 exerciseIds；被拖行 dragTranslation 瞬时跟手；DragGesture .global 防自激抖；
    /// 让位行 gapOffset 在 withAnimation 平滑开槽；松手提交一次 + 重算影响。
    private func reorderGesture(id: String) -> some Gesture {
        LongPressGesture(minimumDuration: 0.2)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .global))
            .onChanged { value in
                guard case .second(true, let drag) = value else { return }
                if draggingId != id {                 // 长按抬起瞬间：抓起
                    draggingId = id
                    dragStartIndex = exerciseIds.firstIndex(of: id)
                    dropTargetIndex = dragStartIndex ?? 0
                    dragTranslation = 0
                    liftPulse += 1
                }
                guard let drag else { return }
                dragTranslation = drag.translation.height
                guard let start = dragStartIndex else { return }
                let t = targetIndex(start: start)
                if t != dropTargetIndex {
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) { dropTargetIndex = t }
                    movePulse += 1
                }
            }
            .onEnded { _ in
                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                    if let start = dragStartIndex, start != dropTargetIndex {
                        exerciseIds.move(fromOffsets: IndexSet(integer: start),
                                         toOffset: dropTargetIndex > start ? dropTargetIndex + 1 : dropTargetIndex)
                    }
                    draggingId = nil
                    dragStartIndex = nil
                    dragTranslation = 0
                }
                recomputeImpact()   // 顺序变了 → 重算肌群频率影响
            }
    }

    private func remove(_ id: String) {
        guard let idx = exerciseIds.firstIndex(of: id) else { return }
        // undoModel 变更必须在动画事务内——撤销条的插入/移除由它驱动，
        // 事务外变更会让 .transition(.opacity) 失效（条瞬跳，验收 NIT）。
        withAnimation(.easeInOut(duration: 0.2)) {
            undoModel.recordRemoval(id: id, index: idx)  // 压栈 (id, 原 index)；swap 原位替换不入栈
            exerciseIds.removeAll { $0 == id }
        }
        removeUndoPulse += 1   // 移除 = 轻震（裁定 B）
        recomputeImpact()
    }

    /// 撤销一次移除：还原到 min(原 index, 当前 count)；期间被添加器重新加入的条目跳过继续 pop。
    private func undoRemoval() {
        withAnimation(.easeInOut(duration: 0.2)) {
            guard let restored = undoModel.undo(current: exerciseIds) else { return }
            exerciseIds = restored
            removeUndoPulse += 1   // 撤销还原成功 = 轻震（无可还原不震）
        }
        recomputeImpact()
    }

    /// 恢复默认（暂存化）：只重置工作副本、留在 sheet；落盘仍走「采纳修改」。
    private func restoreToDefault() {
        withAnimation(.easeInOut(duration: 0.2)) {
            undoModel.clear()  // 旧还原点对新基线已无意义
            exerciseIds = defaultIds
        }
        restorePulse += 1   // 恢复默认 = 中震（裁定 B）
        recomputeImpact()
    }

    private func add(_ id: String) {
        guard !exerciseIds.contains(id) else { return } // addCandidates 已排除已用；双保险防重复
        exerciseIds.append(id)
        recomputeImpact() // sheet 保持打开（candidates 重算 → 已加项消失），可连加多个
    }

    private func swap(_ id: String, to newId: String) {
        if let i = exerciseIds.firstIndex(of: id) { exerciseIds[i] = newId }
        swapTarget = nil
        recomputeImpact()
    }

    private func recomputeImpact() {
        impactTask?.cancel() // 连点 move/remove 时取消上一次，避免慢任务后完成覆盖成过期值（审查 MINOR）
        let dc = dayCode, ids = exerciseIds
        impactTask = Task { // 磁盘读 off-main（每次编辑触发，不阻塞主线程，审查 M-1）；回到主 actor 赋值
            let result = await Task.detached { SessionStore.computeDayEditImpact(dayCode: dc, proposedIds: ids) }.value
            guard !Task.isCancelled else { return }
            impact = result
        }
    }

    /// 采纳收敛（裁定 B，纯裁定见 PlanDayEditRules）：列表==默认时不写「与默认等值的自定义」——
    /// 已自定义走 removeCustomDayPlan 清掉记录（canonical 不留冗余覆盖）；从未自定义等价无操作直接关。
    private func apply() async {
        switch PlanDayEditRules.applyResolution(working: exerciseIds, defaults: defaultIds, wasCustomized: wasCustomized) {
        case .noop:
            undoModel.clear()
            applyPulse += 1   // 采纳成功 = success 确认（裁定 B；先于 dismiss 触发）
            dismiss()
        case .clearCustom:
            if await sessionStore.removeCustomDayPlan(dayCode: dayCode) {
                undoModel.clear()
                applyPulse += 1
                onApplied()
                dismiss()
            }
        case .writeCustom:
            let items = exerciseIds.map { CustomExerciseItem(exerciseId: $0) }
            if await sessionStore.applyCustomDayPlan(dayCode: dayCode, exercises: items) {
                undoModel.clear()
                applyPulse += 1
                onApplied()
                dismiss()
            }
        }
    }
}

/// `.sheet(item:)` 需要 Identifiable 包装裸 String。
private struct SwapPick: Identifiable { let id: String }
