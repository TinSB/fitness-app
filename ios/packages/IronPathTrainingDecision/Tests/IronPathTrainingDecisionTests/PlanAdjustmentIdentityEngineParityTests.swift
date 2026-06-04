// PA-S6 — planAdjustmentIdentityEngine parity tests.
//
// FUNCTION-LEVEL compute-assert over the four `plan-adjustment-identity/*` goldens:
// for each case, decode the echoed engineInput, run the PORTED
// PlanAdjustmentIdentityEngine on the SAME inputs, and assert the produced output
// equals the golden —
//   fingerprint-cases  → fingerprint string EXACT `==` (input/coachAction/draft/
//                        history/change) + dedupedIds ordered id list (the S5 alias),
//   instance-id-cases  → instanceId string EXACT `==`,
//   upsert-cases       → outcome + sourceFingerprint + ordered draftIds + target/
//                        history/created ids, and canonical-equality of the created draft,
//   regenerate-cases   → foundId / existingDraftId / sourceFingerprint, and canonical-
//                        equality of the regenerated draft.
//
// The goldens are GENERATED from the REAL TS planAdjustmentIdentityEngine
// (scripts/generate-parity-goldens.mjs), never hand-edited (§22). PURE / read-only —
// zero `: Date`; the only time input is the INJECTED `now` decoded from each
// regenerate case (no wall clock), no IO beyond reading the committed goldens.

import XCTest
import IronPathDomain
@testable import IronPathTrainingDecision

final class PlanAdjustmentIdentityEngineParityTests: XCTestCase {

