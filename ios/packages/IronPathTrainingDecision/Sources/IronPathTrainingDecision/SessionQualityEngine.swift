// SessionQualityEngine — AN-4 sessionQualityEngine port + function-level parity.
//
// Faithful line-by-line Swift port of `buildSessionQualityResult`
// (`src/engines/sessionQualityEngine.ts:122`) + every private helper it reads
// (`clamp` / `roundScore` / `isRecordedCompletedSet` / `hasRecordedRir` /
// `levelLabel` / `dataFlagLabel` / `isLoadFeedbackSummary` / `normalizeLoadFeedback` /
// `makeSignal` / `unique`, ts:52-120) + the output/input types
// (`SessionQualityLevel` / `SessionQualitySignal` / `SessionQualityResult` /
// `LoadFeedbackInput` / `BuildSessionQualityParams`, ts:16-50).
//
// Reuses (does NOT re-port) the already-ported cross-module dependencies:
//   - sessionDetailSummaryEngine.{groupSessionSetsByType,buildWorkingOnlySession}
//       → SessionDetailSummaryEngine (AN-4, this slice)
//   - effectiveSetEngine.buildEffectiveVolumeSummary → EffectiveSetEngine (AN-3)
//   - engineUtils.{completedSets,isCompletedSet,isIncompleteSet,number,setWeightKg}
//       → E1RMEngine (isIncompleteSet ported in place this slice)
//   - replacementEngine.hasInvalidExerciseIdentity → E1RMEngine.hasInvalidExerciseIdentity
//   - jsMathRound → AnalyticsSupport.jsMathRound
// `LoadFeedbackSummary` (loadFeedbackEngine.ts:9, ported 17e-4) is consumed by
// `normalizeLoadFeedback` purely by DUCK-TYPING (`'counts' in v && 'adjustment' in v`),
// so — mirroring the AN-2 plateau `normalizeLoadFeedback` precedent — the load-feedback
// INPUT is kept as a raw `JSONValue?` union and structurally re-discriminated, never
// forced into the static `LoadFeedbackSummary` type.
//
// PURE: consumes a single `TrainingSession` (a §11 clean input) + optional external
// summaries; no IO, no clock (zero `: Date`), no randomness. NOT wired into any
// UI/decision output (that is AN-7).

import Foundation
import IronPathDomain

public enum SessionQualityEngine {

    // MARK: - Output types

    /// `SessionQualitySignal` (sessionQualityEngine.ts:18). `tone` is the raw string
    /// literal (`'positive' | 'neutral' | 'warning' | 'negative'`), compared `==`.
    public struct SessionQualitySignal: Equatable, Sendable {
        public let id: String
        public let label: String
        public let tone: String
        public let reason: String
    }

    /// `SessionQualityResult` (sessionQualityEngine.ts:25). `level` /  `confidence` are the
    /// raw string literals the engine emits. `score` is `Math.round`'d → an integer.
    public struct SessionQualityResult: Equatable, Sendable {
        public let level: String
        public let score: Int
        public let title: String
        public let summary: String
        public let positives: [SessionQualitySignal]
        public let issues: [SessionQualitySignal]
        public let nextSuggestions: [String]
        public let confidence: String
    }

    /// `BuildSessionQualityParams` (sessionQualityEngine.ts:44). `effectiveSetSummary`
    /// (`Partial<EffectiveVolumeSummary> | null`) + `loadFeedback` (`LoadFeedbackInput`
    /// union) are kept as raw `JSONValue` so the TS runtime duck-typing is reproduced
    /// exactly; `painPatterns` is the raw `PainPattern[]`. `unitSettings` is UNUSED by
    /// `buildSessionQualityResult` (it never reads it) and is intentionally omitted.
    public struct Params: Sendable {
        public let session: TrainingSession
        public let effectiveSetSummary: JSONValue?
        public let loadFeedback: JSONValue?
        public let painPatterns: [JSONValue]?
        public init(
            session: TrainingSession,
            effectiveSetSummary: JSONValue? = nil,
            loadFeedback: JSONValue? = nil,
            painPatterns: [JSONValue]? = nil
        ) {
            self.session = session
            self.effectiveSetSummary = effectiveSetSummary
            self.loadFeedback = loadFeedback
            self.painPatterns = painPatterns
        }
    }

