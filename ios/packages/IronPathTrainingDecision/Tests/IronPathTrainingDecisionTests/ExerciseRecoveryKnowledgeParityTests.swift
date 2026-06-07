// SC-0 — exercise-recovery knowledge parity tests.
//
// ITEM-LEVEL compute-assert: for the `exercise-recovery/knowledge-snapshot-v1` golden,
// decode every override id's secondaryMuscles + muscleContribution and assert the PORTED
// `ExerciseRecoveryKnowledge.overrides[id]` reproduces them EXACTLY. Plus: (1) the id
// universe is identical to `SmartReplacementKnowledge.overrideIds` (one 63-id override
// universe, not two — the 归一/consistency guard), and (2) the golden counts
// (knowledgeOverrideIds / withSecondaryMuscles / withMuscleContribution) all equal the
// ported entry count, so no id or field can silently drop in transcription.
//
// The golden is GENERATED from the retired legacy EXERCISE_KNOWLEDGE_OVERRIDES
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — no
// clock, zero `: Date`, no IO beyond reading the committed golden.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class ExerciseRecoveryKnowledgeParityTests: XCTestCase {

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static var goldenURL: URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/exercise-recovery/knowledge-snapshot-v1.json", isDirectory: false
        )
    }

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL)
        return try JSONValue(decoding: data).requireObject("exercise-recovery/knowledge-snapshot-v1")
    }

    /// muscleContribution is a string→number object; decode it to `[String: Double]`.
    private func muscleContribution(_ o: OrderedJSONObject) -> [String: Double] {
        var dict: [String: Double] = [:]
        for entry in o.entries {
            if let value = entry.value.doubleValue { dict[entry.key] = value }
        }
        return dict
    }

    func testGoldenEnvelope() throws {
        XCTAssertTrue(FileManager.default.fileExists(atPath: Self.goldenURL.path), "missing exercise-recovery golden")
        let root = try root()
        XCTAssertEqual(root.optionalObject("parityGolden")?.optionalString("sourceFixtureId"),
                       "exercise-recovery/knowledge-snapshot-v1")
        let counts = root.optionalObject("counts")
        XCTAssertEqual(counts?.optionalInt("knowledgeOverrideIds"), 63)
        XCTAssertEqual(counts?.optionalInt("withSecondaryMuscles"), 63)
        XCTAssertEqual(counts?.optionalInt("withMuscleContribution"), 63)
    }

    /// The ported table count matches the golden's id count exactly (no drop, no extra).
    func testPortedCountsMatchGolden() throws {
        let root = try root()
        let knowledge = try XCTUnwrap(root.optionalObject("knowledge"), "no knowledge object")
        XCTAssertEqual(ExerciseRecoveryKnowledge.overrideEntries.count, knowledge.count,
                       "ported entry count != golden id count")
        XCTAssertEqual(ExerciseRecoveryKnowledge.overrideEntries.count,
                       root.optionalObject("counts")?.optionalInt("knowledgeOverrideIds"))
        // Bijection: every golden id is ported, and every ported id is in the golden.
        XCTAssertEqual(Set(knowledge.keys), Set(ExerciseRecoveryKnowledge.overrideIds),
                       "golden id set != ported id set")
    }

    /// 归一 / consistency: the recovery override universe IS the SmartReplacement (SR-3)
    /// universe — the same 63 ids, identical order (one override universe, not two).
    func testIdUniverseEqualsSmartReplacement() {
        XCTAssertEqual(ExerciseRecoveryKnowledge.overrideIds, SmartReplacementKnowledge.overrideIds,
                       "recovery override universe diverged from SmartReplacementKnowledge")
    }

    /// Every override id's secondaryMuscles + muscleContribution reproduce the golden EXACTLY.
    func testEveryEntryMatchesGolden() throws {
        let root = try root()
        let knowledge = try XCTUnwrap(root.optionalObject("knowledge"), "no knowledge object")
        XCTAssertFalse(knowledge.isEmpty, "empty knowledge")
        for entry in knowledge.entries {
            let id = entry.key
            let goldenEntry = try XCTUnwrap(entry.value.objectValue, "entry \(id) not an object")
            let ported = try XCTUnwrap(ExerciseRecoveryKnowledge.overrides[id], "id \(id) not ported")

            // secondaryMuscles — present on every override (may be a defined []).
            let goldenSecondary = try XCTUnwrap(goldenEntry.optionalStringArray("secondaryMuscles"),
                                                "\(id) missing secondaryMuscles in golden")
            XCTAssertEqual(ported.secondaryMuscles, goldenSecondary,
                           "\(id) secondaryMuscles mismatch")

            // muscleContribution — present on every override.
            let goldenContribObj = try XCTUnwrap(goldenEntry.optionalObject("muscleContribution"),
                                                 "\(id) missing muscleContribution in golden")
            XCTAssertEqual(ported.muscleContribution, muscleContribution(goldenContribObj),
                           "\(id) muscleContribution mismatch")
        }
    }
}
