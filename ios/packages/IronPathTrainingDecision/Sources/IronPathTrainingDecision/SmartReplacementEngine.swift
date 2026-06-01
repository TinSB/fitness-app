// SR-3 — Smart Replacement Engine (pure logic port).
//
// Faithful, line-by-line Swift transcription of the TOP-LEVEL smart-replacement
// engine in src/engines/smartReplacementEngine.ts — `buildSmartReplacementRecommendations`
// (smartReplacementEngine.ts:470-525) and every private helper it transitively
// needs (smartReplacementEngine.ts:62-468).
//
// It CONSUMES the already-ported lower layers and re-ports nothing they own:
//   • SR-1 ExerciseLibrary       — EXERCISE_DISPLAY_NAMES (displayNames) +
//     formatExerciseDisplayName (the engine of formatExerciseName, which is just
//     `formatExerciseDisplayName(value, { fallback })` — formatters.ts:492-494,
//     re-exported through src/data/trainingData.ts).
//   • SR-2 ReplacementEngine     — buildReplacementOptions / validateReplacementExerciseId
//     / isSyntheticReplacementExerciseId.
//   • SR-2 ReplacementEngineKnowledge — EXERCISE_EQUIVALENCE_CHAINS (id+members) +
//     the fatigueCost / equivalenceChainId / alternativeIds / alternativePriorities
//     slice of EXERCISE_KNOWLEDGE_OVERRIDES.
//   • SR-3 SmartReplacementKnowledge — the ADDITIONAL override fields
//     (movementPattern / primaryMuscles / skillDemand / kind / contraindications).
//
// It is PURE: no IO, no clock, no `: Date`, no randomness. It does NOT port the
// WRITE PATH (applyExerciseReplacement / restoreOriginalExercise — those are the
// session-mutating functions, SR-4 integration).
//
// Output is reconciled against the generated smart-replacement parity goldens
// (smart-replacement/*; SmartReplacementEngineParityTests): the TS generator runs
// the REAL engine over each fixture's `params` and the Swift port must reproduce
// the SAME SmartReplacementRecommendation[] item-by-item + in order.
//
// FAITHFULNESS NOTES (verified against the committed goldens):
//   • The final sort tiebreak is `localeCompare(other, 'zh-Hans-CN')`
//     (smartReplacementEngine.ts:466, :521) — a Chinese PINYIN collation. It is
//     reproduced via Foundation's ICU locale-aware compare with
//     Locale("zh-Hans-CN"). The display names are unique, so the comparator never
//     reports two distinct recommendations as equal.
//   • JS `Array.prototype.sort` is STABLE; Swift `sorted(by:)` is not — so both
//     sorts go through `stableSorted`, which breaks comparator ties on the
//     pre-sort index, byte-faithfully mirroring the JS stable sorts (only relevant
//     in the unavailable-equipment realignment, where indices/priorities can tie).
//   • `new Map()` preserves insertion order and `Map.set` on an existing key keeps
//     its slot — reproduced by `InsertionOrderedMap`. The candidate map's order
//     does not reach the output (the result is re-sorted by priority/fatigue/name)
//     but it is preserved verbatim for transcription fidelity.

import Foundation
import IronPathDomain

// MARK: - Public input types
//
// The `SmartReplacementParams` shape (smartReplacementEngine.ts:40-50) and its
// loose exercise/pattern/feedback/session sub-shapes. Every field the engine
// reads is modelled; a field is nil exactly when the param object omits it.

/// The loose exercise object (smartReplacementEngine.ts:33-38 `SmartReplacementExercise`):
/// a partial bag of the id-identity fields + the descriptive knowledge fields the
/// engine reads. Used for the current exercise, library items, and merged metadata.
public struct SmartReplacementExercise: Equatable, Sendable {
    public var id: String?
    public var name: String?
    public var baseId: String?
    public var canonicalExerciseId: String?
    public var actualExerciseId: String?
    public var replacementExerciseId: String?
    public var primaryMuscles: [String]?
    public var muscle: String?
    public var movementPattern: String?
    public var equivalenceChainId: String?
    public var fatigueCost: String?
    public var skillDemand: String?
    public var kind: String?
    public var contraindications: [String]?
    public var alternativeIds: [String]?
    public var alternativePriorities: [String: String]?

    public init() {}

    /// `{ ...self, ...source }` — overlay every field the `source` object actually
    /// carries (a present key wins, mirroring the JS object spread). Absent keys
    /// (nil here) do not overwrite.
    fileprivate mutating func overlay(_ source: SmartReplacementExercise) {
        if let v = source.id { id = v }
        if let v = source.name { name = v }
        if let v = source.baseId { baseId = v }
        if let v = source.canonicalExerciseId { canonicalExerciseId = v }
        if let v = source.actualExerciseId { actualExerciseId = v }
        if let v = source.replacementExerciseId { replacementExerciseId = v }
        if let v = source.primaryMuscles { primaryMuscles = v }
        if let v = source.muscle { muscle = v }
        if let v = source.movementPattern { movementPattern = v }
        if let v = source.equivalenceChainId { equivalenceChainId = v }
        if let v = source.fatigueCost { fatigueCost = v }
        if let v = source.skillDemand { skillDemand = v }
        if let v = source.kind { kind = v }
        if let v = source.contraindications { contraindications = v }
        if let v = source.alternativeIds { alternativeIds = v }
        if let v = source.alternativePriorities { alternativePriorities = v }
    }
}

/// `SmartReplacementExercise | string` — the current exercise / a library item can
/// be a bare id string or an exercise object (smartReplacementEngine.ts:41-42).
public enum SmartReplacementExerciseRef: Sendable {
    case id(String)
    case object(SmartReplacementExercise)
}

