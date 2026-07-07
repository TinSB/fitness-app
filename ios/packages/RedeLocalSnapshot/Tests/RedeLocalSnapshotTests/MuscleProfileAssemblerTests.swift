// MLE-3（2026-07-07）：trend / peakLevel / balanceScore / TrainingTier / breakthroughs 组装。
// 语义锁：trend 平滑（近 3 周 vs 前 3 周有效量 ±15% 阈值，单次波动不改向）；peakLevel
// 单调不降（previousPeaks 由调用方供、引擎保 max）；balanceScore <3 解锁肌群 nil 如实；
// tier 按 §6.5.4 拍板表（区间进 Config）+ balance 低于阈值下调一档 + calibrating 兜底；
// breakthrough 检测 muscleLevel/trainingTier 两种（milestone 种 MLE-4 接）。

import XCTest
@testable import RedeLocalSnapshot

final class MuscleProfileAssemblerTests: XCTestCase {
    private let config = MuscleLevelModelConfig.v1

    private func computation(
        _ muscle: MuscleGroupID, level: Int, calibrating: Bool = false,
        confidence: EstimateConfidence = .medium,
        evidence: [MuscleLevelEvidence] = []
    ) -> MuscleLevelComputation {
        MuscleLevelComputation(
            muscleId: muscle, isCalibrating: calibrating, level: level,
            progress: 0.5, confidence: confidence,
            breakdown: MuscleLevelScoreBreakdown(
                exposureScore: 30, performanceScore: 15, milestoneScore: 0, progressionScore: 0,
                coverageScore: 5, consistencyScore: 3, recoveryPenalty: 0, goalAdjustment: 0),
            evidence: evidence, limitations: [])
    }

    private func weekly(_ setsByWeek: [Double]) -> [String: Double] {
        let mondays = ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29", "2026-07-06"]
        var out: [String: Double] = [:]
        for (i, sets) in setsByWeek.enumerated() where i < mondays.count { out[mondays[i]] = sets }
        return out
    }

    private func observations(_ muscle: MuscleGroupID, setsByWeek: [Double]) -> MuscleObservations {
        MuscleObservations(muscleId: muscle, weeklyFractionalSets: weekly(setsByWeek),
                           sessionsTouched: 6, movementFamiliesTouched: 2, e1rmPoints: [])
    }

    // MARK: trend（近 3 周 vs 前 3 周，±15% 平滑）

