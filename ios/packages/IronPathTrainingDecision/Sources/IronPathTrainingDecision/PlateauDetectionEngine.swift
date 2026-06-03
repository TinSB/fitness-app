// PlateauDetectionEngine — AN-2 per-exercise plateau-detection port.
//
// Faithful line-by-line Swift port of the PURE per-exercise plateau-detection
// function from `src/engines/plateauDetectionEngine.ts`:
//   - detectExercisePlateau   (plateauDetectionEngine.ts:299)
// + every private helper it reads (signal / unique / exerciseIds / exerciseMatches /
//   sessionDateKey / relevantSessions / relevantExerciseSets / firstExerciseName /
//   buildTechniqueSummaryFromSets / isLoadFeedbackSummary / normalizeLoadFeedback /
//   e1rmValues / buildSessionPerformances / isStableCompletion / countFlatSessions /
//   isE1rmFlat / buildLimitActions / statusTitle / confidenceFromEvidence) and the
//   output / input types (PlateauStatus / PlateauSignal / PlateauDetectionResult /
//   DetectExercisePlateauParams + SessionPerformance).
//
// Dependency boundary (AN-2 §, matches the slice contract):
//   * REUSES (does NOT re-port) the already-ported engineUtils helpers
//     `E1RMEngine.number` / `setWeightKg` / `completedSets` and the analytics filter
//     `E1RMEngine.filterAnalyticsHistory` (the engine's only real function call), plus
//     the `LoadFeedbackEngine.LoadFeedbackValue` canonical value constants.
//   * The optional external inputs `e1rmProfile` / `loadFeedback` are genuine TS
//     runtime unions consumed by DUCK-TYPING (`'recentValues' in profile`,
//     `'counts' in value && 'adjustment' in value`, `Array.isArray`, `typeof === 'string'`).
//     The faithful port keeps them as raw `JSONValue?` and reproduces the SAME
//     structural discrimination — never forcing a static type the TS does not assert.
//   * `TechniqueQualitySummary` (trainingLevelEngine.ts:41) / `EffectiveVolumeSummary`
//     (training-model.ts:1258, consumed as `Partial<…>`) / `PainPattern`
//     (training-model.ts:1028) are ported here as the consumed TYPE SUBSET ONLY (the
//     same precedent as `SmartReplacementEngine.SmartReplacementPainPattern`). This
//     slice ports NO logic from trainingLevelEngine / effectiveSetEngine — only the
//     shapes the plateau engine reads off these optional inputs.
//
// PURE: consumes `history: [TrainingSession]` (already a §11 clean input) + an
// exerciseId + optional external summaries; no IO, no clock (`zero : Date` — the
// engine never reads the wall clock; every date comparison is over the session's OWN
// date strings via `localeCompare`-equivalent `>`), no randomness. It is NOT wired
// into any UI (that is AN-6); this slice only adds the plateau function and
// parity-pins it function-by-function.

import Foundation
import IronPathDomain

public enum PlateauDetectionEngine {

    // MARK: - Output types (plateauDetectionEngine.ts:16-41)

    /// `PlateauStatus` (plateauDetectionEngine.ts:16). RawValue strings mirror the
    /// TS string-literal union so the golden's `status` decodes/compares verbatim.
    public enum PlateauStatus: String, Equatable, Sendable {
        case none = "none"
        case possiblePlateau = "possible_plateau"
        case plateau = "plateau"
        case fatigueLimited = "fatigue_limited"
        case techniqueLimited = "technique_limited"
        case volumeLimited = "volume_limited"
        case loadTooAggressive = "load_too_aggressive"
        case insufficientData = "insufficient_data"
    }

    /// `PlateauSignal` (plateauDetectionEngine.ts:26). `severity` kept as a raw
    /// String ('info' | 'warning' | 'serious') — the engine only ever assigns the
    /// three canonical values.
    public struct PlateauSignal: Equatable, Sendable {
        public let id: String
        public let label: String
        public let reason: String
        public let severity: String
        public init(id: String, label: String, reason: String, severity: String) {
            self.id = id
            self.label = label
            self.reason = reason
            self.severity = severity
        }
    }

