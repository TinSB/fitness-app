// ProgramAdjustmentApplyEditTests — PA-2 (S10) Plan-Adaptive Apply-Write V1.
//
// REAL unit tests for the pure apply-write Domain helper used by the Plan-Adaptive
// apply-write path (reusing the §8.3 edit-write boundary):
//   * AppData.withUpdatedProgramTemplate — rewrites ONLY the `programTemplate` key with
//     a WHOLE new editable program template (its rich `dayTemplates` /
//     `weeklyMuscleTargets` / `correctionStrategy` / `functionalStrategy`), preserves
//     every OTHER top-level key + all unknown fields, never bumps schemaVersion, is a
//     pure value transform (no IO), and round-trips through canonical bytes.
//   * the helper NEVER touches an engine OUTPUT (the `mesocyclePlan` weeks blob lives in
//     a different top-level key and is carried through verbatim), history, or health
//     samples.
//
// Run via `swift test`. Deterministic; never touches disk/network/clock.

import XCTest
@testable import RedeDomain

final class ProgramAdjustmentApplyEditTests: XCTestCase {

    private func program(_ json: String) throws -> ProgramTemplate {
        try ProgramTemplate(decoding: JSONValue(decoding: Data(json.utf8)))
    }

    // MARK: - AppData.withUpdatedProgramTemplate (whole-template, open-bag preserving)

