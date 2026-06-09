// schemaVersion 守卫 — schema honesty（系统逻辑 §3）。
//
// current = 8 沿用 legacy 导出口径（开门设计：老导出天然可解码）。
// Master Architecture: No schema bump unless explicitly approved——改这个数字
// 必须显式过架构批准。旧版本不静默升级（迁移属未来 slice），未来版本不静默吞下。

public enum SchemaVersion {
    public static let current = 8

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
