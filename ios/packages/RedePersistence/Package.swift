// swift-tools-version: 5.9
// M1-2 本地 JSON store + gated writer — canonical AppData 的唯一写路径。
// Local-only Swift Package。No remote dependencies. No third-party SwiftPM.

import PackageDescription

let package = Package(
    name: "RedePersistence",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedePersistence", targets: ["RedePersistence"]),
    ],
    dependencies: [
        .package(path: "../RedeDomain"),
    ],
    targets: [
        .target(name: "RedePersistence", dependencies: ["RedeDomain"]),
        .testTarget(name: "RedePersistenceTests", dependencies: ["RedePersistence"]),
    ]
)
