// 内容系统 P0 合同（docs/REDE_EXERCISE_CONTENT_SYSTEM.md，拍板 2026-06-11）：
// 目录是数据，合同靠测试看守——解码完整性 / 注册表封闭 / 名字全覆盖 /
// rank 去顺序化 / 覆盖矩阵 golden（FR-EQ1 教训制度化）。
// 几百动作填充期（P1 waves），每个 wave 必须全绿通过本文件。

import Foundation
import XCTest
@testable import RedeTrainingDecision

final class CatalogContractTests: XCTestCase {
    private let catalog = ExerciseCatalog.minimal

    // MARK: - 注册表（封闭集合：写错拼写 = 当场红）

    private let knownPatterns: Set<String> = [
        "horizontal-press", "incline-press", "fly", "vertical-pull", "horizontal-pull",
        "rear-delt", "vertical-press", "lateral-raise", "curl", "triceps-extension",
        "squat-pattern", "hinge", "knee-flexion", "calf-raise",
    ]
    /// 器械类注册表已升运行时单一真源（EquipmentRegistry，§6.1）——测试直接引用，
    /// 不再各抄一份字面量。
    private let knownEquipment = EquipmentRegistry.allClasses
    /// 训练学角色（Blocker schema PR：machine 改名 accessory，器械语义剥离给 isGuided）。
    private let knownKinds: Set<String> = ["compound", "isolation", "accessory"]
    private let knownMuscles: Set<String> = [
        "chest", "back", "shoulder", "front-delt", "side-delt", "rear-delt", "upper-back",
        "biceps", "triceps", "forearm", "quads", "hamstrings", "glutes", "calves",
        "core", "lower-back",
    ]

    // MARK: - 解码完整性

    func testBundledCatalogIntegrity() {
        XCTAssertEqual(catalog.catalogVersion, "wave-2.1")
        XCTAssertEqual(catalog.entries.count, 49)
        // id 唯一 + 永生合同的前半（唯一）；rank 唯一保证匹配全序确定
        XCTAssertEqual(Set(catalog.entries.map(\.id)).count, 49, "id 重复")
        XCTAssertEqual(Set(catalog.entries.map(\.rank)).count, 49, "rank 重复——匹配次序歧义")
        // 锚点：迁移自原数组的首尾条目
        XCTAssertEqual(catalog.entry(id: "bench-press")?.rank, 0)
        XCTAssertEqual(catalog.entry(id: "bench-press")?.startWeightKg, 60)
        // 吨位系数锚点（owner 拍板 B 案 + 终审 2026-06-11）：杠铃=1、双哑铃=2、
        // 单哑铃双手持=1、单侧动作=1（owner 惯例「一组=单边」）
        XCTAssertEqual(catalog.entry(id: "bench-press")?.loadFactor, 1.0)
        XCTAssertEqual(catalog.entry(id: "db-bench-press")?.loadFactor, 2.0)
        XCTAssertEqual(catalog.entry(id: "goblet-squat")?.loadFactor, 1.0)
        XCTAssertEqual(catalog.entry(id: "one-arm-db-row")?.loadFactor, 1.0)
        XCTAssertNotNil(catalog.entry(id: "db-calf-raise"))
    }

