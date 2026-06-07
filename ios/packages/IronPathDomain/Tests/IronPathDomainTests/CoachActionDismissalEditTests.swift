// CoachActionDismissalEditTests — CC-5 coach-action dismiss WRITE (Domain open-bag half).
//
// REAL unit tests for `AppData.withDismissedCoachAction(actionId:today:)`
// (CoachActionDismissalEdit) — the Domain half of the coach-action capstone's ONLY source-truth
// WRITE (§8.3), a faithful line-by-line mirror of the legacy web app `handleDismissCoachAction`
// (retired-web-reference). These tests pin every CC-5 hard red-line that lives in the value
// transform:
//   * INPUT, NOT OUTPUT — the appended dismiss value carries ONLY `{ actionId, dismissedAt,
//     scope }`; never an engine output / mesocycle / prescription / readiness / e1RM field.
//   * TODAY INJECTION — `dismissedAt` is the `today` ARGUMENT verbatim (no clock read here).
//   * DEDUP FAITHFUL — same scope+actionId+day → REPLACE (not append), keyed on
//     `dismissedAt.prefix(10)` (the `.slice(0,10)` mirror), keeping every other entry verbatim.
//   * DEDUP BASE = read priority (`root || settings`, enginePipeline.ts:102).
//   * DOUBLE-WRITE FAITHFUL — the SAME `nextDismissed` array lands in BOTH
//     `root.dismissedCoachActions` AND `settings.dismissedCoachActions`.
//   * OPEN-BAG — every other top-level key + every other settings key + all unknown fields
//     survive; `schemaVersion` is unchanged; the receiver is never mutated; round-trips clean.
//
// Run via `swift test`. Deterministic; never touches disk/network/clock.

import XCTest
@testable import IronPathDomain

final class CoachActionDismissalEditTests: XCTestCase {

    // MARK: - Helpers

    /// The raw `dismissedCoachActions` array under `root` (the top-level open-bag key).
    private func rootDismissed(_ appData: AppData) -> [JSONValue] {
        appData.root["dismissedCoachActions"]?.arrayValue ?? []
    }

    /// The raw `dismissedCoachActions` array nested under `settings`.
    private func settingsDismissed(_ appData: AppData) -> [JSONValue] {
        appData.settings.dismissedCoachActions?.arrayValue ?? []
    }

    private func field(_ value: JSONValue, _ key: String) -> String? {
        value.objectValue?[key]?.stringValue
    }

    private func appData(_ json: String) throws -> AppData {
        try AppData(decoding: Data(json.utf8))
    }

    // MARK: - INPUT, NOT OUTPUT + TODAY INJECTION

    func testAppendsOnlyThreeFieldEntryWithInjectedToday() throws {
        let base = AppData.emptyCurrent()   // {"schemaVersion":8,"history":[]}
        let next = base.withDismissedCoachAction(actionId: "next-workout-123", today: "2026-06-04")

        let entries = rootDismissed(next)
        XCTAssertEqual(entries.count, 1)
        let entry = try XCTUnwrap(entries.first)

        // INPUT-NOT-OUTPUT: EXACTLY the three user-intent keys — no engine-output field.
        XCTAssertEqual(Set(entry.objectValue?.keys ?? []), ["actionId", "dismissedAt", "scope"])
        XCTAssertEqual(field(entry, "actionId"), "next-workout-123")
        // TODAY INJECTION: dismissedAt is the argument verbatim (no clock).
        XCTAssertEqual(field(entry, "dismissedAt"), "2026-06-04")
        XCTAssertEqual(field(entry, "scope"), "today")
    }

    func testTodayArgumentIsUsedVerbatimNotAClock() throws {
        // A clearly non-"now" civil day proves the value comes from the argument, never a wall clock.
        let next = AppData.emptyCurrent().withDismissedCoachAction(actionId: "a1", today: "1999-12-31")
        XCTAssertEqual(field(try XCTUnwrap(rootDismissed(next).first), "dismissedAt"), "1999-12-31")
    }

