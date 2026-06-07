// PA-S5 — coachActionIdentityEngine parity tests.
//
// FUNCTION-LEVEL compute-assert over the three `coach-action-identity/*` goldens:
// for each case, decode the echoed engineInput (action+context / draft / item / drafts),
// run the PORTED CoachActionIdentityEngine on the SAME inputs, and assert the produced
// fingerprint string equals the golden case's `fingerprint` with EXACT `==` (the
// fingerprint is a deterministic FNV-1a string), or — for dedupe cases — assert the
// surviving-draft ordered `id` list equals the golden `dedupedIds`.
//
// The goldens are GENERATED from the retired legacy coachActionIdentityEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only —
// zero `: Date` (the engine carries no clock), no IO beyond reading the committed goldens.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class CoachActionIdentityEngineParityTests: XCTestCase {

    private typealias Engine = CoachActionIdentityEngine

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static func goldenURL(_ name: String) -> URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/coach-action-identity/\(name).json", isDirectory: false
        )
    }

    private func root(_ fixtureId: String, _ name: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(name))
        return try JSONValue(decoding: data).requireObject(fixtureId)
    }

    // MARK: - engineInput decode helpers

    private func decodeSuggestedChange(_ o: OrderedJSONObject) -> Engine.SuggestedChange {
        Engine.SuggestedChange(
            muscleId: o.optionalString("muscleId"),
            setsDelta: o["setsDelta"]?.numberValue,
            exerciseIds: o.optionalStringArray("exerciseIds"),
            removeExerciseIds: o.optionalStringArray("removeExerciseIds"),
            supportDoseAdjustment: o.optionalString("supportDoseAdjustment")
        )
    }

    private func decodeAction(_ o: OrderedJSONObject) -> Engine.FingerprintAction {
        Engine.FingerprintAction(
            source: o.optionalString("source"),
            actionType: o.optionalString("actionType"),
            targetType: o.optionalString("targetType"),
            targetId: o.optionalString("targetId"),
            title: o.optionalString("title"),
            description: o.optionalString("description"),
            reason: o.optionalString("reason")
        )
    }

    private func decodeContext(_ o: OrderedJSONObject?) -> Engine.CoachActionFingerprintContext {
        guard let o else { return Engine.CoachActionFingerprintContext() }
        return Engine.CoachActionFingerprintContext(
            sourceTemplateId: o.optionalString("sourceTemplateId"),
            suggestedChange: o.optionalObject("suggestedChange").map { decodeSuggestedChange($0) },
            suggestedChangeType: o.optionalString("suggestedChangeType"),
            muscleId: o.optionalString("muscleId"),
            exerciseId: o.optionalString("exerciseId"),
            templateId: o.optionalString("templateId"),
            weekId: o.optionalString("weekId"),
            cycleId: o.optionalString("cycleId")
        )
    }

    // MARK: - envelope

    func testGoldenEnvelopes() throws {
        let names = ["fingerprint-cases-v1", "draft-history-fingerprint-cases-v1", "dedupe-cases-v1"]
        for name in names {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: Self.goldenURL(name).path),
                "missing coach-action-identity golden: \(name)"
            )
        }
        XCTAssertEqual(
            try root("coach-action-identity/fingerprint-cases-v1", "fingerprint-cases-v1")
                .optionalString("sourceFixtureId"),
            "coach-action-identity/fingerprint-cases-v1"
        )
        XCTAssertEqual(
            try root("coach-action-identity/draft-history-fingerprint-cases-v1", "draft-history-fingerprint-cases-v1")
                .optionalString("sourceFixtureId"),
            "coach-action-identity/draft-history-fingerprint-cases-v1"
        )
        XCTAssertEqual(
            try root("coach-action-identity/dedupe-cases-v1", "dedupe-cases-v1")
                .optionalString("sourceFixtureId"),
            "coach-action-identity/dedupe-cases-v1"
        )
    }

    // MARK: - buildCoachActionFingerprint

    func testFingerprintCasesParity() throws {
        let fixtureId = "coach-action-identity/fingerprint-cases-v1"
        let root = try root(fixtureId, "fingerprint-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 9, "expected the 9 fingerprint cases")
        for value in cases {
            let c = try value.requireObject("coach-action-identity fingerprint case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "fingerprint", "\(label): kind")
            let action = decodeAction(try XCTUnwrap(c.optionalObject("action"), "\(label): action"))
            let context = decodeContext(c.optionalObject("context"))
            let actual = Engine.buildCoachActionFingerprint(action, context)
            let golden = try XCTUnwrap(c.optionalString("fingerprint"), "\(label): fingerprint")
            XCTAssertEqual(actual, golden, "coach-action-identity/\(label): buildCoachActionFingerprint mismatch")
        }
    }

    // MARK: - buildProgramAdjustmentDraftFingerprint / buildProgramAdjustmentHistoryFingerprint

    func testDraftHistoryCasesParity() throws {
        let fixtureId = "coach-action-identity/draft-history-fingerprint-cases-v1"
        let root = try root(fixtureId, "draft-history-fingerprint-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 9, "expected the 9 draft/history cases")
        for value in cases {
            let c = try value.requireObject("coach-action-identity draft/history case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let golden = try XCTUnwrap(c.optionalString("fingerprint"), "\(label): fingerprint")
            let actual: String
            switch c.optionalString("kind") {
            case "draft":
                let draft = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c["draft"], "\(label): draft"))
                actual = Engine.buildProgramAdjustmentDraftFingerprint(draft)
            case "history":
                let item = try ProgramAdjustmentHistoryItem(decoding: try XCTUnwrap(c["item"], "\(label): item"))
                actual = Engine.buildProgramAdjustmentHistoryFingerprint(item)
            case let other:
                XCTFail("\(label): unexpected kind \(other ?? "nil")")
                continue
            }
            XCTAssertEqual(actual, golden, "coach-action-identity/\(label): wrapper fingerprint mismatch")
        }
    }

    // MARK: - dedupeProgramAdjustmentDraftsByFingerprint

    func testDedupeCasesParity() throws {
        let fixtureId = "coach-action-identity/dedupe-cases-v1"
        let root = try root(fixtureId, "dedupe-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 6, "expected the 6 dedupe cases")
        for value in cases {
            let c = try value.requireObject("coach-action-identity dedupe case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "dedupe", "\(label): kind")
            let drafts = try (c.optionalArray("drafts") ?? []).map { try ProgramAdjustmentDraft(decoding: $0) }
            let deduped = Engine.dedupeProgramAdjustmentDraftsByFingerprint(drafts)
            let actualIds = deduped.map { $0.id ?? "" }
            let golden = c.optionalStringArray("dedupedIds") ?? []
            XCTAssertEqual(actualIds, golden, "coach-action-identity/\(label): dedupedIds mismatch")
        }
    }
}
