// 批次 D D1（2026-07-09）：相对体重力量标准。
// 语义锁：全表锚（5 动作 × 男女 × 5 档数值，手滑改任何倍数即红）；floor/tier 映射
// （2/6/10/16/19；intermediate/advanced/elite 才有 tier 信号）；owner 三场景
// （交接件 §3.5）；双轨（actual=high、仅 e1RM=medium 不冒充）；性别/体重缺失
// 如实退化返回空（回归锁：绝对锚行为不受影响由 D3 接线测试覆盖）。

import XCTest
@testable import RedeLocalSnapshot

final class RelativeStrengthStandardsTests: XCTestCase {
    func testFullTableAnchors() {
        // 全表锚：交接件 §3.1 数值一字不差（E1 专家判断锚，调整须过 owner）
        let expected: [(String, [Double], [Double], [MuscleGroupID])] = [
            ("bench-press", [0.50, 0.75, 1.00, 1.50, 2.00], [0.25, 0.40, 0.60, 0.90, 1.20],
             [.chest, .triceps, .shoulders]),
            ("squat", [0.75, 1.00, 1.50, 2.00, 2.50], [0.50, 0.75, 1.10, 1.50, 2.00],
             [.quads, .glutes, .hamstrings, .core]),
            ("deadlift", [1.00, 1.25, 1.75, 2.25, 2.75], [0.60, 0.90, 1.25, 1.75, 2.25],
             [.hamstrings, .glutes, .back, .core]),
            ("overhead-press", [0.35, 0.50, 0.70, 0.95, 1.20], [0.20, 0.30, 0.45, 0.65, 0.85],
             [.shoulders, .triceps, .core]),
            ("barbell-row", [0.50, 0.65, 0.90, 1.20, 1.50], [0.30, 0.45, 0.65, 0.90, 1.15],
             [.back, .biceps]),
        ]
        XCTAssertEqual(RelativeStrengthStandards.v1.count, expected.count)
        for (standard, anchor) in zip(RelativeStrengthStandards.v1, expected) {
            XCTAssertEqual(standard.exerciseId, anchor.0)
            XCTAssertEqual(standard.maleRatios, anchor.1, anchor.0)
            XCTAssertEqual(standard.femaleRatios, anchor.2, anchor.0)
            XCTAssertEqual(standard.linkedMuscles, anchor.3, anchor.0)
            XCTAssertEqual(standard.maleRatios.count, 5)
            XCTAssertEqual(standard.femaleRatios.count, 5)
        }
        XCTAssertEqual(RelativeStrengthStandards.standardsVersion, "rel-standards-v1")
    }

    func testGradeFloorAndTierMapping() {
        let grades = RelativeStrengthStandards.Grade.allCases
        XCTAssertEqual(grades.map(\.rawValue),
                       ["beginner", "novice", "intermediate", "advanced", "elite"])
        XCTAssertEqual(grades.map(\.levelFloor), [2, 6, 10, 16, 19])
        XCTAssertEqual(grades.map(\.tierCandidate),
                       [nil, nil, .intermediate, .advanced, .elite])
    }

    func testOwnerScenarioMaleBenchSplit() {
        // 交接件 §3.5.1：男 75kg 实测卧推 100（1.33×）→ beginner/novice/intermediate
        // 三档命中（floor max=10，与绝对锚 bench-100 同格）；推 20kg（0.27×）→ 无档
        let strong = RelativeStrengthStandards.achievements(
            sex: "male", bodyweightKg: 75,
            bestActualKgByExercise: ["bench-press": 100], bestE1RmKgByExercise: [:],
            atIso: "2026-07-09")
        let bench = strong.filter { $0.exerciseId == "bench-press" }
        XCTAssertEqual(bench.map(\.milestoneId),
                       ["rel-bench-press-beginner", "rel-bench-press-novice",
                        "rel-bench-press-intermediate"])
        XCTAssertTrue(bench.allSatisfy { $0.achievedBy == .actualCompletedSet && $0.confidence == .high })
        XCTAssertEqual(bench.compactMap(\.levelFloor).max(), 10)
        XCTAssertEqual(bench.last?.tierFloor, .intermediate)

        let weak = RelativeStrengthStandards.achievements(
            sex: "male", bodyweightKg: 75,
            bestActualKgByExercise: ["bench-press": 20], bestE1RmKgByExercise: [:],
            atIso: "2026-07-09")
        XCTAssertTrue(weak.isEmpty)
    }

