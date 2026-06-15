// 周期化引擎 S1：纯相位计算 golden（相位映射 / 周边界 / 取模回绕 / 锚点 / 软重置 / 降级）。

import XCTest
@testable import RedeTrainingDecision

final class MesocyclePhaseTests: XCTestCase {
    // 块起始 2026-05-04；每 +7 天进下一周角色，满 4 周回绕。
    private let start = "2026-05-04"

    func testPhaseByWeekIndexAndWraparound() {
        func p(_ today: String) -> MesocyclePhase { Mesocycle.phase(blockStartISO: start, todayISO: today) }
        XCTAssertEqual(p("2026-05-04"), .calibrate)  // 第 0 周
        XCTAssertEqual(p("2026-05-10"), .calibrate)  // +6 天仍第 0 周（满 7 才进）
        XCTAssertEqual(p("2026-05-11"), .build)      // +7 第 1 周
        XCTAssertEqual(p("2026-05-18"), .overreach)  // +14 第 2 周
        XCTAssertEqual(p("2026-05-25"), .deload)     // +21 第 3 周
        XCTAssertEqual(p("2026-06-01"), .calibrate)  // +28 第 4 周回绕 → 校准
        XCTAssertEqual(p("2026-06-08"), .build)      // +35 第 5 周 → 构建
    }

    func testPhaseSafeDegrade() {
        // today < blockStart / 非法日期 → 安全降级校准，绝不抛错
        XCTAssertEqual(Mesocycle.phase(blockStartISO: start, todayISO: "2026-05-01"), .calibrate)
        XCTAssertEqual(Mesocycle.phase(blockStartISO: "garbage", todayISO: "2026-05-11"), .calibrate)
        XCTAssertEqual(Mesocycle.phase(blockStartISO: start, todayISO: "nope"), .calibrate)
        XCTAssertEqual(Mesocycle.phase(blockStartISO: start, todayISO: "2026-05-11", blockLengthWeeks: 0), .calibrate)
    }

    func testModulationTableLocked() {
        // owner 拍板·主动过载版（改这表 = 改训练学契约，须留痕）
        XCTAssertEqual(MesocyclePhase.calibrate.modulation, PhaseModulation(weightMultiplier: 1.00, setDelta: 0, rirTarget: 2.5))
        XCTAssertEqual(MesocyclePhase.build.modulation,     PhaseModulation(weightMultiplier: 1.00, setDelta: 0, rirTarget: 2.0))
        XCTAssertEqual(MesocyclePhase.overreach.modulation, PhaseModulation(weightMultiplier: 1.00, setDelta: 1, rirTarget: 1.0))
        XCTAssertEqual(MesocyclePhase.deload.modulation,    PhaseModulation(weightMultiplier: 0.85, setDelta: -1, rirTarget: 3.5))
    }

    func testBlockAnchorEmptyAndSingle() {
        XCTAssertNil(Mesocycle.blockStartISO(sessionDatesISO: [], todayISO: "2026-05-20"))
        XCTAssertEqual(Mesocycle.blockStartISO(sessionDatesISO: ["2026-05-20"], todayISO: "2026-05-21"), "2026-05-20")
    }

    func testBlockAnchorMostRecentStreak() {
        // 连续序列（相邻 ≤10 天）→ 锚到序列起点
        let streak = ["2026-05-04", "2026-05-07", "2026-05-11", "2026-05-14"]
        XCTAssertEqual(Mesocycle.blockStartISO(sessionDatesISO: streak, todayISO: "2026-05-15"), "2026-05-04")
        // 历史里有 >10 天断点 → 只取最近一段（断点后那段）的起点
        let withGap = ["2026-04-01", "2026-04-03", "2026-05-04", "2026-05-07"]  // 04-03→05-04 = 31 天断
        XCTAssertEqual(Mesocycle.blockStartISO(sessionDatesISO: withGap, todayISO: "2026-05-08"), "2026-05-04")
    }

    func testBlockAnchorSoftResetOnLongLayoff() {
        // 今日距最近训练日 ≥ restartGapDays(10) → 本块作废、锚到今日
        XCTAssertEqual(Mesocycle.blockStartISO(sessionDatesISO: ["2026-05-04"], todayISO: "2026-05-20"), "2026-05-20")
        // 软重置后今日相位 = 校准（新块第 1 周）
        let anchor = Mesocycle.blockStartISO(sessionDatesISO: ["2026-05-04"], todayISO: "2026-05-20")!
        XCTAssertEqual(Mesocycle.phase(blockStartISO: anchor, todayISO: "2026-05-20"), .calibrate)
    }
}
