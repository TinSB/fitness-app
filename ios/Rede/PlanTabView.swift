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
                ScreenHeader(
                    title: s.planTitle,
                    subtitle: template.flatMap { facts in
                        facts.splitType.map {
                            s.planTemplateLine(splitName: s.onbSplitName($0), days: facts.daysPerWeek ?? 0)
                        }
                    }
                )

                // 整面板（2026-06-11）：空态开放式直落 base（与 Progress/Train 空态语法统一）
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
            .padding(.bottom, 78)
        }
        .background(Color.redeBase)
        .task { template = await Task.detached { SessionStore.loadTemplateFacts() }.value }
    }
}

#Preview {
    PlanTabView(onGoToday: {})
        .environment(LocaleStore())
        .background(Color.redeBase)
        .preferredColorScheme(.dark)
}