    /// `PlateauDetectionResult` (plateauDetectionEngine.ts:33). `confidence` kept as a
    /// raw String ('low' | 'medium' | 'high').
    public struct PlateauDetectionResult: Equatable, Sendable {
        public let exerciseId: String
        public let status: PlateauStatus
        public let title: String
        public let summary: String
        public let signals: [PlateauSignal]
        public let suggestedActions: [String]
        public let confidence: String
        public init(
            exerciseId: String,
            status: PlateauStatus,
            title: String,
            summary: String,
            signals: [PlateauSignal],
            suggestedActions: [String],
            confidence: String
        ) {
            self.exerciseId = exerciseId
            self.status = status
            self.title = title
            self.summary = summary
            self.signals = signals
            self.suggestedActions = suggestedActions
            self.confidence = confidence
        }
    }

    // MARK: - Consumed TYPE subsets of the optional external inputs

    /// `TechniqueQualitySummary` (trainingLevelEngine.ts:41) — FULL shape (the plateau
    /// engine builds it via `buildTechniqueSummaryFromSets` AND accepts it as an
    /// optional param). All numeric fields are `Double` (TS `number`), matching the
    /// `(good + acceptable) / totalSets` rate arithmetic.
    public struct TechniqueQualitySummary: Equatable, Sendable {
        public let totalSets: Double
        public let good: Double
        public let acceptable: Double
        public let poor: Double
        public let goodOrAcceptableRate: Double
        public let poorRate: Double
        public let rirRecordedRate: Double
        public init(
            totalSets: Double,
            good: Double,
            acceptable: Double,
            poor: Double,
            goodOrAcceptableRate: Double,
            poorRate: Double,
            rirRecordedRate: Double
        ) {
            self.totalSets = totalSets
            self.good = good
            self.acceptable = acceptable
            self.poor = poor
            self.goodOrAcceptableRate = goodOrAcceptableRate
            self.poorRate = poorRate
            self.rirRecordedRate = rirRecordedRate
        }
    }

    /// `Partial<EffectiveVolumeSummary>` (training-model.ts:1258) — only the three
    /// fields the plateau engine reads (`completedSets` / `effectiveSets` /
    /// `highConfidenceEffectiveSets`), each OPTIONAL because the TS param is a
    /// `Partial`. NO effectiveSetEngine logic is ported (AN-5 owns that).
    public struct EffectiveVolumeSummary: Equatable, Sendable {
        public let completedSets: Double?
        public let effectiveSets: Double?
        public let highConfidenceEffectiveSets: Double?
        public init(
            completedSets: Double? = nil,
            effectiveSets: Double? = nil,
            highConfidenceEffectiveSets: Double? = nil
        ) {
            self.completedSets = completedSets
            self.effectiveSets = effectiveSets
            self.highConfidenceEffectiveSets = highConfidenceEffectiveSets
        }
    }

    /// `PainPattern` (training-model.ts:1028) — only the fields the plateau engine
    /// reads (`exerciseId` / `severityAvg`), mirroring the
    /// `SmartReplacementEngine.SmartReplacementPainPattern` precedent.
    public struct PainPattern: Equatable, Sendable {
        public let exerciseId: String?
        public let severityAvg: Double?
        public init(exerciseId: String? = nil, severityAvg: Double? = nil) {
            self.exerciseId = exerciseId
            self.severityAvg = severityAvg
        }
    }

    // MARK: - Input params (plateauDetectionEngine.ts:51 DetectExercisePlateauParams)

    /// `DetectExercisePlateauParams` (plateauDetectionEngine.ts:51). `e1rmProfile` and
    /// `loadFeedback` stay raw `JSONValue?` — see the file header for why the duck-typed
    /// unions are not closed into static types.
    public struct DetectExercisePlateauParams {
        public let exerciseId: String
        public let history: [TrainingSession]
        public let e1rmProfile: JSONValue?
        public let loadFeedback: JSONValue?
        public let effectiveSetSummary: EffectiveVolumeSummary?
        public let techniqueQualitySummary: TechniqueQualitySummary?
        public let painPatterns: [PainPattern]?
        public init(
            exerciseId: String,
            history: [TrainingSession] = [],
            e1rmProfile: JSONValue? = nil,
            loadFeedback: JSONValue? = nil,
            effectiveSetSummary: EffectiveVolumeSummary? = nil,
            techniqueQualitySummary: TechniqueQualitySummary? = nil,
            painPatterns: [PainPattern]? = nil
        ) {
            self.exerciseId = exerciseId
            self.history = history
            self.e1rmProfile = e1rmProfile
            self.loadFeedback = loadFeedback
            self.effectiveSetSummary = effectiveSetSummary
            self.techniqueQualitySummary = techniqueQualitySummary
            self.painPatterns = painPatterns
        }
    }

