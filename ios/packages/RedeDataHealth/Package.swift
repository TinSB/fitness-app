// swift-tools-version: 5.9
// iOS-3A Data Health Runtime Foundation V1 — local-only Swift Package.
// Depends on RedeDomain via local path. No remote dependencies.
// No third-party SwiftPM. See
// docs/ios-native-migration/IOS_3A_DATA_HEALTH_RUNTIME_FOUNDATION_V1.md.

import PackageDescription

let package = Package(
    name: "RedeDataHealth",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeDataHealth", targets: ["RedeDataHealth"]),
    ],
    dependencies: [
        .package(path: "../RedeDomain"),
    ],
    targets: [
        .target(
            name: "RedeDataHealth",
            dependencies: ["RedeDomain"]
        ),
        .testTarget(
            name: "RedeDataHealthTests",
            dependencies: ["RedeDataHealth", "RedeDomain"]
        ),
    ]
)
