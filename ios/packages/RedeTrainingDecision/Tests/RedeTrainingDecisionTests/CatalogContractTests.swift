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
    /// MVP 四类（machine = plate-loaded/selectorized 合并档，P1 拆分为规格 9 类）。
    private let knownEquipment: Set<String> = ["barbell", "dumbbell", "cable", "machine"]
    private let knownKinds: Set<String> = ["compound", "isolation", "machine"]
    private let knownMuscles: Set<String> = [
        "chest", "back", "shoulder", "front-delt", "side-delt", "rear-delt", "upper-back",
        "biceps", "triceps", "forearm", "quads", "hamstrings", "glutes", "calves",
        "core", "lower-back",
    ]

    // MARK: - 解码完整性

    func testBundledCatalogIntegrity() {
        XCTAssertEqual(catalog.catalogVersion, "mvp-1")
        XCTAssertEqual(catalog.entries.count, 31)
        // id 唯一 + 永生合同的前半（唯一）；rank 唯一保证匹配全序确定
        XCTAssertEqual(Set(catalog.entries.map(\.id)).count, 31, "id 重复")
        XCTAssertEqual(Set(catalog.entries.map(\.rank)).count, 31, "rank 重复——匹配次序歧义")
        // 锚点：迁移自原数组的首尾条目
        XCTAssertEqual(catalog.entry(id: "bench-press")?.rank, 0)
        XCTAssertEqual(catalog.entry(id: "bench-press")?.startWeightKg, 60)
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
        }
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
                kind: entry.kind, substitutionGroup: entry.substitutionGroup,
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
        // 已知缺口清单（P1 填充目标 = 清空；与内容系统文档 §3 同步）。
        // 后两条是本测试首跑当场抓到的（人工推演两轮都漏）：推力/拉力日的
        // 第二容量槽（同 pattern 第二动作）家用场景无第二个哑铃候选。
        let knownGaps: Set<String> = [
            "home-dumbbell|legs-a|knee-flexion", "home-dumbbell|lower|knee-flexion",
            "home-dumbbell|push-a|horizontal-press", "home-dumbbell|pull-a|horizontal-pull",
        ]
        var found: Set<String> = []
        let scenarios: [(String?, String)] = [(nil, "commercial"), ("home-dumbbell", "home-dumbbell")]
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