    /// `SessionPerformance` (plateauDetectionEngine.ts:61) — internal projection.
    private struct SessionPerformance {
        let sessionId: String
        let date: String
        let exerciseName: String
        let completedSetCount: Int
        let topWeightKg: Double
        let topReps: Double
        let topVolume: Double
    }

    // MARK: - Tiny helpers

    /// `signal(...)` factory (plateauDetectionEngine.ts:71). Default severity 'info'.
    private static func signal(_ id: String, _ label: String, _ reason: String, _ severity: String = "info") -> PlateauSignal {
        PlateauSignal(id: id, label: label, reason: reason, severity: severity)
    }

    /// JS truthiness for an optional string (`a || b` skips `undefined` AND `''`).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// `unique` (plateauDetectionEngine.ts:78): `[...new Set(items.filter(Boolean))]` —
    /// drop empties, dedup preserving first-seen order.
    private static func unique(_ items: [String]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for item in items where !item.isEmpty {
            if seen.insert(item).inserted { out.append(item) }
        }
        return out
    }

    // MARK: - Exercise identity (plateauDetectionEngine.ts:80-96)

    /// `exerciseIds` (plateauDetectionEngine.ts:80): the 7 identity fields, `filter(Boolean)`
    /// + `map(String)`. `baseId` / `canonicalExerciseId` / `replacementExerciseId` /
    /// `replacedFromId` ride in the `_unknown` open bag; `id` / `actualExerciseId` /
    /// `originalExerciseId` are typed.
    private static func exerciseIds(_ exercise: ExercisePrescription) -> Set<String> {
        var ids = Set<String>()
        let candidates: [String?] = [
            exercise.id,
            exercise._unknown["baseId"]?.stringValue,
            exercise._unknown["canonicalExerciseId"]?.stringValue,
            exercise.actualExerciseId,
            exercise._unknown["replacementExerciseId"]?.stringValue,
            exercise.originalExerciseId,
            exercise._unknown["replacedFromId"]?.stringValue,
        ]
        for candidate in candidates {
            if let value = truthy(candidate) { ids.insert(value) }
        }
        return ids
    }

    /// `exerciseMatches` (plateauDetectionEngine.ts:95).
    private static func exerciseMatches(_ exercise: ExercisePrescription, _ exerciseId: String) -> Bool {
        exerciseIds(exercise).contains(exerciseId)
    }

    /// `sessionDateKey` (plateauDetectionEngine.ts:98): `finishedAt || startedAt || date || ''`.
    private static func sessionDateKey(_ session: TrainingSession) -> String {
        truthy(session.finishedAt) ?? truthy(session.startedAt) ?? truthy(session.date) ?? ""
    }

    // MARK: - Session / set selection (plateauDetectionEngine.ts:100-118)

    /// `relevantSessions` (plateauDetectionEngine.ts:100). `localeCompare`-descending over
    /// ASCII ISO date keys is reproduced with `>` (the same precedent as
    /// `E1RMEngine.collectCandidates`); Swift's stable sort keeps TS tie order.
    private static func relevantSessions(_ history: [TrainingSession], _ exerciseId: String) -> [TrainingSession] {
        E1RMEngine.filterAnalyticsHistory(history)
            .filter { session in (session.exercises ?? []).contains { exerciseMatches($0, exerciseId) } }
            .sorted { sessionDateKey($0) > sessionDateKey($1) }
    }

    /// `relevantExerciseSets` (plateauDetectionEngine.ts:105). `set.type` lives in `_unknown`.
    private static func relevantExerciseSets(_ sessions: [TrainingSession], _ exerciseId: String) -> [TrainingSetLog] {
        sessions.flatMap { session in
            (session.exercises ?? [])
                .filter { exerciseMatches($0, exerciseId) }
                .flatMap { exercise in
                    E1RMEngine.completedSets(exercise).filter { $0._unknown["type"]?.stringValue != "warmup" }
                }
        }
    }

