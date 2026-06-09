// FullRepairRegistryTests — iOS-3C.
//
// Asserts the 9-recipe registry shape:
//   * fullRepairRegistry() lists all 9 V1 ids in canonical order.
//   * safeRepairRegistry() still lists ONLY the iOS-3B 5.
//   * has() / get() / byLayer() work across the full registry.

import XCTest
@testable import RedeDataHealth
import RedeDomain

final class FullRepairRegistryTests: XCTestCase {
    func testFullRegistryListsAllNineV1Recipes() {
        let registry = fullRepairRegistry()
        let ids = registry.list().map { $0.repairId }
        // Order matches appDataRepairRegistry.ts:V1_REPAIRS.
        XCTAssertEqual(ids, [
            "sessionLifecycleResidueV1",
            "impossibleDurationV1",
            "staleTodayStatusV1",
            "staleHealthReadinessGuardV1",
            "screeningIssueScoreRuntimeGuardV1",
            "screeningIssueScoreRepairV1",
            "legacyFinalAdviceIsolationGuardV1",
            "setIndexRenumberV1",
            "replacementEquivalenceAuditV1",
        ])
    }

    func testSafeRegistryUnchangedAfterIos3c() {
        let registry = safeRepairRegistry()
        XCTAssertEqual(registry.list().count, 5,
            "safeRepairRegistry must remain the iOS-3B 5-recipe surface")
    }

    func testFullRegistryByLayerSplit() {
        let registry = fullRepairRegistry()
        let safeAutoIds = Set(registry.byLayer(.safeAuto).map { $0.repairId })
        XCTAssertEqual(safeAutoIds, [
            "sessionLifecycleResidueV1",
            "impossibleDurationV1",
            "staleTodayStatusV1",
            "staleHealthReadinessGuardV1",
            "screeningIssueScoreRepairV1",
            "setIndexRenumberV1",
        ])
        let runtimeGuardIds = Set(registry.byLayer(.runtimeGuard).map { $0.repairId })
        XCTAssertEqual(runtimeGuardIds, [
            "legacyFinalAdviceIsolationGuardV1",
            "screeningIssueScoreRuntimeGuardV1",
        ])
        let auditOnlyIds = Set(registry.byLayer(.auditOnly).map { $0.repairId })
        XCTAssertEqual(auditOnlyIds, ["replacementEquivalenceAuditV1"])
    }

    func testFullRegistryHasAndGet() {
        let registry = fullRepairRegistry()
        XCTAssertNotNil(registry.get("screeningIssueScoreRepairV1"))
        XCTAssertNotNil(registry.get("setIndexRenumberV1"))
        XCTAssertNotNil(registry.get("replacementEquivalenceAuditV1"))
        XCTAssertTrue(registry.has("screeningIssueScoreRuntimeGuardV1"))
        XCTAssertNil(registry.get("nonExistentRepair"))
    }
}