    func testWithUpdatedProgramTemplateRewritesOnlyProgramAndPreservesEverythingElse() throws {
        // A document with a program template, an engine-managed mesocycle plan (an OUTPUT),
        // history, and a top-level unknown key.
        let json = """
        {"schemaVersion":8,\
        "programTemplate":{"id":"p1","userId":"u1","primaryGoal":"增肌","splitType":"全身","daysPerWeek":3},\
        "mesocyclePlan":{"id":"m1","phase":"积累期","weeks":[{"index":1},{"index":2}]},\
        "history":[{"id":"old","completed":true}],\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))

        // The WHOLE new editable program the PA engine produced: new scalars + new
        // dayTemplates / weeklyMuscleTargets (rich PA projections living in the open bag)
        // + engine-managed strategy blobs + its own unknown program key.
        let updated = try program("""
        {"id":"p1-experiment","userId":"u1",\
        "primaryGoal":"力量","splitType":"推 / 拉 / 腿","daysPerWeek":4,\
        "correctionStrategy":{"hingePriority":true},\
        "functionalStrategy":{"carry":["farmer"]},\
        "dayTemplates":[{"id":"d1","name":"推","exercises":[{"id":"bench","sets":4}]}],\
        "weeklyMuscleTargets":{"chest":12,"back":14},\
        "experimentProgramKey":"keepme"}
        """)

        let next = appData.withUpdatedProgramTemplate(updated)

        // programTemplate is wholesale replaced by `updated`.
        XCTAssertEqual(next.programTemplate.id, "p1-experiment")
        XCTAssertEqual(next.programTemplate.primaryGoal, "力量")
        XCTAssertEqual(next.programTemplate.splitType, "推 / 拉 / 腿")
        XCTAssertEqual(next.programTemplate.daysPerWeek?.intValue, 4)
        // The rich PA projections decode from the written program's open bag (PA-S1).
        XCTAssertEqual(next.programTemplate.dayTemplates?.count, 1)
        XCTAssertEqual(next.programTemplate.dayTemplates?.first?.id, "d1")
        XCTAssertEqual(next.programTemplate.weeklyMuscleTargets?["chest"]?.intValue, 12)
        XCTAssertEqual(next.programTemplate.weeklyMuscleTargets?["back"]?.intValue, 14)
        // The replacement program's own open-bag key + strategy blobs survive.
        XCTAssertEqual(next.programTemplate._unknown["experimentProgramKey"]?.stringValue, "keepme")
        XCTAssertNotNil(next.programTemplate.correctionStrategy)
        XCTAssertNotNil(next.programTemplate.functionalStrategy)
        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // The engine-managed structured mesocycle (an OUTPUT) is untouched.
        XCTAssertEqual(next.mesocyclePlan.id, "m1")
        XCTAssertEqual(next.mesocyclePlan.weeks?.arrayValue?.count, 2)
        // Every other top-level key + the top-level unknown survive verbatim.
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "old")
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"weeks\":[{\"index\":1},{\"index\":2}]"), "mesocycle weeks (engine output) lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"weeklyMuscleTargets\""), "weeklyMuscleTargets lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"experimentProgramKey\":\"keepme\""), "program open-bag lost: \(canonical)")
        // Re-decodes cleanly (valid canonical document).
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(reDecoded.programTemplate.id, "p1-experiment")
        XCTAssertEqual(reDecoded.programTemplate.dayTemplates?.first?.id, "d1")
    }

    func testWithUpdatedProgramTemplateReplacesWholesale_oldProgramKeysGone() throws {
        // The old program carries a key the new one omits — a wholesale replacement must
        // drop it (this is an apply of a NEW template, not a per-field merge).
        let json = """
        {"schemaVersion":8,\
        "programTemplate":{"id":"p1","primaryGoal":"增肌","staleProgramKey":"dropme"}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        let updated = try program("""
        {"id":"p1-experiment","primaryGoal":"力量"}
        """)
        let next = appData.withUpdatedProgramTemplate(updated)

        XCTAssertEqual(next.programTemplate.id, "p1-experiment")
        XCTAssertEqual(next.programTemplate.primaryGoal, "力量")
        XCTAssertNil(next.programTemplate._unknown["staleProgramKey"], "stale program key must not survive a wholesale apply")
        let canonical = try next.canonicalJSONString()
        XCTAssertFalse(canonical.contains("staleProgramKey"), "wholesale apply must drop the old program's keys: \(canonical)")
    }

    func testWithUpdatedProgramTemplateAddsKeyWhenAbsent() throws {
        let appData = AppData.emptyCurrent()   // {"schemaVersion":8,"history":[]} — no programTemplate
        let updated = try program("""
        {"id":"p1","primaryGoal":"增肌","daysPerWeek":4}
        """)
        let next = appData.withUpdatedProgramTemplate(updated)

        XCTAssertEqual(next.programTemplate.id, "p1")
        XCTAssertEqual(next.programTemplate.primaryGoal, "增肌")
        XCTAssertEqual(next.programTemplate.daysPerWeek?.intValue, 4)
        // history still present + empty; schema unchanged.
        XCTAssertTrue(next.history.isEmpty)
        XCTAssertEqual(next.schemaVersion, .current)
        _ = try next.canonicalJSONData()   // round-trips
    }

    func testWithUpdatedProgramTemplateDoesNotMutateReceiver() throws {
        let json = """
        {"schemaVersion":8,"programTemplate":{"id":"p1","primaryGoal":"增肌"}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        let updated = try program("""
        {"id":"p1-experiment","primaryGoal":"力量"}
        """)
        _ = appData.withUpdatedProgramTemplate(updated)
        // Value semantics: the original is untouched.
        XCTAssertEqual(appData.programTemplate.id, "p1")
        XCTAssertEqual(appData.programTemplate.primaryGoal, "增肌")
    }

    // MARK: - Lossless round-trip of a decoded engine output (decode → write → decode)

    func testDecodedEngineOutputRoundTripsLosslesslyThroughWrite() throws {
        // Simulate the app layer decoding `applyAdjustmentDraft.updatedProgramTemplate`
        // (a lossless raw program object) into a typed ProgramTemplate, then writing it.
        // The decode→encode round-trip must lose nothing the open bag carries.
        let engineOutputJSON = """
        {"id":"p1-experiment","userId":"u1","primaryGoal":"力量","splitType":"全身","daysPerWeek":3,\
        "correctionStrategy":"hinge","functionalStrategy":"carry",\
        "dayTemplates":[{"id":"d1","name":"全身 实验版","exercises":[{"id":"squat","sets":5},{"id":"bench","sets":4}]}],\
        "weeklyMuscleTargets":{"quads":16,"chest":12},\
        "note":"实验调整：基于 2 条建议","isExperimentalTemplate":true}
        """
        let engineOutput = try JSONValue(decoding: Data(engineOutputJSON.utf8))
        let typed = try ProgramTemplate(decoding: engineOutput)

        let next = AppData.emptyCurrent().withUpdatedProgramTemplate(typed)
        // The written program's canonical bytes equal the engine output's canonical bytes
        // (open-bag round-trip is byte-stable up to canonical key ordering).
        let writtenProgramBytes = try next.programTemplate.encoded().canonicalJSONData()
        let engineOutputBytes = try engineOutput.canonicalJSONData()
        XCTAssertEqual(writtenProgramBytes, engineOutputBytes, "decode→write must round-trip the engine output losslessly")
    }
}
