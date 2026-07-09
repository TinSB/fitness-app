// FR-PL6.1 改动影响（切片 S7）：肌群每周频率 delta + 跌破 2× 护栏 + 跨族回传。
// 频率 = 训练日数（同日同肌群只计一次）；基于 catalog primaryMuscle 近似。

import XCTest
@testable import RedeTrainingDecision

final class PlanCustomizationImpactTests: XCTestCase {
    func testFrequencyCountsDistinctDaysPerMuscle() throws {
        // 第 0 日同时放两个胸动作（bench-press + db-bench-press）→ 同日去重，chest 只计 1 天；
        // 第 1 日练背（lat-pulldown=back）→ back 1×。验「同日多动作命中同肌群只计一次」。
        let week = [
            ["bench-press", "db-bench-press"],   // chest（同日两动作 → 计 1）
            ["lat-pulldown"],                    // back
        ]
        let r = PlanCustomizationImpact.compute(weekBefore: week, weekAfter: week)
        XCTAssertEqual(r.frequencyBefore["chest"], 1, "同日多胸动作只计一个训练日")
        XCTAssertEqual(r.frequencyBefore["back"], 1)
        XCTAssertEqual(r.droppedBelowTwice, [], "before==after 无跌破")
    }

    func testDroppedBelowTwiceDetected() throws {
        // before：胸 2 天（2×/周）；after：删掉一个胸日 → 胸 1×/周 → 跌破。
        let before = [["bench-press"], ["incline-barbell-press"], ["lat-pulldown"]]
        let after = [["bench-press"], ["lat-pulldown"], ["lat-pulldown"]]
        let r = PlanCustomizationImpact.compute(weekBefore: before, weekAfter: after)
        XCTAssertEqual(r.frequencyBefore["chest"], 2)
        XCTAssertEqual(r.frequencyAfter["chest"], 1)
        XCTAssertEqual(r.droppedBelowTwice, ["chest"], "胸从 2× 跌到 1× → 护栏命中")
    }

    func testMuscleRemovedEntirelyCountsAsDropped() throws {
        let before = [["bench-press"], ["incline-barbell-press"]]   // chest 2×
        let after = [["lat-pulldown"], ["seated-row"]]              // chest 0×
        let r = PlanCustomizationImpact.compute(weekBefore: before, weekAfter: after)
        XCTAssertEqual(r.frequencyAfter["chest"] ?? 0, 0)
        XCTAssertEqual(r.droppedBelowTwice, ["chest"], "整组移除（2×→0）也算跌破")
    }

    func testNoDropWhenStaysAtLeastTwice() throws {
        let before = [["bench-press"], ["incline-barbell-press"], ["db-bench-press"]] // chest 3×
        let after = [["bench-press"], ["incline-barbell-press"]]                      // chest 2×
        let r = PlanCustomizationImpact.compute(weekBefore: before, weekAfter: after)
        XCTAssertEqual(r.frequencyAfter["chest"], 2)
        XCTAssertEqual(r.droppedBelowTwice, [], "3×→2× 仍达标，不报")
    }

    func testUnknownExerciseIgnored() throws {
        let week = [["no-such-exercise", "bench-press"]]
        let r = PlanCustomizationImpact.compute(weekBefore: week, weekAfter: week)
        XCTAssertEqual(r.frequencyBefore["chest"], 1, "未知 id 跳过、不崩")
        XCTAssertEqual(r.frequencyBefore.count, 1)
    }

    func testEmptyInputYieldsEmptySummary() throws {
        let r = PlanCustomizationImpact.compute(weekBefore: [], weekAfter: [])
        XCTAssertTrue(r.frequencyBefore.isEmpty)
        XCTAssertTrue(r.frequencyAfter.isEmpty)
        XCTAssertEqual(r.droppedBelowTwice, [])
        XCTAssertEqual(r.crossFamilyChanges, [])
    }

    func testCrossFamilyPassthroughAndSortedDrops() throws {
        let before = [["bench-press"], ["incline-barbell-press"], ["overhead-press"], ["lat-pulldown"], ["seated-row"]]
        let after = [["lat-pulldown"], ["seated-row"], ["lat-pulldown"], ["seated-row"], ["lat-pulldown"]]
        let r = PlanCustomizationImpact.compute(weekBefore: before, weekAfter: after, crossFamilyExerciseIds: ["seated-row"])
        XCTAssertEqual(r.crossFamilyChanges, ["seated-row"], "跨族标记原样回传")
        // chest(2→0) 与 shoulder(1→0，不算跌破因 before<2) → 只有 chest 跌破；多肌群时升序
        XCTAssertTrue(r.droppedBelowTwice.contains("chest"))
        XCTAssertEqual(r.droppedBelowTwice, r.droppedBelowTwice.sorted(), "跌破列表升序")
    }

    func testFineMuscleValuesMergeIntoBigGroupFrequency() {
        // 归并回归锁（2026-07-09 目录细化后）：一天下拉（lats）+ 一天划船（upper-back）
        // 必须合计成「背部 2×/周」——若误删归并，两个细分各 1× 会漏报跌破护栏
        let r = PlanCustomizationImpact.compute(
            weekBefore: [["lat-pulldown"], ["seated-row"]],
            weekAfter: [["lat-pulldown"], []])
        XCTAssertEqual(r.frequencyBefore["back"], 2)
        XCTAssertNil(r.frequencyBefore["lats"])          // 细分值不作为频率键外漏
        XCTAssertEqual(r.frequencyAfter["back"], 1)
        XCTAssertEqual(r.droppedBelowTwice, ["back"])    // 2→1 跌破护栏正确报
    }
}
