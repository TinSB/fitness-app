// IronPathWidgetShared — W-1 Readiness Widget V1.
//
// Created as the SHARED, Foundation-only home for the readiness-widget pieces (master
// §5/§12/§17/§18, amended by W-1). The package owns:
//   • `ReadinessWidgetSnapshot` + `ReadinessWidgetSnapshotCodec` — the small DERIVED
//     read-only snapshot the app writes to the App Group container and the widget
//     reads. Plain Strings + JSON; NOT canonical AppData and never a source of truth.
//   • `ReadinessWidgetPresentation` — pure `snapshot → ReadinessWidgetViewState`
//     mapping with an honest placeholder when no snapshot exists.
//   • `WidgetSnapshotStore` / `WidgetReloading` — the injectable seams.
//   • `AppGroupWidgetSnapshotStore` — the real App Group FileManager store, `#if
//     os(iOS)` (host `swift test` excludes it; tests use a fake / injected snapshot).
//   • `WidgetTimelineReloader` — the ONLY file that imports WidgetKit, `#if os(iOS)`.
//
// HARD BOUNDARIES (still enforced): no network/cloud/account; the App Group file is a
// DERIVED, on-device, read-only-for-the-widget share — the widget NEVER writes
// canonical AppData and the share is NEVER read back as a source of truth (§8/§12).
// `IronPathWidgetSharedTests` lock the codec/store/presentation boundary in Swift.

/// Retained for the iOS-1 bootstrap parity-probe convention every package follows
/// (`Sources/<Pkg>/<Pkg>.swift` exports only this version constant). The real W-1
/// surface lives in the sibling source files in this package.
public enum IronPathWidgetSharedVersion {
    public static let value = "0.0.1-bootstrap"
}
