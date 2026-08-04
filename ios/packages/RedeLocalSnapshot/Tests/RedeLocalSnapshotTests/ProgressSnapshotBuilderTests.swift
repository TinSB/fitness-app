// M4-1（FR-PR1/2/3 数据派生）：固定历史 → 确定的历史/e1RM/PR/周训练量投影。
// 口径锁定：e1RM = Epley w×(1+r/30)；展示点取层内 Epley 最大工作组，
// 决策点与 bestE1RmKg 保持重量优先顶组；
// PR = 顶组重量严格大于全部更早历史的同动作顶组（首练不发奖，同 M3 保守口径）；
// volume = Σ 重量×次数；周聚合 = ISO 周（周一起始），纯字符串日期数学，无时区依赖。

import XCTest
@testable import RedeLocalSnapshot

final class ProgressSnapshotBuilderTests: XCTestCase {
    private func set(_ w: Double, _ r: Int) -> SnapshotSetRecord {
        SnapshotSetRecord(weightKg: w, reps: r)
    }

    private func session(
        _ id: String, _ date: String,
        _ exercises: [(String, [SnapshotSetRecord])],
        duration: Int? = nil
    ) -> SnapshotSessionRecord {
        SnapshotSessionRecord(
            id: id, dateISO: date,
            exercises: exercises.map { SnapshotExerciseRecord(exerciseId: $0.0, sets: $0.1) },
            durationMinutes: duration
        )
    }

    // MARK: - 空输入

