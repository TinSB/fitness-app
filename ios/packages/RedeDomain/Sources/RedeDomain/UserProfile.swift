// UserProfile — 训练背景档案的类型化只读视图（MVP 子集）。

public struct UserProfile: Equatable, Sendable {
    public let storage: [String: JSONValue]

    public init(storage: [String: JSONValue]) {
        self.storage = storage
    }

    public var id: String? { storage["id"]?.asString }
    public var name: String? { storage["name"]?.asString }
    public var sex: String? { storage["sex"]?.asString }
    public var age: Int? { storage["age"]?.asInt }
    public var heightCm: Double? { storage["heightCm"]?.asDouble }
    public var weightKg: Double? { storage["weightKg"]?.asDouble }
    public var trainingLevel: String? { storage["trainingLevel"]?.asString }
    public var primaryGoal: String? { storage["primaryGoal"]?.asString }
    public var weeklyTrainingDays: Int? { storage["weeklyTrainingDays"]?.asInt }
    public var sessionDurationMin: Double? { storage["sessionDurationMin"]?.asDouble }
    public var injuryFlags: [String]? { storage["injuryFlags"]?.asStringArray }
}
