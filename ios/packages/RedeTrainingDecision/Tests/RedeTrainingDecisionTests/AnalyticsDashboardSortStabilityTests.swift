// AN-8 — sort-stability load-bearing tests for AnalyticsDashboardEngine.
//
// The AN-3 dashboard sorts mirror JS `Array.prototype.sort`, which is STABLE (ES2019):
// equal-key elements keep their insertion order. Swift's `sort(by:)` is ALSO
// contractually stable since Swift 5.8 (SE-0372 "Document Sorting as Stable"; this repo
// is Swift 6.3.2), so a plain `.sorted` would keep ties too — the port still routes
// every such sort through `AnalyticsDashboardEngine.stableSorted`, which breaks
// comparator ties on the ORIGINAL index, to make the JS insertion-order-on-ties intent
// explicit (matching the SmartReplacement / PainPattern / RecentPRDelta precedents), not
// because the stdlib sort is unstable. These tests prove that tiebreak is LOAD-BEARING:
// the output order on a genuine tie is decided by the insertion-order rule (not the
// comparator), matching the committed golden `analytics/adherence-report-tie-cases-v1`
// case `skip-count-tie-stable-insertion-order` (generated from the retired legacy engine). Pure
// / read-only; no IO.
//
// SCOPE NOTE: because both the JS and Swift sorts are stable here, a fixture where a BARE
// `.sort` visibly reorders ties cannot be constructed — what `stableSorted` adds is an
// explicit, self-documenting encoding of the JS insertion-order-on-ties intent, not a fix
// for an unstable stdlib sort. These tests prove the tiebreak RULE determines the order
// and pin the JS insertion order so any future change is caught. Same intent as the
// SmartReplacement / PainPattern / RecentPRDelta precedents.

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class AnalyticsDashboardSortStabilityTests: XCTestCase {

    private struct Row: Equatable { let id: String; let key: Int }

    /// The dashboard comparator shape: descending by `key`; equal keys → 0 (a pure tie).
    private let byKeyDesc: (Row, Row) -> Int = { l, r in
        l.key != r.key ? (l.key > r.key ? -1 : 1) : 0
    }

    // MARK: - stableSorted breaks comparator ties by insertion order (the rule under test)

    func test_stableSorted_breaksComparatorTiesByInsertionOrder() {
        // Every element shares the same key → the comparator CANNOT order them; only the
        // tiebreak decides. Insertion order is deliberately reverse-alphabetical so
        // "insertion order" is visibly distinct from any id/value ordering.
        let input = [Row(id: "z", key: 1), Row(id: "y", key: 1), Row(id: "x", key: 1), Row(id: "w", key: 1)]
        // Sanity: the comparator is genuinely blind to these elements (a pure tie).
        XCTAssertTrue(byKeyDesc(input[0], input[1]) == 0 && byKeyDesc(input[1], input[0]) == 0)
        XCTAssertEqual(AnalyticsDashboardEngine.stableSorted(input, byKeyDesc).map(\.id), ["z", "y", "x", "w"])
    }

    func test_stableSorted_tiebreakRuleIsLoadBearing() {
        // The output order on ties is determined ENTIRELY by the tiebreak: stableSorted's
        // insertion-order rule yields one order; a reversed-index tiebreak over the
        // IDENTICAL comparator-equal block yields a DIFFERENT order. So the insertion-order
        // tiebreak is what makes the port match JS (and the golden) — it is load-bearing,
        // not a no-op: the explicit index tiebreak in the closure (not the comparator)
        // pins the tie order.
        let input = [Row(id: "z", key: 1), Row(id: "y", key: 1), Row(id: "x", key: 1), Row(id: "w", key: 1)]
        let insertionOrder = AnalyticsDashboardEngine.stableSorted(input, byKeyDesc).map(\.id)
        let reversedTieRule = input.enumerated().sorted { lhs, rhs in
            let c = byKeyDesc(lhs.element, rhs.element)
            return c != 0 ? c < 0 : lhs.offset > rhs.offset   // tie → REVERSED index
        }.map { $0.element.id }
        XCTAssertEqual(insertionOrder, ["z", "y", "x", "w"])
        XCTAssertEqual(reversedTieRule, ["w", "x", "y", "z"])
        XCTAssertNotEqual(insertionOrder, reversedTieRule, "the tiebreak rule decides the tie order")
    }

    func test_stableSorted_keepsInsertionOrderWithinKeyGroups() {
        // Two key groups; groups ordered by key desc, ties within a group keep insertion order.
        let input = [
            Row(id: "a", key: 0), Row(id: "b", key: 1), Row(id: "c", key: 0), Row(id: "d", key: 1),
        ]
        XCTAssertEqual(AnalyticsDashboardEngine.stableSorted(input, byKeyDesc).map(\.id), ["b", "d", "a", "c"])
    }

    // MARK: - engine-level tie (mirrors the adherence-report golden tie case)

    func test_buildAdherenceReport_equalSkipCounts_keepInsertionOrder() {
        // Six exercises, each a SINGLE incomplete set → each skipped exactly once
        // (planned 1 > actual 0). Every skip count == 1, so the count-desc sort is a PURE
        // tie; only insertion order (the Map first-seen order) can resolve it. Ids are in
        // reverse-alphabetical INSERTION order so the result is visibly insertion-ordered,
        // not id-sorted. Mirrors golden analytics/adherence-report-tie-cases-v1 case
        // `skip-count-tie-stable-insertion-order` (generated from the real legacy web schema engine).
        let ids = ["skip-zulu", "skip-yankee", "skip-xray", "skip-whiskey", "skip-victor", "skip-uniform"]
        let exercises = ids.map {
            ExercisePrescription(id: $0, sets: [TrainingSetLog(weight: .double(60), reps: .integer(8), done: false)])
        }
        let session = TrainingSession(id: "tie-1", date: "2026-05-30", completed: true, exercises: exercises)
        let report = AnalyticsDashboardEngine.buildAdherenceReport([session])
        XCTAssertTrue(report.skippedExercises.allSatisfy { $0.count == 1 }, "pure tie: every skip count == 1")
        // count-desc over equal counts → JS-stable insertion order, then slice(0,5).
        XCTAssertEqual(report.skippedExercises.map(\.exerciseId),
                       ["skip-zulu", "skip-yankee", "skip-xray", "skip-whiskey", "skip-victor"])
    }
}
