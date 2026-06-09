// RepairTypesTests — iOS-3A Data Health Runtime Foundation V1.
//
// Locks the enum rawValue contract (legacy web schema string-union parity) and the
// 8 DataHealthConstants values. The iOS-3B repair recipes encode
// these rawValues into the persisted ledger and into DataRepairLog
// receipts — string changes would break parity with legacy web schema receipts.

import XCTest
@testable import RedeDataHealth

final class RepairTypesTests: XCTestCase {
    func testRepairLayerRawValues() {
        XCTAssertEqual(RepairLayer.runtimeGuard.rawValue, "runtime_guard")
        XCTAssertEqual(RepairLayer.safeAuto.rawValue, "safe_auto")
        XCTAssertEqual(RepairLayer.auditOnly.rawValue, "audit_only")
    }

    func testRepairCategoryRawValues() {
        XCTAssertEqual(RepairCategory.sessionLifecycle.rawValue, "session_lifecycle")
        XCTAssertEqual(RepairCategory.durationSanity.rawValue, "duration_sanity")
        XCTAssertEqual(RepairCategory.readinessFreshness.rawValue, "readiness_freshness")
        XCTAssertEqual(RepairCategory.screeningDecay.rawValue, "screening_decay")
        XCTAssertEqual(RepairCategory.legacyAdviceIsolation.rawValue, "legacy_advice_isolation")
        XCTAssertEqual(RepairCategory.setIndexRenumber.rawValue, "set_index_renumber")
        XCTAssertEqual(RepairCategory.identityAudit.rawValue, "identity_audit")
        XCTAssertEqual(RepairCategory.unitDisplay.rawValue, "unit_display")
    }

    func testRepairSeverityRawValues() {
        XCTAssertEqual(RepairSeverity.info.rawValue, "info")
        XCTAssertEqual(RepairSeverity.warning.rawValue, "warning")
        XCTAssertEqual(RepairSeverity.error.rawValue, "error")
    }

    func testRepairTriggerRawValues() {
        XCTAssertEqual(RepairTrigger.boot.rawValue, "boot")
        XCTAssertEqual(RepairTrigger.importing.rawValue, "import")
        XCTAssertEqual(RepairTrigger.cloudRestore.rawValue, "cloud_restore")
        XCTAssertEqual(RepairTrigger.postSession.rawValue, "post_session")
        XCTAssertEqual(RepairTrigger.manual.rawValue, "manual")
        XCTAssertEqual(RepairTrigger.audit.rawValue, "audit")
    }

    func testRepairApplyStatusRawValues() {
        XCTAssertEqual(RepairApplyStatus.applied.rawValue, "applied")
        XCTAssertEqual(RepairApplyStatus.noOp.rawValue, "no_op")
        XCTAssertEqual(RepairApplyStatus.skipped.rawValue, "skipped")
        XCTAssertEqual(RepairApplyStatus.failed.rawValue, "failed")
        XCTAssertEqual(RepairApplyStatus.backupFailed.rawValue, "backup_failed")
    }

    func testDataHealthConstants() {
        XCTAssertEqual(DataHealthConstants.todayStatusStaleDays, 3)
        XCTAssertEqual(DataHealthConstants.healthDataStaleDays, 14)
        XCTAssertEqual(DataHealthConstants.issueScoreHardCap, 50)
        XCTAssertEqual(DataHealthConstants.issueScoreSoftCap, 12)
        XCTAssertEqual(DataHealthConstants.impossibleDurationMin, 240)
        XCTAssertEqual(DataHealthConstants.fallbackDurationMin, 60)
        XCTAssertEqual(DataHealthConstants.ledgerMaxEntries, 1000)
        XCTAssertEqual(DataHealthConstants.ledgerIdempotentWindowHours, 24)
    }
}
