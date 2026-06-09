// ImportedWorkoutSample — HK-2 HealthKit Workout-History Import V1.
//
// Mirrors the legacy web implementation `ImportedWorkoutSample` type at
// `retired web reference`, the modeled home for Apple-Health-origin
// *workout* summaries (`AppData.importedWorkoutSamples`, training-model.ts:1380).
//
// This is DERIVED / EXTERNAL data, NOT a canonical native `TrainingSession`:
//   • It lands in `importedWorkoutSamples`, a bag SEPARATE from `history[]`.
//   • It is display-only — the native `RedeTrainingDecision` engine never
//     reads `importedWorkoutSamples` (it does not port `buildHealthSummary`; its
//     core slice always passes `healthSummary: nil`). So an imported workout
//     never becomes a canonical session and never feeds readiness / e1RM.
// The same open-bag / typed-field discipline as `HealthMetricSample` applies:
// numbers carry as `NumberRepr`, unknown keys are preserved verbatim (`_unknown`),
// and SI/metric storage is used (durationMin, kcal, meters, kg-consistent).

import Foundation

public struct ImportedWorkoutSample: Equatable, Hashable, Sendable {
    public let id: String?
    public let source: String?
    public let sourceName: String?
    public let deviceSourceName: String?
    public let workoutType: String?
    public let startDate: String?
    public let endDate: String?
    public let durationMin: NumberRepr?
    public let activeEnergyKcal: NumberRepr?
    public let avgHeartRate: NumberRepr?
    public let maxHeartRate: NumberRepr?
    public let distanceMeters: NumberRepr?
    public let importedAt: String?
    public let batchId: String?
    public let dataFlag: String?
    /// Opaque payload from Apple Health. Preserved verbatim.
    public let raw: JSONValue?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "id", "source", "sourceName", "deviceSourceName",
        "workoutType", "startDate", "endDate", "durationMin",
        "activeEnergyKcal", "avgHeartRate", "maxHeartRate", "distanceMeters",
        "importedAt", "batchId", "dataFlag", "raw",
    ]

    public init(
        id: String? = nil,
        source: String? = nil,
        sourceName: String? = nil,
        deviceSourceName: String? = nil,
        workoutType: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil,
        durationMin: NumberRepr? = nil,
        activeEnergyKcal: NumberRepr? = nil,
        avgHeartRate: NumberRepr? = nil,
        maxHeartRate: NumberRepr? = nil,
        distanceMeters: NumberRepr? = nil,
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
        self.workoutType = workoutType
        self.startDate = startDate
        self.endDate = endDate
        self.durationMin = durationMin
        self.activeEnergyKcal = activeEnergyKcal
        self.avgHeartRate = avgHeartRate
        self.maxHeartRate = maxHeartRate
        self.distanceMeters = distanceMeters
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
        self.workoutType = obj["workoutType"]?.stringValue
        self.startDate = obj["startDate"]?.stringValue
        self.endDate = obj["endDate"]?.stringValue
        self.durationMin = obj["durationMin"]?.numberValue
        self.activeEnergyKcal = obj["activeEnergyKcal"]?.numberValue
        self.avgHeartRate = obj["avgHeartRate"]?.numberValue
        self.maxHeartRate = obj["maxHeartRate"]?.numberValue
        self.distanceMeters = obj["distanceMeters"]?.numberValue
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
        if let v = workoutType { typed.append(.init(key: "workoutType", value: .string(v))) }
        if let v = startDate { typed.append(.init(key: "startDate", value: .string(v))) }
        if let v = endDate { typed.append(.init(key: "endDate", value: .string(v))) }
        if let v = durationMin { typed.append(.init(key: "durationMin", value: .number(v))) }
        if let v = activeEnergyKcal { typed.append(.init(key: "activeEnergyKcal", value: .number(v))) }
        if let v = avgHeartRate { typed.append(.init(key: "avgHeartRate", value: .number(v))) }
        if let v = maxHeartRate { typed.append(.init(key: "maxHeartRate", value: .number(v))) }
        if let v = distanceMeters { typed.append(.init(key: "distanceMeters", value: .number(v))) }
        if let v = importedAt { typed.append(.init(key: "importedAt", value: .string(v))) }
        if let v = batchId { typed.append(.init(key: "batchId", value: .string(v))) }
        if let v = dataFlag { typed.append(.init(key: "dataFlag", value: .string(v))) }
        if let v = raw { typed.append(.init(key: "raw", value: v)) }
        return .object(_unknown.appending(typed))
    }
}