    // MARK: - DOUBLE-WRITE FAITHFUL (root + settings get the SAME array)

    func testDoubleWritesSameArrayToRootAndSettings() throws {
        let next = AppData.emptyCurrent().withDismissedCoachAction(actionId: "a1", today: "2026-06-04")

        let rootArr = JSONValue.array(rootDismissed(next))
        let settingsArr = JSONValue.array(settingsDismissed(next))
        // Byte-identical: BOTH halves carry the SAME nextDismissed.
        XCTAssertEqual(try rootArr.canonicalJSONString(), try settingsArr.canonicalJSONString())
        XCTAssertEqual(settingsDismissed(next).count, 1)
        XCTAssertEqual(field(try XCTUnwrap(settingsDismissed(next).first), "actionId"), "a1")
    }

    // MARK: - DEDUP FAITHFUL (same scope+actionId+day → replace, not append)

    func testDedupReplacesSameActionSameDaySameScope() throws {
        let json = """
        {"schemaVersion":8,"history":[],\
        "dismissedCoachActions":[{"actionId":"a1","dismissedAt":"2026-06-04T08:00:00.000Z","scope":"today"}],\
        "settings":{"dismissedCoachActions":[{"actionId":"a1","dismissedAt":"2026-06-04T08:00:00.000Z","scope":"today"}]}}
        """
        let next = try appData(json).withDismissedCoachAction(actionId: "a1", today: "2026-06-04")

        // Replaced, NOT appended — still exactly one entry, now stamped with the new civil day.
        let entries = rootDismissed(next)
        XCTAssertEqual(entries.count, 1, "same scope+actionId+day must REPLACE, not duplicate")
        XCTAssertEqual(field(try XCTUnwrap(entries.first), "dismissedAt"), "2026-06-04")
        // Settings mirrors root.
        XCTAssertEqual(settingsDismissed(next).count, 1)
    }

    func testDedupKeyedOnFirstTenCharsOfDismissedAt() throws {
        // An existing entry whose dismissedAt is a full ISO on the SAME civil day → prefix(10)
        // matches today → replaced.
        let json = """
        {"schemaVersion":8,"history":[],\
        "dismissedCoachActions":[{"actionId":"a1","dismissedAt":"2026-06-04T23:59:59.000Z","scope":"today"}]}
        """
        let next = try appData(json).withDismissedCoachAction(actionId: "a1", today: "2026-06-04")
        XCTAssertEqual(rootDismissed(next).count, 1, "prefix(10) of dismissedAt equals today → dedup")
    }

    func testKeepsDifferentActionDifferentDayDifferentScopeVerbatim() throws {
        let json = """
        {"schemaVersion":8,"history":[],\
        "dismissedCoachActions":[\
        {"actionId":"other","dismissedAt":"2026-06-04T08:00:00.000Z","scope":"today"},\
        {"actionId":"a1","dismissedAt":"2026-06-03T08:00:00.000Z","scope":"today"},\
        {"actionId":"a1","dismissedAt":"2026-06-04T08:00:00.000Z","scope":"forever"}]}
        """
        let next = try appData(json).withDismissedCoachAction(actionId: "a1", today: "2026-06-04")

        // None of the three existing entries match (different actionId / different day / different
        // scope) — all three survive verbatim, and the new one is appended → 4 total.
        let entries = rootDismissed(next)
        XCTAssertEqual(entries.count, 4)
        // The fresh entry is appended LAST (mirror of `[...kept, dismissCoachActionToday(...)]`).
        XCTAssertEqual(field(try XCTUnwrap(entries.last), "actionId"), "a1")
        XCTAssertEqual(field(try XCTUnwrap(entries.last), "dismissedAt"), "2026-06-04")
        XCTAssertEqual(field(try XCTUnwrap(entries.last), "scope"), "today")
        // A non-matching prior entry is preserved verbatim (its full-ISO dismissedAt is untouched).
        XCTAssertEqual(field(entries[0], "dismissedAt"), "2026-06-04T08:00:00.000Z")
    }

