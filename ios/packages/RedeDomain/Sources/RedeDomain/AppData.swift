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
        self.schemaVersion = try SchemaVersion.validate(root: object)
        self.storage = object
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
}

extension AppData: Codable {
    public init(from decoder: Decoder) throws {
        try self.init(decoding: JSONValue(from: decoder))
    }

    public func encode(to encoder: Encoder) throws {
        try JSONValue.object(storage).encode(to: encoder)
    }
}
