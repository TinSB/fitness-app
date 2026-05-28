// swift-tools-version: 5.9
// iOS-1 Xcode Project Bootstrap V1 — local-only Swift Package.
// No remote dependencies. No third-party SwiftPM. See
// docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md.

import PackageDescription

let package = Package(
    name: "IronPathL10n",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "IronPathL10n", targets: ["IronPathL10n"]),
    ],
    targets: [
        .target(name: "IronPathL10n"),
        .testTarget(name: "IronPathL10nTests", dependencies: ["IronPathL10n"]),
    ]
)
