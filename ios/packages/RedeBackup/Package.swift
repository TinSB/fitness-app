// swift-tools-version: 5.9
// iOS-1 Xcode Project Bootstrap V1 — local-only Swift Package.
// No remote dependencies. No third-party SwiftPM. See
// docs/ios-native-migration/IOS_1_XCODE_PROJECT_BOOTSTRAP_V1.md.

import PackageDescription

let package = Package(
    name: "RedeBackup",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeBackup", targets: ["RedeBackup"]),
    ],
    targets: [
        .target(name: "RedeBackup"),
        .testTarget(name: "RedeBackupTests", dependencies: ["RedeBackup"]),
    ]
)
