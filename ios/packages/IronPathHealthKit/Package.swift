// swift-tools-version: 5.9
// IronPathHealthKit — HK-1 HealthKit Body-Weight Import V1.
//
// Activated from the iOS-1 inert stub into an APPROVED, read-only Apple-Health
// adapter (master §6.2/§17/§18, amended by HK-1). Depends on IronPathDomain via
// LOCAL path so the pure mapper can produce canonical `HealthMetricSample`
// values. No remote dependencies. No third-party SwiftPM. The real HKHealthStore
// reader compiles only on iOS (`#if os(iOS)` in HealthKitBodyMassSource.swift);
// the pure mapper + protocol seam carry the unit tests. See
// docs/ios-native-migration/IOS_HK1_HEALTHKIT_BODYWEIGHT_IMPORT_V1.md.

import PackageDescription

let package = Package(
    name: "IronPathHealthKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "IronPathHealthKit", targets: ["IronPathHealthKit"]),
    ],
    dependencies: [
        .package(path: "../IronPathDomain"),
    ],
    targets: [
        .target(
            name: "IronPathHealthKit",
            dependencies: ["IronPathDomain"]
        ),
        .testTarget(
            name: "IronPathHealthKitTests",
            dependencies: ["IronPathHealthKit", "IronPathDomain"]
        ),
    ]
)
