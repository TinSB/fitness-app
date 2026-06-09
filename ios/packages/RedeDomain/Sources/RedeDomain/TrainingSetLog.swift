// TrainingSetLog — logged set 的类型化只读视图（MVP 子集）。
//
// 重量一律 kg 存储口径（legacy 合同）；显示单位归 UI/L10n 层。
// rir 在 legacy 数据里可能是字符串：视图只认数值（给 nil），原值留在
// storage 不丢——归一化是 M1-3 DataHealth 的事，模型层只保真。

public struct TrainingSetLog: Equatable, Sendable {
    public let storage: [String: JSONValue]

    public init(storage: [String: JSONValue]) {
        self.storage = storage
    }

    public var id: String? { storage["id"]?.asString }
    public var setIndex: Int? { storage["setIndex"]?.asInt }
    public var exerciseId: String? { storage["exerciseId"]?.asString }
    public var weight: Double? { storage["weight"]?.asDouble }
    public var reps: Int? { storage["reps"]?.asInt }
    public var rir: Double? { storage["rir"]?.asDouble }
    public var completedAt: String? { storage["completedAt"]?.asString }
    public var done: Bool? { storage["done"]?.asBool }
    public var completionStatus: String? { storage["completionStatus"]?.asString }
}
