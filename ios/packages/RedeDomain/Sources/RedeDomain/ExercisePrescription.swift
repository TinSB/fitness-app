// ExercisePrescription — session 内单个动作的类型化只读视图（MVP 子集）。
//
// 替换审计字段（originalExerciseId / actualExerciseId 等）与 warmupSets
// 留在 storage，归动作替换 / Focus Mode 对应 slice 促升。

public struct ExercisePrescription: Equatable, Sendable {
    public let storage: [String: JSONValue]

    public init(storage: [String: JSONValue]) {
        self.storage = storage
    }

    public var id: String? { storage["id"]?.asString }
    public var exerciseId: String? { storage["exerciseId"]?.asString }
    public var name: String? { storage["name"]?.asString }

    public var sets: [TrainingSetLog] {
        guard let array = storage["sets"]?.asArray else { return [] }
        return array.compactMap { element in
            element.asObject.map(TrainingSetLog.init(storage:))
        }
    }
}
