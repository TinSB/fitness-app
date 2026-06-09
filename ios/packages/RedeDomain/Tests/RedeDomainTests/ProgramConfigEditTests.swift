// ProgramConfigEditTests — EDIT-4 Program Config Edit V1.
//
// REAL unit tests for the pure program-config-edit helpers used by the fourth native
// canonical-AppData EDIT write path (reusing the §8.3 edit-write boundary):
//   * ProgramTemplate.withConfigScalars — replaces the 3 editable scalar config fields
//     (主要目标 primaryGoal / 分项 splitType / 每周天数 daysPerWeek), preserves id /
//     userId / the engine-managed correctionStrategy + functionalStrategy strategy
//     blobs / the program's own open bag (_unknown)
//   * AppData.withUpdatedProgramConfig — rewrites ONLY the `programTemplate` key,
//     preserves every other top-level key + unknown fields, never bumps schemaVersion,
//     is a pure value transform (no IO), and round-trips through canonical bytes
//   * the edit NEVER touches the engine-managed structured plan (mesocyclePlan weeks),
//     the program strategy blobs, history, or health samples
//
// Run via `swift test`. Deterministic; never touches disk/network.

import XCTest
@testable import RedeDomain

final class ProgramConfigEditTests: XCTestCase {

    private func program(_ json: String) throws -> ProgramTemplate {
        try ProgramTemplate(decoding: JSONValue(decoding: Data(json.utf8)))
    }

    // MARK: - ProgramTemplate.withConfigScalars

    func testWithConfigScalarsReplacesScalarsAndPreservesStrategiesAndOpenBag() throws {
        let original = try program("""
        {"id":"p1","userId":"u1",\
        "primaryGoal":"增肌",\
        "splitType":"全身",\
        "daysPerWeek":3,\
        "correctionStrategy":{"hingePriority":true},\
        "functionalStrategy":{"carry":["farmer"]},\
        "customProgramKey":"keepme"}
        """)

        let edited = original.withConfigScalars(
            primaryGoal: "力量",
            splitType: "推 / 拉 / 腿",
            daysPerWeek: .integer(4)
        )

        // The 3 editable scalars are replaced.
        XCTAssertEqual(edited.primaryGoal, "力量")
        XCTAssertEqual(edited.splitType, "推 / 拉 / 腿")
        XCTAssertEqual(edited.daysPerWeek?.intValue, 4)

        // Everything else is preserved verbatim — id, userId, the engine-managed
        // strategy blobs, and the program's own open bag.
        XCTAssertEqual(edited.id, "p1")
        XCTAssertEqual(edited.userId, "u1")
        XCTAssertNotNil(edited.correctionStrategy)
        XCTAssertNotNil(edited.functionalStrategy)
        XCTAssertEqual(edited._unknown["customProgramKey"]?.stringValue, "keepme")
        // The engine-managed strategy blobs are carried through verbatim.
        let canonical = try edited.encoded().canonicalJSONData()
        let text = String(decoding: canonical, as: UTF8.self)
        XCTAssertTrue(text.contains("\"correctionStrategy\":{\"hingePriority\":true}"), "correctionStrategy lost: \(text)")
        XCTAssertTrue(text.contains("\"functionalStrategy\":{\"carry\":[\"farmer\"]}"), "functionalStrategy lost: \(text)")
    }

    func testWithConfigScalarsNilWritesHonestUnset() throws {
        let original = try program("""
        {"id":"p1","primaryGoal":"增肌","splitType":"全身","daysPerWeek":3}
        """)
        let edited = original.withConfigScalars(primaryGoal: nil, splitType: nil, daysPerWeek: nil)
        XCTAssertNil(edited.primaryGoal)
        XCTAssertNil(edited.splitType)
        XCTAssertNil(edited.daysPerWeek)
        XCTAssertEqual(edited.id, "p1", "id preserved even when every scalar clears")
        // Encoded form omits the now-nil scalars (honest "not set"), never an empty value.
        guard case .object(let obj) = edited.encoded() else { return XCTFail("expected object") }
        XCTAssertNil(obj["primaryGoal"])
        XCTAssertNil(obj["splitType"])
        XCTAssertNil(obj["daysPerWeek"])
    }

    // MARK: - AppData.withUpdatedProgramConfig (open-bag preserving)

