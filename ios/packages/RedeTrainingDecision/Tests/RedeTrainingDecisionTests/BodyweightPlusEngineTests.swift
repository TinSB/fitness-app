// bodyweight-plus（负重自重）引擎合同（wave-11，owner 拍板 2026-06-14）。
//
// 重量轴=外挂负重(≥0)，方向同 external（加负重=更难，不反转）；档位取挂片档；
// 减到最小一片还吃力则自动回退换同族自重孪生。这套断言锁住「方向不反转 + 触底回退」。

import XCTest
@testable import RedeTrainingDecision

final class BodyweightPlusEngineTests: XCTestCase {
    private let step = 2.5   // 挂片档 × kg（addedLoadStepKg）

    /// 注入 rank 必胜的负重引体 → 抢下 pull-a 垂直拉主槽；回退孪生 = bundled 内 pull-up（rank 最小）。
    private var amended: ExerciseCatalog {
        let wp = ExerciseCatalogEntry(
            id: "t-weighted", nameZh: "测试负重引体", nameEn: "Test weighted pull-up",
            movementPattern: "vertical-pull", primaryMuscle: "back",
            equipment: "bodyweight", kind: "compound", substitutionGroups: ["vertical-pull"],
            startWeightKg: 5, loadType: "bodyweight-plus", rank: -100
        )
        return ExerciseCatalog(catalogVersion: "test", entries: [wp] + ExerciseCatalog.minimal.entries)
    }

    private func plan(level: String, lastLoad: Double?, lastReps: Int, lastRir: Int) throws -> ExercisePrescriptionPlan {
        let session: String
        if let lastLoad {
            session = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"t-weighted","sets":[{"weight":\#(lastLoad),"reps":\#(lastReps),"rir":\#(lastRir)}]}]}"#
        } else {
            // 首练：用「推」动作推进到 pull-a（避开 vertical-pull sticky），t-weighted 自身无历史
            session = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"bench-press","sets":[{"weight":60,"reps":10,"rir":2}]}]}"#
        }
        let json = #"{"schemaVersion":8,"userProfile":{"trainingLevel":"\#(level)"},"history":[\#(session)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        let p = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)
        return try XCTUnwrap(p?.exercises.first { $0.exerciseId == "t-weighted" || $0.exerciseId == "pull-up" })
    }

    /// 冷启动同 external（不反转）：新手加得少（×0.5），高级加得多。
    func testColdStartScalesLikeExternal() throws {
        let beginner = try plan(level: "beginner", lastLoad: nil, lastReps: 0, lastRir: 0)
        XCTAssertEqual(beginner.loadType, "bodyweight-plus")
        XCTAssertEqual(beginner.change, .start)
        XCTAssertEqual(beginner.targetWeightKg, 2.5, "新手 5×0.5=2.5 外加负重（不反转）")
        let advanced = try plan(level: "advanced", lastLoad: nil, lastReps: 0, lastRir: 0)
        XCTAssertEqual(advanced.targetWeightKg, 5, "高级 5×1.0=5")
    }

    /// 变强 → 加外挂负重一档（方向同 external）。
    func testProgressAddsLoad() throws {
        let p = try plan(level: "intermediate", lastLoad: 10, lastReps: 12, lastRir: 3)
        XCTAssertEqual(p.targetWeightKg, 12.5, "顶到次数有余力 → 负重 10+2.5=12.5")
        XCTAssertEqual(p.change, .increase)
    }

    /// 挣扎/力竭 → 减外挂负重一档。
    func testStruggleReducesLoad() throws {
        let p = try plan(level: "intermediate", lastLoad: 10, lastReps: 8, lastRir: 0)
        XCTAssertEqual(p.targetWeightKg, 7.5, "力竭 → 负重 10−2.5=7.5")
        XCTAssertEqual(p.change, .ease)
        XCTAssertEqual(p.reason, .nearFailureLastTime)
    }

    /// 触底回退：外挂负重已最小一片(2.5)还吃力 → 自动换自重孪生 pull-up。数轴不跨零。
    func testDegradesToBodyweightAtFloor() throws {
        let p = try plan(level: "intermediate", lastLoad: step, lastReps: 8, lastRir: 0)
        XCTAssertEqual(p.exerciseId, "pull-up", "最小负重还吃力 → 回退换自重引体")
        XCTAssertEqual(p.targetWeightKg, 0, "回退自重后重量轴归 0")
        XCTAssertEqual(p.reason, .bodyweightPlusDegraded)
        XCTAssertEqual(p.change, .start, "无自重历史 → 自重首练定档")
    }

    /// 审查 MAJOR-2：回退提示对**已有自重历史**的正常阶梯用户也要出现（不能学 assisted 用
    /// twinLast==nil 条件——正常阶梯是 自重→负重，回退时必有自重历史，那样提示永不触发）。
    func testDegradationFiresEvenWithBodyweightHistory() throws {
        let s = #"{"id":"s0","date":"2026-06-10","completed":true,"exercises":[{"exerciseId":"t-weighted","sets":[{"weight":2.5,"reps":8,"rir":0}]},{"exerciseId":"pull-up","sets":[{"weight":0,"reps":15,"rir":2}]}]}"#
        let json = #"{"schemaVersion":8,"userProfile":{"trainingLevel":"intermediate"},"history":[\#(s)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-13")
        let p = try XCTUnwrap(
            TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)?
                .exercises.first { $0.exerciseId == "pull-up" }
        )
        XCTAssertEqual(p.reason, .bodyweightPlusDegraded, "有自重历史也要报回退（提示不能消失）")
    }

    /// 审查 MAJOR-1：组内缓降——负重自重力竭 → 减外挂负重一档（方向同 external）。
    func testNextSetReducesLoadOnFailure() {
        let plan = ExerciseSetPlan(
            exerciseId: "x", restSeconds: 120, repLowerBound: 8, repUpperBound: 10,
            stepKg: step, loadType: "bodyweight-plus",
            sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 10, targetReps: 8, targetRir: 2) }
        )
        let fail = [CompletedSetObservation(weightKg: 10, reps: 6, rir: 0, painReported: false)]
        let rec = NextSetEngine.recommend(plan: plan, completed: fail)
        XCTAssertEqual(rec?.targetWeightKg, 7.5, "负重自重力竭 → 减外挂负重 10−2.5=7.5（同 external 方向）")
    }

    /// 外挂负重计入吨位（owner 拍板）：负重自重的负重轴是真实外部负荷，自然计入（不像 assisted 排除）。
    func testAddedLoadCountsTowardTonnage() {
        let obs: [String: [CompletedSetObservation]] = [
            "weighted-pull-up": [CompletedSetObservation(weightKg: 20, reps: 8, rir: 2, painReported: false)],
        ]
        let empty = TodayPrescription(dayCode: "pull-a", exercises: [], dayReasons: [])
        let summary = SessionSummaryBuilder.build(
            prescription: empty, observations: obs, durationSeconds: 600, catalog: .minimal
        )
        XCTAssertEqual(summary.totalVolumeKg, 160, "外加负重 20×8=160 计入吨位（不像 assisted 排除）")
    }
}
