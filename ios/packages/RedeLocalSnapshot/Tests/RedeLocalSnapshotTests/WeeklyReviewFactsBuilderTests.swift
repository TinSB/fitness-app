// FR-SUB3 每周教练复盘事实层：上一完整 ISO 周、真实训练日、clean 统计与时间截断。

import XCTest
@testable import RedeLocalSnapshot

final class WeeklyReviewFactsBuilderTests: XCTestCase {
    private let facts = [
        "bench-press": ExerciseStatsFacts(loadFactor: 1, isCompound: true),
        "curl": ExerciseStatsFacts(loadFactor: 1, isCompound: false),
    ]

    private func session(
        _ id: String,
        _ date: String,
        exerciseId: String = "bench-press",
        weight: Double = 100,
        reps: Int = 5
    ) -> SnapshotSessionRecord {
        SnapshotSessionRecord(
            id: id,
            dateISO: date,
            exercises: [SnapshotExerciseRecord(
                exerciseId: exerciseId,
                sets: [SnapshotSetRecord(weightKg: weight, reps: reps)]
            )]
        )
    }

    func testBuildsLastCompleteWeekAndSeparatesDaysSessionsAndCleanVolume() throws {
        let all = [
            session("a", "2026-07-06", weight: 100, reps: 5),
            session("b", "2026-07-06", weight: 999, reps: 1),
            session("c", "2026-07-09", weight: 50, reps: 10),
            session("current", "2026-07-14", weight: 300, reps: 10),
        ]
        // b 的可疑组已由 DataHealth 排除；场次/训练日仍来自原貌 all。
        let clean = [
            session("a", "2026-07-06", weight: 100, reps: 5),
            SnapshotSessionRecord(id: "b", dateISO: "2026-07-06", exercises: []),
            session("c", "2026-07-09", weight: 50, reps: 10),
            session("current", "2026-07-14", weight: 300, reps: 10),
        ]

        let result = try XCTUnwrap(WeeklyReviewFactsBuilder.build(
            allSessions: all,
            cleanSessions: clean,
            facts: facts,
            todayISO: "2026-07-15"
        ))

        XCTAssertEqual(result.reviewWeekStartISO, "2026-07-06")
        XCTAssertEqual(result.reviewWeekEndExclusiveISO, "2026-07-13")
        XCTAssertEqual(result.trainingDayCount, 2, "同日两场只算一个训练日")
        XCTAssertEqual(result.sessionCount, 3, "场次仍如实保留")
        XCTAssertEqual(result.cleanVolumeKg, 1_000, accuracy: 0.001)
    }

    func testRecentMedianUsesAtMostFourPriorCompleteWeeksAndKeepsGapWeeks() throws {
        let prior = [
            session("w1a", "2026-06-09"), session("w1b", "2026-06-11"), session("w1c", "2026-06-13"),
            session("w2a", "2026-06-16"), session("w2b", "2026-06-18"), session("w2c", "2026-06-20"),
            // 2026-06-22 周故意空缺，应计 0。
            session("w4a", "2026-06-30"), session("w4b", "2026-07-02"),
            session("review", "2026-07-08"),
        ]

        let result = try XCTUnwrap(WeeklyReviewFactsBuilder.build(
            allSessions: prior,
            cleanSessions: prior,
            facts: facts,
            todayISO: "2026-07-15"
        ))

        XCTAssertEqual(try XCTUnwrap(result.recentMedianTrainingDays), 2.5, accuracy: 0.001)
    }

    func testTrendIsTruncatedAtCurrentWeekStart() throws {
        let sessions = [
            session("p1", "2026-06-09", weight: 100, reps: 1),
            session("p2", "2026-06-20", weight: 102.5, reps: 1),
            session("p3", "2026-07-06", weight: 105, reps: 1),
            session("future-current-week", "2026-07-14", weight: 300, reps: 10),
        ]

        let result = try XCTUnwrap(WeeklyReviewFactsBuilder.build(
            allSessions: sessions,
            cleanSessions: sessions,
            facts: facts,
            todayISO: "2026-07-15"
        ))
        let trend = try XCTUnwrap(result.keyLiftTrend)

        XCTAssertEqual(trend.exerciseId, "bench-press")
        XCTAssertEqual(trend.call, .up)
        XCTAssertLessThan(trend.deltaKg, 10, "当前周的 300kg 不能倒灌进上周复盘")
        XCTAssertEqual(trend.windowSessionCount, 3)
    }

    func testCurrentAndFutureSessionsNeverEnterReviewFacts() throws {
        let sessions = [
            session("review", "2026-07-10"),
            session("current", "2026-07-13"),
            session("future", "2026-08-01"),
        ]

        let result = try XCTUnwrap(WeeklyReviewFactsBuilder.build(
            allSessions: sessions,
            cleanSessions: sessions,
            facts: facts,
            todayISO: "2026-07-15"
        ))

        XCTAssertEqual(result.trainingDayCount, 1)
        XCTAssertEqual(result.sessionCount, 1)
        XCTAssertEqual(result.cleanVolumeKg, 500, accuracy: 0.001)
    }

    func testFirstCompletedWeekHasNoInventedComparisonMedian() throws {
        let sessions = [session("first", "2026-07-08")]

        let result = try XCTUnwrap(WeeklyReviewFactsBuilder.build(
            allSessions: sessions,
            cleanSessions: sessions,
            facts: facts,
            todayISO: "2026-07-15"
        ))

        XCTAssertNil(result.recentMedianTrainingDays)
        XCTAssertEqual(result.keyLiftTrend?.call, .calibrating)
    }

    func testInvalidTodayFailsClosed() {
        XCTAssertNil(WeeklyReviewFactsBuilder.build(
            allSessions: [],
            cleanSessions: [],
            facts: facts,
            todayISO: "2026-02-30"
        ))
    }
}
