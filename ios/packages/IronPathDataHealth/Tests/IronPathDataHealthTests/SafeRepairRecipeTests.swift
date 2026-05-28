// SafeRepairRecipeTests — iOS-3B AutoRepairOrchestrator + Safe Repair Recipes V1.
//
// Per-recipe unit tests covering the 5 safe repairs under synthetic
// fixtures. Real-export coverage lives in
// AutoRepairOrchestratorRealExportTests.

import XCTest
@testable import IronPathDataHealth
import IronPathDomain
import Foundation

final class SafeRepairRecipeTests: XCTestCase {
    // MARK: - sessionLifecycleResidueV1

    func testSessionLifecycleDetectAndApplyClearsActivePointersOnly() throws {
        let restTimer = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "isRunning", value: .bool(true)),
            .init(key: "remainingMs", value: .number(.integer(5000))),
        ]))
        let session = TrainingSession(
            id: "s1",
            completed: true,
            restTimerState: restTimer,
            currentExerciseId: "ex-a",
            currentFocusStepId: "step-x",
            currentSetIndex: .integer(3),
            focusActualSetDrafts: [ActualSetDraft()]
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = SessionLifecycleResidueRepair()

        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected)
        XCTAssertEqual(detect.occurrences, 1)
        XCTAssertEqual(detect.affectedIds, ["s1"])

        let dryRun = repair.dryRun(appData)
        XCTAssertEqual(dryRun.detect.detected, true)
        XCTAssertFalse(dryRun.idempotencyKey.isEmpty)
        // dryRun must NOT mutate the original AppData (canonical bytes stable).
        let canonicalBefore = try appData.canonicalJSONData()
        _ = repair.dryRun(appData)
        let canonicalAfter = try appData.canonicalJSONData()
        XCTAssertEqual(canonicalBefore, canonicalAfter)

        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .applied)
        XCTAssertEqual(applied.repairedData.schemaVersion.rawValue, 8)
        // Cleaned session: active pointers reset.
        let cleanedHistory = applied.repairedData.history
        XCTAssertEqual(cleanedHistory.first?.currentExerciseId, "")
        XCTAssertEqual(cleanedHistory.first?.currentFocusStepId, "completed")
        XCTAssertEqual(cleanedHistory.first?.currentSetIndex?.intValue, -1)
        // iOS-3B safety: drafts are PRESERVED, not cleared.
        XCTAssertEqual(cleanedHistory.first?.focusActualSetDrafts?.count, 1)

        // Post-state detect: drafts alone do NOT trigger detected=true.
        // iOS-3B safety + idempotency: detected only when actually
        // cleanable active-pointer residue is present, so the
        // orchestrator won't loop on the same affectedIds set.
        XCTAssertFalse(repair.detect(applied.repairedData).detected,
            "drafts-only post-state must NOT keep detected=true (iOS-3B idempotency contract)")
    }

    // MARK: - iOS-3B safety: focusActualSetDrafts + warmup logs preserved

    func testSessionLifecycleApplyPreservesFocusActualSetDrafts() throws {
        // A completed session with rest-timer running AND drafts.
        let restTimer = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "isRunning", value: .bool(true)),
        ]))
        let drafts = [
            ActualSetDraft(),
            ActualSetDraft(),
            ActualSetDraft(),
        ]
        let session = TrainingSession(
            id: "s-keep-drafts",
            completed: true,
            restTimerState: restTimer,
            currentExerciseId: "ex-a",
            focusActualSetDrafts: drafts
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = SessionLifecycleResidueRepair()
        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .applied)
        let cleaned = applied.repairedData.history.first
        XCTAssertNotNil(cleaned)
        // Drafts kept verbatim — same count as input.
        XCTAssertEqual(cleaned?.focusActualSetDrafts?.count, drafts.count)
        // Active residue cleared.
        XCTAssertEqual(cleaned?.currentExerciseId, "")
        if case .object(let obj) = (cleaned?.restTimerState ?? .null) {
            XCTAssertEqual(obj["isRunning"]?.boolValue, false)
        } else {
            XCTFail("restTimerState should still be a JSON object after repair")
        }
    }

    func testSessionLifecycleApplyPreservesFocusWarmupSetLogsAndExerciseSetsHistory() throws {
        // Non-integer doubles to survive JSON round-trip without
        // collapsing to .integer — that way we can detect mutation
        // by an apply that fails to preserve the typed value.
        let warmupLog = TrainingSetLog(
            id: "w1",
            weight: .double(42.5),
            reps: .integer(8),
            done: true
        )
        let workingSet = TrainingSetLog(
            id: "set1",
            weight: .double(62.5),
            reps: .integer(5),
            done: true
        )
        let exercise = ExercisePrescription(
            id: "ex-bench",
            sets: [workingSet]
        )
        let session = TrainingSession(
            id: "s-history",
            completed: true,
            currentExerciseId: "ex-bench",  // active residue → triggers apply
            focusActualSetDrafts: [ActualSetDraft()],
            focusWarmupSetLogs: [warmupLog],
            exercises: [exercise]
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = SessionLifecycleResidueRepair()
        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .applied)
        let cleaned = applied.repairedData.history.first
        XCTAssertNotNil(cleaned)
        // Warmup logs preserved byte-for-byte (non-integer double
        // survives JSON round-trip as .double).
        XCTAssertEqual(cleaned?.focusWarmupSetLogs?.count, 1)
        XCTAssertEqual(cleaned?.focusWarmupSetLogs?.first?.id, "w1")
        XCTAssertEqual(cleaned?.focusWarmupSetLogs?.first?.weight?.doubleValue, 42.5)
        XCTAssertEqual(cleaned?.focusWarmupSetLogs?.first?.reps?.intValue, 8)
        XCTAssertEqual(cleaned?.focusWarmupSetLogs?.first?.done, true)
        // Working-set history preserved.
        XCTAssertEqual(cleaned?.exercises?.first?.sets?.count, 1)
        XCTAssertEqual(cleaned?.exercises?.first?.sets?.first?.id, "set1")
        XCTAssertEqual(cleaned?.exercises?.first?.sets?.first?.weight?.doubleValue, 62.5)
        XCTAssertEqual(cleaned?.exercises?.first?.sets?.first?.done, true)
        // Drafts preserved.
        XCTAssertEqual(cleaned?.focusActualSetDrafts?.count, 1)
    }

    func testSessionLifecycleApplyOnDraftsOnlySessionIsAppDataNoOp() throws {
        // Completed session whose ONLY residue is non-empty drafts.
        let session = TrainingSession(
            id: "s-drafts-only",
            completed: true,
            currentExerciseId: "",         // already clean
            currentFocusStepId: "completed",
            currentSetIndex: .integer(-1),
            focusActualSetDrafts: [ActualSetDraft(), ActualSetDraft()]
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = SessionLifecycleResidueRepair()
        let detect = repair.detect(appData)
        // iOS-3B safety + idempotency: drafts alone do NOT trigger
        // detected=true. The user message still surfaces the drafts
        // for visibility.
        XCTAssertFalse(detect.detected,
            "drafts-only finding must not trigger detected=true (iOS-3B idempotency contract)")
        XCTAssertTrue(detect.userMessage.localizedCaseInsensitiveContains("drafts"),
            "drafts-only finding must still appear in userMessage as audit info")

        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .applied)
        // AppData canonical bytes unchanged — the apply call sees no
        // active-pointer residue to clean, so it touches nothing.
        let before = try appData.canonicalJSONData()
        let after = try applied.repairedData.canonicalJSONData()
        XCTAssertEqual(before, after,
            "drafts-only session must not be mutated by apply")
        // Receipt acknowledges drafts-only as a non-cleanable finding.
        if case .object(let receiptObj) = applied.receipt {
            XCTAssertTrue(receiptObj["beforeSummary"]?.stringValue?.contains("drafts") ?? false)
        } else {
            XCTFail("receipt must be a JSON object")
        }
    }

    // MARK: - impossibleDurationV1

    func testImpossibleDurationDetectsAndRepairsViaSpan() throws {
        let session = TrainingSession(
            id: "s1",
            startedAt: "2025-05-27T10:00:00Z",
            finishedAt: "2025-05-27T11:00:00Z",  // 60 min sane span
            durationMin: .integer(9999),
            completed: true
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = ImpossibleDurationRepair()

        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected)
        XCTAssertEqual(detect.affectedIds, ["s1"])

        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .applied)
        let cleanedSession = applied.repairedData.history.first!
        // Span used: 60 minutes.
        XCTAssertEqual(cleanedSession.durationMin?.intValue, 60)
    }

    func testImpossibleDurationNeverUses70HourSpan() throws {
        let session = TrainingSession(
            id: "s1",
            startedAt: "2025-05-27T10:00:00Z",
            finishedAt: "2025-05-30T08:00:00Z",  // ~70 hours
            durationMin: .integer(9999),
            completed: true
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = ImpossibleDurationRepair()
        let applied = try repair.apply(appData, options: nil)
        let cleanedSession = applied.repairedData.history.first!
        // Must fall back to fallback (60), not the 4200-minute span.
        XCTAssertEqual(cleanedSession.durationMin?.intValue, DataHealthConstants.fallbackDurationMin)
        XCTAssertEqual(cleanedSession._unknown["durationInvalid"]?.boolValue, true)
    }

    // MARK: - staleTodayStatusV1

    func testStaleTodayStatusMarksWithoutDeletingPayload() throws {
        let appData = try makeAppData(rootEntries: [
            .init(key: "todayStatus", value: .object(OrderedJSONObject(entries: [
                .init(key: "date", value: .string("2025-05-15")),
                .init(key: "sleep", value: .string("good")),
                .init(key: "energy", value: .string("medium")),
            ]))),
        ])
        let now = Date(timeIntervalSince1970: 1_748_400_000)  // ~2025-05-28
        let clock = FixedRuntimeGuardClock(now)
        let repair = StaleTodayStatusRepair(clock: clock)

        let detect = repair.detect(appData)
        XCTAssertTrue(detect.detected)

        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .applied)
        // todayStatus payload untouched.
        let preservedStatus = applied.repairedData.todayStatus
        XCTAssertEqual(preservedStatus.date, "2025-05-15")
        XCTAssertEqual(preservedStatus.sleep, "good")
        XCTAssertEqual(preservedStatus.energy, "medium")
        // Runtime flag marked.
        let flags = readRuntimeFlags(applied.repairedData)
        XCTAssertNotNil(flags["todayStatusIgnoredAt"]?.stringValue)
        XCTAssertEqual(flags["todayStatusObservedDate"]?.stringValue, "2025-05-15")

        // Second run: detect false (already marked).
        XCTAssertFalse(repair.detect(applied.repairedData).detected)
    }

    // MARK: - staleHealthReadinessGuardV1

    func testStaleHealthReadinessMarksWithoutDeletingSamples() throws {
        let now = Date(timeIntervalSince1970: 1_748_400_000)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let twentyDaysAgo = iso.string(from: now.addingTimeInterval(-20 * 24 * 3600))
        let appData = try makeAppData(rootEntries: [
            .init(key: "healthMetricSamples", value: .array([
                .object(OrderedJSONObject(entries: [
                    .init(key: "id", value: .string("m1")),
                    .init(key: "startDate", value: .string(twentyDaysAgo)),
                    .init(key: "raw", value: .object(OrderedJSONObject(entries: [
                        .init(key: "anchor", value: .string("preserved")),
                    ]))),
                ])),
            ])),
        ])
        let clock = FixedRuntimeGuardClock(now)
        let repair = StaleHealthReadinessRepair(clock: clock)

        XCTAssertTrue(repair.detect(appData).detected)
        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .applied)

        // Sample + raw preserved.
        let samples = applied.repairedData.healthMetricSamples
        XCTAssertEqual(samples.count, 1)
        XCTAssertEqual(samples.first?.startDate, twentyDaysAgo)
        if case .object(let rawObj) = (samples.first?.raw ?? .null) {
            XCTAssertEqual(rawObj["anchor"]?.stringValue, "preserved")
        } else {
            XCTFail("raw must be a preserved object")
        }
        // Runtime flag marked.
        let flags = readRuntimeFlags(applied.repairedData)
        XCTAssertNotNil(flags["healthDataStaleSince"]?.stringValue)
    }

    // MARK: - legacyFinalAdviceIsolationGuardV1

    func testLegacyAdviceAuditOnlyDoesNotMutate() throws {
        let session = TrainingSession(
            id: "s1",
            completed: true,
            exercises: [ExercisePrescription(
                id: "ex-a",
                suggestion: "push harder",
                adjustment: "drop 5kg",
                warning: "wrist pain"
            )],
            _unknown: OrderedJSONObject(entries: [
                .init(key: "explanations", value: .array([.string("you crushed it")])),
            ])
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = LegacyFinalAdviceIsolationRepair()

        XCTAssertTrue(repair.detect(appData).detected)
        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.status, .skipped)
        // AppData canonical bytes unchanged.
        let before = try appData.canonicalJSONData()
        let after = try applied.repairedData.canonicalJSONData()
        XCTAssertEqual(before, after)
        // Receipt + warning indicate audit-only.
        XCTAssertTrue(applied.warnings.first?.contains("audit") ?? false)
    }

    // MARK: - Common preserves

    func testAllRepairsPreserveSchemaVersionAndUnknownFields() throws {
        let session = TrainingSession(
            id: "s1",
            completed: true,
            currentExerciseId: "ex-a",
            _unknown: OrderedJSONObject(entries: [
                .init(key: "futureField", value: .string("preserved")),
            ])
        )
        let appData = try makeAppDataWithHistory([session])
        let repair = SessionLifecycleResidueRepair()
        let applied = try repair.apply(appData, options: nil)
        XCTAssertEqual(applied.repairedData.schemaVersion.rawValue, 8)
        let cleanedSession = applied.repairedData.history.first!
        XCTAssertEqual(cleanedSession._unknown["futureField"]?.stringValue, "preserved")
    }

    // MARK: - Helpers

    private func makeAppData(rootEntries: [OrderedJSONObject.Entry]) throws -> AppData {
        let root = OrderedJSONObject(entries: [
            .init(key: "schemaVersion", value: .number(.integer(8))),
        ] + rootEntries)
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }

    private func makeAppDataWithHistory(_ history: [TrainingSession]) throws -> AppData {
        try makeAppData(rootEntries: [
            .init(key: "history", value: .array(history.map { $0.encoded() })),
        ])
    }
}
