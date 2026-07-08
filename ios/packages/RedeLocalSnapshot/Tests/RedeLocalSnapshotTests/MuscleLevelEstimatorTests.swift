// MLE-2（2026-07-07）：developmentScore 双主轴计分 + Lv 曲线 + 校准/置信判定。
// 语义锁：exposure 走 Pelland 效率折算（1-10 全效/11-18 ×0.7/≥19 ×0.5，EVIDENCE_LEDGER
// MLE-SCI-2）；performance = 近窗峰 e1RM / 基线窗峰 e1RM 比率（相对自身进步，无外部标准表）；
// 校准解锁 = ≥3 次触及 或 ≥8 有效组（§6.5.6，满足其一）；未解锁产 calibrating 态
// estimate（trend 由 MLE-3 组装，本片输出中间体）；曲线 T(n)=an+bn²（前快后慢）；
// 同输入必同输出（§6.5.7 确定性）。

import XCTest
@testable import RedeLocalSnapshot

final class MuscleLevelEstimatorTests: XCTestCase {
    private let config = MuscleLevelModelConfig.current

    /// 便捷：constructObservations——近窗每周 sets 相同的簡化观察。
    private func observations(
        weeklySets: [Double], sessions: Int, families: Int = 2,
        e1rm: [(String, Double)] = []
    ) -> MuscleObservations {
        var weekly: [String: Double] = [:]
        // 用确定的 ISO 周一序列（近窗从新到旧不重要，估计器按值算）
        let mondays = ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29", "2026-07-06"]
        for (i, sets) in weeklySets.enumerated() where i < mondays.count {
            weekly[mondays[i]] = sets
        }
        return MuscleObservations(
            muscleId: .chest, weeklyFractionalSets: weekly,
            sessionsTouched: sessions, movementFamiliesTouched: families,
            e1rmPoints: e1rm.map { .init(dateISO: $0.0, e1RmKg: $0.1) })
    }

    // MARK: 效率折算（Pelland 分档）

    func testEffectiveSetsTierBoundaries() {
        XCTAssertEqual(MuscleLevelEstimator.effectiveSets(rawWeeklySets: 10, config: config), 10.0)
        XCTAssertEqual(MuscleLevelEstimator.effectiveSets(rawWeeklySets: 11, config: config), 10.7, accuracy: 0.001)
        XCTAssertEqual(MuscleLevelEstimator.effectiveSets(rawWeeklySets: 18, config: config), 15.6, accuracy: 0.001)
        XCTAssertEqual(MuscleLevelEstimator.effectiveSets(rawWeeklySets: 19, config: config), 16.1, accuracy: 0.001)
        XCTAssertEqual(MuscleLevelEstimator.effectiveSets(rawWeeklySets: 0, config: config), 0)
    }

    // MARK: 校准解锁（满足其一）

