// TrainingLevelEngine — AN-5 auto training-level assessment port.
//
// Faithful line-by-line Swift port of the PURE training-level functions from
// `retired web reference`:
//   - buildTrainingLevelAssessment   (trainingLevelEngine.ts:150)
//   - buildTechniqueQualitySummary   (trainingLevelEngine.ts:94)
//   - formatAutoTrainingLevel        (trainingLevelEngine.ts:78)
// + every private helper they read (clampScore / signal / levelLabels /
//   confidenceFromSessionCount / uniqueExerciseIds / buildFallbackE1RMProfiles /
//   buildFrequencyScore) and the output / input types (AutoTrainingLevel /
//   TrainingLevelSignal / TrainingLevelAssessment / TechniqueQualitySummary /
//   TrainingLevelAssessmentInput + a TYPE-ONLY TrainingCalendarData).
//
// Dependency boundary (AN-5 §, matches the slice contract):
//   * REUSES (does NOT re-port) every already-ported CALLed engine:
//       buildAdherenceReport          → AnalyticsDashboardEngine.buildAdherenceReport (AN-3)
//       buildE1RMProfile              → E1RMEngine.buildE1RMProfile                  (17e-1)
//       buildEffectiveVolumeSummary   → EffectiveSetEngine.buildEffectiveVolumeSummary (AN-3)
//       buildPainPatterns             → PainPatternEngine.buildPainPatterns          (this slice)
//       filterAnalyticsHistory        → E1RMEngine.filterAnalyticsHistory            (17e)
//       completedSets / number        → E1RMEngine.completedSets / E1RMEngine.number (engineUtils)
//     and REUSES the AN-2 `PlateauDetectionEngine.TechniqueQualitySummary` TYPE
//     (trainingLevelEngine.ts:41 — identical shape) rather than redefining it.
//   * `e1rmConfidenceScore` (trainingLevelEngine.ts:119) and `getExercisePainPattern`
//     are NOT ported — `e1rmConfidenceScore` is DEAD in the legacy web schema source (defined but
//     never CALLed; it is the sole reader of `EstimateConfidence`, so neither is
//     ported), and only the trainingLevel-consumed pain subset lands.
//   * `TrainingCalendarData` is modelled TYPE-ONLY (the single `weeklyFrequency[].
//     sessionCount` field `buildFrequencyScore` reads) — the calendar ENGINE is NOT
//     ported. The real call sites (sessionBuilder / trainingDecisionContext) never pass
//     it, so the `||` fallback (own-history week bucketing) is the live path.
//
// PURE / read-only: consumes `history: [TrainingSession]` + optional external
// summaries; no IO, no wall clock — `buildFrequencyScore`'s `new Date(...).getDay()`
// week bucketing is reproduced with AN-1 civil-calendar math (`zero : Date`). The
// week-bucket KEY is only a grouping handle (never output), so the resulting
// per-week counts — hence `average`/`score` — are timezone-independent. NOT wired
// into any UI (that is AN-7); this slice only adds the functions + parity-pins them.

import Foundation
import IronPathDomain

public enum TrainingLevelEngine {

    public typealias TechniqueQualitySummary = PlateauDetectionEngine.TechniqueQualitySummary

    // MARK: - Output types (trainingLevelEngine.ts:18-39)

    /// `AutoTrainingLevel` (trainingLevelEngine.ts:18). RawValues mirror the legacy web schema string
    /// union so the golden's `level` decodes/compares verbatim.
    public enum AutoTrainingLevel: String, Equatable, Sendable {
        case unknown = "unknown"
        case beginner = "beginner"
        case novicePlus = "novice_plus"
        case intermediate = "intermediate"
        case advanced = "advanced"
    }

    /// `TrainingLevelSignal` (trainingLevelEngine.ts:20). `confidence` is a raw
    /// `'low'|'medium'|'high'` string (no enum in the port).
    public struct TrainingLevelSignal: Equatable, Sendable {
        public let name: String
        public let score: Int
        public let confidence: String
        public let reason: String
    }