    /// `firstExerciseName` (plateauDetectionEngine.ts:112).
    private static func firstExerciseName(_ sessions: [TrainingSession], _ exerciseId: String) -> String {
        for session in sessions {
            if let exercise = (session.exercises ?? []).first(where: { exerciseMatches($0, exerciseId) }),
               let name = truthy(exercise.name) {
                return name
            }
        }
        return "该动作"
    }

    // MARK: - Technique summary (plateauDetectionEngine.ts:120)

    /// `buildTechniqueSummaryFromSets` (plateauDetectionEngine.ts:120). `rirRecorded`
    /// counts a set whose `rir !== undefined && rir !== ''` — a missing key is undefined
    /// (not counted), an explicit JSON `null` and any number/string ≠ '' ARE counted.
    private static func buildTechniqueSummaryFromSets(_ sets: [TrainingSetLog]) -> TechniqueQualitySummary {
        let totalSets = Double(sets.count)
        let good = Double(sets.filter { $0.techniqueQuality == "good" }.count)
        let acceptable = Double(sets.filter { $0.techniqueQuality == "acceptable" }.count)
        let poor = Double(sets.filter { $0.techniqueQuality == "poor" }.count)
        let rirRecorded = Double(sets.filter { set in
            set.rir != nil && set.rir != .string("")
        }.count)
        return TechniqueQualitySummary(
            totalSets: totalSets,
            good: good,
            acceptable: acceptable,
            poor: poor,
            goodOrAcceptableRate: totalSets != 0 ? (good + acceptable) / totalSets : 0,
            poorRate: totalSets != 0 ? poor / totalSets : 0,
            rirRecordedRate: totalSets != 0 ? rirRecorded / totalSets : 0
        )
    }

    // MARK: - Load feedback normalization (plateauDetectionEngine.ts:138-187)

    /// `isLoadFeedbackSummary` (plateauDetectionEngine.ts:138): object with both
    /// `counts` AND `adjustment` keys.
    private static func isLoadFeedbackSummary(_ value: JSONValue?) -> Bool {
        guard let object = value?.objectValue else { return false }
        return object["counts"] != nil && object["adjustment"] != nil
    }

    /// `normalizeLoadFeedback`'s `{ total, tooHeavy, tooLight, good, tooHeavyRate }`
    /// result (plateauDetectionEngine.ts:180).
    private struct NormalizedLoadFeedback {
        let total: Int
        let tooHeavy: Int
        let tooLight: Int
        let good: Int
        let tooHeavyRate: Double
    }

