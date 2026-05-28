// swift-tools-version: 5.9
// iOS-4B1 TrainingDecision Swift Type Skeleton V1 — local-only Swift Package.
//
// This package carries ONLY the Codable-style TrainingDecision golden output
// type skeleton (init(decoding: JSONValue) + encoded()), proving Swift can
// decode the 10 training-decision parity goldens BEFORE any engine algorithm
// is ported. It depends on IronPathDomain (for JSONValue) ONLY — no engine
// logic, no AppData read/mutate, no Cloud / HealthKit / Persistence / UIKit,
// no remote SwiftPM. The decision engine (and its IronPathDataHealth
// dependency for CleanAppDataView) arrives in iOS-4B2+.
// See docs/ios-native-migration/IOS_4B1_TRAININGDECISION_SWIFT_TYPE_SKELETON_V1.md.

import PackageDescription

let package = Package(
    name: "IronPathTrainingDecision",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "IronPathTrainingDecision", targets: ["IronPathTrainingDecision"]),
    ],
    dependencies: [
        .package(path: "../IronPathDomain"),
    ],
    targets: [
        .target(
            name: "IronPathTrainingDecision",
            dependencies: ["IronPathDomain"]
        ),
        .testTarget(
            name: "IronPathTrainingDecisionTests",
            dependencies: ["IronPathTrainingDecision", "IronPathDomain"]
        ),
    ]
)
