// SR-0 — Smart Replacement parity golden output type skeleton.
//
// `SmartReplacementGolden.init(decoding:)` decodes a smart-replacement parity
// golden file (ios/ParityFixtures/parity/golden/smart-replacement/*.json) produced
// by the legacy web implementation generator (retired fixture generator →
// generateSmartReplacement). It mirrors the legacy web schema engine OUTPUT shape:
//
//   retired-web-reference
//     export type SmartReplacementPriority =
//       'primary' | 'secondary' | 'angle_variation' | 'avoid';
//     export type SmartReplacementRecommendation = {
//       exerciseId: string;
//       exerciseName: string;
//       priority: SmartReplacementPriority;
//       fatigueCost: 'low' | 'medium' | 'high';
//       reason: string;
//       warnings: string[];
//     };
//
// THIS FILE COMPUTES NOTHING. There is no buildSmartReplacementRecommendations,
// no scoring / candidate / equivalence-chain logic, no exercise library, no
// AppData read or mutate. It is a decode/shape skeleton only — the engine port
// is SR-1+. Stable string fields expose typed enum accessors that never fail
// decode (nil on an unknown value), and unknown future keys are preserved.

import Foundation
import IronPathDomain

/// `priority` — mirrors legacy web schema `SmartReplacementPriority`
/// (smartReplacementEngine.ts:22). Raw values match the legacy web schema string literals;
/// `angle_variation` is the only non-1:1 Swift case name.
public enum SmartReplacementPriority: String, Equatable, Sendable, CaseIterable {
    case primary
    case secondary
    case angleVariation = "angle_variation"
    case avoid
}

/// `fatigueCost` — mirrors the legacy web schema `'low' | 'medium' | 'high'` union
/// (smartReplacementEngine.ts:28 + getFatigueCost at :139).
public enum SmartReplacementFatigueCost: String, Equatable, Sendable, CaseIterable {
    case low
    case medium
    case high
}

/// One `recommendations[i]` entry — mirrors legacy web schema `SmartReplacementRecommendation`
/// (smartReplacementEngine.ts:24-31). Decode-only; carries the raw `priority` /
/// `fatigueCost` strings verbatim plus non-failing typed enum accessors.
public struct SmartReplacementRecommendation: Equatable, Sendable {
    public let exerciseId: String
    public let exerciseName: String
    public let priority: String
    public let fatigueCost: String
    public let reason: String
    public let warnings: [String]

    /// Forward-compat carrier for any recommendation key not modelled above.
    public let unknown: OrderedJSONObject

    // ---- Typed enum accessors (never fail decode; nil on unknown value) ----
    public var priorityEnum: SmartReplacementPriority? { SmartReplacementPriority(rawValue: priority) }
    public var fatigueCostEnum: SmartReplacementFatigueCost? { SmartReplacementFatigueCost(rawValue: fatigueCost) }

    private static let modelledKeys: Set<String> = [
        "exerciseId", "exerciseName", "priority", "fatigueCost", "reason", "warnings",
    ]

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("SmartReplacementRecommendation")
        self.exerciseId = try obj.requireString("exerciseId", "SmartReplacementRecommendation")
        self.exerciseName = try obj.requireString("exerciseName", "SmartReplacementRecommendation")
        self.priority = try obj.requireString("priority", "SmartReplacementRecommendation")
        self.fatigueCost = try obj.requireString("fatigueCost", "SmartReplacementRecommendation")
        self.reason = try obj.requireString("reason", "SmartReplacementRecommendation")
        self.warnings = obj.optionalStringArray("warnings") ?? []
        let extras = obj.entries.filter { !SmartReplacementRecommendation.modelledKeys.contains($0.key) }
        self.unknown = OrderedJSONObject(entries: extras)
    }
}

/// The full smart-replacement golden file. Wraps the ordered
/// `recommendations` array with the generator's `recommendationCount` +
/// `priorityCounts` summary (see retired fixture generator:generateSmartReplacement)
/// and the shared `parityGolden` envelope. Decode-only.
public struct SmartReplacementGolden: Equatable, Sendable {
    public let sourceFixtureId: String
    public let currentExerciseId: String
    public let recommendationCount: Int
    /// `priority rawValue → count`. Carries all four priorities (including
    /// zeros) so callers can assert coverage without recomputing.
    public let priorityCounts: [String: Int]
    /// Order is contractual and preserved verbatim from the golden.
    public let recommendations: [SmartReplacementRecommendation]
    public let parityGolden: ParityGoldenEnvelope?

    /// Forward-compat carrier for any top-level golden key not modelled above.
    public let unknown: OrderedJSONObject

    /// The set of distinct priorities actually present in `recommendations`.
    public var presentPriorities: Set<SmartReplacementPriority> {
        Set(recommendations.compactMap { $0.priorityEnum })
    }

    private static let modelledKeys: Set<String> = [
        "sourceFixtureId", "currentExerciseId", "recommendationCount",
        "priorityCounts", "recommendations", "parityGolden",
    ]

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("SmartReplacementGolden")
        self.sourceFixtureId = try obj.requireString("sourceFixtureId", "SmartReplacementGolden")
        self.currentExerciseId = try obj.requireString("currentExerciseId", "SmartReplacementGolden")
        self.recommendationCount = obj.optionalInt("recommendationCount") ?? 0

        if let counts = obj.optionalObject("priorityCounts") {
            var map: [String: Int] = [:]
            for key in counts.keys {
                if let n = counts.optionalInt(key) { map[key] = n }
            }
            self.priorityCounts = map
        } else {
            self.priorityCounts = [:]
        }

        if let arr = obj.optionalArray("recommendations") {
            self.recommendations = try arr.map { try SmartReplacementRecommendation(decoding: $0) }
        } else {
            self.recommendations = []
        }

        if let pg = obj.rawValue("parityGolden"), !pg.isNull {
            self.parityGolden = try ParityGoldenEnvelope(decoding: pg)
        } else {
            self.parityGolden = nil
        }

        let extras = obj.entries.filter { !SmartReplacementGolden.modelledKeys.contains($0.key) }
        self.unknown = OrderedJSONObject(entries: extras)
    }

    /// Decode directly from raw golden bytes.
    public init(decodingData data: Data) throws {
        try self.init(decoding: JSONValue(decoding: data))
    }
}
