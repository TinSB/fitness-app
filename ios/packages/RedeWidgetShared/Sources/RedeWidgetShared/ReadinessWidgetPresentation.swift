// ReadinessWidgetPresentation — W-1 Readiness Widget V1.
//
// The PURE mapping from a (possibly missing) snapshot to the widget's view state.
// No WidgetKit, no SwiftUI, no IO, no clock — `now` is injected so the mapping is
// deterministic and unit-tested. An absent snapshot yields an HONEST placeholder
// (never a fabricated readiness).

import Foundation

/// What the widget view renders. Plain value type the widget target maps 1:1 to
/// SwiftUI text.
public struct ReadinessWidgetViewState: Equatable, Sendable {
    public let headline: String
    public let advice: String
    /// At most the first few snapshot rows (small widgets render a couple).
    public let rows: [ReadinessWidgetRow]
    /// Freshness footnote, e.g. `今日更新` or `更新于 2026-05-30`.
    public let footnote: String
    /// True when there is no snapshot yet — the view shows the honest empty state.
    public let isPlaceholder: Bool

    public init(headline: String, advice: String, rows: [ReadinessWidgetRow], footnote: String, isPlaceholder: Bool) {
        self.headline = headline
        self.advice = advice
        self.rows = rows
        self.footnote = footnote
        self.isPlaceholder = isPlaceholder
    }
}

public enum ReadinessWidgetPresentation {
    /// Max rows a (small) widget renders.
    public static let maxRows = 3

    /// Map a snapshot (or its absence) to the view state. `now` is injected for a
    /// deterministic freshness footnote. `fallbackLocale`（如系统语言码）给 widget 端合成的
    /// 文案（空态 + 新鲜度脚注）选语言；有快照时用快照自带的 locale。
    public static func viewState(
        from snapshot: ReadinessWidgetSnapshot?, now: Date, fallbackLocale: String? = nil
    ) -> ReadinessWidgetViewState {
        let zh = isZh(snapshot?.locale ?? fallbackLocale)
        guard let snapshot else {
            return ReadinessWidgetViewState(
                headline: zh ? "今日准备度" : "Today's readiness",
                advice: zh ? "暂无今日概览" : "No overview yet",
                rows: [],
                footnote: zh ? "打开 Rede 今日页生成" : "Open Rede's Today tab",
                isPlaceholder: true
            )
        }
        return ReadinessWidgetViewState(
            headline: snapshot.headline,
            advice: snapshot.advice,
            rows: Array(snapshot.rows.prefix(maxRows)),
            footnote: footnote(generatedAtIso: snapshot.generatedAtIso, now: now, zh: zh),
            isPlaceholder: false
        )
    }

    /// nil / 非 "zh" 前缀的语言码处理：有前缀 "zh" → 中文；nil → 默认中文（保留无 locale 信息时的历史默认）。
    static func isZh(_ locale: String?) -> Bool { locale?.hasPrefix("zh") ?? true }

    /// `今日更新` / `Updated today`（快照生成于 `now` 的 UTC 日），否则 `更新于 <日期>` / `Updated <日期>`。
    /// 纯 UTC 日前缀比较，不重解析时刻。
    static func footnote(generatedAtIso: String, now: Date, zh: Bool) -> String {
        let isoDay = String(generatedAtIso.prefix(10))
        if isoDay == utcDayString(now) { return zh ? "今日更新" : "Updated today" }
        return zh ? "更新于 \(isoDay)" : "Updated \(isoDay)"
    }

    static func utcDayString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
