// EngineUtils — PA-S2 engineUtils engine-tool subset V1.
//
// Faithful Swift port of the PURE/read-only engine tools from
// `retired web reference` that the PA (Plan-Adaptive) engine cluster
// (programAdjustmentEngine / exercisePrescriptionEngine / systemConsistencyEngine,
// ported S3+) consumes, scoped to this slice:
//
//   * `getPrimaryMuscles` (engineUtils.ts:207) — a THIN typed overload over the
//     PA-S1 typed `ExerciseTemplate`. The ExercisePrescription flavor is already
//     ported as `AnalyticsSupport.getPrimaryMuscles` (open-bag read); this overload
//     reads the SAME two fields as TYPED `ExerciseTemplate` properties so the PA
//     engine cluster can call it on strongly-typed inputs. Byte-identical logic —
//     NOT a re-port.
//   * `buildExerciseMetadata` (engineUtils.ts:135-193) + `enrichExercise`
//     (engineUtils.ts:196-199) — BREAK-GLASS faithful port of the LOGIC + DEFAULT
//     branches. `enrichExercise` was previously marked intentionally-NOT-ported in
//     `AdaptiveFeedbackEngine.swift`; PA-S2 lifts that for the PA cluster.
//
// `number` (engineUtils.ts:38) is already ported as `E1RMEngine.number` and is
// REUSED below verbatim — never re-ported. `clone` (engineUtils.ts:28) is ported as
// the Domain helper `EngineValueUtils.clone`.
//
// ── OVERRIDE-DATA SEAM (the PA-S2 boundary, do NOT cross) ───────────────────────
// `buildExerciseMetadata` in legacy web schema reads TWO id-keyed knowledge tables:
//   * `EXERCISE_KNOWLEDGE_OVERRIDES[exercise.id] || {}`  (engineUtils.ts:136)
//     — `exerciseLibrary.ts:485`, a ~1000-line value table;
//   * `EXERCISE_EQUIVALENCE_CHAINS[exercise.id]`          (engineUtils.ts:137)
//     — `exerciseLibrary.ts:420`.
// Neither table is inlined here: that DATA port is PA-S3. Instead both arrive as
// INJECTED seams (`override` default empty `[:]`, `equivalence` default `nil`), and
// this slice ports only the merge + default-derivation LOGIC over a given seam. With
// the empty/nil defaults every `override.X || default` collapses to its default —
// exactly the branch the OUTPUT-parity golden pins. (This is a DIFFERENT seam from
// the bounded `TrainingDecisionExerciseKnowledge` 6-exercise data subset used by the
// prescription chain; the two do not overlap.)
//
// PURE: zero write path, zero `: Date` (no wall clock — these tools carry no clock),
// zero IO, zero randomness. §11 clean-engine-input purity preserved.

import Foundation
import IronPathDomain

enum EngineUtils {

    // MARK: - getPrimaryMuscles (engineUtils.ts:207) — typed ExerciseTemplate overload

    /// `getPrimaryMuscles` (engineUtils.ts:207):
    /// `exercise.primaryMuscles?.length ? exercise.primaryMuscles : [exercise.muscle].filter(Boolean)`.
    ///
    /// Typed adapter for the PA-S1 `ExerciseTemplate` (whose `primaryMuscles` / `muscle`
    /// are promoted typed fields). Byte-identical to `AnalyticsSupport.getPrimaryMuscles`
    /// (which reads the SAME fields out of `ExercisePrescription`'s open bag) — this is an
    /// adapter for typed input, NOT a re-port of the logic.
    static func getPrimaryMuscles(_ exercise: ExerciseTemplate) -> [String] {
        if let arr = exercise.primaryMuscles, !arr.isEmpty {
            return arr // `primaryMuscles?.length ? primaryMuscles`
        }
        // `: [exercise.muscle].filter(Boolean)` — drop nil/empty (`Boolean('')` is false).
        return [exercise.muscle].compactMap { $0 }.filter { !$0.isEmpty }
    }

    // MARK: - enrichExercise (engineUtils.ts:196-199)

