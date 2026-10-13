// ReadinessWidget — W-1 Readiness Widget V1.
//
// The home-screen widget: a TimelineProvider that READS the derived readiness
// snapshot from the shared App Group (via the RedeWidgetShared
// `WidgetSnapshotStore` seam → the `#if os(iOS)` `AppGroupWidgetSnapshotStore`),
// maps it to a view state with the PURE `ReadinessWidgetPresentation`, and renders
// it. READ-ONLY: it never writes the snapshot, never writes canonical AppData, and
// never touches the network — it only renders a derived presentation record (§12).
// An absent/unreadable snapshot shows the honest placeholder.

import SwiftUI
import WidgetKit
import RedeWidgetShared

/// One timeline entry = a rendered view state at an instant.
struct ReadinessWidgetEntry: TimelineEntry {
    let date: Date
    let viewState: ReadinessWidgetViewState
    /// 顶部 overline（「今日」/「TODAY」）。语言与 viewState 同源（快照自带的 App 语言，缺省退回系统语言），
    /// 免得 App 语言与系统语言不同时 overline 与标题中英混排。
    let overline: String
}

/// Reads the App Group snapshot and produces entries. The pure mapping lives in the
/// package; this provider is the thin WidgetKit integration.
struct ReadinessWidgetProvider: TimelineProvider {
    private let store: WidgetSnapshotStore

    init(store: WidgetSnapshotStore = AppGroupWidgetSnapshotStore()) {
        self.store = store
    }

    func placeholder(in context: Context) -> ReadinessWidgetEntry {
        makeEntry(snapshot: nil, now: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (ReadinessWidgetEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ReadinessWidgetEntry>) -> Void) {
        let entry = currentEntry()
        // Readiness is a daily-ish concept; refresh roughly hourly. The app ALSO
        // asks WidgetKit to reload when it writes a fresh snapshot, so this is just
        // the fallback cadence.
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: entry.date)
            ?? entry.date.addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func currentEntry() -> ReadinessWidgetEntry {
        makeEntry(snapshot: store.read(), now: Date())
    }

    private func makeEntry(snapshot: ReadinessWidgetSnapshot?, now: Date) -> ReadinessWidgetEntry {
        ReadinessWidgetEntry(
            date: now,
            viewState: ReadinessWidgetPresentation.viewState(from: snapshot, now: now, fallbackLocale: WidgetLocale.code),
            overline: WidgetLocale.overline(snapshotLocale: snapshot?.locale)
        )
    }
}

/// The widget's SwiftUI view — renders the view state verbatim. No logic.
///
/// 视觉（2026-10 视觉对齐）：锻铁暗底 + 仪表字阶，与 App / 休息 Live Activity 同一套令牌（WidgetPalette）。
/// · 顶部 overline（11 medium 大写字距 T4）→ 状态行（17 semibold T1，可两行）→ 说明（12 T3）→
///   肌群读数（数值 semibold T1 在左、标签 T3 小一档紧挨）→ 脚注（T4）。
/// · Small 竖排；Medium 是两栏：左判断 + 说明，右肌群读数列，中间一条 hair 刻线。
/// · 不画 ember 左缘：它要按「今天该不该练」决定，而快照只有已渲染好的本地化文案、没有状态码，
///   做它要扩快照契约（另立项）。
/// · 非 .fullColor（iOS 18 着色 / 透明模式，系统会剥掉自定义背景并把前景染成单色）退回系统容器背景
///   与系统前景，保证可读。
struct ReadinessWidgetEntryView: View {
    let entry: ReadinessWidgetEntry

    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    // 字号随系统字号档缩放，但外层把档位封顶在 large（见 ReadinessWidget）：小字号档照缩，
    // 大字号档不撑爆 2×2 / 4×2 的固定画布。
    @ScaledMetric(relativeTo: .caption2) private var microSize: CGFloat = 11     // overline / 脚注 / 肌群标签
    @ScaledMetric(relativeTo: .caption) private var detailSize: CGFloat = 12     // 说明
    @ScaledMetric(relativeTo: .headline) private var statusSize: CGFloat = 17    // 状态行
    @ScaledMetric(relativeTo: .subheadline) private var readingSize: CGFloat = 16 // 肌群数值

    private var state: ReadinessWidgetViewState { entry.viewState }
    private var fullColor: Bool { renderingMode == .fullColor }
    private var t1: Color { fullColor ? WidgetPalette.t1 : .primary }
    private var t3: Color { fullColor ? WidgetPalette.t3 : .secondary }
    private var t4: Color { fullColor ? WidgetPalette.t4 : Color.secondary.opacity(0.75) }
    private var rule: Color { fullColor ? WidgetPalette.hair : Color.secondary.opacity(0.3) }

