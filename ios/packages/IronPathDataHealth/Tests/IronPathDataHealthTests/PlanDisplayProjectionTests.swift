// PlanDisplayProjectionTests — Plan real-AppData read path V1.
//
// Covers the PURE outcome→state branch logic only (no IO, no live store): the thin
// app-layer loader supplies the `PlanAppDataLoadOutcome` (already routed through the
// GENUINE `buildCleanAppDataView`); this resolver maps it to an honest rendered state.
// AppData fixtures are built in memory from JSON and run through the real clean view,
// so the test proves the plan reaches the surface THROUGH DataHealth — raw AppData
// never bypasses the clean view (§10) — and that the honest empty/degrade branches
// behave.

import XCTest
import IronPathDomain
@testable import IronPathDataHealth

final class PlanDisplayProjectionTests: XCTestCase {

    private func appData(_ json: String) throws -> AppData {
        try AppData(decoding: Data(json.utf8))
    }

    /// A minimal valid document with no plan slots.
    private func emptyJSON() -> String {
        "{ \"schemaVersion\": \(SchemaVersion.current.rawValue) }"
    }

    /// A document with a full mesocycle + program template.
    private func populatedJSON() -> String {
        """
        {
          "schemaVersion": \(SchemaVersion.current.rawValue),
          "mesocyclePlan": {
            "id": "m1", "phase": "积累期",
            "startDate": "2026-05-04", "endDate": "2026-05-31",
            "weeks": [ {"phase":"base"}, {"phase":"build"}, {"phase":"overload"}, {"phase":"deload"} ]
          },
          "programTemplate": {
            "id": "p1", "primaryGoal": "增肌", "splitType": "推/拉/腿",
            "daysPerWeek": 4,
            "correctionStrategy": { "note": "肩前引矫正" }
          }
        }
        """
    }

    // MARK: - missing / unreadable

    func test_missing_resolvesToEmpty() {
        XCTAssertEqual(resolvePlanDisplayState(.missing), .empty)
    }

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolvePlanDisplayState(.unreadable), .unavailable)
    }

    // MARK: - loaded-but-empty document → empty

    func test_loadedEmptyDocument_resolvesToEmpty() throws {
        let view = buildCleanAppDataView(try appData(emptyJSON()))
        XCTAssertEqual(resolvePlanDisplayState(.loaded(view)), .empty)
    }

    // MARK: - loaded with a full plan → ready, all fields extracted

    func test_loadedWithPlan_extractsCycleAndProgram() throws {
        let view = buildCleanAppDataView(try appData(populatedJSON()))
        guard case .ready(let plan) = resolvePlanDisplayState(.loaded(view)) else {
            return XCTFail("expected .ready for a populated plan")
        }
        XCTAssertEqual(plan.phase, "积累期")
        XCTAssertEqual(plan.weekCount, 4)
        XCTAssertEqual(plan.startDate, "2026-05-04")
        XCTAssertEqual(plan.endDate, "2026-05-31")
        XCTAssertEqual(plan.primaryGoal, "增肌")
        XCTAssertEqual(plan.splitType, "推/拉/腿")
        XCTAssertEqual(plan.daysPerWeek, 4)
        XCTAssertTrue(plan.hasCorrectionStrategy)
        XCTAssertFalse(plan.hasFunctionalStrategy)
    }

    // MARK: - partial documents still resolve to ready

    func test_loadedProgramOnly_resolvesToReady() throws {
        let json = """
        { "schemaVersion": \(SchemaVersion.current.rawValue),
          "programTemplate": { "id": "p1", "primaryGoal": "减脂" } }
        """
        let view = buildCleanAppDataView(try appData(json))
        guard case .ready(let plan) = resolvePlanDisplayState(.loaded(view)) else {
            return XCTFail("expected .ready for a program-only document")
        }
        XCTAssertEqual(plan.primaryGoal, "减脂")
        XCTAssertNil(plan.phase)
        XCTAssertNil(plan.weekCount)
        XCTAssertFalse(plan.hasCorrectionStrategy)
    }

    func test_loadedMesocycleOnly_resolvesToReady() throws {
        let json = """
        { "schemaVersion": \(SchemaVersion.current.rawValue),
          "mesocyclePlan": { "id": "m1", "phase": "减载周" } }
        """
        let view = buildCleanAppDataView(try appData(json))
        guard case .ready(let plan) = resolvePlanDisplayState(.loaded(view)) else {
            return XCTFail("expected .ready for a mesocycle-only document")
        }
        XCTAssertEqual(plan.phase, "减载周")
        XCTAssertNil(plan.weekCount)
        XCTAssertNil(plan.primaryGoal)
    }

    // MARK: - honest degradation of malformed / blank fields

    func test_weeksNotArray_weekCountNil() throws {
        // `weeks` present but not an array → no count, and (with no other content)
        // the whole plan is honestly empty.
        let json = """
        { "schemaVersion": \(SchemaVersion.current.rawValue),
          "mesocyclePlan": { "id": "m1", "weeks": "oops" } }
        """
        let view = buildCleanAppDataView(try appData(json))
        XCTAssertEqual(resolvePlanDisplayState(.loaded(view)), .empty)
    }

    func test_blankScalarsDropped_resolveToEmpty() throws {
        let json = """
        { "schemaVersion": \(SchemaVersion.current.rawValue),
          "mesocyclePlan": { "id": "m1", "phase": "   " },
          "programTemplate": { "id": "p1", "primaryGoal": "" } }
        """
        let view = buildCleanAppDataView(try appData(json))
        XCTAssertEqual(resolvePlanDisplayState(.loaded(view)), .empty)
    }

    func test_emptyStrategyObjectIsAbsent() throws {
        // An empty `{}` strategy object is NOT "configured".
        let json = """
        { "schemaVersion": \(SchemaVersion.current.rawValue),
          "programTemplate": { "id": "p1", "primaryGoal": "增肌",
            "correctionStrategy": {}, "functionalStrategy": { "x": 1 } } }
        """
        let view = buildCleanAppDataView(try appData(json))
        guard case .ready(let plan) = resolvePlanDisplayState(.loaded(view)) else {
            return XCTFail("expected .ready")
        }
        XCTAssertFalse(plan.hasCorrectionStrategy)
        XCTAssertTrue(plan.hasFunctionalStrategy)
    }

    // MARK: - structural §10 proof + determinism

    /// The resolver reads the plan from the clean view's `raw` slots (the document that
    /// passed the clean-view ingress), never bypassing DataHealth. The ready plan equals
    /// the one built directly from exactly those cleaned-view raw slots.
    func test_loadedReadsFromCleanView() throws {
        let view = buildCleanAppDataView(try appData(populatedJSON()))
        let expected = PlanDisplay.make(
            mesocycle: view.raw.mesocyclePlan,
            program: view.raw.programTemplate
        )
        guard case .ready(let plan) = resolvePlanDisplayState(.loaded(view)) else {
            return XCTFail("expected .ready")
        }
        XCTAssertEqual(plan, expected)
    }

    func test_resolution_isDeterministic() throws {
        let view = buildCleanAppDataView(try appData(populatedJSON()))
        XCTAssertEqual(
            resolvePlanDisplayState(.loaded(view)),
            resolvePlanDisplayState(.loaded(view))
        )
    }
}