    /// `enrichExercise` (engineUtils.ts:196-199): `{ ...exercise, ...buildExerciseMetadata(exercise) }`.
    ///
    /// Reproduces the JS object spread over the PA-S1 typed `ExerciseTemplate`: the metadata
    /// keys OVERWRITE the exercise's same-named keys; every other exercise field (typed +
    /// `_unknown` open bag) rides through. The seam params are forwarded to
    /// `buildExerciseMetadata`; both default to the empty seam (this slice's pinned branch).
    static func enrichExercise(
        _ exercise: ExerciseTemplate,
        override: OrderedJSONObject = OrderedJSONObject(),
        equivalence: JSONValue? = nil
    ) -> ExerciseTemplate {
        let metadata = buildExerciseMetadata(exercise, override: override, equivalence: equivalence)
        // `{ ...exercise, ...metadata }`: start from the exercise object, then overlay each
        // metadata entry (overwrite same-key in place — JS spread keeps the first position —
        // else append). Canonical emit sorts keys, so position is cosmetic; preserved anyway.
        guard case .object(let base) = exercise.encoded() else { return exercise }
        var entries = base.entries
        for entry in metadata.entries {
            if let idx = entries.firstIndex(where: { $0.key == entry.key }) {
                entries[idx] = entry
            } else {
                entries.append(entry)
            }
        }
        // The merged value is always an `.object`, so `init(decoding:)` (which only throws on
        // a non-object) cannot fail here.
        return (try? ExerciseTemplate(decoding: .object(OrderedJSONObject(entries: entries)))) ?? exercise
    }

    // MARK: - buildExerciseMetadata (engineUtils.ts:135-193)

