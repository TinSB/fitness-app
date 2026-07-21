// M1-3 验收核心：脏/缺字段被安全投影——坏 session/exercise/set 被丢弃并
// 如实记入 issues，好数据原样通过；raw 永不被改写。

import Foundation
import XCTest
import RedeDomain
@testable import RedeDataHealth

final class CleanSessionProjectionTests: XCTestCase {
    private func makeView(_ json: String) throws -> CleanAppDataView {
        let appData = try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
        return CleanAppDataViewBuilder.build(from: appData)
    }

    private static let cleanFixture = #"""
    {
      "schemaVersion": 8,
      "history": [
        {
          "id": "s1", "date": "2026-06-01", "completed": true,
          "exercises": [
            {
              "exerciseId": "bench-press",
              "sets": [
                {"weight": 80, "reps": 8, "rir": 2},
                {"weight": 82.5, "reps": 6}
              ]
            }
          ]
        }
      ]
    }
    """#

    func testCleanDataPassesThroughIntact() throws {
        let view = try makeView(Self.cleanFixture)
        XCTAssertTrue(view.issues.isEmpty)
        XCTAssertFalse(view.hasDirtyData)
        XCTAssertEqual(view.sessions.count, 1)

        let session = try XCTUnwrap(view.sessions.first)
        XCTAssertEqual(session.id, "s1")
        XCTAssertEqual(session.date, "2026-06-01")
        XCTAssertEqual(session.exercises.first?.exerciseId, "bench-press")
        XCTAssertEqual(session.exercises.first?.sets.count, 2)
        XCTAssertEqual(session.exercises.first?.sets.first?.weight, 80)
        XCTAssertEqual(session.exercises.first?.sets.first?.reps, 8)
        XCTAssertEqual(session.exercises.first?.sets.first?.rir, 2)
        XCTAssertNil(session.exercises.first?.sets.last?.rir)
    }

    func testRawIsCarriedUnchanged() throws {
        let appData = try JSONDecoder().decode(AppData.self, from: Data(Self.cleanFixture.utf8))
        let view = CleanAppDataViewBuilder.build(from: appData)
        XCTAssertEqual(view.raw.storage, appData.storage)
    }

    func testSessionWithoutIdIsDroppedWithIssue() throws {
        let view = try makeView(#"{"schemaVersion": 8, "history": [{"date": "2026-06-01", "completed": true}]}"#)
        XCTAssertTrue(view.sessions.isEmpty)
        XCTAssertEqual(view.issues, [.sessionDropped(id: nil, dateISO: "2026-06-01", reason: .missingId)])
        XCTAssertTrue(view.hasDirtyData)
    }

    func testSessionNotCompletedIsDropped() throws {
        let view = try makeView(#"{"schemaVersion": 8, "history": [{"id": "s1", "date": "2026-06-01", "completed": false}]}"#)
        XCTAssertTrue(view.sessions.isEmpty)
        XCTAssertEqual(view.issues, [.sessionDropped(id: "s1", dateISO: "2026-06-01", reason: .notCompleted)])
    }

    func testSessionMissingCompletedFieldIsDroppedAsNotCompleted() throws {
        // 字段缺失与显式 false 刻意同义（见 DataHealthIssue.notCompleted 注释）。
        let view = try makeView(#"{"schemaVersion": 8, "history": [{"id": "s1", "date": "2026-06-01"}]}"#)
        XCTAssertTrue(view.sessions.isEmpty)
        XCTAssertEqual(view.issues, [.sessionDropped(id: "s1", dateISO: "2026-06-01", reason: .notCompleted)])
    }

    func testSessionWithoutDateIsDropped() throws {
        let view = try makeView(#"{"schemaVersion": 8, "history": [{"id": "s1", "completed": true}]}"#)
        XCTAssertEqual(view.issues, [.sessionDropped(id: "s1", dateISO: nil, reason: .missingDate)])
    }

    func testSessionWithInvalidDateFormatIsDropped() throws {
        let view = try makeView(#"{"schemaVersion": 8, "history": [{"id": "s1", "date": "2026-6-9", "completed": true}]}"#)
        XCTAssertTrue(view.sessions.isEmpty)
        XCTAssertEqual(view.issues, [.sessionDropped(id: "s1", dateISO: nil, reason: .invalidDateFormat)])
    }

    func testIsoDatetimeDatePassesFormatGuard() throws {
        let view = try makeView(#"{"schemaVersion": 8, "history": [{"id": "s1", "date": "2026-06-09T10:00:00.000Z", "completed": true}]}"#)
        XCTAssertEqual(view.sessions.count, 1)
        XCTAssertTrue(view.issues.isEmpty)
    }

    func testDuplicateSessionIdKeepsFirstDropsRest() throws {
        let view = try makeView(#"""
        {"schemaVersion": 8, "history": [
          {"id": "dup", "date": "2026-06-01", "completed": true, "exercises": []},
          {"id": "dup", "date": "2026-06-02", "completed": true, "exercises": []}
        ]}
        """#)
        XCTAssertEqual(view.sessions.count, 1)
        XCTAssertEqual(view.sessions.first?.date, "2026-06-01")
        XCTAssertEqual(view.issues, [.sessionDropped(id: "dup", dateISO: "2026-06-02", reason: .duplicateId)])
    }

    func testNonObjectHistoryElementIsReportedNotCrashed() throws {
        let view = try makeView(#"{"schemaVersion": 8, "history": ["junk", {"id": "s1", "date": "2026-06-01", "completed": true}]}"#)
        XCTAssertEqual(view.sessions.count, 1)
        XCTAssertEqual(view.issues, [.sessionDropped(id: nil, dateISO: nil, reason: .notAnObject)])
    }

    func testExerciseWithoutExerciseIdIsDropped() throws {
        let view = try makeView(#"""
        {"schemaVersion": 8, "history": [
          {"id": "s1", "date": "2026-06-01", "completed": true,
           "exercises": [{"sets": [{"weight": 80, "reps": 8}]}]}
        ]}
        """#)
        XCTAssertEqual(view.sessions.first?.exercises.count, 0)
        XCTAssertEqual(view.issues, [
            .exerciseDropped(sessionId: "s1", dateISO: "2026-06-01", reason: .missingExerciseId),
        ])
    }

    func testInvalidSetsAreDroppedIndividually() throws {
        let view = try makeView(#"""
        {"schemaVersion": 8, "history": [
          {"id": "s1", "date": "2026-06-01", "completed": true,
           "exercises": [{"exerciseId": "squat", "sets": [
             {"weight": 100, "reps": 5},
             {"weight": 100, "reps": 0},
             {"weight": -5, "reps": 5},
             {"reps": 5}
           ]}]}
        ]}
        """#)
        let sets = try XCTUnwrap(view.sessions.first?.exercises.first?.sets)
        XCTAssertEqual(sets.count, 1)
        XCTAssertEqual(view.issues, [
            .setDropped(sessionId: "s1", dateISO: "2026-06-01", exerciseId: "squat", reason: .invalidReps),
            .setDropped(sessionId: "s1", dateISO: "2026-06-01", exerciseId: "squat", reason: .invalidWeight),
            .setDropped(sessionId: "s1", dateISO: "2026-06-01", exerciseId: "squat", reason: .invalidWeight),
        ])
    }

    func testOutOfRangeRirProjectsAsNilWithIssue() throws {
        let view = try makeView(#"""
        {"schemaVersion": 8, "history": [
          {"id": "s1", "date": "2026-06-01", "completed": true,
           "exercises": [{"exerciseId": "squat", "sets": [{"weight": 100, "reps": 5, "rir": 99}]}]}
        ]}
        """#)
        let set = try XCTUnwrap(view.sessions.first?.exercises.first?.sets.first)
        XCTAssertNil(set.rir)
        XCTAssertEqual(view.issues, [
            .setFieldIgnored(sessionId: "s1", dateISO: "2026-06-01", exerciseId: "squat", field: "rir"),
        ])
    }

    func testBoundaryValuesPassGuards() throws {
        // 合法下界/上界必须放行：weight=0（自重）、reps=1、rir=0（力竭）、rir=15。
        let view = try makeView(#"""
        {"schemaVersion": 8, "history": [
          {"id": "s1", "date": "2026-06-01", "completed": true,
           "exercises": [{"exerciseId": "push-up", "sets": [
             {"weight": 0, "reps": 1, "rir": 0},
             {"weight": 0, "reps": 1, "rir": 15}
           ]}]}
        ]}
        """#)
        XCTAssertTrue(view.issues.isEmpty)
        let sets = try XCTUnwrap(view.sessions.first?.exercises.first?.sets)
        XCTAssertEqual(sets.count, 2)
        XCTAssertEqual(sets.first?.weight, 0)
        XCTAssertEqual(sets.first?.reps, 1)
        XCTAssertEqual(sets.first?.rir, 0)
        XCTAssertEqual(sets.last?.rir, 15)
    }

    func testJustOutOfRangeRirProjectsAsNil() throws {
        let view = try makeView(#"""
        {"schemaVersion": 8, "history": [
          {"id": "s1", "date": "2026-06-01", "completed": true,
           "exercises": [{"exerciseId": "squat", "sets": [
             {"weight": 100, "reps": 5, "rir": -0.1},
             {"weight": 100, "reps": 5, "rir": 15.1}
           ]}]}
        ]}
        """#)
        let sets = try XCTUnwrap(view.sessions.first?.exercises.first?.sets)
        XCTAssertEqual(sets.map(\.rir), [nil, nil])
        XCTAssertEqual(view.issues.count, 2)
    }

    func testExerciseWithAllSetsDroppedSurvivesWithEmptySets() throws {
        // 设计声明：exerciseId 有效但全部 set 无效时，exercise 保留（sets=[]）——
        // 让 M2 引擎能区分「没做这个动作」和「做了但数据全脏」。
        let view = try makeView(#"""
        {"schemaVersion": 8, "history": [
          {"id": "s1", "date": "2026-06-01", "completed": true,
           "exercises": [{"exerciseId": "squat", "sets": [{"weight": -1, "reps": 0}]}]}
        ]}
        """#)
        let exercise = try XCTUnwrap(view.sessions.first?.exercises.first)
        XCTAssertEqual(exercise.exerciseId, "squat")
        XCTAssertTrue(exercise.sets.isEmpty)
        XCTAssertEqual(view.issues, [
            .setDropped(sessionId: "s1", dateISO: "2026-06-01", exerciseId: "squat", reason: .invalidWeight),
        ])
    }

    func testDroppedTrainingIssuesExposeDateScopeAndUnscopedFailures() throws {
        let scoped = try makeView(#"{"schemaVersion": 8, "history": [{"id": "s1", "date": "2026-06-01", "completed": true, "exercises": [{"exerciseId": "squat", "sets": [{"weight": -1, "reps": 5}]}]}]}"#)
        let scopedIssue = try XCTUnwrap(scoped.issues.first)
        XCTAssertTrue(scopedIssue.isDroppedTrainingData)
        XCTAssertEqual(scopedIssue.droppedTrainingDateISO, "2026-06-01")

        let unscoped = try makeView(#"{"schemaVersion": 8, "history": [{"id": "s2", "date": "bad-date", "completed": true}]}"#)
        let unscopedIssue = try XCTUnwrap(unscoped.issues.first)
        XCTAssertTrue(unscopedIssue.isDroppedTrainingData)
        XCTAssertNil(unscopedIssue.droppedTrainingDateISO)
    }

    func testEmptyAppDataYieldsEmptyCleanView() throws {
        let view = try makeView(#"{"schemaVersion": 8}"#)
        XCTAssertTrue(view.sessions.isEmpty)
        XCTAssertTrue(view.issues.isEmpty)
        XCTAssertFalse(view.hasDirtyData)
    }
}
