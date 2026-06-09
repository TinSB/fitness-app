// SC-A — recoveryAwareScheduler port (scheduling-track). Faithful, line-by-line Swift
// mirror of `retired web reference` (581 lines). The legacy web schema engine imports
// exactly five things, all already native (REUSED, never re-ported):
//   1. EXERCISE_KNOWLEDGE_OVERRIDES (../data/exerciseLibrary)  — the override slice the
//      body-part path reads (movementPattern / primaryMuscles ← SmartReplacementKnowledge
//      (SR-3); secondaryMuscles / muscleContribution ← ExerciseRecoveryKnowledge (SC-0)),
//      exactly as SC-1b's buildExerciseMeta reuses them. (No override defines a top-level
//      `muscle`/`name`.)
//   2. formatExerciseName / formatTemplateName (../i18n/formatters) — formatExerciseName
//      REUSES ExerciseLibrary.formatExerciseDisplayName (SR-1), identical to SC-1b's helper;
//      formatTemplateName is transcribed LOCALLY (see the formatTemplateName mirror below).
//   3. ExerciseTemplate / ReadinessResult / TrainingTemplate types — RedeDomain (PA-S1)
//      and TrainingDecisionReadiness (iOS-4B).
//   4. number (./engineUtils) — REUSED via E1RMEngine.number (a typed finite-or-0 adapter).
//   5. buildExerciseRecoveryConflict + ExerciseRecoveryConflict[Level] (./exerciseRecoveryConflictEngine)
//      — the SC-1b port (consumed, never re-ported).
//
// `formatMuscleName` is imported by the legacy web schema file (formatters.ts:2) but NEVER referenced — a
// leftover import; intentionally not ported.
//
// formatTemplateName REUSE BOUNDARY: the Swift formatTemplateName lives in RedeL10n
// (PA-S4), but RedeTrainingDecision must NOT gain an IPTD → RedeL10n package edge
// (it would break the acyclic package graph and require a Package.swift edit — forbidden).
// So formatTemplateName is transcribed LOCALLY here, exactly the precedent
// `ProgramAdjustmentEngineSelectDayDiff.swift` set (its own local formatTemplateName mirror,
// :861-958). Both copies mirror the SAME legacy web schema source (formatters.ts:187-208); the recovery-aware
// goldens reconcile it indirectly (every summary / title / reason embeds a template name).
//
// The engine has TWO independent computation paths, both EXPORTED and both parity-pinned:
//   • buildTemplateBodyPartConflictScore — the body-part overlap scorer (local metaForExercise
//     / scoreExerciseForArea / movementScore / levelForScore; NOTE these are DISTINCT from the
//     same-named SC-1b helpers — different merge direction, scores and thresholds).
//   • buildTemplateRecoveryConflict + buildRecoveryAwareRecommendation — consume the SC-1b
//     buildExerciseRecoveryConflict and derive the daily recommendation.
//
// PURE / READ-ONLY: zero `: Date` (the engine carries no clock — readiness/availableTime are
// caller-supplied), no IO, no randomness, no write path, no UI wiring (that is a later slice).
// The three `recovery-aware/*-cases-v1` goldens are GENERATED from the retired legacy engine
// (retired fixture generator, never hand-authored — §22); RecoveryAwareSchedulerParityTests
// compute-asserts each case == golden field-by-field.

import Foundation
import RedeDomain

/// `recoveryAwareScheduler` (recoveryAwareScheduler.ts). A namespace enum (no instances),
/// matching the per-engine convention of this package.
public enum RecoveryAwareScheduler {

    // MARK: - Exported string-union types (recoveryAwareScheduler.ts:11-13)

    /// `DailyRecommendationKind` (ts:11).
    public enum DailyRecommendationKind: String, Equatable, Sendable {
        case train
        case modifiedTrain = "modified_train"
        case rest
        case activeRecovery = "active_recovery"
        case mobilityOnly = "mobility_only"
    }

    /// `RecoveryConflictLevel` (ts:13). The engine's OWN level union — value-identical to,
    /// but a DISTINCT type from, the SC-1b `ExerciseRecoveryConflictEngine.ConflictLevel`.
    public enum RecoveryConflictLevel: String, Equatable, Sendable {
        case none
        case low
        case moderate
        case high
    }

    /// `RecoveryAwareRecommendation['suggestedChanges'][number]` (ts:24-35).
    public struct RecommendationChange: Equatable, Sendable {
        public enum ChangeType: String, Equatable, Sendable {
            case reduceVolume = "reduce_volume"
            case reduceIntensity = "reduce_intensity"
            case substitute
            case skipAccessory = "skip_accessory"
            case avoidMovementPattern = "avoid_movement_pattern"
            case chooseAlternativeTemplate = "choose_alternative_template"
            case rest
        }
        public let type: ChangeType
        public let target: String?  // ts `target?: string` — omitted from JSON when nil
        public let reason: String

        public init(type: ChangeType, target: String?, reason: String) {
            self.type = type
            self.target = target
            self.reason = reason
        }
    }

    /// `RecoveryAwareRecommendation` (ts:15-38).
    public struct RecoveryAwareRecommendation: Equatable, Sendable {
        public let kind: DailyRecommendationKind
        public let templateId: String?    // ts `templateId?: string`
        public let templateName: String?  // ts `templateName?: string`
        public let title: String
        public let summary: String
        public let conflictLevel: RecoveryConflictLevel
        public let affectedAreas: [String]
        public let reasons: [String]
        public let suggestedChanges: [RecommendationChange]
        public let templateRecoveryConflict: TemplateRecoveryConflict?  // ts optional
        public let requiresConfirmationToOverride: Bool

        public init(
            kind: DailyRecommendationKind,
            templateId: String?,
            templateName: String?,
            title: String,
            summary: String,
            conflictLevel: RecoveryConflictLevel,
            affectedAreas: [String],
            reasons: [String],
            suggestedChanges: [RecommendationChange],
            templateRecoveryConflict: TemplateRecoveryConflict?,
            requiresConfirmationToOverride: Bool
        ) {
            self.kind = kind
            self.templateId = templateId
            self.templateName = templateName
            self.title = title
            self.summary = summary
            self.conflictLevel = conflictLevel
            self.affectedAreas = affectedAreas
            self.reasons = reasons
            self.suggestedChanges = suggestedChanges
            self.templateRecoveryConflict = templateRecoveryConflict
            self.requiresConfirmationToOverride = requiresConfirmationToOverride
        }
    }

    /// `TemplateBodyPartConflict` (ts:40-49).
    public struct TemplateBodyPartConflict: Equatable, Sendable {
        /// `conflictingExercises[number]` (ts:44-48).
        public struct ConflictingExercise: Equatable, Sendable {
            public let exerciseId: String
            public let exerciseName: String
            public let reason: String

