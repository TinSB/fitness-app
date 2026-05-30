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
    /// deterministic freshness footnote.
    public static func viewState(from snapshot: ReadinessWidgetSnapshot?, now: Date) -> ReadinessWidgetViewState {
        guard let snapshot else {
            return ReadinessWidgetViewState(
                headline: "今日准备度",
                advice: "暂无今日概览",
                rows: [],
                footnote: "打开 IronPath 今日页生成",
                isPlaceholder: true
            )
        }
        return ReadinessWidgetViewState(
            headline: snapshot.headline,
            advice: snapshot.advice,
            rows: Array(snapshot.rows.prefix(maxRows)),
            footnote: footnote(generatedAtIso: snapshot.generatedAtIso, now: now),
            isPlaceholder: false
        )
    }

    /// `今日更新` when the snapshot was generated on `now`'s UTC day, else
    /// `更新于 <YYYY-MM-DD>`. Pure string compare of UTC-day prefixes — no fragile
    /// re-parse of the stored instant.
    static func footnote(generatedAtIso: String, now: Date) -> String {
        let isoDay = String(generatedAtIso.prefix(10))
        return isoDay == utcDayString(now) ? "今日更新" : "更新于 \(isoDay)"
    }

    static func utcDayString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
