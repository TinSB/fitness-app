// WidgetTimelineReloader — W-1 Readiness Widget V1.
//
// THE ONLY file in the iOS tree (outside the widget extension target itself) that
// imports WidgetKit. The real `WidgetReloading`: after the app writes a fresh
// snapshot, it asks WidgetKit to refresh the widget timelines so the home-screen
// widget reflects the new readiness promptly.
//
// Compiled `#if os(iOS)` so the host `swift test` toolchain never builds it; the
// app-layer writer uses the `WidgetReloading` seam (no WidgetKit import in the app).
// Reloading a local timeline is purely on-device — no network, no remote push.

#if os(iOS)
import WidgetKit

public struct WidgetTimelineReloader: WidgetReloading {
    /// Optional widget kind to refresh; nil refreshes all of the app's widgets.
    private let kind: String?

    public init(kind: String? = nil) {
        self.kind = kind
    }

    public func reloadWidgets() {
        if let kind {
            WidgetCenter.shared.reloadTimelines(ofKind: kind)
        } else {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
#endif
