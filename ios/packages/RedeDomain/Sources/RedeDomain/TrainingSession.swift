// TrainingSession — 完成训练的类型化只读视图（MVP 子集）。
//
// 字段名沿用 legacy JSON key 词汇表（开门设计）。Focus Mode 运行态、
// earlyEndReason 等非 MVP 字段留在 storage 里不提升，对应 slice 到来时再促升。

public struct TrainingSession: Equatable, Sendable {
    public let storage: [String: JSONValue]

    public init(storage: [String: JSONValue]) {
        self.storage = storage
    }

    public var id: String? { storage["id"]?.asString }
    public var date: String? { storage["date"]?.asString }
    /// 这一场属于哪个训练日（dayCode）。CompletedSessionBuilder 落盘时写入；
    /// 升级前的旧场次没有这一位 → nil，消费端据此回退到不分训练日的旧语义。
    public var templateId: String? { storage["templateId"]?.asString }
    public var startedAt: String? { storage["startedAt"]?.asString }
    public var finishedAt: String? { storage["finishedAt"]?.asString }
    public var durationMin: Double? { storage["durationMin"]?.asDouble }
    public var completed: Bool? { storage["completed"]?.asBool }

    public var exercises: [ExercisePrescription] {
        guard let array = storage["exercises"]?.asArray else { return [] }
        return array.compactMap { element in
            element.asObject.map(ExercisePrescription.init(storage:))
        }
    }
}
