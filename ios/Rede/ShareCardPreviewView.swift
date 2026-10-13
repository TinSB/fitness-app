import SwiftUI
import UIKit
import RedeL10n
import RedeLocalSnapshot

// FR-SH1 S0 分享卡预览 + 分享。展示渲染好的 4:5 卡（破 PR 时可在"训练总结/个人纪录"间切），
// 「分享」走 iOS 系统 Share Sheet（图片 + 文案）。§9.4：用户主动触发、所见即所得、绝不自动发布。
struct ShareCardPreviewView: View {
    let snapshots: [ShareSnapshot]

    @Environment(\.dismiss) private var dismiss
    @Environment(LocaleStore.self) private var localeStore
    @State private var index: Int = {
        // 截图钩子（沿 -progressScale 先例）：预选卡页验证非首卡渲染，不影响真实用户
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-sharePreviewIndex"),
              args.indices.contains(i + 1), let value = Int(args[i + 1]) else { return 0 }
        return max(0, value)
    }()
    @State private var activityImage: ShareImage?

    private var s: RedeStrings { localeStore.strings }
    private var current: ShareSnapshot? { snapshots.indices.contains(index) ? snapshots[index] : nil }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                if snapshots.count > 1 {
                    // 与进展页 / 设置页同一个分段键（不用系统 segmented Picker）。SegControl 以标题为键，
                    // 所以 tabTitle 必须两两不同（实测 / 估算两张里程碑卡各有各的页签）。
                    SegControl(options: snapshots.map(tabTitle), selection: tabSelection)
                }

                if let current {
                    let model = ShareCardModel.make(from: current, localeStore: localeStore)
                    // 原生 360×450，按可用宽等比缩放（放大也行，卡边落在页边距上，与切换条同宽）。
                    // 只缩放预览这一层：导出 PNG 走 ShareCardRenderer，固定 360×450 ×3，不经过这里。
                    // GeometryReader 取真实可用宽（不用 UIScreen，iPad/分屏安全），外层用 aspectRatio
                    // 给它一个 4:5 高度（审查 MINOR）。
                    GeometryReader { geo in
                        let scale = geo.size.width / ShareCardView.logicalSize.width
                        let shape = RoundedRectangle(cornerRadius: RedeShape.cardRadiusL, style: .continuous)
                        ShareCardView(model: model)
                            .scaleEffect(scale, anchor: .topLeading)
                            // topLeading：缩放以左上角为锚，布局框也必须贴左上，否则放大后整张卡被居中偏移。
                            .frame(width: ShareCardView.logicalSize.width * scale,
                                   height: ShareCardView.logicalSize.height * scale,
                                   alignment: .topLeading)
                            // 卡底色与 sheet 底同为 redeBase，没有边界就读成「页内缩进的字」：
                            // 预览层给它一圈连续圆角 + 1pt 发丝描边（卡本体与导出图不动）。
                            .clipShape(shape)
                            .overlay(shape.strokeBorder(Color.redeHair, lineWidth: 1))
                    }
                    .aspectRatio(ShareCardView.logicalSize.width / ShareCardView.logicalSize.height, contentMode: .fit)
                } else {
                    Text(s.shareCardNothing).font(.redeBody).foregroundStyle(Color.redeT3).padding(.top, 40)
                }
            }
            .padding(RedeSpace.page).frame(maxWidth: .infinity)
        }
        // 主操作固定在底部（sheet 内没有 tab bar）。按钮本身无条件存在（无内容时点击为空操作，share() 内有 guard），
        // 所以 inset 首帧就是真实高度，不会有「带条件内容首帧 inset=0」的问题（见 FloatingPrimaryCTA 头注）。
        .safeAreaInset(edge: .bottom, spacing: 0) {
            EmbButton(icon: "square.and.arrow.up", title: s.shareCardShareAction) { share() }
                .padding(.horizontal, RedeSpace.page)
                .padding(.top, RedeSpace.floatingCTATop)
                .padding(.bottom, RedeSpace.page)
                .background(Color.redeBase)
        }
        .presentationBackground(Color.redeBase)
        .presentationDragIndicator(.visible)
        .sheet(item: $activityImage) { wrap in
            ActivityView(items: [wrap.image, shareText()])
        }
    }

    /// SegControl 以标题字符串做选中键；这里把它映射回快照下标。
    private var tabSelection: Binding<String> {
        Binding(
            get: { snapshots.indices.contains(index) ? tabTitle(snapshots[index]) : "" },
            set: { picked in
                if let i = snapshots.firstIndex(where: { tabTitle($0) == picked }) { index = i }
            }
        )
    }

    private func tabTitle(_ snap: ShareSnapshot) -> String {
        switch snap.content {
        case .workoutSummary: return s.shareCardWorkoutTitle
        case .personalRecord: return s.shareCardPRTitle
        case .muscleLevel: return s.shareCardMuscleLevelTitle
        case .levelUp: return s.shareCardLevelUpTitle
        case .balanceImprovement: return s.shareCardBalanceTitle
        case .strengthMilestone(let milestone):
            // 实测与估算合并的里程碑行产出两张卡，页签标题必须区分。
            return milestone.isEstimated ? s.shareCardMilestoneEstimatedTab : s.shareCardMilestoneMeasuredTab
        }
    }

    private func share() {
        guard let current else { return }
        let model = ShareCardModel.make(from: current, localeStore: localeStore)
        activityImage = ShareCardRenderer.render(model).map(ShareImage.init)
    }

    /// 分享文案：标语 + 下载入口（有 App Store URL 用 URL，否则用"搜索 Rede"提示）。
    private func shareText() -> String {
        if let url = ShareLinks.appStoreURL { return "\(s.shareCardTagline)\n\(url.absoluteString)" }
        return "\(s.shareCardTagline)\n\(s.shareCardDownloadHint)"
    }
}