    /// `normalizeLoadFeedback` (plateauDetectionEngine.ts:141). Reproduces the TS
    /// duck-typed dispatch over the `LoadFeedbackInput` union + the session-history
    /// `loadFeedback` (which rides in `_unknown`).
    private static func normalizeLoadFeedback(_ input: JSONValue?, _ sessions: [TrainingSession], _ exerciseId: String) -> NormalizedLoadFeedback {
        var values: [String] = []

        // `addValue` (plateauDetectionEngine.ts:143): only the 3 canonical values, pushed
        // `count` times. `count` is `number(...)` (a Double) compared `index < count`,
        // matching the TS `for (let index = 0; index < count; index += 1)`.
        func addValue(_ value: String?, _ count: Double = 1) {
            guard value == LoadFeedbackEngine.tooHeavy
                || value == LoadFeedbackEngine.tooLight
                || value == LoadFeedbackEngine.good else { return }
            var index = 0.0
            while index < count {
                values.append(value!)
                index += 1
            }
        }

        // `addSummary` (plateauDetectionEngine.ts:148).
        func addSummary(_ summary: JSONValue?) {
            guard let summary, let object = summary.objectValue else { return }
            let counts = object["counts"]?.objectValue
            addValue(LoadFeedbackEngine.tooHeavy, E1RMEngine.number(counts?["too_heavy"]))
            addValue(LoadFeedbackEngine.tooLight, E1RMEngine.number(counts?["too_light"]))
            addValue(LoadFeedbackEngine.good, E1RMEngine.number(counts?["good"]))
            addValue(object["dominantFeedback"]?.stringValue)
            addValue(object["adjustment"]?.objectValue?["dominantFeedback"]?.stringValue)
        }

        // sessions.flatMap(loadFeedback).filter(exerciseId).forEach(addValue(feedback))
        // (plateauDetectionEngine.ts:157). `session.loadFeedback` rides in `_unknown`.
        for session in sessions {
            for item in session._unknown["loadFeedback"]?.arrayValue ?? [] {
                if item.objectValue?["exerciseId"]?.stringValue == exerciseId {
                    addValue(item.objectValue?["feedback"]?.stringValue)
                }
            }
        }

        // The `LoadFeedbackInput` union dispatch (plateauDetectionEngine.ts:162).
        if case .array(let items)? = input {
            for item in items {
                if item.objectValue?["feedback"] != nil {
                    addValue(item.objectValue?["feedback"]?.stringValue)
                } else {
                    addSummary(item)
                }
            }
        } else if isLoadFeedbackSummary(input) {
            addSummary(input)
        } else if case .object(let object)? = input {
            for entry in object.entries {
                if case .string(let s) = entry.value {
                    addValue(s)
                } else {
                    addSummary(entry.value)
                }
            }
        }

        let total = values.count
        let tooHeavy = values.filter { $0 == LoadFeedbackEngine.tooHeavy }.count
        let tooLight = values.filter { $0 == LoadFeedbackEngine.tooLight }.count
        let good = values.filter { $0 == LoadFeedbackEngine.good }.count
        return NormalizedLoadFeedback(
            total: total,
            tooHeavy: tooHeavy,
            tooLight: tooLight,
            good: good,
            tooHeavyRate: total != 0 ? Double(tooHeavy) / Double(total) : 0
        )
    }

    // MARK: - e1RM values (plateauDetectionEngine.ts:189)

    /// `e1rmValues` (plateauDetectionEngine.ts:189). Duck-typed over the
    /// `E1RMProfile | EstimatedOneRepMax | null` union: `'recentValues' in profile`
    /// (must be an array) → recentValues; else `'current' in profile || 'best' in profile`
    /// → [current.e1rmKg, best.e1rmKg]; else `'e1rmKg' in profile` → [e1rmKg].
    private static func e1rmValues(_ profile: JSONValue?) -> [Double] {
        guard let object = profile?.objectValue else { return [] }
        if case .array(let recent)? = object["recentValues"] {
            return recent.map { E1RMEngine.number($0) }.filter { $0 > 0 }
        }
        if object["current"] != nil || object["best"] != nil {
            return [
                E1RMEngine.number(object["current"]?.objectValue?["e1rmKg"]),
                E1RMEngine.number(object["best"]?.objectValue?["e1rmKg"]),
            ].filter { $0 > 0 }
        }
        if object["e1rmKg"] != nil {
            return [E1RMEngine.number(object["e1rmKg"])].filter { $0 > 0 }
        }
        return []
    }

    // MARK: - Session performances (plateauDetectionEngine.ts:199)

    /// `buildSessionPerformances` (plateauDetectionEngine.ts:199). `Math.max(0, ...xs)`
    /// is reproduced as `([0] + xs).max()!` (empty → 0).
    private static func buildSessionPerformances(_ sessions: [TrainingSession], _ exerciseId: String) -> [SessionPerformance] {
        sessions.reversed().map { session -> SessionPerformance in
            let exercise = (session.exercises ?? []).first { exerciseMatches($0, exerciseId) }
            let sets: [TrainingSetLog] = exercise.map { ex in
                E1RMEngine.completedSets(ex).filter { $0._unknown["type"]?.stringValue != "warmup" }
            } ?? []
            let topWeightKg = ([0.0] + sets.map { E1RMEngine.setWeightKg($0) }).max()!
            let topReps = ([0.0] + sets.map { E1RMEngine.number($0.reps) }).max()!
            let topVolume = ([0.0] + sets.map { E1RMEngine.setWeightKg($0) * E1RMEngine.number($0.reps) }).max()!
            return SessionPerformance(
                sessionId: session.id ?? "",
                date: sessionDateKey(session),
                exerciseName: truthy(exercise?.name) ?? "该动作",
                completedSetCount: sets.count,
                topWeightKg: topWeightKg,
                topReps: topReps,
                topVolume: topVolume
            )
        }
        .filter { $0.completedSetCount > 0 }
    }

