// ProgramTemplate — iOS-2C AppData Typed Field Activation V1.
//
// Mirrors the legacy web implementation `ProgramTemplate` interface at
// `retired web reference`.

import Foundation

public struct ProgramTemplate: Equatable, Hashable, Sendable {
    public let id: String?
    public let userId: String?
    public let primaryGoal: String?
    public let splitType: String?
    public let daysPerWeek: NumberRepr?
    public let correctionStrategy: JSONValue?
    public let functionalStrategy: JSONValue?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "userId", "primaryGoal", "splitType", "daysPerWeek",
        "correctionStrategy", "functionalStrategy",
    ]

    public init(
        id: String? = nil,
        userId: String? = nil,
        primaryGoal: String? = nil,
        splitType: String? = nil,
        daysPerWeek: NumberRepr? = nil,
        correctionStrategy: JSONValue? = nil,
        functionalStrategy: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.userId = userId
        self.primaryGoal = primaryGoal
        self.splitType = splitType
        self.daysPerWeek = daysPerWeek
        self.correctionStrategy = correctionStrategy
        self.functionalStrategy = functionalStrategy
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.id = obj["id"]?.stringValue
        self.userId = obj["userId"]?.stringValue
        self.primaryGoal = obj["primaryGoal"]?.stringValue
        self.splitType = obj["splitType"]?.stringValue
        self.daysPerWeek = obj["daysPerWeek"]?.numberValue
        self.correctionStrategy = obj["correctionStrategy"]
        self.functionalStrategy = obj["functionalStrategy"]
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = id { typed.append(.init(key: "id", value: .string(v))) }
        if let v = userId { typed.append(.init(key: "userId", value: .string(v))) }
        if let v = primaryGoal { typed.append(.init(key: "primaryGoal", value: .string(v))) }
        if let v = splitType { typed.append(.init(key: "splitType", value: .string(v))) }
        if let v = daysPerWeek { typed.append(.init(key: "daysPerWeek", value: .number(v))) }
        if let v = correctionStrategy { typed.append(.init(key: "correctionStrategy", value: v)) }
        if let v = functionalStrategy { typed.append(.init(key: "functionalStrategy", value: v)) }
        return .object(_unknown.appending(typed))
    }
}
