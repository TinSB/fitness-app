// iOS-4B1 — shape-stability tests for the per-path golden invariants
// (assertions 9, 10, 11, 12, 15). These DECODE and ASSERT the locked shape —
// they do NOT recompute any decision (no engine logic exists in this package).

import XCTest
import RedeDomain
@testable import RedeTrainingDecision

final class TrainingDecisionShapeStabilityTests: XCTestCase {
    // (9) productive-floor fixture: compound exercises decode with sets >= 2.
    func testProductiveFloorCompoundsAtLeastTwoSets() throws {
        let d = try TrainingDecisionGoldens.decode("productive-floor-v1")
        XCTAssertEqual(d.activePhaseEnum, .reentry)
        let compounds = try XCTUnwrap(d.perExercise).filter { $0.role.contains("compound") }
        XCTAssertFalse(compounds.isEmpty)
        XCTAssertTrue(compounds.allSatisfy { $0.targetSets >= 2 }, "compounds must keep >= 2 sets")
        // Not an all-1-set session.
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(d.allTargetSets).max() ?? 0, 2)
    }

    // (10) severe-rest fixture: all-1-set is a VALID decode for severe risk.
    func testSevereRestAllOneSetIsValidSevere() throws {
        let d = try TrainingDecisionGoldens.decode("severe-rest-v1")
        XCTAssertEqual(d.sessionIntentEnum, .severeRest)
        XCTAssertEqual(d.riskLevelEnum, .severe)
        let sets = try XCTUnwrap(d.allTargetSets)
        XCTAssertTrue(sets.allSatisfy { $0 == 1 }, "severe-rest collapses to all-1-set")
        XCTAssertLessThanOrEqual(try XCTUnwrap(d.finalVolumeMultiplier), 0.3)
    }

    // (11) no-legacy-advice fixture decodes cleanInput legacy evidence.
    func testNoLegacyAdviceCleanInputEvidence() throws {
        let d = try TrainingDecisionGoldens.decode("no-legacy-advice-v1")
        let diag = try XCTUnwrap(d.cleanInput?.diagnostics)
        XCTAssertFalse(diag.legacyAdviceSessionIds.isEmpty, "legacy advice ids must be recorded as stripped")
    }

    // (12) clean-input-contract fixture decodes cleanInput diagnostics.
    func testCleanInputContractDiagnostics() throws {
        let d = try TrainingDecisionGoldens.decode("clean-input-contract-v1")
        let ci = try XCTUnwrap(d.cleanInput)
        XCTAssertTrue(ci.cleanViewBuilt)
        let diag = try XCTUnwrap(ci.diagnostics)
        XCTAssertFalse(diag.lifecycleResidueSessionIds.isEmpty)
        XCTAssertFalse(diag.invalidDurationSessionIds.isEmpty)
    }

    // stale-health: useHealthDataForReadiness decodes the null→false→nil tri-state.
    func testStaleHealthUseHealthDataResolvesFalse() throws {
        let d = try TrainingDecisionGoldens.decode("stale-health-data-v1")
        XCTAssertEqual(d.cleanInput?.useHealthDataForReadiness, false)
        XCTAssertEqual(d.cleanInput?.diagnostics?.staleHealthData, true)
        XCTAssertEqual(d.inputEvidence?.rawHealthSamplesPreserved, true)
    }

    // restart-28d-gap: effectivePhase summary decodes restart + gapDays.
    func testRestartEffectivePhaseDecodes() throws {
        let d = try TrainingDecisionGoldens.decode("restart-28d-gap-v1")
        XCTAssertEqual(d.activePhaseEnum, .restart)
        XCTAssertEqual(d.effectivePhase?.activePhase, "restart")
        XCTAssertGreaterThanOrEqual(try XCTUnwrap(d.effectivePhase?.gapDays), 28)
    }

    // weeklyAdjustment.blockedBy tri-state: null decodes to nil; string decodes.
    func testWeeklyAdjustmentBlockedByTriState() throws {
        let severe = try TrainingDecisionGoldens.decode("severe-rest-v1")
        XCTAssertNil(severe.weeklyAdjustment?.blockedBy) // null in golden
        let productive = try TrainingDecisionGoldens.decode("productive-floor-v1")
        XCTAssertEqual(productive.weeklyAdjustment?.blockedBy, "reentry-floor")
    }

    // (15) No algorithm/decision-computing entry point exists on the type — the
    //      public surface is decode/encode + value accessors only. This test
    //      documents that contract; the legacy web schema static guards enforce it across files.
    func testTypesExposeNoDecisionComputation() throws {
        let d = try TrainingDecisionGoldens.decode("controlled-reload-v1")
        // The only way to obtain a TrainingDecision is to DECODE one — there is
        // no `buildTrainingDecision`, no recompute. Re-encoding is identity-ish.
        XCTAssertEqual(d.sessionIntentEnum, .controlledReload)
        XCTAssertEqual(d.hiddenDebugSignals.encoded().objectValue?["arbitrationTrace"]?.arrayValue?.count,
                       d.hiddenDebugSignals.arbitrationTrace.count)
    }
}