/// `PainPattern` (training-model.ts) — only the fields the engine reads.
public struct SmartReplacementPainPattern: Sendable {
    public var area: String
    public var exerciseId: String?
    public var severityAvg: Double?
    public var suggestedAction: String?
    public init(area: String, exerciseId: String? = nil, severityAvg: Double? = nil, suggestedAction: String? = nil) {
        self.area = area
        self.exerciseId = exerciseId
        self.severityAvg = severityAvg
        self.suggestedAction = suggestedAction
    }
}

/// `ReadinessResult` (training-model.ts) — only level / score / trainingAdjustment
/// are read (hasHighFatigueSignal, smartReplacementEngine.ts:194-195).
public struct SmartReplacementReadinessResult: Sendable {
    public var level: String?
    public var score: Double?
    public var trainingAdjustment: String?
    public init(level: String? = nil, score: Double? = nil, trainingAdjustment: String? = nil) {
        self.level = level
        self.score = score
        self.trainingAdjustment = trainingAdjustment
    }
}

/// `LoadFeedback` (training-model.ts) — one per-exercise feedback record.
public struct SmartReplacementLoadFeedback: Sendable {
    public var exerciseId: String?
    public var feedback: String?
    public init(exerciseId: String? = nil, feedback: String? = nil) {
        self.exerciseId = exerciseId
        self.feedback = feedback
    }
}

/// The `loadFeedback` param union (smartReplacementEngine.ts:45): a bare value, an
/// array of LoadFeedback, or an `{ dominantFeedback / feedback / adjustment }` object.
public enum SmartReplacementLoadFeedbackInput: Sendable {
    case value(String)
    case list([SmartReplacementLoadFeedback])
    case object(dominantFeedback: String?, feedback: String?, adjustmentDominantFeedback: String?)
}

/// One set inside a history exercise — only painFlag / painArea / painSeverity read.
public struct SmartReplacementHistorySet: Sendable {
    public var painFlag: Bool?
    public var painArea: String?
    public var painSeverity: Double?
    public init(painFlag: Bool? = nil, painArea: String? = nil, painSeverity: Double? = nil) {
        self.painFlag = painFlag
        self.painArea = painArea
        self.painSeverity = painSeverity
    }
}

/// One history exercise — the id-identity fields + muscle + sets.
public struct SmartReplacementHistoryExercise: Sendable {
    public var id: String?
    public var actualExerciseId: String?
    public var replacementExerciseId: String?
    public var canonicalExerciseId: String?
    public var muscle: String?
    public var sets: [SmartReplacementHistorySet]
    public init(id: String? = nil, actualExerciseId: String? = nil, replacementExerciseId: String? = nil, canonicalExerciseId: String? = nil, muscle: String? = nil, sets: [SmartReplacementHistorySet] = []) {
        self.id = id
        self.actualExerciseId = actualExerciseId
        self.replacementExerciseId = replacementExerciseId
        self.canonicalExerciseId = canonicalExerciseId
        self.muscle = muscle
        self.sets = sets
    }
}

/// One `TrainingSession` (training-model.ts) — only dataFlag / date / exercises /
/// loadFeedback are read by the engine.
public struct SmartReplacementTrainingSession: Sendable {
    public var dataFlag: String?
    public var date: String?
    public var exercises: [SmartReplacementHistoryExercise]
    public var loadFeedback: [SmartReplacementLoadFeedback]
    public init(dataFlag: String? = nil, date: String? = nil, exercises: [SmartReplacementHistoryExercise] = [], loadFeedback: [SmartReplacementLoadFeedback] = []) {
        self.dataFlag = dataFlag
        self.date = date
        self.exercises = exercises
        self.loadFeedback = loadFeedback
    }
}

/// The `exerciseLibrary` param union (smartReplacementEngine.ts:42): an array of
/// refs or an ordered id→ref record.
public enum SmartReplacementLibraryInput: Sendable {
    public struct RecordEntry: Sendable {
        public let key: String
        public let value: SmartReplacementExerciseRef
        public init(key: String, value: SmartReplacementExerciseRef) {
            self.key = key
            self.value = value
        }
    }
    case array([SmartReplacementExerciseRef])
    case record([RecordEntry])
}

/// `SmartReplacementParams` (smartReplacementEngine.ts:40-50).
public struct SmartReplacementParams: Sendable {
    public var currentExercise: SmartReplacementExerciseRef?
    public var exerciseLibrary: SmartReplacementLibraryInput?
    public var painPatterns: [SmartReplacementPainPattern]?
    public var readinessResult: SmartReplacementReadinessResult?
    public var loadFeedback: SmartReplacementLoadFeedbackInput?
    public var trainingHistory: [SmartReplacementTrainingSession]?
    public var equipmentPreferences: [String]?
    public var unavailableEquipment: [ExerciseEquipmentTag]?
    public var trainingLevel: String?

    public init(
        currentExercise: SmartReplacementExerciseRef? = nil,
        exerciseLibrary: SmartReplacementLibraryInput? = nil,
        painPatterns: [SmartReplacementPainPattern]? = nil,
        readinessResult: SmartReplacementReadinessResult? = nil,
        loadFeedback: SmartReplacementLoadFeedbackInput? = nil,
        trainingHistory: [SmartReplacementTrainingSession]? = nil,
        equipmentPreferences: [String]? = nil,
        unavailableEquipment: [ExerciseEquipmentTag]? = nil,
        trainingLevel: String? = nil
    ) {
        self.currentExercise = currentExercise
        self.exerciseLibrary = exerciseLibrary
        self.painPatterns = painPatterns
        self.readinessResult = readinessResult
        self.loadFeedback = loadFeedback
        self.trainingHistory = trainingHistory
        self.equipmentPreferences = equipmentPreferences
        self.unavailableEquipment = unavailableEquipment
        self.trainingLevel = trainingLevel
    }
}

// MARK: - Engine

/// The smart-replacement engine. A namespace enum (no instances); all static.
public enum SmartReplacementEngine {

    // MARK: Candidate (the mutable scoring record — smartReplacementEngine.ts:52-60)
    //
    // A reference type so applyContextScoring mutates each candidate in place,
    // matching the JS object reference semantics (smartReplacementEngine.ts:492).
    fileprivate enum CandidateSource: String { case explicit, chain, similar, avoid }

