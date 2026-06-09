// SC-1b — exerciseRecoveryConflictEngine port (scheduling-track, recoveryAware hard
// prerequisite). Faithful, line-by-line Swift mirror of
// retired-web-reference (232 lines).
//
// The legacy web schema engine imports exactly three things, all already native:
//   1. EXERCISE_DISPLAY_NAMES / EXERCISE_KNOWLEDGE_OVERRIDES  (../data/exerciseLibrary)
//   2. formatExerciseName                                     (../i18n/formatters)
//   3. ExerciseMetadata / ExerciseTemplate (types)            (../models/training-model)
//
// `buildExerciseMeta` merges `EXERCISE_KNOWLEDGE_OVERRIDES[id]` under the exercise input,
// reading SIX override fields downstream — exactly the slice the SC ports already cover
// (REUSED here, never re-ported, as the SC-0 ExerciseRecoveryKnowledge header foretold):
//   • movementPattern / primaryMuscles / skillDemand  ← SmartReplacementKnowledge (SR-3)
//   • fatigueCost                                       ← ReplacementEngineKnowledge (SR-2)
//   • secondaryMuscles / muscleContribution             ← ExerciseRecoveryKnowledge (SC-0)
// (No override defines a top-level `muscle`/`name`; `name` resolves via EXERCISE_DISPLAY_NAMES
// (SR-1) then the literal fallback.) The three tables share ONE 63-id override universe, so a
// synthetic id misses all three (the empty-override default branch) and a real id hits all
// three identically — both reconciled by their own parity tests. `formatExerciseName({id,name})`
// reuses the SR-1 `ExerciseLibrary.formatExerciseDisplayName` (formatters.ts:492 → exerciseLibrary.ts:323).
//
// PURE / read-only: zero `: Date`, no IO, no write path, no decision-output wiring. The
// `exercise-recovery-conflict/conflict-cases-v1` golden is GENERATED from the retired legacy engine
// (retired fixture generator, never hand-authored — §22); `ExerciseRecoveryConflictEngineParityTests`
// compute-asserts each case == golden. Every output field is String / [String] / enum-string,
// so the float scoring is internal-only — no number-formatting surface in the golden.

import Foundation
import RedeDomain

/// `exerciseRecoveryConflictEngine` (exerciseRecoveryConflictEngine.ts). A namespace enum
/// (no instances), matching the per-engine convention of this package.
public enum ExerciseRecoveryConflictEngine {

    // MARK: - Exported types (exerciseRecoveryConflictEngine.ts:5-34)

    /// `ExerciseRecoveryConflictLevel` (ts:5).
    public enum ConflictLevel: String, Equatable, Sendable {
        case none
        case low
        case moderate
        case high
    }

    /// `ExerciseRecoveryAction` (ts:7).
    public enum Action: String, Equatable, Sendable {
        case keep
        case reduceIntensity = "reduce_intensity"
        case reduceVolume = "reduce_volume"
        case substitute
        case skip
    }

    /// `ExerciseRecoveryConflict` (ts:9-16).
    public struct Conflict: Equatable, Sendable {
        public let exerciseId: String
        public let exerciseName: String
        public let conflictLevel: ConflictLevel
        public let affectedAreas: [String]
        public let reason: String
        public let recommendedAction: Action

        public init(
            exerciseId: String,
            exerciseName: String,
            conflictLevel: ConflictLevel,
            affectedAreas: [String],
            reason: String,
            recommendedAction: Action
        ) {
            self.exerciseId = exerciseId
            self.exerciseName = exerciseName
            self.conflictLevel = conflictLevel
            self.affectedAreas = affectedAreas
            self.reason = reason
            self.recommendedAction = recommendedAction
        }
    }

    /// `ExerciseInput = Pick<ExerciseTemplate,'id'> & Partial<ExerciseTemplate> & ExerciseMetadata`
    /// (ts:28). Only the fields the engine reads are modelled (all optional except `id`); any
    /// other template/metadata field is inert to this engine.
    public struct ExerciseInput: Equatable, Sendable {
        public var id: String
        public var name: String?
        public var muscle: String?
        public var movementPattern: String?
        public var primaryMuscles: [String]?
        public var secondaryMuscles: [String]?
        public var muscleContribution: [String: Double]?
        public var fatigueCost: String?
        public var skillDemand: String?

