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

    // FR-EX2 收尾：主项动作有双语技术要点 + 证据级来源挂循证（真实可核验，研究 workflow 已对抗核验）。
    func testMainLiftsHaveBilingualCuesAndVerifiedEvidence() {
        let evidenceGrade = ["bench-press", "squat", "deadlift", "overhead-press", "barbell-row", "romanian-deadlift"]
        for id in evidenceGrade {
            let e = ExerciseCatalog.minimal.entry(id: id)
            XCTAssertNotNil(e, "缺动作 \(id)")
            XCTAssertEqual(e?.techniqueCuesEn?.isEmpty, false, "\(id) 缺英文技术要点")
            XCTAssertEqual(e?.techniqueCuesZh?.isEmpty, false, "\(id) 缺中文技术要点")
            XCTAssertEqual(e?.techniqueCuesZh?.count, e?.techniqueCuesEn?.count, "\(id) 中英要点条数应一致")
            XCTAssertEqual(e?.evidenceTag?.isEmpty, false, "\(id) 缺循证来源")
            // 真实可核验来源：URL 必须是 http(s)（research workflow 已 WebFetch 核验存在）。
            XCTAssertEqual(e?.evidenceUrl?.hasPrefix("https://"), true, "\(id) 循证 URL 非 https")
        }
    }

    // 诚实红线：front-squat 来源是 CrossFit.com（非证据级）→ 只留技术要点、不挂循证标签（不冒充循证）。
    func testFrontSquatHasCuesButNoEvidenceTag() {
        let e = ExerciseCatalog.minimal.entry(id: "front-squat")
        XCTAssertEqual(e?.techniqueCuesEn?.isEmpty, false, "front-squat 应有技术要点")
        XCTAssertNil(e?.evidenceTag, "front-squat 非证据级来源，不应挂循证标签")
        XCTAssertNil(e?.evidenceUrl, "front-squat 不应有孤立的循证 URL")
    }

    // 回归：未填内容的动作 techniqueCues 为 nil（加性、零行为变化）。
    func testUntouchedExerciseHasNilCues() {
        let e = ExerciseCatalog.minimal.entry(id: "incline-db-press")
        XCTAssertNotNil(e, "样例动作应存在")
        XCTAssertNil(e?.techniqueCuesEn)
        XCTAssertNil(e?.techniqueCuesZh)
        XCTAssertNil(e?.evidenceTag)
        XCTAssertNil(e?.evidenceUrl)
    }
}