    /// `isStableCompletion` (plateauDetectionEngine.ts:220).
    private static func isStableCompletion(_ items: [SessionPerformance]) -> Bool {
        if items.count < 4 { return false }
        let counts = items.map { Double($0.completedSetCount) }
        let average = counts.reduce(0, +) / Double(counts.count)
        let min = counts.min()!
        return min >= Swift.max(1, average * 0.65)
    }

    /// `countFlatSessions` (plateauDetectionEngine.ts:228).
    private static func countFlatSessions(_ items: [SessionPerformance]) -> Int {
        var bestWeight = 0.0
        var bestReps = 0.0
        var bestVolume = 0.0
        var flatCount = 0
        for (index, item) in items.enumerated() {
            if index > 0 {
                let weightFlat = item.topWeightKg <= bestWeight * 1.01
                let repsFlat = item.topReps <= bestReps
                let volumeFlat = item.topVolume <= bestVolume * 1.02
                if weightFlat && repsFlat && volumeFlat { flatCount += 1 }
            }
            bestWeight = Swift.max(bestWeight, item.topWeightKg)
            bestReps = Swift.max(bestReps, item.topReps)
            bestVolume = Swift.max(bestVolume, item.topVolume)
        }
        return flatCount
    }

    /// `isE1rmFlat` (plateauDetectionEngine.ts:249).
    private static func isE1rmFlat(_ values: [Double]) -> Bool {
        if values.count < 4 { return false }
        let recent = Array(values.suffix(4))
        let firstHalfBest = recent[0..<2].max()!
        let lastHalfBest = recent[2...].max()!
        return lastHalfBest <= firstHalfBest * 1.01
    }

    // MARK: - Copy builders (plateauDetectionEngine.ts:257-297)

    /// `buildLimitActions` (plateauDetectionEngine.ts:257).
    private static func buildLimitActions(_ status: PlateauStatus) -> [String] {
        switch status {
        case .loadTooAggressive:
            return ["下次先维持或小幅下调重量，确认不是重量推进过快。", "优先完成目标次数和动作质量，再考虑继续加重。"]
        case .techniqueLimited:
            return ["下次先把重量维持在可控范围，优先提高动作质量。", "如果动作变形明显，先减少加重频率。"]
        case .fatigueLimited:
            return ["下次先降低风险动作的压力，必要时选择更稳妥的替代动作。", "如果不适持续出现，先避免强行加重。"]
        case .volumeLimited:
            return ["先提高有效组完成数量，再判断是否需要调整重量。", "下周计划调整草案可以优先检查该动作或相关肌群的训练量。"]
        case .plateau:
            return ["进入计划调整预览时，可以优先检查该动作的训练量、次数范围和替代动作选择。", "下次不急于加重，先确认完成率、动作质量和恢复状态。"]
        case .possiblePlateau:
            return ["继续观察 1–2 次训练，确认是否只是短期波动。", "下次先维持重量，争取提高完成质量或目标次数。"]
        case .insufficientData:
            return ["继续记录同动作的重量、次数、余力（RIR）和动作质量。"]
        case .none:
            return ["继续按当前推荐执行，并保持重量、次数、余力（RIR）和动作质量记录。"]
        }
    }

    /// `statusTitle` (plateauDetectionEngine.ts:282).
    private static func statusTitle(_ status: PlateauStatus, _ exerciseName: String) -> String {
        switch status {
        case .insufficientData: return "\(exerciseName) 数据不足"
        case .loadTooAggressive: return "\(exerciseName) 可能推进过快"
        case .techniqueLimited: return "\(exerciseName) 受动作质量限制"
        case .fatigueLimited: return "\(exerciseName) 受疲劳或不适限制"
        case .volumeLimited: return "\(exerciseName) 可能训练量不足"
        case .plateau: return "\(exerciseName) 进展停滞"
        case .possiblePlateau: return "\(exerciseName) 进展放缓"
        case .none: return "\(exerciseName) 进展正常"
        }
    }

