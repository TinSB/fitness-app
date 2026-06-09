// swift-tools-version: 5.9
// iOS-12 Native Local Restore + History + Testability Mega Bundle V1 —
// local-only Swift Package. Pure, IO-confined snapshot logic extracted from the
// app target so it can carry REAL unit tests (swift test), matching the repo's
// existing local-package pattern. No remote dependencies, no third-party SwiftPM.
//
// Contents: the Codable local completed-session snapshot model, its schema
// validation, the forward migration (v1 -> current), derived local stats, the
// app-local JSON store (the only disk-touching code — FileManager, sandboxed),
// and the pure restore-to-draft planner. NOTHING here touches Cloud, HealthKit,
// Supabase, network, WebKit, CloudKit/iCloud, UserDefaults, SQLite/CoreData/
// SwiftData, or RedeDomain AppData.

import PackageDescription

let package = Package(
    name: "RedeLocalSnapshot",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeLocalSnapshot", targets: ["RedeLocalSnapshot"]),
    ],
    targets: [
        .target(name: "RedeLocalSnapshot"),
        .testTarget(
            name: "RedeLocalSnapshotTests",
            dependencies: ["RedeLocalSnapshot"]
        ),
    ]
)
