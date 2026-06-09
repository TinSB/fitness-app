// ScreeningProfileEditTests — EDIT-3 Screening Profile Edit V1.
//
// REAL unit tests for the pure screening-edit helpers used by the third native
// canonical-AppData EDIT write path (reusing the §8.3 edit-write boundary):
//   * ScreeningProfile.withEditedLists — replaces the 3 editable lists (疼痛触发 /
//     受限动作 / 纠正优先), preserves userId / postureFlags / movementFlags /
//     adaptiveState (engine-managed) / the screening's own open bag (_unknown)
//   * AppData.withUpdatedScreening — rewrites ONLY the `screeningProfile` key,
//     preserves every other top-level key + unknown fields, never bumps
//     schemaVersion, is a pure value transform (no IO), and round-trips through
//     canonical bytes
//   * the edit NEVER touches the engine-managed adaptiveState (issueScores /
//     performanceDrops), history, or healthMetricSamples
//
// Run via `swift test`. Deterministic; never touches disk/network.

import XCTest
@testable import RedeDomain

final class ScreeningProfileEditTests: XCTestCase {

    private func screening(_ json: String) throws -> ScreeningProfile {
        try ScreeningProfile(decoding: JSONValue(decoding: Data(json.utf8)))
    }

    // MARK: - ScreeningProfile.withEditedLists

    func testWithEditedListsReplacesListsAndPreservesEngineManagedFields() throws {
        let original = try screening("""
        {"userId":"u1",\
        "painTriggers":["膝前侧"],\
        "restrictedExercises":["杠铃过顶推举"],\
        "correctionPriority":["髋关节灵活性"],\
        "postureFlags":{"anteriorPelvicTilt":true},\
        "movementFlags":{"squatDepth":"limited"},\
        "adaptiveState":{"issueScores":{"knee":3}},\
        "customScreeningKey":"keepme"}
        """)

        let edited = original.withEditedLists(
            painTriggers: ["膝前侧（深蹲过深）", "右肩"],
            restrictedExercises: ["杠铃过顶推举", "硬拉"],
            correctionPriority: ["髋关节灵活性", "肩胛稳定性"]
        )

        // The 3 editable lists are replaced.
        XCTAssertEqual(edited.painTriggers, ["膝前侧（深蹲过深）", "右肩"])
        XCTAssertEqual(edited.restrictedExercises, ["杠铃过顶推举", "硬拉"])
        XCTAssertEqual(edited.correctionPriority, ["髋关节灵活性", "肩胛稳定性"])

        // Everything else is preserved verbatim — userId, the engine-managed flags +
        // adaptiveState, and the screening's own open bag.
        XCTAssertEqual(edited.userId, "u1")
        XCTAssertNotNil(edited.postureFlags)
        XCTAssertNotNil(edited.movementFlags)
        XCTAssertNotNil(edited.adaptiveState)
        XCTAssertEqual(edited._unknown["customScreeningKey"]?.stringValue, "keepme")
        // The engine-managed issueScores carried in adaptiveState are untouched.
        let canonical = try edited.encoded().canonicalJSONData()
        XCTAssertTrue(String(decoding: canonical, as: UTF8.self).contains("\"issueScores\":{\"knee\":3}"))
    }

    func testWithEditedListsNilWritesHonestUnset() throws {
        let original = try screening("""
        {"userId":"u1","painTriggers":["膝前侧"],"correctionPriority":["髋灵活性"]}
        """)
        let edited = original.withEditedLists(
            painTriggers: nil, restrictedExercises: nil, correctionPriority: nil
        )
        XCTAssertNil(edited.painTriggers)
        XCTAssertNil(edited.restrictedExercises)
        XCTAssertNil(edited.correctionPriority)
        XCTAssertEqual(edited.userId, "u1", "userId preserved even when every list clears")
        // Encoded form omits the now-nil lists (honest "not set"), never an empty array.
        guard case .object(let obj) = edited.encoded() else { return XCTFail("expected object") }
        XCTAssertNil(obj["painTriggers"])
        XCTAssertNil(obj["restrictedExercises"])
        XCTAssertNil(obj["correctionPriority"])
    }

    // MARK: - AppData.withUpdatedScreening (open-bag preserving)