    /// `buildExerciseMetadata` (engineUtils.ts:135-193) — LOGIC + DEFAULT branches over the
    /// injected `override` / `equivalence` seams (PA-S3 supplies the real tables; default empty).
    /// Returns the metadata as an `OrderedJSONObject` (the exact shape the legacy web schema `ExerciseMetadata`
    /// object literal produces), so `enrichExercise` can spread it and the OUTPUT-parity test can
    /// reconcile it field-by-field.
    static func buildExerciseMetadata(
        _ exercise: ExerciseTemplate,
        override: OrderedJSONObject = OrderedJSONObject(),
        equivalence: JSONValue? = nil
    ) -> OrderedJSONObject {
        let exId = exercise.id ?? ""        // legacy web schema `exercise.id` (required)
        let mus = exercise.muscle ?? ""     // legacy web schema `exercise.muscle` (required)

        // const bigMuscle = ['胸', '背', '腿'].includes(exercise.muscle)  (:138)
        let bigMuscle = ["胸", "背", "腿"].contains(mus)
        // const compound = exercise.kind === 'compound' || exercise.kind === 'machine'  (:139)
        let compound = exercise.kind == "compound" || exercise.kind == "machine"

        // const fatigueCost = (override.fatigueCost) || (compound ? 'medium' : 'low')  (:140)
        let fatigueCost = or(override["fatigueCost"], .string(compound ? "medium" : "low")) ?? .string(compound ? "medium" : "low")
        // (used by highFrequencyOk's `fatigueCost !== 'high'`)
        let fatigueIsHigh = fatigueCost == .string("high")

        // const parsedProgressionUnit = Number(String(override.progressionUnit || exercise.progressionUnit || '').replace(/[^0-9.]/g, ''))  (:141)
        let puResolved = or(override["progressionUnit"], or(exercise.progressionUnit.map { JSONValue.string($0) }, .string("")))
        let puStr = jsString(puResolved)
        let puDigits = String(puStr.filter { ($0.isNumber && $0.isASCII) || $0 == "." })
        let parsedProgressionUnit: Double = puDigits.isEmpty ? 0 : (Double(puDigits) ?? Double.nan) // JS `Number('') === 0`

        // const progressionUnitKg = number(override.progressionUnitKg) || number(exercise.progressionUnitKg)
        //   || (Number.isFinite(parsed) && parsed > 0 ? parsed : 0) || (exercise.startWeight >= 40 || bigMuscle ? 2.5 : 1)  (:142-146)
        let oKg = E1RMEngine.number(override["progressionUnitKg"])       // number(override.progressionUnitKg)
        let eKg = E1RMEngine.number(exercise.progressionUnitKg)          // number(exercise.progressionUnitKg)
        let pTerm = (parsedProgressionUnit.isFinite && parsedProgressionUnit > 0) ? parsedProgressionUnit : 0
        let swD = exercise.startWeight?.doubleValue ?? Double.nan        // `undefined >= 40` is false (NaN compare)
        let swFallback = (swD >= 40 || bigMuscle) ? 2.5 : 1.0
        let progressionUnitKg = jsOr(oKg, jsOr(eKg, jsOr(pTerm, swFallback)))

        // const progressionPercent = bigMuscle ? [5, 10] : [2, 5]  (:147)
        let progressionPercent: JSONValue = bigMuscle
            ? .array([.number(.integer(5)), .number(.integer(10))])
            : .array([.number(.integer(2)), .number(.integer(5))])
        // const defaultLoadRange = compound ? '约 65%-85% 1RM' : '约 50%-75% 1RM'  (:148)
        let defaultLoadRange = compound ? "约 65%-85% 1RM" : "约 50%-75% 1RM"

        // movementPattern default (shared with equivalence.label/.pattern): override.movementPattern || exercise.muscle
        let movementPattern = or(override["movementPattern"], .string(mus)) ?? .string(mus)

        // [exercise.repMin, exercise.repMax] / [Math.max(45, exercise.rest - 30), exercise.rest]
        // (a JS `undefined` array element JSON-serializes to `null`).
        let repMinJV = exercise.repMin.map { JSONValue.number($0) } ?? .null
        let repMaxJV = exercise.repMax.map { JSONValue.number($0) } ?? .null
        let restJV: JSONValue
        let restMaxJV: JSONValue
        if let rest = exercise.rest {
            restJV = .number(rest)
            restMaxJV = jsNum(max(45, rest.doubleValue - 30))
        } else {
            restJV = .null
            restMaxJV = .null
        }

        // equivalence?.id (:169) + the default-equivalence object (:171-177)
        let eqId = equivalence?.objectValue?["id"]

        var entries: [OrderedJSONObject.Entry] = []
        func put(_ key: String, _ value: JSONValue?) {
            if let value { entries.append(OrderedJSONObject.Entry(key: key, value: value)) }
        }

        // movementPattern: override.movementPattern || exercise.muscle  (:151)
        put("movementPattern", movementPattern)
        // primaryMuscles: override.primaryMuscles || [exercise.muscle]  (:152)
        put("primaryMuscles", or(override["primaryMuscles"], .array([.string(mus)])))
        // secondaryMuscles: override.secondaryMuscles || []  (:153)
        put("secondaryMuscles", or(override["secondaryMuscles"], .array([])))
        // muscleContribution: override.muscleContribution || undefined  (:154) — omitted when absent
        put("muscleContribution", or(override["muscleContribution"], nil))
        // goalBias: override.goalBias || (compound ? ['力量', '肌肥大'] : ['肌肥大'])  (:155)
        put("goalBias", or(override["goalBias"], compound ? .array([.string("力量"), .string("肌肥大")]) : .array([.string("肌肥大")])))
        // recommendedLoadRange: override.recommendedLoadRange || defaultLoadRange  (:156)
        put("recommendedLoadRange", or(override["recommendedLoadRange"], .string(defaultLoadRange)))
        // recommendedRepRange: override.recommendedRepRange || [exercise.repMin, exercise.repMax]  (:157)
        put("recommendedRepRange", or(override["recommendedRepRange"], .array([repMinJV, repMaxJV])))
        // recommendedRestSec: override.recommendedRestSec || [Math.max(45, exercise.rest - 30), exercise.rest]  (:158)
        put("recommendedRestSec", or(override["recommendedRestSec"], .array([restMaxJV, restJV])))
        // orderPriority: override.orderPriority || (compound ? 3 : 6)  (:159)
        put("orderPriority", or(override["orderPriority"], .number(.integer(compound ? 3 : 6))))
        // fatigueCost  (:160)
        put("fatigueCost", fatigueCost)
        // skillDemand: override.skillDemand || (compound ? 'medium' : 'low')  (:161)
        put("skillDemand", or(override["skillDemand"], .string(compound ? "medium" : "low")))
        // romPriority: override.romPriority || 'high'  (:162)
        put("romPriority", or(override["romPriority"], .string("high")))
        // highFrequencyOk: override.highFrequencyOk ?? fatigueCost !== 'high'  (:163) — `??` precedence below `!==`
        put("highFrequencyOk", orNullish(override["highFrequencyOk"], .bool(!fatigueIsHigh)))
        // progressionUnit: `${progressionUnitKg}kg`  (:164)
        put("progressionUnit", .string(jsNumString(progressionUnitKg) + "kg"))
        // progressionUnitKg  (:165)
        put("progressionUnitKg", jsNum(progressionUnitKg))
        // progressionPercent  (:166)
        put("progressionPercent", progressionPercent)
        // targetRir: override.targetRir || (compound ? [1, 3] : [1, 2])  (:167)
        put("targetRir", or(override["targetRir"], compound ? .array([.number(.integer(1)), .number(.integer(3))]) : .array([.number(.integer(1)), .number(.integer(2))])))
        // evidenceTags: PRESCRIPTION_SOURCES  (:168)
        put("evidenceTags", .array(prescriptionSources.map { .string($0) }))
        // equivalenceChainId: override.equivalenceChainId || equivalence?.id || exercise.id  (:169)
        put("equivalenceChainId", or(override["equivalenceChainId"], or(jsTruthy(eqId) ? eqId : nil, .string(exId))))
        // canonicalExerciseId: override.canonicalExerciseId || exercise.id  (:170)
        put("canonicalExerciseId", or(override["canonicalExerciseId"], .string(exId)))
        // equivalence: equivalence || { label, primaryMuscle, pattern, members: [exercise.id] }  (:171-177)
        if let equivalence, jsTruthy(equivalence) {
            put("equivalence", equivalence)
        } else {
            put("equivalence", .object(OrderedJSONObject(entries: [
                OrderedJSONObject.Entry(key: "label", value: movementPattern),
                OrderedJSONObject.Entry(key: "primaryMuscle", value: .string(mus)),
                OrderedJSONObject.Entry(key: "pattern", value: movementPattern),
                OrderedJSONObject.Entry(key: "members", value: .array([.string(exId)])),
            ])))
        }
        // alternativeIds: override.alternativeIds || exercise.alternativeIds || []  (:178)
        let altIdsExercise = exercise.alternativeIds.map { JSONValue.array($0.map { .string($0) }) }
        put("alternativeIds", or(override["alternativeIds"], jsTruthy(altIdsExercise) ? altIdsExercise! : .array([])))
        // alternativePriorities: override.alternativePriorities || exercise.alternativePriorities || {}  (:179-182)
        let altPrio = exercise.alternativePriorities
        put("alternativePriorities", or(override["alternativePriorities"], jsTruthy(altPrio) ? altPrio! : .object(OrderedJSONObject())))
        // regressionIds: override.regressionIds || []  (:183)
        put("regressionIds", or(override["regressionIds"], .array([])))
        // progressionIds: override.progressionIds || []  (:184)
        put("progressionIds", or(override["progressionIds"], .array([])))
        // contraindications: override.contraindications || []  (:185)
        put("contraindications", or(override["contraindications"], .array([])))
        // techniqueStandard: { ...DEFAULT_TECHNIQUE_STANDARD, rom, stopRule, ...(exercise.techniqueStandard || {}) }  (:186-191)
        put("techniqueStandard", buildTechniqueStandard(compound: compound, override: override, exercise: exercise))

        return OrderedJSONObject(entries: entries)
    }

