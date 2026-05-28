// iOS-4B1 — hiddenDebugSignals + the structured auxiliary summaries the
// expanded goldens carry (perExercise, exerciseRoleFloors, effectivePhase,
// weeklyAdjustment, cleanInput, inputEvidence). Pure decode skeleton: no
// engine logic, no AppData. Order-sensitive arrays (arbitrationTrace) are
// preserved as Swift Arrays.

import Foundation
import IronPathDomain

/// `hiddenDebugSignals` — every golden carries exactly `{ arbitrationTrace }`.
public struct HiddenDebugSignals: Equatable, Sendable {
    /// Ordered AR-codes. Order is contractual and preserved verbatim.
    public let arbitrationTrace: [String]

    public init(arbitrationTrace: [String]) {
        self.arbitrationTrace = arbitrationTrace
    }

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("HiddenDebugSignals")
        self.arbitrationTrace = obj.optionalStringArray("arbitrationTrace") ?? []
    }

    public func encoded() -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "arbitrationTrace", value: .array(arbitrationTrace.map { .string($0) })),
        ]))
    }
}

/// `perExercise[i]` — per-exercise working-set summary (regression detector).
public struct PerExerciseSummary: Equatable, Sendable {
    public let exerciseId: String
    public let role: String
    public let targetSets: Int

    public init(exerciseId: String, role: String, targetSets: Int) {
        self.exerciseId = exerciseId
        self.role = role
        self.targetSets = targetSets
    }

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("PerExerciseSummary")
        self.exerciseId = try obj.requireString("exerciseId", "PerExerciseSummary")
        self.role = try obj.requireString("role", "PerExerciseSummary")
        self.targetSets = obj.optionalInt("targetSets") ?? 0
    }

    public func encoded() -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "exerciseId", value: .string(exerciseId)),
            .init(key: "role", value: .string(role)),
            .init(key: "targetSets", value: .number(.integer(Int64(targetSets)))),
        ]))
    }
}

/// `effectivePhase` summary — all fields nullable in the golden projection.
public struct EffectivePhaseSummary: Equatable, Sendable {
    public let activePhase: String?
    public let gapDays: Int?
    public let mode: String?
    public let severity: String?
    public let overridden: Bool?
    public let hasHistory: Bool?

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("EffectivePhaseSummary")
        self.activePhase = obj.optionalString("activePhase")
        self.gapDays = obj.optionalInt("gapDays")
        self.mode = obj.optionalString("mode")
        self.severity = obj.optionalString("severity")
        self.overridden = obj.optionalBool("overridden")
        self.hasHistory = obj.optionalBool("hasHistory")
    }
}

/// `weeklyAdjustment` — may be null; fields preserved (timestamps stay String).
public struct WeeklyAdjustment: Equatable, Sendable {
    public let direction: String?
    public let magnitudePct: Double?
    public let blockedBy: String?
    public let appliesFromIsoDate: String?

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("WeeklyAdjustment")
        self.direction = obj.optionalString("direction")
        self.magnitudePct = obj.optionalDouble("magnitudePct")
        self.blockedBy = obj.optionalString("blockedBy")
        self.appliesFromIsoDate = obj.optionalString("appliesFromIsoDate")
    }
}

/// `cleanInput.diagnostics` — the Clean Input Contract evidence.
public struct CleanInputDiagnostics: Equatable, Sendable {
    public let lifecycleResidueSessionIds: [String]
    public let legacyAdviceSessionIds: [String]
    public let invalidDurationSessionIds: [String]
    public let cappedIssueScoreKeys: [String]
    public let staleTodayStatus: Bool
    public let staleHealthData: Bool
    public let filteredPerformanceDropIds: [String]

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("CleanInputDiagnostics")
        self.lifecycleResidueSessionIds = obj.optionalStringArray("lifecycleResidueSessionIds") ?? []
        self.legacyAdviceSessionIds = obj.optionalStringArray("legacyAdviceSessionIds") ?? []
        self.invalidDurationSessionIds = obj.optionalStringArray("invalidDurationSessionIds") ?? []
        self.cappedIssueScoreKeys = obj.optionalStringArray("cappedIssueScoreKeys") ?? []
        self.staleTodayStatus = obj.optionalBool("staleTodayStatus") ?? false
        self.staleHealthData = obj.optionalBool("staleHealthData") ?? false
        self.filteredPerformanceDropIds = obj.optionalStringArray("filteredPerformanceDropIds") ?? []
    }
}

/// `cleanInput` — proves the dirty raw AppData passed through the clean view.
/// `useHealthDataForReadiness` is tri-state in JSON (true/false/null) → Bool?.
public struct CleanInputEvidence: Equatable, Sendable {
    public let cleanViewBuilt: Bool
    public let useHealthDataForReadiness: Bool?
    public let diagnostics: CleanInputDiagnostics?

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("CleanInputEvidence")
        self.cleanViewBuilt = obj.optionalBool("cleanViewBuilt") ?? false
        self.useHealthDataForReadiness = obj.optionalBool("useHealthDataForReadiness")
        if let d = obj.rawValue("diagnostics"), !d.isNull {
            self.diagnostics = try CleanInputDiagnostics(decoding: d)
        } else {
            self.diagnostics = nil
        }
    }
}

/// `inputEvidence` — synthetic-input provenance for the parity runner.
public struct InputEvidence: Equatable, Sendable {
    public let historyLength: Int?
    public let healthMetricSampleCount: Int?
    public let rawHealthSamplesPreserved: Bool?

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("InputEvidence")
        self.historyLength = obj.optionalInt("historyLength")
        self.healthMetricSampleCount = obj.optionalInt("healthMetricSampleCount")
        self.rawHealthSamplesPreserved = obj.optionalBool("rawHealthSamplesPreserved")
    }
}