    func testEveryEntryPassesRegistries() {
        for entry in catalog.entries {
            XCTAssertTrue(knownPatterns.contains(entry.movementPattern), "未知 pattern: \(entry.id) → \(entry.movementPattern)")
            XCTAssertTrue(knownEquipment.contains(entry.equipment), "未知器械: \(entry.id) → \(entry.equipment)")
            XCTAssertTrue(knownKinds.contains(entry.kind), "未知 kind: \(entry.id) → \(entry.kind)")
            XCTAssertTrue(knownMuscles.contains(entry.primaryMuscle), "未知主肌群: \(entry.id) → \(entry.primaryMuscle)")
            for muscle in entry.secondaryMuscles {
                XCTAssertTrue(knownMuscles.contains(muscle), "未知次肌群: \(entry.id) → \(muscle)")
            }
            XCTAssertGreaterThan(entry.startWeightKg, 0, "起步重量非法: \(entry.id)")
            XCTAssertFalse(entry.substitutionGroup.isEmpty, "替代族缺失: \(entry.id)")
            // §6.1 Blocker 字段合同
            XCTAssertTrue(EquipmentRegistry.loadTypes.contains(entry.loadType), "未知负重语义: \(entry.id) → \(entry.loadType)")
            XCTAssertGreaterThan(entry.progressionStepKg, 0, "渐进步长非法: \(entry.id)")
            // §6.2：替代族数组首元素=主族；吨位系数 ∈ [1,2]（双哑铃=2，其余=1）
            XCTAssertFalse(entry.substitutionGroups.isEmpty, "替代族数组空: \(entry.id)")
            XCTAssertFalse(entry.substitutionGroups[0].isEmpty, "主族空串: \(entry.id)")
            XCTAssertTrue((1.0...2.0).contains(entry.loadFactor), "吨位系数越界: \(entry.id) → \(entry.loadFactor)")
            if let key = entry.progressionKey {
                XCTAssertNotNil(catalog.entry(id: key), "progressionKey 指向不存在的 id: \(entry.id) → \(key)")
            }
            // machine 拆分（2026-06-11）：合并档 "machine" 退役，guided 事实
            // 必须与器械类成员资格自洽（guided ⇒ 固定器械类）
            XCTAssertNotEqual(entry.equipment, "machine", "合并档已拆分: \(entry.id)")
            if entry.isGuided {
                XCTAssertTrue(EquipmentRegistry.machineClasses.contains(entry.equipment),
                              "guided 条目必须属固定器械类: \(entry.id) → \(entry.equipment)")
            }
            if let successor = entry.replacedBy {
                XCTAssertNotNil(catalog.entry(id: successor), "replacedBy 指向不存在的 id: \(entry.id) → \(successor)")
                XCTAssertTrue(entry.deprecated, "未弃用条目不得有继任指针: \(entry.id)")
            }
        }
    }

    /// 场景矩阵合同：键必须是 DataHealth 已知场景（跨包字面量合同，builder 同步改）；
    /// 值必须是注册表内器械类——「填了动作却被白名单滤掉」从此编译期外的第一道闸。
    func testScenarioAccessMatrixIsWellFormed() {
        let knownScenarios: Set<String> = ["commercial-gym", "home-dumbbell", "minimal"]
        for (scenario, classes) in EquipmentRegistry.scenarioAccess {
            XCTAssertTrue(knownScenarios.contains(scenario), "未知场景: \(scenario)")
            XCTAssertFalse(classes.isEmpty, "场景白名单空集 = 用户无任何可练动作: \(scenario)")
            XCTAssertTrue(classes.isSubset(of: EquipmentRegistry.allClasses), "白名单含未注册器械类: \(scenario)")
        }
        XCTAssertTrue(EquipmentRegistry.machineClasses.isSubset(of: EquipmentRegistry.allClasses))
        XCTAssertTrue(EquipmentRegistry.prescribableLoadTypes.isSubset(of: EquipmentRegistry.loadTypes))
        // EquipmentAccess 必须从注册表派生（不许再长出第二份硬编码表）
        XCTAssertEqual(EquipmentAccess.allowed(for: "home-dumbbell"), EquipmentRegistry.scenarioAccess["home-dumbbell"])
        XCTAssertEqual(EquipmentAccess.allowed(for: "minimal"), EquipmentRegistry.scenarioAccess["minimal"])
        XCTAssertNil(EquipmentAccess.allowed(for: "commercial-gym"))
        XCTAssertNil(EquipmentAccess.allowed(for: nil))
    }

    // MARK: - §6.1 行为合同：步长真被消费、loadType 真挡门

