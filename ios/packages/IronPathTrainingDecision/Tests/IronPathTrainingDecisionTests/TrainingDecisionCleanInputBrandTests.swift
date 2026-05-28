// iOS-4B2 — Clean Input Contract (brand) tests.
//
// The branded CleanTrainingDecisionInput is constructible ONLY via
// createCleanTrainingDecisionInput(cleanView:metadata:) (its memberwise init is
// fileprivate). That "no raw construction" property is a COMPILE-TIME guarantee
// verified by the iosTrainingDecisionSwiftEngineStaticGuards TS grep; here we
// prove the runtime behaviour: the factory requires a CleanAppDataView, the engine
// accepts the branded value, history is sourced from the CLEANED projection, and
// the deferred (carried-but-unused) fields do not affect the 4B2 output.

import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

final class TrainingDecisionCleanInputBrandTests: XCTestCase {

    func test_factory_mints_input_engine_accepts() {
        let input = CoreSliceTestKit.makeCleanInput(gap: 2)
        let slice = buildTrainingDecisionFromCleanInput(input)
        // A clean gap-2 no-flag input → base / normal-session.
        XCTAssertEqual(slice.activePhase, .base)
        XCTAssertEqual(slice.sessionIntent, .normalSession)
    }

    func test_factory_sources_cleanedHistory_not_raw() {
        // The factory must read history from cleanView.cleanedHistory (the cleaned
        // projection), never cleanView.raw.history. We assert the minted input's
        // history is exactly the cleaned projection.
        let sessions = [
            CoreSliceTestKit.session(id: "b-late", gap: 2),
            CoreSliceTestKit.session(id: "b-early", gap: 9),
        ]
        let view = CoreSliceTestKit.cleanView(sessions: sessions)
        let input = createCleanTrainingDecisionInput(
            cleanView: view,
            metadata: CleanTrainingDecisionInputMetadata(nowIso: CoreSliceTestKit.deterministicClockIso)
        )
        XCTAssertEqual(input.history, view.cleanedHistory, "factory must source cleanedHistory")
    }

    func test_factory_requires_cleanAppDataView_and_carries_metadata() {
        // The ONLY public construction path takes a CleanAppDataView. Metadata
        // flags are carried onto the branded input verbatim.
        let view = CoreSliceTestKit.cleanView(sessions: [CoreSliceTestKit.session(id: "b1", gap: 2)])
        let input = createCleanTrainingDecisionInput(
            cleanView: view,
            metadata: CleanTrainingDecisionInputMetadata(
                nowIso: CoreSliceTestKit.deterministicClockIso,
                explicitDeloadAssigned: true
            )
        )
        XCTAssertEqual(input.explicitDeloadAssigned, true)
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(input).sessionIntent, .deloadWeek)
    }

    func test_deferred_fields_are_carried_but_ignored() {
        // trainingMode is carried for forward-compat but NOT read by the slice —
        // varying it must not change the output. (useHealthDataForReadiness is no
        // longer purely deferred: iOS-4B3 resolves it onto the slice, so it is
        // covered by the readiness/controlled-reload tests instead.)
        let view = CoreSliceTestKit.cleanView(sessions: [CoreSliceTestKit.session(id: "d1", gap: 2)], todayStatus: CoreSliceTestKit.todayStatusJSON())
        let a = createCleanTrainingDecisionInput(
            cleanView: view,
            metadata: CleanTrainingDecisionInputMetadata(nowIso: CoreSliceTestKit.deterministicClockIso, trainingMode: "strength")
        )
        let b = createCleanTrainingDecisionInput(
            cleanView: view,
            metadata: CleanTrainingDecisionInputMetadata(nowIso: CoreSliceTestKit.deterministicClockIso, trainingMode: "hypertrophy")
        )
        XCTAssertEqual(buildTrainingDecisionFromCleanInput(a), buildTrainingDecisionFromCleanInput(b))
    }
}
