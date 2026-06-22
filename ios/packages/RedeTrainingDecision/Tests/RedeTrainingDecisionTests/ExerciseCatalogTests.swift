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

    // FR-EX2 批次无关不变量（自动覆盖所有内容批次，无需硬编码 id）：
    //  - 有技术要点的动作：中英条数一致、均非空；
    //  - 有循证标签的动作：URL 必须 https（真实可核验）；
    //  - 无孤立 evidenceUrl（有 URL 必有 tag）。
    //
    // 循证分级政策（owner 拍板「真实循证」，#591 起既定先例）：挂 evidenceUrl 的来源
    // 必须真实、可核验、且确实研究/覆盖该动作。接受两档来源：
    //  - 同行评审研究（PubMed/PMC/JSCR/PeerJ 等）——有直接研究时优先；
    //  - 权威认证机构动作库（NSCA / ACE / NASM）——常见机器/器械动作无直接 RCT 时采用，
    //    它们是机构编审的技术指引、非个人博客或掠夺性期刊（后者一律降级 cues-only，
    //    见 front-squat=CrossFit、arnold-press=IJPHRD 掠夺性期刊）。
    // 每条 URL 均经研究 workflow 逐条 WebFetch 对抗核验 + 提交前 curl 抽检 200。
    func testCuedEntriesAreBilingualAndEvidenceWellFormed() {
        var cuedCount = 0
        for e in ExerciseCatalog.minimal.entries {
            if let en = e.techniqueCuesEn {
                cuedCount += 1
                XCTAssertFalse(en.isEmpty, "\(e.id) techniqueCuesEn 空")
                XCTAssertEqual(e.techniqueCuesZh?.count, en.count, "\(e.id) 中英要点条数不一致")
            }
            if let tag = e.evidenceTag {
                XCTAssertFalse(tag.isEmpty, "\(e.id) evidenceTag 空")
                XCTAssertEqual(e.evidenceUrl?.hasPrefix("https://"), true, "\(e.id) 循证 URL 非 https")
            }
            if e.evidenceUrl != nil {
                XCTAssertNotNil(e.evidenceTag, "\(e.id) 有 evidenceUrl 却无 evidenceTag（孤立 URL）")
            }
        }
        // 净新增累计：原主项/高频 51（批1=7+批2=12+批3=16+批4=16）+ 新动作批 42（wave-16/17/18
        // 新增的 42 个动作补要点）= 93（各批为不重叠净增）。
        XCTAssertGreaterThanOrEqual(cuedCount, 93, "技术要点累计应 ≥ 93（51 高频 + 42 新动作）")
    }

    // FR-EX2 退阶/进阶 + 注意事项（§7.1）批次无关不变量：
    //  - 退阶/进阶/安全注意三组字段各自中英成对（缺则两边都缺，绝不单边露原始码）；
    //  - 有要点的动作（93）应同时有退阶+进阶（同批补齐）；
    //  - 安全注意只给有风险的动作（≥40），低风险动作 nil（诚实不臆造风险，§7.1）。
    func testScalingAndSafetyAreBilingualAndCovered() {
        var scaled = 0, safe = 0
        for e in ExerciseCatalog.minimal.entries {
            XCTAssertEqual(e.regressionZh == nil, e.regressionEn == nil, "\(e.id) 退阶中英不成对")
            XCTAssertEqual(e.progressionZh == nil, e.progressionEn == nil, "\(e.id) 进阶中英不成对")
            XCTAssertEqual(e.safetyNoteZh == nil, e.safetyNoteEn == nil, "\(e.id) 安全注意中英不成对")
            // 退阶与进阶配对出现（要么都有、要么都无；不单给一边）
            XCTAssertEqual(e.regressionZh == nil, e.progressionZh == nil, "\(e.id) 退阶/进阶未配对")
            if e.regressionZh != nil { scaled += 1 }
            if e.safetyNoteZh != nil { safe += 1 }
            // 有要点的动作应已补退阶/进阶（同批；防止漏填）
            if e.techniqueCuesEn != nil {
                XCTAssertNotNil(e.regressionZh, "\(e.id) 有技术要点却缺退阶/进阶")
            }
            // 安全注意不得做成孤立空串
            if let s = e.safetyNoteZh { XCTAssertFalse(s.isEmpty, "\(e.id) safetyNoteZh 空") }
        }
        XCTAssertGreaterThanOrEqual(scaled, 93, "退阶/进阶应覆盖 93 个有要点的动作")
        XCTAssertGreaterThanOrEqual(safe, 55, "安全注意应覆盖有风险的动作（实际 60；留小余量防降级）")
    }

    // 诚实红线：front-squat 来源是 CrossFit.com（非证据级）→ 只留技术要点、不挂循证标签（不冒充循证）。
    func testFrontSquatHasCuesButNoEvidenceTag() {
        let e = ExerciseCatalog.minimal.entry(id: "front-squat")
        XCTAssertEqual(e?.techniqueCuesEn?.isEmpty, false, "front-squat 应有技术要点")
        XCTAssertNil(e?.evidenceTag, "front-squat 非证据级来源，不应挂循证标签")
        XCTAssertNil(e?.evidenceUrl, "front-squat 不应有孤立的循证 URL")
    }

    // 回归：未填内容的动作 techniqueCues 为 nil（加性、零行为变化）。
    // 样例用 db-pullover（长尾 C 档，批3/批4 都不填充，长期保持未填）。
    func testUntouchedExerciseHasNilCues() {
        let e = ExerciseCatalog.minimal.entry(id: "db-pullover")
        XCTAssertNotNil(e, "样例动作应存在")
        XCTAssertNil(e?.techniqueCuesEn)
        XCTAssertNil(e?.techniqueCuesZh)
        XCTAssertNil(e?.evidenceTag)
        XCTAssertNil(e?.evidenceUrl)
        // 退阶/进阶/安全注意同属加性展示字段，长尾未填动作应全 nil（零回归）。
        // 故意跨语言抽查（regression 查 Zh、progression 查 En）；另一半由
        // testScalingAndSafetyAreBilingualAndCovered 的中英成对约束覆盖。
        XCTAssertNil(e?.regressionZh)
        XCTAssertNil(e?.progressionEn)
        XCTAssertNil(e?.safetyNoteZh)
    }
}