    // MARK: - small helpers (sessionQualityEngine.ts:52-120)

    /// `clamp` (ts:52): `Math.max(min, Math.min(max, value))`, defaults [0, 100].
    private static func clamp(_ value: Double, _ min: Double = 0, _ max: Double = 100) -> Double {
        Swift.max(min, Swift.min(max, value))
    }

    /// `roundScore` (ts:53): `Math.round(clamp(value))` → an integer score.
    private static func roundScore(_ value: Double) -> Int {
        AnalyticsSupport.jsMathRound(clamp(value))
    }

    /// `isRecordedCompletedSet` (ts:55): `isCompletedSet(set) && setWeightKg(set) > 0 && number(set.reps) > 0`.
    private static func isRecordedCompletedSet(_ set: TrainingSetLog) -> Bool {
        E1RMEngine.isCompletedSet(set) && E1RMEngine.setWeightKg(set) > 0 && E1RMEngine.number(set.reps) > 0
    }

    /// `hasRecordedRir` (ts:57): `set.rir !== undefined && set.rir !== ''`. A JSON `null`
    /// rir decodes to `.some(.null)` (not nil), so it counts as recorded — matching TS
    /// (`null !== undefined && null !== ''`).
    private static func hasRecordedRir(_ set: TrainingSetLog) -> Bool {
        guard let rir = set.rir else { return false }            // !== undefined
        if case .string(let s) = rir, s.isEmpty { return false } // !== ''
        return true
    }

    /// `set.rir === undefined || set.rir === '' ? undefined : number(set.rir)` (ts:180).
    private static func rirNumber(_ set: TrainingSetLog) -> Double? {
        guard let rir = set.rir else { return nil }
        if case .string(let s) = rir, s.isEmpty { return nil }
        return E1RMEngine.number(rir)
    }

    /// `levelLabel` (ts:59).
    private static func levelLabel(_ level: String) -> String {
        if level == "high" { return "高" }
        if level == "medium" { return "中等" }
        if level == "low" { return "偏低" }
        return "数据不足"
    }

    /// `dataFlagLabel` (ts:66): reads the session's open-bag `dataFlag`.
    private static func dataFlagLabel(_ flag: String?) -> String {
        if flag == "test" { return "测试数据" }
        if flag == "excluded" { return "排除数据" }
        return ""
    }

    /// `makeSignal` (ts:113).
    private static func makeSignal(_ id: String, _ label: String, _ tone: String, _ reason: String) -> SessionQualitySignal {
        SessionQualitySignal(id: id, label: label, tone: tone, reason: reason)
    }

    /// `unique` (ts:120): `[...new Set(items.filter(Boolean))]` — drop empties, dedup,
    /// preserve first-encounter order.
    private static func unique(_ items: [String]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for item in items where !item.isEmpty {
            if seen.insert(item).inserted { out.append(item) }
        }
        return out
    }

    /// JS `${n}` number→string: integers print without a decimal point. Used for the
    /// `plannedWorkingSets` / `highConfidenceEffectiveSets` message interpolations,
    /// which carry `number`-typed (possibly non-integer) values.
    private static func jsNum(_ value: Double) -> String {
        if value.isFinite, value.truncatingRemainder(dividingBy: 1) == 0, abs(value) < 1e15 {
            return String(Int64(value))
        }
        return String(value)
    }

    // MARK: - normalizeLoadFeedback (sessionQualityEngine.ts:75)

    /// `isLoadFeedbackSummary` (ts:72): object with both `counts` and `adjustment` keys.
    private static func isLoadFeedbackSummary(_ value: JSONValue?) -> Bool {
        guard let obj = value?.objectValue else { return false }
        return obj["counts"] != nil && obj["adjustment"] != nil
    }

