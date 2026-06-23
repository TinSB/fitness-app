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
    }

    // MARK: 训练日清单（开放行：名 + 上移/下移）

    private var dayList: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(dayCodes.enumerated()), id: \.element) { idx, code in
                VStack(spacing: 0) {
                    if idx > 0 { Rectangle().fill(Color.redeHair2).frame(height: 1) }
                    HStack(spacing: 12) {
                        Text(s.trainingDayName(code))
                            .font(.redeBody).foregroundStyle(Color.redeT1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        // label 含训练日名，VoiceOver 能分辨在移动哪一天（审查 MINOR）。
                        iconButton("chevron.up", s.planEditMoveUp + " " + s.trainingDayName(code), enabled: idx > 0) { move(idx, by: -1) }
                        iconButton("chevron.down", s.planEditMoveDown + " " + s.trainingDayName(code), enabled: idx < dayCodes.count - 1) { move(idx, by: 1) }
                    }
                    .frame(minHeight: RedeShape.controlHeight)
                }
            }
        }
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

    private func move(_ idx: Int, by delta: Int) {
        let target = idx + delta
        guard dayCodes.indices.contains(idx), dayCodes.indices.contains(target) else { return }
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