    // MARK: - DEDUP BASE = read priority (root || settings)

    func testDedupBaseReadsRootWhenRootPresent() throws {
        // root has a1@today; settings has a DIFFERENT list — the read priority uses ROOT, so a1 is
        // deduped against root (→ replaced) and settings' divergent content is not consulted.
        let json = """
        {"schemaVersion":8,"history":[],\
        "dismissedCoachActions":[{"actionId":"a1","dismissedAt":"2026-06-04T01:00:00.000Z","scope":"today"}],\
        "settings":{"dismissedCoachActions":[{"actionId":"zzz","dismissedAt":"2026-06-04","scope":"today"}]}}
        """
        let next = try appData(json).withDismissedCoachAction(actionId: "a1", today: "2026-06-04")

        // Base was root (the single a1) → replaced → exactly one entry, no "zzz" leaked in.
        let entries = rootDismissed(next)
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(field(try XCTUnwrap(entries.first), "actionId"), "a1")
        XCTAssertFalse(entries.contains { field($0, "actionId") == "zzz" })
    }

    func testDedupBaseFallsBackToSettingsWhenRootAbsent() throws {
        // No root key → read priority falls back to settings. The settings a1@today is the dedup
        // base → replaced (not appended) → one entry.
        let json = """
        {"schemaVersion":8,"history":[],\
        "settings":{"dismissedCoachActions":[{"actionId":"a1","dismissedAt":"2026-06-04T01:00:00.000Z","scope":"today"}]}}
        """
        let next = try appData(json).withDismissedCoachAction(actionId: "a1", today: "2026-06-04")
        XCTAssertEqual(rootDismissed(next).count, 1, "settings was the dedup base → replaced not appended")
        XCTAssertEqual(settingsDismissed(next).count, 1)
    }

    // MARK: - OPEN-BAG preserved + value semantics + round trip

    func testPreservesOpenBagAndSchemaAndDoesNotMutateReceiver() throws {
        let json = """
        {"schemaVersion":8,\
        "history":[{"id":"s1","completed":true}],\
        "userProfile":{"name":"老王"},\
        "settings":{"trainingMode":"auto","selectedTemplateId":"push-a"},\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let original = try appData(json)
        let next = original.withDismissedCoachAction(actionId: "a1", today: "2026-06-04")

        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // Other top-level keys + the top-level unknown survive verbatim.
        XCTAssertEqual(next.userProfile.name, "老王")
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "s1")
        // Other SETTINGS keys survive the nested rewrite (mirror of `{...current.settings, …}`).
        XCTAssertEqual(next.settings.trainingMode, "auto")
        XCTAssertEqual(next.settings.selectedTemplateId, "push-a")
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"))
        // Value semantics: the receiver is untouched (no dismissed list appeared on it).
        XCTAssertTrue(rootDismissed(original).isEmpty)
        XCTAssertTrue(settingsDismissed(original).isEmpty)
        // Re-decodes cleanly (valid canonical document).
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(rootDismissed(reDecoded).count, 1)
        XCTAssertEqual(settingsDismissed(reDecoded).count, 1)
    }

    func testNeverWritesAnEngineOutputField() throws {
        // The whole canonical document gains ONLY the dismissed-intent keys — no coach-action
        // engine output ever leaks into a dismiss write.
        let next = AppData.emptyCurrent().withDismissedCoachAction(actionId: "a1", today: "2026-06-04")
        let canonical = try next.canonicalJSONString()
        for forbidden in ["mesocyclePlan", "prescription", "readiness", "e1RM", "phase", "programTemplate"] {
            XCTAssertFalse(canonical.contains(forbidden), "dismiss write leaked engine-output key \(forbidden): \(canonical)")
        }
    }
}
