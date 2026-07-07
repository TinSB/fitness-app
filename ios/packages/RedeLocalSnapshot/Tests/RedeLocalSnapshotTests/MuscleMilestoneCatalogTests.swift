// MLE-4（2026-07-07）：契约版里程碑目录（§6.5.5 九条）+ 达成判定 + level floor / tier 信号。
// 语义锁：kg/lb 双梯禁互转（同 FR-PR7 既有口径）；actual 达标出 actualCompletedSet
//（confidence high）、仅 e1RM 达标出 estimatedOneRepMax（medium）且**同一里程碑
// actual 已达不重复出估算版**（不冒充红线）；levelFloors 取 linked muscles 的
// max floor；floor 只抬已解锁肌群、命中后 levelProgress 置 0 并打 evidence 标记；
// balance 用未抬底曲线级（milestone 非覆盖证据，不得压平方差美化均衡度）；
// tierCandidate 达成 = tier 进步信号（estimated 达标同样生效，置信门槛在调用方——
// 批次 B 接线注意事项）。既有 FR-PR7 简化版行为零回归。

import XCTest
@testable import RedeLocalSnapshot

final class MuscleMilestoneCatalogTests: XCTestCase {
    func testContractMatchesAllNineMilestoneAnchors() {
        // §6.5.5 九条全表锚：手滑改任何阈值/floor/关联都会被拦下（审查 m5）
        let expected: [(String, Double, Double, [MuscleGroupID], Int?, TrainingTier?)] = [
            ("bench-60kg", 60, 135, [.chest, .triceps, .shoulders], 4, nil),
            ("bench-80kg", 80, 185, [.chest, .triceps, .shoulders], 7, nil),
            ("bench-100kg", 100, 225, [.chest, .triceps, .shoulders], 10, .intermediate),
            ("bench-120kg", 120, 265, [.chest, .triceps, .shoulders], 13, nil),
            ("bench-140kg", 140, 315, [.chest, .triceps, .shoulders], 16, .advanced),
            ("squat-140kg", 140, 315, [.quads, .glutes, .hamstrings, .core], 11, nil),
            ("deadlift-180kg", 180, 405, [.hamstrings, .glutes, .back, .core], 14, nil),
            ("ohp-60kg", 60, 135, [.shoulders, .triceps, .core], 10, nil),
            ("weighted-pullup-20kg", 20, 45, [.back, .biceps, .core], 11, nil),
        ]
        XCTAssertEqual(MuscleMilestoneCatalog.v1.count, expected.count)
        XCTAssertEqual(Set(MuscleMilestoneCatalog.v1.map(\.milestoneId)).count, expected.count)
        for (definition, anchor) in zip(MuscleMilestoneCatalog.v1, expected) {
            XCTAssertEqual(definition.milestoneId, anchor.0)
            XCTAssertEqual(definition.thresholdKg, anchor.1, definition.milestoneId)
            XCTAssertEqual(definition.thresholdLb, anchor.2, definition.milestoneId)
            XCTAssertEqual(definition.linkedMuscles, anchor.3, definition.milestoneId)
            XCTAssertEqual(definition.levelFloor, anchor.4, definition.milestoneId)
            XCTAssertEqual(definition.tierCandidate, anchor.5, definition.milestoneId)
        }
        XCTAssertEqual(MuscleMilestoneCatalog.catalogVersion, "mle-milestones-v1")
    }

