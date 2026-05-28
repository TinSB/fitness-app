// AutoRepairOrchestratorRealExportTests — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// End-to-end orchestrator integration against the redacted real
// export at `tests/fixtures/data-health/ironpath-2026-05-27-redacted.json`.
// Asserts:
//
//   * Orchestrator returns successfully under a fixed clock anchored
//     near the export date.
//   * Detected repair IDs ⊆ {5 iOS-3B safe IDs}; deferred recipes
//     (screeningIssueScore*, setIndexRenumber, replacementEquivalence)
//     are absent.
//   * Idempotency: a second orchestrator run produces no new applied
//     ledger entries.
//   * impossibleDurationV1 fires on the known 4204-minute outlier in
//     the real export.
//   * BackupAdapter throw flips the orchestrator into backup_failed
//     mode WITHOUT mutating AppData.

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class AutoRepairOrchestratorRealExportTests: XCTestCase {
    private func realExportURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // IronPathDataHealthTests/
            .deletingLastPathComponent()  // Tests/
            .deletingLastPathComponent()  // IronPathDataHealth/
            .deletingLastPathComponent()  // packages/
            .deletingLastPathComponent()  // ios/
            .deletingLastPathComponent()  // repo root
            .appendingPathComponent("tests/fixtures/data-health/ironpath-2026-05-27-redacted.json")
    }

    private func loadRealExport() throws -> AppData {
        let data = try Data(contentsOf: realExportURL())
        return try AppData(decoding: data)
    }

    /// Anchor near the redacted export's nominal date so the staleness
    /// guards produce deterministic outputs.
    private var anchorClock: RuntimeGuardClock {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let date = iso.date(from: "2026-05-28T00:00:00Z") ?? Date()
        return FixedRuntimeGuardClock(date)
    }

    func testRealExportRunsWithoutThrowing() throws {
        let appData = try loadRealExport()
        let result = try runAutoRepairOrchestrator(AutoRepairOrchestratorInput(
            appData: appData,
            triggeredBy: .boot,
            registry: makeSafeRegistryWithClock(anchorClock),
            backupAdapter: InMemoryAutoRepairBackupAdapter(),
            clock: anchorClock
        ))
        XCTAssertEqual(result.appDataHashBefore.hasPrefix("appdata_"), true)
        XCTAssertEqual(result.appDataHashAfter.hasPrefix("appdata_"), true)
    }

    func testDetectedRepairsAreSubsetOfSafeIds() throws {
        let appData = try loadRealExport()
        let result = try runAutoRepairOrchestrator(AutoRepairOrchestratorInput(
            appData: appData,
            triggeredBy: .boot,
            registry: makeSafeRegistryWithClock(anchorClock),
            backupAdapter: InMemoryAutoRepairBackupAdapter(),
            clock: anchorClock
        ))
        let safeIds: Set<String> = [
            "sessionLifecycleResidueV1",
            "impossibleDurationV1",
            "staleTodayStatusV1",
            "staleHealthReadinessGuardV1",
            "legacyFinalAdviceIsolationGuardV1",
        ]
        let resultIds = Set(result.results.map { $0.repairId })
            .union(Set(result.auditFindings.map { $0.repairId }))
        XCTAssertTrue(resultIds.isSubset(of: safeIds), "unexpected repair IDs: \(resultIds.subtracting(safeIds))")
        // Deferred recipes must not appear.
        XCTAssertFalse(resultIds.contains("screeningIssueScoreRepairV1"))
        XCTAssertFalse(resultIds.contains("setIndexRenumberV1"))
        XCTAssertFalse(resultIds.contains("replacementEquivalenceAuditV1"))
    }

    func testRealExportDetectsImpossibleDuration() throws {
        let appData = try loadRealExport()
        let repair = ImpossibleDurationRepair()
        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected, "real export must contain at least one impossible-duration session")
        XCTAssertGreaterThan(detect.occurrences, 0)
    }

    func testOrchestratorIsIdempotentOnSecondRun() throws {
        let appData = try loadRealExport()
        let registry = makeSafeRegistryWithClock(anchorClock)
        let backup = InMemoryAutoRepairBackupAdapter()
        let firstResult = try runAutoRepairOrchestrator(AutoRepairOrchestratorInput(
            appData: appData,
            triggeredBy: .boot,
            registry: registry,
            backupAdapter: backup,
            clock: anchorClock
        ))
        let firstAppliedCount = firstResult.results.filter { $0.status == .applied }.count

        let secondResult = try runAutoRepairOrchestrator(AutoRepairOrchestratorInput(
            appData: firstResult.appData,
            triggeredBy: .boot,
            registry: registry,
            backupAdapter: backup,
            clock: anchorClock
        ))
        // Second run: no new applied repairs (either idempotent-skip or noOp).
        let secondAppliedCount = secondResult.results.filter { $0.status == .applied }.count
        XCTAssertEqual(secondAppliedCount, 0, "second orchestrator run must not re-apply any repair (first applied: \(firstAppliedCount), second applied: \(secondAppliedCount))")
        XCTAssertFalse(secondResult.changed, "changed must be false on the idempotent second run")
    }

    func testBackupFailedFlowDoesNotMutateAppData() throws {
        let appData = try loadRealExport()
        let canonicalBefore = try appData.canonicalJSONData()
        let result = try runAutoRepairOrchestrator(AutoRepairOrchestratorInput(
            appData: appData,
            triggeredBy: .boot,
            registry: makeSafeRegistryWithClock(anchorClock),
            backupAdapter: ThrowingAutoRepairBackupAdapter(),
            clock: anchorClock
        ))
        XCTAssertFalse(result.changed)
        XCTAssertTrue(result.warnings.contains(where: { $0.contains("backup_failed") }))
        // Strip the summary that the orchestrator writes — that
        // mutation is sanctioned (no AppData repair occurred, only a
        // summary-row append happened). The original payload outside
        // settings must be untouched. We assert by canonical-equality
        // after stripping the summary key.
        let resultRoot = result.appData.root
        let strippedRoot = stripAutoRepairSummary(resultRoot)
        let canonicalAfter = try JSONValue.object(strippedRoot).canonicalJSONData()
        XCTAssertEqual(canonicalAfter, canonicalBefore, "backup_failed must not mutate AppData beyond the summary write")
    }

    // MARK: - Helpers

    private func makeSafeRegistryWithClock(_ clock: RuntimeGuardClock) -> RepairRegistry {
        do {
            return try RepairRegistry(definitions: [
                SessionLifecycleResidueRepair(),
                ImpossibleDurationRepair(),
                StaleTodayStatusRepair(clock: clock),
                StaleHealthReadinessRepair(clock: clock),
                LegacyFinalAdviceIsolationRepair(),
            ])
        } catch {
            fatalError("registry construction failed: \(error)")
        }
    }

    /// Returns a copy of `root` with `settings.dataHealthAutoRepairSummary`
    /// removed plus any ledger entries (we strip the summary because the
    /// orchestrator writes it even on backup_failed, and ledger entries
    /// because the backup_failed path also appends rows there).
    private func stripAutoRepairSummary(_ root: OrderedJSONObject) -> OrderedJSONObject {
        guard case .object(let settings) = (root["settings"] ?? .null) else {
            return root
        }
        var newSettingsEntries: [OrderedJSONObject.Entry] = []
        for entry in settings.entries {
            if entry.key == "dataHealthAutoRepairSummary" { continue }
            if entry.key == "dataHealthRepairLedger" { continue }
            newSettingsEntries.append(entry)
        }
        let newSettings = OrderedJSONObject(entries: newSettingsEntries)
        var newRootEntries: [OrderedJSONObject.Entry] = []
        for entry in root.entries {
            if entry.key == "settings" {
                newRootEntries.append(.init(key: "settings", value: .object(newSettings)))
            } else {
                newRootEntries.append(entry)
            }
        }
        return OrderedJSONObject(entries: newRootEntries)
    }
}
