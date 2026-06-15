// SchemaMigrator — schema 版本迁移钩子（系统逻辑 §3/§6.5；schema-migration-guard）。
//
// 职责：把旧版 canonical root 升级到 SchemaVersion.current，再交给 SchemaVersion.validate
// ——迁移**必须先于 validate**（validate 只认 current）。全程纯函数、纯加性、幂等：只加字段 /
// 抬版本号，绝不删既有键、绝不改既有值。
//
// 安全模型（schema-migration-guard）：迁移只在内存里把解码到的 root 升级（decode 路径），
// **从不碰磁盘**——磁盘上的 canonical 文件只由已备份的唯一写闸（CanonicalSessionWriter：
// backupExisting → atomic save）改写。故「读不毁数据」，原始旧文件始终可从备份恢复。
// 配合 downMigrate（可逆回滚）与 plan（dry-run 报告），满足守卫的 可逆 / 备份 / dry-run 三项。

public enum SchemaMigrator {
    /// 迁移计划（dry-run 产物）：报告会发生什么，但不应用、不写盘。
    public struct Plan: Equatable, Sendable {
        /// 源版本；nil = 版本缺失/不可解析（不迁移，交给 validate 如实报错）。
        public let from: Int?
        /// 目标版本（= SchemaVersion.current）。
        public let to: Int
        /// 本次是否会播种 mesocycle 字段（8→9 那一步，且原 root 无此键时）。
        public let addsMesocycle: Bool
        /// 是否需要迁移（有可解析的、低于 current 的源版本）。
        public var needsMigration: Bool { from.map { $0 < to } ?? false }

        public init(from: Int?, to: Int, addsMesocycle: Bool) {
            self.from = from
            self.to = to
            self.addsMesocycle = addsMesocycle
        }
    }

    /// dry-run：不应用、只报告从 root 当前版本迁移到 current 会做什么。
    public static func plan(root: [String: JSONValue]) -> Plan {
        let to = SchemaVersion.current
        guard let from = root["schemaVersion"]?.asInt else {
            return Plan(from: nil, to: to, addsMesocycle: false)
        }
        // 仅 8→9 这一步播种 mesocycle；源在 [8, current) 且无 mesocycle 时为真。
        let addsMesocycle = from >= 8 && from < to && root["mesocycle"] == nil
        return Plan(from: from, to: to, addsMesocycle: addsMesocycle)
    }

    /// 升级 root 到 current。纯加性、幂等。
    /// 版本缺失/非整数/已是 current/未来版本/无迁移路径 → 原样返回（交给 validate 报真错）。
    public static func migrate(root: [String: JSONValue]) -> [String: JSONValue] {
        guard let version = root["schemaVersion"]?.asInt, version < SchemaVersion.current else {
            return root
        }
        var working = root
        var v = version
        while v < SchemaVersion.current {
            // 无此步迁移（如 schema-7）→ 停在原版本，validate 会如实报 upgradeRequired，绝不伪造。
            guard let next = upStep(from: v, root: working) else { break }
            working = next
            v += 1
        }
        return working
    }

    private static func upStep(from version: Int, root: [String: JSONValue]) -> [String: JSONValue]? {
        switch version {
        case 8:
            // 8 → 9：周期化引擎（Mesocycle · FR-PL2）落库。纯加性——只抬版本 + 缺则补 mesocycle。
            var r = root
            r["schemaVersion"] = .int(9)
            if r["mesocycle"] == nil {
                r["mesocycle"] = .object([
                    "enabled": .bool(false),       // 默认关闭 = 零行为回归（owner 拍板默认 off）
                    "blockLengthWeeks": .int(4),   // 4 周块（存库便于未来改 6 周，不改引擎契约）
                ])
            }
            return r
        default:
            return nil   // schema-7 及更早无迁移路径，与迁移前一致地保持 unreadable。
        }
    }

    /// 可逆回滚：把 root 降到 target（默认 8）。去 mesocycle、版本回落。用于回退/从备份对账。
    /// 与 migrate 构成往返恒等：downMigrate(migrate(x)) == x（x 为无 mesocycle 的 schema-8 root）。
    /// 契约范围（审查 MINOR-2）：**只保证 9→8 单步**。无 downStep 的版本（如未来 schema-10）原样返回、
    /// 不抛错也不部分迁移——这是非生产回退辅助，跨多版本/未知版本回退须先补对应 downStep 与测试。
    public static func downMigrate(root: [String: JSONValue], to target: Int = 8) -> [String: JSONValue] {
        guard let version = root["schemaVersion"]?.asInt, version > target else { return root }
        var working = root
        var v = version
        while v > target {
            guard let prev = downStep(from: v, root: working) else { break }
            working = prev
            v -= 1
        }
        return working
    }

    private static func downStep(from version: Int, root: [String: JSONValue]) -> [String: JSONValue]? {
        switch version {
        case 9:
            var r = root
            r["schemaVersion"] = .int(8)
            r["mesocycle"] = nil   // Dictionary 赋 nil = 删键
            return r
        default:
            return nil
        }
    }
}
