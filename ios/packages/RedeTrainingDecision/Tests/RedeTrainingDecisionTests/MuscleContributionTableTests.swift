// MLE-1a（2026-07-07）：动作 → 契约肌群贡献对（fractional 二档口径的唯一定义点）。
// 语义锁：primary 1.0 / secondary 各 0.5（Pelland 2025 meta 最优拟合口径 + Hevy 行业
// 惯例，EVIDENCE_LEDGER MLE-SCI-1/CMP-3）；映射 nil（forearm/未知）如实跳过；
// 同一契约肌群多路命中时合并取最大权重（不叠加——细粒度归并撞桶不虚增贡献）。

import XCTest
@testable import RedeTrainingDecision

final class MuscleContributionTableTests: XCTestCase {
    private let catalog = ExerciseCatalog.minimal

    private func contributions(_ id: String) -> [MuscleGroupID: Double] {
        Dictionary(uniqueKeysWithValues: MuscleContributionTable.contributions(exerciseId: id, catalog: catalog))
    }

    func testCompoundSplitsPrimaryFullSecondaryHalf() {
        // 卧推：primary chest；secondary 含 triceps 与 front-delt（→shoulders）
        let c = contributions("bench-press")
        XCTAssertEqual(c[.chest], 1.0)
        XCTAssertEqual(c[.triceps], 0.5)
        XCTAssertEqual(c[.shoulders], 0.5)
    }

    func testIsolationYieldsSinglePrimaryOnly() {
        let c = contributions("lateral-raise") // primary side-delt → shoulders，无 secondary
        XCTAssertEqual(c, [.shoulders: 1.0])
    }

    func testExcludedMuscleContributesNothing() {
        // 腕弯举 primary=forearm → 映射 nil：整个动作零贡献（如实排除，不硬塞）
        XCTAssertTrue(MuscleContributionTable.contributions(exerciseId: "wrist-curl", catalog: catalog).isEmpty)
    }

    func testSecondaryForearmSkippedButPrimaryKept() {
        // hammer-curl：primary biceps 保留；secondary forearm 跳过
        let c = contributions("hammer-curl")
        XCTAssertEqual(c[.biceps], 1.0)
        XCTAssertFalse(c.keys.isEmpty)
        XCTAssertNil(c.first(where: { $0.key.rawValue == "forearm" }))
    }

    func testSameContractMuscleMergesWithMaxNotSum() {
        // 真实撞桶案例（wave-18 共 7 个，审查复算证实）：shrug 族 4 个（primary traps→back
        // 撞 secondary upper-back→back）、rack-pull（primary back 撞 secondary traps→back）、
        // 历史案例：arnold/landmine 曾 primary 撞 secondary front-delt（批次 G N6 已修——现 secondary 为 side-delt/chest，防回潮见 CatalogContractTests）。
        // 取 max 不叠加；1.0/0.5 两档下 max 结构性 ≤1.0——全目录扫描不变量对未来新增
        // 动作恒有效，sum 误改必转红。
        for entry in catalog.entries {
            let c = Dictionary(uniqueKeysWithValues:
                MuscleContributionTable.contributions(exerciseId: entry.id, catalog: catalog))
            for (muscle, weight) in c {
                XCTAssertLessThanOrEqual(weight, 1.0, "\(entry.id) → \(muscle) 贡献超 1.0")
                XCTAssertGreaterThan(weight, 0, "\(entry.id) → \(muscle) 非正贡献")
            }
        }
    }

    func testUnknownExerciseYieldsEmpty() {
        XCTAssertTrue(MuscleContributionTable.contributions(exerciseId: "no-such-exercise", catalog: catalog).isEmpty)
    }
}