// MARK: - 系统 Share Sheet 包装（图片 + 文案 → UIActivityViewController）

private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

// UIImage 的 Identifiable 包装（驱动 .sheet(item:)，避免对 UIImage 做 retroactive conformance）。
private struct ShareImage: Identifiable { let id = UUID(); let image: UIImage }

// MARK: - 截图验证样本（仅 -autoOpenSharePreview 钩子用；非生产路径）

enum ShareCardSample {
    static let snapshots: [ShareSnapshot] = [
        SharePrivacyFilter.workoutSummary(
            generatedDateISO: "2026-06-24", dayCode: "push-a", exerciseCount: 5, setCount: 18,
            durationSeconds: 67 * 60, patterns: ["horizontal-press", "incline-press", "fly", "lateral-raise", "triceps-extension"], hadPR: true),
        SharePrivacyFilter.personalRecord(
            generatedDateISO: "2026-06-24", exerciseId: "bench-press", weightKg: 102.5, reps: 5,
            isEstimated: false),
        SharePrivacyFilter.muscleLevel(
            generatedDateISO: "2026-06-24", tierRaw: "intermediate", balanceScore: 76,
            muscles: [
                .init(muscleRaw: "chest", level: 12, trendRaw: "rising"),
                .init(muscleRaw: "back", level: 11, trendRaw: "stable"),
                .init(muscleRaw: "quads", level: 10, trendRaw: "rising"),
                .init(muscleRaw: "shoulders", level: 9, trendRaw: "stable"),
                .init(muscleRaw: "glutes", level: 9, trendRaw: "stable"),
                .init(muscleRaw: "hamstrings", level: 8, trendRaw: "declining"),
            ]),
        SharePrivacyFilter.levelUp(
            generatedDateISO: "2026-07-29",
            changes: [
                .init(muscleRaw: "back", fromLevel: 8, toLevel: 9,
                      fromTierRaw: nil, toTierRaw: nil),
            ],
            totalChangeCount: 1,
            recentTrainingDays: 9),
        SharePrivacyFilter.balanceImprovement(
            generatedDateISO: "2026-07-29",
            fromScore: 71,
            toScore: 82,
            improvingMuscleRaws: ["back", "quads"]),
        SharePrivacyFilter.strengthMilestone(
            generatedDateISO: "2026-07-29",
            exerciseId: "bench-press",
            achievedThreshold: 100,
            unitLabel: "kg",
            isEstimated: true),
    ]
}
