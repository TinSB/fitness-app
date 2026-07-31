// 最小动作 catalog（PRD 开放决策 #1 拍板：几十个、宁可少而准）。
// catalog 是动作事实唯一权威（系统逻辑 §6.1）；展示名归 RedeL10n（引擎零文案）。

import XCTest
@testable import RedeTrainingDecision

final class ExerciseCatalogTests: XCTestCase {
    /// 循证来源批准域名（owner「真实循证」政策的机器化形态，W3 2026-07-31）。
    /// A 档 同行评审：PubMed/PMC 索引页、期刊自有站点与学术托管平台。
    /// B 档 权威认证机构动作库：ACE / NSCA / NASM（机构编审的技术指引）。
    /// ⛔ 新增来源前先问：它是不是机构编审或同行评审？个人博客（含知名教练本人站点）、
    ///    内容农场、掠夺性期刊一律不进此表——tag 写得像期刊不代表 URL 就是期刊。
    static let approvedEvidenceHosts = [
        // A 档：索引库与期刊/学术托管
        "pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov",
        "journals.lww.com",            // Lippincott（JSCR 等）
        "www.jssm.org",                // J Sports Sci Med（开放获取，PubMed 收录）
        "www.jstage.jst.go.jp",        // J-STAGE（日本学术平台）
        "www.scielo.br",               // SciELO（拉美学术平台）
        "aquila.usm.edu",              // 南密西西比大学机构库
        "ojs.ub.uni-konstanz.de",      // 康斯坦茨大学托管的 ISBS 会议论文集
        // B 档：权威认证机构
        "www.acefitness.org", "www.nsca.com", "www.nasm.org",
    ]

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
        var cuedZhCount = 0
        var cuedEnCount = 0
        for e in ExerciseCatalog.minimal.entries {
            if e.techniqueCuesZh != nil { cuedZhCount += 1 }
            if let en = e.techniqueCuesEn {
                cuedEnCount += 1
                XCTAssertFalse(en.isEmpty, "\(e.id) techniqueCuesEn 空")
                XCTAssertEqual(e.techniqueCuesZh?.count, en.count, "\(e.id) 中英要点条数不一致")
            }
            if let tag = e.evidenceTag {
                XCTAssertFalse(tag.isEmpty, "\(e.id) evidenceTag 空")
                XCTAssertEqual(e.evidenceUrl?.hasPrefix("https://"), true, "\(e.id) 循证 URL 非 https")
            }
            if let url = e.evidenceUrl {
                XCTAssertNotNil(e.evidenceTag, "\(e.id) 有 evidenceUrl 却无 evidenceTag（孤立 URL）")
                // W3（2026-07-31）：把「两档来源」政策从注释升级为机器守卫。此前只靠人读注释，
                // hip-thrust 曾挂作者个人博客（bretcontreras.com）而 tag 却声称期刊，逃过了所有测试。
                XCTAssertTrue(
                    Self.approvedEvidenceHosts.contains { url.contains($0) },
                    "\(e.id) 循证来源域名不在批准清单内（个人博客/内容农场/掠夺性期刊一律拒）：\(url)"
                )
            }
        }
        // W1（2026-07-21）把目录 165/165 补齐：中英技术要点、退阶与进阶均是全量目录契约，
        // 不得退回此前 93 条的分批覆盖状态。
        // W3（2026-07-31）：循证来源由 67 → 145（78 条经 curl 200 + NCBI E-utilities
        // 标题/首作者/年份三项核对）；20 条查无合格来源者诚实留空，绝不为覆盖率硬凑。
        var evidenceCount = 0
        for e in ExerciseCatalog.minimal.entries where e.evidenceTag != nil { evidenceCount += 1 }
        XCTAssertGreaterThanOrEqual(evidenceCount, 140, "循证覆盖不得退回分批状态（W3 实际 145，留余量）")
        XCTAssertEqual(cuedZhCount, 165, "中文技术要点必须覆盖全部 165 个动作")
        XCTAssertEqual(cuedEnCount, 165, "英文技术要点必须覆盖全部 165 个动作")
    }

    // FR-EX2 退阶/进阶 + 注意事项（§7.1）批次无关不变量：
    //  - 退阶/进阶/安全注意三组字段各自中英成对（缺则两边都缺，绝不单边露原始码）；
    //  - 全部 165 个动作的退阶/进阶均须中英齐全（W1 2026-07-21）；
    //  - 安全注意只给有风险的动作（≥40），低风险动作 nil（诚实不臆造风险，§7.1）。
    func testScalingAndSafetyAreBilingualAndCovered() {
        var regressionZhCount = 0, regressionEnCount = 0
        var progressionZhCount = 0, progressionEnCount = 0
        var safe = 0
        for e in ExerciseCatalog.minimal.entries {
            XCTAssertEqual(e.regressionZh == nil, e.regressionEn == nil, "\(e.id) 退阶中英不成对")
            XCTAssertEqual(e.progressionZh == nil, e.progressionEn == nil, "\(e.id) 进阶中英不成对")
            XCTAssertEqual(e.safetyNoteZh == nil, e.safetyNoteEn == nil, "\(e.id) 安全注意中英不成对")
            // 退阶与进阶配对出现（要么都有、要么都无；不单给一边）
            XCTAssertEqual(e.regressionZh == nil, e.progressionZh == nil, "\(e.id) 退阶/进阶未配对")
            if e.regressionZh != nil { regressionZhCount += 1 }
            if e.regressionEn != nil { regressionEnCount += 1 }
            if e.progressionZh != nil { progressionZhCount += 1 }
            if e.progressionEn != nil { progressionEnCount += 1 }
            if e.safetyNoteZh != nil { safe += 1 }
            // 有要点的动作应已补退阶/进阶（同批；防止漏填）
            if e.techniqueCuesEn != nil {
                XCTAssertNotNil(e.regressionZh, "\(e.id) 有技术要点却缺退阶/进阶")
            }
            // 安全注意不得做成孤立空串
            if let s = e.safetyNoteZh { XCTAssertFalse(s.isEmpty, "\(e.id) safetyNoteZh 空") }
        }
        XCTAssertEqual(regressionZhCount, 165, "中文退阶必须覆盖全部 165 个动作")
        XCTAssertEqual(regressionEnCount, 165, "英文退阶必须覆盖全部 165 个动作")
        XCTAssertEqual(progressionZhCount, 165, "中文进阶必须覆盖全部 165 个动作")
        XCTAssertEqual(progressionEnCount, 165, "英文进阶必须覆盖全部 165 个动作")
        XCTAssertGreaterThanOrEqual(safe, 55, "安全注意应覆盖有风险的动作（实际 60；留小余量防降级）")
    }

    // 诚实红线（W3 2026-07-31 升级，原意图不变）：当年拒的是**来源**——front-squat 曾挂
    // CrossFit.com（非证据级），故只留技术要点。W3 检索到真正的同行评审直接研究
    // （Gullett et al., JSCR 2009「A biomechanical comparison of back and front squats」，
    // PubMed 19002072，经 NCBI E-utilities 核对标题/首作者/期刊/年份），符合 A 档政策，故升级挂上。
    // 守卫改为「必须是 A/B 档域名」而不是「必须为空」——防的是重新挂回博客/内容农场类来源。
    func testFrontSquatEvidenceIsInstitutionalOrPeerReviewed() {
        let e = ExerciseCatalog.minimal.entry(id: "front-squat")
        XCTAssertEqual(e?.techniqueCuesEn?.isEmpty, false, "front-squat 应有技术要点")
        let url = e?.evidenceUrl
        XCTAssertNotNil(url, "front-squat 已有 A 档来源")
        let allowed = ["pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov",
                       "acefitness.org", "nsca.com", "nasm.org"]
        XCTAssertTrue(
            allowed.contains { url?.contains($0) == true },
            "front-squat 循证来源必须是同行评审或权威机构，绝不可退回 CrossFit/博客类来源：\(url ?? "nil")"
        )
    }

    // 内容波 W1/W2：无循证来源不等于无动作特异风险；安全注意仍须按风险判断，绝不借此伪造 evidence。
    // W3（2026-07-31）：原样例 db-pullover 已检索到 ACE 机构动作库来源，改用仍无可核验来源的
    // arnold-press 承载同一不变量（它当年因 IJPHRD 掠夺性期刊被降级，至今无合格来源）。
    func testCuedExerciseKeepsEvidenceEmptyWhileSafetyCanBeRiskSpecific() {
        let e = ExerciseCatalog.minimal.entry(id: "arnold-press")
        XCTAssertNotNil(e, "样例动作应存在")
        XCTAssertEqual(e?.techniqueCuesEn?.isEmpty, false)
        XCTAssertEqual(e?.techniqueCuesZh?.isEmpty, false)
        XCTAssertEqual(e?.techniqueCuesEn?.count, e?.techniqueCuesZh?.count)
        XCTAssertNotNil(e?.regressionZh)
        XCTAssertNotNil(e?.progressionEn)
        XCTAssertNil(e?.evidenceTag)
        XCTAssertNil(e?.evidenceUrl)
        XCTAssertNotNil(e?.safetyNoteZh)
        XCTAssertNotNil(e?.safetyNoteEn)
    }
}
