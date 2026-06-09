// HealthMetricSample — iOS-2C AppData Typed Field Activation V1.
//
// Mirrors the legacy web implementation `HealthMetricSample` type at
// `retired web reference`. `raw: unknown` is the most
// permissive open-bag in the entire model (Agent 1 §3 row 16); iOS-2C
// exposes it verbatim as `JSONValue?` so iOS-8 HealthKit can read the
// payload without losing precision.

import Foundation

public struct HealthMetricSample: Equatable, Hashable, Sendable {
    public let id: String?
    public let source: String?
    public let sourceName: String?
    public let deviceSourceName: String?
    public let metricType: String?
    public let startDate: String?
    public let endDate: String?
    public let value: NumberRepr?
    public let unit: String?
    public let importedAt: String?
    public let batchId: String?
    public let dataFlag: String?
    /// Opaque payload from Apple Health export. Preserved verbatim.
    public let raw: JSONValue?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "source", "sourceName", "deviceSourceName",
        "metricType", "startDate", "endDate", "value", "unit",
        "importedAt", "batchId", "dataFlag", "raw",
    ]

    public init(
        id: String? = nil,
        source: String? = nil,
        sourceName: String? = nil,
        deviceSourceName: String? = nil,
        metricType: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil,
        value: NumberRepr? = nil,
        unit: String? = nil,
        importedAt: String? = nil,
        batchId: String? = nil,
        dataFlag: String? = nil,
        raw: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.id = id
        self.source = source
        self.sourceName = sourceName
        self.deviceSourceName = deviceSourceName
        self.metricType = metricType
        self.startDate = startDate
        self.endDate = endDate
        self.value = value
        self.unit = unit
        self.importedAt = importedAt
        self.batchId = batchId
        self.dataFlag = dataFlag
        self.raw = raw
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.id = obj["id"]?.stringValue
        self.source = obj["source"]?.stringValue
        self.sourceName = obj["sourceName"]?.stringValue
        self.deviceSourceName = obj["deviceSourceName"]?.stringValue
        self.metricType = obj["metricType"]?.stringValue
        self.startDate = obj["startDate"]?.stringValue
        self.endDate = obj["endDate"]?.stringValue
        self.value = obj["value"]?.numberValue
        self.unit = obj["unit"]?.stringValue
        self.importedAt = obj["importedAt"]?.stringValue
        self.batchId = obj["batchId"]?.stringValue
        self.dataFlag = obj["dataFlag"]?.stringValue
        self.raw = obj["raw"]
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = id { typed.append(.init(key: "id", value: .string(v))) }
        if let v = source { typed.append(.init(key: "source", value: .string(v))) }
        if let v = sourceName { typed.append(.init(key: "sourceName", value: .string(v))) }
        if let v = deviceSourceName { typed.append(.init(key: "deviceSourceName", value: .string(v))) }
        if let v = metricType { typed.append(.init(key: "metricType", value: .string(v))) }
        if let v = startDate { typed.append(.init(key: "startDate", value: .string(v))) }
        if let v = endDate { typed.append(.init(key: "endDate", value: .string(v))) }
        if let v = value { typed.append(.init(key: "value", value: .number(v))) }
        if let v = unit { typed.append(.init(key: "unit", value: .string(v))) }
        if let v = importedAt { typed.append(.init(key: "importedAt", value: .string(v))) }
        if let v = batchId { typed.append(.init(key: "batchId", value: .string(v))) }
        if let v = dataFlag { typed.append(.init(key: "dataFlag", value: .string(v))) }
        if let v = raw { typed.append(.init(key: "raw", value: v)) }
        return .object(_unknown.appending(typed))
    }
}