            public init(exerciseId: String, exerciseName: String, reason: String) {
                self.exerciseId = exerciseId
                self.exerciseName = exerciseName
                self.reason = reason
            }
        }
        public let score: Double
        public let level: RecoveryConflictLevel
        public let affectedAreas: [String]
        public let conflictingExercises: [ConflictingExercise]

        public init(score: Double, level: RecoveryConflictLevel, affectedAreas: [String], conflictingExercises: [ConflictingExercise]) {
            self.score = score
            self.level = level
            self.affectedAreas = affectedAreas
            self.conflictingExercises = conflictingExercises
        }
    }

    /// `TemplateRecoveryConflict['suggestedChanges'][number]` (ts:58-62).
    public struct TemplateChange: Equatable, Sendable {
        public enum ChangeType: String, Equatable, Sendable {
            case reduceVolume = "reduce_volume"
            case reduceIntensity = "reduce_intensity"
            case substitute
            case skipAccessory = "skip_accessory"
            case rest
        }
        public let type: ChangeType
        public let exerciseId: String?  // ts `exerciseId?: string`
        public let reason: String

        public init(type: ChangeType, exerciseId: String?, reason: String) {
            self.type = type
            self.exerciseId = exerciseId
            self.reason = reason
        }
    }

    /// `TemplateRecoveryConflict` (ts:51-64). `conflictingExercises` / `safeExercises` are the
    /// SC-1b `ExerciseRecoveryConflictEngine.Conflict` (== legacy web schema `ExerciseRecoveryConflict`).
    public struct TemplateRecoveryConflict: Equatable, Sendable {
        public let templateId: String
        public let templateName: String
        public let conflictLevel: RecoveryConflictLevel
        public let kind: DailyRecommendationKind
        public let conflictingExercises: [ExerciseRecoveryConflictEngine.Conflict]
        public let safeExercises: [ExerciseRecoveryConflictEngine.Conflict]
        public let suggestedChanges: [TemplateChange]
        public let summary: String

        public init(
            templateId: String,
            templateName: String,
            conflictLevel: RecoveryConflictLevel,
            kind: DailyRecommendationKind,
            conflictingExercises: [ExerciseRecoveryConflictEngine.Conflict],
            safeExercises: [ExerciseRecoveryConflictEngine.Conflict],
            suggestedChanges: [TemplateChange],
            summary: String
        ) {
            self.templateId = templateId
            self.templateName = templateName
            self.conflictLevel = conflictLevel
            self.kind = kind
            self.conflictingExercises = conflictingExercises
            self.safeExercises = safeExercises
            self.suggestedChanges = suggestedChanges
            self.summary = summary
        }
    }

    /// `ExerciseMetaInput` (ts:75-77) — `Partial<Pick<ExerciseTemplate, …>>`. The carrier for an
    /// entry of the external `exerciseLibrary` map (the only override source the body-part path
    /// merges on TOP of EXERCISE_KNOWLEDGE_OVERRIDES). Only the read fields are modelled.
    public struct ExerciseMetaInput: Equatable, Sendable {
        public var id: String?
        public var name: String?
        public var muscle: String?
        public var movementPattern: String?
        public var primaryMuscles: [String]?
        public var secondaryMuscles: [String]?
        public var muscleContribution: [String: Double]?

        public init(
            id: String? = nil,
            name: String? = nil,
            muscle: String? = nil,
            movementPattern: String? = nil,
            primaryMuscles: [String]? = nil,
            secondaryMuscles: [String]? = nil,
            muscleContribution: [String: Double]? = nil
        ) {
            self.id = id
            self.name = name
            self.muscle = muscle
            self.movementPattern = movementPattern
            self.primaryMuscles = primaryMuscles
            self.secondaryMuscles = secondaryMuscles
            self.muscleContribution = muscleContribution
        }
    }

    // MARK: - Internal types (recoveryAwareScheduler.ts:66-73)

    /// `BodyAreaKey` (ts:66).
    enum BodyAreaKey: String {
        case shoulder
        case chest
        case back
        case leg
        case arm
    }

    /// `ConflictSource` (ts:68-73). `source: 'soreness' | 'pain'` is carried as `isPain`.
    struct ConflictSource: Equatable {
        let key: BodyAreaKey
        let label: String
        let weight: Double
        let isPain: Bool
    }

    /// The `metaForExercise` (ts:147-157) return shape, limited to the fields scoreExerciseForArea
    /// reads. (`muscle` is `String?` — Domain optional; the legacy web schema field is a required string.)
    struct ResolvedMeta {
        let id: String
        let muscle: String?
        let movementPattern: String?
        let primaryMuscles: [String]?
        let secondaryMuscles: [String]?
        let muscleContribution: [String: Double]?
    }

    // MARK: - Constant table (recoveryAwareScheduler.ts:100-106)

    /// `areaLabels` (ts:100-106).
    static let areaLabels: [BodyAreaKey: String] = [
        .shoulder: "肩部",
        .chest: "胸部",
        .back: "背部",
        .leg: "腿部",
        .arm: "手臂",
    ]

    // MARK: - String helpers (recoveryAwareScheduler.ts:108-126)

