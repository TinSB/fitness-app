// swift-tools-version: 5.9
// M1-1 AppData MVP 最小模型 — clean rewrite 的第一个数据包。
// Local-only Swift Package。No remote dependencies. No third-party SwiftPM.

import PackageDescription

let package = Package(
    name: "RedeDomain",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeDomain", targets: ["RedeDomain"]),
    ],
    targets: [
        .target(name: "RedeDomain"),
        .testTarget(name: "RedeDomainTests", dependencies: ["RedeDomain"]),
    ]
)