    /// 把 lateral-raise 步长改 1.25：渐进 +一档必须是 +1.25 而不是全局 2.5。
    func testPerEntryStepDrivesProgression() throws {
        let entries = catalog.entries.map { entry -> ExerciseCatalogEntry in
            guard entry.id == "lateral-raise" else { return entry }
            return amendedCopy(entry, progressionStepKg: 1.25)
        }
        let amended = ExerciseCatalog(catalogVersion: "test", entries: entries)
        // 3 场历史（隔天，DataHealth 要求 id + completed）→ 今天轮回 push-a
        // （含 lateral-raise）；上次 7.5kg 全组打满 repMax(20)、RIR 充足 → +一档
        let sessions = ["2026-06-04", "2026-06-06", "2026-06-08"].enumerated().map { index, date in
            #"{"id": "s\#(index)", "date": "\#(date)", "completed": true, "exercises": [{"exerciseId": "lateral-raise", "sets": [{"weight": 7.5, "reps": 20, "rir": 2}, {"weight": 7.5, "reps": 20, "rir": 2}]}]}"#
        }
        let appDataJSON = #"{"schemaVersion": 8, "history": [\#(sessions.joined(separator: ","))], "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 5}}"#
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: "2026-06-11")
        let plan = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)
        let lateral = plan?.exercises.first { $0.exerciseId == "lateral-raise" }
        XCTAssertEqual(lateral?.targetWeightKg, 8.75, "步长 1.25 的加重必须是 7.5+1.25")
        XCTAssertEqual(lateral?.progressionStepKg, 1.25, "步长必须随处方透传")
        // 对照：步长 2.5 的原目录加到 10
        let baseline = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: catalog)
        XCTAssertEqual(baseline?.exercises.first { $0.exerciseId == "lateral-raise" }?.targetWeightKg, 10)
    }

    /// 组内安全瀑布的回退一档同样吃计划步长（疼痛上报 → −1.25 不是 −2.5）。
    func testNextSetEaseUsesPlanStep() {
        let plan = ExerciseSetPlan(
            exerciseId: "lateral-raise", restSeconds: 60, repLowerBound: 12, repUpperBound: 20,
            stepKg: 1.25,
            sets: (1...3).map { PlannedSet(index: $0, targetWeightKg: 7.5, targetReps: 15, targetRir: 2) }
        )
        let done = [CompletedSetObservation(weightKg: 7.5, reps: 15, rir: 2, painReported: true)]
        let rec = NextSetEngine.recommend(plan: plan, completed: done)
        XCTAssertEqual(rec?.targetWeightKg, 6.25, "疼痛回退一档 = 计划步长 1.25")
    }

    /// 非 external 负重语义（自重/辅助/弹力带）在引擎支持落地前禁入处方与替换：
    /// 注入一个 rank 必胜的 bodyweight 条目，它必须被挡在门外。
    func testNonExternalLoadTypeBlockedFromPrescriptionAndCandidates() throws {
        let pushUp = ExerciseCatalogEntry(
            id: "push-up", nameZh: "俯卧撑", nameEn: "Push-up",
            movementPattern: "horizontal-press", primaryMuscle: "chest",
            equipment: "dumbbell",   // 故意给白名单内器械：必须死在 loadType 闸而非器械闸
            kind: "compound", substitutionGroups: ["chest-press"], startWeightKg: 2.5,
            loadType: "bodyweight", rank: -10
        )
        let amended = ExerciseCatalog(catalogVersion: "test", entries: [pushUp] + catalog.entries)
        let appDataJSON = #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 5}}"#
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: "2026-06-11")
        let plan = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)
        XCTAssertFalse(plan?.exercises.map(\.exerciseId).contains("push-up") ?? true,
                       "bodyweight 条目在 loadType 支持前不得进处方（rank -10 本应必胜）")
        XCTAssertFalse(ExerciseReplacementEngine.candidates(for: "bench-press", catalog: amended).contains("push-up"),
                       "bodyweight 条目不得进替换候选")
    }

    private func amendedCopy(_ entry: ExerciseCatalogEntry, progressionStepKg: Double) -> ExerciseCatalogEntry {
        ExerciseCatalogEntry(
            id: entry.id, nameZh: entry.nameZh, nameEn: entry.nameEn,
            movementPattern: entry.movementPattern, primaryMuscle: entry.primaryMuscle,
            secondaryMuscles: entry.secondaryMuscles, equipment: entry.equipment,
            kind: entry.kind, substitutionGroups: entry.substitutionGroups,
            startWeightKg: entry.startWeightKg, loadType: entry.loadType,
            progressionStepKg: progressionStepKg,
            loadFactor: entry.loadFactor, progressionKey: entry.progressionKey,   // 审查 N1：复制语义完整
            isGuided: entry.isGuided,
            rank: entry.rank, deprecated: entry.deprecated
        )
    }

    func testEveryEntryHasBothNames() {
        for entry in catalog.entries {
            XCTAssertFalse(entry.nameZh.isEmpty, "zh 名缺失: \(entry.id)")
            XCTAssertFalse(entry.nameEn.isEmpty, "en 名缺失: \(entry.id)")
        }
    }

    func testDisplayNameResolvesAndFallsBack() {
        XCTAssertEqual(catalog.displayName("bench-press", localeCode: "zh"), "平板卧推")
        XCTAssertEqual(catalog.displayName("bench-press", localeCode: "en"), "Bench press")
        XCTAssertEqual(catalog.displayName("no-such-id", localeCode: "zh"), "no-such-id")
    }

    // MARK: - 去顺序化：文件顺序不是合同，rank 才是

    func testMatchingIsOrderIndependent() throws {
        let appDataJSON = #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 5}}"#
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: "2026-06-11")
        let verdict = TodayVerdictEngine.evaluate(input)
        let bundled = TodayPrescriptionEngine.plan(input: input, verdict: verdict, catalog: catalog)
        let shuffled = ExerciseCatalog(catalogVersion: catalog.catalogVersion, entries: catalog.entries.shuffled())
        let fromShuffled = TodayPrescriptionEngine.plan(input: input, verdict: verdict, catalog: shuffled)
        XCTAssertEqual(bundled?.exercises.map(\.exerciseId), fromShuffled?.exercises.map(\.exerciseId))
        // 换动作候选同样去顺序化
        XCTAssertEqual(
            ExerciseReplacementEngine.candidates(for: "bench-press", catalog: catalog),
            ExerciseReplacementEngine.candidates(for: "bench-press", catalog: shuffled)
        )
    }

    func testDeprecatedEntryExcludedFromMatchingButResolvable() throws {
        // 弃用 bench-press：匹配跳过它（horizontal-press 槽落到下一 rank），名字仍可解析
        let entries = catalog.entries.map { entry -> ExerciseCatalogEntry in
            guard entry.id == "bench-press" else { return entry }
            return ExerciseCatalogEntry(
                id: entry.id, nameZh: entry.nameZh, nameEn: entry.nameEn,
                movementPattern: entry.movementPattern, primaryMuscle: entry.primaryMuscle,
                secondaryMuscles: entry.secondaryMuscles, equipment: entry.equipment,
                kind: entry.kind, substitutionGroups: entry.substitutionGroups,
                startWeightKg: entry.startWeightKg, rank: entry.rank, deprecated: true
            )
        }
        let amended = ExerciseCatalog(catalogVersion: "test", entries: entries)
        let appDataJSON = #"{"schemaVersion": 8, "programTemplate": {"splitType": "push-pull-legs", "daysPerWeek": 5}}"#
        let input = try TestSupport.makeInput(appDataJSON: appDataJSON, todayISO: "2026-06-11")
        let plan = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input), catalog: amended)
        XCTAssertFalse(plan?.exercises.map(\.exerciseId).contains("bench-press") ?? true)
        // 审查 M3：换动作候选路径同样排除 deprecated
        XCTAssertFalse(ExerciseReplacementEngine.candidates(for: "db-bench-press", catalog: amended).contains("bench-press"))
        XCTAssertEqual(amended.displayName("bench-press", localeCode: "zh"), "平板卧推") // 历史解析永生
    }

    // MARK: - 覆盖矩阵 golden（FR-EQ1 制度化：新增缺口 = 红）

    func testCoverageMatrixMatchesKnownGaps() throws {
        // 已知缺口清单（与内容系统文档 §3 同步）。P0 首跑抓到 4 条
        // （home-dumbbell 的 knee-flexion×2 / push-a 第二平推 / pull-a 第二划船），
        // wave-1（2026-06-11）以 db-leg-curl / db-floor-press /
        // chest-supported-db-row 三条全部清空。新增缺口 = 红。
        let knownGaps: Set<String> = []
        var found: Set<String> = []
        let scenarios: [(String?, String)] = [
            (nil, "commercial"), ("home-dumbbell", "home-dumbbell"),
            ("minimal", "minimal"),   // 审查 M-2：与 home 同白名单也独立进矩阵（防场景投影漂移）
        ]
        let days: [(String, String, Int)] = [ // (split, 期望 dayCode, 所需历史场数)
            ("push-pull-legs", "push-a", 0), ("push-pull-legs", "pull-a", 1), ("push-pull-legs", "legs-a", 2),
            ("upper-lower", "upper", 0), ("upper-lower", "lower", 1),
        ]
        for (scenario, label) in scenarios {
            for (split, dayCode, sessions) in days {
                let dates = (0..<sessions).map { "2026-06-0\($0 + 1)" }
                var parts = [
                    "\"schemaVersion\": 8",
                    "\"history\": \(TestSupport.historyJSON(dates: dates))",
                    #""programTemplate": {"splitType": "\#(split)", "daysPerWeek": 5}"#,
                ]
                if let scenario { parts.append(#""userProfile": {"equipmentScenario": "\#(scenario)"}"#) }
                let input = try TestSupport.makeInput(appDataJSON: "{" + parts.joined(separator: ", ") + "}", todayISO: "2026-06-11")
                guard let plan = TodayPrescriptionEngine.plan(input: input, verdict: TodayVerdictEngine.evaluate(input)) else { continue }
                XCTAssertEqual(plan.dayCode, dayCode)
                for reason in plan.dayReasons {
                    if case .slotUnfilled(let pattern) = reason {
                        found.insert("\(label)|\(dayCode)|\(pattern)")
                    }
                }
            }
        }
        XCTAssertEqual(found, knownGaps, "覆盖矩阵变化——新增缺口必须先登记进内容系统文档的已知缺口清单")
    }
}