    func testFemaleFairnessScenario() {
        // 交接件 §3.5.2（缺口③实证）：女 60kg 实测卧推 36（0.6×）→ intermediate
        // floor 10——绝对锚（60kg 起步）给不了的档位
        let out = RelativeStrengthStandards.achievements(
            sex: "female", bodyweightKg: 60,
            bestActualKgByExercise: ["bench-press": 36], bestE1RmKgByExercise: [:],
            atIso: "2026-07-09")
        let top = out.filter { $0.exerciseId == "bench-press" }.last
        XCTAssertEqual(top?.milestoneId, "rel-bench-press-intermediate")
        XCTAssertEqual(top?.levelFloor, 10)
        XCTAssertEqual(top?.tierFloor, .intermediate)
        // thresholdKg 是换算后的绝对值（0.6×60=36kg），显示层可用
        XCTAssertEqual(top?.thresholdKg ?? 0, 36, accuracy: 0.001)
    }

    func testRowGivesBackBicepsLowBarPath() {
        // 交接件 §3.5.3（缺口②实证）：男 80kg 划船 52（0.65×）→ novice floor 6，
        // back/biceps 低门槛路径（对比绝对锚 weighted-pullup floor 11 / deadlift floor 14）
        let out = RelativeStrengthStandards.achievements(
            sex: "male", bodyweightKg: 80,
            bestActualKgByExercise: ["barbell-row": 52], bestE1RmKgByExercise: [:],
            atIso: "2026-07-09")
        let top = out.last
        XCTAssertEqual(top?.milestoneId, "rel-barbell-row-novice")
        XCTAssertEqual(top?.levelFloor, 6)
        XCTAssertEqual(top?.linkedMuscleIds, [.back, .biceps])
        XCTAssertNil(top?.tierFloor)
    }

    func testEstimatedTrackDoesNotImpersonateActual() {
        // 双轨：actual 75（1.0× intermediate 档）+ e1RM 115（1.53× advanced 档）→
        // intermediate 及以下 actual/high，advanced 档 estimated/medium
        let out = RelativeStrengthStandards.achievements(
            sex: "male", bodyweightKg: 75,
            bestActualKgByExercise: ["bench-press": 75],
            bestE1RmKgByExercise: ["bench-press": 115],
            atIso: "2026-07-09")
        let byId = Dictionary(uniqueKeysWithValues: out.map { ($0.milestoneId, $0) })
        XCTAssertEqual(byId["rel-bench-press-intermediate"]?.achievedBy, .actualCompletedSet)
        XCTAssertEqual(byId["rel-bench-press-intermediate"]?.confidence, .high)
        XCTAssertEqual(byId["rel-bench-press-advanced"]?.achievedBy, .estimatedOneRepMax)
        XCTAssertEqual(byId["rel-bench-press-advanced"]?.confidence, .medium)
        XCTAssertNil(byId["rel-bench-press-elite"])
    }

    func testDegradesHonestlyWithoutSexOrWeight() {
        // 性别 nil / 未知值 / 体重 nil / 0 / 越界（审查 S1：HealthKit 脏数据——秤错单位
        // 5kg、错录 500kg）→ 全部返回空（如实退化；防经 peaks 只升不降永久污染记忆）
        let inputs: [(String?, Double?)] = [(nil, 75), ("other", 75), ("male", nil), ("male", 0),
                                            ("male", 5), ("male", 500)]
        for (sex, weight) in inputs {
            let out = RelativeStrengthStandards.achievements(
                sex: sex, bodyweightKg: weight,
                bestActualKgByExercise: ["bench-press": 100], bestE1RmKgByExercise: [:],
                atIso: "2026-07-09")
            XCTAssertTrue(out.isEmpty, "sex=\(sex ?? "nil") weight=\(String(describing: weight))")
        }
    }
}
