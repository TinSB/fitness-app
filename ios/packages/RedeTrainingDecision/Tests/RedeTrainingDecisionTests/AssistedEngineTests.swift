// assisted（反向器械）引擎合同（wave-9，owner 拍板 2026-06-13）。
//
// 安全方向反转：辅助配重越多=越轻松。故进阶=减辅助、安全缓降=加辅助、
// 冷启动新手=更多辅助、辅助降到最小一片还有余力=毕业自动换自重版。
// 这套断言就是「不许把 external 减重瀑布套到 assisted 上」的看守。

import XCTest
@testable import RedeTrainingDecision

final class AssistedEngineTests: XCTestCase {
    private let step = 5.0   // selectorized × kg（LoadGrid）

    /// 注入 rank 必胜的辅助引体 → 抢下 pull-a 垂直拉主槽；毕业孪生 = bundled 内 pull-up。
    private var amended: ExerciseCatalog {
        let assisted = ExerciseCatalogEntry(
            id: "t-assisted", nameZh: "测试辅助引体", nameEn: "Test assisted pull-up",
            movementPattern: "vertical-pull", primaryMuscle: "back",
            equipment: "selectorized", kind: "compound", substitutionGroups: ["vertical-pull"],
            startWeightKg: 30, loadType: "assisted", rank: -100
        )
        return ExerciseCatalog(catalogVersion: "test", entries: [assisted] + ExerciseCatalog.minimal.entries)
    }

