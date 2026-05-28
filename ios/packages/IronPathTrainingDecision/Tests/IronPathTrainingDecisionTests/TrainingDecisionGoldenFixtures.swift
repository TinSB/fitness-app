// iOS-4B1 — shared golden-fixture loader for the decode tests.
//
// Reads the canonical repo goldens under
// tests/fixtures/parity/golden/training-decision/ via a #filePath walk-up, so
// the package test consumes the SAME committed goldens the TS parity generator
// produces — no copies, no drift.

import Foundation
import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

enum TrainingDecisionGoldens {
    /// The 10 training-decision golden fixture ids (without the `.json` suffix).
    static let allIds: [String] = [
        "normal-session-v1",
        "severe-rest-v1",
        "controlled-reload-v1",
        "deload-week-v1",
        "stale-today-status-v1",
        "stale-health-data-v1",
        "restart-28d-gap-v1",
        "productive-floor-v1",
        "no-legacy-advice-v1",
        "clean-input-contract-v1",
    ]

    /// The 9 expanded-projection ids (everything except the narrow baseline).
    static let expandedIds: [String] = allIds.filter { $0 != "normal-session-v1" }

    /// Repo root, resolved from this test file's compile-time path.
    static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    static var goldenDir: URL {
        repoRoot
            .appendingPathComponent("tests/fixtures/parity/golden/training-decision", isDirectory: true)
    }

    static func goldenURL(_ id: String) -> URL {
        goldenDir.appendingPathComponent("\(id).json", isDirectory: false)
    }

    static func goldenData(_ id: String) throws -> Data {
        try Data(contentsOf: goldenURL(id))
    }

    static func decode(_ id: String) throws -> TrainingDecision {
        try TrainingDecision(decodingData: goldenData(id))
    }
}
