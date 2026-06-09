// RepairRegistryTests — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Locks the registry contract:
//   * safeRepairRegistry() bundles the 5 iOS-3B recipes (and ONLY
//     those 5; deferred recipes must not appear).
//   * Duplicate repair IDs throw at construction time.
//   * byLayer / get / has accessors work as documented.

import XCTest
@testable import RedeDataHealth
import RedeDomain

final class RepairRegistryTests: XCTestCase {
    func testSafeRegistryBundlesFiveRecipes() {
        let registry = safeRepairRegistry()
        let ids = registry.list().map { $0.repairId }.sorted()
        XCTAssertEqual(ids, [
            "impossibleDurationV1",
            "legacyFinalAdviceIsolationGuardV1",
            "sessionLifecycleResidueV1",
            "staleHealthReadinessGuardV1",
            "staleTodayStatusV1",
        ])
    }

    func testSafeRegistryExcludesDeferredRecipes() {
        let registry = safeRepairRegistry()
        let ids = Set(registry.list().map { $0.repairId })
        // iOS-3C deferred:
        XCTAssertFalse(ids.contains("screeningIssueScoreRepairV1"))
        XCTAssertFalse(ids.contains("screeningIssueScoreRuntimeGuardV1"))
        XCTAssertFalse(ids.contains("setIndexRenumberV1"))
        XCTAssertFalse(ids.contains("replacementEquivalenceAuditV1"))
    }

    func testByLayerFilter() {
        let registry = safeRepairRegistry()
        let safeAutoIds = Set(registry.byLayer(.safeAuto).map { $0.repairId })
        XCTAssertEqual(safeAutoIds, [
            "sessionLifecycleResidueV1",
            "impossibleDurationV1",
            "staleTodayStatusV1",
            "staleHealthReadinessGuardV1",
        ])
        let runtimeGuardIds = Set(registry.byLayer(.runtimeGuard).map { $0.repairId })
        XCTAssertEqual(runtimeGuardIds, ["legacyFinalAdviceIsolationGuardV1"])
        XCTAssertTrue(registry.byLayer(.auditOnly).isEmpty)
    }

    func testGetAndHas() {
        let registry = safeRepairRegistry()
        XCTAssertNotNil(registry.get("sessionLifecycleResidueV1"))
        XCTAssertTrue(registry.has("impossibleDurationV1"))
        XCTAssertNil(registry.get("nonexistentV1"))
        XCTAssertFalse(registry.has("setIndexRenumberV1"))
    }

    func testDuplicateRepairIdThrows() {
        XCTAssertThrowsError(try RepairRegistry(definitions: [
            SessionLifecycleResidueRepair(),
            SessionLifecycleResidueRepair(),
        ])) { error in
            guard case RepairRegistryError.duplicateRepairId(let id) = error else {
                XCTFail("expected duplicateRepairId, got \(error)")
                return
            }
            XCTAssertEqual(id, "sessionLifecycleResidueV1")
        }
    }
}