    private struct FeedbackCounts { var tooHeavy = 0; var tooLight = 0; var good = 0 }

    /// `normalizeLoadFeedback` (ts:75). Reproduces the TS runtime union dispatch
    /// (`session.loadFeedback` always folded in; then array / single-summary /
    /// record-of-values branches).
    private static func normalizeLoadFeedback(_ input: JSONValue?, _ session: TrainingSession) -> FeedbackCounts {
        var values: [String] = []
        func addValue(_ value: String?, _ count: Int = 1) {
            guard let value, value == "too_heavy" || value == "too_light" || value == "good" else { return }
            for _ in 0..<Swift.max(0, count) { values.append(value) }
        }
        func addSummary(_ summary: OrderedJSONObject?) {
            guard let summary else { return }
            let counts = summary["counts"]?.objectValue
            addValue("too_heavy", Int(E1RMEngine.number(counts?["too_heavy"])))
            addValue("too_light", Int(E1RMEngine.number(counts?["too_light"])))
            addValue("good", Int(E1RMEngine.number(counts?["good"])))
            addValue(summary["dominantFeedback"]?.stringValue)
            addValue(summary["adjustment"]?.objectValue?["dominantFeedback"]?.stringValue)
        }

        // (session.loadFeedback || []).forEach((item) => addValue(item.feedback)) (ts:91)
        for item in (session._unknown["loadFeedback"]?.arrayValue ?? []) {
            addValue(item.objectValue?["feedback"]?.stringValue)
        }

        if let arr = input?.arrayValue {                                  // Array.isArray(input)
            for item in arr {
                if let obj = item.objectValue, obj["feedback"] != nil {   // 'feedback' in item
                    addValue(obj["feedback"]?.stringValue)
                } else {
                    addSummary(item.objectValue)
                }
            }
        } else if isLoadFeedbackSummary(input) {
            addSummary(input?.objectValue)
        } else if let obj = input?.objectValue {                          // input && typeof === 'object'
            for entry in obj.entries {                                    // Object.values(input)
                if let s = entry.value.stringValue {
                    addValue(s)
                } else {
                    addSummary(entry.value.objectValue)
                }
            }
        }

        return FeedbackCounts(
            tooHeavy: values.filter { $0 == "too_heavy" }.count,
            tooLight: values.filter { $0 == "too_light" }.count,
            good: values.filter { $0 == "good" }.count
        )
    }

    // MARK: - buildSessionQualityResult (sessionQualityEngine.ts:122)

