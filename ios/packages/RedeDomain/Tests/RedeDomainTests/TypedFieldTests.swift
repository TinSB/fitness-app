// MVP 子集的类型化只读视图：profile / program / 完成训练 / logged sets。
// 视图永不改写 storage；缺失或类型不符一律给 nil/空，不抛错（清洗归 M1-3 DataHealth）。

import Foundation
import XCTest
@testable import RedeDomain

final class TypedFieldTests: XCTestCase {
    func testUserProfileTypedFields() throws {
        let profile = try TestSupport.loadSampleAppData().userProfile
        XCTAssertEqual(profile.id, "user-1")
        XCTAssertEqual(profile.name, "样例用户")
        XCTAssertEqual(profile.sex, "M")
        XCTAssertEqual(profile.age, 30)
        XCTAssertEqual(profile.heightCm, 178)
        XCTAssertEqual(profile.weightKg, 74.5)
        XCTAssertEqual(profile.trainingLevel, "intermediate")
        XCTAssertEqual(profile.primaryGoal, "hypertrophy")
        XCTAssertEqual(profile.weeklyTrainingDays, 4)
        XCTAssertEqual(profile.sessionDurationMin, 75)
        XCTAssertEqual(profile.injuryFlags, ["knee"])
    }

    func testProgramTemplateTypedFields() throws {
        let program = try TestSupport.loadSampleAppData().programTemplate
        XCTAssertEqual(program.id, "prog-1")
        XCTAssertEqual(program.primaryGoal, "hypertrophy")
        XCTAssertEqual(program.splitType, "upper-lower")
        XCTAssertEqual(program.daysPerWeek, 4)
    }

    func testCompletedSessionTypedFields() throws {
        let session = try XCTUnwrap(TestSupport.loadSampleAppData().history.first)
        XCTAssertEqual(session.id, "session-1")
        XCTAssertEqual(session.date, "2026-06-01")
        XCTAssertEqual(session.startedAt, "2026-06-01T10:00:00.000Z")
        XCTAssertEqual(session.finishedAt, "2026-06-01T11:05:00.000Z")
        XCTAssertEqual(session.durationMin, 65)
        XCTAssertEqual(session.completed, true)
        XCTAssertEqual(session.exercises.count, 1)
    }

    func testLoggedSetTypedFields() throws {
        let exercise = try XCTUnwrap(TestSupport.loadSampleAppData().history.first?.exercises.first)
        XCTAssertEqual(exercise.id, "ex-1")
        XCTAssertEqual(exercise.exerciseId, "barbell-bench-press")
        XCTAssertEqual(exercise.name, "杠铃卧推")

        let set = try XCTUnwrap(exercise.sets.first)
        XCTAssertEqual(set.id, "set-1")
        XCTAssertEqual(set.setIndex, 0)
        XCTAssertEqual(set.exerciseId, "barbell-bench-press")
        XCTAssertEqual(set.weight, 80)          // 整数字面量也能作为 Double 读出（kg 存储口径）
        XCTAssertEqual(set.reps, 8)
        XCTAssertEqual(set.rir, 2)
        XCTAssertEqual(set.completedAt, "2026-06-01T10:12:00.000Z")
        XCTAssertEqual(set.done, true)
        XCTAssertEqual(set.completionStatus, "completed")

        let secondSet = try XCTUnwrap(exercise.sets.last)
        XCTAssertEqual(secondSet.weight, 82.5)
    }

    func testMixedTypeStringArrayReadsAsNilButIsPreserved() throws {
        // asStringArray 是全有或全无：混入非字符串元素时视图给 nil（解析失败 ≠ 缺失），
        // storage 原样保留——下游要区分这两种情况时读 storage。
        let json = #"{"schemaVersion": 8, "userProfile": {"injuryFlags": ["knee", 42]}}"#
        let appData = try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
        XCTAssertNil(appData.userProfile.injuryFlags)
        XCTAssertEqual(appData.userProfile.storage["injuryFlags"], .array([.string("knee"), .int(42)]))
    }

    func testMissingSlotsDefaultToEmptyViews() throws {
        let appData = try JSONDecoder().decode(AppData.self, from: Data(#"{"schemaVersion": 8}"#.utf8))
        XCTAssertEqual(appData.history, [])
        XCTAssertEqual(appData.userProfile.storage, [:])
        XCTAssertEqual(appData.programTemplate.storage, [:])
        XCTAssertNil(appData.userProfile.name)
    }
}
