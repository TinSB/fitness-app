// VolumeAdaptationEngine — AN-5b per-muscle volume-adaptation port.
//
// Faithful line-by-line Swift port of the PURE per-muscle volume-adaptation function from
// `retired web reference`:
//   - buildVolumeAdaptationReport   (volumeAdaptationEngine.ts:268)
// + every private helper it reads (clamp / roundOne / normalizeText / decisionLabel /
//   normalizeWeeklyRows / isLoadFeedbackSummary / normalizeLoadFeedback / hasPainRisk /
//   qualitySummary / evidenceRatio / volumeIsLow / volumeIsNearTarget / volumeIsHigh /
//   increaseDelta / decreaseDelta / confidenceFor / buildDecision) and the output / input
//   types (VolumeAdaptationDecision / MuscleVolumeAdaptation / VolumeAdaptationReport /
//   BuildVolumeAdaptationReportParams + the internal NormalizedMuscleVolume).
// Plus `formatMuscleName` (i18n/formatters.ts:219) + its lookupLabel string-path /
//   normalizeDisplayKey / MUSCLE_LABELS — see the formatMuscleName MARK for why it is ported
//   here (no equivalent exists in the package; AnalyticsDashboardEngine sets `muscleName = muscleId`
//   verbatim and never localizes).
//
// Dependency boundary (AN-5b §, matches the slice contract):
//   * REUSES (does NOT re-port) the already-ported `E1RMEngine.number` (engineUtils `number`),
//     `AnalyticsDashboardEngine.roundOne` (analytics.ts `roundOne`, identical to this engine's
//     `Math.round(value*10)/10`) + `AnalyticsDashboardEngine.jsNumberString` (the JS `${number}`
//     stringifier the TrainingLevelEngine port already reuses), the canonical
//     `PainPatternEngine.PainPattern` + `PainPatternEngine.PainSuggestedAction`, the
//     `SessionQualityEngine.SessionQualityResult` (+ its signals), and `ExerciseLibrary.hasChineseText`.
//   * The optional external inputs `weeklyVolumeSummary` (`WeeklyVolumeItem[] | { muscles }`),
//     `effectiveSetSummary` (`Partial<EffectiveVolumeSummary>`, read as `byMuscle?.[muscleId]`),
//     `adherenceReport` (`Partial<AdherenceReport>`) and `loadFeedback` (`LoadFeedbackInput`) are
//     genuine legacy web schema runtime unions consumed by DUCK-TYPING; kept as raw `JSONValue?` and discriminated
//     structurally — never forcing a static type the legacy web schema does not assert.
//   * `trainingLevel` (`AutoTrainingLevel | string | null`) is only ever `!trainingLevel` /
//     `=== 'unknown'` compared → kept as a raw `String?`.
//   * `formatMuscleName`'s `normalizeDisplayKey` + `regexReplaceAll` are ported PRIVATE here, the
//     same per-engine convention as ReplacementEngine / SmartReplacementEngine (each ships its own
//     private copy); only the SHARED `ExerciseLibrary.hasChineseText` is reused.
//
// PURE: every input is an already-§11-clean summary / typed result; no IO, no clock
// (`zero : Date`), no randomness. NOT wired into any UI (AN-6 owns that); this slice only adds
// the function and parity-pins it function-by-function.

import Foundation
import RedeDomain

public enum VolumeAdaptationEngine {

    // MARK: - Output types (volumeAdaptationEngine.ts:16-36)

    /// `VolumeAdaptationDecision` (volumeAdaptationEngine.ts:16). RawValue strings mirror the
    /// legacy web schema string-literal union so the golden's `decision` decodes/compares verbatim.
    public enum VolumeAdaptationDecision: String, Equatable, Sendable {
        case increase = "increase"
        case maintain = "maintain"
        case decrease = "decrease"
        case hold = "hold"
        case insufficientData = "insufficient_data"
    }

    /// `MuscleVolumeAdaptation` (volumeAdaptationEngine.ts:23). `setsDelta` is OPTIONAL — the
    /// `insufficient_data` branch omits it (canonicalStringify then drops the key). `confidence`
    /// kept as a raw String ('low' | 'medium' | 'high').
    public struct MuscleVolumeAdaptation: Equatable, Sendable {
        public let muscleId: String
        public let decision: VolumeAdaptationDecision
        public let setsDelta: Int?
        public let title: String
        public let reason: String
        public let confidence: String
        public let suggestedActions: [String]
        public init(
            muscleId: String,
            decision: VolumeAdaptationDecision,
            setsDelta: Int?,
            title: String,
            reason: String,
            confidence: String,
            suggestedActions: [String]
        ) {
            self.muscleId = muscleId
            self.decision = decision
            self.setsDelta = setsDelta
            self.title = title
            self.reason = reason
            self.confidence = confidence
            self.suggestedActions = suggestedActions
        }
    }

