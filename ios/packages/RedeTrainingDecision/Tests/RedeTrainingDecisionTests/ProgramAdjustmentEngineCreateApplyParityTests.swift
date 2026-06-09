// PA-S9 (PA-1c) — programAdjustmentEngine createAdjustmentDraftFromRecommendations +
// applyAdjustmentDraft function-level parity tests (completing PA-1).
//
// FUNCTION-LEVEL compute-assert over the two `program-adjust/*` goldens: for each case
// decode the echoed engineInput, run the PORTED ProgramAdjustmentEngine on the SAME inputs
// with the SAME injected clock / makeId seed the generator used, and assert the produced
// output canonical-equals the golden —
//   create-draft-cases → ProgramAdjustmentDraft canonical-equality (id rewrite via S6
//                        fingerprint/instanceId, createdAt/sourceTemplateUpdatedAt injected
//                        clock, changes via changeFromRecommendation, confidence/riskLevel
//                        tiers, summary/notes, explanation, S8 diffPreview), covering
//                        add_sets / add_new (resolved & pain-blocked) / remove_sets / swap /
//                        reduce_support / keep / empty-actionable / multi-change resolvePrimary.
//   apply-draft-cases  → ApplyAdjustmentDraftResult canonical-equality (ok / message / draft
//                        spread+overrides / experimentalTemplate / updatedProgramTemplate /
//                        historyItem), covering hash-mismatch expired, hash-match & no-hash
//                        apply, add_new skip / apply, support apply & skip, swap apply & skip,
//                        add_sets not-found skip, summarizeMainChanges, ensureProgramDayTemplate,
//                        and the historyItem assembly (injected nowIso / makeId seed).
// Plus a direct makeId assertion (the injected-seed pure concat).
//
// The goldens are GENERATED from the retired legacy programAdjustmentEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / ZERO WRITE — the
// port computes on clones and returns the result; no IO beyond reading the committed goldens.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class ProgramAdjustmentEngineCreateApplyParityTests: XCTestCase {

    private typealias Engine = ProgramAdjustmentEngine

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static func goldenURL(_ name: String) -> URL {
        repoRoot.appendingPathComponent(
            "ios/ParityFixtures/parity/golden/program-adjust/\(name).json", isDirectory: false
        )
    }

    private func root(_ fixtureId: String, _ name: String) throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(name))
        return try JSONValue(decoding: data).requireObject(fixtureId)
    }

    // MARK: - envelopes

    func testGoldenEnvelopes() throws {
        for name in ["create-draft-cases-v1", "apply-draft-cases-v1", "apply-draft-opaque-cases-v1"] {
            XCTAssertTrue(
                FileManager.default.fileExists(atPath: Self.goldenURL(name).path),
                "missing program-adjust golden: \(name)"
            )
            let id = "program-adjust/\(name)"
            XCTAssertEqual(try root(id, name).optionalString("sourceFixtureId"), id)
        }
    }

    // MARK: - makeId (programAdjustmentEngine.ts:80) — injected-seed pure concat

    func testMakeIdInjectedSeed() {
        XCTAssertEqual(Engine.makeId("adjustment-history", idSeed: "test-history-seed"), "adjustment-history-test-history-seed")
        XCTAssertEqual(Engine.makeId("p", idSeed: "abc123"), "p-abc123")
    }

    // MARK: - create-draft-cases (createAdjustmentDraftFromRecommendations)

    func testCreateDraftCasesParity() throws {
        let fixtureId = "program-adjust/create-draft-cases-v1"
        let root = try root(fixtureId, "create-draft-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 9, "expected the declared create-draft cases")
        for value in cases {
            let c = try value.requireObject("program-adjust create-draft case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "create-draft", "\(label): kind")

            let recommendations = try (c.rawValue("recommendations")?.arrayValue ?? []).map {
                try WeeklyActionRecommendation(decoding: $0)
            }
            let source = try TrainingTemplate(decoding: try XCTUnwrap(c.rawValue("sourceProgramTemplate"), "\(label): sourceProgramTemplate"))
            let context = try decodeContext(c.optionalObject("context"))
            let nowIso = try XCTUnwrap(c.optionalString("now"), "\(label): now")

            let result = Engine.createAdjustmentDraftFromRecommendations(
                recommendations, sourceProgramTemplate: source, context: context, nowIso: nowIso
            )

            let computed = try result.encoded().canonicalJSONString()
            let golden = try XCTUnwrap(c.rawValue("result"), "\(label): result").canonicalJSONString()
            XCTAssertEqual(computed, golden, "\(fixtureId)/\(label): ProgramAdjustmentDraft canonical mismatch")
        }
    }

    // MARK: - apply-draft-cases (applyAdjustmentDraft)

    func testApplyDraftCasesParity() throws {
        let fixtureId = "program-adjust/apply-draft-cases-v1"
        let root = try root(fixtureId, "apply-draft-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 9, "expected the declared apply-draft cases")
        for value in cases {
            let c = try value.requireObject("program-adjust apply-draft case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "apply-draft", "\(label): kind")

            let draft = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c.rawValue("draft"), "\(label): draft"))
            let source = try TrainingTemplate(decoding: try XCTUnwrap(c.rawValue("sourceProgramTemplate"), "\(label): sourceProgramTemplate"))

            // Omitted (null) currentProgramTemplate / templates ⇒ the legacy web schema default params
            // (DEFAULT_PROGRAM_TEMPLATE / [sourceProgramTemplate]); pass nil so the Swift port
            // substitutes the same defaults.
            let programValue = c.rawValue("currentProgramTemplate")
            let currentProgram: ProgramTemplate? = (programValue == nil || programValue!.isNull)
                ? nil : try ProgramTemplate(decoding: programValue!)
            let templatesValue = c.rawValue("templates")
            let templates: [TrainingTemplate]? = (templatesValue == nil || templatesValue!.isNull)
                ? nil : try (templatesValue!.arrayValue ?? []).map { try TrainingTemplate(decoding: $0) }

            let nowIso = try XCTUnwrap(c.optionalString("now"), "\(label): now")
            let historyIdSeed = try XCTUnwrap(c.optionalString("historyIdSeed"), "\(label): historyIdSeed")

            let result = Engine.applyAdjustmentDraft(
                draft, sourceProgramTemplate: source,
                currentProgramTemplate: currentProgram, templates: templates,
                nowIso: nowIso, historyIdSeed: historyIdSeed
            )

            let computed = try result.encoded().canonicalJSONString()
            let golden = try XCTUnwrap(c.rawValue("result"), "\(label): result").canonicalJSONString()
            XCTAssertEqual(computed, golden, "\(fixtureId)/\(label): ApplyAdjustmentDraftResult canonical mismatch")
        }
    }

    // MARK: - apply-draft-opaque-cases (PA-FIX: WDay open-bag round-trip / data safety)

    /// Pins the S10 data-safety prerequisite: applyAdjustmentDraft rebuilds
    /// `updatedProgramTemplate.dayTemplates` (the value the §8.3 write boundary persists),
    /// and the lossless WDay open-bag mirror must carry each day's UNKNOWN/future keys +
    /// keep an ABSENT optional block omitted (not materialised as []). The golden is the
    /// retired legacy result (cloneProgram + in-place mutation); the pre-fix lossy WDay (7 fields,
    /// no `_unknown`, `?? []`) would drop the unknown keys and emit empty arrays → mismatch.
    /// Same shape as `testApplyDraftCasesParity`, over the additive opaque fixture.
    func testApplyDraftOpaqueCasesParity() throws {
        let fixtureId = "program-adjust/apply-draft-opaque-cases-v1"
        let root = try root(fixtureId, "apply-draft-opaque-cases-v1")
        let cases = root.optionalArray("cases") ?? []
        XCTAssertGreaterThanOrEqual(cases.count, 1, "expected the open-bag data-safety case")
        for value in cases {
            let c = try value.requireObject("program-adjust apply-draft-opaque case")
            let label = c.optionalString("label") ?? "(unlabeled)"
            XCTAssertEqual(c.optionalString("kind"), "apply-draft", "\(label): kind")

            let draft = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c.rawValue("draft"), "\(label): draft"))
            let source = try TrainingTemplate(decoding: try XCTUnwrap(c.rawValue("sourceProgramTemplate"), "\(label): sourceProgramTemplate"))
            let programValue = c.rawValue("currentProgramTemplate")
            let currentProgram: ProgramTemplate? = (programValue == nil || programValue!.isNull)
                ? nil : try ProgramTemplate(decoding: programValue!)
            let templatesValue = c.rawValue("templates")
            let templates: [TrainingTemplate]? = (templatesValue == nil || templatesValue!.isNull)
                ? nil : try (templatesValue!.arrayValue ?? []).map { try TrainingTemplate(decoding: $0) }

            let nowIso = try XCTUnwrap(c.optionalString("now"), "\(label): now")
            let historyIdSeed = try XCTUnwrap(c.optionalString("historyIdSeed"), "\(label): historyIdSeed")

            let result = Engine.applyAdjustmentDraft(
                draft, sourceProgramTemplate: source,
                currentProgramTemplate: currentProgram, templates: templates,
                nowIso: nowIso, historyIdSeed: historyIdSeed
            )

            let computed = try result.encoded().canonicalJSONString()
            let golden = try XCTUnwrap(c.rawValue("result"), "\(label): result").canonicalJSONString()
            XCTAssertEqual(computed, golden, "\(fixtureId)/\(label): ApplyAdjustmentDraftResult canonical mismatch")
        }
    }

    // MARK: - decoders

    /// `AdjustmentDraftContext` from the echoed `context` object.
    private func decodeContext(_ obj: OrderedJSONObject?) throws -> Engine.AdjustmentDraftContext {
        guard let obj else { return Engine.AdjustmentDraftContext() }
        let templates: [TrainingTemplate]? = try obj.optionalArray("templates")?.map { try TrainingTemplate(decoding: $0) }
        let screening: ScreeningProfile? = try obj.optionalObject("screeningProfile").map { try ScreeningProfile(decoding: .object($0)) }
        let program: ProgramTemplate? = try obj.optionalObject("programTemplate").map { try ProgramTemplate(decoding: .object($0)) }
        let painPatterns: [Engine.DraftPainPattern]? = obj.optionalArray("painPatterns")?.map { pv in
            let po = pv.objectValue
            return Engine.DraftPainPattern(
                exerciseId: po?.optionalString("exerciseId"),
                suggestedAction: po?.optionalString("suggestedAction")
            )
        }
        return Engine.AdjustmentDraftContext(
            programTemplate: program, templates: templates,
            screeningProfile: screening, painPatterns: painPatterns
        )
    }
}