    /// `readinessForAdvancedFeatures` (trainingLevelEngine.ts:30).
    public struct ReadinessForAdvancedFeatures: Equatable, Sendable {
        public let topBackoff: Bool
        public let higherVolume: Bool
        public let advancedExerciseSelection: Bool
        public let aggressiveProgression: Bool
    }

    /// `TrainingLevelAssessment` (trainingLevelEngine.ts:27).
    public struct TrainingLevelAssessment: Equatable, Sendable {
        public let level: AutoTrainingLevel
        public let confidence: String
        public let readinessForAdvancedFeatures: ReadinessForAdvancedFeatures
        public let signals: [TrainingLevelSignal]
        public let limitations: [String]
        public let nextDataNeeded: [String]
    }

    // MARK: - TrainingCalendarData (TYPE-ONLY — trainingCalendarEngine.ts)

    /// The single shape `buildFrequencyScore` reads off the optional calendar input:
    /// `calendarData?.weeklyFrequency?.map(week => week.sessionCount)`. The calendar
    /// ENGINE is intentionally NOT ported (AN-5 boundary).
    public struct TrainingCalendarData: Sendable {
        public struct WeeklyFrequencyEntry: Sendable {
            public let sessionCount: Double?
            public init(sessionCount: Double?) { self.sessionCount = sessionCount }
        }
        public let weeklyFrequency: [WeeklyFrequencyEntry]?
        public init(weeklyFrequency: [WeeklyFrequencyEntry]?) { self.weeklyFrequency = weeklyFrequency }
    }

    /// `TrainingLevelAssessmentInput` (trainingLevelEngine.ts:51) — the destructured
    /// parameter object. Every external summary is optional; nil ⇒ compute from history
    /// (the `||` fallback). The real call sites supply only `history` (± `painPatterns`).
    public struct Params: Sendable {
        public let history: [TrainingSession]
        public let e1rmProfiles: [E1RMEngine.E1RMProfile]?
        public let effectiveVolumeSummary: EffectiveSetEngine.EffectiveVolumeSummary?
        public let adherenceReport: AnalyticsDashboardEngine.AdherenceReport?
        public let painPatterns: [PainPatternEngine.PainPattern]?
        public let techniqueQualitySummary: TechniqueQualitySummary?
        public let calendarData: TrainingCalendarData?

        public init(
            history: [TrainingSession] = [],
            e1rmProfiles: [E1RMEngine.E1RMProfile]? = nil,
            effectiveVolumeSummary: EffectiveSetEngine.EffectiveVolumeSummary? = nil,
            adherenceReport: AnalyticsDashboardEngine.AdherenceReport? = nil,
            painPatterns: [PainPatternEngine.PainPattern]? = nil,
            techniqueQualitySummary: TechniqueQualitySummary? = nil,
            calendarData: TrainingCalendarData? = nil
        ) {
            self.history = history
            self.e1rmProfiles = e1rmProfiles
            self.effectiveVolumeSummary = effectiveVolumeSummary
            self.adherenceReport = adherenceReport
            self.painPatterns = painPatterns
            self.techniqueQualitySummary = techniqueQualitySummary
            self.calendarData = calendarData
        }
    }

    // MARK: - clampScore / signal (trainingLevelEngine.ts:61-68)

    /// `Math.max(0, Math.min(100, Math.round(value)))`.
    private static func clampScore(_ value: Double) -> Int {
        max(0, min(100, AnalyticsSupport.jsMathRound(value)))
    }

    private static func signal(_ name: String, _ score: Double, _ confidence: String, _ reason: String) -> TrainingLevelSignal {
        TrainingLevelSignal(name: name, score: clampScore(score), confidence: confidence, reason: reason)
    }

    // MARK: - levelLabels / formatAutoTrainingLevel (trainingLevelEngine.ts:70-78)

