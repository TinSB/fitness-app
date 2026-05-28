// ReplacementEquivalenceAuditRepairTests — iOS-3C.
//
// Locks the audit-only contract:
//   * detect surfaces vertical-pull → horizontal-pull chain
//     mismatches and vertical-push → fly chain mismatches.
//   * apply ALWAYS returns .skipped with AppData untouched.
//   * actualExerciseId / originalExerciseId / equivalence.chainId
//     remain unchanged across apply.

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class ReplacementEquivalenceAuditRepairTests: XCTestCase {
    func testDetectsVerticalPullMappedToHorizontalPullChain() throws {
        // pull-up with equivalence.chainId = "horizontal-pull-bb-row"
        // should be flagged.
        let exerciseUnknown = OrderedJSONObject(entries: [
            .init(key: "equivalence", value: .object(OrderedJSONObject(entries: [
                .init(key: "chainId", value: .string("horizontal-pull-bb-row")),
            ]))),
            .init(key: "baseId", value: .string("pull-up")),
        ])
        let exercise = ExercisePrescription(
            id: "ex-bad",
            name: "Bench Row",
            originalExerciseId: "barbell-row",
            actualExerciseId: "pull-up",
            _unknown: exerciseUnknown
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = ReplacementEquivalenceAuditRepair()
        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected)
        XCTAssertEqual(detect.affectedIds, ["s1/ex-bad"])
    }

    func testDetectsVerticalPushMappedToFlyChain() throws {
        let exerciseUnknown = OrderedJSONObject(entries: [
            .init(key: "equivalence", value: .object(OrderedJSONObject(entries: [
                .init(key: "chainId", value: .string("fly")),
            ]))),
        ])
        let exercise = ExercisePrescription(
            id: "ex-dip",
            originalExerciseId: "cable-fly",
            actualExerciseId: "dip",
            _unknown: exerciseUnknown
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = ReplacementEquivalenceAuditRepair()
        XCTAssertTrue(repair.detect(appData).detected)
    }

    func testApplyNeverMutates() throws {
        let exerciseUnknown = OrderedJSONObject(entries: [
            .init(key: "equivalence", value: .object(OrderedJSONObject(entries: [
                .init(key: "chainId", value: .string("horizontal-pull-bb-row")),
            ]))),
        ])
        let exercise = ExercisePrescription(
            id: "ex-bad",
            originalExerciseId: "barbell-row",
            actualExerciseId: "pull-up",
            _unknown: exerciseUnknown
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = ReplacementEquivalenceAuditRepair()
        let canonicalBefore = try appData.canonicalJSONData()
        let result = try repair.apply(appData, options: nil)
        XCTAssertEqual(result.status, .skipped)
        let canonicalAfter = try result.repairedData.canonicalJSONData()
        XCTAssertEqual(canonicalAfter, canonicalBefore,
            "audit-only repair must not mutate AppData")
        XCTAssertTrue(result.warnings.first?.contains("audit-only") ?? false)
    }

    func testApplyPreservesIdentityFields() throws {
        let exerciseUnknown = OrderedJSONObject(entries: [
            .init(key: "equivalence", value: .object(OrderedJSONObject(entries: [
                .init(key: "chainId", value: .string("horizontal-pull-bb-row")),
            ]))),
        ])
        let exercise = ExercisePrescription(
            id: "ex-bad",
            originalExerciseId: "barbell-row",
            actualExerciseId: "pull-up",
            _unknown: exerciseUnknown
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = ReplacementEquivalenceAuditRepair()
        let result = try repair.apply(appData, options: nil)
        let auditedExercise = result.repairedData.history.first?.exercises?.first
        XCTAssertEqual(auditedExercise?.actualExerciseId, "pull-up")
        XCTAssertEqual(auditedExercise?.originalExerciseId, "barbell-row")
        // equivalence.chainId preserved in _unknown.
        if case .object(let equiv) = (auditedExercise?._unknown["equivalence"] ?? .null) {
            XCTAssertEqual(equiv["chainId"]?.stringValue, "horizontal-pull-bb-row")
        } else {
            XCTFail("equivalence object must remain in _unknown")
        }
    }

    func testNoOpWhenNoMismatch() throws {
        let exerciseUnknown = OrderedJSONObject(entries: [
            .init(key: "equivalence", value: .object(OrderedJSONObject(entries: [
                .init(key: "chainId", value: .string("vertical-pull")),
            ]))),
        ])
        let exercise = ExercisePrescription(
            id: "ex-ok",
            originalExerciseId: "pull-up",
            actualExerciseId: "pull-up",
            _unknown: exerciseUnknown
        )
        let session = TrainingSession(id: "s1", exercises: [exercise])
        let appData = try makeAppDataWithHistory([session])
        let repair = ReplacementEquivalenceAuditRepair()
        XCTAssertFalse(repair.detect(appData).detected)
    }

    private func makeAppDataWithHistory(_ sessions: [TrainingSession]) throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
            .init(key: "history", value: .array(sessions.map { $0.encoded() })),
        ])
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
