// DailyTrainingAdjustmentTypes — CC-0 coach-action capstone foundation (2/3).
//
// Faithful Swift port of the `DailyTrainingAdjustment` TYPE FAMILY from
// `retired web reference`:
//   • `DailyTrainingAdjustmentType`       (ts:15) — 7-case signal class union.
//   • `DailyTrainingAdjustmentChangeType` (ts:24) — 6-case change union.
//   • `DailyTrainingAdjustmentChange`     (ts:32) — { type, targetId?, code }.
//   • `DailyTrainingAdjustment`           (ts:39) — the engine's structured result.
//
// TYPE-ONLY port: `coachActionEngine` consumes `DailyTrainingAdjustment` as a
// type-only input, so CC-0 ports the SHAPE only — the `buildDailyTrainingAdjustment`
// engine logic (ts:316) and its imports (PainPattern / ReadinessResult /
// HealthSummary / LoadFeedbackSummary / AutoTrainingLevel / engineUtils /
// recoveryAwareScheduler — used ONLY by the engine, never by these types) are a
// separate later track. The "Hard Rewrite V2" signal-only contract holds: NO
// user-facing `title` / `summary` / `reason` text — `reasons` are structured
// codes and `suggestedChanges[].code` is a structured reason code.
//
// Pure types: no runtime logic, no write path, no `: Date`.

import Foundation
import RedeDomain

/// `DailyTrainingAdjustmentType` (dailyTrainingAdjustmentEngine.ts:15).
public enum DailyTrainingAdjustmentType: String, Equatable, Hashable, Sendable, CaseIterable {
    case normal
    case conservative
    case deloadLike = "deload_like"
    case mainOnly = "main_only"
    case reduceSupport = "reduce_support"
    case substituteRiskyExercises = "substitute_risky_exercises"
    case restOrRecovery = "rest_or_recovery"
}

/// `DailyTrainingAdjustmentChangeType` (dailyTrainingAdjustmentEngine.ts:24).
public enum DailyTrainingAdjustmentChangeType: String, Equatable, Hashable, Sendable, CaseIterable {
    case reduceVolume = "reduce_volume"
    case reduceSupport = "reduce_support"
    case keepMainLifts = "keep_main_lifts"
    case substituteExercise = "substitute_exercise"
    case extendRest = "extend_rest"
    case skipOptional = "skip_optional"
}

/// `DailyTrainingAdjustment['confidence']` (dailyTrainingAdjustmentEngine.ts:43).
public enum DailyTrainingAdjustmentConfidence: String, Equatable, Hashable, Sendable, CaseIterable {
    case low
    case medium
    case high
}

/// `DailyTrainingAdjustmentChange` (dailyTrainingAdjustmentEngine.ts:32).
/// `targetId` is the only optional field (legacy web schema `?`); `code` is a structured reason
/// code, never user-facing text.
public struct DailyTrainingAdjustmentChange: Equatable, Hashable, Sendable {
    public let type: DailyTrainingAdjustmentChangeType
    public let targetId: String?
    public let code: String

    public init(type: DailyTrainingAdjustmentChangeType, targetId: String? = nil, code: String) {
        self.type = type
        self.targetId = targetId
        self.code = code
    }

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("DailyTrainingAdjustmentChange")
        let rawType = try obj.requireString("type", "DailyTrainingAdjustmentChange.type")
        guard let parsedType = DailyTrainingAdjustmentChangeType(rawValue: rawType) else {
            throw DailyTrainingAdjustmentDecodeError.invalidEnum("type", value: rawType)
        }
        self.type = parsedType
        self.targetId = obj.optionalString("targetId")
        self.code = try obj.requireString("code", "DailyTrainingAdjustmentChange.code")
    }
}

/// `DailyTrainingAdjustment` (dailyTrainingAdjustmentEngine.ts:39).
public struct DailyTrainingAdjustment: Equatable, Hashable, Sendable {
    public let type: DailyTrainingAdjustmentType
    public let reasons: [String]
    public let suggestedChanges: [DailyTrainingAdjustmentChange]
    public let confidence: DailyTrainingAdjustmentConfidence
    public let requiresUserConfirmation: Bool

    public init(
        type: DailyTrainingAdjustmentType,
        reasons: [String],
        suggestedChanges: [DailyTrainingAdjustmentChange],
        confidence: DailyTrainingAdjustmentConfidence,
        requiresUserConfirmation: Bool
    ) {
        self.type = type
        self.reasons = reasons
        self.suggestedChanges = suggestedChanges
        self.confidence = confidence
        self.requiresUserConfirmation = requiresUserConfirmation
    }

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("DailyTrainingAdjustment")
        let rawType = try obj.requireString("type", "DailyTrainingAdjustment.type")
        guard let parsedType = DailyTrainingAdjustmentType(rawValue: rawType) else {
            throw DailyTrainingAdjustmentDecodeError.invalidEnum("type", value: rawType)
        }
        self.type = parsedType
        self.reasons = obj.optionalStringArray("reasons") ?? []
        self.suggestedChanges = try (obj.optionalArray("suggestedChanges") ?? [])
            .map { try DailyTrainingAdjustmentChange(decoding: $0) }
        let rawConfidence = try obj.requireString("confidence", "DailyTrainingAdjustment.confidence")
        guard let parsedConfidence = DailyTrainingAdjustmentConfidence(rawValue: rawConfidence) else {
            throw DailyTrainingAdjustmentDecodeError.invalidEnum("confidence", value: rawConfidence)
        }
        self.confidence = parsedConfidence
        self.requiresUserConfirmation = obj.optionalBool("requiresUserConfirmation") ?? false
    }
}

/// Errors raised while decoding a `DailyTrainingAdjustment` shape.
public enum DailyTrainingAdjustmentDecodeError: Error, Equatable, Sendable {
    case invalidEnum(String, value: String)
}
