// AppSettings — iOS-2C AppData Typed Field Activation V1.
//
// AppSettings is the canonical open-bag site (TS index signature
// `[key: string]: unknown` at `src/models/training-model.ts:1342`).
// iOS-2C promotes the iOS-3 / Data Health unblock subset; everything
// else flows through `_unknown` so future PWA writes are preserved.

import Foundation

public struct AppSettings: Equatable, Hashable, Sendable {
    public let schemaVersion: NumberRepr?
    public let selectedTemplateId: String?
    public let trainingMode: String?
    /// Display-unit preferences; nested object preserved via JSONValue.
    public let unitSettings: JSONValue?
    public let healthIntegrationSettings: JSONValue?
    public let useHealthDataForReadiness: Bool?
    /// Data Health repair receipts (append-only). iOS-3 reads these.
    public let dataHealthRepairLedger: JSONValue?
    public let dataHealthAutoRepairSummary: JSONValue?
    public let dataHealthRuntimeFlags: JSONValue?
    public let dataRepairLogs: JSONValue?
    public let dismissedCoachActions: JSONValue?
    public let dismissedDataHealthIssues: JSONValue?
    public let pendingSessionPatches: JSONValue?
    /// Optional today-status block (rare on top-level settings but
    /// observed in some real-world payloads).
    public let todayStatus: JSONValue?

    public let _unknown: OrderedJSONObject

    public static let documentedKeys: Set<String> = [
        "schemaVersion", "selectedTemplateId", "trainingMode",
        "unitSettings", "healthIntegrationSettings",
        "useHealthDataForReadiness",
        "dataHealthRepairLedger", "dataHealthAutoRepairSummary",
        "dataHealthRuntimeFlags", "dataRepairLogs",
        "dismissedCoachActions", "dismissedDataHealthIssues",
        "pendingSessionPatches", "todayStatus",
    ]

    public init(
        schemaVersion: NumberRepr? = nil,
        selectedTemplateId: String? = nil,
        trainingMode: String? = nil,
        unitSettings: JSONValue? = nil,
        healthIntegrationSettings: JSONValue? = nil,
        useHealthDataForReadiness: Bool? = nil,
        dataHealthRepairLedger: JSONValue? = nil,
        dataHealthAutoRepairSummary: JSONValue? = nil,
        dataHealthRuntimeFlags: JSONValue? = nil,
        dataRepairLogs: JSONValue? = nil,
        dismissedCoachActions: JSONValue? = nil,
        dismissedDataHealthIssues: JSONValue? = nil,
        pendingSessionPatches: JSONValue? = nil,
        todayStatus: JSONValue? = nil,
        _unknown: OrderedJSONObject = OrderedJSONObject()
    ) {
        self.schemaVersion = schemaVersion
        self.selectedTemplateId = selectedTemplateId
        self.trainingMode = trainingMode
        self.unitSettings = unitSettings
        self.healthIntegrationSettings = healthIntegrationSettings
        self.useHealthDataForReadiness = useHealthDataForReadiness
        self.dataHealthRepairLedger = dataHealthRepairLedger
        self.dataHealthAutoRepairSummary = dataHealthAutoRepairSummary
        self.dataHealthRuntimeFlags = dataHealthRuntimeFlags
        self.dataRepairLogs = dataRepairLogs
        self.dismissedCoachActions = dismissedCoachActions
        self.dismissedDataHealthIssues = dismissedDataHealthIssues
        self.pendingSessionPatches = pendingSessionPatches
        self.todayStatus = todayStatus
        self._unknown = _unknown
    }

    public init(decoding value: JSONValue) throws {
        guard case .object(let obj) = value else {
            throw JSONValueError.notAnObject
        }
        self.schemaVersion = obj["schemaVersion"]?.numberValue
        self.selectedTemplateId = obj["selectedTemplateId"]?.stringValue
        self.trainingMode = obj["trainingMode"]?.stringValue
        self.unitSettings = obj["unitSettings"]
        self.healthIntegrationSettings = obj["healthIntegrationSettings"]
        self.useHealthDataForReadiness = obj["useHealthDataForReadiness"]?.boolValue
        self.dataHealthRepairLedger = obj["dataHealthRepairLedger"]
        self.dataHealthAutoRepairSummary = obj["dataHealthAutoRepairSummary"]
        self.dataHealthRuntimeFlags = obj["dataHealthRuntimeFlags"]
        self.dataRepairLogs = obj["dataRepairLogs"]
        self.dismissedCoachActions = obj["dismissedCoachActions"]
        self.dismissedDataHealthIssues = obj["dismissedDataHealthIssues"]
        self.pendingSessionPatches = obj["pendingSessionPatches"]
        self.todayStatus = obj["todayStatus"]
        self._unknown = obj.withoutKeys(Self.documentedKeys)
    }

    public func encoded() -> JSONValue {
        var typed: [OrderedJSONObject.Entry] = []
        if let v = schemaVersion { typed.append(.init(key: "schemaVersion", value: .number(v))) }
        if let v = selectedTemplateId { typed.append(.init(key: "selectedTemplateId", value: .string(v))) }
        if let v = trainingMode { typed.append(.init(key: "trainingMode", value: .string(v))) }
        if let v = unitSettings { typed.append(.init(key: "unitSettings", value: v)) }
        if let v = healthIntegrationSettings { typed.append(.init(key: "healthIntegrationSettings", value: v)) }
        if let v = useHealthDataForReadiness { typed.append(.init(key: "useHealthDataForReadiness", value: .bool(v))) }
        if let v = dataHealthRepairLedger { typed.append(.init(key: "dataHealthRepairLedger", value: v)) }
        if let v = dataHealthAutoRepairSummary { typed.append(.init(key: "dataHealthAutoRepairSummary", value: v)) }
        if let v = dataHealthRuntimeFlags { typed.append(.init(key: "dataHealthRuntimeFlags", value: v)) }
        if let v = dataRepairLogs { typed.append(.init(key: "dataRepairLogs", value: v)) }
        if let v = dismissedCoachActions { typed.append(.init(key: "dismissedCoachActions", value: v)) }
        if let v = dismissedDataHealthIssues { typed.append(.init(key: "dismissedDataHealthIssues", value: v)) }
        if let v = pendingSessionPatches { typed.append(.init(key: "pendingSessionPatches", value: v)) }
        if let v = todayStatus { typed.append(.init(key: "todayStatus", value: v)) }
        return .object(_unknown.appending(typed))
    }
}
