// SchemaMigrator 合同（系统逻辑 §6.5；schema-migration-guard）。
// 守的不只是「能升级」，更是「纯加性、幂等、可逆、不伪造未知版本」——
// 这是唯一会静默毁数据的环节，回归保护按守卫五项逐条钉死。

import XCTest
import RedeDomain

final class SchemaMigratorTests: XCTestCase {

    // MARK: 升级 8 → 9（纯加性）

    func testMigrateBumpsEightToNineAndSeedsMesocycle() {
        let root: [String: JSONValue] = [
            "schemaVersion": .int(8),
            "history": .array([]),
        ]
        let out = SchemaMigrator.migrate(root: root)
        XCTAssertEqual(out["schemaVersion"]?.asInt, SchemaVersion.current, "升到 current（8→9→10）")
        let meso = out["mesocycle"]?.asObject
        XCTAssertEqual(meso?["enabled"]?.asBool, false, "默认关闭 = 零回归")
        XCTAssertEqual(meso?["blockLengthWeeks"]?.asInt, 4, "4 周块落库")
        XCTAssertNil(meso?["currentWeek"], "不存当前第几周（永远现算）")
    }

    func testMigrateIsAdditivePreservesAllExistingKeys() {
        let root: [String: JSONValue] = [
            "schemaVersion": .int(8),
            "history": .array([.object(["id": .string("s1")])]),
            "userProfile": .object(["trainingLevel": .string("intermediate")]),
            "unknownFutureKey": .string("keep-me"),
        ]
        let out = SchemaMigrator.migrate(root: root)
        // 既有键一字不动（只多了 mesocycle + 版本号抬升）
        XCTAssertEqual(out["history"], root["history"])
        XCTAssertEqual(out["userProfile"], root["userProfile"])
        XCTAssertEqual(out["unknownFutureKey"], root["unknownFutureKey"], "open-bag 未知字段不丢")
    }

    func testMigrateDoesNotOverwriteExistingMesocycle() {
        // 防御：若 root 已带 mesocycle（理论上 schema-8 不会有），只抬版本、不覆盖配置。
        let root: [String: JSONValue] = [
            "schemaVersion": .int(8),
            "mesocycle": .object(["enabled": .bool(true), "blockLengthWeeks": .int(6)]),
        ]
        let out = SchemaMigrator.migrate(root: root)
        XCTAssertEqual(out["schemaVersion"]?.asInt, SchemaVersion.current)
        XCTAssertEqual(out["mesocycle"]?.asObject?["enabled"]?.asBool, true, "不覆盖既有 enabled")
        XCTAssertEqual(out["mesocycle"]?.asObject?["blockLengthWeeks"]?.asInt, 6, "不覆盖既有块长")
    }

    func testMigrateIsIdempotent() {
        let root: [String: JSONValue] = ["schemaVersion": .int(8), "history": .array([])]
        let once = SchemaMigrator.migrate(root: root)
        let twice = SchemaMigrator.migrate(root: once)
        XCTAssertEqual(once, twice, "二次迁移无副作用（已是 current 即 no-op）")
    }

    // MARK: 升级 9 → 10（5 天 push-pull-legs → ppl-ul，值变换 + 可逆）

    func testMigrateRemapsFiveDayPplToPplUl() {
        let root: [String: JSONValue] = [
            "schemaVersion": .int(9),
            "programTemplate": .object([
                "splitType": .string("push-pull-legs"),
                "daysPerWeek": .int(5),
                "primaryGoal": .string("hypertrophy"),
            ]),
        ]
        let out = SchemaMigrator.migrate(root: root)
        XCTAssertEqual(out["schemaVersion"]?.asInt, SchemaVersion.current)
        XCTAssertEqual(out["programTemplate"]?.asObject?["splitType"]?.asString, "ppl-ul", "5 天 PPL → ppl-ul")
        XCTAssertEqual(out["programTemplate"]?.asObject?["daysPerWeek"]?.asInt, 5, "天数不动")
        XCTAssertEqual(out["programTemplate"]?.asObject?["primaryGoal"]?.asString, "hypertrophy", "其余字段不动")
    }

    func testMigrateLeavesSixDayPplAndOtherSplitsUntouched() {
        let sixDay: [String: JSONValue] = [
            "schemaVersion": .int(9),
            "programTemplate": .object(["splitType": .string("push-pull-legs"), "daysPerWeek": .int(6)]),
        ]
        XCTAssertEqual(SchemaMigrator.migrate(root: sixDay)["programTemplate"]?.asObject?["splitType"]?.asString,
                       "push-pull-legs", "6 天 PPL 不重映")
        let upperLower: [String: JSONValue] = [
            "schemaVersion": .int(9),
            "programTemplate": .object(["splitType": .string("upper-lower"), "daysPerWeek": .int(5)]),
        ]
        XCTAssertEqual(SchemaMigrator.migrate(root: upperLower)["programTemplate"]?.asObject?["splitType"]?.asString,
                       "upper-lower", "非 PPL 不动")
        // 审查 MINOR-3：daysPerWeek 缺失（nil）时不得误触发重映（仅 ==5 才命中）。
        let missingDays: [String: JSONValue] = [
            "schemaVersion": .int(9),
            "programTemplate": .object(["splitType": .string("push-pull-legs")]),
        ]
        XCTAssertEqual(SchemaMigrator.migrate(root: missingDays)["programTemplate"]?.asObject?["splitType"]?.asString,
                       "push-pull-legs", "daysPerWeek 缺失 → 不重映")
        // daysPerWeek 为浮点（非 .int(5)）同样不命中——只认整数 5。
        let floatDays: [String: JSONValue] = [
            "schemaVersion": .int(9),
            "programTemplate": .object(["splitType": .string("push-pull-legs"), "daysPerWeek": .double(5.0)]),
        ]
        XCTAssertEqual(SchemaMigrator.migrate(root: floatDays)["programTemplate"]?.asObject?["splitType"]?.asString,
                       "push-pull-legs", "daysPerWeek 浮点 → 不重映（asInt 仅认整数）")
    }