        public init(
            id: String,
            name: String? = nil,
            muscle: String? = nil,
            movementPattern: String? = nil,
            primaryMuscles: [String]? = nil,
            secondaryMuscles: [String]? = nil,
            muscleContribution: [String: Double]? = nil,
            fatigueCost: String? = nil,
            skillDemand: String? = nil
        ) {
            self.id = id
            self.name = name
            self.muscle = muscle
            self.movementPattern = movementPattern
            self.primaryMuscles = primaryMuscles
            self.secondaryMuscles = secondaryMuscles
            self.muscleContribution = muscleContribution
            self.fatigueCost = fatigueCost
            self.skillDemand = skillDemand
        }
    }

    // MARK: - Internal types (exerciseRecoveryConflictEngine.ts:18-26)

    /// `BodyAreaKey` (ts:18).
    enum BodyAreaKey: String {
        case shoulder
        case chest
        case back
        case leg
        case arm
    }

    /// `RecoverySource` (ts:20-26).
    struct RecoverySource: Equatable {
        let key: BodyAreaKey
        let label: String
        let stateLabel: String  // '酸痛' | '不适'
        let weight: Double
        let isPain: Bool
    }

    /// `ResolvedMeta` — the `buildExerciseMeta` (ts:120-130) return shape, limited to the six
    /// override-mergeable fields the engine reads downstream plus id/name/muscle.
    struct ResolvedMeta {
        let id: String
        let name: String
        let muscle: String
        let movementPattern: String?
        let primaryMuscles: [String]?
        let secondaryMuscles: [String]?
        let muscleContribution: [String: Double]?
        let fatigueCost: String?
        let skillDemand: String?
    }

    // MARK: - Constant tables (exerciseRecoveryConflictEngine.ts:36-65)

    /// `areaLabels` (ts:36-42).
    static let areaLabels: [BodyAreaKey: String] = [
        .shoulder: "肩部",
        .chest: "胸部",
        .back: "背部",
        .leg: "腿部",
        .arm: "手臂",
    ]

    /// `areaMuscleNames` (ts:44-50).
    static let areaMuscleNames: [BodyAreaKey: String] = [
        .shoulder: "肩",
        .chest: "胸",
        .back: "背",
        .leg: "腿",
        .arm: "手臂",
    ]

    /// `levelLabels` (ts:52-57).
    static let levelLabels: [ConflictLevel: String] = [
        .none: "无明显",
        .low: "轻度",
        .moderate: "中等",
        .high: "较高",
    ]

    /// `actionReason` (ts:59-65).
    static let actionReason: [Action: String] = [
        .keep: "可以按计划执行",
        .reduceIntensity: "建议降低强度",
        .reduceVolume: "建议减少训练量",
        .substitute: "建议优先考虑替代动作",
        .skip: "建议本次先跳过",
    ]

    // MARK: - String helpers (exerciseRecoveryConflictEngine.ts:67-87)

