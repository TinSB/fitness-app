// swift-tools-version: 5.9
// RedeEntitlements — StoreKit 2 subscription boundary.
//
// Pure access policy and testable orchestration are platform-neutral. StoreKit,
// StoreKit UI, and UIKit may only appear in narrowly scoped adapter files in
// this package. No canonical training data, engine, account, server, analytics,
// or third-party billing SDK may depend on this target.

import PackageDescription

let package = Package(
    name: "RedeEntitlements",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "RedeEntitlements", targets: ["RedeEntitlements"]),
    ],
    targets: [
        .target(name: "RedeEntitlements"),
        .testTarget(
            name: "RedeEntitlementsTests",
            dependencies: ["RedeEntitlements"],
            resources: [.copy("Resources/Rede.storekit")]
        ),
    ]
)