    var body: some View {
        Group {
            if family == .systemMedium { medium } else { small }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { background }
    }

    // MARK: - 背景

    /// 锻面：raised→surface 极微垂直渐变 + 1px 顶缘渐变高光（与手机 ForgedCard 同一材质写法，无可见光晕）。
    @ViewBuilder private var background: some View {
        if fullColor {
            ZStack {
                LinearGradient(colors: [WidgetPalette.raised, WidgetPalette.surface], startPoint: .top, endPoint: .bottom)
                ContainerRelativeShape()
                    .strokeBorder(
                        LinearGradient(colors: [WidgetPalette.t1.opacity(0.085), WidgetPalette.t1.opacity(0.012)],
                                       startPoint: .top, endPoint: .bottom),
                        lineWidth: 1)
            }
        } else {
            ContainerRelativeShape().fill(.fill.tertiary)
        }
    }

    // MARK: - 家族布局

    /// Small：竖排。肌群读数是被动上下文（设计语言 §7），高度不够就先让位——2×2 在小屏机型上
    /// 内容高只有 ~110pt，英文长训练日名折两行时放不下读数；ViewThatFits 按「两行 → 一行 → 无」依次试。
    private var small: some View {
        ViewThatFits(in: .vertical) {
            smallStack(rowLimit: 2)
            smallStack(rowLimit: 1)
            smallStack(rowLimit: 0)
        }
    }

    private func smallStack(rowLimit: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            overline
            status.padding(.top, 6)
            advice.padding(.top, 3)
            let rows = Array(state.rows.prefix(rowLimit))
            if !rows.isEmpty {
                readings(rows, spacing: 4).padding(.top, 8)
            }
            Spacer(minLength: 6)
            footnote
        }
    }

    /// Medium：左判断 + 说明 + 脚注，右肌群读数列（没有读数时左栏独占整宽）。
    private var medium: some View {
        let rows = Array(state.rows.prefix(2))
        return HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                overline
                status.padding(.top, 6)
                advice.padding(.top, 3)
                Spacer(minLength: 6)
                footnote
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if !rows.isEmpty {
                Rectangle().fill(rule).frame(width: 1).padding(.horizontal, 16)
                readings(rows, spacing: 10)
                    .fixedSize(horizontal: true, vertical: false)
                    .frame(maxHeight: .infinity, alignment: .center)
            }
        }
    }

    // MARK: - 部件

    private var overline: some View {
        Text(entry.overline)
            .textCase(.uppercase)
            .font(.system(size: microSize, weight: .medium))
            .tracking(1.98)   // = RedeTracking.overline（0.18em × 11）
            .foregroundStyle(t4)
            .lineLimit(1)
    }

    private var status: some View {
        Text(state.headline)
            .font(.system(size: statusSize, weight: .semibold))
            .foregroundStyle(t1)
            .lineLimit(2)
            .minimumScaleFactor(0.8)
    }

    private var advice: some View {
        Text(state.advice)
            .font(.system(size: detailSize))
            .foregroundStyle(t3)
            .lineLimit(2)
    }

    private var footnote: some View {
        Text(state.footnote)
            .font(.system(size: microSize))
            .foregroundStyle(t4)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }

    /// 肌群读数：数值（semibold T1、等宽数字）在左，标签（T3、小一档）紧挨其后——不拿 Spacer 撑到两端。
    private func readings(_ rows: [ReadinessWidgetRow], spacing: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: spacing) {
            ForEach(rows, id: \.label) { row in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(row.value)
                        .font(.system(size: readingSize, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(t1)
                    Text(row.label)
                        .font(.system(size: microSize))
                        .foregroundStyle(t3)
                }
                .lineLimit(1)
                // 视觉上数值在前、标签在后，念出来仍是「标签 数值」的完整句。
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(row.label) \(row.value)")
            }
        }
    }
}

/// Widget extension 不链接 RedeL10n——这里按系统语言给 widget 自带文案（空态/脚注/画廊名）选语言。
/// 内容文案（headline/advice）已由主 App 经 RedeL10n 写进快照、本处不管。
enum WidgetLocale {
    static var code: String? { Locale.current.language.languageCode?.identifier }
    static var isZh: Bool { code?.hasPrefix("zh") ?? true }
    /// 顶部 overline：优先跟快照里 App 的语言，缺省退回系统语言（与 ReadinessWidgetPresentation 同一取舍）。
    static func overline(snapshotLocale: String?) -> String {
        (snapshotLocale.map { $0.hasPrefix("zh") } ?? isZh) ? "今日" : "TODAY"
    }
    static var galleryName: String { isZh ? "今日准备度" : "Today's readiness" }
    static var galleryDescription: String {
        isZh ? "查看今日训练准备度与下一次训练概览（只读 · 本机）。"
             : "See today's training readiness and your next session at a glance (read-only · on-device)."
    }
}

struct ReadinessWidget: Widget {
    let kind = "RedeReadinessWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ReadinessWidgetProvider()) { entry in
            // 字号档封顶 large：固定画布放不下更大的字（ReadinessWidgetEntryView 的 @ScaledMetric 只在小档位起作用）。
            ReadinessWidgetEntryView(entry: entry)
                .dynamicTypeSize(...DynamicTypeSize.large)
        }
        .configurationDisplayName(WidgetLocale.galleryName)
        .description(WidgetLocale.galleryDescription)
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
