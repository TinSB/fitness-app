// swift-tools-version: 5.9
// M1-3 DataHealth clean view（最小）— raw AppData 永不进引擎（系统逻辑 §1.2/§6）。
// Local-only Swift Package。No remote dependencies. No third-party SwiftPM.

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
        .target(name: "RedeDataHealth", dependencies: ["RedeDomain"]),
        .testTarget(name: "RedeDataHealthTests", dependencies: ["RedeDataHealth"]),
    ]
)
