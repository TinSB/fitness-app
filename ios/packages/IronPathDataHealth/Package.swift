// swift-tools-version: 5.9
// iOS-3A Data Health Runtime Foundation V1 — local-only Swift Package.
// Depends on IronPathDomain via local path. No remote dependencies.
// No third-party SwiftPM. See
// docs/ios-native-migration/IOS_3A_DATA_HEALTH_RUNTIME_FOUNDATION_V1.md.

import PackageDescription

let package = Package(
    name: "IronPathDataHealth",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "IronPathDataHealth", targets: ["IronPathDataHealth"]),
    ],
    dependencies: [
        .package(path: "../IronPathDomain"),
    ],
    targets: [
        .target(
            name: "IronPathDataHealth",
            dependencies: ["IronPathDomain"]
        ),
        .testTarget(
            name: "IronPathDataHealthTests",
            dependencies: ["IronPathDataHealth", "IronPathDomain"]
        ),
    ]
)
