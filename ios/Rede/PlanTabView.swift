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
    @State private var template: SessionStore.TemplateFacts?
    @State private var cycle: MesocycleCycleState?

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

                    if let cycle {
                        // FR-PL2 S5：真周期条（周期化开启且有真历史时）
                        MesocycleCycleBar(state: cycle, s: s)
                            .padding(.horizontal, RedeSpace.page)
                            .padding(.top, 8)

                        VStack(alignment: .leading, spacing: 12) {
                            Text(s.planCycleNote)
                                .font(.redeCallout)
                                .foregroundStyle(Color.redeT3)
                            EmbButton(icon: "arrow.left", title: s.trainEmptyAction, action: onGoToday)
                                .padding(.top, 4)
                        }
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 16)
                    } else {
                        // 诚实占位：排期/周期/调整待计划引擎（FR-PL1：不编数据）
                        VStack(alignment: .leading, spacing: 12) {
                            Text(s.planEmptyNote)
                                .font(.redeCallout)
                                .foregroundStyle(Color.redeT3)
                            EmbButton(icon: "arrow.left", title: s.trainEmptyAction, action: onGoToday)
                                .padding(.top, 4)
                        }
                        .padding(.horizontal, RedeSpace.page)
                        .padding(.top, 8)
                    }
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
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
        .task {
            // 一次后台读返回两者、同步一起赋值（审查 MINOR-1）：避免 template 先到、cycle 仍 nil 时
            // 闪一帧诚实占位再跳出周期条——已开周期化的用户不应看到占位闪变。
            let loaded = await Task.detached {
                (SessionStore.loadTemplateFacts(), SessionStore.loadCycleState())
            }.value
            template = loaded.0
            cycle = loaded.1
        }
    }

    /// 背景 · 器械（真数据，引导选项标题）；缺则 nil。
    private func planContextLine(_ facts: SessionStore.TemplateFacts) -> String? {
        var parts: [String] = []
        if let level = facts.level { parts.append(s.onbLevelOption(level).title) }
        if let equip = facts.equipment { parts.append(s.onbEquipOption(equip).title) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

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

            Text(s.planCycleWeekOf(
                week: state.currentWeekInBlock + 1,
                total: state.blockLengthWeeks,
                phaseLabel: s.mesoPhaseShort(state.currentPhase.rawValue)
            ))
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
