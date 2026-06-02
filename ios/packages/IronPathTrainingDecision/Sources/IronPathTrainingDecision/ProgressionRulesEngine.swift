// ProgressionRulesEngine — iOS-17e-3 progressive-suggestion port.
//
// Faithful line-by-line Swift port of the PURE progressive-suggestion functions from
// `src/engines/progressionRulesEngine.ts`:
//   - makeSuggestion        (progressionRulesEngine.ts:139)
//   - shouldUseTopBackoff   (progressionRulesEngine.ts:271)
//   - buildSetPrescription  (progressionRulesEngine.ts:274)
// + every private helper they read (averageRir / qualityRank / averageTechniqueQuality /
//   hitRepCeiling / firstSetBelowFloor / rirAllowsProgress / roundToUnit / roundLoad /
//   progressionIncrement / summarizeRir / summarizeTechnique / recentPoorTechniqueCount /
//   applyFineTuneIfDataRich, progressionRulesEngine.ts:39-137) and the `Suggestion` /
//   `ExerciseForProgression` types (progressionRulesEngine.ts:9/28).
//
// Reuse note (do NOT re-port):
//   - findRecentPerformances / findPreviousPerformance + `PerformanceSnapshot` are the
//     already-ported `AdaptiveFeedbackEngine.*` (17e-2, AdaptiveFeedbackEngine.swift).
//   - the set helpers `number` / `setWeightKg` are the already-ported `E1RMEngine.*`
//     (17e-1, E1RMEngine.swift:70/126), shared verbatim so `setVolume` / `number`
//     semantics stay identical across engines.
//
// fineTune LIVE (iOS-17e-6a) — the 17e-3 golden-neutral stub is REMOVED:
//   makeSuggestion now calls the already-ported `SetWeightFineTuneEngine.buildSetWeightFineTune`
//   (17e-4) for real, threading an injected `asOfDate` (§11.2 clock). The pure port REQUIRES
//   a non-nil asOfDate to compute a projection: a `nil` asOfDate hits the SAME
//   `insufficient_history` fallback the TS wall-clock branch lands on for out-of-window
//   history (SetWeightFineTuneEngine.swift:255-257), so passing `nil` reproduces the OLD
//   golden-neutral behaviour EXACTLY — the existing 6 `progression-suggestion/*` goldens
//   (deterministicClockIso anchored in 2020, history out of any plausible wall-clock window,
//   so the TS generator's wall-clock fineTune is also insufficient) stay byte-identical and
//   `applyFineTuneIfDataRich` is a no-op → legacy decision-tree baseline.
//   ⚠️ asOfDate CONTRACT: `nil` SILENTLY degrades to the legacy path. Any LIVE decision
//   wiring (the iOS-17e-6b per-exercise frame, deferred) MUST pass the injected `nowIso`
//   so the projection actually fires — passing `nil` from a live path is a SILENT bug, not
//   a crash. The fineTune-rich parity fixtures pass `asOfDate = deterministicClockIso` so
//   the `±10% clamp / 2.5-round / legacy-respect` body of `applyFineTuneIfDataRich` is
//   actually exercised by goldens.
//
// PURE: consumes `templateExercise` + `history: [TrainingSession]` + an optional injected
// `asOfDate` (all §11 clean inputs); no IO, no ambient clock, no randomness. It is NOT yet
// wired into the decision output (that frame wiring is the deferred 17e-6b); this slice
// makes the ported fineTune projection LIVE + parity-pins its live branches.

import Foundation
import IronPathDomain

public enum ProgressionRulesEngine {

    // MARK: - Types

    public typealias PerformanceSnapshot = AdaptiveFeedbackEngine.PerformanceSnapshot

    /// `ExerciseForProgression` (progressionRulesEngine.ts:9). Numeric fields are decoded
    /// as `Double?` so `number(x)` (finite-or-0) and the raw `${x}` interpolation behave
    /// like the TS values. `sets` is a NUMBER for every template the engine consumes (the
    /// `TrainingSetLog[]` arm of the TS union is never reached by these three functions).
    public struct ExerciseForProgression: Equatable, Sendable {
        public var id: String
        public var baseId: String?
        public var name: String?
        public var kind: String
        public var sets: Double?
        public var repMin: Double?
        public var repMax: Double?
        public var startWeight: Double?
        public var rest: Double?
        public var targetRir: [Double]?
        public var targetRirText: String?
        public var progressionUnitKg: Double?
        public var progressionPercent: [Double]?
        public var conservativeTopSet: Bool?
        public var progressLocked: Bool?
        public var replacementSuggested: String?
        public var fatigueCost: String?
        public var adaptiveTopSetFactor: Double?
        public var adaptiveBackoffFactor: Double?
        public var regressionIds: [String]?