    /// `normalize` (ts:67-70) — `String(value || '').trim().toLowerCase()`.
    static func normalize(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// `includesAny` (ts:72-73). Every token in THIS engine is a plain-substring regex literal
    /// (no anchors/alternation/char-classes) and every `value` is pre-normalized (lowercased),
    /// so `regex.test(value)` collapses to `value.contains(token)` — exact. (No call site passes
    /// a non-regex string token, so the `token.toLowerCase()` branch never differs.)
    static func includesAny(_ value: String, _ tokens: [String]) -> Bool {
        tokens.contains { value.contains($0) }
    }

    /// `areaKeysFromText` (ts:75-87). Returns the matched body-area keys for a free-text label,
    /// deduped in push order (shoulder, chest, back, leg, arm).
    static func areaKeysFromText(_ value: String?) -> [BodyAreaKey] {
        let text = normalize(value)
        // if (!text || text === 'none' || text === 'no' || text === '无') return [];
        if text.isEmpty || text == "none" || text == "no" || text == "无" { return [] }
        var keys: [BodyAreaKey] = []
        if includesAny(text, ["shoulder", "deltoid", "肩"]) { keys.append(.shoulder) }
        if includesAny(text, ["chest", "pec", "胸"]) { keys.append(.chest) }
        if includesAny(text, ["back", "lat", "lats", "背", "腰", "下背"]) { keys.append(.back) }
        if includesAny(text, ["leg", "quad", "hamstring", "glute", "calf", "knee", "hip", "腿", "膝", "髋", "臀", "小腿", "股四", "腘绳"]) {
            keys.append(.leg)
        }
        if includesAny(text, ["arm", "biceps", "triceps", "elbow", "手臂", "二头", "三头", "肘"]) { keys.append(.arm) }
        return orderedUnique(keys)
    }

    // MARK: - Source builders (exerciseRecoveryConflictEngine.ts:89-107)

    /// `sourcesFromAreas` (ts:89-98).
    static func sourcesFromAreas(_ areas: [String], isPain: Bool) -> [RecoverySource] {
        areas.flatMap { area in
            areaKeysFromText(area).map { key in
                RecoverySource(
                    key: key,
                    label: areaLabels[key] ?? "",
                    stateLabel: isPain ? "不适" : "酸痛",
                    weight: isPain ? 1.7 : 1,
                    isPain: isPain
                )
            }
        }
    }

    /// `mergeSources` (ts:100-107). JS `Map`: insertion order kept by FIRST occurrence of each
    /// key; value updated only when a later source has a strictly greater weight.
    static func mergeSources(_ sources: [RecoverySource]) -> [RecoverySource] {
        var order: [BodyAreaKey] = []
        var byKey: [BodyAreaKey: RecoverySource] = [:]
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

    // MARK: - Numeric / enum coercion (exerciseRecoveryConflictEngine.ts:109-118)

    /// `toStringArray` (ts:109) — `Array.isArray(value) ? value.map(String) : []`. The Swift
    /// carrier is already `[String]?`, so this is the nil → [] collapse.
    static func toStringArray(_ value: [String]?) -> [String] {
        value ?? []
    }

    /// `toNumber` (ts:111-114) — `Number(value)`, finite else 0. The looked-up contribution is a
    /// `Double?`; absent (nil) → `Number(undefined) = NaN` → 0; non-finite → 0.
    static func toNumber(_ value: Double?) -> Double {
        guard let value, value.isFinite else { return 0 }
        return value
    }

    /// `normalizeFatigueCost` (ts:116) — high/medium/low pass-through, else 'medium'.
    static func normalizeFatigueCost(_ value: String?) -> String {
        (value == "high" || value == "medium" || value == "low") ? value! : "medium"
    }

    /// `normalizeSkillDemand` (ts:118) — high/medium/low pass-through, else 'medium'.
    static func normalizeSkillDemand(_ value: String?) -> String {
        (value == "high" || value == "medium" || value == "low") ? value! : "medium"
    }

    // MARK: - Meta build (exerciseRecoveryConflictEngine.ts:120-130)

    /// `buildExerciseMeta` (ts:120-130). `{ ...override, ...exercise, id, name, muscle }`: a field
    /// present on the exercise input wins; otherwise the (reused) `EXERCISE_KNOWLEDGE_OVERRIDES`
    /// value supplies it. The three SC/SR knowledge tables share the override id universe, so for a
    /// synthetic id all lookups miss (empty override) and for a real id all hit consistently.
    static func buildExerciseMeta(_ exercise: ExerciseInput) -> ResolvedMeta {
        let id = exercise.id  // String(exercise.id || '')
        // const override = (EXERCISE_KNOWLEDGE_OVERRIDES[id] || {}) — the engine-read slice,
        // reused from the already-ported tables (SR-3 / SR-2 / SC-0).
        let smr = SmartReplacementKnowledge.overrides[id]      // movementPattern / primaryMuscles / skillDemand
        let rep = ReplacementEngineKnowledge.knowledge[id]     // fatigueCost
        let rec = ExerciseRecoveryKnowledge.overrides[id]      // secondaryMuscles / muscleContribution

        // name: exercise.name || EXERCISE_DISPLAY_NAMES[id] || '未命名动作'
        let name: String = {
            if let n = exercise.name, !n.isEmpty { return n }
            if let d = ExerciseLibrary.displayNames[id], !d.isEmpty { return d }
            return "未命名动作"
        }()
        // muscle: exercise.muscle || ''
        let muscle = (exercise.muscle?.isEmpty == false) ? exercise.muscle! : ""

        return ResolvedMeta(
            id: id,
            name: name,
            muscle: muscle,
            movementPattern: exercise.movementPattern ?? smr?.movementPattern,
            primaryMuscles: exercise.primaryMuscles ?? smr?.primaryMuscles,
            secondaryMuscles: exercise.secondaryMuscles ?? rec?.secondaryMuscles,
            muscleContribution: exercise.muscleContribution ?? rec?.muscleContribution,
            fatigueCost: exercise.fatigueCost ?? rep?.fatigueCost,
            skillDemand: exercise.skillDemand ?? smr?.skillDemand
        )
    }

    /// `exerciseAreaKeys` (ts:132) — `[...new Set(values.flatMap(areaKeysFromText))]`.
    static func exerciseAreaKeys(_ values: [String]) -> [BodyAreaKey] {
        orderedUnique(values.flatMap { areaKeysFromText($0) })
    }

    /// `isLegPressText` (ts:134).
    static func isLegPressText(_ text: String) -> Bool {
        includesAny(text, ["leg-press", "腿举"])
    }

    // MARK: - Scoring (exerciseRecoveryConflictEngine.ts:136-204)

    /// `movementScore` (ts:136-159). Returns the movement-pattern contribution for the area.
    static func movementScore(_ area: BodyAreaKey, _ meta: ResolvedMeta) -> Double {
        let movement = "\(normalize(meta.id)) \(normalize(meta.name)) \(normalize(meta.movementPattern))"
        if area == .shoulder {
            if includesAny(movement, ["垂直推", "肩外展", "肩胛", "shoulder-press", "lateral-raise", "landmine"]) { return 5 }
            if !isLegPressText(movement) && includesAny(movement, ["水平推", "上斜推", "斜向推", "卧推", "推胸", "bench", "chest-press", "push-up"]) { return 4 }
            if includesAny(movement, ["水平拉", "面拉", "row", "face-pull"]) { return 1.5 }
        }
        if area == .chest {
            if !isLegPressText(movement) && includesAny(movement, ["水平推", "上斜推", "飞鸟", "卧推", "推胸", "夹胸", "bench", "chest-press", "fly", "push-up"]) { return 6 }
        }
        if area == .back {
            if includesAny(movement, ["杠铃划船", "水平拉", "垂直拉", "引体", "下拉", "barbell-row", "row", "pulldown", "pull-up"]) { return 6 }
            if includesAny(movement, ["髋铰链", "硬拉", "deadlift", "rdl"]) { return 4 }
            if includesAny(movement, ["深蹲", "squat"]) { return 2 }
        }
        if area == .leg {
            if includesAny(movement, ["深蹲", "腿举", "髋铰链", "膝屈", "膝伸", "跖屈", "髋伸", "硬拉", "squat", "leg-press", "leg-curl", "calf", "deadlift", "rdl", "hip"]) { return 6 }
        }
        if area == .arm {
            if includesAny(movement, ["肘屈", "肘伸", "弯举", "下压", "curl", "pushdown", "triceps", "biceps"]) { return 6 }
            if !isLegPressText(movement) && includesAny(movement, ["卧推", "肩推", "下拉", "划船", "引体", "bench", "shoulder-press", "chest-press", "pulldown", "pull-up", "row"]) { return 2 }
        }
        return 0
    }

    /// A scored source — the `scoreExerciseForSource` (ts:161-189) return shape.
    struct ScoredSource {
        let source: RecoverySource
        let score: Double
        let details: [String]
    }

    /// `scoreExerciseForSource` (ts:161-189).
    static func scoreExerciseForSource(_ meta: ResolvedMeta, _ source: RecoverySource) -> ScoredSource {
        let primaryAreas = exerciseAreaKeys(toStringArray(meta.primaryMuscles) + [meta.muscle])
        let secondaryAreas = exerciseAreaKeys(toStringArray(meta.secondaryMuscles))
        let primaryScore: Double = primaryAreas.contains(source.key) ? 6 : 0
        let secondaryScore: Double = secondaryAreas.contains(source.key) ? 2 : 0
        let contribution = toNumber(meta.muscleContribution?[areaMuscleNames[source.key] ?? ""])
        let contributionScore: Double = contribution > 0 ? min(1.5, contribution * 1.5) : 0
        let patternScore = movementScore(source.key, meta)
        let baseScore = primaryScore + secondaryScore + contributionScore + patternScore
        let fatigueCost = normalizeFatigueCost(meta.fatigueCost)
        let skillDemand = normalizeSkillDemand(meta.skillDemand)
        let auxiliaryScore: Double = baseScore > 0
            ? ((fatigueCost == "high" ? 0.7 : fatigueCost == "medium" ? 0.25 : 0) + (skillDemand == "high" ? 0.5 : skillDemand == "medium" ? 0.15 : 0))
            : 0
        let details: [String] = [
            primaryScore != 0 ? "\(source.label)是主要训练部位" : "",
            secondaryScore != 0 ? "\(source.label)参与稳定或辅助" : "",
            patternScore >= 4 ? "动作模式会明显调用相关部位" : patternScore > 0 ? "动作模式会轻度调用相关部位" : "",
            (fatigueCost == "high" && baseScore > 0) ? "疲劳成本较高" : "",
            (skillDemand == "high" && baseScore > 0) ? "技术要求较高" : "",
        ].filter { !$0.isEmpty }

        return ScoredSource(
            source: source,
            score: (baseScore + auxiliaryScore) * source.weight,
            details: details
        )
    }

    /// `levelForScore` (ts:191-196).
    static func levelForScore(_ score: Double) -> ConflictLevel {
        if score < 0.75 { return .none }
        if score < 3.5 { return .low }
        if score < 7 { return .moderate }
        return .high
    }

    /// `recommendedActionFor` (ts:198-204).
    static func recommendedActionFor(_ level: ConflictLevel, _ hasPain: Bool, _ fatigueCost: String) -> Action {
        if level == .none { return .keep }
        if level == .low { return hasPain ? .reduceIntensity : .keep }
        if level == .moderate { return hasPain ? .substitute : .reduceIntensity }
        if hasPain { return .skip }
        return fatigueCost == "high" ? .substitute : .reduceVolume
    }

    // MARK: - Public entry point (exerciseRecoveryConflictEngine.ts:206-232)

    /// `buildExerciseRecoveryConflict` (ts:206-232).
    public static func buildExerciseRecoveryConflict(
        exercise: ExerciseInput,
        sorenessAreas: [String] = [],
        painAreas: [String] = []
    ) -> Conflict {
        let meta = buildExerciseMeta(exercise)
        let exerciseName = formatExerciseName(id: meta.id, name: meta.name)
        let sources = mergeSources(sourcesFromAreas(sorenessAreas, isPain: false) + sourcesFromAreas(painAreas, isPain: true))
        // scored.sort((left, right) => right.score - left.score) — DESC, V8-stable.
        let scored = stableSorted(sources.map { scoreExerciseForSource(meta, $0) }) { left, right in
            let d = right.score - left.score
            return d < 0 ? -1 : (d > 0 ? 1 : 0)
        }
        let best = scored.first
        let level = levelForScore(best?.score ?? 0)
        let affectedAreas = scored.filter { $0.score >= 0.75 }.map { $0.source.label }
        let recommendedAction = recommendedActionFor(level, best?.source.isPain ?? false, normalizeFatigueCost(meta.fatigueCost))
        let reason: String
        if level == .none {
            reason = "\(exerciseName)与已标记部位没有明显训练重叠，可以按计划执行。"
        } else {
            // level != none ⇒ best.score >= 0.75 ⇒ best is present.
            let b = best!
            let detail = b.details.prefix(2).joined(separator: "，")
            reason = "\(b.source.label)\(b.source.stateLabel)与\(exerciseName)存在\(levelLabels[level] ?? "")恢复冲突：\(detail)，\(actionReason[recommendedAction] ?? "")。"
        }

        return Conflict(
            exerciseId: meta.id,
            exerciseName: exerciseName,
            conflictLevel: level,
            affectedAreas: orderedUnique(affectedAreas),
            reason: reason,
            recommendedAction: recommendedAction
        )
    }

    // MARK: - Pure utility helpers

    /// `formatExerciseName({ id: meta.id, name: meta.name }, '未命名动作')` (ts:212) →
    /// `formatExerciseName` (formatters.ts:492) → SR-1 `ExerciseLibrary.formatExerciseDisplayName`
    /// with the `{ id, name }` object form + the engine's literal fallback.
    static func formatExerciseName(id: String, name: String) -> String {
        let entries: [OrderedJSONObject.Entry] = [
            .init(key: "id", value: .string(id)),
            .init(key: "name", value: .string(name)),
        ]
        return ExerciseLibrary.formatExerciseDisplayName(.object(OrderedJSONObject(entries: entries)), bilingual: false, fallback: "未命名动作")
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
}