    /// `normalize` (ts:108-111) — `String(value || '').trim().toLowerCase()`.
    static func normalize(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// `includesAny` (ts:113-114). Every token in THIS engine is a plain-substring regex literal
    /// (no anchors/alternation/char-classes) and every `value` is pre-normalized (lowercased), so
    /// `regex.test(value)` collapses to `value.contains(token)` — exact. No call site passes a
    /// non-regex string token, so the `token.toLowerCase()` branch never differs.
    static func includesAny(_ value: String, _ tokens: [String]) -> Bool {
        tokens.contains { value.contains($0) }
    }

    /// `areaKeysFromText` (ts:116-126). DISTINCT from the SC-1b same-named helper: this engine's
    /// `back` matches `row`/`pull` (not `lats`/`腰`/`下背`) and `leg` omits `股四`/`腘绳`. Returns
    /// the matched keys deduped in push order (shoulder, chest, back, leg, arm).
    static func areaKeysFromText(_ value: String?) -> [BodyAreaKey] {
        let text = normalize(value)
        // if (!text || text === 'none' || text === 'no' || text === '无') return [];
        if text.isEmpty || text == "none" || text == "no" || text == "无" { return [] }
        var keys: [BodyAreaKey] = []
        if includesAny(text, ["shoulder", "deltoid", "肩"]) { keys.append(.shoulder) }       // ts:120
        if includesAny(text, ["chest", "pec", "胸"]) { keys.append(.chest) }                  // ts:121
        if includesAny(text, ["back", "lat", "row", "pull", "背"]) { keys.append(.back) }      // ts:122
        if includesAny(text, ["leg", "quad", "hamstring", "glute", "calf", "knee", "hip", "腿", "膝", "髋", "臀", "小腿"]) {
            keys.append(.leg)                                                                  // ts:123
        }
        if includesAny(text, ["arm", "biceps", "triceps", "elbow", "手臂", "二头", "三头", "肘"]) {
            keys.append(.arm)                                                                  // ts:124
        }
        return orderedUnique(keys)                                                             // [...new Set(keys)]
    }

    // MARK: - Source builders (recoveryAwareScheduler.ts:128-145)

    /// `bodyAreasFromValues` (ts:128-136).
    static func bodyAreasFromValues(_ values: [String], isPain: Bool) -> [ConflictSource] {
        values.flatMap { value in
            areaKeysFromText(value).map { key in
                ConflictSource(
                    key: key,
                    label: areaLabels[key] ?? "",
                    weight: isPain ? 1.7 : 1,
                    isPain: isPain
                )
            }
        }
    }

    /// `mergeSources` (ts:138-145). JS `Map`: insertion order kept by FIRST occurrence of each
    /// key; value updated only when a later source has a strictly greater weight.
    static func mergeSources(_ sources: [ConflictSource]) -> [ConflictSource] {
        var order: [BodyAreaKey] = []
        var byKey: [BodyAreaKey: ConflictSource] = [:]
        for source in sources {
            if let existing = byKey[source.key] {
                if source.weight > existing.weight { byKey[source.key] = source }
            } else {
                byKey[source.key] = source
                order.append(source.key)
            }
        }
        return order.compactMap { byKey[$0] }
    }

    // MARK: - Meta build (recoveryAwareScheduler.ts:147-159)

    /// `metaForExercise` (ts:147-157): `{ ...exercise, ...override, ...external, id, name }`. Here
    /// — UNLIKE SC-1b's buildExerciseMeta — the override OVERWRITES the exercise, and the external
    /// `exerciseLibrary` entry overwrites BOTH. The override slice is REUSED from the already-ported
    /// knowledge tables (SR-3 movementPattern/primaryMuscles; SC-0 secondaryMuscles/muscleContribution).
    /// `name` is not read by scoreExerciseForArea (the reason string uses the RAW exercise id/name),
    /// so it is omitted from ResolvedMeta. Each `??` rung models JS spread key-presence precedence:
    /// a knowledge/external value is non-nil exactly when the legacy web schema object defines that key.
    static func metaForExercise(_ exercise: ExerciseTemplate, _ exerciseLibrary: [String: ExerciseMetaInput]?) -> ResolvedMeta {
        let id = exercise.id ?? ""  // id: exercise.id (forced)
        let smr = SmartReplacementKnowledge.overrides[id]   // movementPattern / primaryMuscles
        let rec = ExerciseRecoveryKnowledge.overrides[id]   // secondaryMuscles / muscleContribution
        let external = exerciseLibrary?[id]
        return ResolvedMeta(
            id: id,
            // muscle: no override defines `muscle`; external wins over exercise.
            muscle: external?.muscle ?? exercise.muscle,
            movementPattern: external?.movementPattern ?? smr?.movementPattern ?? exercise.movementPattern,
            primaryMuscles: external?.primaryMuscles ?? smr?.primaryMuscles ?? exercise.primaryMuscles,
            secondaryMuscles: external?.secondaryMuscles ?? rec?.secondaryMuscles ?? exercise.secondaryMuscles,
            muscleContribution: external?.muscleContribution ?? rec?.muscleContribution ?? contributionDict(exercise.muscleContribution)
        )
    }

    /// `exerciseAreaKeys` (ts:159) — `[...new Set(values.flatMap(areaKeysFromText))]`.
    static func exerciseAreaKeys(_ values: [String]) -> [BodyAreaKey] {
        orderedUnique(values.flatMap { areaKeysFromText($0) })
    }

    // MARK: - Scoring (recoveryAwareScheduler.ts:161-198)

    /// `movementScore` (ts:161-173) — the body-part path's LOCAL version (return values 3/2/1 and
    /// `movement = normalize(movementPattern) + ' ' + normalize(exerciseId)`, DISTINCT from SC-1b's).
    static func movementScore(_ area: BodyAreaKey, _ movementPattern: String?, _ exerciseId: String) -> Double {
        let movement = "\(normalize(movementPattern)) \(normalize(exerciseId))"
        if area == .shoulder {
            if includesAny(movement, ["垂直推", "肩外展", "肩胛", "shoulder-press", "lateral-raise", "landmine"]) { return 3 }
            if includesAny(movement, ["水平推", "上斜推", "斜向推", "bench", "press"]) { return 2 }
            if includesAny(movement, ["水平拉", "面拉", "row", "face-pull"]) { return 1 }
        }
        if area == .chest && includesAny(movement, ["水平推", "上斜推", "飞鸟", "bench", "press", "fly"]) { return 3 }
        if area == .back && includesAny(movement, ["拉", "划", "髋铰链", "硬拉", "pull", "row", "deadlift", "rdl"]) { return 3 }
        if area == .leg && includesAny(movement, ["深蹲", "腿举", "髋铰链", "膝", "跖", "髋伸", "squat", "leg", "deadlift", "rdl", "hip"]) { return 3 }
        if area == .arm && includesAny(movement, ["肘", "推", "拉", "curl", "pushdown", "press", "pull", "row"]) { return 2 }
        return 0
    }

    /// A scored area — the `scoreExerciseForArea` (ts:175-191) return shape.
    struct ScoredArea {
        let score: Double
        let reason: String
    }

    /// `scoreExerciseForArea` (ts:175-191).
    static func scoreExerciseForArea(_ exercise: ExerciseTemplate, _ source: ConflictSource, _ exerciseLibrary: [String: ExerciseMetaInput]?) -> ScoredArea {
        let meta = metaForExercise(exercise, exerciseLibrary)
        // primary = exerciseAreaKeys([...(meta.primaryMuscles || []), meta.muscle])
        let primary = exerciseAreaKeys((meta.primaryMuscles ?? []) + [meta.muscle ?? ""])
        // secondary = exerciseAreaKeys([...(meta.secondaryMuscles || []), ...Object.keys(meta.muscleContribution || {})])
        let secondary = exerciseAreaKeys((meta.secondaryMuscles ?? []) + Array((meta.muscleContribution ?? [:]).keys))
        let primaryScore: Double = primary.contains(source.key) ? 3 : 0
        let secondaryScore: Double = secondary.contains(source.key) ? 1.4 : 0
        // Math.min(1.5, number((meta.muscleContribution || {})[areaLabels[source.key].replace('部', '')]) * 1.5)
        let contribKey = (areaLabels[source.key] ?? "").replacingOccurrences(of: "部", with: "")
        let contributionScore = min(1.5, number(meta.muscleContribution?[contribKey]) * 1.5)
        // patternScore = movementScore(source.key, meta.movementPattern, meta.id || exercise.id)
        let patternScore = movementScore(source.key, meta.movementPattern, meta.id.isEmpty ? (exercise.id ?? "") : meta.id)
        let score = (primaryScore + secondaryScore + contributionScore + patternScore) * source.weight
        let reason: String
        if score > 0 {
            // `${formatExerciseName({ id: exercise.id, name: exercise.name })} 与${source.label}${pain?'不适':'酸痛'}存在训练重叠。`
            let name = formatExerciseName(id: exercise.id ?? "", name: exercise.name ?? "")
            reason = "\(name) 与\(source.label)\(source.isPain ? "不适" : "酸痛")存在训练重叠。"
        } else {
            reason = ""
        }
        return ScoredArea(score: score, reason: reason)
    }

    /// `levelForScore` (ts:193-198) — the body-part path's LOCAL thresholds (0.5/4/8 + the
    /// `hasPain && score >= 5` high-bump), DISTINCT from SC-1b's `levelForScore`.
    static func levelForScore(_ score: Double, _ hasPain: Bool) -> RecoveryConflictLevel {
        if score < 0.5 { return .none }
        if score < 4 { return .low }
        if score < 8 && !(hasPain && score >= 5) { return .moderate }
        return .high
    }

    // MARK: - Public: buildTemplateBodyPartConflictScore (recoveryAwareScheduler.ts:200-246)

    /// `buildTemplateBodyPartConflictScore` (ts:200-246).
    public static func buildTemplateBodyPartConflictScore(
        template: TrainingTemplate?,
        sorenessAreas: [String] = [],
        painAreas: [String] = [],
        exerciseLibrary: [String: ExerciseMetaInput]? = nil
    ) -> TemplateBodyPartConflict {
        // if (!template) return { score: 0, level: 'none', affectedAreas: [], conflictingExercises: [] }
        guard let template else {
            return TemplateBodyPartConflict(score: 0, level: .none, affectedAreas: [], conflictingExercises: [])
        }
        let sources = mergeSources(
            bodyAreasFromValues(sorenessAreas, isPain: false) + bodyAreasFromValues(painAreas, isPain: true)
        )
        // if (!sources.length) return { score: 0, ... }
        if sources.isEmpty {
            return TemplateBodyPartConflict(score: 0, level: .none, affectedAreas: [], conflictingExercises: [])
        }

        // conflicts = (template.exercises || []).map(...).filter(score > 0)
        let conflicts: [(exercise: ExerciseTemplate, score: Double, reason: String)] = (template.exercises ?? [])
            .map { exercise -> (exercise: ExerciseTemplate, score: Double, reason: String) in
                // best = sources.map(scoreExerciseForArea).sort((l,r) => r.score - l.score)[0]
                let best = stableSorted(sources.map { scoreExerciseForArea(exercise, $0, exerciseLibrary) }) { left, right in
                    let d = right.score - left.score
                    return d < 0 ? -1 : (d > 0 ? 1 : 0)
                }.first
                // score: best?.score || 0, reason: best?.reason || '' (the `|| 0` / `|| ''` only
                // collapses the 0/NaN/undefined case, all dropped by the `> 0` filter below).
                return (exercise, best?.score ?? 0, best?.reason ?? "")
            }
            .filter { $0.score > 0 }

        // score = Math.round(conflicts.reduce((s, i) => s + i.score, 0) * 10) / 10
        let scoreSum = conflicts.reduce(0.0) { $0 + $1.score }
        let score = jsRound(scoreSum * 10) / 10
        let level = levelForScore(score, !painAreas.isEmpty)

        // conflictingExercises = conflicts.sort((l,r) => r.score - l.score).slice(0, 5).map(...)
        let topConflicts = stableSorted(conflicts) { left, right in
            let d = right.score - left.score
            return d < 0 ? -1 : (d > 0 ? 1 : 0)
        }.prefix(5)
        let conflictingExercises = topConflicts.map { item in
            TemplateBodyPartConflict.ConflictingExercise(
                exerciseId: item.exercise.id ?? "",
                exerciseName: formatExerciseName(id: item.exercise.id ?? "", name: item.exercise.name ?? ""),
                reason: item.reason
            )
        }

        return TemplateBodyPartConflict(
            score: score,
            level: level,
            affectedAreas: sources.map { $0.label },
            conflictingExercises: Array(conflictingExercises)
        )
    }

    // MARK: - Readiness / rank / role helpers (recoveryAwareScheduler.ts:248-265)

    /// `lowReadiness` (ts:248-249) — `score < 50 || trainingAdjustment === 'recovery'`.
    static func lowReadiness(_ readinessResult: ReadinessResult?) -> Bool {
        guard let readinessResult else { return false }
        return readinessResult.score < 50 || readinessResult.trainingAdjustment == .recovery
    }

    /// `conflictRank` (ts:251-256) keyed by the SC-1b `ExerciseRecoveryConflictLevel`.
    static func conflictRank(_ level: ExerciseRecoveryConflictEngine.ConflictLevel) -> Int {
        switch level {
        case .none: return 0
        case .low: return 1
        case .moderate: return 2
        case .high: return 3
        }
    }

    /// `conflictRank` (ts:251-256) keyed by THIS engine's `RecoveryConflictLevel` — legacy web schema indexes the
    /// SAME `conflictRank` map with a RecoveryConflictLevel value (structurally identical string
    /// union) in findLowerConflictTemplate (ts:413); modelled as an overload.
    static func conflictRank(_ level: RecoveryConflictLevel) -> Int {
        switch level {
        case .none: return 0
        case .low: return 1
        case .moderate: return 2
        case .high: return 3
        }
    }

    /// `isMainExercise` (ts:258-263).
    static func isMainExercise(_ exercise: ExerciseTemplate?) -> Bool {
        guard let exercise else { return false }
        if exercise.kind == "isolation" { return false }
        if exercise.fatigueCost == "low" { return false }
        return exercise.kind == "compound" || exercise.kind == "machine" || exercise.fatigueCost == "high" || exercise.fatigueCost == "medium"
    }

    /// `isAccessoryExercise` (ts:265).
    static func isAccessoryExercise(_ exercise: ExerciseTemplate?) -> Bool {
        !isMainExercise(exercise)
    }

    // MARK: - Template-level derivation (recoveryAwareScheduler.ts:267-322)

    /// A paired (exercise, SC-1b conflict) — the `exerciseConflicts` element shape.
    struct ExerciseConflict {
        let exercise: ExerciseTemplate
        let conflict: ExerciseRecoveryConflictEngine.Conflict
    }

    /// `templateLevelFromExerciseConflicts` (ts:267-279).
    static func templateLevelFromExerciseConflicts(_ conflicts: [ExerciseConflict]) -> RecoveryConflictLevel {
        let total = Double(max(1, conflicts.count))
        let high = conflicts.filter { $0.conflict.conflictLevel == .high }
        let moderate = conflicts.filter { $0.conflict.conflictLevel == .moderate }
        let low = conflicts.filter { $0.conflict.conflictLevel == .low }
        let highMainCount = high.filter { isMainExercise($0.exercise) }.count
        let conflictRatio = (Double(high.count) * 2 + Double(moderate.count)) / total

        if high.count >= 3 || highMainCount >= 2 || conflictRatio >= 1.2 { return .high }
        if high.count >= 1 || moderate.count >= 2 || conflictRatio >= 0.55 { return .moderate }
        if moderate.count >= 1 || low.count >= 1 { return .low }
        return .none
    }

    /// `templateKindFromConflict` (ts:281-299).
    static func templateKindFromConflict(
        level: RecoveryConflictLevel,
        conflicts: [ExerciseConflict],
        readinessResult: ReadinessResult?,
        painAreas: [String]
    ) -> DailyRecommendationKind {
        if level == .none || level == .low { return .train }
        let highMainCount = conflicts.filter { $0.conflict.conflictLevel == .high && isMainExercise($0.exercise) }.count
        let hasPain = !painAreas.isEmpty
        let readinessIsLow = lowReadiness(readinessResult)
        if level == .high && readinessIsLow { return hasPain ? .rest : .activeRecovery }
        if level == .high && hasPain && highMainCount >= 2 { return .activeRecovery }
        return .modifiedTrain
    }

    /// `changeForConflict` (ts:301-322).
    static func changeForConflict(conflict: ExerciseRecoveryConflictEngine.Conflict, exercise: ExerciseTemplate) -> TemplateChange? {
        if conflict.conflictLevel == .none || conflict.conflictLevel == .low { return nil }
        if isAccessoryExercise(exercise) {
            return TemplateChange(
                type: conflict.conflictLevel == .high ? .skipAccessory : .reduceVolume,
                exerciseId: exercise.id,
                reason: "\(conflict.exerciseName) 与恢复信号重叠，作为辅助动作可先减少或跳过。"
            )
        }
        // exercise.alternatives?.length || exercise.regressionIds?.length || exercise.alternativeIds?.length
        if (exercise.alternatives?.isEmpty == false) || (exercise.regressionIds?.isEmpty == false) || (exercise.alternativeIds?.isEmpty == false) {
            return TemplateChange(
                type: .substitute,
                exerciseId: exercise.id,
                reason: "\(conflict.exerciseName) 冲突较高，优先考虑低冲突替代动作。"
            )
        }
        return TemplateChange(
            type: conflict.conflictLevel == .high ? .reduceIntensity : .reduceVolume,
            exerciseId: exercise.id,
            reason: "\(conflict.exerciseName) 与恢复信号重叠，本次保持保守。"
        )
    }

    /// `uniqueChanges` (ts:324-332) — dedupe by `${type}:${exerciseId || ''}:${reason}`.
    static func uniqueChanges(_ changes: [TemplateChange]) -> [TemplateChange] {
        var seen = Set<String>()
        var out: [TemplateChange] = []
        for change in changes {
            let key = "\(change.type.rawValue):\(change.exerciseId ?? ""):\(change.reason)"
            if seen.contains(key) { continue }
            seen.insert(key)
            out.append(change)
        }
        return out
    }

    // MARK: - Public: buildTemplateRecoveryConflict (recoveryAwareScheduler.ts:334-382)

    /// `buildTemplateRecoveryConflict` (ts:334-382).
    public static func buildTemplateRecoveryConflict(
        template: TrainingTemplate,
        sorenessAreas: [String] = [],
        painAreas: [String] = [],
        readinessResult: ReadinessResult? = nil
    ) -> TemplateRecoveryConflict {
        let templateName = formatTemplateName(template)
        // exerciseConflicts = (template.exercises || []).map(ex => ({ exercise, conflict: buildExerciseRecoveryConflict(...) }))
        let exerciseConflicts: [ExerciseConflict] = (template.exercises ?? []).map { exercise in
            ExerciseConflict(
                exercise: exercise,
                conflict: ExerciseRecoveryConflictEngine.buildExerciseRecoveryConflict(
                    exercise: toExerciseInput(exercise),
                    sorenessAreas: sorenessAreas,
                    painAreas: painAreas
                )
            )
        }
        // sortedConflicts = [...exerciseConflicts].sort((l,r) => conflictRank[r] - conflictRank[l]) — rank DESC, stable.
        let sortedConflicts = stableSorted(exerciseConflicts) { left, right in
            conflictRank(right.conflict.conflictLevel) - conflictRank(left.conflict.conflictLevel)
        }
        let conflictLevel = templateLevelFromExerciseConflicts(exerciseConflicts)
        let kind = templateKindFromConflict(level: conflictLevel, conflicts: exerciseConflicts, readinessResult: readinessResult, painAreas: painAreas)
        let conflictingExercises = sortedConflicts
            .filter { $0.conflict.conflictLevel == .moderate || $0.conflict.conflictLevel == .high }
            .map { $0.conflict }
        let safeExercises = exerciseConflicts
            .filter { $0.conflict.conflictLevel == .none || $0.conflict.conflictLevel == .low }
            .map { $0.conflict }
        let suggestedChanges = uniqueChanges(
            sortedConflicts.compactMap { changeForConflict(conflict: $0.conflict, exercise: $0.exercise) }
        )
        let topConflict = conflictingExercises.first
        let safeCount = safeExercises.count
        let summary: String
        switch kind {
        case .train:
            summary = conflictLevel == .none
                ? "\(templateName) 与今天标记的恢复部位没有明显冲突，可以按计划训练。"
                : "\(templateName) 只有轻度恢复冲突，可以训练，注意相关动作的反馈。"
        case .modifiedTrain:
            // topConflict?.exerciseName || '高冲突动作' (the `||` also catches an empty name).
            let topName = topConflict.map { $0.exerciseName.isEmpty ? "高冲突动作" : $0.exerciseName } ?? "高冲突动作"
            summary = "\(templateName) 建议按保守版执行：重点调整\(topName)，其余 \(safeCount) 个低冲突动作可以保留。"
        case .rest:
            summary = "\(templateName) 与今天恢复状态冲突较高，且准备度偏低，建议休息。"
        default:  // active_recovery — templateKindFromConflict never returns mobility_only.
            summary = "\(templateName) 与今天恢复状态冲突较高，建议主动恢复。"
        }

        return TemplateRecoveryConflict(
            templateId: template.id ?? "",
            templateName: templateName,
            conflictLevel: conflictLevel,
            kind: kind,
            conflictingExercises: conflictingExercises,
            safeExercises: safeExercises,
            suggestedChanges: suggestedChanges,
            summary: summary
        )
    }

    // MARK: - Dead-in-legacy web schema helpers (recoveryAwareScheduler.ts:384-398)
    //
    // `conflictLabel` (ts:384-390) + `baseReasons` (ts:392-398) are defined in the legacy web schema engine but
    // NEVER called (verified: zero references repo-wide outside their own definitions — baseReasons
    // is never invoked, and conflictLabel is only invoked by baseReasons). They are mirrored here
    // faithfully for completeness; being unreachable from any export, no golden can pin them.

    /// `conflictLabel` (ts:384-390).
    static func conflictLabel(_ level: RecoveryConflictLevel) -> String {
        switch level {
        case .none: return "无明显冲突"
        case .low: return "轻度冲突"
        case .moderate: return "中等冲突"
        case .high: return "较高冲突"
        }
    }

    /// `baseReasons` (ts:392-398) — DEAD in legacy web schema (never called); mirrored for completeness.
    static func baseReasons(_ templateName: String, _ conflict: TemplateBodyPartConflict) -> [String] {
        if conflict.level == .none {
            return ["\(templateName) 与今天标记的酸痛部位没有明显重叠。"]
        }
        var out = ["你标记的\(conflict.affectedAreas.joined(separator: "、"))与 \(templateName) 存在\(conflictLabel(conflict.level))。"]
        if let first = conflict.conflictingExercises.first {
            out.append(first.reason)
        }
        return out
    }

    // MARK: - Recommendation helpers (recoveryAwareScheduler.ts:400-437)

    /// `findLowerConflictTemplate` (ts:400-413): lowest-conflict (none/low) alternative template,
    /// ranked by conflictRank ASC then `template.duration` ASC; `[0]` (or nil).
    static func findLowerConflictTemplate(
        _ preferredTemplate: TrainingTemplate,
        _ templates: [TrainingTemplate],
        _ sorenessAreas: [String],
        _ painAreas: [String]
    ) -> (template: TrainingTemplate, conflict: TemplateRecoveryConflict)? {
        let candidates = templates
            .filter { $0.id != preferredTemplate.id }
            .map { (template: $0, conflict: buildTemplateRecoveryConflict(template: $0, sorenessAreas: sorenessAreas, painAreas: painAreas)) }
            .filter { $0.conflict.conflictLevel == .none || $0.conflict.conflictLevel == .low }
        // .sort((l,r) => conflictRank[l] - conflictRank[r] || l.duration - r.duration)
        let sorted = stableSorted(candidates) { left, right in
            let rankDiff = conflictRank(left.conflict.conflictLevel) - conflictRank(right.conflict.conflictLevel)
            if rankDiff != 0 { return rankDiff }
            let dl = left.template.duration?.doubleValue ?? 0
            let dr = right.template.duration?.doubleValue ?? 0
            return dl < dr ? -1 : (dl > dr ? 1 : 0)
        }
        return sorted.first
    }

    /// `recoveryReasonsFromTemplateConflict` (ts:415-421).
    static func recoveryReasonsFromTemplateConflict(_ conflict: TemplateRecoveryConflict) -> [String] {
        if conflict.conflictLevel == .none {
            return ["\(conflict.templateName) 与今天标记的恢复部位没有明显重叠。"]
        }
        // [conflict.summary, ...conflictingExercises.slice(0,2).map(e => e.reason)].filter(Boolean)
        return ([conflict.summary] + conflict.conflictingExercises.prefix(2).map { $0.reason }).filter { !$0.isEmpty }
    }

    /// `mapTemplateSuggestedChanges` (ts:423-437).
    static func mapTemplateSuggestedChanges(_ conflict: TemplateRecoveryConflict) -> [RecommendationChange] {
        // mapped = conflict.suggestedChanges.map(c => ({ type: c.type, target: c.exerciseId, reason: c.reason }))
        // (TemplateChange.ChangeType ⊂ RecommendationChange.ChangeType — same rawValues.)
        let mapped = conflict.suggestedChanges.map { change in
            RecommendationChange(type: RecommendationChange.ChangeType(rawValue: change.type.rawValue)!, target: change.exerciseId, reason: change.reason)
        }
        if conflict.kind == .modifiedTrain {
            return [
                RecommendationChange(type: .reduceVolume, target: conflict.templateId, reason: "本次只做保守调整，不改变原训练模板。"),
                RecommendationChange(type: .reduceIntensity, target: conflict.templateId, reason: "高冲突动作降低强度，保留更多余力（RIR）。"),
            ] + mapped
        }
        return mapped
    }

    // MARK: - Public: buildRecoveryAwareRecommendation (recoveryAwareScheduler.ts:439-581)

    /// `buildRecoveryAwareRecommendation` (ts:439-581). `exerciseLibrary` is part of the input type
    /// (BuildTemplateBodyPartConflictInput) but INERT here — this function never reaches the
    /// body-part scorer; carried for signature fidelity.
    public static func buildRecoveryAwareRecommendation(
        preferredTemplate: TrainingTemplate? = nil,
        template: TrainingTemplate? = nil,
        templates: [TrainingTemplate] = [],
        sorenessAreas: [String] = [],
        painAreas: [String] = [],
        exerciseLibrary: [String: ExerciseMetaInput]? = nil,
        readinessResult: ReadinessResult? = nil,
        availableTimeMin: Double? = nil
    ) -> RecoveryAwareRecommendation {
        // targetTemplate = preferredTemplate || template || templates[0]
        let targetTemplate = preferredTemplate ?? template ?? templates.first
        guard let targetTemplate else {
            // ts:451-460
            return RecoveryAwareRecommendation(
                kind: .activeRecovery,
                templateId: nil,
                templateName: nil,
                title: "今日建议：主动恢复",
                summary: "当前没有可用训练模板，今天可以安排轻量活动度、步行或休息。",
                conflictLevel: .none,
                affectedAreas: [],
                reasons: ["没有可用训练模板，因此不生成正式训练建议。"],
                suggestedChanges: [RecommendationChange(type: .rest, target: nil, reason: "先保留恢复空间，等计划可用后再开始训练。")],
                templateRecoveryConflict: nil,
                requiresConfirmationToOverride: false
            )
        }

        let templateName = formatTemplateName(targetTemplate)
        let templateConflict = buildTemplateRecoveryConflict(
            template: targetTemplate,
            sorenessAreas: sorenessAreas,
            painAreas: painAreas,
            readinessResult: readinessResult
        )
        let readinessIsLow = lowReadiness(readinessResult)
        let availableTime = number(availableTimeMin)
        let reasons = recoveryReasonsFromTemplateConflict(templateConflict)
        let shouldPreferAlternative = templateConflict.conflictLevel == .high && templateConflict.conflictingExercises.count > 1

        // ts:475-487 — high + low readiness → rest.
        if templateConflict.conflictLevel == .high && readinessIsLow {
            return RecoveryAwareRecommendation(
                kind: .rest,
                templateId: nil,
                templateName: nil,
                title: "今日建议：休息",
                summary: "\(templateName) 与今天的恢复信号冲突较高，且准备度偏低。建议今天休息或做很轻量的恢复活动。",
                conflictLevel: templateConflict.conflictLevel,
                affectedAreas: orderedUnique(templateConflict.conflictingExercises.flatMap { $0.affectedAreas }),
                reasons: reasons + ["准备度偏低时，高冲突模板不适合作为正常训练推荐。"],
                suggestedChanges: [RecommendationChange(type: .rest, target: nil, reason: "今天保留恢复空间，不强行安排正式训练。")],
                templateRecoveryConflict: templateConflict,
                requiresConfirmationToOverride: true
            )
        }

        // ts:489-525 — high + multiple conflicts → prefer a lower-conflict alternative.
        if shouldPreferAlternative {
            if let alternative = findLowerConflictTemplate(targetTemplate, templates, sorenessAreas, painAreas) {
                let alternativeName = formatTemplateName(alternative.template)
                return RecoveryAwareRecommendation(
                    kind: .train,
                    templateId: alternative.template.id,
                    templateName: alternativeName,
                    title: "今日建议：\(alternativeName)",
                    summary: "\(templateName) 与今天的酸痛部位冲突较高，建议改为低冲突的 \(alternativeName)。",
                    conflictLevel: templateConflict.conflictLevel,
                    affectedAreas: orderedUnique(templateConflict.conflictingExercises.flatMap { $0.affectedAreas }),
                    reasons: reasons + ["\(alternativeName) 与当前酸痛部位重叠更少。"],
                    suggestedChanges: [RecommendationChange(type: .chooseAlternativeTemplate, target: alternative.template.id, reason: "改为 \(alternativeName)，避免把主要压力继续放在恢复冲突部位。")],
                    templateRecoveryConflict: templateConflict,
                    requiresConfirmationToOverride: true
                )
            }
            return RecoveryAwareRecommendation(
                kind: .activeRecovery,
                templateId: nil,
                templateName: nil,
                title: "今日建议：主动恢复",
                summary: "\(templateName) 与今天的酸痛部位冲突较高，当前没有更低冲突的训练模板。建议安排主动恢复。",
                conflictLevel: templateConflict.conflictLevel,
                affectedAreas: orderedUnique(templateConflict.conflictingExercises.flatMap { $0.affectedAreas }),
                reasons: reasons,
                suggestedChanges: [RecommendationChange(type: .rest, target: nil, reason: "用主动恢复替代正式训练，避免继续刺激高冲突部位。")],
                templateRecoveryConflict: templateConflict,
                requiresConfirmationToOverride: true
            )
        }

        // ts:527-560 — modified_train OR moderate level.
        if templateConflict.kind == .modifiedTrain || templateConflict.conflictLevel == .moderate {
            if availableTime > 0 && availableTime <= 30 {
                return RecoveryAwareRecommendation(
                    kind: .mobilityOnly,
                    templateId: targetTemplate.id,
                    templateName: templateName,
                    title: "今日建议：只做活动度 / 纠偏",
                    summary: "\(templateName) 与今天的酸痛部位有中等重叠，且可用时间较少。建议只做轻量活动度或纠偏。",
                    conflictLevel: templateConflict.conflictLevel,
                    affectedAreas: orderedUnique(templateConflict.conflictingExercises.flatMap { $0.affectedAreas }),
                    reasons: reasons,
                    suggestedChanges: [
                        RecommendationChange(type: .avoidMovementPattern, target: nil, reason: "跳过高冲突动作模式，只保留轻量活动度。"),
                        RecommendationChange(type: .skipAccessory, target: nil, reason: "今天不额外堆叠辅助动作。"),
                    ],
                    templateRecoveryConflict: templateConflict,
                    requiresConfirmationToOverride: true
                )
            }
            return RecoveryAwareRecommendation(
                kind: .modifiedTrain,
                templateId: targetTemplate.id,
                templateName: templateName,
                title: "今日建议：\(templateName)（保守版）",
                summary: templateConflict.summary,
                conflictLevel: templateConflict.conflictLevel,
                affectedAreas: orderedUnique(templateConflict.conflictingExercises.flatMap { $0.affectedAreas }),
                reasons: reasons,
                suggestedChanges: mapTemplateSuggestedChanges(templateConflict),
                templateRecoveryConflict: templateConflict,
                requiresConfirmationToOverride: true
            )
        }

        // ts:562-580 — default train (low / normal).
        return RecoveryAwareRecommendation(
            kind: .train,
            templateId: targetTemplate.id,
            templateName: templateName,
            title: "今日建议：\(templateName)",
            summary: templateConflict.conflictLevel == .low
                ? "\(templateName) 与今天的酸痛部位只有轻度重叠，可以训练，但注意动作质量。"
                : "\(templateName) 可以按计划训练。",
            conflictLevel: templateConflict.conflictLevel,
            affectedAreas: orderedUnique(templateConflict.safeExercises.flatMap { $0.affectedAreas }),
            reasons: reasons,
            suggestedChanges: templateConflict.conflictLevel == .low
                ? [RecommendationChange(type: .reduceIntensity, target: targetTemplate.id, reason: "如酸痛加重，相关动作保持保守。")]
                : [],
            templateRecoveryConflict: templateConflict,
            requiresConfirmationToOverride: false
        )
    }

    // MARK: - Pure utility helpers

    /// `number` (engineUtils.ts:38), REUSED through the already-ported `E1RMEngine.number`
    /// (NOT re-ported) — a typed finite-or-0 adapter. Both call sites (availableTimeMin, the
    /// muscleContribution lookup) feed a finite-or-absent value, so the JSONValue overload's
    /// missing NaN guard is never reached.
    static func number(_ value: Double?) -> Double {
        E1RMEngine.number(value.map { NumberRepr.double($0) })
    }

    /// A `Record<string, number>` decode (the Domain `muscleContribution` JSONValue → the
    /// `[String: Double]` the merge/score paths read). Only the consumers (`Object.keys` for
    /// secondary areas, a single-key lookup for the contribution score) read it, and neither
    /// depends on key order. Non-numeric entries — absent from real data — are dropped.
    static func contributionDict(_ value: JSONValue?) -> [String: Double]? {
        guard let obj = value?.objectValue else { return nil }
        var dict: [String: Double] = [:]
        for entry in obj.entries {
            if let d = entry.value.doubleValue { dict[entry.key] = d }
        }
        return dict
    }

    /// `formatExerciseName({ id, name })` (formatters.ts:492, default fallback '未命名动作') →
    /// `formatExerciseDisplayName` → SR-1 `ExerciseLibrary.formatExerciseDisplayName` with the
    /// `{ id, name }` object form. IDENTICAL to the SC-1b helper (REUSED logic).
    static func formatExerciseName(id: String, name: String) -> String {
        let entries: [OrderedJSONObject.Entry] = [
            .init(key: "id", value: .string(id)),
            .init(key: "name", value: .string(name)),
        ]
        return ExerciseLibrary.formatExerciseDisplayName(.object(OrderedJSONObject(entries: entries)), bilingual: false, fallback: "未命名动作")
    }

    /// `ExerciseTemplate` (Domain) → `ExerciseRecoveryConflictEngine.ExerciseInput`. The SC-1b
    /// engine receives the FULL template object in legacy web schema and reads these nine fields; the
    /// muscleContribution Record is decoded to `[String: Double]` (the ExerciseInput carrier).
    static func toExerciseInput(_ exercise: ExerciseTemplate) -> ExerciseRecoveryConflictEngine.ExerciseInput {
        ExerciseRecoveryConflictEngine.ExerciseInput(
            id: exercise.id ?? "",
            name: exercise.name,
            muscle: exercise.muscle,
            movementPattern: exercise.movementPattern,
            primaryMuscles: exercise.primaryMuscles,
            secondaryMuscles: exercise.secondaryMuscles,
            muscleContribution: contributionDict(exercise.muscleContribution),
            fatigueCost: exercise.fatigueCost,
            skillDemand: exercise.skillDemand
        )
    }

    /// `Array.from(new Set(values))` — insertion-ordered de-dup (mirrors `[...new Set(...)]`).
    static func orderedUnique<T: Hashable>(_ values: [T]) -> [T] {
        var seen = Set<T>()
        var out: [T] = []
        for value in values where !seen.contains(value) {
            seen.insert(value)
            out.append(value)
        }
        return out
    }

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left first). Ties keep
    /// their original relative order, mirroring `Array.prototype.sort`'s guaranteed stability.
    static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }

    /// `Math.round` (round half toward +∞): `Math.round(2.5) === 3`, `Math.round(-2.5) === -2`.
    /// The same faithful port the sibling engines carry (E1RMEngine.roundToHalfKg / PA jsRound).
    static func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }

    // MARK: - Local formatTemplateName mirror (formatters.ts:187-208) — see file header
    //
    // Faithful local transcription of the L10n `Formatters.formatTemplateName` chain (which itself
    // mirrors retired-web-reference), kept off an IPTD → RedeL10n edge to respect the package
    // graph — exactly the ProgramAdjustmentEngineSelectDayDiff precedent. The recovery-aware
    // goldens reconcile every entry / regex / branch (template names ride in every summary/title).

    /// `formatTemplateName(template)` (ts:340/463/492) — the engine always passes a TrainingTemplate
    /// object. Candidates: `[id, nameZh, name, label]` (formatters.ts:191-196); nameZh/label are not
    /// typed Domain fields, so they are read from the open bag (absent in normal templates).
    static func formatTemplateName(_ template: TrainingTemplate) -> String {
        formatTemplateNameCandidates(
            [
                template.id,
                template._unknown["nameZh"]?.stringValue,
                template.name,
                template._unknown["label"]?.stringValue,
            ],
            fallbackLabel: "未命名"
        )
    }

    /// `TEMPLATE_NAME_MAP` (formatters.ts:62-83). 20 entries, key + value verbatim.
    static let templateNameMap: [String: String] = [
        "push-a": "推 A", "pusha": "推 A", "push": "推 A",
        "pull-a": "拉 A", "pulla": "拉 A", "pull": "拉 A",
        "legs-a": "腿 A", "legsa": "腿 A", "legs": "腿 A",
        "upper-a": "上肢 A", "uppera": "上肢 A", "upper": "上肢 A",
        "lower-a": "下肢 A", "lowera": "下肢 A", "lower": "下肢 A",
        "full-body": "全身训练", "fullbody": "全身训练",
        "arms": "手臂补量", "quick-30": "30 分钟快练", "crowded-gym": "人多替代",
    ]

    /// The shared candidate loop of `formatTemplateName` (formatters.ts:198-207).
    static func formatTemplateNameCandidates(_ candidates: [String?], fallbackLabel: String) -> String {
        for candidate in candidates {
            let normalized = normalizeDisplayKey(candidate ?? "")            // ts:199
            if let hit = templateNameMap[normalized] { return hit }          // ts:200
            if let candidate {                                               // typeof candidate === 'string'
                let localized = localizeTemplateNameText(candidate.trimmingCharacters(in: .whitespacesAndNewlines)) // ts:202
                // /[㐀-鿿]/.test(localized) && !/\b(push|pull|legs|upper|lower|full body)\b/i.test(localized) (ts:203)
                if containsCjk(localized) && !regexTest(localized, "(?<![A-Za-z0-9_])(push|pull|legs|upper|lower|full body)(?![A-Za-z0-9_])", caseInsensitive: true) {
                    return localized
                }
            }
        }
        return fallbackLabel  // ts:207 (the warnMissingFormatter console.warn is a no-op)
    }

    /// `normalizeDisplayKey` (formatters.ts:27-33).
    static func normalizeDisplayKey(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines)
        s = regexReplaceAll(s, "[（(].*?[)）]", "")
        s = regexReplaceAll(s, "([a-z])([A-Z])", "$1-$2")
        s = regexReplaceAll(s, "[_\\s]+", "-")
        return s.lowercased()
    }

    /// `localizeTemplateNameText` (formatters.ts:178-185). JS `\b` (ASCII word boundary) is spelled
    /// as explicit ASCII look-arounds (ICU `\b` treats CJK as word chars and would diverge on an
    /// English token glued to a CJK char) — same fidelity note as the L10n / PA copies.
    static func localizeTemplateNameText(_ value: String) -> String {
        var s = value
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])push[\\s_-]*a(?![A-Za-z0-9_])", "推 A", caseInsensitive: true)
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])pull[\\s_-]*a(?![A-Za-z0-9_])", "拉 A", caseInsensitive: true)
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])legs[\\s_-]*a(?![A-Za-z0-9_])", "腿 A", caseInsensitive: true)
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])upper[\\s_-]*a(?![A-Za-z0-9_])", "上肢 A", caseInsensitive: true)
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])lower[\\s_-]*a(?![A-Za-z0-9_])", "下肢 A", caseInsensitive: true)
        s = regexReplaceAll(s, "(?<![A-Za-z0-9_])full[\\s_-]*body(?![A-Za-z0-9_])", "全身训练", caseInsensitive: true)
        return s
    }

    /// `/[㐀-鿿]/.test(value)` (formatters.ts:203) — any CJK scalar in U+3400…U+9FFF.
    static func containsCjk(_ value: String) -> Bool {
        value.unicodeScalars.contains { $0.value >= 0x3400 && $0.value <= 0x9FFF }
    }

    /// `regex.test(value)` for an arbitrary pattern.
    static func regexTest(_ value: String, _ pattern: String, caseInsensitive: Bool = false) -> Bool {
        let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return false }
        return regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) != nil
    }

    /// Global regex replace (`String.prototype.replace(/…/g, …)`) with NSRegularExpression template.
    static func regexReplaceAll(_ input: String, _ pattern: String, _ replacement: String, caseInsensitive: Bool = false) -> String {
        let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return input }
        let range = NSRange(input.startIndex..., in: input)
        return regex.stringByReplacingMatches(in: input, range: range, withTemplate: replacement)
    }
}
