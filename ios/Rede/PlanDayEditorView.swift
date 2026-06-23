import SwiftUI
import RedeL10n
import RedeDomain
import RedeTrainingDecision

// FR-PL6/PL7① 训练日编辑器（切片 S9）。从计划页点训练日下钻：
// 增删换动作 + 同日内上移/下移重排 → 预览肌群频率影响（护栏：提示不强制）→ 采纳 / 恢复默认。
// 定位「编辑教练给的计划」：起点 = 该日默认处方；引擎仍算重量/进阶（决策在前不破坏）。
// 整面板公理：sheet 内 0 ForgedCard——开放行 + 发丝线 + 单一 ember 主操作（采纳）。

struct PlanDayEditorView: View {
    let dayCode: String
    let onApplied: () -> Void   // 采纳/恢复后让计划页 reload() 刷新派生

    @Environment(\.dismiss) private var dismiss
    @Environment(LocaleStore.self) private var localeStore
    @Environment(SessionStore.self) private var sessionStore

    @State private var exerciseIds: [String] = []     // 工作副本（数组顺序 = 训练顺序）
    @State private var wasCustomized = false
    @State private var scenario: String?
    @State private var impact: PlanCustomizationImpact.Summary?
    @State private var swapTarget: String?            // 正在换的动作 id（驱动候选 sheet）
    @State private var loaded = false
    @State private var impactTask: Task<Void, Never>? // 取消上一次影响计算，防乱序覆盖（审查 MINOR）

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: RedeSpace.section) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(s.trainingDayName(dayCode))
                        .font(.redeHeadline).tracking(RedeTracking.headline).foregroundStyle(Color.redeT1)
                    Text(s.planEditSubtitle)
                        .font(.redeCaption).foregroundStyle(Color.redeT3)
                        .fixedSize(horizontal: false, vertical: true)
                }

                exerciseList

                // 「添加新动作」需完整动作选择器（按场景/肌群过滤）——留作 S9b；本片支持
                // 重排 + 换动作（同族替换=改这天练什么）+ 移除 + 恢复默认，已覆盖核心编辑。

                impactSection

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
        .sheet(item: Binding(get: { swapTarget.map(SwapPick.init) }, set: { swapTarget = $0?.id })) { pick in
            swapSheet(for: pick.id)
        }
    }

    // MARK: 动作清单（开放行：名 + 上移/下移/换/移除）

    private var exerciseList: some View {
        VStack(alignment: .leading, spacing: 0) {
            if exerciseIds.isEmpty {
                Text(s.planEditEmptyDay).font(.redeBody).foregroundStyle(Color.redeT3)
                    .padding(.vertical, 8)
            } else {
                ForEach(Array(exerciseIds.enumerated()), id: \.element) { idx, id in
                    VStack(spacing: 0) {
                        if idx > 0 { Rectangle().fill(Color.redeHair2).frame(height: 1) }
                        HStack(spacing: 12) {
                            Text(localeStore.exerciseName(id))
                                .font(.redeBody).foregroundStyle(Color.redeT1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            // label 含动作名，VoiceOver 能分辨在操作哪个动作（审查 MINOR，与顺序编辑器一致）。
                            iconButton("chevron.up", s.planEditMoveUp + " " + localeStore.exerciseName(id), enabled: idx > 0) { move(idx, by: -1) }
                            iconButton("chevron.down", s.planEditMoveDown + " " + localeStore.exerciseName(id), enabled: idx < exerciseIds.count - 1) { move(idx, by: 1) }
                            iconButton("arrow.left.arrow.right", s.planEditSwap + " " + localeStore.exerciseName(id)) { swapTarget = id }
                            iconButton("minus.circle", s.planEditRemove + " " + localeStore.exerciseName(id)) { remove(id) }
                        }
                        .frame(minHeight: RedeShape.controlHeight)
                    }
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

    // MARK: 采纳 / 恢复默认 / 取消

    private var actionRow: some View {
        HStack {
            Button(s.planEditApply) { Task { await apply() } }
                .font(.redeBody.weight(.semibold)).foregroundStyle(Color.redeEmber2)
                .buttonStyle(.redePressable).disabled(sessionStore.isSaving || exerciseIds.isEmpty)
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

    // MARK: 行为

    private func load() async {
        sessionStore.planSaveErrorText = nil // 开编辑即清旧错（防上次失败残留到本次，审查 M-2）
        let dc = dayCode
        let ctx = await Task.detached { SessionStore.loadDayEditorContext(dayCode: dc) }.value // 磁盘读 off-main
        guard let ctx else { loaded = true; return }
        // 去重保序：防历史写入含重复 id 时 ForEach(\.element) 渲染错乱（审查 M-3）。
        var seen = Set<String>()
        exerciseIds = ctx.currentExerciseIds.filter { seen.insert($0).inserted }
        wasCustomized = ctx.isCustomized
        scenario = ctx.equipmentScenario
        recomputeImpact()
        loaded = true
    }

    private func move(_ idx: Int, by delta: Int) {
        let target = idx + delta
        guard exerciseIds.indices.contains(idx), exerciseIds.indices.contains(target) else { return }
        exerciseIds.swapAt(idx, target)
        recomputeImpact()
    }

    private func remove(_ id: String) {
        exerciseIds.removeAll { $0 == id }
        recomputeImpact()
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

    private func apply() async {
        let items = exerciseIds.map { CustomExerciseItem(exerciseId: $0) }
        if await sessionStore.applyCustomDayPlan(dayCode: dayCode, exercises: items) {
            onApplied()
            dismiss()
        }
    }

    private func restore() async {
        if await sessionStore.removeCustomDayPlan(dayCode: dayCode) {
            onApplied()
            dismiss()
        }
    }
}

/// `.sheet(item:)` 需要 Identifiable 包装裸 String。
private struct SwapPick: Identifiable { let id: String }