    /// `techniqueStandard` object (engineUtils.ts:186-191):
    /// `{ ...DEFAULT_TECHNIQUE_STANDARD, rom, stopRule, ...(exercise.techniqueStandard || {}) }`.
    private static func buildTechniqueStandard(compound: Bool, override: OrderedJSONObject, exercise: ExerciseTemplate) -> JSONValue {
        // ...DEFAULT_TECHNIQUE_STANDARD (appConfig.ts:66 — rom / tempo / stopRule)
        var ts: [OrderedJSONObject.Entry] = [
            OrderedJSONObject.Entry(key: "rom", value: .string(defaultTechniqueStandard.rom)),
            OrderedJSONObject.Entry(key: "tempo", value: .string(defaultTechniqueStandard.tempo)),
            OrderedJSONObject.Entry(key: "stopRule", value: .string(defaultTechniqueStandard.stopRule)),
        ]
        func set(_ key: String, _ value: JSONValue) {
            if let idx = ts.firstIndex(where: { $0.key == key }) { ts[idx] = OrderedJSONObject.Entry(key: key, value: value) }
            else { ts.append(OrderedJSONObject.Entry(key: key, value: value)) }
        }
        // rom: compound || (override.romPriority === 'high') ? '完整可控幅度' : '受控完整幅度'  (:188)
        let romHigh = compound || (override["romPriority"]?.stringValue == "high")
        set("rom", .string(romHigh ? "完整可控幅度" : "受控完整幅度"))
        // stopRule: compound ? '动作明显变形…' : '目标肌群失控…'  (:189)
        set("stopRule", .string(compound ? "动作明显变形、速度明显下降或出现不适时停止该组" : "目标肌群失控或出现不适时停止该组"))
        // ...(exercise.techniqueStandard || {})  (:190)
        if case .object(let userTS)? = exercise.techniqueStandard {
            for e in userTS.entries { set(e.key, e.value) }
        }
        return .object(OrderedJSONObject(entries: ts))
    }

