// WidgetSnapshotStore + WidgetReloading — W-1 Readiness Widget V1.
//
// The injectable seams between the pure pieces and the real platform. Keeping the
// App Group file IO + the WidgetKit reload behind protocols means the app-layer
// writer + the pure presentation are testable on the host without FileManager /
// WidgetKit (the real impls are `#if os(iOS)`-only).
//
// READ-ONLY-FOR-THE-WIDGET share by design: the widget READS the snapshot; the app
// WRITES it. Neither ever touches canonical AppData — this is a derived presentation
// record (§8/§12). No network, no cloud.

import Foundation

/// Read/write the derived readiness snapshot in the App Group container. `read()`
/// returns nil when no (valid) snapshot exists → the widget shows the honest
/// placeholder. `write(_:)` throws on failure (no fake success).
public protocol WidgetSnapshotStore: Sendable {
    func read() -> ReadinessWidgetSnapshot?
    func write(_ snapshot: ReadinessWidgetSnapshot) throws
}

/// Ask WidgetKit to refresh the widget timelines after a fresh snapshot was written.
/// Abstracted so the app-layer writer needs no WidgetKit import.
public protocol WidgetReloading: Sendable {
    func reloadWidgets()
}