    func testTrendFiveStates() {
        // rising：前 3 周均 6 → 近 3 周均 9（+50%）
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: weekly([6, 6, 6, 9, 9, 9]), isCalibrating: false, nowISO: "2026-07-08", config: config), .rising)
        // declining：10 → 8（-20%）
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: weekly([10, 10, 10, 8, 8, 8]), isCalibrating: false, nowISO: "2026-07-08", config: config), .declining)
        // stable：10 → 11（+10% 在阈值内——单向小波动不改向）
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: weekly([10, 10, 10, 11, 11, 11]), isCalibrating: false, nowISO: "2026-07-08", config: config), .stable)
        // detraining：前有量、近 3 周全零
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: weekly([8, 8, 8, 0, 0, 0]), isCalibrating: false, nowISO: "2026-07-08", config: config), .detraining)
        // calibrating 透传
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: weekly([2]), isCalibrating: true, nowISO: "2026-07-08", config: config), .calibrating)
    }

    func testDetrainingWithMissingKeysRealAggregatorShape() {
        // 真实聚合器缺周不产 key（审查 M1 反例）：只有前 3 周有记录、近 3 周无 key → detraining
        let onlyEarly: [String: Double] = ["2026-06-01": 8, "2026-06-08": 8, "2026-06-15": 8]
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: onlyEarly, isCalibrating: false, nowISO: "2026-07-08", config: config), .detraining)
    }

    func testTrendWindowsAreCalendarAnchoredNotRecordAnchored() {
        // 审查 M1 漂移反例：8 周里第 4-5 周缺失——日历锚定下 prior 窗含缺周按 0，
        // 不再拿 5-8 周前的旧片段冒充「前 3 周」
        let gapped: [String: Double] = [
            "2026-05-18": 18, "2026-05-25": 18, "2026-06-01": 18,   // 5-8 周前（不在任何窗）
            "2026-06-22": 10, "2026-06-29": 10, "2026-07-06": 10,   // 近 3 周
        ]  // prior 窗 = 06-01/06-08/06-15 → 18+0+0=6 均值；recent=10 → +67% rising
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: gapped, isCalibrating: false, nowISO: "2026-07-08", config: config), .rising)
    }

    func testNewUserInsufficientWeeksIsStable() {
        // 前窗全零（历史不足 6 周）→ 保守 stable（数据不足≠没变化，收口写回语义）
        let young: [String: Double] = ["2026-06-29": 6, "2026-07-06": 9]
        XCTAssertEqual(MuscleProfileAssembler.trend(
            weeklySets: young, isCalibrating: false, nowISO: "2026-07-08", config: config), .stable)
    }

    // MARK: peakLevel 单调

    func testPeakLevelNeverDrops() {
        XCTAssertEqual(MuscleProfileAssembler.peakLevel(current: 7, previousPeak: 9), 9)
        XCTAssertEqual(MuscleProfileAssembler.peakLevel(current: 10, previousPeak: 9), 10)
        XCTAssertEqual(MuscleProfileAssembler.peakLevel(current: 4, previousPeak: nil), 4)
    }

    // MARK: balanceScore

    func testBalanceScoreSemantics() {
        // 全同级 → 100
        XCTAssertEqual(MuscleProfileAssembler.balanceScore(unlockedLevels: [8, 8, 8, 8], config: config) ?? -1,
                       100, accuracy: 0.001)
        // 离散（4 与 12）→ 显著低于 100
        let spread = MuscleProfileAssembler.balanceScore(unlockedLevels: [4, 12, 4, 12], config: config) ?? -1
        XCTAssertLessThan(spread, 60)
        XCTAssertGreaterThanOrEqual(spread, 0)
        // <3 解锁 → nil 如实
        XCTAssertNil(MuscleProfileAssembler.balanceScore(unlockedLevels: [8, 9], config: config))
    }

    // MARK: TrainingTier（§6.5.4 表 + 下调 + 兜底）

    private func profile(levels: [Int], confidence: EstimateConfidence = .medium,
                         withProgressEvidence: Bool = true, balance: Double? = 80) -> TrainingTier {
        MuscleProfileAssembler.overallTier(
            unlockedLevels: levels, anyStrengthProgressSignal: withProgressEvidence,
            dominantConfidence: confidence, balanceScore: balance, config: config)
    }

    func testTierLadderByMedianLevel() {
        XCTAssertEqual(profile(levels: [2, 3, 3, 4]), .beginner)          // 中位 3
        XCTAssertEqual(profile(levels: [6, 6, 7, 7]), .novicePlus)        // 中位 6.5
        XCTAssertEqual(profile(levels: [9, 10, 10, 11]), .intermediate)   // 中位 10 + 进步信号
        XCTAssertEqual(profile(levels: [13, 14, 14, 15]), .advanced)      // 中位 14
        XCTAssertEqual(profile(levels: [17, 18, 18, 19]), .elite)         // 中位 18
    }

    func testTierCalibratingFallbacks() {
        // <3 解锁肌群 → calibrating（数据不足）
        XCTAssertEqual(profile(levels: [10, 11]), .calibrating)
        // 全 low confidence → calibrating（契约：confidence low 属 calibrating 典型条件）
        XCTAssertEqual(profile(levels: [9, 10, 10, 11], confidence: .low), .calibrating)
    }

    func testIntermediateRequiresStrengthProgressSignal() {
        // 中位 10 但无任何力量进步信号（无 milestone、无 e1RM 进步）→ 卡 novicePlus
        XCTAssertEqual(profile(levels: [9, 10, 10, 11], withProgressEvidence: false), .novicePlus)
    }

    func testLowBalanceDowngradesTierOneStep() {
        // 中位 10 + 进步信号 = intermediate，但 balance 30 < 下调阈值 → novicePlus
        XCTAssertEqual(profile(levels: [9, 10, 10, 11], balance: 30), .novicePlus)
        // balance nil（<3 解锁不会到这步，防御）不触发下调
        XCTAssertEqual(profile(levels: [9, 10, 10, 11], balance: nil), .intermediate)
    }

    // MARK: breakthroughs

    func testBreakthroughDetection() {
        let previous: [MuscleGroupID: Int] = [.chest: 7, .back: 9]
        let bts = MuscleProfileAssembler.breakthroughs(
            currentLevels: [.chest: 8, .back: 9], previousLevels: previous,
            currentTier: .intermediate, previousTier: .novicePlus, atIso: "2026-07-07")
        XCTAssertEqual(bts.count, 2)
        let muscleBt = bts.first { $0.kind == .muscleLevel }
        XCTAssertEqual(muscleBt?.targetId, "chest")
        XCTAssertEqual(muscleBt?.fromLevel, 7)
        XCTAssertEqual(muscleBt?.toLevel, 8)
        let tierBt = bts.first { $0.kind == .trainingTier }
        XCTAssertEqual(tierBt?.fromTier, .novicePlus)
        XCTAssertEqual(tierBt?.toTier, .intermediate)
    }

    func testNoBreakthroughWithoutPrevious() {
        XCTAssertTrue(MuscleProfileAssembler.breakthroughs(
            currentLevels: [.chest: 8], previousLevels: [:],
            currentTier: .beginner, previousTier: nil, atIso: "2026-07-07").isEmpty)
    }

    // MARK: 全量组装

    func testAssembleProfileEndToEnd() {
        let comps = [
            computation(.chest, level: 9, evidence: [MuscleLevelEvidence(code: "e1rmRising", muscleId: .chest)]),
            computation(.back, level: 10),
            computation(.quads, level: 11),
            computation(.core, level: 2, calibrating: true, confidence: .low),
        ]
        let obs: [MuscleGroupID: MuscleObservations] = [
            .chest: observations(.chest, setsByWeek: [6, 6, 6, 9, 9, 9]),
            .back: observations(.back, setsByWeek: [10, 10, 10, 10, 10, 10]),
            .quads: observations(.quads, setsByWeek: [10, 10, 10, 8, 8, 8]),
            .core: observations(.core, setsByWeek: [2]),
        ]
        let p = MuscleProfileAssembler.assemble(
            computations: comps, observations: obs,
            previousLevels: [.chest: 8], previousPeaks: [.back: 12], previousTier: nil,
            generatedAtIso: "2026-07-07", config: config)

        XCTAssertEqual(p.estimates.count, 4)
        XCTAssertEqual(p.modelVersion, config.modelVersion)
        let chest = p.estimates.first { $0.muscleId == .chest }
        XCTAssertEqual(chest?.trend, .rising)
        let back = p.estimates.first { $0.muscleId == .back }
        XCTAssertEqual(back?.peakLevel, 12)                       // previousPeak 保护
        let core = p.estimates.first { $0.muscleId == .core }
        XCTAssertEqual(core?.trend, .calibrating)
        XCTAssertEqual(core?.decision, .insufficientData)
        XCTAssertNotNil(p.balanceScore)                           // 3 解锁（core calibrating 不计）恰满门槛
        XCTAssertEqual(p.overallTier, .intermediate)              // 中位 10 + rising 信号 + 高 balance（审查 M3）
        XCTAssertEqual(p.estimates.first { $0.muscleId == .chest }?.currentLevel, 9)
        XCTAssertTrue(p.breakthroughs.contains { $0.kind == .muscleLevel && $0.targetId == "chest" })
        XCTAssertEqual(p.strongestMuscleIds.first, .quads)        // 最高 11
    }

    func testSingleHighAmongLowsDoesNotBypassCalibrating() {
        // 审查 M2：1 high + 2 low 解锁 → 中位 low → tier calibrating（安全网不被单肌群绕过）
        let comps = [
            computation(.chest, level: 12, confidence: .high,
                        evidence: [MuscleLevelEvidence(code: "e1rmRising", muscleId: .chest)]),
            computation(.back, level: 4, confidence: .low),
            computation(.quads, level: 4, confidence: .low),
        ]
        let obs: [MuscleGroupID: MuscleObservations] = [
            .chest: observations(.chest, setsByWeek: [10, 10, 10, 10, 10, 10]),
            .back: observations(.back, setsByWeek: [4, 4, 4, 4, 4, 4]),
            .quads: observations(.quads, setsByWeek: [4, 4, 4, 4, 4, 4]),
        ]
        let p = MuscleProfileAssembler.assemble(
            computations: comps, observations: obs, previousLevels: [:], previousPeaks: [:],
            previousTier: nil, generatedAtIso: "2026-07-08", config: config)
        XCTAssertEqual(p.overallTier, .calibrating)
    }

    func testPrioritizeDecisionForLaggingMuscle() {
        // 审查 M3：level 5 vs 中位 10（差 5 > 门槛 3）→ prioritize + 进 priorityMuscleIds
        let comps = [
            computation(.chest, level: 10), computation(.back, level: 10),
            computation(.quads, level: 11), computation(.hamstrings, level: 5),
        ]
        let obs: [MuscleGroupID: MuscleObservations] = Dictionary(uniqueKeysWithValues:
            comps.map { ($0.muscleId, observations($0.muscleId, setsByWeek: [8, 8, 8, 8, 8, 8])) })
        let p = MuscleProfileAssembler.assemble(
            computations: comps, observations: obs, previousLevels: [:], previousPeaks: [:],
            previousTier: nil, generatedAtIso: "2026-07-08", config: config)
        XCTAssertEqual(p.estimates.first { $0.muscleId == .hamstrings }?.decision, .prioritize)
        XCTAssertEqual(p.priorityMuscleIds, [.hamstrings])
    }

    func testRecoverDecisionForDetrainedMuscle() {
        // 审查 M3：修复后的 detraining（近 3 周缺 key）→ decision recover
        let comps = [
            computation(.chest, level: 8), computation(.back, level: 8), computation(.quads, level: 8),
        ]
        var obs: [MuscleGroupID: MuscleObservations] = [
            .back: observations(.back, setsByWeek: [8, 8, 8, 8, 8, 8]),
            .quads: observations(.quads, setsByWeek: [8, 8, 8, 8, 8, 8]),
        ]
        obs[.chest] = MuscleObservations(
            muscleId: .chest,
            weeklyFractionalSets: ["2026-06-01": 8, "2026-06-08": 8, "2026-06-15": 8],
            sessionsTouched: 6, movementFamiliesTouched: 2, e1rmPoints: [])
        let p = MuscleProfileAssembler.assemble(
            computations: comps, observations: obs, previousLevels: [:], previousPeaks: [:],
            previousTier: nil, generatedAtIso: "2026-07-08", config: config)
        let chest = p.estimates.first { $0.muscleId == .chest }
        XCTAssertEqual(chest?.trend, .detraining)
        XCTAssertEqual(chest?.decision, .recover)
    }

    // MARK: tier 边界与高档缺信号（审查 O2/N1 锁）

    func testTierBoundaryValuesAndHighTierWithoutSignal() {
        XCTAssertEqual(profile(levels: [5, 5, 5, 5]), .novicePlus)     // 恰 5 → 落 novicePlus 区（..<5 开区间外）
        XCTAssertEqual(profile(levels: [8, 8, 8, 8]), .intermediate)   // 恰 8 + 信号
        XCTAssertEqual(profile(levels: [12, 12, 12, 12]), .advanced)   // 恰 12 + 信号
        XCTAssertEqual(profile(levels: [16, 16, 16, 16]), .elite)      // 恰 16 + 信号
        // advanced/elite 区缺信号 → 封顶 novicePlus（资格门槛非降档，N1 有意为之）
        XCTAssertEqual(profile(levels: [13, 14, 14, 15], withProgressEvidence: false), .novicePlus)
        XCTAssertEqual(profile(levels: [17, 18, 18, 19], withProgressEvidence: false), .novicePlus)
    }

    // MARK: 组装参数锚句（审查 N4）

    func testAssemblyConfigV1Anchors() {
        XCTAssertEqual(config.trendWindowWeeks, 3)
        XCTAssertEqual(config.trendDeltaThreshold, 0.15)
        XCTAssertEqual(config.balanceMinUnlockedMuscles, 3)
        XCTAssertEqual(config.balanceCvScale, 1.0)
        XCTAssertEqual(config.tierBeginnerMaxLevel, 5)
        XCTAssertEqual(config.tierNovicePlusMaxLevel, 8)
        XCTAssertEqual(config.tierIntermediateMaxLevel, 12)
        XCTAssertEqual(config.tierAdvancedMaxLevel, 16)
        XCTAssertEqual(config.tierBalanceDowngradeBelow, 40)
        XCTAssertEqual(config.priorityLevelGapBelowMedian, 3)
        XCTAssertEqual(config.e1rmRisingMinRatio, 1.02)
    }

    func testDeterministicAssembly() {
        let comps = [computation(.chest, level: 8), computation(.back, level: 9), computation(.quads, level: 7)]
        let obs: [MuscleGroupID: MuscleObservations] = [
            .chest: observations(.chest, setsByWeek: [8, 8, 8, 8, 8, 8]),
            .back: observations(.back, setsByWeek: [8, 8, 8, 8, 8, 8]),
            .quads: observations(.quads, setsByWeek: [8, 8, 8, 8, 8, 8]),
        ]
        let a = MuscleProfileAssembler.assemble(
            computations: comps, observations: obs, previousLevels: [:], previousPeaks: [:],
            previousTier: nil, generatedAtIso: "2026-07-07", config: config)
        let b = MuscleProfileAssembler.assemble(
            computations: comps, observations: obs, previousLevels: [:], previousPeaks: [:],
            previousTier: nil, generatedAtIso: "2026-07-07", config: config)
        XCTAssertEqual(a, b)
        // estimates 顺序确定（按 muscleId rawValue 排序）
        XCTAssertEqual(a.estimates.map(\.muscleId.rawValue), a.estimates.map(\.muscleId.rawValue).sorted())
    }
}
