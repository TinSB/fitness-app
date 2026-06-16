// 最小动作 catalog（PRD 开放决策 #1 拍板：几十个、宁可少而准）。
// catalog 是动作事实唯一权威（系统逻辑 §6.1）；展示名归 RedeL10n（引擎零文案）。

import XCTest
@testable import RedeTrainingDecision

final class ExerciseCatalogTests: XCTestCase {
    func testCatalogHasStableUniqueIdsAndVersion() {
        let catalog = ExerciseCatalog.minimal
        XCTAssertFalse(catalog.entries.isEmpty)
        XCTAssertGreaterThanOrEqual(catalog.entries.count, 20, "最小集应覆盖起始计划生成（量级几十个）")
        XCTAssertEqual(Set(catalog.entries.map(\.id)).count, catalog.entries.count, "exerciseId 必须唯一")
        XCTAssertFalse(catalog.catalogVersion.isEmpty)
    }

    func testEveryEntryHasRequiredFacts() {
        for entry in ExerciseCatalog.minimal.entries {
            XCTAssertFalse(entry.id.isEmpty)
            XCTAssertFalse(entry.movementPattern.isEmpty, "\(entry.id) 缺 movement pattern")
            XCTAssertFalse(entry.primaryMuscle.isEmpty, "\(entry.id) 缺主肌群")
            XCTAssertFalse(entry.equipment.isEmpty, "\(entry.id) 缺器械需求")
            XCTAssertFalse(entry.substitutionGroup.isEmpty, "\(entry.id) 缺替代族")
            XCTAssertFalse(entry.kind.isEmpty, "\(entry.id) 缺训练学角色")
            if entry.loadType != "bodyweight" && entry.loadType != "band" { XCTAssertGreaterThan(entry.startWeightKg, 0) } // 自重/弹力带=0 合法（wave-6/12）
        }
    }

    func testSubstitutionGroupsContainAtLeastTwoExercisesForCoreGroups() {
        // 替换功能（FR-TR6）依赖替代族：核心族必须各自有可替换的同伴。
        let groups = Dictionary(grouping: ExerciseCatalog.minimal.entries, by: \.substitutionGroup)
        for core in ["chest-press", "row", "squat", "hinge", "biceps-curl", "triceps"] {
            XCTAssertGreaterThanOrEqual(groups[core]?.count ?? 0, 2, "核心替代族 \(core) 缺同伴")
        }
    }

    func testLookupById() {
        XCTAssertNotNil(ExerciseCatalog.minimal.entry(id: "bench-press"))
        XCTAssertNil(ExerciseCatalog.minimal.entry(id: "no-such-exercise"))
    }
}