    func testWithUpdatedScreeningRewritesOnlyScreeningAndPreservesOpenBag() throws {
        // A document with a screening profile (carrying an engine-managed adaptiveState
        // + its own unknown key), plus history, settings, and a top-level unknown key.
        let json = """
        {"schemaVersion":8,\
        "screeningProfile":{"userId":"u1","painTriggers":["膝前侧"],"adaptiveState":{"issueScores":{"knee":3}},"customScreeningKey":"keepme"},\
        "history":[{"id":"old","completed":true}],\
        "settings":{"weightUnit":"kg"},\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))

        let edited = appData.screeningProfile.withEditedLists(
            painTriggers: ["膝前侧", "右肩"],
            restrictedExercises: ["杠铃过顶推举"],
            correctionPriority: nil
        )
        let next = appData.withUpdatedScreening(edited)

        // screeningProfile rewritten with the new lists.
        XCTAssertEqual(next.screeningProfile.painTriggers, ["膝前侧", "右肩"])
        XCTAssertEqual(next.screeningProfile.restrictedExercises, ["杠铃过顶推举"])
        XCTAssertNil(next.screeningProfile.correctionPriority)
        // The screening's userId + engine-managed adaptiveState + its own open-bag key
        // survive the edit.
        XCTAssertEqual(next.screeningProfile.userId, "u1")
        XCTAssertNotNil(next.screeningProfile.adaptiveState)
        XCTAssertEqual(next.screeningProfile._unknown["customScreeningKey"]?.stringValue, "keepme")
        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // Every other top-level key + the top-level unknown survive verbatim.
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "old")
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"settings\":{\"weightUnit\":\"kg\"}"), "settings lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"customScreeningKey\":\"keepme\""), "screening open-bag lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"issueScores\":{\"knee\":3}"), "engine adaptiveState lost: \(canonical)")
        // Re-decodes cleanly (valid canonical document).
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(reDecoded.screeningProfile.painTriggers, ["膝前侧", "右肩"])
    }

    func testWithUpdatedScreeningAddsKeyWhenAbsent() throws {
        let appData = AppData.emptyCurrent()   // {"schemaVersion":8,"history":[]} — no screeningProfile
        let s = ScreeningProfile(painTriggers: ["膝前侧"])
        let next = appData.withUpdatedScreening(s)
        XCTAssertEqual(next.screeningProfile.painTriggers, ["膝前侧"])
        // history still present + empty; schema unchanged.
        XCTAssertTrue(next.history.isEmpty)
        XCTAssertEqual(next.schemaVersion, .current)
        _ = try next.canonicalJSONData()   // round-trips
    }

    func testWithUpdatedScreeningDoesNotMutateReceiver() throws {
        let json = """
        {"schemaVersion":8,"screeningProfile":{"painTriggers":["膝前侧"]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        _ = appData.withUpdatedScreening(ScreeningProfile(painTriggers: ["右肩"]))
        // Value semantics: the original is untouched.
        XCTAssertEqual(appData.screeningProfile.painTriggers, ["膝前侧"])
    }

    // MARK: - The edit never touches engine-managed state / history / health samples

    func testEditTouchesNeitherAdaptiveStateNorHistoryNorHealth() throws {
        let json = """
        {"schemaVersion":8,\
        "screeningProfile":{"painTriggers":["膝前侧"],"adaptiveState":{"issueScores":{"knee":3},"performanceDrops":["squat"]}},\
        "healthMetricSamples":[{"id":"h1","metricType":"body_weight","unit":"kg","value":72.5,"startDate":"2026-05-27T06:30:00.000Z"}],\
        "history":[{"id":"s1","completed":true}]}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        let edited = appData.screeningProfile.withEditedLists(
            painTriggers: ["膝前侧", "右肩"], restrictedExercises: nil, correctionPriority: nil
        )
        let next = appData.withUpdatedScreening(edited)

        // The self-reported list changed…
        XCTAssertEqual(next.screeningProfile.painTriggers, ["膝前侧", "右肩"])
        // …but the engine-managed adaptiveState (issueScores + performanceDrops) is
        // carried through verbatim (DataHealth, not this edit, owns it).
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("\"issueScores\":{\"knee\":3}"), "issueScores lost")
        XCTAssertTrue(canonical.contains("\"performanceDrops\":[\"squat\"]"), "performanceDrops lost")
        // And history + health samples are untouched (distinct sources).
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "s1")
        XCTAssertEqual(next.healthMetricSamples.count, 1)
        XCTAssertEqual(next.healthMetricSamples.first?.value?.doubleValue ?? -1, 72.5, accuracy: 1e-9)
    }
}
