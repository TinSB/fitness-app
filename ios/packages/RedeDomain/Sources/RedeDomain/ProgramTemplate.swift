// ProgramTemplate — 训练计划模板头部的类型化只读视图（MVP 子集）。
//
// 日结构 / 策略字段（correctionStrategy 等）留在 storage，
// 归 M2 处方引擎对应 slice 促升。

public struct ProgramTemplate: Equatable, Sendable {
    public let storage: [String: JSONValue]

    public init(storage: [String: JSONValue]) {
        self.storage = storage
    }

    public var id: String? { storage["id"]?.asString }
    public var primaryGoal: String? { storage["primaryGoal"]?.asString }
    public var splitType: String? { storage["splitType"]?.asString }
    public var daysPerWeek: Int? { storage["daysPerWeek"]?.asInt }
}