    func testEmptyHistoryProducesEmptySnapshot() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [])
        XCTAssertTrue(snapshot.history.isEmpty)
        XCTAssertTrue(snapshot.exerciseTrends.isEmpty)
        XCTAssertTrue(snapshot.weeklyVolume.isEmpty)
    }

    // MARK: - 历史投影（FR-PR1）

    func testHistoryIsNewestFirstWithVolumeAndSetCount() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6), set(60, 6)])], duration: 45),
            session("s2", "2026-06-03", [("squat", [set(80, 5)])]),
        ])
        XCTAssertEqual(snapshot.history.map(\.sessionId), ["s2", "s1"])
        let s1 = snapshot.history[1]
        XCTAssertEqual(s1.dateISO, "2026-06-01")
        XCTAssertEqual(s1.totalVolumeKg, 720) // 60×6×2
        XCTAssertEqual(s1.setCount, 2)
        XCTAssertEqual(s1.durationMinutes, 45)
        XCTAssertEqual(snapshot.history[0].totalVolumeKg, 400)
    }

    /// wave-9：辅助器械不进跨会话吨位/e1RM/趋势（辅助量裸加=方向反）；组数仍如实计。
    func testAssistedExcludedFromVolumeAndE1RM() {
        let facts: [String: ExerciseStatsFacts] = [
            "assisted-pull-up": ExerciseStatsFacts(loadFactor: 1.0, isCompound: true, isAssisted: true),
            "bench-press": ExerciseStatsFacts(loadFactor: 1.0, isCompound: true),
        ]
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("assisted-pull-up", [set(30, 8)]), ("bench-press", [set(60, 6)])]),
        ], facts: facts)
        XCTAssertEqual(snapshot.history[0].totalVolumeKg, 360, "吨位仅 bench 60×6=360；辅助 30×8 不计")
        XCTAssertEqual(snapshot.history[0].setCount, 2, "辅助组仍如实计数")
        XCTAssertFalse(snapshot.exerciseTrends.contains { $0.exerciseId == "assisted-pull-up" },
                       "辅助器械不产 e1RM 趋势点（重量轴是辅助量）")
    }

    func testSameDateKeepsInputOrderNewestFirst() {
        // 同日两场：历史 newest-first 下，输入靠后的视为更晚。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("am", "2026-06-03", [("bench-press", [set(60, 5)])]),
            session("pm", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
        ])
        XCTAssertEqual(snapshot.history.map(\.sessionId), ["pm", "am"])
    }

    func testTopSetPicksMaxWeightThenMoreReps() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("bench-press", [set(60, 6), set(62.5, 4), set(62.5, 6)]),
            ]),
        ])
        let top = snapshot.history[0].topSet
        XCTAssertEqual(top?.exerciseId, "bench-press")
        XCTAssertEqual(top?.weightKg, 62.5)
        XCTAssertEqual(top?.reps, 6)
    }

    // MARK: - PR 口径（FR-PR2，保守：首练不发奖、严格大于）

    func testFirstExposureIsNeverPR() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),
        ])
        XCTAssertEqual(snapshot.history[0].prExerciseIds, [])
    }

    func testHeavierTopThanAllEarlierSessionsIsPR() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),
            session("s2", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
            session("s3", "2026-06-05", [("bench-press", [set(61, 8)])]), // 低于 62.5 → 非 PR
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s2" })?.prExerciseIds, ["bench-press"])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s3" })?.prExerciseIds, [])
    }

    func testEqualTopWeightIsNotPR() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),
            session("s2", "2026-06-03", [("bench-press", [set(60, 8)])]), // 同重多次 ≠ 重量 PR
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s2" })?.prExerciseIds, [])
    }

    func testDuplicateExerciseEntriesInOneSessionMergeBeforePRJudgment() {
        // 同场同 exerciseId 两条（热身/工作组分录）：先合并再判 PR——
        // 首练日场内自比不发奖；e1RM 每场每动作只产出一个点；prIds 无重复。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("bench-press", [set(60, 6)]),
                ("bench-press", [set(62.5, 5)]),
            ]),
            session("s2", "2026-06-03", [
                ("bench-press", [set(65, 4)]),
                ("bench-press", [set(64, 6)]),
            ]),
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s1" })?.prExerciseIds, [])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "s2" })?.prExerciseIds, ["bench-press"])
        let trend = snapshot.exerciseTrends.first(where: { $0.exerciseId == "bench-press" })
        XCTAssertEqual(trend?.points.count, 2)
        XCTAssertEqual(trend?.points.first?.e1RmKg ?? 0, 62.5 * (1 + 5.0 / 30), accuracy: 1e-9)
    }

    func testSameDayLaterSessionCanPROverEarlierSession() {
        // 同日两场是两个独立的「场」：pm 顶组超过 am → pm 发 PR（场级口径）。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("am", "2026-06-03", [("bench-press", [set(60, 5)])]),
            session("pm", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
        ])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "am" })?.prExerciseIds, [])
        XCTAssertEqual(snapshot.history.first(where: { $0.sessionId == "pm" })?.prExerciseIds, ["bench-press"])
    }

    // MARK: - e1RM 趋势（FR-PR2，层内 Epley 最大工作组）

    func testE1RMPointsUseMaximumEpleySetInSession() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(62.5, 6), set(60, 8)])]),
        ])
        let trend = snapshot.exerciseTrends.first(where: { $0.exerciseId == "bench-press" })
        // 60×8 的 Epley 76 高于 62.5×6 的 75，故趋势点取 76。
        XCTAssertEqual(trend?.points.first?.e1RmKg ?? 0, 76.0, accuracy: 1e-9)
        XCTAssertEqual(trend?.points.first?.dateISO, "2026-06-01")
        XCTAssertEqual(trend?.points.first?.sessionId, "s1")
    }

    func testE1RMUsesHighestEpleySetWithoutChangingWeightPRTopSet() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s0", "2026-05-25", [
                ("lateral-raise", [set(19, 8)]),
            ]),
            session("s1", "2026-06-01", [
                ("lateral-raise", [set(20, 8), set(16, 20)]),
            ]),
        ])

        // 第二场的 20kg 比此前 19kg 更重，重量 PR / bestWeight 必须仍走最重工作组；
        // 只有 e1RM 趋势改取本场层内 Epley 更高的 16×20。
        XCTAssertEqual(snapshot.history[0].topSet?.weightKg, 20)
        XCTAssertEqual(snapshot.history[0].topSet?.reps, 8)
        XCTAssertEqual(snapshot.history[0].prExerciseIds, ["lateral-raise"])
        let trend = snapshot.exerciseTrends.first { $0.exerciseId == "lateral-raise" }
        XCTAssertEqual(trend?.bestWeightKg, 20)
        XCTAssertEqual(trend?.points.last?.e1RmKg ?? 0, 16 * (1 + 20.0 / 30), accuracy: 1e-9)
    }

    func testDisplayE1RMMetricDoesNotChangeAnyDecisionConsumerOutput() throws {
        let baselineDates = [
            "2026-02-23", "2026-03-02", "2026-03-09",
            "2026-03-16", "2026-03-23", "2026-03-30",
        ]
        let recentDates = [
            "2026-06-01", "2026-06-08", "2026-06-15",
            "2026-06-22", "2026-06-29", "2026-07-06",
        ]
        let allDates = baselineDates + recentDates
        let sessions = allDates.enumerated().map { index, date in
            let backoff = baselineDates.contains(date) ? 50.0 : 80.0
            return session(
                "s\(index)",
                date,
                [("bench-press", [set(85, 5), set(backoff, 20), set(backoff, 20)])]
            )
        }
        let snapshot = ProgressSnapshotBuilder.build(sessions: sessions)
        let trend = try XCTUnwrap(snapshot.exerciseTrends.first { $0.exerciseId == "bench-press" })
        let legacyTopSetE1RM = 85 * (1 + 5.0 / 30)

        // 展示曲线可在近期选中 80×20（133.33kg），但历史决策口径必须继续只看
        // 重量优先顶组 85×5（99.17kg），否则升级后会凭空抬高等级与里程碑。
        XCTAssertEqual(trend.points.last?.e1RmKg ?? 0, 80 * (1 + 20.0 / 30), accuracy: 1e-9)
        XCTAssertEqual(trend.decisionE1RmPoints.count, sessions.count)
        XCTAssertTrue(trend.decisionE1RmPoints.allSatisfy {
            abs($0.e1RmKg - legacyTopSetE1RM) < 1e-9
        })
        XCTAssertEqual(trend.bestE1RmKg, legacyTopSetE1RM, accuracy: 1e-9)

        let rows = allDates.map {
            MuscleVolumeAggregator.ContributionRow(
                dateISO: $0, muscleRaw: "chest", weight: 1, setCount: 3
            )
        }
        let touches = allDates.enumerated().map { index, _ in
            MuscleTouchRow(
                muscleRaw: "chest",
                sessionId: "s\(index)",
                familyId: ["press", "incline", "fly"][index % 3]
            )
        }
        let legacyRows = allDates.map {
            MuscleE1RMRow(muscleRaw: "chest", dateISO: $0, e1RmKg: legacyTopSetE1RM)
        }
        let decisionRows = trend.decisionE1RmPoints.map {
            MuscleE1RMRow(muscleRaw: "chest", dateISO: $0.dateISO, e1RmKg: $0.e1RmKg)
        }
        let previousMemory = MuscleLevelMemory(
            levels: ["chest": 1],
            peaks: ["chest": 1],
            tierRaw: "calibrating",
            updatedAtIso: "2026-06-30"
        )
        func profile(e1rmRows: [MuscleE1RMRow], bestE1RM: Double) -> MuscleDevelopmentProfile {
            MuscleProfileComposer.compose(.init(
                rows: rows,
                touches: touches,
                e1rmRows: e1rmRows,
                bestActualKgByExercise: ["bench-press": 85],
                bestE1RmKgByExercise: ["bench-press": bestE1RM],
                unitSystem: "kg",
                sexRaw: "male",
                bodyweightKg: 100,
                previousLevels: previousMemory.levels,
                previousPeaks: previousMemory.peaks,
                previousTierRaw: previousMemory.tierRaw,
                nowISO: "2026-07-07"
            ))
        }
        let legacyProfile = profile(e1rmRows: legacyRows, bestE1RM: legacyTopSetE1RM)
        let actualProfile = profile(e1rmRows: decisionRows, bestE1RM: trend.bestE1RmKg)
        XCTAssertEqual(actualProfile, legacyProfile, "the complete MLE profile must stay byte-for-byte equivalent")

        let displayRows = trend.points.map {
            MuscleE1RMRow(muscleRaw: "chest", dateISO: $0.dateISO, e1RmKg: $0.e1RmKg)
        }
        let displayBest = trend.points.map(\.e1RmKg).max() ?? 0
        let displayProfile = profile(e1rmRows: displayRows, bestE1RM: displayBest)
        XCTAssertNotEqual(
            displayProfile,
            legacyProfile,
            "fixture must be sensitive: accidentally routing display points into MLE must fail"
        )

        let legacyMemory = MuscleLevelMemory.advancing(
            from: legacyProfile,
            previous: previousMemory,
            completedSessionCount: sessions.count,
            atIso: "2026-07-07"
        )
        let actualMemory = MuscleLevelMemory.advancing(
            from: actualProfile,
            previous: previousMemory,
            completedSessionCount: sessions.count,
            atIso: "2026-07-07"
        )
        XCTAssertEqual(actualMemory, legacyMemory, "peaks and pending breakthroughs must not change")
        XCTAssertEqual(
            MuscleEventShareBuilder.snapshots(
                pending: actualMemory.pendingBreakthroughs ?? [],
                generatedDateISO: "2026-07-07",
                recentTrainingDays: 4
            ),
            MuscleEventShareBuilder.snapshots(
                pending: legacyMemory.pendingBreakthroughs ?? [],
                generatedDateISO: "2026-07-07",
                recentTrainingDays: 4
            ),
            "level-up/share cards must not appear from a display-only metric change"
        )

        let legacyMilestones = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["bench-press": 85],
            estimatedE1RmKgByExercise: ["bench-press": legacyTopSetE1RM],
            eligibleExerciseIds: ["bench-press"],
            unitSystem: "kg"
        )
        let actualMilestones = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["bench-press": trend.bestWeightKg],
            estimatedE1RmKgByExercise: ["bench-press": trend.bestE1RmKg],
            eligibleExerciseIds: ["bench-press"],
            unitSystem: "kg"
        )
        XCTAssertEqual(actualMilestones, legacyMilestones, "estimated strength milestones must not change")
        let displayMilestones = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["bench-press": trend.bestWeightKg],
            estimatedE1RmKgByExercise: ["bench-press": displayBest],
            eligibleExerciseIds: ["bench-press"],
            unitSystem: "kg"
        )
        XCTAssertNotEqual(
            displayMilestones,
            legacyMilestones,
            "fixture must catch a display peak leaking into estimated milestones"
        )

        let legacyRelative = RelativeStrengthStandards.achievements(
            sex: "male",
            bodyweightKg: 100,
            bestActualKgByExercise: ["bench-press": 85],
            bestE1RmKgByExercise: ["bench-press": legacyTopSetE1RM],
            atIso: "2026-07-07"
        )
        let actualRelative = RelativeStrengthStandards.achievements(
            sex: "male",
            bodyweightKg: 100,
            bestActualKgByExercise: ["bench-press": trend.bestWeightKg],
            bestE1RmKgByExercise: ["bench-press": trend.bestE1RmKg],
            atIso: "2026-07-07"
        )
        XCTAssertEqual(actualRelative, legacyRelative, "relative-strength tiers must not change")
        let displayRelative = RelativeStrengthStandards.achievements(
            sex: "male",
            bodyweightKg: 100,
            bestActualKgByExercise: ["bench-press": trend.bestWeightKg],
            bestE1RmKgByExercise: ["bench-press": displayBest],
            atIso: "2026-07-07"
        )
        XCTAssertNotEqual(
            displayRelative,
            legacyRelative,
            "fixture must catch display points leaking into relative-strength tiers"
        )
    }

    func testExerciseTrendIsOldestToNewestWithLatestAndBest() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)])]),   // e1RM 72
            session("s2", "2026-06-03", [("bench-press", [set(62.5, 6)])]), // e1RM 75
            session("s3", "2026-06-05", [("bench-press", [set(60, 5)])]),   // e1RM 70
        ])
        let trend = snapshot.exerciseTrends.first(where: { $0.exerciseId == "bench-press" })
        XCTAssertEqual(trend?.points.map(\.sessionId), ["s1", "s2", "s3"])
        XCTAssertEqual(trend?.latestE1RmKg ?? 0, 70.0, accuracy: 1e-9)
        XCTAssertEqual(trend?.bestE1RmKg ?? 0, 75.0, accuracy: 1e-9)
        XCTAssertEqual(trend?.bestWeightKg, 62.5)
    }

    func testExerciseTrendsSortedByExerciseIdForDeterminism() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("squat", [set(80, 5)]),
                ("bench-press", [set(60, 6)]),
            ]),
        ])
        XCTAssertEqual(snapshot.exerciseTrends.map(\.exerciseId), ["bench-press", "squat"])
    }

    // MARK: - 周训练量（FR-PR3，ISO 周·周一起始）

    func testWeeklyVolumeBucketsByISOWeekMondayStart() {
        // 2026-06-07 是周日、2026-06-08 是周一 → 两个不同的周桶。
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-07", [("bench-press", [set(60, 6)])]),
            session("s2", "2026-06-08", [("squat", [set(80, 5)])]),
        ])
        XCTAssertEqual(snapshot.weeklyVolume.map(\.weekStartISO), ["2026-06-08", "2026-06-01"])
        XCTAssertEqual(snapshot.weeklyVolume[1].totalVolumeKg, 360)
        XCTAssertEqual(snapshot.weeklyVolume[0].totalVolumeKg, 400)
    }

    func testWeeklyVolumeAggregatesSetsAndSessions() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-02", [("bench-press", [set(60, 6), set(60, 6)])]),
            session("s2", "2026-06-04", [("squat", [set(80, 5)])]),
        ])
        XCTAssertEqual(snapshot.weeklyVolume.count, 1)
        let week = snapshot.weeklyVolume[0]
        XCTAssertEqual(week.weekStartISO, "2026-06-01")
        XCTAssertEqual(week.totalVolumeKg, 1120)
        XCTAssertEqual(week.setCount, 3)
        XCTAssertEqual(week.sessionCount, 2)
    }

    // MARK: - 防御与确定性

    func testInvalidDateEntriesAreSkippedEverywhere() {
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("bad", "2026-13-01", [("bench-press", [set(60, 6)])]),
            session("worse", "not-a-date", [("squat", [set(80, 5)])]),
            session("good", "2026-06-03", [("bench-press", [set(60, 6)])]),
        ])
        XCTAssertEqual(snapshot.history.map(\.sessionId), ["good"])
        XCTAssertEqual(snapshot.exerciseTrends.count, 1)
        XCTAssertEqual(snapshot.weeklyVolume.count, 1)
    }

    func testSameInputProducesEqualSnapshots() {
        let sessions = [
            session("s1", "2026-06-01", [("bench-press", [set(60, 6)]), ("squat", [set(80, 5)])]),
            session("s2", "2026-06-03", [("bench-press", [set(62.5, 5)])]),
        ]
        XCTAssertEqual(
            ProgressSnapshotBuilder.build(sessions: sessions),
            ProgressSnapshotBuilder.build(sessions: sessions)
        )
    }

    // MARK: - 日期数学（内部口径锁定）

    func testWeekStartHandlesLeapYearAndYearBoundary() {
        // 2024-02-29（闰日，周四）→ 该周周一 = 2024-02-26
        XCTAssertEqual(SnapshotDayMath.isoWeekStart(of: "2024-02-29"), "2024-02-26")
        // 2026-01-01（周四）→ 周一落在上一年 2025-12-29
        XCTAssertEqual(SnapshotDayMath.isoWeekStart(of: "2026-01-01"), "2025-12-29")
        // 周一自身不动
        XCTAssertEqual(SnapshotDayMath.isoWeekStart(of: "2026-06-08"), "2026-06-08")
        XCTAssertNil(SnapshotDayMath.isoWeekStart(of: "2026-02-30"))
    }

    // MARK: - §6.2 吨位系数（owner 拍板 B 案 2026-06-11）

    func testVolumeAppliesLoadFactorFromFacts() {
        let facts = ["db-bench-press": ExerciseStatsFacts(loadFactor: 2.0, isCompound: true)]
        let snapshot = ProgressSnapshotBuilder.build(sessions: [
            session("s1", "2026-06-01", [
                ("db-bench-press", [set(30, 10)]),   // 单只 30 → 吨位 30×10×2 = 600
                ("bench-press", [set(60, 5)]),       // facts 缺省 → ×1 = 300
            ]),
        ], facts: facts)
        XCTAssertEqual(snapshot.history.first?.totalVolumeKg, 900)
        XCTAssertEqual(snapshot.weeklyVolume.first?.totalVolumeKg, 900)
        // e1RM/PR 永不乘系数（只作用于吨位统计）
        let trend = snapshot.exerciseTrends.first { $0.exerciseId == "db-bench-press" }
        XCTAssertEqual(trend?.bestWeightKg, 30)
    }
}