        public init(
            id: String,
            baseId: String? = nil,
            name: String? = nil,
            kind: String,
            sets: Double? = nil,
            repMin: Double? = nil,
            repMax: Double? = nil,
            startWeight: Double? = nil,
            rest: Double? = nil,
            targetRir: [Double]? = nil,
            targetRirText: String? = nil,
            progressionUnitKg: Double? = nil,
            progressionPercent: [Double]? = nil,
            conservativeTopSet: Bool? = nil,
            progressLocked: Bool? = nil,
            replacementSuggested: String? = nil,
            fatigueCost: String? = nil,
            adaptiveTopSetFactor: Double? = nil,
            adaptiveBackoffFactor: Double? = nil,
            regressionIds: [String]? = nil
        ) {
            self.id = id
            self.baseId = baseId
            self.name = name
            self.kind = kind
            self.sets = sets
            self.repMin = repMin
            self.repMax = repMax
            self.startWeight = startWeight
            self.rest = rest
            self.targetRir = targetRir
            self.targetRirText = targetRirText
            self.progressionUnitKg = progressionUnitKg
            self.progressionPercent = progressionPercent
            self.conservativeTopSet = conservativeTopSet
            self.progressLocked = progressLocked
            self.replacementSuggested = replacementSuggested
            self.fatigueCost = fatigueCost
            self.adaptiveTopSetFactor = adaptiveTopSetFactor
            self.adaptiveBackoffFactor = adaptiveBackoffFactor
            self.regressionIds = regressionIds
        }
    }

    /// `Suggestion` (progressionRulesEngine.ts:28).
    public struct Suggestion: Equatable, Sendable {
        public let weight: Double
        public let reps: Double
        public let lastSummary: String
        public let targetSummary: String
        public let note: String
    }

    /// The `Pick<Suggestion, 'weight' | 'reps'>` input `buildSetPrescription` consumes.
    public struct SuggestionInput: Equatable, Sendable {
        public let weight: Double
        public let reps: Double
        public init(weight: Double, reps: Double) {
            self.weight = weight
            self.reps = reps
        }
    }

    /// `buildSetPrescription` return shape (progressionRulesEngine.ts:286/305).
    public struct SetPrescription: Equatable, Sendable {
        public let topWeight: Double
        public let topReps: Double
        public let backoffWeight: Double
        public let backoffReps: Double
        public let summary: String
    }

    // MARK: - JS-value helpers

    /// `number(value)` for an exercise numeric field (engineUtils.ts:38) — already finite
    /// once decoded, undefined → 0.
    private static func number(_ value: Double?) -> Double { value ?? 0 }

    /// JS truthiness for an optional string (`a || b` skips empty strings).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// `Math.round` — `floor(x + 0.5)` (half toward +∞), matching V8 rather than Swift's
    /// round-half-away-from-zero. Shared by roundToUnit / roundLoad / applyFineTuneIfDataRich.
    private static func jsRound(_ value: Double) -> Double { (value + 0.5).rounded(.down) }

    /// JS `${n}` for a finite Double: integers print without a decimal point, fractional
    /// values print their shortest round-trip decimal. Every weight/rep this engine emits
    /// is a plate-grid multiple (×0.5 / ×2.5) which Double holds exactly, so Swift's
    /// shortest-round-trip description matches V8 once the integer ".0" suffix is stripped.
    private static func jsNum(_ value: Double) -> String {
        if value.isFinite, value == value.rounded(.towardZero), abs(value) < 1e15 {
            return String(Int64(value))
        }
        return String(value)
    }

    /// `${exercise.field}` raw interpolation of a numeric field — the JS value itself
    /// (number) stringified, i.e. `jsNum(number(field))`.
    private static func rawNum(_ value: Double?) -> String { jsNum(number(value)) }