    func testWithUpdatedProgramConfigRewritesOnlyProgramAndPreservesOpenBag() throws {
        // A document with a program template (carrying engine-managed strategy blobs +
        // its own unknown key), plus a mesocycle plan, history, and a top-level unknown.
        let json = """
        {"schemaVersion":8,\
        "programTemplate":{"id":"p1","userId":"u1","primaryGoal":"增肌","splitType":"全身","daysPerWeek":3,"correctionStrategy":{"hingePriority":true},"customProgramKey":"keepme"},\
        "mesocyclePlan":{"id":"m1","phase":"积累期","weeks":[{"index":1},{"index":2}]},\
        "history":[{"id":"old","completed":true}],\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))

        let next = appData.withUpdatedProgramConfig(
            primaryGoal: "力量",
            splitType: "推 / 拉 / 腿",
            daysPerWeek: .integer(4)
        )

        // programTemplate rewritten with the new scalars.
        XCTAssertEqual(next.programTemplate.primaryGoal, "力量")
        XCTAssertEqual(next.programTemplate.splitType, "推 / 拉 / 腿")
        XCTAssertEqual(next.programTemplate.daysPerWeek?.intValue, 4)
        // The program's id / userId + engine-managed strategy + its own open-bag key
        // survive the edit.
        XCTAssertEqual(next.programTemplate.id, "p1")
        XCTAssertEqual(next.programTemplate.userId, "u1")
        XCTAssertNotNil(next.programTemplate.correctionStrategy)
        XCTAssertEqual(next.programTemplate._unknown["customProgramKey"]?.stringValue, "keepme")
        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // The engine-managed structured mesocycle (weeks) is untouched.
        XCTAssertEqual(next.mesocyclePlan.id, "m1")
        XCTAssertEqual(next.mesocyclePlan.weeks?.arrayValue?.count, 2)
        // Every other top-level key + the top-level unknown survive verbatim.
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "old")
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"customProgramKey\":\"keepme\""), "program open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"correctionStrategy\":{\"hingePriority\":true}"), "engine strategy lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"weeks\":[{\"index\":1},{\"index\":2}]"), "mesocycle weeks lost: \(canonical)")
        // Re-decodes cleanly (valid canonical document).
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(reDecoded.programTemplate.primaryGoal, "力量")
    }

    func testWithUpdatedProgramConfigAddsKeyWhenAbsent() throws {
        let appData = AppData.emptyCurrent()   // {"schemaVersion":8,"history":[]} — no programTemplate
        let next = appData.withUpdatedProgramConfig(
            primaryGoal: "增肌", splitType: nil, daysPerWeek: .integer(4)
        )
        XCTAssertEqual(next.programTemplate.primaryGoal, "增肌")
        XCTAssertNil(next.programTemplate.splitType)
        XCTAssertEqual(next.programTemplate.daysPerWeek?.intValue, 4)
        // history still present + empty; schema unchanged.
        XCTAssertTrue(next.history.isEmpty)
        XCTAssertEqual(next.schemaVersion, .current)
        _ = try next.canonicalJSONData()   // round-trips
    }

    func testWithUpdatedProgramConfigDoesNotMutateReceiver() throws {
        let json = """
        {"schemaVersion":8,"programTemplate":{"primaryGoal":"增肌"}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        _ = appData.withUpdatedProgramConfig(primaryGoal: "力量", splitType: nil, daysPerWeek: nil)
        // Value semantics: the original is untouched.
        XCTAssertEqual(appData.programTemplate.primaryGoal, "增肌")
    }

    // MARK: - The edit never touches engine-managed structure / history / health samples

    func testEditTouchesNeitherStrategiesNorMesocycleNorHistory() throws {
        let json = """
        {"schemaVersion":8,\
        "programTemplate":{"primaryGoal":"增肌","daysPerWeek":3,"correctionStrategy":{"hingePriority":true},"functionalStrategy":{"carry":["farmer"]}},\
        "mesocyclePlan":{"phase":"积累期","weeks":[{"index":1}]},\
        "healthMetricSamples":[{"id":"h1","metricType":"body_weight","unit":"kg","value":72.5,"startDate":"2026-05-27T06:30:00.000Z"}],\
        "history":[{"id":"s1","completed":true}]}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        let next = appData.withUpdatedProgramConfig(
            primaryGoal: "力量", splitType: "推 / 拉 / 腿", daysPerWeek: .integer(4)
        )

        // The user scalar changed…
        XCTAssertEqual(next.programTemplate.primaryGoal, "力量")
        XCTAssertEqual(next.programTemplate.daysPerWeek?.intValue, 4)
        // …but the engine-managed strategy blobs are carried through verbatim (the engine,
        // not this edit, owns them).
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"correctionStrategy\":{\"hingePriority\":true}"), "correctionStrategy lost")
        XCTAssertTrue(canonical.contains("\"functionalStrategy\":{\"carry\":[\"farmer\"]}"), "functionalStrategy lost")
        // And the engine-managed structured mesocycle weeks + history + health samples are
        // untouched (distinct sources, never edited here).
        XCTAssertTrue(canonical.contains("\"weeks\":[{\"index\":1}]"), "mesocycle weeks lost")
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "s1")
        XCTAssertEqual(next.healthMetricSamples.count, 1)
        XCTAssertEqual(next.healthMetricSamples.first?.value?.doubleValue ?? -1, 72.5, accuracy: 1e-9)
    }
}
