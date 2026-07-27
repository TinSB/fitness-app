import SwiftUI
import RedeL10n
import RedeTrainingDecision

// FR-PL7③ 训练日自由编排。从计划页「编排训练日」入口打开：
// 换类型 / 添加 / 移除 / 长按拖动重排；用户决定日序构成，引擎仍按完成场次轮转并算处方。
// 护栏只给中性事实：实时预览「下一个训练日将变为 X」，不警告、不说教、不阻止合法编排。
// 2026-07-20 操作区批（裁定 C，与 PlanDayEditorView 同构统一）：采纳=EmbButton 全宽唯一主操作
//（无改动 disabled）+ 恢复默认常驻安静文字行（暂存化：点击只重置工作副本、采纳才落盘，
// 收敛复用 PlanDayEditRules.applyResolution）+ 取消上移右上 ✕。
// FR-PL7③ 引入删除后，撤销继续复用 PlanDayEditUndoModel（由 PlanDaySequenceDraft 以 occurrence id 桥接）。
// 整面板公理：sheet 内 0 ForgedCard——开放行 + 发丝线 + 单一 ember 主操作（采纳）。
struct PlanDaySequenceEditorView: View {
    let onApplied: () -> Void   // 采纳/恢复后让计划页 reload() 刷新排期

    @Environment(\.dismiss) private var dismiss
    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore

    @State private var draft = PlanDaySequenceDraft(codes: []) // occurrence identity 支持重复 dayCode
    @State private var initialOrder: [String] = []     // 载入时的顺序（无改动则禁用采纳，免 no-op 写）
    @State private var defaultOrder: [String] = []     // 教练默认日序（恢复默认的暂存目标 + 置灰基线）
    @State private var wasCustomized = false
    @State private var splitType: String?
    @State private var completedSessionCount = 0
    @State private var dayPickerMode: SequenceDayPickerMode?
    @State private var loaded = false

    // 拖动重排状态（防抖架构：拖动期间**不改数组**，被拖行纯靠偏移跟手、其他行平滑让位，
    // 只在松手落定一次顺序——杜绝"边拖边改数组导致被拖行槽位被父级动画、和跟手偏移打架"的抽动）。
    @State private var draggingRowID: String?           // 正在拖动的 occurrence（重复 code 仍各自独立）
    @State private var dragStartIndex: Int?             // 抓起时的原始下标（拖动期间数组不变，故恒定）
    @State private var dragTranslation: CGFloat = 0     // 手指竖向位移 = 被拖行 offset（瞬时跟手，不进 withAnimation）
    @State private var dropTargetIndex = 0              // 当前落点下标（在 withAnimation 里更新 → 让位行平滑开槽）
    @State private var liftPulse = 0                    // 抓起触感脉冲
    @State private var movePulse = 0                    // 每跨一行的轻触感脉冲
    // 2026-07-20 操作区批（裁定 B/C）触感脉冲：单调自增计数器（设计语言 §14.2 pulse 纪律）。
    @State private var restorePulse = 0                 // 恢复默认 = 中震
    @State private var applyPulse = 0                   // 采纳成功 = success 提交确认
    @State private var removeUndoPulse = 0              // 移除 / 撤销 = 轻震
    private let rowHeight: CGFloat = RedeShape.controlHeight  // 固定行高 = 落点取整步距

    private var s: RedeStrings { localeStore.strings }
    private var dayCodes: [String] { draft.codes }