    fileprivate final class Candidate {
        let id: String
        var metadata: SmartReplacementExercise
        var explicitPriority: String?
        var source: CandidateSource
        var score: Int
        var warnings: [String]
        var reasons: [String]

        init(id: String, metadata: SmartReplacementExercise, explicitPriority: String?, source: CandidateSource, score: Int, warnings: [String], reasons: [String]) {
            self.id = id
            self.metadata = metadata
            self.explicitPriority = explicitPriority
            self.source = source
            self.score = score
            self.warnings = warnings
            self.reasons = reasons
        }
    }

    // MARK: Constant tables (smartReplacementEngine.ts:62-73)

    /// fatigueRank (smartReplacementEngine.ts:62-66).
    fileprivate static func fatigueRank(_ value: String) -> Int {
        switch value {
        case "low": return 0
        case "medium": return 1
        case "high": return 2
        default: return 1  // unreachable: only the typed low/medium/high reach here.
        }
    }

    /// priorityOrder (smartReplacementEngine.ts:68-73).
    fileprivate static func priorityOrder(_ value: SmartReplacementPriority) -> Int {
        switch value {
        case .primary: return 0
        case .secondary: return 1
        case .angleVariation: return 2
        case .avoid: return 3
        }
    }

    // MARK: String helpers (smartReplacementEngine.ts:75-88)

    /// `normalizeKey` (smartReplacementEngine.ts:75-79).
    fileprivate static func normalizeKey(_ value: String?) -> String {
        let s = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return regexReplaceAll(s, "[\\s_-]+", "")
    }

    /// `normalizeText` (smartReplacementEngine.ts:81-86).
    fileprivate static func normalizeText(_ value: String?) -> String {
        var s = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        s = regexReplaceAll(s, "[（(].*?[)）]", "")
        s = regexReplaceAll(s, "[\\s_\\-·,，。/|]+", "")
        return s
    }

    /// `isChinese` (smartReplacementEngine.ts:88) — `/[㐀-鿿]/`.
    fileprivate static func isChinese(_ value: String?) -> Bool {
        guard let value else { return false }
        return value.unicodeScalars.contains { $0.value >= 0x3400 && $0.value <= 0x9fff }
    }

    // MARK: Identity + merge helpers (smartReplacementEngine.ts:90-137)

    /// `getExerciseId` (smartReplacementEngine.ts:90-101). `||`-truthy chain: an
    /// empty string is falsy and falls through, exactly as in TS.
    fileprivate static func getExerciseId(_ ref: SmartReplacementExerciseRef?) -> String {
        guard let ref else { return "" }
        switch ref {
        case .id(let s): return s
        case .object(let e):
            return firstTruthy([e.actualExerciseId, e.replacementExerciseId, e.canonicalExerciseId, e.baseId, e.id])
        }
    }

    /// `getOverride` (smartReplacementEngine.ts:105) — assembled from the consumed
    /// SR-2 replacement knowledge (fatigueCost / equivalenceChainId / alternativeIds
    /// / alternativePriorities) + the SR-3 additional fields. Returns an empty bag
    /// for an unknown id (`EXERCISE_KNOWLEDGE_OVERRIDES[id] || {}`).
    fileprivate static func getOverride(_ id: String) -> SmartReplacementExercise {
        var ex = SmartReplacementExercise()
        if let k = ReplacementEngineKnowledge.knowledge[id] {
            ex.fatigueCost = k.fatigueCost
            ex.equivalenceChainId = k.equivalenceChainId
            ex.alternativeIds = k.alternativeIds
            ex.alternativePriorities = k.alternativePriorities
        }
        if let ov = SmartReplacementKnowledge.overrides[id] {
            ex.movementPattern = ov.movementPattern
            ex.primaryMuscles = ov.primaryMuscles
            ex.skillDemand = ov.skillDemand
            ex.kind = ov.kind
            ex.contraindications = ov.contraindications
        }
        return ex
    }

    /// `mergeExercise` (smartReplacementEngine.ts:107-115):
    /// `{ id, name: DISPLAY[id] || source.name, ...getOverride(id), ...source }`.
    fileprivate static func mergeExercise(_ id: String, _ exercise: SmartReplacementExercise? = nil) -> SmartReplacementExercise {
        let source = exercise
        var merged = getOverride(id)
        merged.id = id
        // name: EXERCISE_DISPLAY_NAMES[id] || source.name  (override carries no `name`,
        // so the override spread does not touch it; the source spread can override it).
        merged.name = ExerciseLibrary.displayNames[id] ?? source?.name
        if let source { merged.overlay(source) }
        return merged
    }

    /// `buildLibraryMap` (smartReplacementEngine.ts:117-137). Seeds from the override
    /// id universe (TS `Object.keys(EXERCISE_KNOWLEDGE_OVERRIDES)`), then layers the
    /// `exerciseLibrary` param (array or record). `InsertionOrderedMap.set` keeps a
    /// key's slot on update, mirroring `Map.set`.
    fileprivate static func buildLibraryMap(_ exerciseLibrary: SmartReplacementLibraryInput?) -> InsertionOrderedMap<SmartReplacementExercise> {
        var map = InsertionOrderedMap<SmartReplacementExercise>()

        for id in SmartReplacementKnowledge.overrideIds {
            if ReplacementEngine.validateReplacementExerciseId(id) { map.set(id, mergeExercise(id)) }
        }

        switch exerciseLibrary {
        case .array(let items):
            for item in items {
                let id = getExerciseId(item)
                if !id.isEmpty && ReplacementEngine.validateReplacementExerciseId(id) {
                    map.set(id, mergeExercise(id, sourceExercise(item)))
                }
            }
        case .record(let entries):
            for entry in entries {
                // `getExerciseId(item) || key`
                let resolved = getExerciseId(entry.value)
                let id = resolved.isEmpty ? entry.key : resolved
                if !id.isEmpty && ReplacementEngine.validateReplacementExerciseId(id) {
                    map.set(id, mergeExercise(id, sourceExercise(entry.value)))
                }
            }
        case .none:
            break
        }

        return map
    }

