// swift-tools-version: 5.9
// iOS-1 Xcode Project Bootstrap V1 — local-only Swift Package.
// No remote dependencies. No third-party SwiftPM. See
// docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md.

import PackageDescription

let package = Package(
    name: "IronPathDataHealth",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "IronPathDataHealth", targets: ["IronPathDataHealth"]),
    ],
    targets: [
        .target(name: "IronPathDataHealth"),
        .testTarget(name: "IronPathDataHealthTests", dependencies: ["IronPathDataHealth"]),
    ]
)