    /// 1 场历史 → 今天轮回 pull-a（push-pull-legs：count%3==1）；含 t-assisted 即有 last。
    private func plan(level: String, lastAssist: Double?, lastReps: Int, lastRir: Int) throws -> ExercisePrescriptionPlan {
        let session: String
        if let lastAssist {
            session = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"t-assisted","sets":[{"weight":\#(lastAssist),"reps":\#(lastReps),"rir":\#(lastRir)}]}]}"#
        } else {
            // 首练：用「推」动作把日推进到 pull-a，t-assisted 自身无历史。
            // 注意（wave-9 sticky）：必须避开 vertical-pull——否则 sticky 会粘住那个
            // 垂直拉动作、t-assisted 上不了场。bench-press 是 horizontal-press，pull-a 无此槽。
            session = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"bench-press","sets":[{"weight":60,"reps":10,"rir":2}]}]}"#
        }
        let json = #"{"schemaVersion":8,"userProfile":{"trainingLevel":"\#(level)"},"history":[\#(session)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        let p = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)
        // 毕业会把动作换成 pull-up——两个 id 都接受
        return try XCTUnwrap(p?.exercises.first { $0.exerciseId == "t-assisted" || $0.exerciseId == "pull-up" })
    }

    /// 冷启动反转：新手要更多辅助（×1.5），高级更少（×0.5）。external 镜像。
    func testColdStartGivesMoreAssistToBeginners() throws {
        let beginner = try plan(level: "beginner", lastAssist: nil, lastReps: 0, lastRir: 0)
        XCTAssertEqual(beginner.loadType, "assisted")
        XCTAssertEqual(beginner.change, .start)
        XCTAssertEqual(beginner.targetWeightKg, 45, "新手 30×1.5=45kg 辅助（external 套法会给 15=更少=危险）")

        let advanced = try plan(level: "advanced", lastAssist: nil, lastReps: 0, lastRir: 0)
        XCTAssertEqual(advanced.targetWeightKg, 15, "高级 30×0.5=15kg 辅助")
    }

    /// 变强 → 减辅助（少帮一档）。external 套法会加重量=加辅助=方向反。
    func testProgressReducesAssist() throws {
        let p = try plan(level: "intermediate", lastAssist: 30, lastReps: 12, lastRir: 3)
        XCTAssertEqual(p.targetWeightKg, 25, "顶到 reps 且有余力 → 辅助 30−5=25（变强=少帮）")
        XCTAssertEqual(p.change, .increase, "语义：进阶")
    }

    /// 力竭/挣扎 → 加辅助（多帮=更轻=安全方向）。这是反转的安全红线。
    func testNearFailureAddsAssist() throws {
        let p = try plan(level: "intermediate", lastAssist: 30, lastReps: 8, lastRir: 0)
        XCTAssertEqual(p.targetWeightKg, 35, "力竭 → 辅助 30+5=35（多帮=更轻=安全）")
        XCTAssertEqual(p.change, .ease)
        XCTAssertEqual(p.reason, .nearFailureLastTime)
    }

    /// 毕业：辅助已在最小一片（5kg）还有余力 → 自动换自重引体。数轴不跨零。
    func testGraduatesToBodyweightAtFloor() throws {
        let p = try plan(level: "intermediate", lastAssist: step, lastReps: 12, lastRir: 3)
        XCTAssertEqual(p.exerciseId, "pull-up", "辅助到底还有余力 → 自动换自重引体")
        XCTAssertEqual(p.targetWeightKg, 0, "换成自重后重量轴归 0")
        XCTAssertEqual(p.reason, .assistedGraduated)
    }

    /// 毕业「只报一次」（审查 MINOR）：已练过自重版再毕业 → 走正常次数进阶，
    /// 不再每次标 .assistedGraduated（避免 reason=毕业/change=进阶 矛盾）。
    func testGraduationWithExistingBodyweightHistoryUsesNormalProgression() throws {
        let session = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"t-assisted","sets":[{"weight":5,"reps":12,"rir":3}]},{"exerciseId":"pull-up","sets":[{"weight":0,"reps":14,"rir":2}]}]}"#
        let json = #"{"schemaVersion":8,"userProfile":{"trainingLevel":"intermediate"},"history":[\#(session)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        let p = try XCTUnwrap(
            TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)?
                .exercises.first { $0.exerciseId == "pull-up" }
        )
        XCTAssertNotEqual(p.reason, .assistedGraduated, "已练过自重版 → 不再每次报毕业")
        XCTAssertEqual(p.targetReps, 16, "自重进阶：上次 14 次有余力 → +2=16")
        XCTAssertEqual(p.change, .increase, "change 与 reason 不矛盾")
    }

    /// 训练中安全缓降反转（红线）：辅助器械喊疼/力竭 → 加辅助（更轻），绝不减辅助。
    func testNextSetAddsAssistOnPainAndFailure() {
        func plan(loadType: String) -> ExerciseSetPlan {
            ExerciseSetPlan(
                exerciseId: "x", restSeconds: 120, repLowerBound: 8, repUpperBound: 10,
                stepKg: step, loadType: loadType,
                sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 30, targetReps: 8, targetRir: 2) }
            )
        }
        // 喊疼 → 辅助 30+5=35（更轻=安全）
        let pain = [CompletedSetObservation(weightKg: 30, reps: 8, rir: 1, painReported: true)]
        let painRec = NextSetEngine.recommend(plan: plan(loadType: "assisted"), completed: pain)
        XCTAssertEqual(painRec?.targetWeightKg, 35, "辅助喊疼 → 加辅助，不是减重")
        XCTAssertEqual(painRec?.reason, .painReported)
        // 力竭 → 同样加辅助
        let fail = [CompletedSetObservation(weightKg: 30, reps: 6, rir: 0, painReported: false)]
        let failRec = NextSetEngine.recommend(plan: plan(loadType: "assisted"), completed: fail)
        XCTAssertEqual(failRec?.targetWeightKg, 35, "辅助力竭 → 加辅助")
        // 对照：external 同样信号是减重 30−5=25（方向必须相反）
        let extRec = NextSetEngine.recommend(plan: plan(loadType: "external"), completed: pain)
        XCTAssertEqual(extRec?.targetWeightKg, 25, "external 喊疼 → 减重（与 assisted 反向）")
    }

    /// 换动作重算（wave-9，owner 拍板）：换到辅助动作时，原动作负重当辅助量无意义，
    /// 必须重置为目录默认辅助量——否则把高位下拉 50kg 当成「辅助 50kg」显示。
    func testSwapToAssistedResetsToDefaultAssist() {
        let latPulldown = ExercisePrescriptionPlan(
            exerciseId: "lat-pulldown", sets: 3, restSeconds: 120,
            repLowerBound: 8, repUpperBound: 10, targetReps: 8, targetWeightKg: 50, targetRir: 2,
            previousWeightKg: nil, previousTopReps: nil, nextProjectedWeightKg: 55,
            progressionStepKg: 5, change: .start, reason: .firstExposure, loadType: "external"
        )
        let prescription = TodayPrescription(dayCode: "pull-a", exercises: [latPulldown], dayReasons: [])
        var state = TrainFlowState(prescription: prescription)
        XCTAssertEqual(state.currentExercise?.sets.first?.targetWeightKg, 50)
        XCTAssertTrue(state.replacementCandidates.contains("assisted-pull-up"))

        state.replaceCurrentExercise(with: "assisted-pull-up")
        XCTAssertEqual(state.currentExercise?.exerciseId, "assisted-pull-up")
        XCTAssertEqual(state.currentExercise?.loadType, "assisted")
        XCTAssertEqual(state.currentExercise?.sets.first?.targetWeightKg, 30,
                       "换到辅助动作重置为目录默认辅助量 30，不沿用 lat-pulldown 的 50")
    }

    /// 吨位/顶组排除（wave-9 安全口径）：辅助器械的辅助量不进吨位、不当顶组；组数仍计。
    func testAssistedExcludedFromTonnageAndTopSet() {
        let obs: [String: [CompletedSetObservation]] = [
            "assisted-pull-up": [CompletedSetObservation(weightKg: 30, reps: 8, rir: 2, painReported: false)],
            "lateral-raise": [CompletedSetObservation(weightKg: 10, reps: 12, rir: 2, painReported: false)],
        ]
        let empty = TodayPrescription(dayCode: "pull-a", exercises: [], dayReasons: [])
        let summary = SessionSummaryBuilder.build(
            prescription: empty, observations: obs, durationSeconds: 600, catalog: .minimal
        )
        XCTAssertEqual(summary.totalVolumeKg, 240, "吨位仅 lateral-raise 10×12×2(双哑铃)=240；辅助引体 30×8 不计")
        XCTAssertEqual(summary.topSet?.exerciseId, "lateral-raise", "辅助器械不当顶组（辅助 30>10 但被排除，否则假装最重）")
        XCTAssertEqual(summary.completedSetCount, 2, "辅助组仍如实计入组数")
    }

    /// 对照：换到常规 external 动作仍沿用原负重（零回归——只有 assisted 重置）。
    func testSwapToExternalKeepsCarriedWeight() {
        let benchPress = ExercisePrescriptionPlan(
            exerciseId: "bench-press", sets: 3, restSeconds: 150,
            repLowerBound: 6, repUpperBound: 10, targetReps: 8, targetWeightKg: 60, targetRir: 2,
            previousWeightKg: nil, previousTopReps: nil, nextProjectedWeightKg: 62.5,
            progressionStepKg: 2.5, change: .start, reason: .firstExposure, loadType: "external"
        )
        let prescription = TodayPrescription(dayCode: "push-a", exercises: [benchPress], dayReasons: [])
        var state = TrainFlowState(prescription: prescription)
        state.replaceCurrentExercise(with: "incline-barbell-press")
        XCTAssertEqual(state.currentExercise?.sets.first?.targetWeightKg, 60,
                       "external→external 换动作沿用原负重不变（assisted 修复零回归面）")
    }
}