    /// 护栏预览：当前工作副本下的下一个训练日（纯引擎计算，无磁盘——随重排实时变）。
    private var nextDayName: String? {
        TodayPrescriptionEngine.nextDayCode(
            splitType: splitType, daySequenceOverride: dayCodes, completedSessionCount: completedSessionCount
        ).map(s.trainingDayName)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                VStack(alignment: .leading, spacing: 4) {
                    // 取消上移右上 ✕ 与标题同行（What's New sheet header 先例，裁定 A/C 统一）；
                    // 底部不再有取消文字钮；下滑关面板 = 同一取消语义（暂存不落盘天然安全）。
                    HStack(spacing: 8) {
                        Text(s.planSeqEditTitle)
                            .font(.redeHeadline).tracking(RedeTracking.headline).foregroundStyle(Color.redeT1)
                        Spacer()
                        closeButton
                    }
                    Text(s.planSeqEditSubtitle)
                        .font(.redeCaption).foregroundStyle(Color.redeT3)
                        .fixedSize(horizontal: false, vertical: true)
                }

                dayList

                if let nd = nextDayName {
                    VStack(alignment: .leading, spacing: 6) {
                        Overline(text: s.planEditImpactTitle)
                        Text(s.planSeqNextDay(nd))
                            .font(.redeCaption).foregroundStyle(Color.redeT3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

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
        .task {
            if !loaded { await load() }
            // UI 证据钩子全部以 canonical dayCode 传参；只驱动真实编辑动作，不另开测试写路径。
            await runAutomationHooks(CommandLine.arguments)
        }
        .sensoryFeedback(.impact, trigger: liftPulse)     // 抓起一行 = 轻震
        .sensoryFeedback(.selection, trigger: movePulse)  // 每跨一槽 = 轻 tick
        .sensoryFeedback(.impact(weight: .light), trigger: removeUndoPulse)   // 移除/撤销 = 轻震
        .sensoryFeedback(.impact(weight: .medium), trigger: restorePulse)  // 恢复默认 = 中震
        .sensoryFeedback(.success, trigger: applyPulse)                    // 采纳成功 = 提交确认
        .sheet(item: $dayPickerMode) { mode in
            dayTypePicker(mode: mode)
        }
    }

    // MARK: 训练日清单（开放行：整行长按拖动重排；上下移留作无障碍动作）

    private var dayList: some View {
        VStack(spacing: 0) {
            ForEach(Array(draft.rows.enumerated()), id: \.element.id) { idx, row in
                dayRow(idx: idx, row: row)
            }
            if !draft.rows.isEmpty {
                Rectangle().fill(Color.redeHair2).frame(height: 1)
            }
            Button { dayPickerMode = .add } label: {
                HStack(spacing: 8) {
                    Image(systemName: "plus.circle")
                        .font(.redeCaption)
                        .foregroundStyle(draft.canAppend ? Color.redeEmber2 : Color.redeT4.opacity(0.4))
                    Text(s.planSeqAddDay)
                        .font(.redeCallout)
                        .foregroundStyle(draft.canAppend ? Color.redeEmber2 : Color.redeT4.opacity(0.4))
                    Spacer()
                }
                .frame(minHeight: RedeShape.controlHeight)
                .contentShape(Rectangle())
            }
            .buttonStyle(.redePressable)
            .disabled(sessionStore.isSaving || !loaded || !draft.canAppend)
            .accessibilityLabel(s.planSeqAddDay)
        }
    }

    private func dayRow(idx: Int, row: PlanDaySequenceDraft.Row) -> some View {
        let isDragging = draggingRowID == row.id
        // 被拖行：偏移=跟手位移（瞬时）。其他行：偏移=让位空位（被拖行跨过它时让出一个行高，平滑）。
        let yOffset = isDragging ? dragTranslation : gapOffset(forIndex: idx)
        let name = s.trainingDayName(row.dayCode)
        return HStack(spacing: 12) {
            Text(name)
                .font(.redeBody).foregroundStyle(Color.redeT1)
                .lineLimit(1)   // 行高固定（拖动步距用），训练日名都很短；大字号下截断而非撑破步距数学
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement()
                .accessibilityLabel(name)
                .accessibilityActions {
                    if idx > 0 { Button(s.planEditMoveUp) { move(rowID: row.id, by: -1) } }
                    if idx < draft.rows.count - 1 { Button(s.planEditMoveDown) { move(rowID: row.id, by: 1) } }
                }
            iconButton("arrow.left.arrow.right", s.planSeqChangeDay + " " + name) {
                dayPickerMode = .replace(rowID: row.id)
            }
            iconButton("minus.circle", s.planEditRemove + " " + name, enabled: draft.canRemove) {
                remove(rowID: row.id)
            }
        }
        .frame(height: rowHeight)
        .background(isDragging ? Color.redeBase : Color.clear)  // 抬起时不透明，盖住相邻行与发丝线
        .overlay(alignment: .top) {
            if idx > 0 && !isDragging { Rectangle().fill(Color.redeHair2).frame(height: 1) }
        }
        .contentShape(Rectangle())
        .shadow(color: Color.black.opacity(isDragging ? 0.32 : 0),
                radius: isDragging ? 8 : 0, y: isDragging ? 4 : 0)  // 阴影=抬起感（不缩放，遵动效守卫）
        .offset(y: yOffset)
        .zIndex(isDragging ? 1 : 0)
        .gesture(reorderGesture(rowID: row.id))   // 长按整行拖动重排（见手势注释）
        .disabled(sessionStore.isSaving)
    }

    private func iconButton(
        _ icon: String,
        _ label: String,
        enabled: Bool = true,
        _ action: @escaping () -> Void
    ) -> some View {
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

    /// 落点下标，**带迟滞死区**（关键）：只在手指越过"半行 + 余量"才翻到下一槽、越回"半行 − 余量"才翻回，
    /// 边界附近留一条死区→手指停在两行交界处轻微抖动也不会让落点来回翻（否则让位行会反复上下＝抽动）。
    /// 以当前 dropTargetIndex 为锚做迟滞；while 兜住快速拖动跨多槽。
    private func targetIndex(start: Int) -> Int {
        let p = dragTranslation / rowHeight       // 从起点起的行数（带符号）
        var rel = dropTargetIndex - start         // 当前相对落点
        let m = 0.2                               // 迟滞余量：交界 ±0.2 行内不翻
        while p > Double(rel) + 0.5 + m { rel += 1 }
        while p < Double(rel) - 0.5 - m { rel -= 1 }
        return max(0, min(dayCodes.count - 1, start + rel))
    }

    /// 让位偏移：被拖行从 start 移到 dropTargetIndex，给被它跨过的行让出一个行高的空位。
    /// 关键——这些偏移恰好等于"落定后该行的最终槽位与当前槽位之差"，故松手提交时这些行视觉零位移、无缝。
    private func gapOffset(forIndex i: Int) -> CGFloat {
        guard let start = dragStartIndex, i != start else { return 0 }  // 被拖行自身不让位（调用方已按 isDragging 排除，这里再兜一层）
        let target = dropTargetIndex
        if start < target {            // 向下拖：(start, target] 的行上移一格让位
            return (i > start && i <= target) ? -rowHeight : 0
        } else if start > target {     // 向上拖：[target, start) 的行下移一格让位
            return (i >= target && i < start) ? rowHeight : 0
        }
        return 0
    }

    /// 整行长按 0.2s 抬起 → 拖动重排。**长按是必需的**：整行可拖时，要靠"先按住"来和"快速滑动=滚动/
    /// 下滑关面板"区分（否则一拖就被当成滚动/关闭）。**拖动期间不改 dayCodes**：被拖行靠 dragTranslation 瞬时
    /// 跟手（不进 withAnimation → 没动画能和它打架 → 不抽）；`coordinateSpace: .global` 让位移用屏幕绝对坐标、
    /// 基准不随行移动（否则自激抖）；让位行 gapOffset 在 withAnimation 里平滑开槽；松手提交一次（无缝落位）。
    /// 注：VoiceOver 开启时系统会拦截此手势，重排走 accessibilityActions（已知降级，非 bug）。
    private func reorderGesture(rowID: String) -> some Gesture {
        LongPressGesture(minimumDuration: 0.2)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .global))
            .onChanged { value in
                guard case .second(true, let drag) = value else { return }
                if draggingRowID != rowID {               // 长按抬起瞬间：抓起
                    draggingRowID = rowID
                    dragStartIndex = draft.rows.firstIndex { $0.id == rowID }
                    dropTargetIndex = dragStartIndex ?? 0
                    dragTranslation = 0
                    liftPulse += 1
                }
                guard let drag else { return }            // 已抬起、还没拖
                dragTranslation = drag.translation.height
                guard let start = dragStartIndex else { return }
                let t = targetIndex(start: start)
                if t != dropTargetIndex {                   // 跨过一行：让位行平滑开槽 + 轻 tick
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.9)) { dropTargetIndex = t }
                    movePulse += 1
                }
            }
            .onEnded { _ in
                // 落定：提交顺序 + 清拖动态全放进同一 withAnimation——被拖行从松手位 spring 入最终槽，
                // 让位行因 gapOffset 已等于最终位移而视觉不动，整体无缝。
                withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                    if let start = dragStartIndex, start != dropTargetIndex {
                        draft.move(from: start, to: dropTargetIndex)
                    }
                    draggingRowID = nil
                    dragStartIndex = nil
                    dragTranslation = 0
                }
            }
    }

    // MARK: 训练日类型选择（显式 11 项，按族分组）

    private var dayTypeGroups: [(title: String, codes: [String])] {
        let groups: [(title: String, codes: [String])] = [
            (s.planSeqGroupPush, ["push-a", "push-b"]),
            (s.planSeqGroupPull, ["pull-a", "pull-b"]),
            (s.planSeqGroupLegs, ["legs-a", "legs-b"]),
            (s.planSeqGroupUpperLower, ["upper", "lower"]),
            (s.planSeqGroupFullBody, ["full-a", "full-b", "full-c"]),
        ]
        assert(
            Set(groups.flatMap { $0.codes }) == TodayPrescriptionEngine.knownDayCodes,
            "训练日选择器必须覆盖且只覆盖显式 dayCode 白名单"
        )
        return groups
    }

    private func dayTypePicker(mode: SequenceDayPickerMode) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(mode.isAdd ? s.planSeqAddDay : s.planSeqChangeDay)
                        .font(.redeHeadline)
                        .tracking(RedeTracking.headline)
                        .foregroundStyle(Color.redeT1)
                    Text(s.planSeqChooseDay)
                        .font(.redeCaption)
                        .foregroundStyle(Color.redeT3)
                }

                ForEach(Array(dayTypeGroups.enumerated()), id: \.offset) { groupIndex, group in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(group.title)
                            .font(.redeOverline)
                            .tracking(RedeTracking.overline)
                            .foregroundStyle(Color.redeT3)
                            .padding(.bottom, 4)
                        ForEach(Array(group.codes.enumerated()), id: \.element) { index, code in
                            if index > 0 {
                                Rectangle().fill(Color.redeHair2).frame(height: 1)
                            }
                            Button { select(dayCode: code, for: mode) } label: {
                                HStack(spacing: 8) {
                                    Text(s.trainingDayName(code))
                                        .font(.redeBody)
                                        .foregroundStyle(Color.redeT1)
                                    Spacer()
                                    Image(systemName: mode.isAdd ? "plus.circle" : "arrow.left.arrow.right")
                                        .font(.redeCaption)
                                        .foregroundStyle(Color.redeEmber2)
                                }
                                .frame(minHeight: RedeShape.controlHeight)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.redePressableRow)
                            .accessibilityLabel(s.planSeqChooseDay + " " + s.trainingDayName(code))
                        }
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel(group.title)

                    if groupIndex < dayTypeGroups.count - 1 {
                        Rectangle().fill(Color.redeHair2).frame(height: 1)
                    }
                }
            }
            .padding(RedeSpace.page)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .presentationBackground(Color.redeBase)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func select(dayCode: String, for mode: SequenceDayPickerMode) {
        switch mode {
        case .add:
            _ = draft.add(dayCode: dayCode)
        case .replace(let rowID):
            _ = draft.replace(rowID: rowID, with: dayCode)
        }
        dayPickerMode = nil
    }

    // MARK: 移除撤销条（复用 PlanDayEditUndoModel，经 occurrence id 支持重复 dayCode）

    @ViewBuilder
    private var undoBar: some View {
        if let dayCode = draft.lastRemovedDayCode {
            let name = s.trainingDayName(dayCode)
            let undoDisabled = sessionStore.isSaving || !draft.canAppend
            HStack(spacing: 12) {
                Text(s.planEditRemovedLine(name))
                    .font(.redeCaption)
                    .foregroundStyle(Color.redeT3)
                    .lineLimit(1)
                Spacer()
                Button(s.coachUndoLabel) { undoRemoval() }
                    .font(.redeCaption.weight(.semibold))
                    .foregroundStyle(undoDisabled ? Color.redeT4.opacity(0.4) : Color.redeEmber2)
                    .buttonStyle(.redePressable)
                    .disabled(undoDisabled)
                    .accessibilityLabel(s.planEditRemovedUndoA11y(name))
            }
            .frame(minHeight: RedeShape.controlHeight)
            .transition(.opacity)
        }
    }

    // MARK: 采纳 / 恢复默认 / 取消（2026-07-20 操作区批，与 PlanDayEditorView 同构）

    /// 右上 ✕ 取消（What's New sheet 先例：xmark 13 semibold / t2 / controlHeight² / redePressable）。
    private var closeButton: some View {
        Button { draft.clearUndo(); dismiss() } label: {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.redeT2)
                .frame(width: RedeShape.controlHeight, height: RedeShape.controlHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.redePressable)
        .disabled(sessionStore.isSaving)
        .accessibilityLabel(s.planEditCancel)
        .accessibilityIdentifier("plan-seq-editor-close")
    }

    private var actionRow: some View {
        // 结构同 PlanDayEditorView：「恢复默认」右对齐安静文字行（常驻，序列==默认置灰——
        // 显式换色，redePressable 不自带禁用变暗）+ 「采纳修改」EmbButton 全宽唯一 ember 主操作。
        // 恢复默认语义=暂存：只重置工作副本、留在 sheet；落盘统一走采纳（收敛见 apply()）。
        let restoreDisabled = sessionStore.isSaving || !loaded
            || PlanDayEditRules.isAtDefault(working: dayCodes, defaults: defaultOrder)
        let applyDisabled = sessionStore.isSaving || dayCodes.isEmpty
            || !PlanDayEditRules.hasChanges(working: dayCodes, initial: initialOrder)
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

    // MARK: 行为

    private func load() async {
        sessionStore.planSaveErrorText = nil // 开编辑即清旧错（防上次失败残留，同 S9）
        let ctx = await Task.detached { SessionStore.loadDaySequenceContext() }.value // 磁盘读 off-main
        guard let ctx else { loaded = true; return }
        draft.reset(codes: ctx.dayCodes)
        initialOrder = ctx.dayCodes
        defaultOrder = ctx.defaultDayCodes
        wasCustomized = ctx.isCustomized
        splitType = ctx.splitType
        completedSessionCount = ctx.completedSessionCount
        loaded = true
    }

    /// 无障碍重排：按 occurrence id 定位，重复 dayCode 不会误移动第一项。
    private func move(rowID: String, by delta: Int) {
        _ = draft.move(rowID: rowID, by: delta)
    }

    private func remove(rowID: String) {
        var didRemove = false
        withAnimation(.easeInOut(duration: 0.2)) {
            didRemove = draft.remove(rowID: rowID)
        }
        if didRemove { removeUndoPulse += 1 }
    }

    private func undoRemoval() {
        var didUndo = false
        withAnimation(.easeInOut(duration: 0.2)) {
            didUndo = draft.undoRemoval()
        }
        if didUndo { removeUndoPulse += 1 }
    }

    /// 恢复默认（暂存化，裁定 C）：只重置工作副本、留在 sheet；「下一个训练日」预览随之实时更新；
    /// 落盘统一走「采纳修改」。
    private func restoreToDefault() {
        withAnimation(.easeInOut(duration: 0.2)) {
            draft.reset(codes: defaultOrder)
        }
        restorePulse += 1   // 恢复默认 = 中震（裁定 B）
    }

    /// UI 实拍钩子。replace/add/remove/open-picker 都只接 canonical dayCode；未知值由 draft/白名单拒绝。
    private func runAutomationHooks(_ args: [String]) async {
        var index = 0
        while index < args.count {
            switch args[index] {
            case "-autoSeqMoveFirstDown":
                if let rowID = draft.rows.first?.id { move(rowID: rowID, by: 1) }
                index += 1
            case "-autoSeqReplace":
                guard args.indices.contains(index + 2) else { index += 1; continue }
                let oldCode = args[index + 1]
                let newCode = args[index + 2]
                if let rowID = draft.rows.first(where: { $0.dayCode == oldCode })?.id {
                    _ = draft.replace(rowID: rowID, with: newCode)
                }
                index += 3
            case "-autoSeqAdd":
                guard args.indices.contains(index + 1) else { index += 1; continue }
                _ = draft.add(dayCode: args[index + 1])
                index += 2
            case "-autoSeqRemove":
                guard args.indices.contains(index + 1) else { index += 1; continue }
                if let rowID = draft.rows.first(where: { $0.dayCode == args[index + 1] })?.id {
                    remove(rowID: rowID)
                }
                index += 2
            case "-autoSeqUndoRemoval":
                undoRemoval()
                index += 1
            case "-autoSeqOpenTypePicker":
                guard args.indices.contains(index + 1) else { index += 1; continue }
                if let rowID = draft.rows.first(where: { $0.dayCode == args[index + 1] })?.id {
                    dayPickerMode = .replace(rowID: rowID)
                }
                index += 2
            case "-autoSeqRestoreDefault":
                restoreToDefault()
                index += 1
            case "-autoApplySeqEdit":
                await apply()
                index += 1
            default:
                index += 1
            }
        }
    }

    /// 采纳收敛（复用 PlanDayEditRules.applyResolution，PlanDayEditModelTests 日序合同锁定）：
    /// 序==默认 且已自定义 → removeCustomDaySequence 清记录（canonical 不留与默认等值的冗余覆盖）；
    /// 序==默认 且未自定义 → 无操作直接关；其余正常写自定义日序。
    private func apply() async {
        switch PlanDayEditRules.applyResolution(working: dayCodes, defaults: defaultOrder, wasCustomized: wasCustomized) {
        case .noop:
            draft.clearUndo()
            applyPulse += 1   // 采纳成功 = success 确认（先于 dismiss 触发）
            dismiss()
        case .clearCustom:
            if await sessionStore.removeCustomDaySequence() {
                draft.clearUndo()
                applyPulse += 1
                onApplied()
                dismiss()
            }
        case .writeCustom:
            if await sessionStore.applyCustomDaySequence(dayCodes) {
                draft.clearUndo()
                applyPulse += 1
                onApplied()
                dismiss()
            }
        }
    }
}

private enum SequenceDayPickerMode: Identifiable {
    case add
    case replace(rowID: String)

    var id: String {
        switch self {
        case .add: return "add"
        case .replace(let rowID): return "replace-\(rowID)"
        }
    }

    var isAdd: Bool {
        if case .add = self { return true }
        return false
    }
}