    func testDownMigrateReversesPplUlRemap() {
        // 9→10 重映 round-trip：5 天 PPL@9 → up → ppl-ul@10 → down(to:9) → push-pull-legs@9（恒等）。
        let original: [String: JSONValue] = [
            "schemaVersion": .int(9),
            "mesocycle": .object(["enabled": .bool(false), "blockLengthWeeks": .int(4)]),
            "programTemplate": .object(["splitType": .string("push-pull-legs"), "daysPerWeek": .int(5)]),
        ]
        let up = SchemaMigrator.migrate(root: original)
        XCTAssertEqual(up["programTemplate"]?.asObject?["splitType"]?.asString, "ppl-ul")
        let down = SchemaMigrator.downMigrate(root: up, to: 9)
        XCTAssertEqual(down, original, "downMigrate(migrate(x), to:9) == x（9↔10 可逆）")
    }

    // MARK: 不迁移的边界（绝不伪造）

    func testMigrateLeavesCurrentVersionUnchanged() {
        let root: [String: JSONValue] = ["schemaVersion": .int(Int64(SchemaVersion.current)), "history": .array([])]
        XCTAssertEqual(SchemaMigrator.migrate(root: root), root, "已是 current → 原样返回")
    }

    func testMigrateLeavesUnsupportedOlderVersionUnchanged() {
        // schema-7 无迁移路径 → 保持 7（交给 validate 报 upgradeRequired），不凭空升级。
        let root: [String: JSONValue] = ["schemaVersion": .int(7)]
        XCTAssertEqual(SchemaMigrator.migrate(root: root), root)
    }

    func testMigrateLeavesFutureVersionUnchanged() {
        let root: [String: JSONValue] = ["schemaVersion": .int(Int64(SchemaVersion.current + 1))]
        XCTAssertEqual(SchemaMigrator.migrate(root: root), root, "未来版本不静默吞下")
    }

    func testMigrateLeavesMissingVersionUnchanged() {
        let root: [String: JSONValue] = ["history": .array([])]
        XCTAssertEqual(SchemaMigrator.migrate(root: root), root, "版本缺失 → 不迁移，交给 validate 报 .missing")
    }

    // MARK: 可逆 down-migrate（往返恒等）

    func testDownMigrateReversesMigrate() {
        // schema-8 原始 root（无 mesocycle）经 up→down 应精确还原。
        let original: [String: JSONValue] = [
            "schemaVersion": .int(8),
            "history": .array([.object(["id": .string("s1")])]),
            "userProfile": .object(["trainingLevel": .string("advanced")]),
        ]
        let up = SchemaMigrator.migrate(root: original)
        let down = SchemaMigrator.downMigrate(root: up)
        XCTAssertEqual(down, original, "downMigrate(migrate(x)) == x（可逆）")
    }

    func testDownMigrateDropsMesocycleAndLowersVersion() {
        let nine: [String: JSONValue] = [
            "schemaVersion": .int(9),
            "mesocycle": .object(["enabled": .bool(false), "blockLengthWeeks": .int(4)]),
            "history": .array([]),
        ]
        let down = SchemaMigrator.downMigrate(root: nine)
        XCTAssertEqual(down["schemaVersion"]?.asInt, 8)
        XCTAssertNil(down["mesocycle"], "9→8 去 mesocycle")
        XCTAssertEqual(down["history"], nine["history"], "其余键保留")
    }

    func testDownMigrateAtOrBelowTargetIsNoOp() {
        let eight: [String: JSONValue] = ["schemaVersion": .int(8), "history": .array([])]
        XCTAssertEqual(SchemaMigrator.downMigrate(root: eight), eight)
    }

    // MARK: dry-run 报告

    func testPlanReportsEightToNine() {
        let plan = SchemaMigrator.plan(root: ["schemaVersion": .int(8)])
        XCTAssertEqual(plan.from, 8)
        XCTAssertEqual(plan.to, SchemaVersion.current)
        XCTAssertTrue(plan.addsMesocycle)
        XCTAssertTrue(plan.needsMigration)
    }

    func testPlanReportsNoMigrationAtCurrent() {
        let plan = SchemaMigrator.plan(root: ["schemaVersion": .int(Int64(SchemaVersion.current))])
        XCTAssertFalse(plan.needsMigration)
        XCTAssertFalse(plan.addsMesocycle)
    }

    func testPlanReportsMissingVersionAsNoMigration() {
        let plan = SchemaMigrator.plan(root: ["history": .array([])])
        XCTAssertNil(plan.from)
        XCTAssertFalse(plan.needsMigration)
    }

    func testPlanDoesNotSeedWhenMesocycleAlreadyPresent() {
        let plan = SchemaMigrator.plan(root: [
            "schemaVersion": .int(8),
            "mesocycle": .object(["enabled": .bool(true)]),
        ])
        XCTAssertFalse(plan.addsMesocycle, "已有 mesocycle → 不报告播种")
        XCTAssertTrue(plan.needsMigration, "但仍需抬版本")
    }
}