    // MARK: - Ported small constants (the only DATA this slice ports; the big override
    // tables are PA-S3)

    /// `DEFAULT_TECHNIQUE_STANDARD` (appConfig.ts:66).
    private static let defaultTechniqueStandard: (rom: String, tempo: String, stopRule: String) = (
        rom: "完整可控幅度",
        tempo: "2-0-1",
        stopRule: "动作明显变形、速度明显下降或出现不适时停止该组"
    )

    /// `PRESCRIPTION_SOURCES` (appConfig.ts:72).
    private static let prescriptionSources: [String] = [
        "渐进超负荷：连续稳定达标后再小幅加重。",
        "训练频率：大肌群每周至少安排 2 次有效刺激更利于长期执行。",
        "肌肥大主线：用每周有效组数、RIR 和动作质量共同决定是否推进。",
    ]

    // MARK: - JS-semantics helpers (faithful `||` / `??` / `Number()` / `String()` / `${}`)

    /// JS truthiness: `undefined`/`null`/`false`/`0`/`NaN`/`''` are falsy; everything else
    /// (incl. empty array/object) is truthy. Drives the `||` falsy-fallback chains above.
    private static func jsTruthy(_ v: JSONValue?) -> Bool {
        guard let v else { return false }
        switch v {
        case .null: return false
        case .bool(let b): return b
        case .number(let n): let d = n.doubleValue; return d != 0 && !d.isNaN
        case .string(let s): return !s.isEmpty
        case .array, .object: return true
        }
    }

    /// `a || b` (JS): the override value when truthy, else the default (which may be `nil`
    /// to model `... || undefined`).
    private static func or(_ overrideVal: JSONValue?, _ def: JSONValue?) -> JSONValue? {
        if let overrideVal, jsTruthy(overrideVal) { return overrideVal }
        return def
    }

    /// `a ?? b` (JS): the override value unless it is absent/null; `false` is kept.
    private static func orNullish(_ overrideVal: JSONValue?, _ def: JSONValue) -> JSONValue {
        if let overrideVal, !overrideVal.isNull { return overrideVal }
        return def
    }

    /// JS numeric `a || b` over already-finite-or-0 magnitudes (mirrors the `number()`-fed
    /// `||` chain): `a` when non-zero, else `b`.
    private static func jsOr(_ a: Double, _ b: @autoclosure () -> Double) -> Double {
        (a != 0 && !a.isNaN) ? a : b()
    }

    /// `String(value)` for the realistic progression-unit shapes (string / number / bool);
    /// objects/arrays don't occur for `progressionUnit`, coerced loosely to "".
    private static func jsString(_ v: JSONValue?) -> String {
        guard let v else { return "" }
        switch v {
        case .null: return ""
        case .bool(let b): return b ? "true" : "false"
        case .number(let n): return jsNumString(n.doubleValue)
        case .string(let s): return s
        case .array, .object: return ""
        }
    }

    /// A finite double → JSON number with JS's integer collapse (`2.0` → `2`), so canonical
    /// emit matches `JSON.stringify`.
    private static func jsNum(_ d: Double) -> JSONValue {
        if d.isFinite, d.truncatingRemainder(dividingBy: 1) == 0, abs(d) < 9_007_199_254_740_992 {
            return .number(.integer(Int64(d)))
        }
        return .number(.double(d))
    }

    /// JS `${number}` / `Number.prototype.toString`: integer-valued doubles render without a
    /// fractional part (`1` not `1.0`); other finite values use the shortest round-trip form.
    private static func jsNumString(_ d: Double) -> String {
        if d.isFinite, d.truncatingRemainder(dividingBy: 1) == 0, abs(d) < 9_007_199_254_740_992 {
            return String(Int64(d))
        }
        return String(d)
    }
}
