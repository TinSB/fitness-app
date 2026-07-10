// 自动均衡（批次 E 2026-07-10，owner 拍板「不要是建议直接自动改计划」「不要有那种小字也」）。
// 语义锁：priorityMuscles 空 = 逐字节零回归（既有 goldens 兜底 + 显式对照）；
// 正在补足肌群为主的动作 +1 组 + musclePriorityBoosted 依据（「查看依据」抽屉素材，
// 无常驻小字）；每场加量合计封顶 +2；deload/light verdict 与周期非平周（overreach/
// deload）一律让位不加；瞬时调制不写回自定义槽（渐进漂移红线）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class AutoBalanceTests: XCTestCase {
    private let ppl = #"{"splitType": "push-pull-legs"}"#

    /// pull 日基准输入（历史一场 push → 今日轮到 pull-a，含 curl 槽 sets 3）。
    private func makeInput(today: String = "2026-07-08") throws -> CleanTrainingDecisionInput {
        let json = TestSupport.appDataJSON(historyDates: ["2026-07-07"], program: ppl)
        return try TestSupport.makeInput(appDataJSON: json, todayISO: today)
    }

    private func trainVerdict(_ input: CleanTrainingDecisionInput) -> TodayVerdict {
        TodayVerdictEngine.evaluate(input)
    }

    func testEmptyPriorityIsByteIdenticalToLegacy() throws {
        let input = try makeInput()
        let verdict = trainVerdict(input)
        let legacy = TodayPrescriptionEngine.plan(input: input, verdict: verdict)
        let explicit = TodayPrescriptionEngine.plan(input: input, verdict: verdict, priorityMuscles: [])
        XCTAssertEqual(legacy, explicit)   // 默认参数与显式空全等（零回归）
    }

    func testPriorityMuscleGetsOneExtraSetWithReason() throws {
        let input = try makeInput()
        let verdict = trainVerdict(input)
        XCTAssertEqual(verdict.call, .train)   // 前提自检：非 train 则场景失效
        let base = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        let boosted = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input, verdict: verdict, priorityMuscles: [.biceps]))
        XCTAssertEqual(base.dayCode, boosted.dayCode)
        // 对照法：biceps 为主的动作恰好 +1 组，其余动作组数不动
        var boostedCount = 0
        for (baseItem, boostedItem) in zip(base.exercises, boosted.exercises) {
            XCTAssertEqual(baseItem.exerciseId, boostedItem.exerciseId)
            let primary = MuscleGroupMapping.primaryGroup(forExerciseId: baseItem.exerciseId)
            if boostedItem.sets != baseItem.sets {
                XCTAssertEqual(boostedItem.sets, baseItem.sets + 1)
                XCTAssertEqual(primary, .biceps)
                boostedCount += 1
            }
        }
        XCTAssertGreaterThan(boostedCount, 0)   // pull 日必有弯举槽承接
        XCTAssertTrue(boosted.exercises.contains {
            MuscleGroupMapping.primaryGroup(forExerciseId: $0.exerciseId) == .biceps
        })
        // 依据素材：受益肌群列表（抽屉内展示，无常驻小字）
        XCTAssertTrue(boosted.dayReasons.contains(.musclePriorityBoosted(muscleRaws: ["biceps"])))
        XCTAssertFalse(base.dayReasons.contains { $0.code == "musclePriorityBoosted" })
        // 加量不影响重量/渐进（只动组数）
        for (baseItem, boostedItem) in zip(base.exercises, boosted.exercises) {
            XCTAssertEqual(baseItem.targetWeightKg, boostedItem.targetWeightKg)
            XCTAssertEqual(baseItem.change, boostedItem.change)
        }
    }

    func testBoostBudgetCapsAtTwoPerSession() throws {
        // 全肌群都「补足」的极端输入 → 合计仍最多 +2（温和偏置，不是重写计划）
        let input = try makeInput()
        let verdict = trainVerdict(input)
        let base = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        let boosted = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input, verdict: verdict, priorityMuscles: Set(MuscleGroupID.allCases)))
        let baseTotal = base.exercises.reduce(0) { $0 + $1.sets }
        let boostedTotal = boosted.exercises.reduce(0) { $0 + $1.sets }
        XCTAssertEqual(boostedTotal, baseTotal + 2)
    }

    func testDeloadAndLightVerdictsSuppressBoost() throws {
        let input = try makeInput()
        for call in [TodayCall.deload, TodayCall.light] {
            let verdict = TodayVerdict(call: call, reason: .sustainedLoadDeload(days: 14), signals: [])
            let base = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
            let boosted = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input, verdict: verdict, priorityMuscles: [.biceps]))
            XCTAssertEqual(base, boosted, "verdict \(call) 应完全让位（含无 reason）")
        }
    }

    func testMesocyclePhaseGatesBoost() throws {
        // 周期化相位门控（审查 S1 重写：原版块锚断链落 calibrate 周 + 轮到腿日无 curl
        // 承接 = 双重空转假阳性）。历史 06-22/06-29/07-06（gap≤10 链不断 → 块锚 06-22）；
        // dayCodeOverride 钉死 pull-a（绕开轮转数学，保证 curl 槽承接）。
        // 07-01=第 1 周 build（setDelta 0，平周）→ 加量生效（反证测试有效性，防再空转）；
        // 07-08=第 3 周 overreach（+1）→ 不叠加；07-13=第 4 周 deload（-1）→ 不抵消。
        let json = TestSupport.appDataJSON(
            historyDates: ["2026-06-22", "2026-06-29", "2026-07-06"], program: ppl)
        func boostDelta(today: String) throws -> Int {
            let input = try TestSupport.makeInput(appDataJSON: json, todayISO: today)
            let verdict = TodayVerdict(call: .train, reason: .normalProgression, signals: [])
            let base = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input, verdict: verdict, mesocycleEnabled: true, dayCodeOverride: "pull-a"))
            let boosted = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input, verdict: verdict, mesocycleEnabled: true,
                dayCodeOverride: "pull-a", priorityMuscles: [.biceps]))
            XCTAssertEqual(base.dayCode, "pull-a")
            return zip(base.exercises, boosted.exercises).map { $1.sets - $0.sets }.reduce(0, +)
        }
        XCTAssertEqual(try boostDelta(today: "2026-07-01"), 2, "build 平周应正常加量（有效性反证）")
        XCTAssertEqual(try boostDelta(today: "2026-07-08"), 0, "overreach 周不叠加")
        XCTAssertEqual(try boostDelta(today: "2026-07-13"), 0, "deload 周不抵消")
    }
}
