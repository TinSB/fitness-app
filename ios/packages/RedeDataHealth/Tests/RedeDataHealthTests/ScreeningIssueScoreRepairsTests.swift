// ScreeningIssueScoreRepairsTests — iOS-3C.
//
// Covers both screening-issue-score recipes:
//   * ScreeningIssueScoreRuntimeGuardRepair — runtime guard, never
//     mutates AppData. Detect surfaces cap deltas.
//   * ScreeningIssueScoreRepair — safe_auto, predicate-gated. Only
//     persists capped issueScores when movementFlags all-good AND
//     no painTriggers AND no restrictedExercises.

import XCTest
@testable import RedeDataHealth
import RedeDomain
import Foundation

final class ScreeningIssueScoreRepairsTests: XCTestCase {
    // MARK: - Runtime guard

    func testRuntimeGuardDetectsContradictoryIssueScores() throws {
        // movementFlags allGood + pain present → soft-cap predicate
        // fires inside applyIssueScoreCap, but only for safe-to-write
        // sessions. For runtime guard we use a scenario where hard
        // cap fires regardless: a score of 95 above hard cap 50.
        let appData = try makeAppData(
            painTriggers: ["lower-back"],
            movementFlags: [("squat", "compensated")],
            issueScores: [("lower-back", 95), ("shoulder", 20)]
        )
        let repair = ScreeningIssueScoreRuntimeGuardRepair()
        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected)
        XCTAssertEqual(detect.occurrences, 1)
        XCTAssertEqual(detect.affectedIds, ["lower-back"])
        XCTAssertEqual(detect.severity, .error)
    }

    func testRuntimeGuardApplyReturnsSkippedWithoutMutation() throws {
        let appData = try makeAppData(
            painTriggers: ["lower-back"],
            movementFlags: [("squat", "compensated")],
            issueScores: [("lower-back", 95)]
        )
        let repair = ScreeningIssueScoreRuntimeGuardRepair()
        let canonicalBefore = try appData.canonicalJSONData()
        let result = try repair.apply(appData, options: nil)
        XCTAssertEqual(result.status, .skipped)
        let canonicalAfter = try result.repairedData.canonicalJSONData()
        XCTAssertEqual(canonicalAfter, canonicalBefore,
            "runtime guard apply must not mutate AppData")
        XCTAssertTrue(result.warnings.first?.contains("runtime guard") ?? false)
    }

    // MARK: - Safe-auto repair

    func testRepairSafeWritesOnlyWhenAllPredicatesPass() throws {
        // movementFlags all "good" + no pain + no restriction +
        // soft-cap-relevant issueScores → repair fires.
        let appData = try makeAppData(
            painTriggers: [],
            restrictedExercises: [],
            movementFlags: [("squat", "good"), ("hinge", "good")],
            issueScores: [("lower-back", 30), ("shoulder", 5)]
        )
        let repair = ScreeningIssueScoreRepair()
        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected, "predicate-passed, soft-cap-applicable score must trigger detect")

        let result = try repair.apply(appData, options: nil)
        XCTAssertEqual(result.status, .applied)
        // issueScores capped to soft cap (12).
        let cappedScreening = result.repairedData.screeningProfile
        guard case .object(let adaptive) = (cappedScreening.adaptiveState ?? .null),
              case .object(let scores) = (adaptive["issueScores"] ?? .null) else {
            XCTFail("issueScores must be a JSON object after repair"); return
        }
        XCTAssertEqual(scores["lower-back"]?.intValue, DataHealthConstants.issueScoreSoftCap)
        XCTAssertEqual(scores["shoulder"]?.intValue, 5)  // already below cap
    }

    func testRepairRefusesWhenPainPresent() throws {
        let appData = try makeAppData(
            painTriggers: ["lower-back"],
            restrictedExercises: [],
            movementFlags: [("squat", "good")],
            issueScores: [("lower-back", 95)]
        )
        let repair = ScreeningIssueScoreRepair()
        XCTAssertFalse(repair.detect(appData).detected,
            "pain present must block safe-write")
        let result = try repair.apply(appData, options: nil)
        XCTAssertEqual(result.status, .noOp)
        let before = try appData.canonicalJSONData()
        let after = try result.repairedData.canonicalJSONData()
        XCTAssertEqual(before, after, "pain-blocked repair must not mutate")
    }

    func testRepairRefusesWhenRestrictionPresent() throws {
        let appData = try makeAppData(
            painTriggers: [],
            restrictedExercises: ["overhead-press"],
            movementFlags: [("squat", "good")],
            issueScores: [("shoulder", 95)]
        )
        let repair = ScreeningIssueScoreRepair()
        XCTAssertFalse(repair.detect(appData).detected,
            "restriction present must block safe-write")
        let result = try repair.apply(appData, options: nil)
        XCTAssertEqual(result.status, .noOp)
    }

    func testRepairRefusesWhenMovementFlagNotAllGood() throws {
        let appData = try makeAppData(
            painTriggers: [],
            restrictedExercises: [],
            movementFlags: [("squat", "compensated"), ("hinge", "good")],
            issueScores: [("lower-back", 95)]
        )
        let repair = ScreeningIssueScoreRepair()
        XCTAssertFalse(repair.detect(appData).detected,
            "compensated movement flag must block safe-write")
    }

    func testRepairPreservesPainAndRestrictionHistoryWhenSafe() throws {
        // The repair predicate INCLUDES "no pain" / "no restriction",
        // so a repair-applicable state has neither — this test
        // therefore exercises the more meaningful invariant that the
        // OTHER adaptiveState keys are preserved.
        let appData = try makeAppData(
            painTriggers: [],
            restrictedExercises: [],
            movementFlags: [("squat", "good")],
            issueScores: [("lower-back", 30)],
            extraAdaptiveStateEntries: [
                .init(key: "preserveMe", value: .string("intact")),
                .init(key: "performanceDrops", value: .array([.string("ex-bench")])),
            ]
        )
        let repair = ScreeningIssueScoreRepair()
        let result = try repair.apply(appData, options: nil)
        XCTAssertEqual(result.status, .applied)
        guard case .object(let adaptive) = (result.repairedData.screeningProfile.adaptiveState ?? .null) else {
            XCTFail("adaptiveState must remain a JSON object"); return
        }
        XCTAssertEqual(adaptive["preserveMe"]?.stringValue, "intact")
        XCTAssertEqual(adaptive["performanceDrops"]?.arrayValue?.first?.stringValue, "ex-bench")
    }

    func testRepairIsIdempotent() throws {
        let appData = try makeAppData(
            painTriggers: [],
            restrictedExercises: [],
            movementFlags: [("squat", "good")],
            issueScores: [("lower-back", 30)]
        )
        let repair = ScreeningIssueScoreRepair()
        let first = try repair.apply(appData, options: nil)
        XCTAssertEqual(first.status, .applied)
        // Second detect against the repaired data: capped scores are
        // already at soft cap, so no new changes → no detection.
        XCTAssertFalse(repair.detect(first.repairedData).detected)
    }

    // MARK: - Helpers

    private func makeAppData(
        painTriggers: [String] = [],
        restrictedExercises: [String] = [],
        movementFlags: [(String, String)] = [],
        issueScores: [(String, Int)] = [],
        extraAdaptiveStateEntries: [OrderedJSONObject.Entry] = []
    ) throws -> AppData {
        let issueScoresObj = OrderedJSONObject(entries: issueScores.map { key, value in
            .init(key: key, value: .number(.integer(Int64(value))))
        })
        var adaptiveEntries: [OrderedJSONObject.Entry] = [
            .init(key: "issueScores", value: .object(issueScoresObj)),
        ]
        adaptiveEntries.append(contentsOf: extraAdaptiveStateEntries)
        let movementFlagsObj = OrderedJSONObject(entries: movementFlags.map { key, value in
            .init(key: key, value: .string(value))
        })
        let screeningObj = OrderedJSONObject(entries: [
            .init(key: "painTriggers", value: .array(painTriggers.map { .string($0) })),
            .init(key: "restrictedExercises", value: .array(restrictedExercises.map { .string($0) })),
            .init(key: "movementFlags", value: .object(movementFlagsObj)),
            .init(key: "adaptiveState", value: .object(OrderedJSONObject(entries: adaptiveEntries))),
        ])
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
            .init(key: "screeningProfile", value: .object(screeningObj)),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
