// DataHealthRuntimeGuardTests — iOS-3A Data Health Runtime Foundation V1.
//
// Unit tests for the six pure guard functions:
//   * applySessionLifecycleGuard
//   * applyDurationGuard
//   * applyTodayStatusGuard
//   * applyHealthDataGuard
//   * applyIssueScoreCap
//   * applyPerformanceDropGuard
//
// Plus stripLegacyAdviceFromExercise / stripLegacyAdviceFromSession.
// All inputs are constructed in-memory; no fixtures touched.

import XCTest
@testable import RedeDataHealth
import RedeDomain
import Foundation

final class DataHealthRuntimeGuardTests: XCTestCase {
    // MARK: - Lifecycle guard

    func testLifecycleGuardLeavesIncompleteSessionAlone() {
        let session = TrainingSession(
            id: "s1",
            completed: false,
            currentExerciseId: "ex-a",
            currentSetIndex: .integer(5)
        )
        let out = applySessionLifecycleGuard(session)
        XCTAssertFalse(out.changed)
        XCTAssertEqual(out.session, session)
    }

    func testLifecycleGuardClearsResidueOnCompletedSession() {
        let restTimer = JSONValue.object(OrderedJSONObject(entries: [
            .init(key: "isRunning", value: .bool(true)),
            .init(key: "remainingMs", value: .number(.integer(5000))),
        ]))
        let session = TrainingSession(
            id: "s1",
            completed: true,
            restTimerState: restTimer,
            currentExerciseId: "ex-a",
            currentFocusStepId: "step-2",
            currentSetIndex: .integer(3),
            focusActualSetDrafts: [ActualSetDraft()]
        )
        let out = applySessionLifecycleGuard(session)
        XCTAssertTrue(out.changed)
        XCTAssertTrue(out.clearedRestTimerIsRunning)
        XCTAssertTrue(out.clearedCurrentExerciseId)
        XCTAssertTrue(out.setCurrentFocusStepIdCompleted)
        XCTAssertTrue(out.resetCurrentSetIndex)
        XCTAssertTrue(out.clearedFocusActualSetDrafts)

        XCTAssertEqual(out.session.currentExerciseId, "")
        XCTAssertEqual(out.session.currentFocusStepId, "completed")
        XCTAssertEqual(out.session.currentSetIndex, .integer(-1))
        XCTAssertEqual(out.session.focusActualSetDrafts?.count, 0)
        // restTimerState.isRunning forced to false; remainingMs preserved
        if case .object(let obj) = out.session.restTimerState! {
            XCTAssertEqual(obj["isRunning"]?.boolValue, false)
            XCTAssertEqual(obj["remainingMs"]?.intValue, 5000)
        } else {
            XCTFail("restTimerState should still be an object")
        }
    }

    func testLifecycleGuardNoOpWhenCompletedButCleanAlready() {
        let session = TrainingSession(
            id: "s1",
            completed: true,
            currentExerciseId: "",
            currentFocusStepId: "completed",
            currentSetIndex: .integer(-1),
            focusActualSetDrafts: []
        )
        let out = applySessionLifecycleGuard(session)
        XCTAssertFalse(out.changed)
    }

    // MARK: - Duration guard

    func testDurationGuardKeepsInRange() {
        let session = TrainingSession(durationMin: .integer(45))
        let out = applyDurationGuard(session)
        XCTAssertFalse(out.durationInvalid)
        XCTAssertEqual(out.derivedDurationMin, .integer(45))
    }

    func testDurationGuardRepairsViaSpanWhenRawOutOfRange() {
        let started = "2025-05-27T10:00:00Z"
        let finished = "2025-05-27T11:00:00Z"  // 60 min span
        let session = TrainingSession(
            startedAt: started,
            finishedAt: finished,
            durationMin: .integer(9999)  // bogus
        )
        let out = applyDurationGuard(session)
        XCTAssertFalse(out.durationInvalid)
        XCTAssertEqual(out.derivedDurationMin, .integer(60))
    }

    func testDurationGuardFlagsInvalidWhenBothOutOfRange() {
        let started = "2025-05-27T10:00:00Z"
        let finished = "2025-06-10T10:00:00Z"  // ~14 day span
        let session = TrainingSession(
            startedAt: started,
            finishedAt: finished,
            durationMin: .integer(9999)
        )
        let out = applyDurationGuard(session)
        XCTAssertTrue(out.durationInvalid)
        XCTAssertNil(out.derivedDurationMin)
    }

    // MARK: - TodayStatus guard

    func testTodayStatusGuardIgnoresMissingDate() {
        let appData = try! makeAppData(rootEntries: [])
        let out = applyTodayStatusGuard(appData, clock: FixedRuntimeGuardClock(Date(timeIntervalSince1970: 1_716_854_400)))
        XCTAssertFalse(out.ignoredForCurrentReadiness)
    }