    /// `VolumeAdaptationReport` (volumeAdaptationEngine.ts:33).
    public struct VolumeAdaptationReport: Equatable, Sendable {
        public let muscles: [MuscleVolumeAdaptation]
        public let summary: String
        public init(muscles: [MuscleVolumeAdaptation], summary: String) {
            self.muscles = muscles
            self.summary = summary
        }
    }

    // MARK: - Input params (volumeAdaptationEngine.ts:55 BuildVolumeAdaptationReportParams)

    /// `BuildVolumeAdaptationReportParams` (volumeAdaptationEngine.ts:55). `weeklyVolumeSummary`
    /// / `effectiveSetSummary` / `adherenceReport` / `loadFeedback` stay raw `JSONValue?` — see
    /// the file header for why the duck-typed unions / Partials are not closed into static types.
    public struct Params {
        public let weeklyVolumeSummary: JSONValue?
        public let effectiveSetSummary: JSONValue?
        public let adherenceReport: JSONValue?
        public let painPatterns: [PainPatternEngine.PainPattern]?
        public let loadFeedback: JSONValue?
        public let sessionQualityResults: [SessionQualityEngine.SessionQualityResult]?
        public let trainingLevel: String?
        public init(
            weeklyVolumeSummary: JSONValue? = nil,
            effectiveSetSummary: JSONValue? = nil,
            adherenceReport: JSONValue? = nil,
            painPatterns: [PainPatternEngine.PainPattern]? = nil,
            loadFeedback: JSONValue? = nil,
            sessionQualityResults: [SessionQualityEngine.SessionQualityResult]? = nil,
            trainingLevel: String? = nil
        ) {
            self.weeklyVolumeSummary = weeklyVolumeSummary
            self.effectiveSetSummary = effectiveSetSummary
            self.adherenceReport = adherenceReport
            self.painPatterns = painPatterns
            self.loadFeedback = loadFeedback
            self.sessionQualityResults = sessionQualityResults
            self.trainingLevel = trainingLevel
        }
    }

    /// `NormalizedMuscleVolume` (volumeAdaptationEngine.ts:65) — internal projection.
    private struct NormalizedMuscleVolume {
        let muscleId: String
        let muscleName: String
        let targetSets: Double
        let completedSets: Double
        let effectiveSets: Double
        let highConfidenceEffectiveSets: Double
        let weightedEffectiveSets: Double
        let remainingSets: Double
        let status: String?
    }

    /// `normalizeLoadFeedback`'s `{ total, tooHeavy, good, tooHeavyRate }` result
    /// (volumeAdaptationEngine.ts:160).
    private struct NormalizedLoadFeedback {
        let total: Int
        let tooHeavy: Int
        let good: Int
        let tooHeavyRate: Double
    }

    /// `qualitySummary`'s `{ total, hasLowQuality, stableEnough, poorTechnique }` result
    /// (volumeAdaptationEngine.ts:186).
    private struct QualitySummary {
        let total: Int
        let hasLowQuality: Bool
        let stableEnough: Bool
        let poorTechnique: Bool
    }

    // MARK: - Tiny helpers (volumeAdaptationEngine.ts:77-88)

    /// `clamp` (volumeAdaptationEngine.ts:77).
    private static func clamp(_ value: Double, _ min: Double, _ max: Double) -> Double {
        Swift.max(min, Swift.min(max, value))
    }