    private static let levelLabels: [AutoTrainingLevel: String] = [
        .unknown: "数据不足",
        .beginner: "新手阶段",
        .novicePlus: "入门进阶",
        .intermediate: "中阶",
        .advanced: "高阶",
    ]

    public static func formatAutoTrainingLevel(_ level: AutoTrainingLevel) -> String {
        levelLabels[level] ?? "数据不足"
    }

    // MARK: - confidenceFromSessionCount (trainingLevelEngine.ts:80)

    private static func confidenceFromSessionCount(_ sessionCount: Int) -> String {
        if sessionCount >= 12 { return "high" }
        if sessionCount >= 6 { return "medium" }
        return "low"
    }

    // MARK: - uniqueExerciseIds (trainingLevelEngine.ts:86)

    /// `[...new Set(history.flatMap(s => (s.exercises||[]).map(e => e.canonicalExerciseId
    /// || e.baseId || e.id).filter(Boolean)))]` — first-occurrence order. `canonicalExerciseId`
    /// / `baseId` ride in the open bag; `id` is typed.
    private static func uniqueExerciseIds(_ history: [TrainingSession]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for session in history {
            for exercise in (session.exercises ?? []) {
                let id = truthy(exercise._unknown["canonicalExerciseId"]?.stringValue)
                    ?? truthy(exercise._unknown["baseId"]?.stringValue)
                    ?? truthy(exercise.id)
                guard let id, !seen.contains(id) else { continue }
                seen.insert(id)
                out.append(id)
            }
        }
        return out
    }

    // MARK: - buildTechniqueQualitySummary (trainingLevelEngine.ts:94)

    public static func buildTechniqueQualitySummary(_ history: [TrainingSession] = []) -> TechniqueQualitySummary {
        // `filterAnalyticsHistory(history).flatMap(session => (exercises||[]).flatMap(completedSets))`.
        let sets = E1RMEngine.filterAnalyticsHistory(history).flatMap { session in
            (session.exercises ?? []).flatMap { E1RMEngine.completedSets($0) }
        }
        let totalSets = sets.count
        func count(_ quality: String) -> Int { sets.filter { $0.techniqueQuality == quality }.count }
        let good = count("good")
        let acceptable = count("acceptable")
        let poor = count("poor")
        // `set.rir !== undefined && set.rir !== ''` — present AND not the empty string. A
        // numeric `rir` (stringValue nil) passes; an explicit `""` does not.
        let rirRecorded = sets.filter { set in
            guard let rir = set.rir else { return false }
            return rir.stringValue != ""
        }.count

        return TechniqueQualitySummary(
            totalSets: Double(totalSets),
            good: Double(good),
            acceptable: Double(acceptable),
            poor: Double(poor),
            goodOrAcceptableRate: totalSets != 0 ? Double(good + acceptable) / Double(totalSets) : 0,
            poorRate: totalSets != 0 ? Double(poor) / Double(totalSets) : 0,
            rirRecordedRate: totalSets != 0 ? Double(rirRecorded) / Double(totalSets) : 0
        )
    }

    // MARK: - buildFallbackE1RMProfiles (trainingLevelEngine.ts:114)

    private static func buildFallbackE1RMProfiles(_ history: [TrainingSession]) -> [E1RMEngine.E1RMProfile] {
        uniqueExerciseIds(history).prefix(8).map { E1RMEngine.buildE1RMProfile(history, $0) }
    }

    // MARK: - buildFrequencyScore (trainingLevelEngine.ts:126)

    private struct FrequencyScore { let score: Double; let average: Double }