    func testTodayStatusGuardFlagsStaleDate() {
        let today = Date(timeIntervalSince1970: 1_716_854_400)  // 2024-05-27T22:40:00Z roughly
        // Pick a "today" anchor and a status date 5 days older.
        let fiveDaysAgo = today.addingTimeInterval(-5 * 24 * 3600)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let staleDate = iso.string(from: fiveDaysAgo)
        let appData = try! makeAppData(rootEntries: [
            .init(key: "todayStatus", value: .object(OrderedJSONObject(entries: [
                .init(key: "date", value: .string(staleDate)),
            ]))),
        ])
        let out = applyTodayStatusGuard(appData, clock: FixedRuntimeGuardClock(today))
        XCTAssertTrue(out.ignoredForCurrentReadiness)
        XCTAssertEqual(out.daysOld, 5)
    }

    func testTodayStatusGuardKeepsRecentDate() {
        let today = Date(timeIntervalSince1970: 1_716_854_400)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let twoDaysAgo = iso.string(from: today.addingTimeInterval(-2 * 24 * 3600))
        let appData = try! makeAppData(rootEntries: [
            .init(key: "todayStatus", value: .object(OrderedJSONObject(entries: [
                .init(key: "date", value: .string(twoDaysAgo)),
            ]))),
        ])
        let out = applyTodayStatusGuard(appData, clock: FixedRuntimeGuardClock(today))
        XCTAssertFalse(out.ignoredForCurrentReadiness)
    }

    // MARK: - HealthData guard

    func testHealthDataGuardSkipsWhenNoSamples() {
        let appData = try! makeAppData(rootEntries: [])
        let out = applyHealthDataGuard(appData, clock: FixedRuntimeGuardClock(Date()))
        XCTAssertFalse(out.staleForReadiness)
        XCTAssertTrue(out.useHealthDataForReadiness)  // default true
    }

    func testHealthDataGuardFlagsStaleSamples() {
        let now = Date(timeIntervalSince1970: 1_716_854_400)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let twentyDaysAgo = iso.string(from: now.addingTimeInterval(-20 * 24 * 3600))
        let appData = try! makeAppData(rootEntries: [
            .init(key: "healthMetricSamples", value: .array([
                .object(OrderedJSONObject(entries: [
                    .init(key: "id", value: .string("m1")),
                    .init(key: "startDate", value: .string(twentyDaysAgo)),
                ])),
            ])),
        ])
        let out = applyHealthDataGuard(appData, clock: FixedRuntimeGuardClock(now))
        XCTAssertTrue(out.staleForReadiness)
        XCTAssertEqual(out.daysOld, 20)
    }

    func testHealthDataGuardRespectsExplicitOptOut() {
        let now = Date(timeIntervalSince1970: 1_716_854_400)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let twentyDaysAgo = iso.string(from: now.addingTimeInterval(-20 * 24 * 3600))
        let appData = try! makeAppData(rootEntries: [
            .init(key: "settings", value: .object(OrderedJSONObject(entries: [
                .init(key: "healthIntegrationSettings", value: .object(OrderedJSONObject(entries: [
                    .init(key: "useHealthDataForReadiness", value: .bool(false)),
                ]))),
            ]))),
            .init(key: "healthMetricSamples", value: .array([
                .object(OrderedJSONObject(entries: [
                    .init(key: "id", value: .string("m1")),
                    .init(key: "startDate", value: .string(twentyDaysAgo)),
                ])),
            ])),
        ])
        let out = applyHealthDataGuard(appData, clock: FixedRuntimeGuardClock(now))
        XCTAssertFalse(out.useHealthDataForReadiness)
        XCTAssertFalse(out.staleForReadiness)
    }

    // MARK: - IssueScore cap

    func testIssueScoreHardCapAppliedWhenMovementNotAllGood() throws {
        let screening = ScreeningProfile(
            painTriggers: ["lower-back"],
            movementFlags: .object(OrderedJSONObject(entries: [
                .init(key: "squat", value: .string("compensated")),
            ])),
            adaptiveState: .object(OrderedJSONObject(entries: [
                .init(key: "issueScores", value: .object(OrderedJSONObject(entries: [
                    .init(key: "lower-back", value: .number(.integer(95))),
                    .init(key: "shoulder", value: .number(.integer(20))),
                ]))),
            ]))
        )
        let out = applyIssueScoreCap(screening)
        XCTAssertFalse(out.movementFlagsAllGood)
        XCTAssertEqual(out.changes.count, 1)
        XCTAssertEqual(out.changes.first?.key, "lower-back")
        XCTAssertEqual(out.changes.first?.after, 50)
        XCTAssertEqual(out.cappedScores["lower-back"]?.intValue, 50)
        XCTAssertEqual(out.cappedScores["shoulder"]?.intValue, 20)
    }

