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

    // 长按拖动重排状态（替代旧的上移/下移箭头，实机手感更好；上下移保留为无障碍动作）。
    @State private var draggingCode: String?           // 正在拖动的训练日
    @State private var dragOffset: CGFloat = 0          // 拖动行相对其当前槽位的视觉偏移
    @State private var consumedShift: CGFloat = 0       // 已通过整槽移动「消费」的偏移（让手指黏住行）
    @State private var liftPulse = 0                    // 长按抬起触感脉冲
    @State private var movePulse = 0                    // 每跨一槽的轻触感脉冲
    private let rowHeight: CGFloat = RedeShape.controlHeight  // 固定行高 = 拖动每槽步距（取模/round 用）

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

    // MARK: 训练日清单（开放行：名 + 拖动手柄；拖动重排，上下移留作无障碍动作）

    private var dayList: some View {
        VStack(spacing: 0) {
            ForEach(Array(dayCodes.enumerated()), id: \.element) { idx, code in
                dayRow(idx: idx, code: code)
            }
        }
    }

    private func dayRow(idx: Int, code: String) -> some View {
        let isDragging = draggingCode == code
        return HStack(spacing: 12) {
            Text(s.trainingDayName(code))
                .font(.redeBody).foregroundStyle(Color.redeT1)
                .lineLimit(1)   // 行高固定（拖动步距用），训练日名都很短；大字号下截断而非撑破步距数学
                .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "line.3.horizontal")    // 拖动手柄：抓住这里即可拖动重排
                .font(.redeCaption).foregroundStyle(Color.redeT3)
                .frame(width: 44, height: rowHeight)   // 44pt 触控区，好抓
                .contentShape(Rectangle())
                // 手势只挂手柄：拖手柄=重排；拖行内别处/面板别处=系统照常滚动 + 下滑关闭面板
                // （审查 MAJOR：挂整行的 highPriorityGesture 会吞掉 sheet 下滑关闭手势）。
                .highPriorityGesture(reorderGesture(code: code))
                .accessibilityHidden(true)            // 装饰；重排无障碍走下面的 accessibilityActions
        }
        .frame(height: rowHeight)
        .background(isDragging ? Color.redeBase : Color.clear)  // 抬起时不透明，盖住相邻行与发丝线
        .overlay(alignment: .top) {
            if idx > 0 && !isDragging { Rectangle().fill(Color.redeHair2).frame(height: 1) }
        }
        .contentShape(Rectangle())
        .shadow(color: Color.black.opacity(isDragging ? 0.32 : 0),
                radius: isDragging ? 8 : 0, y: isDragging ? 4 : 0)  // 阴影=抬起感（不缩放，遵动效守卫）
        .offset(y: isDragging ? dragOffset : 0)
        .zIndex(isDragging ? 1 : 0)
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

    /// 拖动重排——**碰到手柄就能拖，无长按延迟**（实机反馈长按手感差：要先按住、手指一早动就识别失败）。
    /// 手势只挂在右侧手柄上（见 dayRow）：拖手柄=重排，面板下滑关闭/滚动不受影响。
    /// 每拖过「半个行高」就实时把该行挪一槽并补偿偏移让它黏在手指下；while 逐槽兜住快速拖动不跳格，
    /// 半行死区做迟滞防抖。minimumDistance 6 让纯点击不误抬起（要真拖一点才抓起）。
    /// 注：VoiceOver 开启时系统会拦截此手势，重排走 accessibilityActions（已知降级，非 bug）。
    private func reorderGesture(code: String) -> some Gesture {
        DragGesture(minimumDistance: 6)
            .onChanged { drag in
                if draggingCode != code {                 // 第一次移动即抓起
                    draggingCode = code; consumedShift = 0; dragOffset = 0; liftPulse += 1
                }
                dragOffset = drag.translation.height - consumedShift
                // 向下越过半行：逐槽下移（from→from+2 落到 from+1），每移一槽补偿一个行高。
                while dragOffset > rowHeight * 0.5,
                      let from = dayCodes.firstIndex(of: code), from < dayCodes.count - 1 {
                    withAnimation(.spring(response: 0.26, dampingFraction: 0.82)) {
                        dayCodes.move(fromOffsets: IndexSet(integer: from), toOffset: from + 2)
                    }
                    consumedShift += rowHeight; dragOffset -= rowHeight; movePulse += 1
                }
                // 向上越过半行：逐槽上移（from→from-1）。
                while dragOffset < -rowHeight * 0.5,
                      let from = dayCodes.firstIndex(of: code), from > 0 {
                    withAnimation(.spring(response: 0.26, dampingFraction: 0.82)) {
                        dayCodes.move(fromOffsets: IndexSet(integer: from), toOffset: from - 1)
                    }
                    consumedShift -= rowHeight; dragOffset += rowHeight; movePulse += 1
                }
            }
            .onEnded { _ in
                withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) { dragOffset = 0 }
                draggingCode = nil; consumedShift = 0
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