    private static func buildFrequencyScore(_ history: [TrainingSession], _ calendarData: TrainingCalendarData?) -> FrequencyScore {
        // `calendarData?.weeklyFrequency?.map(sessionCount).filter(Number.isFinite) || []`.
        let counts: [Double] = (calendarData?.weeklyFrequency ?? [])
            .compactMap { $0.sessionCount }
            .filter { $0.isFinite }
        // fallbackCounts — own-history week bucketing (Monday-start), via AN-1 civil math.
        let fallbackCounts: [Double] = {
            var weekCounts = OrderedIntMap()
            for session in history {
                // `new Date(`${session.date || session.startedAt}T00:00:00`)` — valid only when
                // the chosen value is a bare `YYYY-MM-DD` (appending `T00:00:00` to a full ISO
                // yields an invalid double-`T` string → `NaN` → skipped). `getDay()` on the
                // resulting local-midnight equals the civil weekday regardless of timezone.
                let raw = truthy(session.date) ?? truthy(session.startedAt)
                guard let raw, let (y, mo, d) = parseBareCivilDate(raw) else { continue }
                let days = AnalyticsSupport.daysFromCivil(y, mo, d)
                let day = AnalyticsSupport.weekdayFromDays(days)        // getDay() (0=Sun)
                let offset = day == 0 ? -6 : 1 - day                    // shift to Monday
                let (ky, km, kd) = AnalyticsSupport.civilFromDays(days + offset)
                let key = "\(ky)-\(pad2(km))-\(pad2(kd))"               // toISOString().slice(0,10)
                weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1)
            }
            return Array(weekCounts.values.suffix(4)).map(Double.init)   // .slice(-4)
        }()
        let weeklyCounts = counts.isEmpty ? fallbackCounts : counts
        let average = weeklyCounts.isEmpty ? 0 : weeklyCounts.reduce(0, +) / Double(weeklyCounts.count)
        if average >= 4 { return FrequencyScore(score: 85, average: average) }
        if average >= 3 { return FrequencyScore(score: 72, average: average) }
        if average >= 2 { return FrequencyScore(score: 58, average: average) }
        if average >= 1 { return FrequencyScore(score: 38, average: average) }
        return FrequencyScore(score: 0, average: average)
    }

    // MARK: - buildTrainingLevelAssessment (trainingLevelEngine.ts:150)

    public static func buildTrainingLevelAssessment(_ params: Params) -> TrainingLevelAssessment {
        let history = E1RMEngine.filterAnalyticsHistory(params.history)
        let sessionCount = history.count
        let resolvedTechnique = params.techniqueQualitySummary ?? buildTechniqueQualitySummary(history)
        let resolvedEffective = params.effectiveVolumeSummary ?? EffectiveSetEngine.buildEffectiveVolumeSummary(history)
        let resolvedAdherence = params.adherenceReport ?? AnalyticsDashboardEngine.buildAdherenceReport(history)
        let resolvedPainPatterns = params.painPatterns ?? PainPatternEngine.buildPainPatterns(history)
        let resolvedE1rmProfiles = params.e1rmProfiles ?? buildFallbackE1RMProfiles(history)
        var limitations: [String] = []
        var nextDataNeeded: [String] = []

        let dataDepthScore: Double = sessionCount >= 12 ? 90 : sessionCount >= 6 ? 68 : sessionCount >= 3 ? 42 : sessionCount >= 1 ? 18 : 0
        var signals: [TrainingLevelSignal] = [
            signal(
                "训练记录数量",
                dataDepthScore,
                confidenceFromSessionCount(sessionCount),
                sessionCount != 0
                    ? "已有 \(sessionCount) 次正式训练记录；等级判断会随记录增加而变稳。"
                    : "尚无正式训练记录，系统只能显示数据不足。"
            )
        ]

        // `resolvedE1rmProfiles.map(p => p.current).filter(Boolean)`.
        let currentE1rms = resolvedE1rmProfiles.compactMap { $0.current }
        let highOrMediumE1rms = currentE1rms.filter { $0.confidence != "low" }
        let stableE1rms = currentE1rms.filter { $0.confidence == "high" }.count
        let strengthScore: Double = currentE1rms.isEmpty
            ? 0
            : min(90, Double(highOrMediumE1rms.count * 22 + stableE1rms * 18 + min(sessionCount, 12) * 2))
        signals.append(signal(
            "力量稳定性",
            strengthScore,
            stableE1rms >= 2 ? "high" : highOrMediumE1rms.count >= 2 ? "medium" : "low",
            !highOrMediumE1rms.isEmpty
                ? "有 \(highOrMediumE1rms.count) 个动作具备中高置信 currentE1RM；不会用单次最高重量直接判断等级。"
                : "currentE1RM 还缺少高质量来源组。"
        ))

        let techniqueScore: Double = resolvedTechnique.totalSets == 0
            ? 0
            : resolvedTechnique.poorRate >= 0.25
                ? 25
                : resolvedTechnique.poorRate >= 0.12
                    ? 48
                    : resolvedTechnique.goodOrAcceptableRate >= 0.9
                        ? 82
                        : 62
        signals.append(signal(
            "动作质量",
            techniqueScore,
            resolvedTechnique.totalSets >= 24 ? "high" : resolvedTechnique.totalSets >= 10 ? "medium" : "low",
            resolvedTechnique.totalSets != 0
                ? "good/acceptable 占比 \(AnalyticsSupport.jsMathRound(resolvedTechnique.goodOrAcceptableRate * 100))%，poor 占比 \(AnalyticsSupport.jsMathRound(resolvedTechnique.poorRate * 100))%。"
                : "还没有足够动作质量记录。"
        ))

        // `reduce((sum, p) => sum + number(p.frequency) * Math.max(1, number(p.severityAvg)), 0)`.
        let painSeverity = resolvedPainPatterns.reduce(0.0) { sum, pattern in
            sum + Double(pattern.frequency) * max(1, pattern.severityAvg)
        }
        let painScore: Double = painSeverity >= 8 ? 25 : painSeverity >= 4 ? 48 : !resolvedPainPatterns.isEmpty ? 65 : 88
        signals.append(signal(
            "不适记录",
            painScore,
            resolvedPainPatterns.count >= 2 ? "medium" : sessionCount >= 6 ? "medium" : "low",
            !resolvedPainPatterns.isEmpty
                ? "近期有 \(resolvedPainPatterns.count) 个不适模式，训练建议会保持保守。"
                : "没有明显重复不适模式。"
        ))

        let adherenceScore: Double = resolvedAdherence.recentSessionCount == 0
            ? 0
            : resolvedAdherence.overallRate >= 88
                ? 85
                : resolvedAdherence.overallRate >= 75
                    ? 68
                    : resolvedAdherence.overallRate >= 60
                        ? 45
                        : 25
        signals.append(signal(
            "完成度",
            adherenceScore,
            resolvedAdherence.confidence,
            resolvedAdherence.recentSessionCount != 0
                ? "最近完成率 \(AnalyticsDashboardEngine.jsNumberString(resolvedAdherence.overallRate))%，主训练完成率 \(AnalyticsDashboardEngine.jsNumberString(resolvedAdherence.mainlineRate))%。"
                : "还没有完成度数据。"
        ))

        let frequency = buildFrequencyScore(history, params.calendarData)
        signals.append(signal(
            "训练频率",
            frequency.score,
            sessionCount >= 6 ? "medium" : "low",
            frequency.average != 0
                ? "最近训练频率约每周 \(toFixed1(frequency.average)) 次。"
                : "还没有可用于频率判断的训练周。"
        ))

        // `effectiveSets ? highConfidenceEffectiveSets / Math.max(1, effectiveSets) : 0`.
        let effectiveQualityRatio: Double = resolvedEffective.effectiveSets != 0
            ? Double(resolvedEffective.highConfidenceEffectiveSets) / Double(max(1, resolvedEffective.effectiveSets))
            : 0
        let effectiveQualityScore: Double = resolvedEffective.completedSets == 0
            ? 0
            : (effectiveQualityRatio >= 0.65 && resolvedTechnique.rirRecordedRate >= 0.7)
                ? 82
                : effectiveQualityRatio >= 0.4
                    ? 62
                    : 38
        signals.append(signal(
            "有效组质量",
            effectiveQualityScore,
            resolvedEffective.completedSets >= 30 ? "high" : resolvedEffective.completedSets >= 12 ? "medium" : "low",
            resolvedEffective.completedSets != 0
                ? "高置信有效组 \(resolvedEffective.highConfidenceEffectiveSets)/\(resolvedEffective.effectiveSets)，RIR 记录率 \(AnalyticsSupport.jsMathRound(resolvedTechnique.rirRecordedRate * 100))%。"
                : "还没有有效组数据。"
        ))

        if sessionCount < 3 { nextDataNeeded.append("至少完成 2–3 次正式训练，建立初始训练基线。") }
        if sessionCount < 6 { nextDataNeeded.append("继续记录到 6 次以上，系统才能给出中等置信判断。") }
        if currentE1rms.count < 2 { nextDataNeeded.append("为核心动作记录重量、次数、RIR 和动作质量，用于 currentE1RM。") }
        if resolvedTechnique.rirRecordedRate < 0.6 { nextDataNeeded.append("更多 RIR 记录会提高有效组和等级判断置信度。") }

        let averageScore = Double(signals.reduce(0) { $0 + $1.score }) / Double(signals.count)
        let highPain = painScore < 50
        let poorTechnique = resolvedTechnique.poorRate >= 0.15
        let lowAdherence = resolvedAdherence.recentSessionCount > 0 && resolvedAdherence.overallRate < 75
        let unstableFrequency = frequency.average > 0 && frequency.average < 2

        if highPain { limitations.append("近期不适记录偏高，高级训练功能保持关闭或保守。") }
        if poorTechnique { limitations.append("poor technique 比例偏高，不允许判定为高阶。") }
        if lowAdherence { limitations.append("完成率不足，暂不启用高训练量建议。") }
        if unstableFrequency { limitations.append("训练频率还不稳定，暂不建议高容量模板。") }

        var level: AutoTrainingLevel = .unknown
        if sessionCount == 0 {
            level = .unknown
        } else if sessionCount <= 2 {
            level = .unknown
        } else if sessionCount < 6 {
            level = (averageScore >= 50 && !highPain && !poorTechnique) ? .novicePlus : .beginner
        } else if sessionCount >= 12
            && averageScore >= 78
            && stableE1rms >= 2
            && resolvedAdherence.overallRate >= 85
            && !highPain
            && !poorTechnique
            && frequency.average >= 3 {
            level = .advanced
        } else if sessionCount >= 6 && averageScore >= 58 && !highPain && resolvedAdherence.overallRate >= 70 {
            level = .intermediate
        } else if averageScore >= 42 {
            level = .novicePlus
        } else {
            level = .beginner
        }

        if level == .advanced && (highPain || poorTechnique || lowAdherence) { level = .intermediate }
        if (highPain || poorTechnique) && level == .intermediate && sessionCount < 12 { level = .novicePlus }

        let confidence = level == .unknown ? "low" : confidenceFromSessionCount(sessionCount)
        let canUseIntermediateFeatures = level == .intermediate || level == .advanced
        let isAdvanced = level == .advanced

        return TrainingLevelAssessment(
            level: level,
            confidence: confidence,
            readinessForAdvancedFeatures: ReadinessForAdvancedFeatures(
                topBackoff: canUseIntermediateFeatures && !highPain && !poorTechnique,
                higherVolume: canUseIntermediateFeatures && !highPain && !lowAdherence && frequency.average >= 2,
                advancedExerciseSelection: canUseIntermediateFeatures && !highPain && !poorTechnique,
                aggressiveProgression: isAdvanced && !highPain && !poorTechnique && !lowAdherence && resolvedAdherence.overallRate >= 88
            ),
            signals: signals,
            limitations: limitations.isEmpty ? ["等级判断会继续随真实训练记录更新。"] : limitations,
            nextDataNeeded: nextDataNeeded.isEmpty ? ["继续保持重量、次数、RIR、动作质量和不适标记的完整记录。"] : nextDataNeeded
        )
    }

    // MARK: - small helpers

    /// JS truthiness for an optional string (`a || b` skips `''`/nil).
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    private static func pad2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    /// A bare `YYYY-MM-DD` (exactly 10 chars, valid month/day) — the only `raw` for which
    /// `new Date(`${raw}T00:00:00`)` is a valid date in `buildFrequencyScore`.
    private static func parseBareCivilDate(_ value: String) -> (Int, Int, Int)? {
        let chars = Array(value)
        guard chars.count == 10 else { return nil }
        func digit(_ i: Int) -> Int? { chars[i].isASCII && chars[i].isNumber ? chars[i].wholeNumberValue : nil }
        guard let y0 = digit(0), let y1 = digit(1), let y2 = digit(2), let y3 = digit(3),
              chars[4] == "-", let mo0 = digit(5), let mo1 = digit(6),
              chars[7] == "-", let d0 = digit(8), let d1 = digit(9) else { return nil }
        let y = y0 * 1000 + y1 * 100 + y2 * 10 + y3
        let mo = mo0 * 10 + mo1
        let d = d0 * 10 + d1
        guard mo >= 1, mo <= 12, d >= 1, d <= 31 else { return nil }
        return (y, mo, d)
    }

    /// `Number.prototype.toFixed(1)` as a STRING (round-half-away on the EXACT decimal),
    /// for the `frequency.average` interpolation. `average` is always non-negative finite.
    /// `String(format: "%.1f")` is NOT used — it rounds half-to-even (e.g. `2.25` → "2.2",
    /// whereas `(2.25).toFixed(1) === "2.3"`).
    private static func toFixed1(_ value: Double) -> String {
        guard value.isFinite else { return "\(value)" }
        let exact = String(format: "%.340f", value) // exact decimal expansion of the double
        let parts = exact.split(separator: ".", maxSplits: 1, omittingEmptySubsequences: false)
        var intDigits = Array(parts[0])
        let fracDigits = parts.count > 1 ? Array(parts[1]) : []
        var kept: [Character] = fracDigits.isEmpty ? ["0"] : [fracDigits[0]]
        let firstRemoved: Character = fracDigits.count > 1 ? fracDigits[1] : "0"
        var carry = firstRemoved >= "5" // ties → larger n (round-half-away on magnitude)
        if carry {
            var i = kept.count - 1
            while i >= 0 && carry {
                let d = kept[i].wholeNumberValue! + 1
                if d == 10 { kept[i] = "0" } else { kept[i] = Character(String(d)); carry = false }
                i -= 1
            }
            if carry {
                var j = intDigits.count - 1
                while j >= 0 && carry {
                    let d = intDigits[j].wholeNumberValue! + 1
                    if d == 10 { intDigits[j] = "0" } else { intDigits[j] = Character(String(d)); carry = false }
                    j -= 1
                }
                if carry { intDigits.insert("1", at: 0) }
            }
        }
        return String(intDigits) + "." + String(kept)
    }
}

// MARK: - Insertion-ordered map (JS `Map` semantics, Int values)

/// `weekCounts` in `buildFrequencyScore` — keys keep first-insertion slot; re-setting a
/// key updates in place (so `[...values()].slice(-4)` mirrors JS insertion order).
fileprivate struct OrderedIntMap {
    private(set) var keyOrder: [String] = []
    private var storage: [String: Int] = [:]

    func get(_ key: String) -> Int? { storage[key] }

    mutating func set(_ key: String, _ value: Int) {
        if storage[key] == nil { keyOrder.append(key) }
        storage[key] = value
    }

    var values: [Int] { keyOrder.map { storage[$0]! } }
}
