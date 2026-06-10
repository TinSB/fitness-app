// swift-tools-version: 5.9
// M2-1 今日裁决引擎 — readiness 最小判断（练/休/轻/减载）+ goldens。
// Local-only Swift Package。No remote dependencies. No third-party SwiftPM.

import PackageDescription

let package = Package(
    name: "RedeTrainingDecision",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "RedeTrainingDecision", targets: ["RedeTrainingDecision"]),
    ],
    dependencies: [
        .package(path: "../RedeDomain"),
        .package(path: "../RedeDataHealth"),
    ],
    targets: [
        .target(name: "RedeTrainingDecision", dependencies: ["RedeDomain", "RedeDataHealth"]),
        .testTarget(name: "RedeTrainingDecisionTests", dependencies: ["RedeTrainingDecision"]),
    ]
)