    private typealias Engine = PlanAdjustmentIdentityEngine

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
            "tests/fixtures/parity/golden/plan-adjustment-identity/\(name).json", isDirectory: false
        )
    }

    private func root(_ fixtureId: String, _ name: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(name))
        return try JSONValue(decoding: data).requireObject(fixtureId)
    }

    // MARK: - decode helpers

    private func decodeInput(_ o: OrderedJSONObject) -> Engine.PlanAdjustmentFingerprintInput {
        Engine.PlanAdjustmentFingerprintInput(
            sourceCoachActionId: o.optionalString("sourceCoachActionId"),
            actionType: o.optionalString("actionType"),
            source: o.optionalString("source"),
            sourceTemplateId: o.optionalString("sourceTemplateId"),
            sourceProgramTemplateId: o.optionalString("sourceProgramTemplateId"),
            targetTemplateId: o.optionalString("targetTemplateId"),
            targetDayTemplateId: o.optionalString("targetDayTemplateId"),
            targetExerciseId: o.optionalString("targetExerciseId"),
            targetMuscleId: o.optionalString("targetMuscleId"),
            suggestedChangeType: o.optionalString("suggestedChangeType"),
            suggestedChange: o.rawValue("suggestedChange"),
            weekId: o.optionalString("weekId"),
            cycleId: o.optionalString("cycleId"),
            changeSummary: o.optionalString("changeSummary"),
            reason: o.optionalString("reason"),
            title: o.optionalString("title"),
            description: o.optionalString("description")
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

    private func decodeSuggestedChange(_ o: OrderedJSONObject) -> Engine.SuggestedChange {
        Engine.SuggestedChange(
            muscleId: o.optionalString("muscleId"),
            setsDelta: o["setsDelta"]?.numberValue,
            exerciseIds: o.optionalStringArray("exerciseIds"),
            removeExerciseIds: o.optionalStringArray("removeExerciseIds"),
            supportDoseAdjustment: o.optionalString("supportDoseAdjustment")
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

    private func idList(_ drafts: [ProgramAdjustmentDraft]) -> [String?] { drafts.map { $0.id } }

    private func goldenIdList(_ values: [JSONValue]) -> [String?] {
        values.map { $0.isNull ? nil : $0.stringValue }
    }

    /// Canonical-equality of a computed draft against the golden draft JSON. Both
    /// sides are re-emitted through the same JSONValue canonical form (sorted keys,
    /// integer-collapsed numbers), so `_unknown` open-bag ordering / number
    /// representation never matter.
    private func assertDraftCanonical(
        _ computed: ProgramAdjustmentDraft?, _ goldenValue: JSONValue?, _ label: String
    ) throws {
        if let goldenValue, !goldenValue.isNull {
            let draft = try XCTUnwrap(computed, "\(label): expected a draft")
            let computedStr = try draft.encoded().canonicalJSONString()
            let goldenStr = try goldenValue.canonicalJSONString()
            XCTAssertEqual(computedStr, goldenStr, "\(label): regenerated draft canonical mismatch")
        } else {
            XCTAssertNil(computed, "\(label): expected no draft")
        }
    }

    // MARK: - envelopes

    func testGoldenEnvelopes() throws {
        let names = ["fingerprint-cases-v1", "instance-id-cases-v1", "upsert-cases-v1", "regenerate-cases-v1"]
        for name in names {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: Self.goldenURL(name).path),
                "missing plan-adjustment-identity golden: \(name)"
            )
            let id = "plan-adjustment-identity/\(name)"
            XCTAssertEqual(try root(id, name).optionalString("sourceFixtureId"), id)
        }
    }

    // MARK: - fingerprint-cases (6 exports + the dedupe alias)

    func testFingerprintCasesParity() throws {
        let fixtureId = "plan-adjustment-identity/fingerprint-cases-v1"
        let root = try root(fixtureId, "fingerprint-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 18, "expected the declared fingerprint cases")
        for value in cases {
            let c = try value.requireObject("plan-adjustment-identity fingerprint case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            switch c.optionalString("kind") {
            case "input":
                let input = decodeInput(try XCTUnwrap(c.optionalObject("input"), "\(label): input"))
                let actual = Engine.buildPlanAdjustmentFingerprint(input)
                let golden = try XCTUnwrap(c.optionalString("fingerprint"), "\(label): fingerprint")
                XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): buildPlanAdjustmentFingerprint mismatch")
            case "coachAction":
                let actionObj = try XCTUnwrap(c.optionalObject("action"), "\(label): action")
                let action = decodeAction(actionObj)
                let context = decodeContext(c.optionalObject("context"))
                let actual = Engine.buildPlanAdjustmentFingerprintFromCoachAction(
                    action, sourceFingerprint: actionObj.optionalString("sourceFingerprint"), context
                )
                let golden = try XCTUnwrap(c.optionalString("fingerprint"), "\(label): fingerprint")
                XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): FromCoachAction mismatch")
            case "draft":
                let draft = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c["draft"], "\(label): draft"))
                let actual = Engine.buildPlanAdjustmentFingerprintFromDraft(draft)
                let golden = try XCTUnwrap(c.optionalString("fingerprint"), "\(label): fingerprint")
                XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): FromDraft mismatch")
            case "history":
                let item = try ProgramAdjustmentHistoryItem(decoding: try XCTUnwrap(c["item"], "\(label): item"))
                let actual = Engine.buildPlanAdjustmentFingerprintFromHistory(item)
                let golden = try XCTUnwrap(c.optionalString("fingerprint"), "\(label): fingerprint")
                XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): FromHistory mismatch")
            case "change":
                let change = try AdjustmentChange(decoding: try XCTUnwrap(c["change"], "\(label): change"))
                let input = decodeInput(c.optionalObject("input") ?? OrderedJSONObject())
                let actual = Engine.buildPlanAdjustmentFingerprintFromChange(change, input)
                let golden = try XCTUnwrap(c.optionalString("fingerprint"), "\(label): fingerprint")
                XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): FromChange mismatch")
            case "dedupe":
                let drafts = try (c.optionalArray("drafts") ?? []).map { try ProgramAdjustmentDraft(decoding: $0) }
                let actual = Engine.dedupePlanAdjustmentDraftsByFingerprint(drafts).map { $0.id }
                let golden = goldenIdList(c.optionalArray("dedupedIds") ?? [])
                XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): dedupe alias mismatch")
            case let other:
                XCTFail("\(label): unexpected kind \(other ?? "nil")")
            }
        }
    }

    // MARK: - instance-id-cases

    func testInstanceIdCasesParity() throws {
        let fixtureId = "plan-adjustment-identity/instance-id-cases-v1"
        let root = try root(fixtureId, "instance-id-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 14, "expected the declared instance-id cases")
        for value in cases {
            let c = try value.requireObject("plan-adjustment-identity instance-id case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "instanceId", "\(label): kind")
            let fp = try XCTUnwrap(c.optionalString("sourceFingerprint"), "\(label): sourceFingerprint")
            // revision omitted (null) → the engine default of 1, mirroring the TS `revision = 1`.
            let revision = c.optionalDouble("revision") ?? 1
            let parent = c.optionalString("parentDraftId")
            let actual = Engine.buildPlanAdjustmentDraftInstanceId(fp, revision, parent)
            let golden = try XCTUnwrap(c.optionalString("instanceId"), "\(label): instanceId")
            XCTAssertEqual(actual, golden, "\(fixtureId)/\(label): instanceId mismatch")
        }
    }

    // MARK: - upsert-cases

    func testUpsertCasesParity() throws {
        let fixtureId = "plan-adjustment-identity/upsert-cases-v1"
        let root = try root(fixtureId, "upsert-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 10, "expected the declared upsert cases")
        for value in cases {
            let c = try value.requireObject("plan-adjustment-identity upsert case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "upsert", "\(label): kind")
            let drafts = try (c.optionalArray("drafts") ?? []).map { try ProgramAdjustmentDraft(decoding: $0) }
            let history = try (c.optionalArray("adjustmentHistory") ?? []).map { try ProgramAdjustmentHistoryItem(decoding: $0) }
            let candidate = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c["candidateDraft"], "\(label): candidateDraft"))
            let result = Engine.upsertPlanAdjustmentDraftByFingerprint(
                drafts: drafts,
                adjustmentHistory: history,
                candidateDraft: candidate,
                sourceFingerprint: c.optionalString("sourceFingerprint")
            )
            let goldenResult = try XCTUnwrap(c.optionalObject("result"), "\(label): result")
            XCTAssertEqual(result.outcome.rawValue, goldenResult.optionalString("outcome"), "\(label): outcome")
            XCTAssertEqual(result.sourceFingerprint, goldenResult.optionalString("sourceFingerprint"), "\(label): sourceFingerprint")
            XCTAssertEqual(idList(result.drafts), goldenIdList(goldenResult.optionalArray("draftIds") ?? []), "\(label): draftIds")
            XCTAssertEqual(result.targetDraft?.id, goldenResult.optionalString("targetDraftId"), "\(label): targetDraftId")
            XCTAssertEqual(result.historyItem?.id, goldenResult.optionalString("historyItemId"), "\(label): historyItemId")
            XCTAssertEqual(result.createdDraft?.id, goldenResult.optionalString("createdDraftId"), "\(label): createdDraftId")
            // Full-fidelity canonical compare of the created draft (the normalizeDraftForUpsert spread).
            try assertDraftCanonical(result.createdDraft, c.rawValue("createdDraft"), label)
        }
    }

    // MARK: - regenerate-cases (findReusable + regenerate)

    func testRegenerateCasesParity() throws {
        let fixtureId = "plan-adjustment-identity/regenerate-cases-v1"
        let root = try root(fixtureId, "regenerate-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 10, "expected the declared regenerate cases")
        for value in cases {
            let c = try value.requireObject("plan-adjustment-identity regenerate case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            let source = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c["sourceDraft"], "\(label): sourceDraft"))
            let drafts = try (c.optionalArray("drafts") ?? []).map { try ProgramAdjustmentDraft(decoding: $0) }
            switch c.optionalString("kind") {
            case "findReusable":
                let found = Engine.findReusablePlanAdjustmentDraft(source, drafts)
                XCTAssertEqual(found?.id, c.optionalString("foundId"), "\(fixtureId)/\(label): foundId")
            case "regenerate":
                let now = try XCTUnwrap(c.optionalString("now"), "\(label): now (injected clock required)")
                let result = Engine.buildRegeneratedPlanAdjustmentDraft(
                    source, drafts, now: now, draftId: c.optionalString("draftId")
                )
                XCTAssertEqual(result.sourceFingerprint, c.optionalString("sourceFingerprint"), "\(label): sourceFingerprint")
                XCTAssertEqual(result.existingDraft?.id, c.optionalString("existingDraftId"), "\(label): existingDraftId")
                try assertDraftCanonical(result.draft, c.rawValue("draft"), label)
            case let other:
                XCTFail("\(label): unexpected kind \(other ?? "nil")")
            }
        }
    }
}
