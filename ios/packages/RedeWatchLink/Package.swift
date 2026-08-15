// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RedeWatchLink",
    platforms: [.iOS(.v17), .watchOS(.v10)],
    products: [
        .library(name: "RedeWatchLink", targets: ["RedeWatchLink"]),
    ],
    targets: [
        .target(name: "RedeWatchLink"),
        .testTarget(name: "RedeWatchLinkTests", dependencies: ["RedeWatchLink"]),
    ]
)
