// iOS-4B1 — hiddenDebugSignals / arbitrationTrace / perExercise decode tests
// (assertions 6, 7, 8).

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class TrainingDecisionHiddenDebugDecodeTests: XCTestCase {
    // (6) hiddenDebugSignals decodes for every golden.
    func testHiddenDebugDecodesForEveryGolden() throws {
        for id in TrainingDecisionGoldens.allIds {
            let d = try TrainingDecisionGoldens.decode(id)
            // arbitrationTrace is always an array (possibly empty for the true
            // normal-session paths; non-empty for the reentry baseline + most
            // expanded fixtures).
            XCTAssertNotNil(d.hiddenDebugSignals.arbitrationTrace, "\(id)")
        }
    }

    // (7) arbitrationTrace decodes AND preserves order verbatim.
    func testArbitrationTracePreservesOrder() throws {
        // severe-rest's trace order is contractual: severe-override → severe-cut
        // → progress-clarity-suppressed.
        let severe = try TrainingDecisionGoldens.decode("severe-rest-v1")
        XCTAssertEqual(severe.hiddenDebugSignals.arbitrationTrace, [
            "AR-1-severe-override",
            "AR-1-severe-cut",
            "AR-5-progress-clarity-suppressed",
        ])
        // Re-decode from raw JSON and confirm identical order (no reordering).
        let raw = try JSONValue(decoding: TrainingDecisionGoldens.goldenData("severe-rest-v1"))
        let traceRaw = raw.objectValue?["hiddenDebugSignals"]?.objectValue?["arbitrationTrace"]?
            .arrayValue?.compactMap { $0.stringValue } ?? []
        XCTAssertEqual(severe.hiddenDebugSignals.arbitrationTrace, traceRaw)
    }

    // arbitrationTrace items parse into well-formed AR-<n>-<slug> structure.
    func testArbitrationItemsParse() throws {
        let restart = try TrainingDecisionGoldens.decode("restart-28d-gap-v1")
        let items = restart.hiddenDebugSignals.arbitrationItems
        XCTAssertFalse(items.isEmpty)
        XCTAssertTrue(items.allSatisfy { $0.isWellFormed }, "all AR codes well-formed")
        XCTAssertTrue(items.contains { $0.ruleNumber == 2 && $0.slug == "reentry-override" })
    }

    // (8) perExercise summaries decode where present.
    func testPerExerciseDecodesWherePresent() throws {
        // Expanded fixtures carry perExercise; normal-session does not.
        let normal = try TrainingDecisionGoldens.decode("normal-session-v1")
        XCTAssertNil(normal.perExercise)
        for id in TrainingDecisionGoldens.expandedIds {
            let d = try TrainingDecisionGoldens.decode(id)
            let pe = try XCTUnwrap(d.perExercise, "\(id) perExercise")
            XCTAssertFalse(pe.isEmpty, "\(id)")
            for e in pe {
                XCTAssertFalse(e.exerciseId.isEmpty)
                XCTAssertFalse(e.role.isEmpty)
                XCTAssertGreaterThanOrEqual(e.targetSets, 0)
            }
        }
    }

    // exerciseRoleFloors decode with hyphenated keys preserved.
    func testExerciseRoleFloorsDecodeWithHyphenKeys() throws {
        let pf = try TrainingDecisionGoldens.decode("productive-floor-v1")
        let floors = try XCTUnwrap(pf.exerciseRoleFloors)
        XCTAssertEqual(floors["main-compound"], 2)
        XCTAssertEqual(floors["secondary-compound"], 2)
        XCTAssertEqual(floors["accessory"], 1)
        XCTAssertEqual(floors["isolation"], 1)
    }
}