    func testIssueScoreSoftCapAppliedWhenAllGoodAndNoPain() throws {
        let screening = ScreeningProfile(
            movementFlags: .object(OrderedJSONObject(entries: [
                .init(key: "squat", value: .string("good")),
                .init(key: "hinge", value: .string("good")),
            ])),
            adaptiveState: .object(OrderedJSONObject(entries: [
                .init(key: "issueScores", value: .object(OrderedJSONObject(entries: [
                    .init(key: "lower-back", value: .number(.integer(15))),
                    .init(key: "shoulder", value: .number(.integer(5))),
                ]))),
            ]))
        )
        let out = applyIssueScoreCap(screening)
        XCTAssertTrue(out.movementFlagsAllGood)
        XCTAssertEqual(out.changes.count, 1)
        XCTAssertEqual(out.changes.first?.after, 12)
        XCTAssertEqual(out.cappedScores["lower-back"]?.intValue, 12)
    }

    // MARK: - PerformanceDrop guard

    func testPerformanceDropEmptyWhenNoDrops() {
        let screening = ScreeningProfile()
        let out = applyPerformanceDropGuard(screening, history: [])
        XCTAssertTrue(out.filteredDrops.isEmpty)
        XCTAssertTrue(out.removed.isEmpty)
    }

    func testPerformanceDropRemovesIdAfterTwoOnTargetSessions() {
        let setDone = TrainingSetLog(done: true)
        let setNotDone = TrainingSetLog(done: false)
        let recoveredExercise = ExercisePrescription(
            id: "ex-bench",
            actualExerciseId: "ex-bench",
            sets: [setDone, setDone, setNotDone]
        )
        let history = [
            TrainingSession(id: "s1", completed: true, exercises: [recoveredExercise]),
            TrainingSession(id: "s2", completed: true, exercises: [recoveredExercise]),
        ]
        let screening = ScreeningProfile(
            adaptiveState: .object(OrderedJSONObject(entries: [
                .init(key: "performanceDrops", value: .array([.string("ex-bench"), .string("ex-row")])),
            ]))
        )
        let out = applyPerformanceDropGuard(screening, history: history)
        XCTAssertEqual(out.removed, ["ex-bench"])
        XCTAssertEqual(out.filteredDrops, ["ex-row"])
    }

    // MARK: - Legacy advice strip

    func testStripLegacyAdviceFromExerciseClearsTextAndWeekly() throws {
        let ex = ExercisePrescription(
            id: "ex-a",
            prescription: .object(OrderedJSONObject(entries: [
                .init(key: "weeklyAdjustment", value: .string("+5% next session")),
                .init(key: "targetReps", value: .number(.integer(8))),
            ])),
            suggestion: "Push harder",
            adjustment: "drop 5kg",
            warning: "wrist pain"
        )
        let out = stripLegacyAdviceFromExercise(ex)
        XCTAssertTrue(out.changed)
        XCTAssertNil(out.exercise.suggestion)
        XCTAssertNil(out.exercise.adjustment)
        XCTAssertNil(out.exercise.warning)
        guard case .object(let prescObj) = out.exercise.prescription! else {
            XCTFail("prescription should remain an object"); return
        }
        XCTAssertNil(prescObj["weeklyAdjustment"])
        XCTAssertEqual(prescObj["targetReps"]?.intValue, 8)
    }

    func testStripLegacyAdviceFromSessionEmptiesExplanationsAndDropsDeloadDecision() {
        let session = TrainingSession(
            id: "s1",
            completed: true,
            _unknown: OrderedJSONObject(entries: [
                .init(key: "explanations", value: .array([.string("you crushed it")])),
                .init(key: "deloadDecision", value: .object(OrderedJSONObject(entries: [
                    .init(key: "reason", value: .string("fatigue")),
                ]))),
            ])
        )
        let out = stripLegacyAdviceFromSession(session)
        XCTAssertTrue(out.changed)
        let unknown = out.session._unknown
        XCTAssertNil(unknown["deloadDecision"])
        XCTAssertEqual(unknown["explanations"]?.arrayValue?.count, 0)
    }

    // MARK: - Helpers

    private func makeAppData(rootEntries: [OrderedJSONObject.Entry]) throws -> AppData {
        let base: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(8))),
        ]
        let root = OrderedJSONObject(entries: base + rootEntries)
        let data = try JSONValue.object(root).canonicalJSONData()
        return try AppData(decoding: data)
    }
}
