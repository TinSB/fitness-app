// FR-TR10 切片2：热身在专注训练流里的 overlay 行为 + 零回归不变量。
// 核心：热身是 .activeSet 上的内存叠加——advance/skip 绝不碰 observations/events/exerciseIndex，
// 不影响 NextSetEngine 首个工作组建议（code-regression-guard：既有流行为不变）。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class WarmupFlowTests: XCTestCase {
    private func makeState() throws -> TrainFlowState {
        let input = try TestSupport.makeInput(
            appDataJSON: #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs"}}"#,
            todayISO: "2026-06-09"
        )
        let verdict = TodayVerdictEngine.evaluate(input)
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(input: input, verdict: verdict))
        return TrainFlowState(prescription: prescription)
    }

    private func obs(_ w: Double, _ r: Int, rir: Double? = 2) -> CompletedSetObservation {
        CompletedSetObservation(weightKg: w, reps: r, rir: rir, painReported: false)
    }

    func testWarmupShownAtExerciseStart() throws {
        let state = try makeState()
        XCTAssertEqual(state.currentExercise?.exerciseId, "bench-press", "首动作=杠铃复合，应有热身")
        XCTAssertFalse(state.warmupStepsForCurrentExercise.isEmpty, "杠铃复合工作重应产出热身阶梯")
        XCTAssertTrue(state.isWarmingUp)
        XCTAssertEqual(state.warmupPointer, 0)
        XCTAssertEqual(state.currentWarmupStep, state.warmupStepsForCurrentExercise.first)
        XCTAssertEqual(state.phase, .activeSet, "热身期 phase 仍是 activeSet（不新增相位）")
    }

    func testAdvanceWarmupNeverTouchesWorkingSetState() throws {
        var state = try makeState()
        let total = state.warmupStepsForCurrentExercise.count
        for _ in 0..<total { state.advanceWarmupStep() }
        XCTAssertFalse(state.isWarmingUp, "走完全部热身 → 退出热身")
        XCTAssertEqual(state.warmupPointer, total)
        // 零回归不变量：热身全程不碰这些。
        XCTAssertTrue(state.observationsByExercise.isEmpty, "热身不进 observations")
        XCTAssertTrue(state.completedInCurrentExercise.isEmpty, "热身不计工作组")
        XCTAssertTrue(state.events.isEmpty, "热身不进事件日志（draft 不受影响）")
        XCTAssertEqual(state.exerciseIndex, 0, "热身不动下标")
        XCTAssertEqual(state.phase, .activeSet)
    }

    func testSkipAllWarmupExitsImmediately() throws {
        var state = try makeState()
        state.skipAllWarmup()
        XCTAssertFalse(state.isWarmingUp)
        XCTAssertEqual(state.warmupPointer, state.warmupStepsForCurrentExercise.count)
        XCTAssertTrue(state.events.isEmpty)
        XCTAssertTrue(state.observationsByExercise.isEmpty)
    }

    func testWarmupGoneAfterFirstWorkingSetEvenIfNotTicked() throws {
        var state = try makeState()
        XCTAssertTrue(state.isWarmingUp)
        state.logSet(obs(60, 6)) // 直接打首个工作组（没走热身）
        XCTAssertFalse(state.isWarmingUp, "做过工作组后不再展示热身")
    }

    // 回归核心：热身交互不影响首个工作组的引擎建议/计划目标（与不碰热身完全一致）。
    func testWarmupInteractionDoesNotAffectFirstWorkingSet() throws {
        let plain = try makeState()
        var touched = try makeState()
        touched.advanceWarmupStep()
        touched.skipAllWarmup()
        XCTAssertEqual(touched.currentTargetWeightKg, plain.currentTargetWeightKg, "首个工作组目标重量不受热身影响")
        XCTAssertEqual(touched.currentRecommendation?.targetWeightKg, plain.currentRecommendation?.targetWeightKg)
        XCTAssertEqual(touched.completedInCurrentExercise, plain.completedInCurrentExercise)
        XCTAssertEqual(touched.events, plain.events, "两者事件日志都为空")
        XCTAssertEqual(touched.progress, plain.progress, "进度计数不受热身影响")
    }

    func testWarmupMethodsAreNoOpWhenNotWarmingUp() throws {
        var state = try makeState()
        state.logSet(obs(60, 6)) // 退出热身（已做工作组）
        let before = state.warmupPointer
        state.advanceWarmupStep()
        state.skipAllWarmup()
        XCTAssertEqual(state.warmupPointer, before, "非热身期 advance/skip 是 no-op")
    }

    func testAdvanceExerciseResetsWarmupPointer() throws {
        var state = try makeState()
        state.skipAllWarmup()
        // 打满首动作 3 组推进到下一动作。
        for _ in 0..<3 {
            state.logSet(obs(60, 6))
            if state.phase == .resting { state.restFinished() }
        }
        XCTAssertEqual(state.exerciseIndex, 1, "已推进到第二动作")
        XCTAssertEqual(state.warmupPointer, 0, "新动作热身指针归零")
    }

    // MARK: 同一部位只热一次（训练流审查 P1）

    /// 推 A（默认动作 + 练过一阵的真实重量，kg）：卧推 → 上斜哑铃卧推 → 器械推胸 → 绳索夹胸 → 侧平举 → 绳索下压。
    /// 新用户夹具里每个动作都还在起始重量，本来就不出热身，测不出部位规则。
    private func pushDay() -> TrainFlowState {
        let plan: [(String, Double)] = [
            ("bench-press", 60), ("incline-db-press", 40), ("machine-chest-press", 70),
            ("cable-fly", 30), ("lateral-raise", 12.5), ("triceps-pushdown", 40),
        ]
        return TrainFlowState(prescription: TodayPrescription(dayCode: "push-a", exercises: plan.map { id, kg in
            ExercisePrescriptionPlan(
                exerciseId: id, sets: 1, restSeconds: 90, repLowerBound: 6, repUpperBound: 10,
                targetReps: 8, targetWeightKg: kg, targetRir: 2, previousWeightKg: kg,
                previousTopReps: 8, nextProjectedWeightKg: kg, progressionStepKg: 2.5,
                change: .hold, reason: .holdProgressing
            )
        }, dayReasons: []))
    }

    /// 任意一组动作的一天（每个动作 40 kg、8–12 次）。
    private func day(_ ids: [String], kg: Double = 40, repLowerBound: Int = 8, repUpperBound: Int = 12,
                     targetReps: Int = 10, unit: LoadUnit = .kg) -> TrainFlowState {
        TrainFlowState(prescription: TodayPrescription(dayCode: "custom", exercises: ids.map { id in
            ExercisePrescriptionPlan(
                exerciseId: id, sets: 1, restSeconds: 90, repLowerBound: repLowerBound, repUpperBound: repUpperBound,
                targetReps: targetReps, targetWeightKg: kg, targetRir: 2, previousWeightKg: kg,
                previousTopReps: targetReps, nextProjectedWeightKg: kg + 2.5, progressionStepKg: 2.5,
                change: .hold, reason: .holdProgressing
            )
        }, dayReasons: []), loadUnit: unit)
    }

    // 2026-10-20 owner 真机反馈：拉日的全身热身给开合跳、徒手深蹲。卡片内容按今天动作的主练肌群走。
    func testGeneralWarmupBodyPartsFollowTodaysExercises() {
        func parts(_ state: TrainFlowState) -> [Bool] { [state.generalWarmupBodyParts.upper, state.generalWarmupBodyParts.lower] }
        XCTAssertEqual(parts(day(["lat-pulldown", "seated-row", "db-curl"])), [true, false], "拉日")
        XCTAssertEqual(parts(pushDay()), [true, false], "推日")
        XCTAssertEqual(parts(day(["squat", "leg-press", "calf-raise", "cable-crunch"])), [false, true],
                       "腿日（卷腹不算上肢）")
        XCTAssertEqual(parts(day(["squat", "bench-press", "lat-pulldown"])), [true, true], "全身日")
        XCTAssertEqual(parts(day(["cable-crunch", "not-in-catalog"])), [true, true], "只有核心 / 查不到：按全身给")
    }

    func testFirstPullExerciseGetsLightPulldownSetsBeforeWork() {
        // 同一反馈：拉日第一个动作高位下拉（目录里是绳索器械，5 lb 一格），owner 当天 75 lb × 8–12：
        // 先 40 lb ×10、55 lb ×5，再进正式组——不是只有全身热身卡。
        let lbPerKg = 2.2046226218
        let pull = day(["lat-pulldown", "seated-row"], kg: 75 / lbPerKg, unit: .lb)
        let steps = pull.warmupStepsForCurrentExercise
        XCTAssertEqual(steps.map { ($0.targetWeightKg * lbPerKg).rounded() }, [40, 55])
        XCTAssertEqual(steps.map(\.targetReps), [10, 5])
        XCTAssertTrue(steps.allSatisfy { $0.kind == .percent })
    }

    func testRampFollowsTheRepRangeNotTheDaysTarget() {
        // 审查 2026-10-20：双进阶里同一重量的目标次数在下限 / 上限之间来回（加重那次 5、保持那次 8）。
        // 深蹲 5–8 这种区间按下限算力量组：哪天都是 50/70/90% 的三级，不会隔一次换一种热身。
        let addDay = day(["squat"], kg: 100, repLowerBound: 5, repUpperBound: 8, targetReps: 5)
        let holdDay = day(["squat"], kg: 100, repLowerBound: 5, repUpperBound: 8, targetReps: 8)
        XCTAssertEqual(addDay.warmupStepsForCurrentExercise, holdDay.warmupStepsForCurrentExercise)
        XCTAssertEqual(holdDay.warmupStepsForCurrentExercise.map(\.targetWeightKg), [20, 50, 70, 90])
    }

    /// 打满前 n 个动作（每个动作 1 组，不碰热身）。
    private func pushDayAfter(_ n: Int) -> TrainFlowState {
        var state = pushDay()
        while state.exerciseIndex < n {
            state.skipAllWarmup()
            state.logSet(obs(state.currentTargetWeightKg ?? 20, 8))
            if state.phase == .resting { state.restFinished() }
        }
        return state
    }

    func testPushDayOnlyFirstChestLiftGetsFullLadder() {
        let start = pushDay()
        // 2026-10-20：增肌组（次数区间下限 ≥6）改用增肌式爬坡——空杆 + 50% ×10 + 75% ×5，不再做 90% 单次。
        XCTAssertEqual(start.warmupStepsForCurrentExercise.map(\.targetWeightKg), [20, 30, 45],
                       "当天第一个练胸的动作：完整阶梯")
        XCTAssertEqual(start.warmupStepsForCurrentExercise.map(\.targetReps), [8, 10, 5])

        let incline = pushDayAfter(1)
        XCTAssertEqual(incline.currentExercise?.exerciseId, "incline-db-press")
        XCTAssertEqual(incline.warmupStepsForCurrentExercise.map(\.targetWeightKg), [30],
                       "胸已热过的复合动作：只给最接近 70% 的 1 步过渡")
        XCTAssertTrue(incline.isWarmingUp)

        for (index, id) in [(2, "machine-chest-press"), (3, "cable-fly"), (4, "lateral-raise"), (5, "triceps-pushdown")] {
            let state = pushDayAfter(index)
            XCTAssertEqual(state.currentExercise?.exerciseId, id)
            XCTAssertTrue(state.warmupStepsForCurrentExercise.isEmpty, "\(id)：部位已练到的器械/孤立动作不热身")
            XCTAssertFalse(state.isWarmingUp, "\(id)：直接进首组")
        }
    }

    func testSkippedExerciseDoesNotCountAsWarm() {
        var state = pushDay()
        state.skipExercise(reason: .equipmentBusy)   // 卧推一组没做
        XCTAssertEqual(state.currentExercise?.exerciseId, "incline-db-press")
        XCTAssertEqual(state.warmupStepsForCurrentExercise.map(\.targetWeightKg), [20, 30],
                       "没练过胸 → 上斜卧推仍是完整阶梯（哑铃从最轻一格起算，不再被目录起始重量托着）")
    }

    func testSecondaryOnlyCompoundStillGetsFullLadder() {
        let catalog = ExerciseCatalog.minimal
        XCTAssertEqual(WarmupScope.decide(exerciseId: "shoulder-press", kind: "compound",
                                          workedExerciseIds: ["bench-press"], catalog: catalog), .full,
                       "肩只当过卧推的辅练：肩推仍完整热身")
        XCTAssertEqual(WarmupScope.decide(exerciseId: "incline-hammer-press", kind: "compound",
                                          workedExerciseIds: ["bench-press"], catalog: catalog), .alreadyWarm)
        XCTAssertEqual(WarmupScope.decide(exerciseId: "lateral-raise", kind: "isolation",
                                          workedExerciseIds: ["bench-press"], catalog: catalog), .alreadyWarm,
                       "孤立动作：主练肌群当过辅练也算练到")
        XCTAssertEqual(WarmupScope.decide(exerciseId: "romanian-deadlift", kind: "compound",
                                          workedExerciseIds: ["squat"], catalog: catalog), .full, "换部位重新完整热身")
        XCTAssertEqual(WarmupScope.decide(exerciseId: "wrist-curl", kind: "isolation",
                                          workedExerciseIds: ["bench-press"], catalog: catalog), .full, "前臂无契约肌群 → 原行为")
        XCTAssertEqual(WarmupScope.decide(exerciseId: "not-in-catalog", kind: "compound",
                                          workedExerciseIds: ["bench-press"], catalog: catalog), .full)
    }

    func testWarmScopeSurvivesDraftReplay() throws {
        let live = pushDayAfter(1)
        let restored = try XCTUnwrap(TrainFlowState.restore(prescription: live.prescription, events: live.events))
        XCTAssertEqual(restored.warmupStepsForCurrentExercise, live.warmupStepsForCurrentExercise,
                       "已练部位只取已记组的事实，恢复后同一结论")
        XCTAssertEqual(restored.isWarmingUp, live.isWarmingUp)
    }

    // 热身不进 events → 含热身交互的会话仍可正常 draft 恢复（replay 不受影响）。
    func testWarmupDoesNotBreakDraftReplay() throws {
        let prescription = try makeState().prescription
        var live = TrainFlowState(prescription: prescription)
        live.advanceWarmupStep()   // 热身交互（无 event）
        live.logSet(obs(60, 6))    // 首个工作组（有 event）
        let restored = try XCTUnwrap(
            TrainFlowState.restore(prescription: prescription, events: live.events),
            "热身不进 events，replay 应成功恢复"
        )
        XCTAssertEqual(restored.completedInCurrentExercise, live.completedInCurrentExercise)
        XCTAssertEqual(restored.events, live.events)
    }
}
