// band（弹力带）引擎合同（wave-12，owner 拍板 2026-06-14：A 案「按次数进阶」）。
//
// band 复用自重引擎（无 kg 轴、按次数进阶、weight 恒 0），唯一分叉：次数到顶提示
// 「换重一档的带子」（reason .bandCeilingReached，区别于自重的 .bodyweightCeilingReached
// 「加配重/换更难变体」）。不计入吨位（weight 恒 0）。这套断言锁住「镜像自重 + 到顶换带
// 提示 + loadType 标记 band + 可经替换换入」。

import XCTest
@testable import RedeTrainingDecision

final class BandEngineTests: XCTestCase {
    /// 注入 rank 必胜的弹力带侧平举 → 抢下 push-a 侧平举槽（与自重测试同套路）。
    private var amended: ExerciseCatalog {
        let band = ExerciseCatalogEntry(
            id: "t-band-lateral", nameZh: "测试弹力带侧平举", nameEn: "Test band lateral raise",
            movementPattern: "lateral-raise", primaryMuscle: "side-delt",
            equipment: "band", kind: "isolation", substitutionGroups: ["side-delt"],
            startWeightKg: 0, loadType: "band", rank: -100
        )
        return ExerciseCatalog(catalogVersion: "test", entries: [band] + ExerciseCatalog.minimal.entries)
    }

    private func plan(history: String) throws -> ExercisePrescriptionPlan {
        let json = #"{"schemaVersion":8,"history":[\#(history)],"programTemplate":{"splitType":"push-pull-legs","daysPerWeek":6}}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-06-14")
        let p = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)
        return try XCTUnwrap(p?.exercises.first { $0.exerciseId == "t-band-lateral" })
    }

    /// 一整轮 6 天（PPL×2）→ 今天轮回 push-a（含无约束侧平举槽）；最新一场决定 lastPerformance。
    private func roundToPushA(_ reps: Int) -> String {
        ["2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08", "2026-06-09"].enumerated().map { i, d in
            #"{"id":"s\#(i)","date":"\#(d)","completed":true,"exercises":[{"exerciseId":"t-band-lateral","sets":[{"weight":0,"reps":\#(reps),"rir":2}]}]}"#
        }.joined(separator: ",")
    }

    /// 首练：起步 12 次、重量 0、loadType 标 band、change .start（镜像自重）。
    func testColdStartRepsLikeBodyweight() throws {
        let first = try plan(history: "")
        XCTAssertEqual(first.loadType, "band")
        XCTAssertEqual(first.targetWeightKg, 0)
        XCTAssertEqual(first.targetReps, 12)
        XCTAssertEqual(first.change, .start)
        XCTAssertEqual(first.progressionStepKg, 0, "弹力带无 kg 轴 → 步长 0")
    }

    /// 有余力（上次 12 次 RIR2）→ +2 次进阶（镜像自重）。
    func testProgressAddsReps() throws {
        let up = try plan(history: roundToPushA(12))
        XCTAssertEqual(up.targetReps, 14)
        XCTAssertEqual(up.change, .increase)
        XCTAssertEqual(up.reason, .holdProgressing)
        XCTAssertEqual(up.targetWeightKg, 0)
        XCTAssertEqual(up.loadType, "band")
    }

    /// 到顶 25 次 → 提示换重带（reason .bandCeilingReached，**区别于**自重的 .bodyweightCeilingReached）。
    func testCeilingPromptsHeavierBand() throws {
        let ceiling = try plan(history: roundToPushA(25))
        XCTAssertEqual(ceiling.targetReps, 25)
        XCTAssertEqual(ceiling.reason, .bandCeilingReached, "弹力带到顶提示换带，不是自重的加配重")
        XCTAssertNotEqual(ceiling.reason, .bodyweightCeilingReached)
        XCTAssertEqual(ceiling.change, .hold)
    }

    /// 组内：band 无重量轴——下一组重量恒 0，疼痛安全信号仍如实标记。
    func testNextSetKeepsZeroWeight() {
        let plan = ExerciseSetPlan(
            exerciseId: "x", restSeconds: 60, repLowerBound: 8, repUpperBound: 25,
            stepKg: 0, loadType: "band",
            sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 0, targetReps: 15, targetRir: 2) }
        )
        let done = [CompletedSetObservation(weightKg: 0, reps: 15, rir: 0, painReported: true)]
        let rec = NextSetEngine.recommend(plan: plan, completed: done)
        XCTAssertEqual(rec?.targetWeightKg, 0, "弹力带下一组重量恒 0")
        XCTAssertEqual(rec?.reason, .painReported, "安全信号仍如实标记")
    }

    /// 不计入吨位（owner 拍板）：弹力带 weight 恒 0 → 吨位贡献自然为 0（不像 assisted 需显式排除）。
    func testBandContributesZeroTonnage() {
        let obs: [String: [CompletedSetObservation]] = [
            "t-band-lateral": [CompletedSetObservation(weightKg: 0, reps: 20, rir: 2, painReported: false)],
        ]
        let empty = TodayPrescription(dayCode: "push-a", exercises: [], dayReasons: [])
        let summary = SessionSummaryBuilder.build(
            prescription: empty, observations: obs, durationSeconds: 600, catalog: amended
        )
        XCTAssertEqual(summary.totalVolumeKg, 0, "弹力带重量 0 → 不计入吨位")
    }

    /// 开闸后弹力带条目可经替换候选被换入（真实目录）：side-delt 族 lateral-raise 候选含弹力带侧平举。
    func testBandIsSwapCandidate() {
        let cands = ExerciseReplacementEngine.candidates(for: "lateral-raise")
        XCTAssertTrue(cands.contains("band-lateral-raise"), "弹力带侧平举应在 side-delt 换动作候选内（rank 尾部）")
    }
}
