// swift-tools-version: 5.9
// IronPathTrainingDecision — local-only Swift Package.
//
// iOS-4B1 carried ONLY the Codable-style TrainingDecision golden output type
// skeleton (init(decoding: JSONValue) + encoded()), proving Swift can decode
// the 10 training-decision parity goldens BEFORE any engine algorithm.
//
// iOS-4B2 (TrainingDecision Core Rule Skeleton V1) adds the FIRST engine slice:
// the Clean Input Contract (CleanTrainingDecisionInput + factory taking a
// CleanAppDataView), buildTrainingDecisionFromCleanInput, and the effectivePhase
// + sessionIntent core rules — returning a narrow TrainingDecisionCoreSlice.
// To consume CleanAppDataView the package now depends on IronPathDataHealth
// (acyclic: IronPathTrainingDecision -> IronPathDataHealth -> IronPathDomain;
// DataHealth never imports TrainingDecision). NO prescription / readiness /
// deload / userFacing / cloud / HealthKit / remote SwiftPM. The rest of the
// engine lands in iOS-4B3+.
// See docs/ios-native-migration/IOS_4B2_TRAININGDECISION_CORE_RULE_SKELETON_V1.md.

import PackageDescription

let package = Package(
    name: "IronPathTrainingDecision",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "IronPathTrainingDecision", targets: ["IronPathTrainingDecision"]),
    ],
    dependencies: [
        .package(path: "../IronPathDomain"),
        .package(path: "../IronPathDataHealth"),
    ],
    targets: [
        .target(
            name: "IronPathTrainingDecision",
            dependencies: ["IronPathDomain", "IronPathDataHealth"]
        ),
        .testTarget(
            name: "IronPathTrainingDecisionTests",
            dependencies: ["IronPathTrainingDecision", "IronPathDomain", "IronPathDataHealth"]
        ),
    ]
)
