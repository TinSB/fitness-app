// M5-2 单位切换（FR-SE1）：lb 为渲染层换算，存储/引擎恒 kg（系统逻辑 §149）。
// 合同：默认 kg 行为与历史完全一致（既有锚句测试是回归保护）；
// lb 显示 = ×2.2046226218 后取 0.5 lb 步进去尾零（显示精度，不做配片量化）。

import XCTest
@testable import RedeL10n

final class RedeUnitTests: XCTestCase {
    func testDefaultUnitIsKgAndBehaviorUnchanged() {
        let s = RedeStrings(locale: .en)
        XCTAssertEqual(s.unit, .kg)
        XCTAssertEqual(s.formatKg(62.5), "62.5")
        XCTAssertEqual(s.formatKg(60), "60")
        XCTAssertEqual(s.unitLabel, "kg")
        XCTAssertTrue(s.trainLoadSuffix(targetReps: 6, targetRir: 2).hasPrefix("kg ·"))
    }

    func testLbConversionAnchors() {
        let s = RedeStrings(locale: .en, unit: .lb)
        XCTAssertEqual(s.formatKg(62.5), "138")    // 137.79 → 0.5 步进 → 138
        XCTAssertEqual(s.formatKg(17.5), "38.5")   // 38.58 → 38.5
        XCTAssertEqual(s.formatKg(15), "33")       // 33.07 → 33
        XCTAssertEqual(s.formatKg(2.5), "5.5")     // 5.51 → 5.5
        XCTAssertEqual(s.formatKg(0), "0")
        XCTAssertEqual(s.unitLabel, "lb")
        XCTAssertTrue(s.trainLoadSuffix(targetReps: 6, targetRir: 2).hasPrefix("lb ·"))
    }

    func testE1RmFollowsUnit() {
        let kg = RedeStrings(locale: .zh)
        let lb = RedeStrings(locale: .zh, unit: .lb)
        XCTAssertEqual(kg.formatE1Rm(69.667), "69.5")
        XCTAssertEqual(lb.formatE1Rm(69.667), "153")   // kg 侧先取 0.5（69.5）→ 153.22 lb → 0.5 步进 → 153
    }

    func testCopyCarriesUnitLabelEverywhere() {
        // 抽样核心句：lb 模式下不得再出现「kg」字面量
        let s = RedeStrings(locale: .en, unit: .lb)
        let samples = [
            s.trainLoadSuffix(targetReps: 6, targetRir: 2),
            s.loadDetail(targetReps: 6, targetRir: 2),
            s.restNextPreview(setNumber: 2, kg: s.formatKg(60), reps: 6),
            s.adjustPreviewNext(kg: s.formatKg(52.5)),
            s.summaryTopSet(name: "Bench press", kg: s.formatKg(62.5), reps: 6),
            s.sessionSubTopSet(lift: "Bench press", kg: s.formatKg(62.5), reps: 6, e1rmKg: s.formatE1Rm(70)),
            s.historySetLine(kg: s.formatKg(60), reps: 6),
        ]
        for text in samples {
            XCTAssertFalse(text.contains("kg"), "lb 模式仍含 kg：\(text)")
            XCTAssertTrue(text.contains("lb"), "lb 模式缺单位：\(text)")
        }
    }

    func testUnitResolve() {
        XCTAssertEqual(RedeUnit.resolve("lb"), .lb)
        XCTAssertEqual(RedeUnit.resolve("kg"), .kg)
        XCTAssertEqual(RedeUnit.resolve(nil), .kg)
        XCTAssertEqual(RedeUnit.resolve("stone"), .kg) // 未知值回退 kg，不猜
    }
}