    func testCalibrationGateBySessionsOrSets() {
        // 2 场 + 总 7 组：两条都不满 → calibrating
        let locked = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [3.5, 3.5], sessions: 2), config: config)
        XCTAssertTrue(locked.isCalibrating)
        XCTAssertEqual(locked.confidence, .low)
        XCTAssertTrue(locked.limitations.contains(MuscleLevelLimitation(code: "shortHistory")))

        // 3 场（组不足）→ 解锁
        let bySessions = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [2, 2, 2], sessions: 3), config: config)
        XCTAssertFalse(bySessions.isCalibrating)

        // 2 场但 8 有效组 → 解锁
        let bySets = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [4, 4], sessions: 2), config: config)
        XCTAssertFalse(bySets.isCalibrating)
    }

    // MARK: 等级曲线（T(n) = a·n + b·n²，a=1 b=0.2 → T(20)=100）

    func testLevelCurveAnchors() {
        XCTAssertEqual(MuscleLevelEstimator.levelThreshold(1, config: config), 1.2, accuracy: 0.001)
        XCTAssertEqual(MuscleLevelEstimator.levelThreshold(10, config: config), 30.0, accuracy: 0.001)
        XCTAssertEqual(MuscleLevelEstimator.levelThreshold(20, config: config), 100.0, accuracy: 0.001)
        // 单调 + 增量递增（前快后慢）
        var previousGap = 0.0
        for n in 2...20 {
            let gap = MuscleLevelEstimator.levelThreshold(n, config: config)
                - MuscleLevelEstimator.levelThreshold(n - 1, config: config)
            XCTAssertGreaterThan(gap, previousGap)
            previousGap = gap
        }
    }

    func testLevelFromScoreClampsAndProgresses() {
        XCTAssertEqual(MuscleLevelEstimator.level(forScore: 0, config: config).level, 1)   // 解锁即 ≥Lv1
        XCTAssertEqual(MuscleLevelEstimator.level(forScore: 30, config: config).level, 10)
        XCTAssertEqual(MuscleLevelEstimator.level(forScore: 100, config: config).level, 20)
        XCTAssertEqual(MuscleLevelEstimator.level(forScore: 100, config: config).progress, 1.0)
        XCTAssertEqual(MuscleLevelEstimator.level(forScore: 999, config: config).level, 20) // 封顶
        let mid = MuscleLevelEstimator.level(forScore: 31.0, config: config)
        XCTAssertEqual(mid.level, 10)
        XCTAssertTrue((0.0...1.0).contains(mid.progress))
    }

    // MARK: performance 轴（相对自身基线）

    func testPerformanceScoreFromE1RMRatio() {
        // 基线窗峰 100 → 近窗峰 110（+10%）：base 15 + 7.5 = 22.5
        let points: [(String, Double)] = [
            ("2026-02-02", 100), ("2026-03-02", 98),      // 基线窗（>6 周前）
            ("2026-06-22", 106), ("2026-07-06", 110),      // 近窗
        ]
        let c = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [10, 10, 10], sessions: 6, e1rm: points),
            config: config, nowISO: "2026-07-07")
        XCTAssertEqual(c.breakdown.performanceScore, 22.5, accuracy: 0.01)
    }

    func testPerformanceWithoutDataIsZeroWithLimitation() {
        let c = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [10, 10, 10], sessions: 6), config: config)
        XCTAssertEqual(c.breakdown.performanceScore, 0)
        XCTAssertTrue(c.limitations.contains(MuscleLevelLimitation(code: "noStrengthSignal")))
    }

    // MARK: 置信三档（§6.5.6 三维）

    func testConfidenceLadder() {
        // low：解锁但不满 medium（4 场）
        let low = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [5, 5], sessions: 4), config: config)
        XCTAssertEqual(low.confidence, .low)
        // medium：6 场 + 18 组 + 2 族
        let medium = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [9, 9], sessions: 6, families: 2), config: config)
        XCTAssertEqual(medium.confidence, .medium)
        // high：12 场 + 36 组 + 3 族
        let high = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [12, 12, 12], sessions: 12, families: 3), config: config)
        XCTAssertEqual(high.confidence, .high)
        // 12 场 36 组但只 2 族 → 卡在 medium（第三维卡门）
        let cappedByFamilies = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [12, 12, 12], sessions: 12, families: 2), config: config)
        XCTAssertEqual(cappedByFamilies.confidence, .medium)
    }

    // MARK: 频率折减（审查 MAJOR 1 锁：单周暴量不再刷级）

    func testSingleWeekVolumeSpikeIsDampened() {
        // 单周 15 组（3 场解锁）：exposure 被 1/6 频率因子压住，等级远低于持续训练
        let spike = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [15], sessions: 3), config: config)
        XCTAssertFalse(spike.isCalibrating)
        XCTAssertLessThanOrEqual(spike.breakdown.exposureScore, 10.0)
        XCTAssertLessThanOrEqual(spike.level, 6)
        // 周均 raw 27 组（折算 20.1 有效 ≥ v2 满分锚 20）持续 6 周：exposure 拿满
        let sustained = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [27, 27, 27, 27, 27, 27], sessions: 18), config: config)
        XCTAssertEqual(sustained.breakdown.exposureScore, config.exposureScoreMax, accuracy: 0.001)
        XCTAssertGreaterThan(sustained.level, spike.level)
    }

    // MARK: 进度单调（审查 MAJOR 2 锁：Lv1 桶跨 T(1) 不回跳）

    func testProgressIsMonotonicAcrossBottomLevelThreshold() {
        let before = MuscleLevelEstimator.level(forScore: 1.19, config: config)
        let at = MuscleLevelEstimator.level(forScore: 1.2, config: config)
        let after = MuscleLevelEstimator.level(forScore: 2.0, config: config)
        XCTAssertEqual(before.level, 1)
        XCTAssertEqual(at.level, 1)
        XCTAssertLessThanOrEqual(before.progress, at.progress)
        XCTAssertLessThanOrEqual(at.progress, after.progress)
    }

    // MARK: performance 负向/封顶/新用户/停练（审查 MODERATE 锁）

    func testPerformanceDeclineFloorsAtZeroWithDecliningEvidence() {
        let points: [(String, Double)] = [("2026-02-02", 100), ("2026-07-06", 80)] // -20%
        let c = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [10, 10, 10], sessions: 6, e1rm: points),
            config: config, nowISO: "2026-07-07")
        XCTAssertEqual(c.breakdown.performanceScore, 0, accuracy: 1e-9) // 浮点噪音容差
        XCTAssertTrue(c.evidence.contains(MuscleLevelEvidence(code: "e1rmDeclining", muscleId: .chest)))
    }

    func testPerformanceGainIsCappedAtMax() {
        let points: [(String, Double)] = [("2026-02-02", 50), ("2026-07-06", 100)] // ×2
        let c = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [10, 10, 10], sessions: 6, e1rm: points),
            config: config, nowISO: "2026-07-07")
        XCTAssertEqual(c.breakdown.performanceScore, config.performanceScoreMax)
    }

    func testNewUserWithoutBaselineGetsNoBaselineScore() {
        // 近窗有点、基线窗空（新用户）：mle-v2 = performanceNoBaselineScore（0，
        // 强度维度零证据；保守表达由置信封顶承担）+ noBaselineWindow 如实
        let points: [(String, Double)] = [("2026-06-22", 90), ("2026-07-06", 95)]
        let c = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [10, 10, 10], sessions: 6, e1rm: points),
            config: config, nowISO: "2026-07-07")
        XCTAssertEqual(c.breakdown.performanceScore, config.performanceNoBaselineScore)
        XCTAssertTrue(c.limitations.contains(MuscleLevelLimitation(code: "noBaselineWindow")))
    }

    func testDetrainedUserWithoutRecentWindowGetsZero() {
        // 基线在、近窗零训练（停练）：真实缺席 0 分 + noRecentWindow
        let points: [(String, Double)] = [("2026-01-26", 100), ("2026-02-09", 102)]
        let c = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [2, 2, 2], sessions: 3, e1rm: points),
            config: config, nowISO: "2026-07-07")
        XCTAssertEqual(c.breakdown.performanceScore, 0)
        XCTAssertTrue(c.limitations.contains(MuscleLevelLimitation(code: "noRecentWindow")))
    }

    // MARK: 冷启动（契约 §6.5.14 测试矩阵第一条）

    func testColdStartEmptyObservationsIsCalibrating() {
        let empty = MuscleObservations(
            muscleId: .back, weeklyFractionalSets: [:], sessionsTouched: 0,
            movementFamiliesTouched: 0, e1rmPoints: [])
        let c = MuscleLevelEstimator.compute(observations: empty, config: config)
        XCTAssertTrue(c.isCalibrating)
        XCTAssertEqual(c.level, config.levelRange.lowerBound)
        XCTAssertEqual(c.progress, 0)
        XCTAssertEqual(c.breakdown.total, 0)
    }

    // MARK: coverage / consistency 与计分常量锚（审查 MODERATE 锁）

    func testCoverageAndConsistencyScoring() {
        // 打满：2 族 + 6/6 周触及
        let full = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [8, 8, 8, 8, 8, 8], sessions: 12, families: 2),
            config: config)
        XCTAssertEqual(full.breakdown.coverageScore, config.coverageScoreMax)
        XCTAssertEqual(full.breakdown.consistencyScore, config.consistencyScoreMax, accuracy: 0.001)
        // 打空：1 族 + 2/6 周
        let sparse = MuscleLevelEstimator.compute(
            observations: observations(weeklySets: [8, 8], sessions: 3, families: 1), config: config)
        XCTAssertEqual(sparse.breakdown.coverageScore, 0)
        XCTAssertEqual(sparse.breakdown.consistencyScore, config.consistencyScoreMax * 2 / 6, accuracy: 0.001)
    }

    func testScoringConfigCurrentAnchors() {
        // mle-v2 全量锚（MLE-8 首轮校准 2026-07-08）：改任何常数必须来这里对账
        XCTAssertEqual(config.modelVersion, "mle-v2")
        XCTAssertEqual(config.effectiveSetsTier1Cap, 10)
        XCTAssertEqual(config.effectiveSetsTier2Cap, 18)
        XCTAssertEqual(config.effectiveSetsTier2Rate, 0.7)
        XCTAssertEqual(config.effectiveSetsTier3Rate, 0.5)
        XCTAssertEqual(config.exposureFullScoreWeeklyEffectiveSets, 20)   // v2: 15→20
        XCTAssertEqual(config.exposureScoreMax, 60)
        XCTAssertEqual(config.performanceBaseScore, 15)
        XCTAssertEqual(config.performanceNoBaselineScore, 0)              // v2 新增
        XCTAssertEqual(config.performancePerTenPercentGain, 7.5)
        XCTAssertEqual(config.performanceScoreMax, 30)
        XCTAssertEqual(config.performanceMinPoints, 2)
        XCTAssertEqual(config.coverageFullScoreFamilies, 2)
        XCTAssertEqual(config.coverageScoreMax, 5)
        XCTAssertEqual(config.consistencyScoreMax, 5)
        XCTAssertEqual(config.levelCurveLinear, 1.0)
        XCTAssertEqual(config.levelCurveQuadratic, 0.2)
        XCTAssertEqual(config.lowConfidenceLevelCap, 5)                   // v2 新增
        XCTAssertEqual(config.mediumConfidenceLevelCap, 10)               // v2 新增
    }

    // MARK: 确定性

    // MARK: MLE-8 校准精修（mle-v2，2026-07-08 owner 真机 E3 反馈「3 场 Lv.9 太快」）

    func testNoBaselinePerformanceIsZeroInV2() {
        // v2 反转 v1 拍板：无基线=强度维度零证据=0 分（v1 的 base 15 白送是
        // 「3 场 Lv.9-12」三因素之一）；limitation 仍如实标 noBaselineWindow
        let obs = observations(weeklySets: [12, 12], sessions: 3,
                               e1rm: [("2026-07-01", 80), ("2026-07-06", 82)])
        let result = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        XCTAssertEqual(result.breakdown.performanceScore, 0)
        XCTAssertTrue(result.limitations.contains { $0.code == "noBaselineWindow" })
    }

    func testLowConfidenceLevelCapAppliesWithEvidence() {
        // 3 场/2 周高容量：分数够更高，但 low confidence 封顶 Lv.5（§3.4 行为表达）；
        // progress 顶格 1（分数已超、等数据解锁——不是「刚进入此级」）+ 专用 evidence
        let obs = observations(weeklySets: [24, 24], sessions: 3, families: 2)
        let result = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        XCTAssertEqual(result.confidence, .low)
        XCTAssertEqual(result.level, config.lowConfidenceLevelCap)
        XCTAssertEqual(result.progress, 1)
        XCTAssertTrue(result.evidence.contains { $0.code == "confidenceLevelCapApplied" })
        XCTAssertGreaterThan(result.curveLevel, result.level)   // 原始曲线级保留（balance 用）
    }

    func testMediumConfidenceLevelCap() {
        // 6 周稳定（medium）：封顶 Lv.10——「进阶初期→中级门口」的可信上限
        let obs = observations(weeklySets: [20, 20, 20, 20, 20, 20], sessions: 8, families: 2)
        let result = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        XCTAssertEqual(result.confidence, .medium)
        XCTAssertEqual(result.level, config.mediumConfidenceLevelCap)
        XCTAssertTrue(result.evidence.contains { $0.code == "confidenceLevelCapApplied" })
    }

    func testHighConfidenceHasNoCap() {
        // high（12 场/36 组/3 族）：分数说话，cap 放开；未触 cap 时无该 evidence
        let obs = observations(weeklySets: [26, 26, 26, 26, 26, 26], sessions: 12, families: 3,
                               e1rm: [("2026-01-12", 80), ("2026-07-06", 88)])
        let result = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        XCTAssertEqual(result.confidence, .high)
        XCTAssertGreaterThan(result.level, config.mediumConfidenceLevelCap)
        XCTAssertFalse(result.evidence.contains { $0.code == "confidenceLevelCapApplied" })
    }

    func testCapNotAppliedWhenScoreAlreadyBelow() {
        // 分数本来低于 cap：正常曲线级 + 正常 progress（cap 只封不抬、不出假 evidence）
        let obs = observations(weeklySets: [3, 3], sessions: 3, families: 1)
        let result = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        XCTAssertLessThan(result.level, config.lowConfidenceLevelCap)
        XCTAssertLessThan(result.progress, 1)
        XCTAssertFalse(result.evidence.contains { $0.code == "confidenceLevelCapApplied" })
    }

    func testRealDeviceScenarioThreeSessionsLandsAtCap() {
        // 真机复现锚：3 场 upper/2 ISO 周（back 一场 ~12 raw）在 v1 = Lv.9-12 → v2 = Lv.5
        let obs = observations(weeklySets: [12, 24], sessions: 3, families: 2)
        let result = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        XCTAssertEqual(result.level, 5)
    }

    func testDeterministicOutput() {
        let obs = observations(weeklySets: [8, 10, 12], sessions: 7,
                               e1rm: [("2026-03-02", 90), ("2026-07-06", 99)])
        let a = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        let b = MuscleLevelEstimator.compute(observations: obs, config: config, nowISO: "2026-07-07")
        XCTAssertEqual(a, b)
    }
}