    /// The `typeof exercise === 'object' && exercise ? exercise : {}` source object
    /// (smartReplacementEngine.ts:108): a ref string carries no source bag.
    fileprivate static func sourceExercise(_ ref: SmartReplacementExerciseRef) -> SmartReplacementExercise? {
        if case .object(let e) = ref { return e }
        return nil
    }

    // MARK: Knowledge readers (smartReplacementEngine.ts:139-167)

    /// `getFatigueCost` (smartReplacementEngine.ts:139-142).
    fileprivate static func getFatigueCost(_ value: String?) -> String {
        if value == "low" || value == "medium" || value == "high" { return value! }
        return "medium"
    }

    /// `getSkillDemand` (smartReplacementEngine.ts:144-147).
    fileprivate static func getSkillDemand(_ value: String?) -> String {
        if value == "low" || value == "medium" || value == "high" { return value! }
        return "medium"
    }

    /// `getPrimaryMuscles` (smartReplacementEngine.ts:149-153).
    fileprivate static func getPrimaryMuscles(_ exercise: SmartReplacementExercise) -> [String] {
        let primary = (exercise.primaryMuscles ?? []).filter { !$0.isEmpty }
        if !primary.isEmpty { return primary }
        if let muscle = exercise.muscle, !muscle.isEmpty { return [muscle] }
        return []
    }

    /// `hasSharedMuscle` (smartReplacementEngine.ts:155-159).
    fileprivate static func hasSharedMuscle(_ left: SmartReplacementExercise, _ right: SmartReplacementExercise) -> Bool {
        let leftMuscles = getPrimaryMuscles(left).map(normalizeText)
        let rightMuscles = getPrimaryMuscles(right).map(normalizeText)
        return leftMuscles.contains { rightMuscles.contains($0) }
    }

    /// `samePattern` (smartReplacementEngine.ts:161-162).
    fileprivate static func samePattern(_ left: SmartReplacementExercise, _ right: SmartReplacementExercise) -> Bool {
        let l = normalizeText(left.movementPattern)
        return !l.isEmpty && l == normalizeText(right.movementPattern)
    }

    /// `chainForExercise` (smartReplacementEngine.ts:164-167):
    /// `Object.values(EXERCISE_EQUIVALENCE_CHAINS).find(c => c.id === ex.equivalenceChainId || c.members.includes(id))`.
    fileprivate static func chainForExercise(_ id: String, _ exercise: SmartReplacementExercise) -> ReplacementEquivalenceChain? {
        for (_, chain) in ReplacementEngineKnowledge.equivalenceChainEntries {
            let idMatch = (exercise.equivalenceChainId != nil) && (chain.id == exercise.equivalenceChainId)
            if idMatch || chain.members.contains(id) { return chain }
        }
        return nil
    }

    // MARK: Priority mapping + candidate dedup (smartReplacementEngine.ts:169-192)

    /// `mapExplicitPriority` (smartReplacementEngine.ts:169-175).
    fileprivate static func mapExplicitPriority(_ value: String?) -> SmartReplacementPriority? {
        if value == "priority" || value == "primary" { return .primary }
        if value == "optional" || value == "secondary" { return .secondary }
        if value == "angle" || value == "angle_variation" { return .angleVariation }
        if value == "not_recommended" || value == "avoid" { return .avoid }
        return nil
    }

    /// `addCandidate` (smartReplacementEngine.ts:177-182).
    fileprivate static func addCandidate(_ map: inout InsertionOrderedMap<Candidate>, _ candidate: Candidate) {
        let previous = map.get(candidate.id)
        if previous == nil || candidate.score > previous!.score || previous!.source == .similar {
            map.set(candidate.id, candidate)
        }
    }

    /// `getEquipmentType` (smartReplacementEngine.ts:184-192).
    fileprivate static func getEquipmentType(_ id: String, _ exercise: SmartReplacementExercise) -> String {
        let text = normalizeKey("\(id) \(exercise.kind ?? "") \(exercise.name ?? "")")
        if text.contains("machine") { return "machine" }
        if text.contains("cable") { return "cables" }
        if text.contains("db") || text.contains("dumbbell") { return "dumbbell" }
        if text.contains("barbell") || id == "bench-press" || id == "squat" || id == "deadlift" { return "barbell" }
        if text.contains("pushup") || text.contains("pullup") || text.contains("bodyweight") { return "bodyweight" }
        return ""
    }

    // MARK: Context collectors (smartReplacementEngine.ts:194-247)

    /// `hasHighFatigueSignal` (smartReplacementEngine.ts:194-195).
    fileprivate static func hasHighFatigueSignal(_ readinessResult: SmartReplacementReadinessResult?) -> Bool {
        guard let r = readinessResult else { return false }
        if r.level == "low" { return true }
        if r.trainingAdjustment == "conservative" || r.trainingAdjustment == "recovery" { return true }
        if let score = r.score, score < 65 { return true }
        return false
    }

    /// `feedbackValuesFromInput` (smartReplacementEngine.ts:197-202).
    fileprivate static func feedbackValuesFromInput(_ loadFeedback: SmartReplacementLoadFeedbackInput?) -> [String] {
        guard let loadFeedback else { return [] }
        switch loadFeedback {
        case .value(let v):
            if v == "too_light" || v == "good" || v == "too_heavy" { return [v] }
            // A non-LoadFeedbackValue string falls through to the object branch in TS,
            // where dominantFeedback/feedback/adjustment are all undefined → [].
            return []
        case .list(let items):
            return items.compactMap { $0.feedback }.filter { !$0.isEmpty }
        case .object(let dominant, let feedback, let adjustmentDominant):
            return [dominant, feedback, adjustmentDominant].compactMap { $0 }.filter { !$0.isEmpty }
        }
    }