    public static func buildSessionQualityResult(_ params: Params) -> SessionQualityResult {
        let session = params.session
        let dataFlag = session._unknown["dataFlag"]?.stringValue

        let grouped = SessionDetailSummaryEngine.groupSessionSetsByType(session)

        // completedWorkingSets (ts:129)
        let completedWorkingSets = grouped.workingSets.filter {
            !E1RMEngine.hasInvalidExerciseIdentity($0.exercise) && isRecordedCompletedSet($0.set)
        }
        // completedWarmupSets (ts:130)
        let completedWarmupSets = grouped.warmupSets.filter { isRecordedCompletedSet($0.set) }

        // supportPlanned / supportCompleted (ts:131-132)
        let supportPlanned = grouped.supportSets.reduce(0.0) { sum, item in
            sum + Swift.max(0, E1RMEngine.number(item.objectValue?["plannedSets"]))
        }
        let supportCompleted = grouped.supportSets.reduce(0.0) { sum, item in
            sum + Swift.max(0, E1RMEngine.number(item.objectValue?["completedSets"]))
        }

        // plannedWorkingSets (ts:133-138)
        let plannedWorkingSets: Double = grouped.exerciseGroups.reduce(0.0) { sum, group in
            let prescribed = E1RMEngine.number(group.exercise.prescription?.objectValue?["sets"])
            if prescribed > 0 { return sum + prescribed }
            // typeof group.exercise.sets === 'number' — number-form rides in the open bag.
            if let setsNum = group.exercise._unknown["sets"]?.numberValue {
                return sum + Swift.max(0, E1RMEngine.number(setsNum))
            }
            let nonWarmupCompleted = E1RMEngine.completedSets(group.exercise)
                .filter { $0._unknown["type"]?.stringValue != "warmup" }
                .count
            return sum + Double(Swift.max(group.workingSets.count, nonWarmupCompleted))
        }

        // skippedMainSets / supportSkipped (ts:139-140)
        let skippedMainSets = grouped.workingSets.filter { E1RMEngine.isIncompleteSet($0.set) }.count
        let supportSkipped = grouped.supportSets.filter {
            E1RMEngine.number($0.objectValue?["completedSets"]) < E1RMEngine.number($0.objectValue?["plannedSets"])
        }.count

        // totalCompletedSets (ts:141)
        let totalCompletedSets = Double(completedWorkingSets.count) + supportCompleted

        // insufficient-data early return (ts:143-159)
        if totalCompletedSets <= 0 {
            let flag = dataFlagLabel(dataFlag)
            let summary = !flag.isEmpty
                ? "这次训练已标记为\(flag)，且没有可评估的正式组或辅助完成记录。"
                : "没有可评估的正式组或辅助完成记录，暂时不能判断本次训练质量。"
            let positives: [SessionQualitySignal] = completedWarmupSets.isEmpty
                ? []
                : [makeSignal("warmup-visible", "热身记录完整", "neutral", "已记录 \(completedWarmupSets.count) 组热身，但热身组不作为高质量有效组。")]
            return SessionQualityResult(
                level: "insufficient_data",
                score: 0,
                title: "本次训练质量：数据不足",
                summary: summary,
                positives: positives,
                issues: [makeSignal("insufficient-data", "数据不足", "warning", "缺少正式训练完成记录，无法稳定评价训练质量。")],
                nextSuggestions: ["下次优先完成并记录正式组的重量、次数、余力（RIR）和动作质量。"],
                confidence: "low"
            )
        }

        // computedEffectiveSummary (ts:161-162): provided summary wins (JS `||` truthy),
        // else compute over the working-only session.
        let effectiveSetsRaw: Double
        let highConfidenceRaw: Double
        let completedSetsRaw: Double
        if let summary = params.effectiveSetSummary, !summary.isNull {
            let o = summary.objectValue
            effectiveSetsRaw = E1RMEngine.number(o?["effectiveSets"])
            highConfidenceRaw = E1RMEngine.number(o?["highConfidenceEffectiveSets"])
            completedSetsRaw = E1RMEngine.number(o?["completedSets"])
        } else {
            let computed = EffectiveSetEngine.buildEffectiveVolumeSummary([
                SessionDetailSummaryEngine.buildWorkingOnlySession(session)
            ])
            effectiveSetsRaw = Double(computed.effectiveSets)
            highConfidenceRaw = Double(computed.highConfidenceEffectiveSets)
            completedSetsRaw = Double(computed.completedSets)
        }
        let effectiveSets = Swift.max(0, effectiveSetsRaw)                                  // ts:163
        let highConfidenceEffectiveSets = Swift.max(0, highConfidenceRaw)                  // ts:164
        let effectiveCompletedSets = Swift.max(Double(completedWorkingSets.count), completedSetsRaw) // ts:165

        // completion / effective-quality scores (ts:167-173)
        let mainCompletionRate = plannedWorkingSets > 0
            ? Double(completedWorkingSets.count) / plannedWorkingSets
            : (completedWorkingSets.count > 0 ? 1 : 0)
        let supportCompletionRate = supportPlanned > 0 ? supportCompleted / supportPlanned : 1
        let completionScore = clamp((mainCompletionRate * 0.8 + supportCompletionRate * 0.2) * 100)

        let effectiveRate = effectiveCompletedSets > 0 ? effectiveSets / effectiveCompletedSets : 0
        let highConfidenceRate = effectiveSets > 0 ? highConfidenceEffectiveSets / effectiveSets : 0
        let effectiveQualityScore = clamp((effectiveRate * 0.65 + highConfidenceRate * 0.35) * 100)

        // technique / pain / rir / abnormal partitions (ts:175-182)
        let poorTechniqueSets = completedWorkingSets.filter { $0.set.techniqueQuality == "poor" }
        let goodTechniqueSets = completedWorkingSets.filter { $0.set.techniqueQuality == "good" }
        let painSets = completedWorkingSets.filter { $0.set.painFlag == true }
        let missingRirSets = completedWorkingSets.filter { !hasRecordedRir($0.set) }
        let abnormalInputSets = completedWorkingSets.filter { item in
            let rir = rirNumber(item.set)
            return E1RMEngine.number(item.set.reps) > 50 || (rir != nil && (rir! < 0 || rir! > 10))
        }

        // exerciseIds (ts:183-191) — id / actualExerciseId / replacementExerciseId /
        // originalExerciseId / baseId (NO canonicalExerciseId here).
        var exerciseIds = Set<String>()
        for group in grouped.exerciseGroups {
            let candidates: [String?] = [
                group.exercise.id,
                group.exercise.actualExerciseId,
                group.exercise._unknown["replacementExerciseId"]?.stringValue,
                group.exercise.originalExerciseId,
                group.exercise._unknown["baseId"]?.stringValue,
            ]
            for c in candidates where !(c ?? "").isEmpty { exerciseIds.insert(c!) }
        }

        // matchedPainPatterns (ts:192-194)
        let matchedPainPatterns = (params.painPatterns ?? []).filter { pattern in
            let o = pattern.objectValue
            let pid = o?["exerciseId"]?.stringValue
            let byId = !(pid ?? "").isEmpty && exerciseIds.contains(pid!)
            return byId || E1RMEngine.number(o?["severityAvg"]) >= 3.5
        }

        // feedback (ts:195)
        let feedback = normalizeLoadFeedback(params.loadFeedback, session)

        // safetyScore (ts:197-205)
        let painRate = Double(painSets.count) / Swift.max(1, Double(completedWorkingSets.count))
        let poorTechniqueRate = Double(poorTechniqueSets.count) / Swift.max(1, Double(completedWorkingSets.count))
        let safetyScore = clamp(
            100
            - painRate * 45
            - poorTechniqueRate * 35
            - Double(abnormalInputSets.count) * 12
            - Swift.min(20, Double(matchedPainPatterns.count) * 8)
        )

        // stabilityScore (ts:207-211)
        let firstMainGroup = grouped.exerciseGroups.first { group in
            !group.workingSets.isEmpty || E1RMEngine.number(group.exercise.prescription?.objectValue?["sets"]) > 0
        }
        let keyExerciseCompleted: Bool
        if let firstMainGroup {
            keyExerciseCompleted = firstMainGroup.workingSets.contains { isRecordedCompletedSet($0.set) }
        } else {
            keyExerciseCompleted = completedWorkingSets.count > 0
        }
        let skippedPenalty = Double(Swift.min(35, skippedMainSets * 10 + supportSkipped * 5))
        let feedbackPenalty = Double(Swift.min(15, feedback.tooHeavy * 6 + feedback.tooLight * 3))
        let stabilityScore = clamp((keyExerciseCompleted ? 100 : 50) - skippedPenalty - feedbackPenalty)

        // score + caps (ts:213-218)
        var score = roundScore(completionScore * 0.35 + effectiveQualityScore * 0.3 + safetyScore * 0.2 + stabilityScore * 0.15)
        if dataFlag == "test" || dataFlag == "excluded" { score = Swift.min(score, 82) }
        if painSets.count >= 2 { score = Swift.min(score, 72) }
        if poorTechniqueSets.count >= 2 { score = Swift.min(score, 70) }
        if skippedMainSets > 0 || (session.earlyEndReason != nil) { score = Swift.min(score, 72) }
        if mainCompletionRate < 0.5 { score = Swift.min(score, 55) }

        // level (ts:220)
        let level = score >= 82 ? "high" : (score >= 58 ? "medium" : "low")
        var positives: [SessionQualitySignal] = []
        var issues: [SessionQualitySignal] = []

        // main-completion positive/negative (ts:224-228)
        if mainCompletionRate >= 0.9 {
            positives.append(makeSignal("main-completion", "主训练完成度高", "positive", "完成 \(completedWorkingSets.count)/\(jsNum(Swift.max(1, plannedWorkingSets))) 组主训练。"))
        } else if mainCompletionRate < 0.65 {
            issues.append(makeSignal("main-completion-low", "主训练完成不足", "negative", "主训练完成 \(completedWorkingSets.count)/\(jsNum(Swift.max(1, plannedWorkingSets))) 组，训练刺激不够稳定。"))
        }

        // effective-quality positive/warning (ts:230-234)
        if effectiveSets > 0 && highConfidenceEffectiveSets > 0 {
            positives.append(makeSignal("effective-quality", "有效训练质量稳定", "positive", "正式组中有 \(jsNum(highConfidenceEffectiveSets)) 组高置信有效组。"))
        } else if completedWorkingSets.count > 0 {
            issues.append(makeSignal("effective-quality-low", "高质量有效组不足", "warning", "正式组完成了，但高置信有效组不足，建议结合动作质量和余力（RIR）复查。"))
        }

        // technique-good positive (ts:236-238)
        if goodTechniqueSets.count >= Swift.max(1, completedWorkingSets.count - poorTechniqueSets.count) && poorTechniqueSets.isEmpty {
            positives.append(makeSignal("technique-good", "动作质量稳定", "positive", "正式组动作质量记录整体稳定。"))
        }

        // load-feedback-good positive (ts:240-242)
        if feedback.good > 0 && feedback.tooHeavy == 0 {
            positives.append(makeSignal("load-feedback-good", "重量反馈合适", "positive", "本次推荐重量反馈整体合适。"))
        }

        // warmup-recorded neutral (ts:244-246)
        if !completedWarmupSets.isEmpty {
            positives.append(makeSignal("warmup-recorded", "热身记录可见", "neutral", "已记录 \(completedWarmupSets.count) 组热身；热身组用于准备，不作为高质量有效组。"))
        }

        // issues (ts:248-278)
        if !painSets.isEmpty {
            issues.append(makeSignal("pain-flag", "出现不适标记", "negative", "\(painSets.count) 组正式组记录了不适，这些组不会作为高质量亮点。"))
        }
        if !matchedPainPatterns.isEmpty {
            issues.append(makeSignal("pain-pattern", "近期不适需要关注", "warning", "近期不适记录与本次训练相关，下次应优先确认动作选择和负荷。"))
        }
        if !poorTechniqueSets.isEmpty {
            issues.append(makeSignal("poor-technique", "动作质量偏低", "negative", "\(poorTechniqueSets.count) 组动作质量较差，会降低本次训练质量评分。"))
        }
        if !missingRirSets.isEmpty {
            issues.append(makeSignal("rir-missing", "余力（RIR）记录不完整", "warning", "\(missingRirSets.count) 组正式组缺少余力（RIR），本次判断置信度会下降。"))
        }
        if feedback.tooHeavy > 0 {
            issues.append(makeSignal("load-too-heavy", "重量反馈偏重", "warning", "本次有推荐重量偏重反馈，下次不宜直接加重。"))
        }
        if feedback.tooLight > 0 && feedback.tooHeavy == 0 {
            issues.append(makeSignal("load-too-light", "重量反馈偏轻", "neutral", "本次有重量偏轻反馈，如果动作质量稳定，下次可以小幅校准。"))
        }
        if !abnormalInputSets.isEmpty {
            issues.append(makeSignal("abnormal-input", "记录可能异常", "warning", "部分重量、次数或余力（RIR）记录超出常见范围，建议回看是否为输入错误。"))
        }
        if supportSkipped > 0 {
            issues.append(makeSignal("support-skipped", "辅助训练未完全完成", "neutral", "部分辅助动作未完成，主要影响本次训练完整度。"))
        }
        if skippedMainSets > 0 || (session.earlyEndReason != nil) {
            issues.append(makeSignal("main-incomplete", "主训练未完全完成", "warning", "部分主训练动作或正式组未完成，不会计入有效组、总量、PR 或 e1RM。"))
        }
        let flag = dataFlagLabel(dataFlag)
        if !flag.isEmpty {
            issues.append(makeSignal("data-flag", "不参与统计", "warning", "这次训练已标记为\(flag)，可以查看质量报告，但不会参与训练统计。"))
        }

        // confidence (ts:280-283)
        let missingRirRate = Double(missingRirSets.count) / Swift.max(1, Double(completedWorkingSets.count))
        var confidence = "high"
        if completedWorkingSets.count < 2 || missingRirRate >= 0.7 || abnormalInputSets.count > 0 {
            confidence = "low"
        } else if missingRirRate >= 0.35 || !flag.isEmpty || completedWorkingSets.count < 4 {
            confidence = "medium"
        }

        // summaryParts (ts:285-294)
        var summaryParts: [String] = []
        if level == "high" { summaryParts.append("你完成了主要训练，动作质量和有效组表现较稳定。") }
        if level == "medium" { summaryParts.append("你完成了主要训练，但仍有影响质量或置信度的信号。") }
        if level == "low" { summaryParts.append("本次训练完成度或执行质量偏低，建议先复查关键记录。") }
        if feedback.tooHeavy > 0 { summaryParts.append("重量反馈偏重。") }
        if skippedMainSets > 0 || (session.earlyEndReason != nil) { summaryParts.append("部分主训练未完成，未完成组不会计入有效组、总量、PR 或 e1RM。") }
        if !painSets.isEmpty { summaryParts.append("部分正式组记录了不适。") }
        if !poorTechniqueSets.isEmpty { summaryParts.append("动作质量记录存在偏低。") }
        if !missingRirSets.isEmpty { summaryParts.append("余力（RIR）记录不完整。") }
        if !flag.isEmpty { summaryParts.insert("这次训练为\(flag)，不参与统计。", at: 0) }

        // nextSuggestions (ts:296-303)
        let nextSuggestionsRaw = unique([
            (!painSets.isEmpty || !matchedPainPatterns.isEmpty) ? "下次优先处理不适动作，必要时降低负荷或使用替代动作。" : "",
            !poorTechniqueSets.isEmpty ? "下次先维持重量，优先把动作质量做稳。" : "",
            feedback.tooHeavy > 0 ? "下次相关动作先维持或小幅下调重量，不急于加重。" : "",
            mainCompletionRate < 0.75 ? "下次先确保关键主训练完成，再考虑辅助动作。" : "",
            !missingRirSets.isEmpty ? "下次补全余力（RIR）记录，让后续推荐更可信。" : "",
            (level == "high" && painSets.isEmpty) ? "保持当前训练节奏，继续记录动作质量和余力（RIR）。" : "",
        ])
        let nextSuggestions = Array(nextSuggestionsRaw.prefix(3))

        // summary join `|| fallback` (ts:309)
        let joinedSummary = summaryParts.joined(separator: " ")
        let summaryText = joinedSummary.isEmpty ? "本次训练记录已完成，可以作为后续建议参考。" : joinedSummary

        return SessionQualityResult(
            level: level,
            score: score,
            title: "本次训练质量：\(levelLabel(level))",
            summary: summaryText,
            positives: Array(positives.prefix(4)),                          // ts:310
            issues: Array(issues.prefix(6)),                                // ts:311
            nextSuggestions: nextSuggestions.isEmpty
                ? ["下次继续按计划训练，并保持重量、次数、余力（RIR）和动作质量记录完整。"]
                : nextSuggestions,                                          // ts:312
            confidence: confidence
        )
    }
}
