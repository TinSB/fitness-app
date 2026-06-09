// swift-tools-version: 5.9
// iOS-1 Xcode Project Bootstrap V1 — local-only Swift Package.
// No remote dependencies. No third-party SwiftPM. See
// docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md.

import PackageDescription

let package = Package(
    name: "RedeDomain",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeDomain", targets: ["RedeDomain"]),
    ],
    targets: [
        .target(name: "RedeDomain"),
        .testTarget(
            name: "RedeDomainTests",
            dependencies: ["RedeDomain"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