    /// `collectRecentExerciseFeedback` (smartReplacementEngine.ts:204-209).
    fileprivate static func collectRecentExerciseFeedback(_ trainingHistory: [SmartReplacementTrainingSession]?, _ exerciseId: String) -> [SmartReplacementLoadFeedback] {
        let sessions = (trainingHistory ?? []).filter { $0.dataFlag != "test" && $0.dataFlag != "excluded" }
        let all = sessions.flatMap { $0.loadFeedback }.filter { $0.exerciseId == exerciseId }
        return Array(all.suffix(5))  // .slice(-5)
    }

    /// `collectHistoryPainPatterns` (smartReplacementEngine.ts:211-238).
    fileprivate static func collectHistoryPainPatterns(_ trainingHistory: [SmartReplacementTrainingSession]?) -> [SmartReplacementPainPattern] {
        var patterns = InsertionOrderedMap<SmartReplacementPainPattern>()
        let sessions = (trainingHistory ?? [])
            .filter { $0.dataFlag != "test" && $0.dataFlag != "excluded" }
            .prefix(12)  // .slice(0, 12)
        for session in sessions {
            for exercise in session.exercises {
                let sets = exercise.sets
                for set in sets where (set.painFlag ?? false) {
                    // exercise.actualExerciseId || replacementExerciseId || canonicalExerciseId || id
                    let exerciseId = firstTruthyOptional([exercise.actualExerciseId, exercise.replacementExerciseId, exercise.canonicalExerciseId, exercise.id])
                    // String(set.painArea || exercise.muscle || '相关部位')
                    let area = firstTruthy([set.painArea, exercise.muscle, "相关部位"])
                    let key = "\(exerciseId ?? "undefined"):\(area)"
                    let previous = patterns.get(key)
                    // Math.max(previous?.severityAvg || 0, Number(set.painSeverity || 2))
                    let severityCandidate = set.painSeverity ?? 2  // Number(set.painSeverity || 2)
                    let severityAvg = max(previous?.severityAvg ?? 0, severityCandidate)
                    patterns.set(key, SmartReplacementPainPattern(
                        area: area,
                        exerciseId: exerciseId,
                        severityAvg: severityAvg,
                        suggestedAction: "substitute"
                    ))
                }
            }
        }
        return patterns.values
    }

    /// `painMatchesExercise` (smartReplacementEngine.ts:240-247).
    fileprivate static func painMatchesExercise(_ pattern: SmartReplacementPainPattern, _ id: String, _ exercise: SmartReplacementExercise) -> Bool {
        if let pid = pattern.exerciseId, !pid.isEmpty, pid == id { return true }
        let area = normalizeText(pattern.area)
        if area.isEmpty { return false }
        let muscles = getPrimaryMuscles(exercise).map(normalizeText)
        if muscles.contains(where: { !$0.isEmpty && (area.contains($0) || $0.contains(area)) }) { return true }
        return (exercise.contraindications ?? []).filter { !$0.isEmpty }.contains { normalizeText($0).contains(area) }
    }

    // MARK: buildBaseCandidates (smartReplacementEngine.ts:249-310)

    fileprivate static func buildBaseCandidates(_ currentId: String, _ currentMetadata: SmartReplacementExercise, _ library: InsertionOrderedMap<SmartReplacementExercise>) -> [Candidate] {
        var candidates = InsertionOrderedMap<Candidate>()
        let priorityMap = currentMetadata.alternativePriorities ?? [:]
        let explicitAlternativeIds = (currentMetadata.alternativeIds ?? []).filter { !$0.isEmpty }

        for (index, id) in explicitAlternativeIds.enumerated() {
            if id == currentId || ReplacementEngine.isSyntheticReplacementExerciseId(id) || !ReplacementEngine.validateReplacementExerciseId(id) { continue }
            let explicitPriority = priorityMap[id]
            let mappedPriority = mapExplicitPriority(explicitPriority)
            let score: Int
            switch mappedPriority {
            case .primary: score = 120 - index
            case .angleVariation: score = 72 - index
            case .avoid: score = -100
            default: score = 90 - index
            }
            addCandidate(&candidates, Candidate(
                id: id,
                metadata: library.get(id) ?? mergeExercise(id),
                explicitPriority: explicitPriority,
                source: mappedPriority == .avoid ? .avoid : .explicit,
                score: score,
                warnings: mappedPriority == .avoid ? ["这个动作与当前目标差异较大，本次不建议作为主要替代。"] : [],
                reasons: []
            ))
        }

        // Object.entries(priorityMap) — preserve the alternativePriorities insertion
        // order (the TS Record literal's key order, captured by alternativePrioritiesOrder).
        for (id, priority) in priorityMapEntries(currentMetadata) {
            let mappedPriority = mapExplicitPriority(priority)
            if mappedPriority != .avoid || id == currentId || ReplacementEngine.isSyntheticReplacementExerciseId(id) || !ReplacementEngine.validateReplacementExerciseId(id) { continue }
            addCandidate(&candidates, Candidate(
                id: id,
                metadata: library.get(id) ?? mergeExercise(id),
                explicitPriority: priority,
                source: .avoid,
                score: -120,
                warnings: ["动作模式或主肌群差异较大，本次不建议作为主要替代。"],
                reasons: []
            ))
        }

        let chain = chainForExercise(currentId, currentMetadata)
        for id in (chain?.members ?? []) {
            if id == currentId || candidates.get(id) != nil || ReplacementEngine.isSyntheticReplacementExerciseId(id) || !ReplacementEngine.validateReplacementExerciseId(id) { continue }
            addCandidate(&candidates, Candidate(
                id: id,
                metadata: library.get(id) ?? mergeExercise(id),
                explicitPriority: nil,
                source: .chain,
                score: 82,
                warnings: [],
                reasons: []
            ))
        }

        for (id, exercise) in library.entries {
            if id == currentId || candidates.get(id) != nil || ReplacementEngine.isSyntheticReplacementExerciseId(id) || !ReplacementEngine.validateReplacementExerciseId(id) { continue }
            if !samePattern(currentMetadata, exercise) && !hasSharedMuscle(currentMetadata, exercise) { continue }
            addCandidate(&candidates, Candidate(
                id: id,
                metadata: exercise,
                explicitPriority: nil,
                source: .similar,
                score: samePattern(currentMetadata, exercise) ? 64 : 42,
                warnings: [],
                reasons: []
            ))
        }

        return candidates.values
    }

