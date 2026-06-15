import SwiftUI
import RedeL10n

// Plan — FR-PL1 MVP 诚实占位（用户真机反馈 2026-06-10 修订）。
// PRD 原文：计划功能未上时不要假装有——空状态 = 标题 + 一句解释 + 回今日动作，
// 无任何假数据。M0-2 静态稿的假时间线与假开关（不持久化、无引擎效果）整体下线；
// 完整计划视图（周期 FR-PL2 / 调整建议 FR-PL3 / 回滚 FR-PL4）为 FF，
// 设计目标保留在 rede-app.html #s-plan。
// 页面只展示真数据：来自引导的模板事实行（分化 × 每周天数）。

struct PlanTabView: View {
    let onGoToday: () -> Void

    @Environment(LocaleStore.self) private var localeStore
    @State private var template: SessionStore.TemplateFacts?

    private var s: RedeStrings { localeStore.strings }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: s.planTitle)

                if let facts = template, let split = facts.splitType,
                   let days = facts.daysPerWeek, let goal = facts.goal {
                    // 真计划摘要（分化 · 天数 · 目标 + 背景 · 器械）——重做 2026-06-15「密而干净」
                    VStack(alignment: .leading, spacing: 10) {
                        Text(s.onbVerdict(splitCode: split, days: days, goalCode: goal))
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
        .task { template = await Task.detached { SessionStore.loadTemplateFacts() }.value }
    }

    /// 背景 · 器械（真数据，引导选项标题）；缺则 nil。
    private func planContextLine(_ facts: SessionStore.TemplateFacts) -> String? {
        var parts: [String] = []
        if let level = facts.level { parts.append(s.onbLevelOption(level).title) }
        if let equip = facts.equipment { parts.append(s.onbEquipOption(equip).title) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

#Preview {
    PlanTabView(onGoToday: {})
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
