// iOS-4B1 — top-level TrainingDecision golden type skeleton.
//
// `TrainingDecision.init(decoding:)` decodes a full training-decision golden
// file (the narrow normal-session-v1 projection AND the 9 expanded fixtures).
// Fields present only in the expanded projection are OPTIONAL so the narrow
// golden decodes; unknown future top-level keys are preserved in `_unknown`
// for forward compatibility. Stable string fields expose typed enum accessors.
//
// THIS FILE COMPUTES NOTHING. There is no buildTrainingDecision, no phase /
// prescription / readiness / support-plan logic, no AppData read or mutate.
// It is a decode/encode skeleton only — the engine port is iOS-4B2+.

import Foundation
import IronPathDomain

public struct TrainingDecision: Equatable, Sendable {
    // --- Always present (narrow + expanded) ---
    public let sourceFixtureId: String
    public let decisionVersion: String
    public let userFacing: TrainingDecisionUserFacing
    public let hiddenDebugSignals: HiddenDebugSignals
    public let parityGolden: ParityGoldenEnvelope?

    // --- Expanded-projection only (optional so narrow decodes) ---
    public let sessionIntent: String?
    public let activePhase: String?
    public let riskLevel: String?
    public let volumeMode: String?
    public let intensityMode: String?
    public let progressionMode: String?
    public let trainingMode: String?
    public let finalVolumeMultiplier: Double?
    public let progressClarityTripletSuppressed: Bool?
    public let weeklyBlockReasons: [String]?
    public let exerciseRoleFloors: [String: Int]?
    public let perExercise: [PerExerciseSummary]?
    public let allTargetSets: [Int]?
    public let minTargetSets: Int?
    public let weeklyAdjustment: WeeklyAdjustment?
    public let effectivePhase: EffectivePhaseSummary?
    public let cleanInput: CleanInputEvidence?
    public let inputEvidence: InputEvidence?

    /// Forward-compat carrier for any top-level golden key not modelled above.
    public let unknown: OrderedJSONObject

    // ---- Typed enum accessors (never fail decode; nil on unknown value) ----
    public var decisionVersionEnum: DecisionVersion? { DecisionVersion(rawValue: decisionVersion) }
    public var sessionIntentEnum: SessionIntent? { sessionIntent.flatMap(SessionIntent.init(rawValue:)) }
    public var activePhaseEnum: ActivePhase? { activePhase.flatMap(ActivePhase.init(rawValue:)) }
    public var riskLevelEnum: RiskLevel? { riskLevel.flatMap(RiskLevel.init(rawValue:)) }
    public var volumeModeEnum: VolumeMode? { volumeMode.flatMap(VolumeMode.init(rawValue:)) }
    public var intensityModeEnum: IntensityMode? { intensityMode.flatMap(IntensityMode.init(rawValue:)) }
    public var progressionModeEnum: ProgressionMode? { progressionMode.flatMap(ProgressionMode.init(rawValue:)) }

    /// True when this golden is the narrow normal-session projection (no
    /// top-level engine fields beyond the always-present set).
    public var isNarrowProjection: Bool { sessionIntent == nil && activePhase == nil }

    private static let modelledKeys: Set<String> = [
        "sourceFixtureId", "decisionVersion", "userFacing", "hiddenDebugSignals", "parityGolden",
        "sessionIntent", "activePhase", "riskLevel", "volumeMode", "intensityMode", "progressionMode",
        "trainingMode", "finalVolumeMultiplier", "progressClarityTripletSuppressed", "weeklyBlockReasons",
        "exerciseRoleFloors", "perExercise", "allTargetSets", "minTargetSets", "weeklyAdjustment",
        "effectivePhase", "cleanInput", "inputEvidence",
    ]

    public init(decoding value: JSONValue) throws {
        let obj = try value.requireObject("TrainingDecision")

        self.sourceFixtureId = try obj.requireString("sourceFixtureId", "TrainingDecision")
        self.decisionVersion = try obj.requireString("decisionVersion", "TrainingDecision")

        guard let uf = obj.rawValue("userFacing") else {
            throw TrainingDecisionDecodeError.missingKey("userFacing", context: "TrainingDecision")
        }
        self.userFacing = try TrainingDecisionUserFacing(decoding: uf)

        guard let hidden = obj.rawValue("hiddenDebugSignals") else {
            throw TrainingDecisionDecodeError.missingKey("hiddenDebugSignals", context: "TrainingDecision")
        }
        self.hiddenDebugSignals = try HiddenDebugSignals(decoding: hidden)

        if let pg = obj.rawValue("parityGolden"), !pg.isNull {
            self.parityGolden = try ParityGoldenEnvelope(decoding: pg)
        } else {
            self.parityGolden = nil
        }

        self.sessionIntent = obj.optionalString("sessionIntent")
        self.activePhase = obj.optionalString("activePhase")
        self.riskLevel = obj.optionalString("riskLevel")
        self.volumeMode = obj.optionalString("volumeMode")
        self.intensityMode = obj.optionalString("intensityMode")
        self.progressionMode = obj.optionalString("progressionMode")
        self.trainingMode = obj.optionalString("trainingMode")
        self.finalVolumeMultiplier = obj.optionalDouble("finalVolumeMultiplier")
        self.progressClarityTripletSuppressed = obj.optionalBool("progressClarityTripletSuppressed")
        self.weeklyBlockReasons = obj.optionalStringArray("weeklyBlockReasons")
        self.allTargetSets = obj.optionalIntArray("allTargetSets")
        self.minTargetSets = obj.optionalInt("minTargetSets")

        if let floors = obj.optionalObject("exerciseRoleFloors") {
            var map: [String: Int] = [:]
            for key in floors.keys {
                if let n = floors.optionalInt(key) { map[key] = n }
            }
            self.exerciseRoleFloors = map
        } else {
            self.exerciseRoleFloors = nil
        }

        if let arr = obj.optionalArray("perExercise") {
            self.perExercise = try arr.map { try PerExerciseSummary(decoding: $0) }
        } else {
            self.perExercise = nil
        }

        if let wa = obj.rawValue("weeklyAdjustment"), !wa.isNull {
            self.weeklyAdjustment = try WeeklyAdjustment(decoding: wa)
        } else {
            self.weeklyAdjustment = nil
        }

        if let ep = obj.rawValue("effectivePhase"), !ep.isNull {
            self.effectivePhase = try EffectivePhaseSummary(decoding: ep)
        } else {
            self.effectivePhase = nil
        }

        if let ci = obj.rawValue("cleanInput"), !ci.isNull {
            self.cleanInput = try CleanInputEvidence(decoding: ci)
        } else {
            self.cleanInput = nil
        }

        if let ie = obj.rawValue("inputEvidence"), !ie.isNull {
            self.inputEvidence = try InputEvidence(decoding: ie)
        } else {
            self.inputEvidence = nil
        }

        // Preserve any unmodelled top-level key for forward compatibility.
        let extras = obj.entries.filter { !TrainingDecision.modelledKeys.contains($0.key) }
        self.unknown = OrderedJSONObject(entries: extras)
    }

    /// Decode directly from raw golden bytes.
    public init(decodingData data: Data) throws {
        try self.init(decoding: JSONValue(decoding: data))
    }
}