    // MARK: applyContextScoring (smartReplacementEngine.ts:312-392)

    fileprivate struct ScoringContext {
        var readinessResult: SmartReplacementReadinessResult?
        var loadFeedbackValues: [String]
        var trainingHistory: [SmartReplacementTrainingSession]?
        var painPatterns: [SmartReplacementPainPattern]
        var equipmentPreferences: [String]
        var trainingLevel: String?
    }

    fileprivate static func applyContextScoring(_ candidate: Candidate, _ currentMetadata: SmartReplacementExercise, _ context: ScoringContext) {
        let fatigueCost = getFatigueCost(candidate.metadata.fatigueCost)
        let skillDemand = getSkillDemand(candidate.metadata.skillDemand)
        let explicitPriority = mapExplicitPriority(candidate.explicitPriority)

        if explicitPriority == .avoid {
            candidate.score -= 80
        }

        if samePattern(currentMetadata, candidate.metadata) {
            candidate.score += 18
            candidate.reasons.append("动作模式接近")
        }

        if hasSharedMuscle(currentMetadata, candidate.metadata) {
            candidate.score += 16
            candidate.reasons.append("主要训练肌群一致")
        }

        if hasHighFatigueSignal(context.readinessResult) {
            if fatigueCost == "low" {
                candidate.score += 18
                candidate.reasons.append("今天更适合低疲劳替代")
            } else if fatigueCost == "medium" {
                candidate.score += 6
            } else {
                candidate.score -= 24
                candidate.warnings.append("当前准备度偏低，高疲劳动作建议谨慎。")
            }
        }

        if context.loadFeedbackValues.contains("too_heavy") {
            if fatigueCost == "low" || candidate.metadata.kind == "machine" {
                candidate.score += 10
                candidate.reasons.append("近期反馈偏重，优先选择更可控的替代")
            } else if fatigueCost == "high" {
                candidate.score -= 14
                candidate.warnings.append("近期反馈偏重，这个动作仍可能偏吃力。")
            }
        }

        let recentCandidateFeedback = collectRecentExerciseFeedback(context.trainingHistory, candidate.id)
        if recentCandidateFeedback.contains(where: { $0.feedback == "too_heavy" }) {
            candidate.score -= 12
            candidate.warnings.append("该动作近期也反馈偏重，建议降低负荷或谨慎选择。")
        }

        let matchedPain = context.painPatterns.filter { painMatchesExercise($0, candidate.id, candidate.metadata) }
        if !matchedPain.isEmpty {
            let severe = matchedPain.contains { $0.suggestedAction == "substitute" || $0.suggestedAction == "deload" || ($0.severityAvg ?? 0) >= 3.5 }
            candidate.score -= severe ? 42 : 18
            candidate.warnings.append("近期不适记录命中相关动作，建议降低优先级。")
        }

        if (context.trainingLevel == "unknown" || context.trainingLevel == "beginner") && skillDemand == "high" {
            candidate.score -= 22
            candidate.warnings.append("动作技术要求较高，训练基线未稳定前建议降低优先级。")
        }

        if !context.equipmentPreferences.isEmpty {
            let equipment = getEquipmentType(candidate.id, candidate.metadata)
            if !equipment.isEmpty && context.equipmentPreferences.map(normalizeKey).contains(normalizeKey(equipment)) {
                candidate.score += 8
                candidate.reasons.append("符合当前器械偏好")
            } else if !equipment.isEmpty {
                candidate.score -= 8
                candidate.warnings.append("可能不符合当前器械偏好。")
            }
        }
    }

    // MARK: Priority + reason resolution (smartReplacementEngine.ts:394-427)

    /// `priorityFromCandidate` (smartReplacementEngine.ts:394-403).
    fileprivate static func priorityFromCandidate(_ candidate: Candidate) -> SmartReplacementPriority {
        let explicit = mapExplicitPriority(candidate.explicitPriority)
        if explicit == .avoid || explicit == .angleVariation { return explicit! }
        if explicit == .primary && candidate.score >= 115 && !candidate.warnings.contains(where: { $0.contains("不适") }) { return .primary }
        if explicit == .secondary && candidate.score >= 60 { return .secondary }
        if candidate.source == .avoid || candidate.score < 25 { return .avoid }
        if candidate.score >= 115 { return .primary }
        if candidate.score >= 72 { return .secondary }
        return .angleVariation
    }

    /// `reasonFromCandidate` (smartReplacementEngine.ts:405-421).
    fileprivate static func reasonFromCandidate(_ candidate: Candidate, _ priority: SmartReplacementPriority) -> String {
        if priority == .avoid {
            return "不建议作为本次主要替代：动作模式或训练重点差异较大，可能偏离原计划刺激。"
        }
        let parts = Array(orderedUnique(candidate.reasons).prefix(3))
        if priority == .primary {
            return parts.isEmpty
                ? "动作模式和训练肌群接近，适合优先替代。"
                : "\(parts.joined(separator: "，"))，适合优先替代。"
        }
        if priority == .secondary {
            return parts.isEmpty
                ? "与原动作训练目标接近，可作为本次可选替代。"
                : "\(parts.joined(separator: "，"))，可作为本次可选替代。"
        }
        return "训练角度或刺激重点略有变化，适合作为角度变化而不是首选替代。"
    }

