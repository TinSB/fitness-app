// AppData — 本地 JSON canonical source of truth 的内存形态（系统逻辑 §3/§4）。
//
// 设计：storage 把解码到的整棵 JSON 对象 verbatim 持有（open-bag preserving——
// 未知字段在任何层级都不丢）；MVP 子集（profile / program / 完成训练 / logged sets)
// 是 storage 之上的类型化只读视图。编码即原样回写 storage，往返无损由构造保证。
//
// 这是唯一的模型（M1-1 边界：不引入第二套）。变更语义不在本层——canonical 写入
// 必须经 M1-2 的 gated writer（系统逻辑 §1 唯一写闸）。

public struct AppData: Equatable, Sendable {
    public enum DecodingFailure: Error, Equatable {
        case rootNotAnObject
    }

    /// 整棵 JSON 对象，含全部未知字段，verbatim。
    public let storage: [String: JSONValue]
    public let schemaVersion: Int

    public init(decoding value: JSONValue) throws {
        guard let object = value.asObject else { throw DecodingFailure.rootNotAnObject }
        // 迁移**先于** validate（系统逻辑 §3/§6.5）：decode 是唯一反序列化边界，旧版 root 在此
        // 升级到 current 再校验。纯内存、纯加性、不碰磁盘——磁盘只由已备份的写闸改写（schema-migration-guard）。
        let migrated = SchemaMigrator.migrate(root: object)
        self.schemaVersion = try SchemaVersion.validate(root: migrated)
        self.storage = migrated
    }

    // MARK: MVP 类型化只读视图

    /// 完成训练历史。非对象元素在视图中跳过，但在 storage 中原样保留。
    public var history: [TrainingSession] {
        guard let array = storage["history"]?.asArray else { return [] }
        return array.compactMap { element in
            element.asObject.map(TrainingSession.init(storage:))
        }
    }

    public var userProfile: UserProfile {
        UserProfile(storage: storage["userProfile"]?.asObject ?? [:])
    }

    public var programTemplate: ProgramTemplate {
        ProgramTemplate(storage: storage["programTemplate"]?.asObject ?? [:])
    }

    /// 周期化引擎配置（系统逻辑 §6.5，schema 9 落库）。字段缺失 → 安全默认（关闭、4 周块、无锚点）。
    public var mesocycle: MesocycleConfig {
        let obj = storage["mesocycle"]?.asObject ?? [:]
        return MesocycleConfig(
            enabled: obj["enabled"]?.asBool ?? false,
            // 默认 4 周（语义同 RedeTrainingDecision.Mesocycle.defaultBlockLengthWeeks；
            // 跨包不引入耦合，故在域层内联此常量）。
            blockLengthWeeks: obj["blockLengthWeeks"]?.asInt ?? 4,
            blockStartISO: obj["blockStartISO"]?.asString
        )
    }

    /// FR-NT1 休息结束提醒偏好（open-bag 加性，缺=关；不 seed、无 schema bump）。授权态由系统持有、不落库。
    public var notificationRestEndEnabled: Bool {
        storage["notifications"]?.asObject?["restEndEnabled"]?.asBool ?? false
    }

    /// FR-NT2 每周训练提醒偏好（同上；UI/调度接线见后续 slice）。
    public var notificationWeeklyEnabled: Bool {
        storage["notifications"]?.asObject?["weeklyEnabled"]?.asBool ?? false
    }

    /// FR-T5 换动作前瞻覆盖（schema 11）：originalId → actualId 的只读映射。
    /// 缺容器/非字符串值跳过；空 = 无覆盖（schema 10 及更早天然空，零行为回归）。
    public var exerciseSubstitutions: [String: String] {
        guard let obj = storage["exerciseSubstitutions"]?.asObject else { return [:] }
        return obj.compactMapValues { $0.asString }
    }

    /// FR-T5 已采纳补量的 ISO 周集合（schema 11）。缺容器/内层 → 空（防御读，审查 M-1）。
    public var volumeBoostWeeks: [String] {
        guard let arr = storage["coachAdjustments"]?.asObject?["volumeBoosts"]?.asArray else { return [] }
        return arr.compactMap { $0.asObject?["weekStartISO"]?.asString }
    }

    /// FR-T5 教练动作 dismiss 计数（schema 11）：actionKey → 累计 dismiss 次数（喂降频）。
    /// 缺容器/内层 → 空（防御读，审查 M-1）。
    public var coachDismissals: [String: Int] {
        guard let arr = storage["coachState"]?.asObject?["dismissed"]?.asArray else { return [:] }
        var out: [String: Int] = [:]
        for element in arr {
            if let key = element.asObject?["actionKey"]?.asString {
                out[key] = element.asObject?["count"]?.asInt ?? 0
            }
        }
        return out
    }
}

/// 顶层 `mesocycle` 的类型化只读视图（不存"当前第几周"——相位永远从 blockStartISO + 今日现算）。
public struct MesocycleConfig: Equatable, Sendable {
    /// 计划周期化是否生效（默认 false = 零行为回归）。
    public let enabled: Bool
    /// 累积块长（周）。存库便于未来改 6 周，不改引擎契约。
    public let blockLengthWeeks: Int
    /// 可选块锚点（防腐烂：消费侧默认从真历史重算，此处为未来手动覆盖 / 显示预留；nil = 从历史算）。
    public let blockStartISO: String?

    public init(enabled: Bool, blockLengthWeeks: Int, blockStartISO: String?) {
        self.enabled = enabled
        self.blockLengthWeeks = blockLengthWeeks
        self.blockStartISO = blockStartISO
    }
}

extension AppData: Codable {
    public init(from decoder: Decoder) throws {
        try self.init(decoding: JSONValue(from: decoder))
    }

    public func encode(to encoder: Encoder) throws {
        try JSONValue.object(storage).encode(to: encoder)
    }
}