    /// `Number.prototype.toFixed(1)`. The rir averages this engine produces are exact to
    /// well under a tenth, so standard fixed-point formatting matches V8.
    private static func toFixed1(_ value: Double) -> String { String(format: "%.1f", value) }

    /// `${templateExercise.targetRirText}` — `${undefined}` renders the literal "undefined".
    private static func targetRirText(_ exercise: ExerciseForProgression) -> String {
        exercise.targetRirText ?? "undefined"
    }

    /// `Number(set.rir)` then `.filter(Number.isFinite)`: undefined → NaN (filtered, nil),
    /// null/'' → 0 (kept, JS Number semantics), numeric string → its value or NaN.
    private static func numberFinite(_ value: JSONValue?) -> Double? {
        guard let value else { return nil }                  // undefined → NaN → filtered
        switch value {
        case .null: return 0                                  // Number(null) === 0
        case .bool(let b): return b ? 1 : 0
        case .number(let n): return n.doubleValue
        case .string(let s):
            let trimmed = s.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return 0 }                   // Number('') === 0
            guard let parsed = Double(trimmed), parsed.isFinite else { return nil }
            return parsed
        case .array, .object: return nil                      // Number(obj/arr) → NaN (filtered)
        }
    }

    // MARK: - Set / technique helpers (progressionRulesEngine.ts:39-137)

    /// `weightText` (engineUtils.ts:119): `${number(weight)}kg`.
    private static func weightText(_ weight: Double) -> String { "\(jsNum(weight))kg" }
    private static func weightText(_ weight: Double?) -> String { "\(rawNum(weight))kg" }

    /// `setVolume` (engineUtils.ts:107): `setWeightKg(set) * number(set.reps)`.
    private static func setVolume(_ set: TrainingSetLog) -> Double {
        E1RMEngine.setWeightKg(set) * E1RMEngine.number(set.reps)
    }

    /// `repsText` (engineUtils.ts:118): `sets.map(number(reps)).join('/')`.
    private static func repsText(_ sets: [TrainingSetLog]) -> String {
        sets.map { jsNum(E1RMEngine.number($0.reps)) }.joined(separator: "/")
    }

    /// `averageRir` (progressionRulesEngine.ts:39).
    private static func averageRir(_ sets: [TrainingSetLog]) -> Double? {
        let values = sets.compactMap { numberFinite($0.rir) }
        if values.isEmpty { return nil }
        return values.reduce(0, +) / Double(values.count)
    }

    /// `qualityRank` (progressionRulesEngine.ts:45).
    private static func qualityRank(_ quality: String?) -> Int {
        if quality == "good" { return 2 }
        if quality == "acceptable" { return 1 }
        return 0
    }

    /// `averageTechniqueQuality` (progressionRulesEngine.ts:51). `set.techniqueQuality ||
    /// 'acceptable'` treats empty/undefined as 'acceptable'.
    private static func averageTechniqueQuality(_ sets: [TrainingSetLog]) -> String {
        if sets.isEmpty { return "acceptable" }
        let total = sets.reduce(0.0) { $0 + Double(qualityRank(truthy($1.techniqueQuality) ?? "acceptable")) }
        let avg = total / Double(sets.count)
        if avg >= 1.5 { return "good" }
        if avg < 0.75 { return "poor" }
        return "acceptable"
    }

    /// `hitRepCeiling` (progressionRulesEngine.ts:59).
    private static func hitRepCeiling(_ performance: PerformanceSnapshot?, _ exercise: ExerciseForProgression) -> Bool {
        guard let performance, !performance.sets.isEmpty else { return false }
        let setCount = number(exercise.sets)
        guard Double(performance.sets.count) >= setCount else { return false }
        let repMax = number(exercise.repMax)
        let sliceLength = Swift.max(0, Int(setCount))               // slice(0, number(sets)) — ToInteger
        return performance.sets.prefix(sliceLength).allSatisfy { E1RMEngine.number($0.reps) >= repMax }
    }

    /// `firstSetBelowFloor` (progressionRulesEngine.ts:66).
    private static func firstSetBelowFloor(_ performance: PerformanceSnapshot?, _ exercise: ExerciseForProgression) -> Bool {
        guard let performance, let first = performance.sets.first else { return false }
        return E1RMEngine.number(first.reps) < number(exercise.repMin)
    }

    /// `rirAllowsProgress` (progressionRulesEngine.ts:69). `targetRir?.[0] ?? 1` (nullish —
    /// a literal 0 stays 0).
    private static func rirAllowsProgress(_ performance: PerformanceSnapshot?, _ exercise: ExerciseForProgression) -> Bool {
        let avg = averageRir(performance?.sets ?? [])
        guard let avg else { return true }
        return avg >= (exercise.targetRir?.first ?? 1)
    }

    /// `roundToUnit` (progressionRulesEngine.ts:75).
    private static func roundToUnit(_ value: Double, _ unit: Double) -> Double {
        Swift.max(unit, jsRound(value / unit) * unit)
    }

    /// `roundLoad` (progressionRulesEngine.ts:76).
    private static func roundLoad(_ value: Double, _ unit: Double = 2.5) -> Double {
        Swift.max(unit, jsRound(value / unit) * unit)
    }

    /// `progressionIncrement` (progressionRulesEngine.ts:118). `progressionUnitKg || 1`,
    /// `(progressionPercent?.[0] || 5) / 100`.
    private static func progressionIncrement(_ exercise: ExerciseForProgression, _ currentWeight: Double) -> Double {
        let unit = number(exercise.progressionUnitKg) != 0 ? number(exercise.progressionUnitKg) : 1
        let firstPercent = exercise.progressionPercent?.first ?? 0
        let percent = (firstPercent != 0 ? firstPercent : 5) / 100
        return roundToUnit(Swift.max(unit, currentWeight * percent), unit)
    }

    /// `summarizeRir` (progressionRulesEngine.ts:124).
    private static func summarizeRir(_ sets: [TrainingSetLog]) -> String {
        guard let avg = averageRir(sets) else { return "" }
        return " / RIR \(toFixed1(avg))"
    }

    /// `summarizeTechnique` (progressionRulesEngine.ts:129).
    private static func summarizeTechnique(_ sets: [TrainingSetLog]) -> String {
        let quality = averageTechniqueQuality(sets)
        if quality == "good" { return " / 技术良好" }
        if quality == "poor" { return " / 技术较差" }
        return ""
    }

    /// `recentPoorTechniqueCount` (progressionRulesEngine.ts:136).
    private static func recentPoorTechniqueCount(_ recent: [PerformanceSnapshot]) -> Int {
        recent.filter { averageTechniqueQuality($0.sets) == "poor" }.count
    }

    /// `applyFineTuneIfDataRich` (progressionRulesEngine.ts:88). Blends the LIVE fineTune
    /// projection (iOS-17e-6a) into the decision tree: a hard-backoff path or an
    /// insufficient/invalid fineTune short-circuits to `baselineWeight`; otherwise the
    /// projection is ±10%-clamped to the last working weight, 2.5kg-rounded, and a flat
    /// trend that would undercut a legacy "ready to add" is respected (returns baseline).
    /// With a `nil` asOfDate the fallbackReason is `insufficient_history`, so this stays a
    /// no-op (the 17e-3 golden-neutral behaviour).
    private static func applyFineTuneIfDataRich(
        _ baselineWeight: Double,
        _ lastWorkingWeight: Double,
        _ fineTuneSuggested: Double,
        _ fineTuneFallbackReason: String?,
        _ shouldBackoff: Bool
    ) -> Double {
        if shouldBackoff { return baselineWeight }
        if fineTuneFallbackReason == "insufficient_history" || fineTuneFallbackReason == "rep_range_invalid" {
            return baselineWeight
        }
        if !fineTuneSuggested.isFinite || fineTuneSuggested <= 0 { return baselineWeight }
        let minAllowed = lastWorkingWeight * 0.9
        let maxAllowed = lastWorkingWeight * 1.1
        let clampedFine = Swift.max(minAllowed, Swift.min(maxAllowed, fineTuneSuggested))
        let roundedFine = jsRound(clampedFine / 2.5) * 2.5
        if baselineWeight > lastWorkingWeight && roundedFine <= lastWorkingWeight {
            return baselineWeight
        }
        return roundedFine
    }

    // MARK: - makeSuggestion (progressionRulesEngine.ts:139)

    /// `asOfDate` is the §11.2 injected clock fed to the live fineTune projection. It
    /// DEFAULTS to `nil`, which reproduces the 17e-3 golden-neutral behaviour exactly
    /// (nil → `SetWeightFineTuneEngine` `insufficient_history` fallback → legacy baseline),
    /// so the existing function-level callers/goldens are unchanged. A live decision wiring
    /// MUST pass the injected `nowIso` (see the file header asOfDate CONTRACT).
    public static func makeSuggestion(_ templateExercise: ExerciseForProgression, _ history: [TrainingSession], asOfDate: String? = nil) -> Suggestion {
        let historyId = truthy(templateExercise.baseId) ?? templateExercise.id   // baseId || id
        let recent = AdaptiveFeedbackEngine.findRecentPerformances(history, historyId, limit: 3)
        let last = recent.first
        let conservativeBias = (templateExercise.conservativeTopSet == true) || (templateExercise.progressLocked == true)

        // ts:145-159 — first-session baseline.
        guard let last else {
            let rangeNote: String
            if templateExercise.kind == "isolation" && number(templateExercise.repMax) >= 20 {
                let baselineCeiling = Swift.min(number(templateExercise.repMin) + 2, number(templateExercise.repMax))
                rangeNote = " \(rawNum(templateExercise.repMin))-\(rawNum(templateExercise.repMax)) 次是目标范围，不代表每组必须做到 \(rawNum(templateExercise.repMax)) 次；数据不足时先从 \(rawNum(templateExercise.repMin))-\(jsNum(baselineCeiling)) 次建立基线。"
            } else {
                rangeNote = ""
            }
            let note = conservativeBias
                ? "先建立基线，今天把第一组做保守一点，停在 \(targetRirText(templateExercise))。\(rangeNote)"
                : "先建立基线，默认停在 \(targetRirText(templateExercise))。\(rangeNote)"
            return Suggestion(
                weight: number(templateExercise.startWeight),
                reps: number(templateExercise.repMin),
                lastSummary: "暂无历史",
                targetSummary: "\(weightText(templateExercise.startWeight)) x \(rawNum(templateExercise.repMin))-\(rawNum(templateExercise.repMax)) x \(rawNum(templateExercise.sets)) / \(targetRirText(templateExercise))",
                note: note
            )
        }

        // ts:161 — number(last.sets[0]?.weight || templateExercise.startWeight).
        let lastWeight: Double = {
            if let firstWeight = last.sets.first?.weight, E1RMEngine.number(firstWeight) != 0 {
                return E1RMEngine.number(firstWeight)
            }
            return number(templateExercise.startWeight)
        }()
        // ts:162 — previous = recent[1] || findPreviousPerformance(history, id, last.session.id).
        let previous: PerformanceSnapshot? = recent.count > 1
            ? recent[1]
            : AdaptiveFeedbackEngine.findPreviousPerformance(history, historyId, skipSessionId: last.session.id)
        let hitTop = hitRepCeiling(last, templateExercise)
        let previousHitTop = hitRepCeiling(previous, templateExercise)
        let lastVolume = last.sets.reduce(0.0) { $0 + setVolume($1) }
        let previousVolume: Double? = previous.map { p in p.sets.reduce(0.0) { $0 + setVolume($1) } }
        // ts:167 — Boolean(previousVolume && lastVolume < previousVolume * 0.9) (truthy: non-nil, non-zero).
        let dropped: Bool = {
            guard let pv = previousVolume, pv != 0 else { return false }
            return lastVolume < pv * 0.9
        }()
        let tooHard = firstSetBelowFloor(last, templateExercise) || !rirAllowsProgress(last, templateExercise)
        let increment = progressionIncrement(templateExercise, lastWeight)
        let lastTechnique = averageTechniqueQuality(last.sets)
        let previousTechnique = previous != nil ? averageTechniqueQuality(previous!.sets) : "acceptable"
        let poorTechniqueStreak = recentPoorTechniqueCount(recent)

        let techniqueBlocksProgress = (lastTechnique == "poor")
        let techniqueSuggestsBackoff = poorTechniqueStreak >= 2 || (lastTechnique == "poor" && previousTechnique == "poor")
        let shouldAdd = hitTop && previousHitTop && !tooHard
            && !(templateExercise.progressLocked == true)
            && !(templateExercise.conservativeTopSet == true)
            && !techniqueBlocksProgress
        let shouldBackoff = tooHard || dropped || techniqueSuggestsBackoff

        // ts:180-184.
        let baselineWeight: Double
        if shouldBackoff {
            let unitFloor = number(templateExercise.progressionUnitKg) != 0 ? number(templateExercise.progressionUnitKg) : 1
            baselineWeight = Swift.max(unitFloor, lastWeight - increment)
        } else if shouldAdd {
            baselineWeight = lastWeight + increment
        } else {
            baselineWeight = lastWeight
        }

        // ts:198-201 — medianReps: the user's actual working reps (median of the last
        // session's positive rep counts), so the fineTune projection stays in the ballpark
        // of their lived experience rather than repMin (the heavy end). `length / 2` is JS
        // float-div then Math.floor; for a non-negative count Swift Int-div is identical.
        let recentReps = last.sets.map { E1RMEngine.number($0.reps) }.filter { $0 > 0 }
        let medianReps: Double = recentReps.isEmpty
            ? jsRound((number(templateExercise.repMin) + number(templateExercise.repMax)) / 2)
            : recentReps.sorted()[recentReps.count / 2]

        // ts:202-228 — LIVE fineTune projection (iOS-17e-6a; the 17e-3 stub is removed).
        // Calls the already-ported SetWeightFineTuneEngine (17e-4) with the injected
        // `asOfDate`. ⚠️ asOfDate CONTRACT (file header): `nil` → insufficient_history
        // fallback → applyFineTuneIfDataRich no-op → legacy baseline (the 17e-3 goldens'
        // unchanged behaviour); a LIVE wiring MUST pass the injected nowIso so the
        // projection fires. PURE — SetWeightFineTuneEngine reads only the injected clock.
        let fineTune = SetWeightFineTuneEngine.buildSetWeightFineTune(
            SetWeightFineTuneEngine.SetWeightFineTuneInput(
                history: history,
                exerciseId: historyId,
                baseExerciseId: templateExercise.baseId,
                targetReps: medianReps,
                repMin: number(templateExercise.repMin),
                repMax: number(templateExercise.repMax),
                asOfDate: asOfDate
            )
        )
        let fineTuneSuggestedWeightKg = fineTune.suggestedWeightKg
        let fineTuneFallbackReason = fineTune.basis.fallbackReason
        let safetyBrake = shouldBackoff
            || techniqueBlocksProgress
            || (templateExercise.progressLocked == true)
            || conservativeBias
            || !shouldAdd
        var nextWeight = applyFineTuneIfDataRich(baselineWeight, lastWeight, fineTuneSuggestedWeightKg, fineTuneFallbackReason, safetyBrake)

        var nextReps = (shouldAdd || shouldBackoff) ? number(templateExercise.repMin) : number(templateExercise.repMax)
        let avgRir = averageRir(last.sets)

        if conservativeBias && !shouldBackoff && !shouldAdd { nextReps = number(templateExercise.repMin) }   // ts:233
        if (templateExercise.conservativeTopSet == true) && !shouldBackoff { nextWeight = lastWeight }       // ts:234

        var notes: [String] = []
        if shouldBackoff {
            notes.append(techniqueSuggestsBackoff
                ? "最近两次动作质量都偏差，今天先退回到 \(weightText(nextWeight))。"
                : "最近表现回落，今天先退回到 \(weightText(nextWeight))。")
        } else if templateExercise.progressLocked == true {
            notes.append("今天锁定推进，不加重，优先把动作做干净。")
        } else if techniqueBlocksProgress {
            notes.append("虽然次数达标，但动作质量较差，本次先不建议加重。")
        } else if shouldAdd {
            notes.append("连续两次打满上限，今天加 \(jsNum(increment))kg。")
        } else if hitTop {
            notes.append("已经打到过一次上限，再稳一练再加重。")
        } else if let avgRir, avgRir > (exerciseTargetRirSecond(templateExercise)) + 1 {
            notes.append("RIR 还偏高，先把次数打满，再加重量。")
        } else {
            notes.append("先把 \(weightText(lastWeight)) 稳定推进到目标次数上限。")
        }

        if poorTechniqueStreak >= 2, let regressionIds = templateExercise.regressionIds, !regressionIds.isEmpty {
            notes.append("如果下次技术质量还差，可以考虑回退到 \(regressionIds[0])。")
        }
        if let replacement = truthy(templateExercise.replacementSuggested) {
            notes.append("今天更建议换成 \(replacement)。")
        }

        return Suggestion(
            weight: nextWeight,
            reps: nextReps,
            lastSummary: "\(weightText(lastWeight)) x \(repsText(last.sets))\(summarizeRir(last.sets))\(summarizeTechnique(last.sets))",
            targetSummary: "\(weightText(nextWeight)) x \(rawNum(templateExercise.repMin))-\(rawNum(templateExercise.repMax)) x \(rawNum(templateExercise.sets)) / \(targetRirText(templateExercise))",
            note: notes.joined(separator: " ")
        )
    }

    /// `targetRir?.[1] ?? 3` (nullish — a literal 0 stays 0).
    private static func exerciseTargetRirSecond(_ exercise: ExerciseForProgression) -> Double {
        if let targetRir = exercise.targetRir, targetRir.count > 1 { return targetRir[1] }
        return 3
    }

    // MARK: - shouldUseTopBackoff (progressionRulesEngine.ts:271)

    public static func shouldUseTopBackoff(_ exercise: ExerciseForProgression) -> Bool {
        (exercise.kind == "compound" || exercise.kind == "machine")
            && number(exercise.sets) >= 3
            && number(exercise.startWeight) >= 30
    }

    // MARK: - buildSetPrescription (progressionRulesEngine.ts:274)

    public static func buildSetPrescription(_ exercise: ExerciseForProgression, _ suggestion: SuggestionInput) -> SetPrescription {
        let unit = number(exercise.progressionUnitKg) != 0 ? number(exercise.progressionUnitKg) : 2.5
        let conservative = (exercise.conservativeTopSet == true)
        let adaptiveTopFactor = number(exercise.adaptiveTopSetFactor) != 0 ? number(exercise.adaptiveTopSetFactor) : 1
        let adaptiveBackoffFactor = number(exercise.adaptiveBackoffFactor) != 0 ? number(exercise.adaptiveBackoffFactor) : 0.92

        if !shouldUseTopBackoff(exercise) {
            let workingWeight = roundLoad((conservative ? suggestion.weight * 0.97 : suggestion.weight) * adaptiveTopFactor, unit)
            let workingReps = conservative
                ? Swift.max(number(exercise.repMin), Swift.min(suggestion.reps, number(exercise.repMin)))
                : suggestion.reps
            return SetPrescription(
                topWeight: workingWeight,
                topReps: workingReps,
                backoffWeight: workingWeight,
                backoffReps: workingReps,
                summary: "\(weightText(workingWeight)) x \(rawNum(exercise.repMin))-\(rawNum(exercise.repMax)) x \(rawNum(exercise.sets))\((conservative || adaptiveTopFactor < 1) ? " / 保守版" : "")"
            )
        }

        let rawTopWeight = (conservative ? suggestion.weight * 0.96 : suggestion.weight) * adaptiveTopFactor
        let topWeight = roundLoad(rawTopWeight, unit)
        let topReps = conservative
            ? Swift.max(number(exercise.repMin), Swift.min(suggestion.reps, number(exercise.repMin)))
            : suggestion.reps
        let baseBackoffDrop = exercise.fatigueCost == "high" ? 0.9 : 0.92
        let conservativeDrop = conservative ? (exercise.fatigueCost == "high" ? 0.86 : 0.88) : baseBackoffDrop
        let backoffWeight = roundLoad(topWeight * Swift.min(conservativeDrop, adaptiveBackoffFactor), unit)
        let backoffReps = conservative
            ? Swift.max(number(exercise.repMin), Swift.min(number(exercise.repMax), topReps + 1))
            : Swift.min(number(exercise.repMax), Swift.max(number(exercise.repMin), suggestion.reps + 1))

        return SetPrescription(
            topWeight: topWeight,
            topReps: topReps,
            backoffWeight: backoffWeight,
            backoffReps: backoffReps,
            summary: "顶组 \(weightText(topWeight)) x \(jsNum(topReps))；回退 \(weightText(backoffWeight)) x \(jsNum(Swift.max(1, number(exercise.sets) - 1)))\((conservative || adaptiveTopFactor < 1 || adaptiveBackoffFactor < 0.92) ? " / 保守版" : "")"
        )
    }
}
