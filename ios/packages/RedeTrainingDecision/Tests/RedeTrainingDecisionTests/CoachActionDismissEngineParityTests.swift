// CC-3 — coachActionDismissEngine parity tests.
//
// FUNCTION-LEVEL compute-assert over the single `coach-action-dismiss/dismiss-cases-v1`
// golden: for each dispatch-by-kind case, decode the echoed engine input, run the PORTED
// CoachActionDismissEngine on the SAME inputs, and assert the produced output equals the
// golden case's recorded result:
//   • dismissToday    → dismissCoachActionToday → DismissedCoachAction, canonical-JSON-equal.
//   • filterDismissed → filterDismissedCoachActions → surviving CoachAction ids, in order.
//   • draftMatches    → draftMatchesCoachAction → exact boolean.
//   • historyMatches  → historyMatchesCoachAction → exact boolean.
//   • findExisting    → findExistingAdjustmentForCoachAction → { matched, state, draftId,
//     historyItemId } (the full resolution order + draft-before-history precedence + null).
//   • filterVisible   → filterVisibleCoachActions AND the two aliases
//     (filterResolvedCoachActions / filterResolvedPlanActions), each → the SAME surviving ids.
//
// The golden is GENERATED from the retired legacy coachActionDismissEngine
// (frozen legacy fixture generator), never hand-edited (§22). PURE / read-only — zero
// `: Date` on the engine path; NO write path (the gated dismiss write is CC-4); no IO beyond
// the committed golden.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class CoachActionDismissEngineParityTests: XCTestCase {

    private typealias Engine = CoachActionDismissEngine

    private static var repoRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // RedeTrainingDecisionTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // RedeTrainingDecision/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
    }

    private static func goldenURL(_ id: String) -> URL {
        repoRoot.appendingPathComponent("ios/ParityFixtures/parity/golden/\(id).json", isDirectory: false)
    }

    private static let fixtureId = "coach-action-dismiss/dismiss-cases-v1"

    private func root() throws -> OrderedJSONObject {
        let data = try Data(contentsOf: Self.goldenURL(Self.fixtureId))
        return try JSONValue(decoding: data).requireObject(Self.fixtureId)
    }

    private func cases(ofKind kind: String) throws -> [OrderedJSONObject] {
        let cases = try root().optionalArray("cases") ?? []
        return try cases
            .map { try $0.requireObject("coach-action-dismiss case") }
            .filter { $0.optionalString("kind") == kind }
    }

    // MARK: - input decoders

    /// Mirror of the CC-2 `decodeCoachAction` (every fixture sets `status` explicitly, so the
    /// "pending" default is never exercised — but it matches the CC-2 decoder for parity).
    private func decodeCoachAction(_ o: OrderedJSONObject) -> Engine.CoachAction {
        Engine.CoachAction(
            id: o.optionalString("id") ?? "",
            title: o.optionalString("title") ?? "",
            description: o.optionalString("description") ?? "",
            source: o.optionalString("source") ?? "",
            actionType: o.optionalString("actionType") ?? "",
            priority: o.optionalString("priority") ?? "",
            status: o.optionalString("status") ?? "pending",
            requiresConfirmation: o.optionalBool("requiresConfirmation") ?? false,
            reversible: o.optionalBool("reversible") ?? false,
            createdAt: o.optionalString("createdAt") ?? "",
            expiresAt: o.optionalString("expiresAt"),
            targetId: o.optionalString("targetId"),
            targetType: o.optionalString("targetType"),
            reason: o.optionalString("reason") ?? "",
            confirmTitle: o.optionalString("confirmTitle"),
            confirmDescription: o.optionalString("confirmDescription"),
            sourceFingerprint: o.optionalString("sourceFingerprint")
        )
    }

    private func decodeDismissed(_ o: OrderedJSONObject) -> Engine.DismissedCoachAction {
        Engine.DismissedCoachAction(
            actionId: o.optionalString("actionId") ?? "",
            dismissedAt: o.optionalString("dismissedAt") ?? "",
            scope: o.optionalString("scope") ?? ""
        )
    }

    private func decodeActions(_ c: OrderedJSONObject) -> [Engine.CoachAction] {
        (c.optionalArray("actions") ?? []).compactMap { $0.objectValue.map(decodeCoachAction) }
    }

    private func decodeDismissedList(_ c: OrderedJSONObject) -> [Engine.DismissedCoachAction] {
        (c.optionalArray("dismissedActions") ?? []).compactMap { $0.objectValue.map(decodeDismissed) }
    }

    private func decodeDrafts(_ c: OrderedJSONObject) throws -> [ProgramAdjustmentDraft] {
        try (c.optionalArray("drafts") ?? []).map { try ProgramAdjustmentDraft(decoding: $0) }
    }

    private func decodeHistory(_ c: OrderedJSONObject) throws -> [ProgramAdjustmentHistoryItem] {
        try (c.optionalArray("adjustmentHistory") ?? []).map { try ProgramAdjustmentHistoryItem(decoding: $0) }
    }

    // MARK: - envelope

    func testGoldenEnvelope() throws {
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: Self.goldenURL(Self.fixtureId).path),
            "missing coach-action-dismiss golden"
        )
        XCTAssertEqual(try root().optionalString("sourceFixtureId"), Self.fixtureId)
        XCTAssertEqual((try root().optionalArray("cases") ?? []).count, 44, "expected the declared cases")
    }

    // MARK: - dismissCoachActionToday

    func testDismissTodayParity() throws {
        let cases = try cases(ofKind: "dismissToday")
        XCTAssertGreaterThanOrEqual(cases.count, 1)
        for c in cases {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actionId = try XCTUnwrap(c.optionalString("actionId"), "\(label): actionId")
            let now = try XCTUnwrap(c.optionalString("now"), "\(label): now")
            let computed = Engine.dismissCoachActionToday(actionId, now)
            let computedStr = try computed.encoded().canonicalJSONString()
            let goldenStr = try (c.rawValue("result") ?? .null).canonicalJSONString()
            XCTAssertEqual(computedStr, goldenStr, "\(label): DismissedCoachAction canonical mismatch")
        }
    }

    // MARK: - filterDismissedCoachActions

    func testFilterDismissedParity() throws {
        let cases = try cases(ofKind: "filterDismissed")
        XCTAssertGreaterThanOrEqual(cases.count, 6)
        for c in cases {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actions = decodeActions(c)
            let dismissed = decodeDismissedList(c)
            let currentDate = try XCTUnwrap(c.optionalString("currentDate"), "\(label): currentDate")
            let computed = Engine.filterDismissedCoachActions(actions, dismissed, currentDate).map { $0.id }
            XCTAssertEqual(computed, c.optionalStringArray("resultIds") ?? [], "\(label): resultIds")
        }
    }

    // MARK: - draftMatchesCoachAction

    func testDraftMatchesParity() throws {
        let cases = try cases(ofKind: "draftMatches")
        XCTAssertGreaterThanOrEqual(cases.count, 14)
        for c in cases {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let action = decodeCoachAction(try XCTUnwrap(c.optionalObject("action"), "\(label): action"))
            let draft = try ProgramAdjustmentDraft(decoding: try XCTUnwrap(c.rawValue("draft"), "\(label): draft"))
            let sourceFingerprint = c.optionalString("sourceFingerprint")
            let computed = Engine.draftMatchesCoachAction(action, draft, sourceFingerprint)
            XCTAssertEqual(computed, c.optionalBool("result"), "\(label): draftMatches boolean mismatch")
        }
    }

    // MARK: - historyMatchesCoachAction

    func testHistoryMatchesParity() throws {
        let cases = try cases(ofKind: "historyMatches")
        XCTAssertGreaterThanOrEqual(cases.count, 6)
        for c in cases {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let action = decodeCoachAction(try XCTUnwrap(c.optionalObject("action"), "\(label): action"))
            let item = try ProgramAdjustmentHistoryItem(decoding: try XCTUnwrap(c.rawValue("item"), "\(label): item"))
            let sourceFingerprint = c.optionalString("sourceFingerprint")
            let computed = Engine.historyMatchesCoachAction(action, item, sourceFingerprint)
            XCTAssertEqual(computed, c.optionalBool("result"), "\(label): historyMatches boolean mismatch")
        }
    }

    // MARK: - findExistingAdjustmentForCoachAction

    func testFindExistingParity() throws {
        let cases = try cases(ofKind: "findExisting")
        XCTAssertGreaterThanOrEqual(cases.count, 11)
        for c in cases {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let action = decodeCoachAction(try XCTUnwrap(c.optionalObject("action"), "\(label): action"))
            let drafts = try decodeDrafts(c)
            let history = try decodeHistory(c)
            let sourceFingerprint = c.optionalString("sourceFingerprint")
            let existing = Engine.findExistingAdjustmentForCoachAction(action, drafts, history, sourceFingerprint)

            let golden = try XCTUnwrap(c.optionalObject("result"), "\(label): result")
            XCTAssertEqual(existing != nil, golden.optionalBool("matched") ?? false, "\(label): matched")
            XCTAssertEqual(existing?.state, golden.optionalString("state"), "\(label): state")
            XCTAssertEqual(existing?.draft?.id, golden.optionalString("draftId"), "\(label): draftId")
            XCTAssertEqual(existing?.historyItem?.id, golden.optionalString("historyItemId"), "\(label): historyItemId")
        }
    }

    // MARK: - filterVisibleCoachActions (+ the two aliases)

    func testFilterVisibleParity() throws {
        let cases = try cases(ofKind: "filterVisible")
        XCTAssertGreaterThanOrEqual(cases.count, 5)
        for c in cases {
            let label = c.optionalString("label") ?? "(unlabeled)"
            let actions = decodeActions(c)
            let drafts = try decodeDrafts(c)
            let history = try decodeHistory(c)
            let dismissed = decodeDismissedList(c)
            let currentDate = try XCTUnwrap(c.optionalString("currentDate"), "\(label): currentDate")
            let golden = c.optionalStringArray("resultIds") ?? []

            let visible = Engine.filterVisibleCoachActions(actions, drafts, history, dismissed, currentDate).map { $0.id }
            XCTAssertEqual(visible, golden, "\(label): filterVisible resultIds")

            // The two aliases ARE filterVisibleCoachActions — assert byte-identical here too.
            let resolvedCoach = Engine.filterResolvedCoachActions(actions, drafts, history, dismissed, currentDate).map { $0.id }
            XCTAssertEqual(resolvedCoach, golden, "\(label): filterResolvedCoachActions resultIds")
            let resolvedPlan = Engine.filterResolvedPlanActions(actions, drafts, history, dismissed, currentDate).map { $0.id }
            XCTAssertEqual(resolvedPlan, golden, "\(label): filterResolvedPlanActions resultIds")
        }
    }
}