    /// `appendReason` (smartReplacementEngine.ts:423-427).
    fileprivate static func appendReason(_ reason: String, _ note: String?) -> String {
        let cleanNote = (note ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if cleanNote.isEmpty || reason.contains(cleanNote) { return reason }
        return "\(reason)\(reason.hasSuffix("。") ? "" : "。")\(cleanNote)"
    }

    // MARK: alignWithEquipmentContext (smartReplacementEngine.ts:429-468)

    fileprivate static func alignWithEquipmentContext(
        _ recommendations: [SmartReplacementRecommendation],
        _ currentId: String,
        _ currentMetadata: SmartReplacementExercise,
        _ unavailableEquipment: [ExerciseEquipmentTag]?
    ) -> [SmartReplacementRecommendation] {
        let context = (unavailableEquipment ?? [])
        if context.isEmpty { return recommendations }

        // buildReplacementOptions({ ...currentMetadata, id, baseId, canonicalExerciseId }, { unavailableEquipment })
        let exerciseInput = ReplacementExerciseInput(
            id: currentId,
            baseId: currentMetadata.baseId ?? currentId,
            canonicalExerciseId: currentMetadata.canonicalExerciseId ?? currentId,
            actualExerciseId: currentMetadata.actualExerciseId,
            replacementExerciseId: currentMetadata.replacementExerciseId,
            alternativeIds: currentMetadata.alternativeIds,
            alternativePriorities: currentMetadata.alternativePriorities
        )
        let equipmentOptions = ReplacementEngine.buildReplacementOptions(exerciseInput, context: ReplacementContext(unavailableEquipment: context))
        // new Map(equipmentOptions.map((option, index) => [option.id, { option, index }]))
        var optionById: [String: (option: ReplacementOption, index: Int)] = [:]
        for (index, option) in equipmentOptions.enumerated() where optionById[option.id] == nil {
            optionById[option.id] = (option, index)
        }

        let rewritten = recommendations.map { recommendation -> SmartReplacementRecommendation in
            guard let equipmentOption = optionById[recommendation.exerciseId]?.option else { return recommendation }
            return SmartReplacementRecommendation(
                exerciseId: recommendation.exerciseId,
                exerciseName: recommendation.exerciseName,
                priority: recommendation.priorityEnum ?? .angleVariation,
                fatigueCost: recommendation.fatigueCostEnum ?? .medium,
                reason: appendReason(recommendation.reason, equipmentOption.reason),
                warnings: recommendation.warnings
            )
        }

        return stableSorted(rewritten) { left, right in
            let leftIndex = optionById[left.exerciseId]?.index
            let rightIndex = optionById[right.exerciseId]?.index
            if let l = leftIndex, let r = rightIndex, l != r { return l - r }
            if leftIndex != nil { return -1 }
            if rightIndex != nil { return 1 }
            let priorityDiff = priorityOrder(left.priorityEnum ?? .angleVariation) - priorityOrder(right.priorityEnum ?? .angleVariation)
            if priorityDiff != 0 { return priorityDiff }
            return localeCompareZhHans(left.exerciseName, right.exerciseName)
        }
    }

    // MARK: - Public entry point (smartReplacementEngine.ts:470-525)

    /// `buildSmartReplacementRecommendations` — the faithful Swift port.
    public static func buildSmartReplacementRecommendations(_ params: SmartReplacementParams) -> [SmartReplacementRecommendation] {
        let currentId = getExerciseId(params.currentExercise)
        if currentId.isEmpty || ReplacementEngine.isSyntheticReplacementExerciseId(currentId) || !ReplacementEngine.validateReplacementExerciseId(currentId) {
            return []
        }

        let library = buildLibraryMap(params.exerciseLibrary)
        // mergeExercise(currentId, typeof currentExercise === 'object' && currentExercise ? currentExercise : undefined)
        let currentSource = currentObjectSource(params.currentExercise)
        let currentMetadata = mergeExercise(currentId, currentSource)
        let historyPainPatterns = collectHistoryPainPatterns(params.trainingHistory)
        let allPainPatterns = (params.painPatterns ?? []) + historyPainPatterns
        let loadFeedbackValues = feedbackValuesFromInput(params.loadFeedback)
        let currentHistoryFeedback = collectRecentExerciseFeedback(params.trainingHistory, currentId).compactMap { $0.feedback }

        let candidates = buildBaseCandidates(currentId, currentMetadata, library)
        let context = ScoringContext(
            readinessResult: params.readinessResult,
            loadFeedbackValues: loadFeedbackValues + currentHistoryFeedback,
            trainingHistory: params.trainingHistory,
            painPatterns: allPainPatterns,
            equipmentPreferences: params.equipmentPreferences ?? [],
            trainingLevel: params.trainingLevel
        )
        for candidate in candidates {
            applyContextScoring(candidate, currentMetadata, context)
        }

        let mapped: [SmartReplacementRecommendation] = candidates.map { candidate in
            let priority = priorityFromCandidate(candidate)
            // getFatigueCost always yields a valid low/medium/high raw value.
            let fatigueCost = SmartReplacementFatigueCost(rawValue: getFatigueCost(candidate.metadata.fatigueCost)) ?? .medium
            return SmartReplacementRecommendation(
                exerciseId: candidate.id,
                exerciseName: formatExerciseName(candidate.id, candidate.metadata.name),
                priority: priority,
                fatigueCost: fatigueCost,
                reason: reasonFromCandidate(candidate, priority),
                warnings: orderedUnique(candidate.warnings).filter { isChinese($0) }
            )
        }
        let filtered = mapped.filter { item in
            item.exerciseId != currentId
                && ReplacementEngine.validateReplacementExerciseId(item.exerciseId)
                && !ReplacementEngine.isSyntheticReplacementExerciseId(item.exerciseId)
        }
        let sorted = stableSorted(filtered) { left, right in
            let priorityDiff = priorityOrder(left.priorityEnum ?? .angleVariation) - priorityOrder(right.priorityEnum ?? .angleVariation)
            if priorityDiff != 0 { return priorityDiff }
            let fatigueDiff = fatigueRank(left.fatigueCost) - fatigueRank(right.fatigueCost)
            if fatigueDiff != 0 && hasHighFatigueSignal(params.readinessResult) { return fatigueDiff }
            return localeCompareZhHans(left.exerciseName, right.exerciseName)
        }

        return alignWithEquipmentContext(sorted, currentId, currentMetadata, params.unavailableEquipment)
    }

    // MARK: - Local helpers

    /// `formatExerciseName({ id, name: DISPLAY[id] || metadata.name })`
    /// (smartReplacementEngine.ts:508) → SR-1 formatExerciseDisplayName with the
    /// `{ id, name }` object and the engine's default fallback.
    fileprivate static func formatExerciseName(_ id: String, _ metadataName: String?) -> String {
        let name = ExerciseLibrary.displayNames[id] ?? metadataName
        var entries: [OrderedJSONObject.Entry] = [.init(key: "id", value: .string(id))]
        if let name { entries.append(.init(key: "name", value: .string(name))) }
        return ExerciseLibrary.formatExerciseDisplayName(.object(OrderedJSONObject(entries: entries)), bilingual: false, fallback: "未命名动作")
    }

    /// The current exercise's source bag (object form only) for the mergeExercise call.
    fileprivate static func currentObjectSource(_ ref: SmartReplacementExerciseRef?) -> SmartReplacementExercise? {
        guard let ref else { return nil }
        if case .object(let e) = ref { return e }
        return nil
    }

    /// `Object.entries(currentMetadata.alternativePriorities || {})` order. Swift
    /// dictionaries are unordered; the TS Record iterates in literal insertion order.
    /// The only avoid candidates this branch can add that are not already present
    /// from the explicit-alternativeIds pass would be priorityMap keys absent from
    /// alternativeIds — but in the committed data every alternativePriorities key is
    /// also an alternativeIds entry, so this loop never adds a *new* candidate (it
    /// only re-attempts ones addCandidate already rejected). Order is therefore inert
    /// here; we iterate the dictionary directly.
    fileprivate static func priorityMapEntries(_ currentMetadata: SmartReplacementExercise) -> [(String, String)] {
        (currentMetadata.alternativePriorities ?? [:]).map { ($0.key, $0.value) }
    }

    // MARK: - Pure utility helpers

    /// First non-empty string in the list (JS `a || b || … || ''` truthy chain).
    fileprivate static func firstTruthy(_ values: [String?]) -> String {
        for value in values { if let value, !value.isEmpty { return value } }
        return ""
    }

    /// Like `firstTruthy` but returns nil when every candidate is empty/nil
    /// (mirrors `a || b || c` resolving to `undefined`).
    fileprivate static func firstTruthyOptional(_ values: [String?]) -> String? {
        for value in values { if let value, !value.isEmpty { return value } }
        return nil
    }

    /// `Array.from(new Set(values))` — insertion-ordered de-dup.
    fileprivate static func orderedUnique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for value in values where !seen.contains(value) {
            seen.insert(value)
            out.append(value)
        }
        return out
    }