    /// `confidenceFromEvidence` (plateauDetectionEngine.ts:293).
    private static func confidenceFromEvidence(_ sessions: Int, _ e1rmCount: Int, _ status: PlateauStatus) -> String {
        if status == .insufficientData || sessions < 4 { return "low" }
        if sessions >= 8 || e1rmCount >= 5 { return "high" }
        return "medium"
    }

    /// `summaryByStatus` (plateauDetectionEngine.ts:423).
    private static func summaryByStatus(_ status: PlateauStatus) -> String {
        switch status {
        case .none:
            return "当前没有看到持续平台期迹象。继续保持记录，后续如果连续多次无进步再复查。"
        case .possiblePlateau:
            return "近期进展有放缓迹象，但还不足以直接判断为平台期。建议继续观察并优先提高完成质量。"
        case .plateau:
            return "近期多次训练没有明显进步，且完成情况较稳定，可以把它作为计划调整草案中的重点观察项。"
        case .fatigueLimited:
            return "当前更像是疲劳或不适限制了表现。建议先降低风险，再考虑增加重量或训练量。"
        case .techniqueLimited:
            return "当前更像是动作质量限制了表现。建议先稳定动作质量，再判断是否需要继续推进。"
        case .volumeLimited:
            return "当前更像是有效训练量不足。建议先提高高质量有效组，再考虑更激进的推进。"
        case .loadTooAggressive:
            return "当前更像是重量推进过快。建议下次先维持或小幅回退，避免把短期吃力误判为平台期。"
        case .insufficientData:
            return "当前同动作记录不足，暂时不能稳定判断平台期。"
        }
    }

    // MARK: - detectExercisePlateau (plateauDetectionEngine.ts:299)

