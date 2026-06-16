// M4-2（FR-PR4 数据层）：数据质量最小信号——丢弃统计 + 可疑数值静默标记。
// 红线：只标记不改数据（clean view 原样）；信号是 typed 结构，
// 不产出任何文案（「置信度」字样在结构上不存在，§3.4）；缺 RIR 类
// 数据缺口刻意不进本报告（文案基线：折进训练时补记，不挂 Progress）。

import XCTest
import RedeDomain
@testable import RedeDataHealth

final class DataQualityReportTests: XCTestCase {
    private func view(_ json: String) throws -> CleanAppDataView {
        let appData = try JSONDecoder().decode(AppData.self, from: Data(json.utf8))
        return CleanAppDataViewBuilder.build(from: appData)
    }

    private func sessionJSON(_ id: String, _ date: String, _ exerciseId: String, sets: [(Double, Int)]) -> String {
        let setsJSON = sets.map { #"{"weight": \#($0.0), "reps": \#($0.1)}"# }.joined(separator: ",")
        return #"{"id": "\#(id)", "date": "\#(date)", "completed": true, "exercises": [{"exerciseId": "\#(exerciseId)", "sets": [\#(setsJSON)]}]}"#
    }

    // MARK: - 干净数据 → 空报告

    func testCleanDataYieldsEmptyReport() throws {
        let view = try view(#"{"schemaVersion": 8, "history": [\#(sessionJSON("s1", "2026-06-01", "bench-press", sets: [(60, 6)]))]}"#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.droppedSessionCount, 0)
        XCTAssertEqual(report.droppedExerciseCount, 0)
        XCTAssertEqual(report.droppedSetCount, 0)
        XCTAssertEqual(report.ignoredFieldCount, 0)
        XCTAssertTrue(report.suspectSets.isEmpty)
        XCTAssertFalse(report.hasFindings)
    }

    // MARK: - 丢弃统计（来自净化 issues 的聚合）

    func testDroppedDataIsCountedByCategory() throws {
        let view = try view(#"""
        {"schemaVersion": 8,
         "userProfile": {"age": 500},
         "history": [
            {"id": "ok", "date": "2026-06-01", "completed": true,
             "exercises": [{"exerciseId": "bench-press", "sets": [{"weight": 60, "reps": 6}, {"weight": -5, "reps": 6}]},
                           {"sets": [{"weight": 40, "reps": 8}]}]},
            {"id": "no-date", "completed": true},
            {"date": "2026-06-02", "completed": true}
         ]}
        """#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.droppedSessionCount, 2)  // no-date + 缺 id
        XCTAssertEqual(report.droppedExerciseCount, 1) // 缺 exerciseId
        XCTAssertEqual(report.droppedSetCount, 1)      // 负重量
        XCTAssertEqual(report.ignoredFieldCount, 1)    // age 500
        XCTAssertTrue(report.hasFindings)
    }

    // MARK: - 可疑数值：远超本人历史（FR-PR4「这组 500 lb 可能记错了」）

    func testWeightFarAboveOwnHistoryIsFlagged() throws {
        // 历史最好 90kg，新场 227kg（≈500lb）→ 标记，且携带对比基准
        let history = [
            sessionJSON("s1", "2026-06-01", "bench-press", sets: [(90, 5)]),
            sessionJSON("s2", "2026-06-03", "bench-press", sets: [(227, 5)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.suspectSets.count, 1)
        let suspect = report.suspectSets[0]
        XCTAssertEqual(suspect.sessionId, "s2")
        XCTAssertEqual(suspect.exerciseId, "bench-press")
        XCTAssertEqual(suspect.setIndex, 1)
        XCTAssertEqual(suspect.weightKg, 227)
        XCTAssertEqual(suspect.reason, .weightFarAboveOwnHistory(previousBestKg: 90))
    }

    func testFirstExposureHeavyWeightIsNotFlaggedByRelativeRule() throws {
        // 无历史参照（首练）→ 相对规则不标（校准期同款哲学）
        let history = sessionJSON("s1", "2026-06-01", "deadlift", sets: [(220, 3)])
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        XCTAssertTrue(DataQualityReportBuilder.build(view: view).suspectSets.isEmpty)
    }

    func testExactlyOnePointFiveTimesIsNotFlagged() throws {
        // 阈值为严格大于：90 → 135（=1.5×）不标
        let history = [
            sessionJSON("s1", "2026-06-01", "squat", sets: [(90, 5)]),
            sessionJSON("s2", "2026-06-03", "squat", sets: [(135, 3)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        XCTAssertTrue(DataQualityReportBuilder.build(view: view).suspectSets.isEmpty)
    }

    func testSmallWeightProgressIsNotFlagged() throws {
        // 历史基准 <30kg 不启用相对规则（新手小重量翻倍是正常进步，不是异常）
        let history = [
            sessionJSON("s1", "2026-06-01", "lateral-raise", sets: [(5, 12)]),
            sessionJSON("s2", "2026-06-03", "lateral-raise", sets: [(12.5, 10)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        XCTAssertTrue(DataQualityReportBuilder.build(view: view).suspectSets.isEmpty)
    }

    func testComparisonBaselineIsStrictlyEarlierSessions() throws {
        // 同场内第二组更重不触发相对规则（场内自比不是「超历史」）
        let history = sessionJSON("s1", "2026-06-01", "bench-press", sets: [(60, 6), (100, 1)])
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        XCTAssertTrue(DataQualityReportBuilder.build(view: view).suspectSets.isEmpty)
    }

    // MARK: - 可疑数值：绝对天花板与次数

    func testWeightBeyondPlausibleCeilingIsFlaggedEvenWithoutHistory() throws {
        let history = sessionJSON("s1", "2026-06-01", "leg-press", sets: [(450, 5)])
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.suspectSets.map(\.reason), [.weightBeyondPlausibleCeiling])
    }

    func testImplausiblyHighRepsAreFlagged() throws {
        let history = sessionJSON("s1", "2026-06-01", "push-up", sets: [(0, 80)])
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.suspectSets.map(\.reason), [.repsImplausiblyHigh])
        XCTAssertEqual(report.suspectSets[0].reps, 80)
    }

    func testFlaggedSetsDoNotEvolveBaselineSoPersistentAnomalyStaysFlagged() throws {
        // 已知边界（审查确认刻意接受）：单场暴涨被标后基准不演化——
        // 其后同水平的场持续被标（诚实提示直到经 M4-3 修正入口处理）。
        let history = [
            sessionJSON("s1", "2026-06-01", "bench-press", sets: [(90, 5)]),
            sessionJSON("s2", "2026-06-03", "bench-press", sets: [(140, 5)]), // >135 → 标
            sessionJSON("s3", "2026-06-05", "bench-press", sets: [(140, 5)]), // 基准仍 90 → 继续标
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.suspectSets.map(\.sessionId), ["s2", "s3"])
        XCTAssertEqual(
            report.suspectSets.map(\.reason),
            [.weightFarAboveOwnHistory(previousBestKg: 90), .weightFarAboveOwnHistory(previousBestKg: 90)]
        )
    }

    func testRelativeRuleTakesPriorityOverHighReps() throws {
        // 同组同时触发相对+次数 → 只标相对（优先级：天花板 > 相对 > 次数）
        let history = [
            sessionJSON("s1", "2026-06-01", "bench-press", sets: [(90, 5)]),
            sessionJSON("s2", "2026-06-03", "bench-press", sets: [(200, 60)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        XCTAssertEqual(
            DataQualityReportBuilder.build(view: view).suspectSets.map(\.reason),
            [.weightFarAboveOwnHistory(previousBestKg: 90)]
        )
    }

    func testRepsRuleFiresIndependentlyWhenWeightIsNormal() throws {
        // 有基准、重量正常、仅次数离谱 → 次数规则独立触发
        let history = [
            sessionJSON("s1", "2026-06-01", "bench-press", sets: [(90, 5)]),
            sessionJSON("s2", "2026-06-03", "bench-press", sets: [(95, 51)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        XCTAssertEqual(
            DataQualityReportBuilder.build(view: view).suspectSets.map(\.reason),
            [.repsImplausiblyHigh]
        )
    }

    func testBaselineFloorBoundaryAt30kg() throws {
        // 基准恰好 30kg → 相对规则启用（>=）；基准 29.5 → 不启用
        let activated = [
            sessionJSON("s1", "2026-06-01", "db-press", sets: [(30, 8)]),
            sessionJSON("s2", "2026-06-03", "db-press", sets: [(46, 5)]), // >45 → 标
        ].joined(separator: ",")
        let activatedView = try view(#"{"schemaVersion": 8, "history": [\#(activated)]}"#)
        XCTAssertEqual(
            DataQualityReportBuilder.build(view: activatedView).suspectSets.map(\.reason),
            [.weightFarAboveOwnHistory(previousBestKg: 30)]
        )

        let inactive = [
            sessionJSON("s1", "2026-06-01", "db-press", sets: [(29.5, 8)]),
            sessionJSON("s2", "2026-06-03", "db-press", sets: [(46, 5)]),
        ].joined(separator: ",")
        let inactiveView = try view(#"{"schemaVersion": 8, "history": [\#(inactive)]}"#)
        XCTAssertTrue(DataQualityReportBuilder.build(view: inactiveView).suspectSets.isEmpty)
    }

    // MARK: - 红线：只标记不改数据

    func testFlaggingNeverMutatesCleanView() throws {
        let history = [
            sessionJSON("s1", "2026-06-01", "bench-press", sets: [(90, 5)]),
            sessionJSON("s2", "2026-06-03", "bench-press", sets: [(227, 5)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.suspectSets.count, 1)
        // 被标记的组在 clean view 中原样存在（静默标记，不擅改用户数据）
        let s2 = view.sessions.first(where: { $0.id == "s2" })
        XCTAssertEqual(s2?.exercises.first?.sets.first?.weight, 227)
    }

    // MARK: - 确定性与排序

    func testSuspectsOrderedChronologicallyThenBySetIndex() throws {
        let history = [
            sessionJSON("s1", "2026-06-01", "bench-press", sets: [(90, 5)]),
            sessionJSON("s3", "2026-06-05", "bench-press", sets: [(200, 2), (210, 60)]),
            sessionJSON("s2", "2026-06-03", "bench-press", sets: [(180, 3)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        let report = DataQualityReportBuilder.build(view: view)
        XCTAssertEqual(report.suspectSets.map(\.sessionId), ["s2", "s3", "s3"])
        XCTAssertEqual(report.suspectSets.map(\.setIndex), [1, 1, 2])
    }

    func testSameInputProducesEqualReports() throws {
        let history = [
            sessionJSON("s1", "2026-06-01", "bench-press", sets: [(90, 5)]),
            sessionJSON("s2", "2026-06-03", "bench-press", sets: [(227, 5)]),
        ].joined(separator: ",")
        let view = try view(#"{"schemaVersion": 8, "history": [\#(history)]}"#)
        XCTAssertEqual(
            DataQualityReportBuilder.build(view: view),
            DataQualityReportBuilder.build(view: view)
        )
    }

    // MARK: - §6.2 动作级合理上限（2026-06-11）

    func testPerExerciseCeilingCatchesSmallLiftTypo() throws {
        // 侧平举 100kg（10× 手滑/磅公斤混淆）：基准 <30 相对规则不触发、
        // 全局 400 也不触发——动作级上限 60 必须标住
        let view = try view(#"{"schemaVersion": 8, "history": [\#(sessionJSON("s1", "2026-06-01", "lateral-raise", sets: [(100, 10)]))]}"#)
        let flagged = DataQualityReportBuilder.build(
            view: view, plausibleCeilingByExercise: ["lateral-raise": 60]
        )
        XCTAssertEqual(flagged.suspectSets.count, 1)
        XCTAssertEqual(flagged.suspectSets.first?.reason, .weightBeyondPlausibleCeiling)
        // 缺省空表 = 旧行为（不标）
        let legacy = DataQualityReportBuilder.build(view: view)
        XCTAssertTrue(legacy.suspectSets.isEmpty)
        // 上限内的正常重量不误标
        let normal = try self.view(#"{"schemaVersion": 8, "history": [\#(sessionJSON("s1", "2026-06-01", "lateral-raise", sets: [(12.5, 12)]))]}"#)
        XCTAssertTrue(DataQualityReportBuilder.build(
            view: normal, plausibleCeilingByExercise: ["lateral-raise": 60]
        ).suspectSets.isEmpty)
    }
}