    /// `a.localeCompare(b, 'zh-Hans-CN')` via Foundation's ICU collation. Returns
    /// -1 / 0 / 1 so callers read like the JS three-way comparator.
    fileprivate static func localeCompareZhHans(_ a: String, _ b: String) -> Int {
        switch a.compare(b, options: [], range: nil, locale: Locale(identifier: "zh-Hans-CN")) {
        case .orderedAscending: return -1
        case .orderedSame: return 0
        case .orderedDescending: return 1
        }
    }

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left
    /// first). Ties (comparator == 0) keep their original relative order, mirroring
    /// `Array.prototype.sort`'s guaranteed stability.
    fileprivate static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }

    /// `String.replace(/pattern/g, replacement)` equivalent.
    fileprivate static func regexReplaceAll(_ input: String, _ pattern: String, _ replacement: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return input }
        let range = NSRange(input.startIndex..<input.endIndex, in: input)
        return regex.stringByReplacingMatches(in: input, options: [], range: range, withTemplate: replacement)
    }
}

// MARK: - Insertion-ordered map (JS `Map` semantics)

/// A minimal ordered map: keys keep their first-insertion slot, and re-setting an
/// existing key updates the value WITHOUT moving it — exactly like a JS `Map`.
fileprivate struct InsertionOrderedMap<Value> {
    private(set) var keyOrder: [String] = []
    private var storage: [String: Value] = [:]

    func get(_ key: String) -> Value? { storage[key] }

    mutating func set(_ key: String, _ value: Value) {
        if storage[key] == nil { keyOrder.append(key) }
        storage[key] = value
    }

    var values: [Value] { keyOrder.map { storage[$0]! } }
    var entries: [(String, Value)] { keyOrder.map { ($0, storage[$0]!) } }
}

// MARK: - SmartReplacementRecommendation producing initializer
//
// SR-0 (SmartReplacementGolden.swift) declared `SmartReplacementRecommendation`
// as a decode-only skeleton with `init(decoding:)` and typed enum accessors. SR-3
// adds — via this same-module extension, leaving the SR-0 file byte-identical — a
// producing initializer so the engine emits the SAME type the golden decodes into.
// Equatable then drives the item-by-item parity assertion (engine output ==
// decoded golden). `unknown` is empty for computed values (the engine emits no
// extra keys), matching the goldens (which carry none).

extension SmartReplacementRecommendation {
    /// Build a recommendation from typed engine values (priority / fatigueCost are
    /// stored as their TS raw-value strings, matching `init(decoding:)`).
    init(
        exerciseId: String,
        exerciseName: String,
        priority: SmartReplacementPriority,
        fatigueCost: SmartReplacementFatigueCost,
        reason: String,
        warnings: [String]
    ) {
        self.exerciseId = exerciseId
        self.exerciseName = exerciseName
        self.priority = priority.rawValue
        self.fatigueCost = fatigueCost.rawValue
        self.reason = reason
        self.warnings = warnings
        self.unknown = OrderedJSONObject(entries: [])
    }
}
