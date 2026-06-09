// iOS-4B1 — shared golden-fixture loader for the decode tests.
//
// Reads the canonical repo goldens under
// ios/ParityFixtures/parity/golden/training-decision/ via a #filePath walk-up, so
// the package test consumes the SAME committed goldens the legacy web schema parity generator
// produces — no copies, no drift.

import Foundation
import XCTest
import RedeDomain
@testable import RedeTrainingDecision

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

    /// iOS-17e-5 — the 3 history-driven progression goldens, now COMPUTE-ASSERTED
    /// (flipped from 17e-0's decode-only scaffold). Kept as a SEPARATE compute-assert
    /// roster rather than folded into `allIds`/`expandedIds`: those drive the
    /// cold-start parity/decode suites (zero-history fixtures whose synthetic inputs
    /// are declared per-id), and polluting them would (a) break the cold-start tests'
    /// per-id input force-unwrap and (b) put adaptive-history fixtures through
    /// cold-start-shaped assertions. The cold-start goldens stay byte-identical and
    /// their tests stay 10/9 — zero drift. These 3 are compute-asserted in
    /// TrainingDecisionProgressionGoldenParityTests against their own synthetic inputs.
    static let progressionIds: [String] = [
        "progressive-overload-v1",
        "plateau-stall-v1",
        "insufficient-history-v1",
    ]

    /// Repo root, resolved from this test file's compile-time path.
    static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    static var goldenDir: URL {
        repoRoot
            .appendingPathComponent("ios/ParityFixtures/parity/golden/training-decision", isDirectory: true)
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
