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
                    Picker("", selection: $index) {
                        ForEach(Array(snapshots.enumerated()), id: \.offset) { i, snap in
                            Text(tabTitle(snap)).tag(i)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if let current {
                    let model = ShareCardModel.make(from: current, localeStore: localeStore)
                    // 原生 360×450，按可用宽缩放预览。GeometryReader 取真实可用宽（不用 UIScreen，
                    // iPad/分屏安全），外层用 aspectRatio 给它一个 4:5 高度（审查 MINOR）。
                    GeometryReader { geo in
                        let scale = min(1, geo.size.width / ShareCardView.logicalSize.width)
                        ShareCardView(model: model)
                            .scaleEffect(scale, anchor: .topLeading)
                            .frame(width: ShareCardView.logicalSize.width * scale,
                                   height: ShareCardView.logicalSize.height * scale)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .aspectRatio(ShareCardView.logicalSize.width / ShareCardView.logicalSize.height, contentMode: .fit)

                    Button { share() } label: {
                        HStack(spacing: 7) {
                            Image(systemName: "square.and.arrow.up").font(.system(size: 15))
                            Text(s.shareCardShareAction)
                        }
                        .font(.redeBody.weight(.semibold)).foregroundStyle(Color.redeEmber2)
                        .frame(minHeight: RedeShape.controlHeight)
                    }
                    .buttonStyle(.redePressable)
                } else {
                    Text(s.shareCardNothing).font(.redeBody).foregroundStyle(Color.redeT3).padding(.top, 40)
                }
            }
            .padding(20).frame(maxWidth: .infinity)
        }
        .presentationBackground(Color.redeBase)
        .presentationDragIndicator(.visible)
        .sheet(item: $activityImage) { wrap in
            ActivityView(items: [wrap.image, shareText()])
        }
    }

    private func tabTitle(_ snap: ShareSnapshot) -> String {
        switch snap.content {
        case .workoutSummary: return s.shareCardWorkoutTitle
        case .personalRecord: return s.shareCardPRTitle
        case .muscleLevel: return s.shareCardMuscleLevelTitle
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
    ]
}