    public static func detectExercisePlateau(_ params: DetectExercisePlateauParams) -> PlateauDetectionResult {
        let exerciseId = params.exerciseId
        let sessions = relevantSessions(params.history, exerciseId)
        let sets = relevantExerciseSets(sessions, exerciseId)
        let performances = buildSessionPerformances(sessions, exerciseId)
        let exerciseName = firstExerciseName(sessions, exerciseId)
        let technique = params.techniqueQualitySummary ?? buildTechniqueSummaryFromSets(sets)
        let feedback = normalizeLoadFeedback(params.loadFeedback, sessions, exerciseId)
        let values = e1rmValues(params.e1rmProfile)
        // `number(pattern.severityAvg)` (plateauDetectionEngine.ts:316): severityAvg is an
        // already-decoded finite Double, so `number(x)` (undefined→0, x→x) is `?? 0`.
        let matchedPainPatterns = (params.painPatterns ?? []).filter { pattern in
            pattern.exerciseId == exerciseId || (pattern.severityAvg ?? 0) >= 4
        }
        let painSetCount = sets.filter { $0.painFlag == true }.count
        let painRate = sets.isEmpty ? 0 : Double(painSetCount) / Double(sets.count)
        let flatSessions = countFlatSessions(performances)
        let stableCompletion = isStableCompletion(performances)
        let flatPerformance = performances.count >= 4 && stableCompletion && flatSessions >= Swift.max(3, performances.count - 2)
        let flatE1rm = isE1rmFlat(values)
        // `number(effectiveSetSummary?.field)` over the Partial — each field is an
        // already-decoded finite Double? so `number(...)` collapses to `?? 0`.
        let completedForVolume = Swift.max(params.effectiveSetSummary?.completedSets ?? 0, Double(sets.count))
        let effectiveSets = params.effectiveSetSummary?.effectiveSets ?? 0
        let highConfidenceEffectiveSets = params.effectiveSetSummary?.highConfidenceEffectiveSets ?? 0
        let effectiveRate = completedForVolume != 0 ? effectiveSets / completedForVolume : 0
        let highConfidenceRate = effectiveSets != 0 ? highConfidenceEffectiveSets / effectiveSets : 0
        let hasEffectiveSetSummary = params.effectiveSetSummary != nil
        let lowEffectiveVolume = completedForVolume >= 8
            && ((hasEffectiveSetSummary && effectiveRate < 0.45) || (hasEffectiveSetSummary && highConfidenceRate < 0.25))
        let tooAggressive = feedback.tooHeavy >= 2 && feedback.tooHeavyRate >= 0.4
        let techniqueLimited = technique.totalSets >= 4 && (technique.poor >= 2 || technique.poorRate >= 0.25)
        let fatigueLimited = matchedPainPatterns.count > 0 || painSetCount >= 2 || painRate >= 0.2
        let strongPlateau = performances.count >= 6 && stableCompletion && (flatE1rm || flatSessions >= 5)
        let possiblePlateau = performances.count >= 4 && (flatPerformance || flatE1rm)

        var signals: [PlateauSignal] = []

        // Early return — insufficient data (plateauDetectionEngine.ts:340).
        if sessions.count < 3 || sets.count < 5 || performances.count < 3 {
            signals.append(
                signal(
                    "data-depth",
                    "记录数量不足",
                    "同动作正式训练记录还不够，暂时不能稳定判断是否进入平台期。",
                    "warning"
                )
            )
            return PlateauDetectionResult(
                exerciseId: exerciseId,
                status: .insufficientData,
                title: statusTitle(.insufficientData, exerciseName),
                summary: "当前只能作为观察参考。继续记录几次同动作训练后，平台期判断会更可靠。",
                signals: signals,
                suggestedActions: buildLimitActions(.insufficientData),
                confidence: "low"
            )
        }

        signals.append(
            signal(
                "history-depth",
                "历史记录可用于判断",
                "已找到 \(performances.count) 次同动作正式训练记录，系统会结合完成情况和趋势判断。"
            )
        )

        if flatPerformance || flatE1rm {
            signals.append(
                signal(
                    "progress-flat",
                    "近期进展放缓",
                    flatE1rm
                        ? "近期 e1RM 趋势没有明显上升，同时需要结合重量、次数和完成率一起判断。"
                        : "近期多次训练的重量、次数和单组表现没有明显上升。",
                    strongPlateau ? "serious" : "warning"
                )
            )
        }

        if stableCompletion {
            signals.append(signal("completion-stable", "完成率稳定", "近期主要组完成情况较稳定，因此进展放缓更值得关注。"))
        }

        if tooAggressive {
            signals.append(
                signal("load-feedback-heavy", "重量反馈偏重", "最近多次反馈显示重量偏重，进展受限可能来自推进过快。", "serious")
            )
        } else if feedback.good >= 2 {
            signals.append(signal("load-feedback-good", "重量反馈稳定", "近期重量反馈整体可接受，进展判断更可靠。"))
        }

        if techniqueLimited {
            signals.append(
                signal("technique-quality", "动作质量限制", "近期有多组动作质量偏低，建议先解决执行质量，再判断是否需要加重。", "serious")
            )
        }

        if fatigueLimited {
            signals.append(
                signal("pain-or-fatigue", "疲劳或不适记录", "近期出现不适标记或相关不适模式，建议把风险控制放在加重之前。", "serious")
            )
        }

        if lowEffectiveVolume {
            signals.append(
                signal("effective-volume-low", "有效训练量不足", "完成组存在，但高质量有效组不足，可能限制该动作继续进步。", "warning")
            )
        }

        // Status arbitration (plateauDetectionEngine.ts:411).
        var status: PlateauStatus = .none
        if tooAggressive { status = .loadTooAggressive }
        else if techniqueLimited { status = .techniqueLimited }
        else if fatigueLimited { status = .fatigueLimited }
        else if lowEffectiveVolume { status = .volumeLimited }
        else if strongPlateau { status = .plateau }
        else if possiblePlateau { status = .possiblePlateau }

        if status == .none {
            signals.append(signal("progress-normal", "暂无平台迹象", "近期记录没有显示持续停滞，可以继续按当前建议执行。"))
        }

        // Dedup signals by id, first-seen order (plateauDetectionEngine.ts:439).
        let dedupedSignals = unique(signals.map { $0.id }).map { id in
            signals.first { $0.id == id }!
        }

        return PlateauDetectionResult(
            exerciseId: exerciseId,
            status: status,
            title: statusTitle(status, exerciseName),
            summary: summaryByStatus(status),
            signals: dedupedSignals,
            suggestedActions: buildLimitActions(status),
            confidence: confidenceFromEvidence(performances.count, values.count, status)
        )
    }
}
