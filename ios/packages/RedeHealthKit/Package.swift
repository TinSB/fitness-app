// swift-tools-version: 5.9
// RedeHealthKit — HK-1 HealthKit Body-Weight Import V1.
//
// Activated from the iOS-1 inert stub into an APPROVED, read-only Apple-Health
// adapter (master §6.2/§17/§18, amended by HK-1). Depends on RedeDomain via
// LOCAL path so the pure mapper can produce canonical `HealthMetricSample`
// values. No remote dependencies. No third-party SwiftPM. The real HKHealthStore
// reader compiles only on iOS (`#if os(iOS)` in HealthKitBodyMassSource.swift);
// the pure mapper + protocol seam carry the unit tests. See
// docs/ios-native-migration/IOS_HK1_HEALTHKIT_BODYWEIGHT_IMPORT_V1.md.

import PackageDescription

let package = Package(
    name: "RedeHealthKit",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeHealthKit", targets: ["RedeHealthKit"]),
    ],
    dependencies: [
        .package(path: "../RedeDomain"),
    ],
    targets: [
        .target(
            name: "RedeHealthKit",
            dependencies: ["RedeDomain"]
        ),
        .testTarget(
            name: "RedeHealthKitTests",
            dependencies: ["RedeHealthKit", "RedeDomain"]
        ),
    ]
)
