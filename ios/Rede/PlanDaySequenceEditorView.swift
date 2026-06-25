import SwiftUI
import RedeL10n
import RedeTrainingDecision

// FR-PL7② 训练日顺序编辑器（切片 S10）。从计划页「调整训练日顺序」入口打开：
// 上移/下移重排整周训练日的先后（只重排已有训练日类型，不增删——保 A/B 分化与肌群 2×/周）。
// 护栏：实时预览「下一个训练日将变为 X」（轮转锚定已完成场次，重排会让下一个训练日跳变，诚实告知不阻止）。
// 整面板公理：sheet 内 0 ForgedCard——开放行 + 发丝线 + 单一 ember 主操作（采纳）。
struct PlanDaySequenceEditorView: View {
    let onApplied: () -> Void   // 采纳/恢复后让计划页 reload() 刷新排期

    @Environment(\.dismiss) private var dismiss
    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore

    @State private var dayCodes: [String] = []        // 工作副本（数组顺序 = 训练日先后）
    @State private var initialOrder: [String] = []     // 载入时的顺序（无改动则禁用采纳，免 no-op 写）
    @State private var wasCustomized = false
    @State private var splitType: String?
    @State private var completedSessionCount = 0
    @State private var loaded = false

    // 拖动重排状态（防抖架构：拖动期间**不改数组**，被拖行纯靠偏移跟手、其他行平滑让位，
    // 只在松手落定一次顺序——杜绝"边拖边改数组导致被拖行槽位被父级动画、和跟手偏移打架"的抽动）。
    @State private var draggingCode: String?            // 正在拖动的训练日（nil=没在拖）
    @State private var dragStartIndex: Int?             // 抓起时的原始下标（拖动期间数组不变，故恒定）
    @State private var dragTranslation: CGFloat = 0     // 手指竖向位移 = 被拖行 offset（瞬时跟手，不进 withAnimation）
    @State private var dropTargetIndex = 0              // 当前落点下标（在 withAnimation 里更新 → 让位行平滑开槽）
    @State private var liftPulse = 0                    // 抓起触感脉冲
    @State private var movePulse = 0                    // 每跨一行的轻触感脉冲
    private let rowHeight: CGFloat = RedeShape.controlHeight  // 固定行高 = 落点取整步距

    private var s: RedeStrings { localeStore.strings }

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
                    Text(s.planSeqEditTitle)
                        .font(.redeHeadline).tracking(RedeTracking.headline).foregroundStyle(Color.redeT1)
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
        .task { if !loaded { await load() } }
        .sensoryFeedback(.impact, trigger: liftPulse)     // 抓起一行 = 轻震
        .sensoryFeedback(.selection, trigger: movePulse)  // 每跨一槽 = 轻 tick
    }

    // MARK: 训练日清单（开放行：整行长按拖动重排；上下移留作无障碍动作）

    private var dayList: some View {
        VStack(spacing: 0) {
            ForEach(Array(dayCodes.enumerated()), id: \.element) { idx, code in
                dayRow(idx: idx, code: code)
            }
        }
    }

    private func dayRow(idx: Int, code: String) -> some View {
        let isDragging = draggingCode == code
        // 被拖行：偏移=跟手位移（瞬时）。其他行：偏移=让位空位（被拖行跨过它时让出一个行高，平滑）。
        let yOffset = isDragging ? dragTranslation : gapOffset(forIndex: idx)
        return Text(s.trainingDayName(code))
            .font(.redeBody).foregroundStyle(Color.redeT1)
            .lineLimit(1)   // 行高固定（拖动步距用），训练日名都很短；大字号下截断而非撑破步距数学
            .frame(maxWidth: .infinity, alignment: .leading)
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
        .gesture(reorderGesture(code: code))   // 长按整行拖动重排（见手势注释）
        .accessibilityElement(children: .combine)
        .accessibilityLabel(s.trainingDayName(code))
        // VoiceOver 用户无法用拖动手势（系统会拦截），用自定义动作等价重排。
        // 边界用 if 条件而非 .disabled()——后者在 accessibilityActions 内不抑制动作，
        // 会留下「点了没反应」的死动作（审查共识 BLOCKER）。按 code 实时定位，不依赖捕获的 idx。
        .accessibilityActions {
            if idx > 0 { Button(s.planEditMoveUp) { move(code: code, by: -1) } }
            if idx < dayCodes.count - 1 { Button(s.planEditMoveDown) { move(code: code, by: 1) } }
        }
        .disabled(sessionStore.isSaving)
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
    private func reorderGesture(code: String) -> some Gesture {
        LongPressGesture(minimumDuration: 0.2)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .global))
            .onChanged { value in
                guard case .second(true, let drag) = value else { return }
                if draggingCode != code {                 // 长按抬起瞬间：抓起
                    draggingCode = code
                    dragStartIndex = dayCodes.firstIndex(of: code)
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
                        dayCodes.move(fromOffsets: IndexSet(integer: start),
                                      toOffset: dropTargetIndex > start ? dropTargetIndex + 1 : dropTargetIndex)
                    }
                    draggingCode = nil
                    dragStartIndex = nil
                    dragTranslation = 0
                }
            }
    }

    // MARK: 采纳 / 恢复默认 / 取消

    private var actionRow: some View {
        HStack {
            Button(s.planEditApply) { Task { await apply() } }
                .font(.redeBody.weight(.semibold)).foregroundStyle(Color.redeEmber2)
                .buttonStyle(.redePressable).disabled(sessionStore.isSaving || dayCodes == initialOrder)
            Spacer()
            if wasCustomized {
                Button(s.planEditRestoreDefault) { Task { await restore() } }
                    .font(.redeCaption).foregroundStyle(Color.redeT3)
                    .buttonStyle(.redePressable).disabled(sessionStore.isSaving)
            }
            Button(s.planEditCancel) { dismiss() }
                .font(.redeCaption).foregroundStyle(Color.redeT4)
                .buttonStyle(.redePressable).disabled(sessionStore.isSaving)
        }
    }

    // MARK: 行为

    private func load() async {
        sessionStore.planSaveErrorText = nil // 开编辑即清旧错（防上次失败残留，同 S9）
        let ctx = await Task.detached { SessionStore.loadDaySequenceContext() }.value // 磁盘读 off-main
        guard let ctx else { loaded = true; return }
        dayCodes = ctx.dayCodes
        initialOrder = ctx.dayCodes
        wasCustomized = ctx.isCustomized
        splitType = ctx.splitType
        completedSessionCount = ctx.completedSessionCount
        loaded = true
    }

    /// 无障碍重排：按 code 实时定位当前行再单步 swap（不依赖捕获的 idx，避免拖动期间陈旧）。
    private func move(code: String, by delta: Int) {
        guard let idx = dayCodes.firstIndex(of: code) else { return }
        let target = idx + delta
        guard dayCodes.indices.contains(target) else { return }
        dayCodes.swapAt(idx, target)
    }

    private func apply() async {
        if await sessionStore.applyCustomDaySequence(dayCodes) {
            onApplied()
            dismiss()
        }
    }

    private func restore() async {
        if await sessionStore.removeCustomDaySequence() {
            onApplied()
            dismiss()
        }
    }
}