    func testActualAchievementPreferredOverEstimated() {
        // 实测 102kg：bench-100 actual（high）；e1RM 118 未过 120 档 → 无额外估算条目
        let out = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 102],
            bestE1RmKgByExercise: ["bench-press": 118],
            unitSystem: "kg", atIso: "2026-07-07")
        let bench = out.filter { $0.exerciseId == "bench-press" }
        // 60/80/100 三档 actual 全达
        XCTAssertEqual(bench.filter { $0.achievedBy == .actualCompletedSet }.count, 3)
        XCTAssertTrue(bench.allSatisfy { $0.achievedBy == .actualCompletedSet })
        XCTAssertTrue(bench.allSatisfy { $0.confidence == .high })
    }

    func testEstimatedOnlyWhenAboveActual() {
        // 实测 85（过 60/80）+ e1RM 105（过 100 档）→ 100 档出 estimated（medium）
        let out = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 85],
            bestE1RmKgByExercise: ["bench-press": 105],
            unitSystem: "kg", atIso: "2026-07-07")
        let bench100 = out.first { $0.milestoneId == "bench-100kg" }
        XCTAssertEqual(bench100?.achievedBy, .estimatedOneRepMax)
        XCTAssertEqual(bench100?.confidence, .medium)
        // 60/80 档 actual 不被估算覆盖
        XCTAssertEqual(out.first { $0.milestoneId == "bench-60kg" }?.achievedBy, .actualCompletedSet)
    }

    func testLbLadderIsSeparateNotConverted() {
        // lb 用户：102kg ≈ 224.9 lb —— 未过 225 lb 档（禁互转：不是 100kg=225lb 等值）
        let out = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 102],
            bestE1RmKgByExercise: [:],
            unitSystem: "lb", atIso: "2026-07-07")
        XCTAssertNil(out.first { $0.milestoneId == "bench-100kg" })
        // 102.5kg ≈ 225.97 lb → 过档
        let out2 = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 102.5],
            bestE1RmKgByExercise: [:],
            unitSystem: "lb", atIso: "2026-07-07")
        XCTAssertNotNil(out2.first { $0.milestoneId == "bench-100kg" })
    }

    func testLevelFloorsTakeMaxAcrossAchievements() {
        // bench-100（chest/triceps/shoulders floor 10）+ ohp-60（shoulders/triceps/core floor 10）
        // + bench-60（floor 4）→ shoulders/triceps floor = 10（max）
        let out = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 100, "overhead-press": 60],
            bestE1RmKgByExercise: [:],
            unitSystem: "kg", atIso: "2026-07-07")
        let floors = MuscleMilestoneCatalog.levelFloors(from: out)
        XCTAssertEqual(floors[.chest], 10)
        XCTAssertEqual(floors[.shoulders], 10)
        XCTAssertEqual(floors[.triceps], 10)
        XCTAssertEqual(floors[.core], 10)
        XCTAssertNil(floors[.quads])
    }

    // MARK: - 组装接线（assemble + milestones）

    private func makeComputation(
        _ muscle: MuscleGroupID, level: Int, progress: Double = 0.5,
        isCalibrating: Bool = false
    ) -> MuscleLevelComputation {
        MuscleLevelComputation(
            muscleId: muscle, isCalibrating: isCalibrating, level: level,
            progress: progress, confidence: .medium,
            breakdown: MuscleLevelScoreBreakdown(
                exposureScore: 30, performanceScore: 15, milestoneScore: 0, progressionScore: 0,
                coverageScore: 5, consistencyScore: 3, recoveryPenalty: 0, goalAdjustment: 0),
            evidence: [], limitations: [])
    }

    private func makeObservations(_ muscles: [MuscleGroupID]) -> [MuscleGroupID: MuscleObservations] {
        let weekly: [String: Double] = ["2026-06-22": 8, "2026-06-29": 8, "2026-07-06": 8,
                                        "2026-06-01": 8, "2026-06-08": 8, "2026-06-15": 8]
        return Dictionary(uniqueKeysWithValues: muscles.map {
            ($0, MuscleObservations(muscleId: $0, weeklyFractionalSets: weekly,
                                    sessionsTouched: 6, movementFamiliesTouched: 2, e1rmPoints: []))
        })
    }

    private func assembleThreeMuscles(
        chestLevel: Int = 5, chestProgress: Double = 0.2, chestCalibrating: Bool = false,
        milestones: [StrengthMilestoneAchievement]
    ) -> MuscleDevelopmentProfile {
        let comps = [
            makeComputation(.chest, level: chestLevel, progress: chestProgress,
                            isCalibrating: chestCalibrating),
            makeComputation(.back, level: 9),
            makeComputation(.quads, level: 10),
        ]
        return MuscleProfileAssembler.assemble(
            computations: comps, observations: makeObservations([.chest, .back, .quads]),
            previousLevels: [:], previousPeaks: [:], previousTier: nil,
            generatedAtIso: "2026-07-08", config: .v1, milestones: milestones)
    }

    func testAssembleAppliesMilestoneFloorAndSignal() {
        // chest 曲线级 5，bench-100 floor 10 → 抬到 10；tierCandidate 作进步信号
        let milestones = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 100],
            bestE1RmKgByExercise: [:],
            unitSystem: "kg", atIso: "2026-07-07")
        let p = assembleThreeMuscles(milestones: milestones)
        let chest = p.estimates.first { $0.muscleId == .chest }
        XCTAssertEqual(chest?.currentLevel, 10)                   // floor 抬底 5 → 10
        XCTAssertEqual(chest?.peakLevel, 10)
        // 抬底命中：曲线级 progress（5→6 的 20%）对 Lv.10 无意义 → 置 0 + evidence 标记
        XCTAssertEqual(chest?.levelProgress, 0)
        XCTAssertTrue(chest?.evidence.contains { $0.code == "milestoneFloorApplied" } ?? false)
        XCTAssertFalse(p.strengthMilestones.isEmpty)              // 档案带出成就
        // tierCandidate（intermediate）作为进步信号：中位 10 → intermediate（而非 novicePlus）
        XCTAssertEqual(p.overallTier, .intermediate)
        // 未关联肌群不被抬底、progress 不受牵连
        let back = p.estimates.first { $0.muscleId == .back }
        XCTAssertEqual(back?.currentLevel, 9)
        XCTAssertEqual(back?.levelProgress, 0.5)
        XCTAssertFalse(back?.evidence.contains { $0.code == "milestoneFloorApplied" } ?? true)
    }

    func testCalibratingMuscleIsNotFloored() {
        // 校准中不因一次达标出等级：chest 未解锁 + bench-100 → 不抬、不出 floor 证据
        let milestones = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 100],
            bestE1RmKgByExercise: [:],
            unitSystem: "kg", atIso: "2026-07-07")
        let p = assembleThreeMuscles(chestLevel: 0, chestCalibrating: true, milestones: milestones)
        let chest = p.estimates.first { $0.muscleId == .chest }
        XCTAssertEqual(chest?.currentLevel, 0)
        XCTAssertEqual(chest?.decision, .insufficientData)
        XCTAssertFalse(chest?.evidence.contains { $0.code == "milestoneFloorApplied" } ?? true)
    }

    func testBalanceScoreIgnoresMilestoneFloor() {
        // balance 用未抬底曲线级：floor 把 chest 5→10 后，均衡分不得跟着变好
        //（milestone 非覆盖证据，压平方差=强行美化，契约 §6.5.5）
        let milestones = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: ["bench-press": 100],
            bestE1RmKgByExercise: [:],
            unitSystem: "kg", atIso: "2026-07-07")
        let without = assembleThreeMuscles(milestones: [])
        let with = assembleThreeMuscles(milestones: milestones)
        // 对照组有效性：floor 确实生效
        XCTAssertEqual(with.estimates.first { $0.muscleId == .chest }?.currentLevel, 10)
        XCTAssertEqual(without.estimates.first { $0.muscleId == .chest }?.currentLevel, 5)
        // 均衡分不因 floor 改变
        XCTAssertEqual(with.balanceScore, without.balanceScore)
    }

    func testEstimatedOnlyTierCandidateStillCountsAsProgressSignal() {
        // 仅 e1RM 达标 bench-100（estimated/medium）：floor 与 tier 信号同样生效——
        // V1 拍板：e1RM 置信门槛由调用方喂数前把关（批次 B 接线注意事项）
        let milestones = MuscleMilestoneCatalog.achievements(
            bestActualKgByExercise: [:],
            bestE1RmKgByExercise: ["bench-press": 105],
            unitSystem: "kg", atIso: "2026-07-07")
        XCTAssertEqual(milestones.first { $0.milestoneId == "bench-100kg" }?.achievedBy,
                       .estimatedOneRepMax)
        let p = assembleThreeMuscles(milestones: milestones)
        XCTAssertEqual(p.estimates.first { $0.muscleId == .chest }?.currentLevel, 10)
        XCTAssertEqual(p.overallTier, .intermediate)
    }

    func testLegacyFRPR7CatalogUntouched() {
        // 既有简化版行为零回归（FR-PR7 消费方仍用它）
        let legacy = StrengthMilestoneCatalog.achieved(
            bestWeightKgByExercise: ["bench-press": 102],
            eligibleExerciseIds: ["bench-press"], unitSystem: "kg")
        XCTAssertEqual(legacy.first?.achievedThreshold, 100)
        XCTAssertEqual(legacy.first?.isEstimated, false)
    }
}