    /// `normalizeText` (volumeAdaptationEngine.ts:80): `String(value || '').trim().toLowerCase()`.
    private static func normalizeText(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// JS truthiness for an optional string (`a || b` skips `undefined` AND `''`).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// JS truthiness for a free-form JSON value (`Boolean(x)` / `x ? … : …`): false for
    /// undefined/null/false/0/'' — true otherwise (an object/array is always truthy).
    private static func jsTruthy(_ value: JSONValue?) -> Bool {
        guard let value else { return false }
        switch value {
        case .null: return false
        case .bool(let b): return b
        case .number(let n): return n.doubleValue != 0
        case .string(let s): return !s.isEmpty
        default: return true
        }
    }

    /// JS `a ?? b ?? …` (nullish-coalesce) over JSON values: pick the first that is neither
    /// absent nor JSON `null` (mirrors `??`, which — unlike `||` — does NOT skip `0`/`''`).
    private static func coalesce(_ values: JSONValue?...) -> JSONValue? {
        for value in values {
            guard let value else { continue }
            if case .null = value { continue }
            return value
        }
        return nil
    }

    /// `number(a ?? b ?? computed)` where the final fallback is an already-computed Double:
    /// the coalesced JSON value if present (`number(it)`), else the Double fallback.
    private static func numberOr(_ value: JSONValue?, _ fallback: Double) -> Double {
        value != nil ? E1RMEngine.number(value) : fallback
    }

    /// JS `String.prototype.includes`: `''` is a substring of every string (Swift's
    /// `contains("")` returns false, so the empty-needle case is special-cased).
    private static func jsIncludes(_ haystack: String, _ needle: String) -> Bool {
        needle.isEmpty || haystack.contains(needle)
    }

    /// `decisionLabel` (volumeAdaptationEngine.ts:82).
    private static func decisionLabel(_ decision: VolumeAdaptationDecision) -> String {
        switch decision {
        case .increase: return "增加"
        case .decrease: return "减少"
        case .hold: return "暂缓"
        case .insufficientData: return "数据不足"
        case .maintain: return "维持"
        }
    }

    // MARK: - Weekly row normalization (volumeAdaptationEngine.ts:90)

    /// `normalizeWeeklyRows` (volumeAdaptationEngine.ts:90). `weeklyVolumeSummary` is either an
    /// array OR `{ muscles: [...] }`; each row reads its volume off `effectiveSetSummary.byMuscle[muscleId]`
    /// first, then the row's own fields. `muscleId = String(row.muscleId || row.muscle || '').trim()`;
    /// a falsy id drops the row.
    private static func normalizeWeeklyRows(_ weeklyVolumeSummary: JSONValue?, _ effectiveSetSummary: JSONValue?) -> [NormalizedMuscleVolume] {
        let rows: [JSONValue]
        if case .array(let array)? = weeklyVolumeSummary {
            rows = array
        } else {
            rows = weeklyVolumeSummary?.objectValue?["muscles"]?.arrayValue ?? []
        }
        return rows.compactMap { rowValue -> NormalizedMuscleVolume? in
            let row = rowValue.objectValue
            let muscleId = (truthy(row?["muscleId"]?.stringValue) ?? truthy(row?["muscle"]?.stringValue) ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if muscleId.isEmpty { return nil }
            let byMuscle = effectiveSetSummary?.objectValue?["byMuscle"]?.objectValue?[muscleId]?.objectValue
            let targetSets = E1RMEngine.number(coalesce(row?["targetSets"], row?["target"], row?["baseTarget"]))
            let completedSets = E1RMEngine.number(coalesce(byMuscle?["completedSets"], row?["completedSets"], row?["sets"]))
            let effectiveSets = E1RMEngine.number(coalesce(byMuscle?["effectiveSets"], row?["effectiveSets"], row?["sets"]))
            let highConfidenceEffectiveSets = E1RMEngine.number(coalesce(byMuscle?["highConfidenceEffectiveSets"], row?["highConfidenceEffectiveSets"]))
            let weightedEffectiveSets = numberOr(coalesce(byMuscle?["weightedEffectiveSets"], row?["weightedEffectiveSets"]), effectiveSets)
            let remainingSets = numberOr(coalesce(row?["remainingSets"], row?["remaining"]), Swift.max(0, targetSets - weightedEffectiveSets))
            return NormalizedMuscleVolume(
                muscleId: muscleId,
                muscleName: truthy(row?["muscleName"]?.stringValue) ?? formatMuscleName(muscleId),
                targetSets: targetSets,
                completedSets: completedSets,
                effectiveSets: effectiveSets,
                highConfidenceEffectiveSets: highConfidenceEffectiveSets,
                weightedEffectiveSets: weightedEffectiveSets,
                remainingSets: remainingSets,
                status: truthy(row?["status"]?.stringValue)
            )
        }
    }

    // MARK: - Load feedback normalization (volumeAdaptationEngine.ts:123-166)

    /// `isLoadFeedbackSummary` (volumeAdaptationEngine.ts:123): object with `counts` AND `adjustment`.
    private static func isLoadFeedbackSummary(_ value: JSONValue?) -> Bool {
        guard let object = value?.objectValue else { return false }
        return object["counts"] != nil && object["adjustment"] != nil
    }

    /// `normalizeLoadFeedback` (volumeAdaptationEngine.ts:126) — NO session history (unlike the
    /// recommendationConfidence variant). Returns `{ total, tooHeavy, good, tooHeavyRate }`.
    private static func normalizeLoadFeedback(_ input: JSONValue?) -> NormalizedLoadFeedback {
        var values: [String] = []

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

        func addSummary(_ summary: JSONValue?) {
            guard let summary, let object = summary.objectValue else { return }
            let counts = object["counts"]?.objectValue
            addValue(LoadFeedbackEngine.tooHeavy, E1RMEngine.number(counts?["too_heavy"]))
            addValue(LoadFeedbackEngine.tooLight, E1RMEngine.number(counts?["too_light"]))
            addValue(LoadFeedbackEngine.good, E1RMEngine.number(counts?["good"]))
            addValue(object["dominantFeedback"]?.stringValue)
            addValue(object["adjustment"]?.objectValue?["dominantFeedback"]?.stringValue)
        }

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
        let good = values.filter { $0 == LoadFeedbackEngine.good }.count
        return NormalizedLoadFeedback(
            total: total,
            tooHeavy: tooHeavy,
            good: good,
            tooHeavyRate: total != 0 ? Double(tooHeavy) / Double(total) : 0
        )
    }

    // MARK: - Pain / quality risk (volumeAdaptationEngine.ts:168-192)

    /// `hasPainRisk` (volumeAdaptationEngine.ts:168). `number(pattern.frequency)` /
    /// `number(pattern.severityAvg)` over the already-decoded finite numerics → the values
    /// themselves. `muscleName.includes(area)` / `area.includes(muscleName)` use JS-`includes`
    /// semantics (empty needle matches).
    private static func hasPainRisk(_ row: NormalizedMuscleVolume, _ painPatterns: [PainPatternEngine.PainPattern]) -> Bool {
        let muscleId = normalizeText(row.muscleId)
        let muscleName = normalizeText(row.muscleName)
        return painPatterns.contains { pattern in
            let area = normalizeText(pattern.area)
            let actionRisk = pattern.suggestedAction == .substitute || pattern.suggestedAction == .deload
            let severityRisk = Double(pattern.frequency) >= 2 || pattern.severityAvg >= 3.5
            let areaMatch = area == muscleId || area == muscleName || jsIncludes(muscleName, area) || jsIncludes(area, muscleName)
            return areaMatch && (actionRisk || severityRisk)
        }
    }

    /// `qualitySummary` (volumeAdaptationEngine.ts:179). `poorTechnique`: any signal across
    /// issues+positives whose `label+reason` contains '动作质量' AND `tone !== 'positive'`.
    private static func qualitySummary(_ results: [SessionQualityEngine.SessionQualityResult]) -> QualitySummary {
        let total = results.count
        let low = results.filter { $0.level == "low" }.count
        let highOrMedium = results.filter { $0.level == "high" || $0.level == "medium" }.count
        let poorTechnique = results.contains { item in
            (item.issues + item.positives).contains { signal in
                "\(signal.label)\(signal.reason)".contains("动作质量") && signal.tone != "positive"
            }
        }
        return QualitySummary(
            total: total,
            hasLowQuality: total > 0 && Double(low) / Double(total) >= 0.34,
            stableEnough: total == 0 || Double(highOrMedium) / Double(total) >= 0.67,
            poorTechnique: poorTechnique
        )
    }

    // MARK: - Evidence ratio + volume bands (volumeAdaptationEngine.ts:194-205)

    /// `evidenceRatio` (volumeAdaptationEngine.ts:194).
    private static func evidenceRatio(_ row: NormalizedMuscleVolume) -> Double {
        if row.targetSets <= 0 { return row.weightedEffectiveSets > 0 ? 2 : 0 }
        return row.weightedEffectiveSets / row.targetSets
    }

    /// `volumeIsLow` (volumeAdaptationEngine.ts:199).
    private static func volumeIsLow(_ row: NormalizedMuscleVolume) -> Bool {
        row.status == "low" || evidenceRatio(row) < 0.75
    }

    /// `volumeIsNearTarget` (volumeAdaptationEngine.ts:200).
    private static func volumeIsNearTarget(_ row: NormalizedMuscleVolume) -> Bool {
        row.status == "near_target" || row.status == "on_target"
            || (evidenceRatio(row) >= 0.75 && evidenceRatio(row) <= 1.15)
    }

    /// `volumeIsHigh` (volumeAdaptationEngine.ts:202).
    private static func volumeIsHigh(_ row: NormalizedMuscleVolume) -> Bool {
        row.status == "high" || evidenceRatio(row) > 1.15
    }

    /// `increaseDelta` (volumeAdaptationEngine.ts:204): `clamp(ceil(max(1, remainingSets) / 3), 1, 2)`.
    private static func increaseDelta(_ row: NormalizedMuscleVolume) -> Int {
        Int(clamp((Swift.max(1.0, row.remainingSets) / 3).rounded(.up), 1, 2))
    }

    /// `decreaseDelta` (volumeAdaptationEngine.ts:205): `-clamp(strongRisk || ratio > 1.3 ? 2 : 1, 1, 2)`.
    private static func decreaseDelta(_ row: NormalizedMuscleVolume, _ strongRisk: Bool) -> Int {
        Int(-clamp((strongRisk || evidenceRatio(row) > 1.3) ? 2 : 1, 1, 2))
    }

    // MARK: - Confidence (volumeAdaptationEngine.ts:207)

    /// `confidenceFor` (volumeAdaptationEngine.ts:207). `number(adherenceReport?.recentSessionCount)`
    /// reads the field off the raw `adherenceReport` JSON (undefined → 0).
    private static func confidenceFor(_ decision: VolumeAdaptationDecision, _ row: NormalizedMuscleVolume, _ adherenceReport: JSONValue?) -> String {
        if decision == .insufficientData { return "low" }
        if decision == .hold { return "low" }
        if E1RMEngine.number(adherenceReport?.objectValue?["recentSessionCount"]) >= 4 && row.completedSets >= 4 { return "high" }
        return "medium"
    }

    // MARK: - Decision builder (volumeAdaptationEngine.ts:218)

    /// `buildDecision` (volumeAdaptationEngine.ts:218). `volumeText` + `suggestedActionsByDecision`
    /// embed `roundOne` / `setsDelta` exactly; only the returned decision's action list is built.
    private static func buildDecision(
        row: NormalizedMuscleVolume,
        decision: VolumeAdaptationDecision,
        setsDelta: Int?,
        reason: String,
        confidence: String
    ) -> MuscleVolumeAdaptation {
        let label = decisionLabel(decision)
        let volumeText = row.targetSets > 0
            ? "当前约 \(AnalyticsDashboardEngine.jsNumberString(AnalyticsDashboardEngine.roundOne(row.weightedEffectiveSets)))/\(AnalyticsDashboardEngine.jsNumberString(AnalyticsDashboardEngine.roundOne(row.targetSets))) 组。"
            : "当前约 \(AnalyticsDashboardEngine.jsNumberString(AnalyticsDashboardEngine.roundOne(row.weightedEffectiveSets))) 组。"
        // `${setsDelta}` (increase) / `Math.abs(setsDelta || 1)` (decrease). For increase the
        // delta is always set; the `|| 1` guard means a falsy (0/undefined) decrease delta → 1.
        let increaseDeltaText = setsDelta.map { String($0) } ?? "undefined"
        let decreaseMagnitude = abs((setsDelta ?? 0) != 0 ? setsDelta! : 1)
        let suggestedActions: [String]
        switch decision {
        case .increase:
            suggestedActions = [
                "下周只给\(row.muscleName)增加 \(increaseDeltaText) 组，先观察完成度和不适反馈。",
                "优先把新增组放在动作质量稳定的训练日。",
            ]
        case .maintain:
            suggestedActions = [
                "下周维持\(row.muscleName)当前训练量。",
                "继续记录余力（RIR）和动作质量，用于下次复核。",
            ]
        case .decrease:
            suggestedActions = [
                "下周先给\(row.muscleName)减少 \(decreaseMagnitude) 组。",
                "优先保留关键主训练，减少额外辅助量。",
            ]
        case .hold:
            suggestedActions = [
                "暂缓调整\(row.muscleName)训练量，继续收集记录。",
                "本周不要自动改计划，等数据更稳定后再进入计划调整预览。",
            ]
        case .insufficientData:
            suggestedActions = [
                "继续记录\(row.muscleName)的完成组、有效组、余力（RIR）和动作质量。",
            ]
        }
        return MuscleVolumeAdaptation(
            muscleId: row.muscleId,
            decision: decision,
            setsDelta: setsDelta,
            title: "\(row.muscleName)：\(label)训练量",
            reason: "\(reason)\(volumeText)",
            confidence: confidence,
            suggestedActions: suggestedActions
        )
    }

    // MARK: - buildVolumeAdaptationReport (volumeAdaptationEngine.ts:268)

    public static func buildVolumeAdaptationReport(_ params: Params) -> VolumeAdaptationReport {
        let rows = normalizeWeeklyRows(params.weeklyVolumeSummary, params.effectiveSetSummary)
        let feedback = normalizeLoadFeedback(params.loadFeedback)
        let quality = qualitySummary(params.sessionQualityResults ?? [])
        // `!trainingLevel || trainingLevel === 'unknown'` (ts:280). `!trainingLevel` is true for
        // an absent / empty trainingLevel.
        let trainingLevelUnknown = truthy(params.trainingLevel) == nil || params.trainingLevel == "unknown"
        let recentSessionCount = E1RMEngine.number(params.adherenceReport?.objectValue?["recentSessionCount"])
        let overallRate = E1RMEngine.number(params.adherenceReport?.objectValue?["overallRate"])
        let mainlineRate = E1RMEngine.number(coalesce(params.adherenceReport?.objectValue?["mainlineRate"], params.adherenceReport?.objectValue?["overallRate"]))
        // `Boolean(adherenceReport)` — an object (even empty) is truthy; null/undefined falsy.
        let adherencePresent = jsTruthy(params.adherenceReport)
        let adherenceGood = !adherencePresent || (overallRate >= 80 && mainlineRate >= 80)
        let adherencePoor = adherencePresent && ((overallRate > 0 && overallRate < 65) || (mainlineRate > 0 && mainlineRate < 65))
        let dataSparse = adherencePresent && recentSessionCount > 0 && recentSessionCount < 2

        if rows.isEmpty {
            return VolumeAdaptationReport(
                muscles: [],
                summary: "训练量数据不足，暂时无法判断下周每个肌群应该增加、维持或减少。"
            )
        }

        let muscles = rows.map { row -> MuscleVolumeAdaptation in
            let noVolumeEvidence = row.targetSets <= 0 && row.completedSets <= 0 && row.effectiveSets <= 0 && row.weightedEffectiveSets <= 0
            let painRisk = hasPainRisk(row, params.painPatterns ?? [])
            let heavyFeedbackRisk = feedback.tooHeavy >= 2 && feedback.tooHeavyRate >= 0.4
            let qualityRisk = quality.hasLowQuality || quality.poorTechnique
            let strongRisk = painRisk || adherencePoor || heavyFeedbackRisk || qualityRisk

            if noVolumeEvidence || dataSparse {
                return buildDecision(
                    row: row,
                    decision: .insufficientData,
                    setsDelta: nil,
                    reason: "可用训练量和完成度记录还不够，暂时不建议调整。",
                    confidence: "low"
                )
            }

            if trainingLevelUnknown {
                return buildDecision(
                    row: row,
                    decision: .hold,
                    setsDelta: 0,
                    reason: "系统仍在建立训练基线，暂时不建议直接增减训练量。",
                    confidence: "low"
                )
            }

            if strongRisk || volumeIsHigh(row) {
                // `[...].filter(Boolean)` (ts:322) — drop the empty-string slots.
                let reasonParts = [
                    volumeIsHigh(row) ? "训练量已经偏高" : "",
                    painRisk ? "近期有相关不适记录" : "",
                    adherencePoor ? "近期完成率下降" : "",
                    heavyFeedbackRisk ? "重量反馈多次偏重" : "",
                    qualityRisk ? "训练质量或动作质量不够稳定" : "",
                ].filter { !$0.isEmpty }
                return buildDecision(
                    row: row,
                    decision: .decrease,
                    setsDelta: decreaseDelta(row, strongRisk),
                    reason: "\(reasonParts.joined(separator: "，"))，下周先保守处理。",
                    confidence: confidenceFor(.decrease, row, params.adherenceReport)
                )
            }

            if volumeIsLow(row) && adherenceGood && quality.stableEnough {
                return buildDecision(
                    row: row,
                    decision: .increase,
                    setsDelta: increaseDelta(row),
                    reason: "该肌群低于目标，但近期完成度和训练质量可以支持小幅加量。",
                    confidence: confidenceFor(.increase, row, params.adherenceReport)
                )
            }

            if volumeIsNearTarget(row) {
                return buildDecision(
                    row: row,
                    decision: .maintain,
                    setsDelta: 0,
                    reason: "该肌群有效组接近目标，当前更适合维持训练量。",
                    confidence: confidenceFor(.maintain, row, params.adherenceReport)
                )
            }

            return buildDecision(
                row: row,
                decision: .hold,
                setsDelta: 0,
                reason: "当前信号不够一致，暂时不建议主动增减训练量。",
                confidence: confidenceFor(.hold, row, params.adherenceReport)
            )
        }

        // `count(decision)` + summaryParts (volumeAdaptationEngine.ts:368).
        func count(_ decision: VolumeAdaptationDecision) -> Int {
            muscles.filter { $0.decision == decision }.count
        }
        let summaryParts = [
            count(.increase) != 0 ? "增加 \(count(.increase)) 个肌群" : "",
            count(.maintain) != 0 ? "维持 \(count(.maintain)) 个肌群" : "",
            count(.decrease) != 0 ? "减少 \(count(.decrease)) 个肌群" : "",
            count(.hold) != 0 ? "暂缓 \(count(.hold)) 个肌群" : "",
            count(.insufficientData) != 0 ? "数据不足 \(count(.insufficientData)) 个肌群" : "",
        ].filter { !$0.isEmpty }

        return VolumeAdaptationReport(
            muscles: muscles,
            summary: summaryParts.isEmpty
                ? "训练量数据不足，暂时无法判断下周每个肌群应该增加、维持或减少。"
                : "下周训练量建议：\(summaryParts.joined(separator: "，"))。所有调整都只作为建议，需要用户确认后才进入计划调整预览。"
        )
    }

    // MARK: - formatMuscleName (retired-web-reference)

    /// `MUSCLE_LABELS` (formatters.ts:102-122) — verbatim.
    private static let muscleLabels: [String: String] = [
        "chest": "胸",
        "back": "背",
        "lats": "背阔肌",
        "legs": "腿",
        "quads": "股四头肌",
        "hamstrings": "腘绳肌",
        "glutes": "臀",
        "shoulders": "肩",
        "delts": "三角肌",
        "arms": "手臂",
        "triceps": "肱三头肌",
        "biceps": "肱二头肌",
        "calves": "小腿",
        "core": "核心",
        "胸": "胸",
        "背": "背",
        "腿": "腿",
        "肩": "肩",
        "手臂": "手臂",
    ]

    /// `formatMuscleName` (formatters.ts:219) = `lookupLabel('formatMuscleName', value, MUSCLE_LABELS,
    /// '未标注肌群')`, STRING path only (the engine only ever passes the already-`String(...)`'d
    /// muscleId): empty → '未标注肌群'; normalized hit → label; else CJK → value; else '未标注肌群'.
    /// The dev-only `warnMissingFormatter` console.warn (formatters.ts:15-19/58) is a no-op side
    /// effect and intentionally not ported.
    static func formatMuscleName(_ value: String) -> String {
        if value.isEmpty { return "未标注肌群" }
        let normalized = normalizeDisplayKey(value)
        if let label = muscleLabels[normalized] { return label }
        if ExerciseLibrary.hasChineseText(value) { return value }
        return "未标注肌群"
    }

    /// `normalizeDisplayKey` (formatters.ts:27-33) — same transform as the ReplacementEngine
    /// private copy (per-engine convention).
    private static func normalizeDisplayKey(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines)
        s = regexReplaceAll(s, "[（(].*?[)）]", "")
        s = regexReplaceAll(s, "([a-z])([A-Z])", "$1-$2")
        s = regexReplaceAll(s, "[_\\s]+", "-")
        return s.lowercased()
    }

    /// Apply a regex global replace (NSRegularExpression), mirroring `String.prototype.replace`
    /// with a `/g` pattern.
    private static func regexReplaceAll(_ input: String, _ pattern: String, _ replacement: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return input }
        let range = NSRange(input.startIndex..., in: input)
        return regex.stringByReplacingMatches(in: input, range: range, withTemplate: replacement)
    }
}
