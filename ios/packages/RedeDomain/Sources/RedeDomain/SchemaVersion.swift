// schemaVersion 守卫 — schema honesty（系统逻辑 §3）。
//
// current = 11（11：FR-T5 教练动作完整写路径——加性播种 exerciseSubstitutions / coachAdjustments /
//             coachState 三个 canonical 容器，2026-06-16 owner 签字批准；
//             10：旧「5 天 push-pull-legs」重映成 ppl-ul，腿 2× 循证 5 天分化，2026-06-16 owner 拍板；
//             9：周期化引擎 Mesocycle · FR-PL2 落库）。
// Master Architecture: No schema bump unless explicitly approved——改这个数字必须显式过架构批准。
// 旧版本经 SchemaMigrator 升级到 current（迁移**先于 validate**，纯加性、可逆），无迁移路径的旧版本
// （如 schema-7）仍如实报 upgradeRequired、不静默升级；未来版本不静默吞下。validate 本身只认 current，
// 迁移由 decode 边界（AppData.init(decoding:)）统一编排。

public enum SchemaVersion {
    public static let current = 11

    public enum ValidationError: Error, Equatable {
        case missing
        case notAnInteger
        case upgradeRequired(found: Int)
        case futureIncompatible(found: Int)
    }

    static func validate(root: [String: JSONValue]) throws -> Int {
        guard let raw = root["schemaVersion"] else { throw ValidationError.missing }
        guard let found = raw.asInt else { throw ValidationError.notAnInteger }
        if found < current { throw ValidationError.upgradeRequired(found: found) }
        if found > current { throw ValidationError.futureIncompatible(found: found) }
        return found
    }
}
