// swift-tools-version: 5.9
// IronPathWidgetShared — W-1 Readiness Widget V1.
//
// Approved capability ungating (master §5/§12/§17/§18, amended by W-1): a home-screen
// WidgetKit widget showing today's readiness / next-training summary, fed by a small
// DERIVED read-only snapshot the app writes to a shared App Group container. The
// widget renders that snapshot; it NEVER writes canonical AppData and is never a
// source of truth (same posture as the LocalSnapshot history record, §12).
//
// This package is the SHARED, Foundation-only home for the pure pieces both the app
// and the widget need: the `ReadinessWidgetSnapshot` model + JSON codec, the pure
// `ReadinessWidgetPresentation` (snapshot → view state, honest placeholder), and the
// `WidgetSnapshotStore` / `WidgetReloading` seams. The real App Group file store
// (`AppGroupWidgetSnapshotStore`, FileManager) and the WidgetKit reloader
// (`WidgetTimelineReloader`, the ONLY WidgetKit importer) are compiled `#if os(iOS)`
// so host `swift test` excludes them; the pure logic carries the unit tests.
//
// Standalone (no other package dependency, no remote SwiftPM): the snapshot carries
// plain Strings, so the package needs no IronPathDomain / TrainingDecision edge
// (master §6.3). See docs/ios-native-migration/IOS_W1_READINESS_WIDGET_V1.md.

import PackageDescription

let package = Package(
    name: "IronPathWidgetShared",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "IronPathWidgetShared", targets: ["IronPathWidgetShared"]),
    ],
    targets: [
        .target(
            name: "IronPathWidgetShared"
        ),
        .testTarget(
            name: "IronPathWidgetSharedTests",
            dependencies: ["IronPathWidgetShared"]
        ),
    ]
)
