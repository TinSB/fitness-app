// WeeklyCoachActionEngine — CC-1 coach-action track.
//
// Faithful line-by-line Swift port of the PURE `retired web reference`
// (the THREE exported builders + every private helper):
//   • recommendExercisesForMuscleGap  (ts:77)
//   • buildWeeklyActionRecommendations (ts:252)
//   • buildProgramAdjustmentPreview    (ts:350)
//
// PURE / READ-ONLY: zero `: Date` (the engine carries no clock — no `new Date()` /
// `Date.now()` anywhere in its path), no IO, no randomness, no write path, NOT wired
// into any UI. Deterministic given its inputs.
//
// Dependency boundary (CC-1 dependency survey, §19.2):
//   • `number` (engineUtils.ts:38)        → reuse E1RMEngine.number (17e-1 port).
//   • EXERCISE_DISPLAY_NAMES (full table) → reuse ExerciseLibrary.displayNames (SR-1).
//   • WeeklyActionRecommendation          → reuse the Domain type (PA-S1; it is THE
//     output of buildWeeklyActionRecommendations — never re-defined here).
//   • ProgramTemplate / ScreeningProfile  → reuse the Domain types (PA-S1; the engine
//     reads ONLY `splitType` / `restrictedExercises`).
//   • EstimateConfidence                  → reuse the Domain enum.
//   The remaining inputs the engine reads (muscle-volume rows, adherence/pain/e1RM/
//   load-feedback signals, mesocycle week, exercise-library entries) are carried as
//   NARROW input projections holding ONLY the fields the engine touches — the same
//   "Pick"-style input-contract paradigm as CoachActionIdentityEngine.FingerprintAction
//   (PA-S5). These are NOT re-ports of the full AnalyticsDashboardEngine.* /
//   E1RMEngine.* / PainPatternEngine.* / LoadFeedbackEngine.* output structs; those
//   ports stay the source of truth for their own surfaces.
//
//   `defaultExerciseLibrary()` (ts:50) returns EXERCISE_KNOWLEDGE_OVERRIDES — whose
//   *values* (muscleContribution / primaryMuscles / fatigueCost …) are NOT yet native
//   (SR-1 ported only the override KEY SET; the values are SR-2/3 territory). So the
//   default-library FALLBACK is DEFERRED golden-neutral: every CC-1 fixture passes an
//   EXPLICIT `exerciseLibrary`, so the engine never hits the fallback and parity stays
//   exact (mirrors the 17e-3 fineTune / PA live-projection golden-neutral deferrals).
//   `defaultExerciseLibrary()` is ported as an empty table so the seam is faithful in
//   shape; it is pinned by NO golden and lights up when the override values land.
//
// `roundOne` (ts:47) is DEAD in the legacy web schema source (defined, never called) — omitted (an
// unused const has no observable behaviour).
// `WeeklyCoachActionInput.history` (ts:34, `history?: TrainingSession[]`) is declared
// but the engine body NEVER reads it — omitted here so the port does not pull in the
// TrainingSession dependency (golden-neutral; no behaviour change).

import Foundation
import RedeDomain

public enum WeeklyCoachActionEngine {

    // MARK: - Input projections (NARROW — only the fields the engine reads)

    /// One exercise-library entry — the read subset of the legacy web schema
    /// `Partial<ExerciseTemplate> & Record<string, unknown>` (ts:20). The engine
    /// reads `alias` / `name` (label), `muscle` / `primaryMuscles` /
    /// `secondaryMuscles` / `muscleContribution` (contribution) and `fatigueCost`.
    public struct ExerciseLibraryEntry: Equatable, Sendable {
        public let alias: String?
        public let name: String?
        public let muscle: String?
        public let fatigueCost: String?
        public let primaryMuscles: [String]?
        public let secondaryMuscles: [String]?
        public let muscleContribution: [String: Double]?

        public init(
            alias: String? = nil,
            name: String? = nil,
            muscle: String? = nil,
            fatigueCost: String? = nil,
            primaryMuscles: [String]? = nil,
            secondaryMuscles: [String]? = nil,
            muscleContribution: [String: Double]? = nil
        ) {
            self.alias = alias
            self.name = name
            self.muscle = muscle
            self.fatigueCost = fatigueCost
            self.primaryMuscles = primaryMuscles
            self.secondaryMuscles = secondaryMuscles
            self.muscleContribution = muscleContribution
        }
    }

    /// The ordered library map — `Record<string, entry>` (`Object.entries` order
    /// matters for the stable tie-break). Iterated in the order supplied (the CC-1
    /// fixtures author keys in ascending code-point order so the legacy web schema `Object.entries`
    /// iteration matches the Swift JSON-decode order, which sorts keys on ingest).
    public typealias Library = [(id: String, entry: ExerciseLibraryEntry)]

    /// Read subset of `MuscleVolumeDashboardRow` (training-model.ts:1062). `notes` is
    /// not read by the engine and is omitted.
    public struct MuscleVolumeRow: Equatable, Sendable {
        public let muscleId: String
        public let muscleName: String
        public let status: String
        public let targetSets: Double
        public let completedSets: Double
        public let effectiveSets: Double
        public let highConfidenceEffectiveSets: Double
        public let weightedEffectiveSets: Double
        public let remainingSets: Double

        public init(
            muscleId: String, muscleName: String, status: String,
            targetSets: Double, completedSets: Double, effectiveSets: Double,
            highConfidenceEffectiveSets: Double, weightedEffectiveSets: Double,
            remainingSets: Double
        ) {
            self.muscleId = muscleId
            self.muscleName = muscleName
            self.status = status
            self.targetSets = targetSets
            self.completedSets = completedSets
            self.effectiveSets = effectiveSets
            self.highConfidenceEffectiveSets = highConfidenceEffectiveSets
            self.weightedEffectiveSets = weightedEffectiveSets
            self.remainingSets = remainingSets
        }
    }

    /// Read subset of `AdherenceReport` (training-model.ts:964) — only `overallRate`
    /// + `confidence`.
    public struct AdherenceSignal: Equatable, Sendable {
        public let overallRate: Double
        public let confidence: String
        public init(overallRate: Double, confidence: String) {
            self.overallRate = overallRate
            self.confidence = confidence
        }
    }

    /// Read subset of `LoadFeedbackSummary` (loadFeedbackEngine.ts) — only the two
    /// `counts` the engine reads (`too_heavy` / `good`).
    public struct LoadFeedbackSummarySignal: Equatable, Sendable {
        public let tooHeavy: Double // counts.too_heavy
        public let good: Double     // counts.good
        public init(tooHeavy: Double, good: Double) {
            self.tooHeavy = tooHeavy
            self.good = good
        }
    }

    /// Read subset of `PainPattern` (training-model.ts:1028). `lastOccurredAt` is not
    /// read by the engine and is omitted.
    public struct PainSignal: Equatable, Sendable {
        public let area: String
        public let exerciseId: String?
        public let frequency: Double
        public let severityAvg: Double
        public let suggestedAction: String?
        public init(
            area: String, exerciseId: String? = nil,
            frequency: Double, severityAvg: Double, suggestedAction: String? = nil
        ) {
            self.area = area
            self.exerciseId = exerciseId
            self.frequency = frequency
            self.severityAvg = severityAvg
            self.suggestedAction = suggestedAction
        }
    }

    /// Read subset of `E1RMProfile` (training-model.ts:1054) — `exerciseId` + the two
    /// nested `EstimatedOneRepMax` fields the engine reads (`current.e1rmKg` /
    /// `current.confidence` / `best.e1rmKg`).
    public struct E1RMSignal: Equatable, Sendable {
        public let exerciseId: String
        public let currentE1rmKg: Double?
        public let currentConfidence: String?
        public let bestE1rmKg: Double?
        public init(
            exerciseId: String,
            currentE1rmKg: Double? = nil,
            currentConfidence: String? = nil,
            bestE1rmKg: Double? = nil
        ) {
            self.exerciseId = exerciseId
            self.currentE1rmKg = currentE1rmKg
            self.currentConfidence = currentConfidence
            self.bestE1rmKg = bestE1rmKg
        }
    }

    /// Read subset of `MesocycleWeek` (training-model.ts:1305) — only `phase`.
    public struct MesocycleWeekSignal: Equatable, Sendable {
        public let phase: String?
        public init(phase: String? = nil) { self.phase = phase }
    }

    /// `WeeklyCoachActionInput` (ts:24). `history` is omitted (declared in legacy web schema but
    /// never read by the engine body — see file header).
    public struct WeeklyCoachActionInput {
        public let muscleVolumeDashboard: [MuscleVolumeRow]
        public let adherenceReport: AdherenceSignal?
        public let loadFeedbackSummary: LoadFeedbackSummarySignal?
        public let painPatterns: [PainSignal]?
        public let e1rmProfiles: [E1RMSignal]?
        public let mesocycleWeek: MesocycleWeekSignal?
        public let programTemplate: ProgramTemplate?
        public let exerciseLibrary: Library?
        public let screeningProfile: ScreeningProfile?

        public init(
            muscleVolumeDashboard: [MuscleVolumeRow],
            adherenceReport: AdherenceSignal? = nil,
            loadFeedbackSummary: LoadFeedbackSummarySignal? = nil,
            painPatterns: [PainSignal]? = nil,
            e1rmProfiles: [E1RMSignal]? = nil,
            mesocycleWeek: MesocycleWeekSignal? = nil,
            programTemplate: ProgramTemplate? = nil,
            exerciseLibrary: Library? = nil,
            screeningProfile: ScreeningProfile? = nil
        ) {
            self.muscleVolumeDashboard = muscleVolumeDashboard
            self.adherenceReport = adherenceReport
            self.loadFeedbackSummary = loadFeedbackSummary
            self.painPatterns = painPatterns
            self.e1rmProfiles = e1rmProfiles
            self.mesocycleWeek = mesocycleWeek
            self.programTemplate = programTemplate
            self.exerciseLibrary = exerciseLibrary
            self.screeningProfile = screeningProfile
        }
    }

    /// `ExerciseRecommendationContext` (ts:37).
    public struct ExerciseRecommendationContext {
        public let exerciseLibrary: Library?
        public let painPatterns: [PainSignal]?
        public let restrictedExercises: [String]?
        public let loadFeedbackByExercise: [String: LoadFeedbackSummarySignal]?
        public let recentLowAdherenceExerciseIds: [String]?

        public init(
            exerciseLibrary: Library? = nil,
            painPatterns: [PainSignal]? = nil,
            restrictedExercises: [String]? = nil,
            loadFeedbackByExercise: [String: LoadFeedbackSummarySignal]? = nil,
            recentLowAdherenceExerciseIds: [String]? = nil
        ) {
            self.exerciseLibrary = exerciseLibrary
            self.painPatterns = painPatterns
            self.restrictedExercises = restrictedExercises
            self.loadFeedbackByExercise = loadFeedbackByExercise
            self.recentLowAdherenceExerciseIds = recentLowAdherenceExerciseIds
        }
    }

    // MARK: - Output types (new — absent from Domain)

    /// `ExerciseRecommendation` (training-model.ts:1099). `contribution` is the
    /// internal sort key (ts:21 `ExerciseRecommendationCandidate`) and is dropped
    /// from the output (ts:129), exactly as in legacy web schema.
    public struct ExerciseRecommendation: Equatable, Sendable {
        public let exerciseId: String
        public let label: String
        public let reason: String
        public let fatigueCost: String
        public let priority: String // 'primary' | 'secondary' | 'avoid'
    }

    /// `ProgramAdjustmentPreview` (training-model.ts:1107) — only the change fields the
    /// engine emits (ts:367-405).
    public struct ProgramAdjustmentPreview: Equatable, Sendable {
        public struct Change: Equatable, Sendable {
            public let type: String
            public let muscleId: String?
            public let exerciseId: String?
            public let setsDelta: Double?
            public let reason: String
        }
        public let id: String
        public let title: String
        public let summary: String
        public let changes: [Change]
        public let confidence: String // EstimateConfidence
    }

    // MARK: - private constants / helpers

    /// `priorityScore` (ts:45) — high < medium < low.
    private static func priorityScore(_ priority: String?) -> Int {
        switch priority {
        case "high": return 0
        case "medium": return 1
        case "low": return 2
        default: return 3 // unreachable for engine-produced recs
        }
    }

    /// `clampDelta` (ts:48) — `Math.max(2, Math.min(4, Math.ceil(value)))`.
    private static func clampDelta(_ value: Double) -> Int {
        Swift.max(2, Swift.min(4, Int(value.rounded(.up))))
    }

    /// `defaultExerciseLibrary` (ts:50) — EXERCISE_KNOWLEDGE_OVERRIDES values.
    /// DEFERRED golden-neutral (see file header): the override values are not native
    /// yet, so this returns an empty table; no CC-1 golden hits it.
    private static func defaultExerciseLibrary() -> Library { [] }

    /// `exerciseLabel` (ts:52) — `alias || name || EXERCISE_DISPLAY_NAMES[id] || id`
    /// (JS `||` skips empty strings).
    private static func exerciseLabel(_ id: String, _ exercise: ExerciseLibraryEntry?) -> String {
        nonEmpty(exercise?.alias)
            ?? nonEmpty(exercise?.name)
            ?? nonEmpty(ExerciseLibrary.displayNames[id])
            ?? id
    }

    /// `getContribution` (ts:55).
    private static func getContribution(_ muscleId: String, _ exercise: ExerciseLibraryEntry) -> Double {
        if let mc = exercise.muscleContribution, let v = mc[muscleId], v != 0 {
            return v // number(contribution[muscleId])
        }
        if (exercise.primaryMuscles ?? []).contains(muscleId) { return 1 }
        if (exercise.secondaryMuscles ?? []).contains(muscleId) { return 0.5 }
        if exercise.muscle == muscleId { return 1 }
        return 0
    }

    /// `painActionForExercise` (ts:64).
    private static func painActionForExercise(_ painPatterns: [PainSignal], _ exerciseId: String) -> String? {
        painPatterns.first(where: { $0.exerciseId == exerciseId })?.suggestedAction
    }

    /// `hasPainRisk` (ts:67).
    private static func hasPainRisk(_ painPatterns: [PainSignal], _ exerciseId: String) -> Bool {
        let action = painActionForExercise(painPatterns, exerciseId)
        return action == "substitute" || action == "seek_professional" || action == "deload"
    }

    /// `recentFeedbackIsHeavy` (ts:72).
    private static func recentFeedbackIsHeavy(_ summary: LoadFeedbackSummarySignal?) -> Bool {
        guard let summary else { return false }
        return summary.tooHeavy >= 2 && summary.tooHeavy >= summary.good
    }

    /// `fatigueScore` (ts:75).
    private static func fatigueScore(_ fatigueCost: String) -> Int {
        fatigueCost == "low" ? 0 : (fatigueCost == "medium" ? 1 : 2)
    }

    // MARK: - recommendExercisesForMuscleGap (ts:77)

    /// One internal candidate — the legacy web schema `ExerciseRecommendationCandidate` (ts:21),
    /// carrying the `contribution` sort key dropped from the output.
    private struct Candidate {
        let exerciseId: String
        let label: String
        let reason: String
        let fatigueCost: String
        let priority: String
        let contribution: Double
    }

    public static func recommendExercisesForMuscleGap(
        _ muscleId: String,
        _ context: ExerciseRecommendationContext = ExerciseRecommendationContext()
    ) -> [ExerciseRecommendation] {
        let library = context.exerciseLibrary ?? defaultExerciseLibrary() // ts:81
        let restricted = Set(context.restrictedExercises ?? [])           // ts:82

        let candidates: [Candidate] = library.compactMap { pair in
            let exerciseId = pair.id
            let exercise = pair.entry
            let contribution = getContribution(muscleId, exercise) // ts:86
            if contribution <= 0 { return nil }                   // ts:87

            let fatigueCost = nonEmpty(exercise.fatigueCost) ?? "medium" // ts:89
            let restrictedExercise = restricted.contains(exerciseId)     // ts:90
            let painRisk = hasPainRisk(context.painPatterns ?? [], exerciseId) // ts:91
            let heavyFeedback = recentFeedbackIsHeavy(context.loadFeedbackByExercise?[exerciseId]) // ts:92
            let lowAdherence = (context.recentLowAdherenceExerciseIds ?? []).contains(exerciseId)  // ts:93

            var priority = "primary" // ts:95
            var reasons: [String] = []

            if restrictedExercise || painRisk { // ts:98
                priority = "avoid"
                reasons.append(restrictedExercise ? "该动作已被当前筛查限制。" : "该动作近期有重复不适记录。") // ts:100
            } else {
                if fatigueCost == "high" || heavyFeedback || lowAdherence { priority = "secondary" } // ts:102
                if contribution >= 0.9 && fatigueCost != "high" { reasons.append("能直接补充\(muscleId)训练量。") } // ts:103
                if fatigueCost == "low" || fatigueCost == "medium" { reasons.append("疲劳成本较低，适合用作下周补量。") } // ts:104
                if fatigueCost == "high" { reasons.append("疲劳成本较高，补量时不作为首选。") } // ts:105
                if heavyFeedback { reasons.append("最近该动作有推荐重量偏重反馈，先降低优先级。") } // ts:106
                if lowAdherence { reasons.append("该动作近期完成度偏低，先作为备选。") } // ts:107
            }

            return Candidate(
                exerciseId: exerciseId,
                label: exerciseLabel(exerciseId, exercise), // ts:112
                reason: reasons.isEmpty ? "可为\(muscleId)提供训练量。" : reasons.joined(separator: " "), // ts:113
                fatigueCost: fatigueCost,
                priority: priority,
                contribution: contribution
            )
        }

        // ts:120-128 — STABLE sort: priorityOrder ASC, then fatigueScore ASC, then
        // contribution DESC; equal-key candidates keep their iteration order.
        let priorityOrder: [String: Int] = ["primary": 0, "secondary": 1, "avoid": 2]
        let sorted = stableSorted(candidates) { left, right in
            let lp = priorityOrder[left.priority] ?? 0
            let rp = priorityOrder[right.priority] ?? 0
            if lp != rp { return lp - rp }
            let lf = fatigueScore(left.fatigueCost)
            let rf = fatigueScore(right.fatigueCost)
            if lf != rf { return lf - rf }
            if left.contribution != right.contribution { // number(right) - number(left) (DESC)
                return right.contribution > left.contribution ? 1 : -1
            }
            return 0
        }

        return sorted.map { // ts:129 — drop `contribution`
            ExerciseRecommendation(
                exerciseId: $0.exerciseId,
                label: $0.label,
                reason: $0.reason,
                fatigueCost: $0.fatigueCost,
                priority: $0.priority
            )
        }
    }

    // MARK: - makeRecommendation (ts:132)

    private static func makeRecommendation(
        priority: String,
        category: String,
        targetType: String,
        targetId: String? = nil,
        targetLabel: String,
        issue: String,
        recommendation: String,
        reason: String,
        suggestedChange: JSONValue? = nil,
        evidenceRuleIds: [String]? = nil,
        confidence: String
    ) -> WeeklyActionRecommendation {
        // ts:133 — id = `${category}-${targetType}-${targetId || targetLabel}` (no id passed).
        let id = "\(category)-\(targetType)-\(nonEmpty(targetId) ?? targetLabel)"
        return WeeklyActionRecommendation(
            id: id,
            priority: priority,
            category: category,
            targetType: targetType,
            targetId: targetId,
            targetLabel: targetLabel,
            issue: issue,
            recommendation: recommendation,
            reason: reason,
            suggestedChange: suggestedChange,
            evidenceRuleIds: evidenceRuleIds,
            confidence: EstimateConfidence(rawValue: confidence)
        )
    }

    /// `hasLowHighConfidence` (ts:137).
    private static func hasLowHighConfidence(_ row: MuscleVolumeRow) -> Bool {
        row.completedSets >= Swift.max(3, row.targetSets * 0.6)
            && row.highConfidenceEffectiveSets < Swift.max(1, row.effectiveSets * 0.6)
    }

    // MARK: - volumeRecommendationForRow (ts:141)

    private static func volumeRecommendationForRow(
        _ row: MuscleVolumeRow,
        _ input: WeeklyCoachActionInput
    ) -> [WeeklyActionRecommendation] {
        let deloadWeek = input.mesocycleWeek?.phase == "deload" // ts:145
        let painRisk = (input.painPatterns ?? []).contains { // ts:146
            $0.area == row.muscleId && $0.suggestedAction != "watch"
        }
        let exerciseRecommendations = recommendExercisesForMuscleGap( // ts:147
            row.muscleId,
            ExerciseRecommendationContext(
                exerciseLibrary: input.exerciseLibrary,
                painPatterns: input.painPatterns,
                restrictedExercises: input.screeningProfile?.restrictedExercises
            )
        ).filter { $0.priority != "avoid" } // ts:151
        let exerciseIds = exerciseRecommendations.prefix(3).map { $0.exerciseId } // ts:152
        let exerciseText = exerciseRecommendations.prefix(2).map { $0.label }.joined(separator: " / ") // ts:153
        var recommendations: [WeeklyActionRecommendation] = []

        if row.status == "low" { // ts:156
            let setsDelta = clampDelta(row.remainingSets) // ts:157
            if deloadWeek { // ts:158
                recommendations.append(makeRecommendation(
                    priority: "medium",
                    category: "mesocycle",
                    targetType: "muscle",
                    targetId: row.muscleId,
                    targetLabel: row.muscleName,
                    issue: "\(row.muscleName) 本周低于目标，但当前处于减量周。",
                    recommendation: "下周先按减量周完成恢复，不强行补量。",
                    reason: "减量周的优先级是降低疲劳，训练量不足先记录为后续周期的补量参考。",
                    suggestedChange: suggestedChangeValue(muscleId: row.muscleId, setsDelta: 0, volumeMultiplier: 0.6),
                    evidenceRuleIds: ["deload_volume_reduction", "weekly_volume_distribution"],
                    confidence: "medium"
                ))
            } else { // ts:174
                recommendations.append(makeRecommendation(
                    priority: painRisk ? "medium" : "high", // ts:177
                    category: "volume",
                    targetType: "muscle",
                    targetId: row.muscleId,
                    targetLabel: row.muscleName,
                    issue: "\(row.muscleName) 本周加权有效组明显低于目标。",
                    recommendation: exerciseText.isEmpty // ts:183
                        ? "下周优先补 \(setsDelta) 组\(row.muscleName)训练量。"
                        : "下周优先补 \(setsDelta) 组\(row.muscleName)训练量，可放在 \(exerciseText)。",
                    reason: "目标 \(jsNumberString(row.targetSets)) 组，目前加权有效组 \(jsNumberString(row.weightedEffectiveSets))，还差约 \(jsNumberString(row.remainingSets)) 组。", // ts:186
                    suggestedChange: suggestedChangeValue(muscleId: row.muscleId, setsDelta: setsDelta, exerciseIds: exerciseIds),
                    evidenceRuleIds: ["weekly_volume_distribution", "progressive_overload"],
                    confidence: row.effectiveSets > 0 ? "high" : "medium" // ts:189
                ))
            }
        }

        if row.status == "near_target" || row.status == "on_target" { // ts:195
            recommendations.append(makeRecommendation(
                priority: "low",
                category: "volume",
                targetType: "muscle",
                targetId: row.muscleId,
                targetLabel: row.muscleName,
                issue: "\(row.muscleName) 本周训练量已\(row.status == "near_target" ? "接近目标" : "达标")。", // ts:203
                recommendation: "下周维持\(row.muscleName)当前训练量，不需要额外加量。",
                reason: "当前加权有效组 \(jsNumberString(row.weightedEffectiveSets))/\(jsNumberString(row.targetSets))，继续提高动作质量比堆组数更重要。", // ts:205
                suggestedChange: suggestedChangeValue(muscleId: row.muscleId, setsDelta: 0),
                evidenceRuleIds: ["weekly_volume_distribution"],
                confidence: "medium"
            ))
        }

        if row.status == "high" { // ts:213
            recommendations.append(makeRecommendation(
                priority: "medium",
                category: "recovery",
                targetType: "muscle",
                targetId: row.muscleId,
                targetLabel: row.muscleName,
                issue: "\(row.muscleName) 本周训练量可能偏高。",
                recommendation: "下周不建议继续增加\(row.muscleName)辅助动作，可减少 1–2 组或维持现状。",
                reason: "当前加权有效组 \(jsNumberString(row.weightedEffectiveSets)) 已超过目标 \(jsNumberString(row.targetSets))，继续加量可能提高疲劳成本。", // ts:223
                suggestedChange: suggestedChangeValue(muscleId: row.muscleId, setsDelta: -2),
                evidenceRuleIds: ["weekly_volume_distribution", "deload_volume_reduction"],
                confidence: "medium"
            ))
        }

        if hasLowHighConfidence(row) { // ts:231
            recommendations.append(makeRecommendation(
                priority: row.status == "low" ? "medium" : "high", // ts:234
                category: "technique",
                targetType: "muscle",
                targetId: row.muscleId,
                targetLabel: row.muscleName,
                issue: "\(row.muscleName) 完成组不少，但高置信有效组偏低。",
                recommendation: "下周优先记录 RIR 和动作质量，先把工作组做成高置信有效组，而不是盲目加量。",
                reason: "完成 \(jsNumberString(row.completedSets)) 组，但高置信有效组只有 \(jsNumberString(row.highConfidenceEffectiveSets)) 组。", // ts:241
                suggestedChange: suggestedChangeValue(muscleId: row.muscleId, setsDelta: 0),
                evidenceRuleIds: ["technique_quality_gate", "rir_effort_control"],
                confidence: "high"
            ))
        }

        return recommendations
    }

    // MARK: - buildWeeklyActionRecommendations (ts:252)

    public static func buildWeeklyActionRecommendations(
        _ input: WeeklyCoachActionInput
    ) -> [WeeklyActionRecommendation] {
        var recommendations: [WeeklyActionRecommendation] = []

        if input.muscleVolumeDashboard.isEmpty { // ts:255
            return [makeRecommendation(
                priority: "low",
                category: "adherence",
                targetType: "program",
                targetLabel: "训练记录",
                issue: "当前训练记录还不足以生成高置信行动建议。",
                recommendation: "继续记录 2–3 次完整训练，尤其是 RIR、动作质量和实际完成组数。",
                reason: "肌群训练量、完成度和动作质量数据不足时，系统不会假装给出精确调整。",
                evidenceRuleIds: ["weekly_volume_distribution"],
                confidence: "low"
            )]
        }

        for row in input.muscleVolumeDashboard { // ts:271
            recommendations.append(contentsOf: volumeRecommendationForRow(row, input))
        }

        if let adherence = input.adherenceReport, adherence.overallRate < 70 { // ts:273
            recommendations.append(makeRecommendation(
                priority: "high",
                category: "adherence",
                targetType: "program",
                targetLabel: "计划可执行性",
                issue: "最近训练完成度只有 \(jsNumberString(adherence.overallRate))%。", // ts:280
                recommendation: "下周先减少计划复杂度，优先保留主训练和最关键的 1 个辅助模块。",
                reason: "完成度偏低时，继续加内容通常会让计划更难执行。",
                suggestedChange: suggestedChangeValue(volumeMultiplier: 0.9, supportDoseAdjustment: "reduce"),
                evidenceRuleIds: ["weekly_volume_distribution"],
                confidence: adherence.confidence // ts:285
            ))
        }

        let heavyFeedback = (input.loadFeedbackSummary?.tooHeavy ?? -1) >= 2 // ts:290
        if heavyFeedback {
            recommendations.append(makeRecommendation(
                priority: "medium",
                category: "load_feedback",
                targetType: "program",
                targetLabel: "推荐重量",
                issue: "最近多次反馈推荐重量偏重。",
                recommendation: "下周相关动作先采用保守推进，不直接提高当前 e1RM。",
                reason: "重量反馈是校准信号，不应直接覆盖训练表现数据。",
                suggestedChange: suggestedChangeValue(volumeMultiplier: 0.95),
                evidenceRuleIds: ["progressive_overload", "rir_effort_control"],
                confidence: "medium"
            ))
        }

        for pattern in (input.painPatterns ?? []).prefix(2) { // ts:308
            if pattern.suggestedAction == "watch" { continue } // ts:309
            recommendations.append(makeRecommendation(
                priority: pattern.suggestedAction == "seek_professional" ? "high" : "medium", // ts:312
                category: "pain",
                targetType: nonEmpty(pattern.exerciseId) != nil ? "exercise" : "program", // ts:314
                targetId: pattern.exerciseId,
                targetLabel: nonEmpty(pattern.exerciseId) ?? pattern.area, // ts:316
                issue: "\(pattern.area) 近期出现重复不适记录。",
                recommendation: nonEmpty(pattern.exerciseId) != nil // ts:318
                    ? "下周避免把该动作作为补量首选，优先使用更稳定的替代动作。"
                    : "下周降低相关部位训练压力，并观察不适是否持续。",
                reason: "频率 \(jsNumberString(pattern.frequency))，平均强度 \(toFixed1(pattern.severityAvg))，系统建议采取保守训练处理。", // ts:319
                suggestedChange: nonEmpty(pattern.exerciseId) != nil // ts:320
                    ? suggestedChangeValue(removeExerciseIds: [pattern.exerciseId!])
                    : suggestedChangeValue(volumeMultiplier: 0.9),
                evidenceRuleIds: ["pain_conservative_rule"],
                confidence: "medium"
            ))
        }

        for profile in (input.e1rmProfiles ?? []) { // ts:327
            // ts:328 — skip unless current+best present AND best.e1rmKg > current.e1rmKg + 5.
            guard let current = profile.currentE1rmKg, let best = profile.bestE1rmKg else { continue }
            if best <= current + 5 { continue }
            recommendations.append(makeRecommendation(
                priority: "low",
                category: "recovery",
                targetType: "exercise",
                targetId: profile.exerciseId,
                targetLabel: nonEmpty(ExerciseLibrary.displayNames[profile.exerciseId]) ?? profile.exerciseId, // ts:335
                issue: "历史最佳 e1RM 明显高于当前稳定估算。",
                recommendation: "下周训练重量继续以当前 e1RM 为准，不追历史最高。",
                reason: "当前估算 \(jsNumberString(current))kg，历史最佳 \(jsNumberString(best))kg；近期能力比历史峰值更能代表下周可用负荷。", // ts:338
                evidenceRuleIds: ["progressive_overload"],
                // ts:340 `confidence: current.confidence`. `EstimatedOneRepMax.confidence` is a
                // REQUIRED field (training-model.ts:1041), and the §11 flattened input projects
                // `current.{e1rmKg,confidence}` together (the test decoder reads BOTH off the one
                // `current` object), so `currentConfidence` is present whenever the `currentE1rmKg`
                // guard (ts:328 `!profile.current`) passed — every CC-1 golden carries it, so the
                // output stays byte-identical. The empty-string fallback (②, audit fix; CC-4) replaces
                // the old silent `?? "medium"`: it only ever fires on a malformed projection, and
                // `EstimateConfidence(rawValue: "")` → nil → the key is OMITTED, faithfully reproducing
                // what legacy web schema emits for an absent confidence (`undefined`) instead of FABRICATING a
                // "medium" the legacy web schema never has. Pinned by testE1RMConfidenceIsFaithfulNoMediumFallback.
                confidence: profile.currentConfidence ?? ""
            ))
        }

        // ts:345-347 — sort priorityScore ASC, then targetLabel localeCompare(zh-CN) ASC
        // (STABLE), then slice(0, 10).
        let sorted = stableSorted(recommendations) { left, right in
            let ps = priorityScore(left.priority) - priorityScore(right.priority)
            if ps != 0 { return ps }
            return localeCompareZhCN(left.targetLabel ?? "", right.targetLabel ?? "")
        }
        return Array(sorted.prefix(10))
    }

    // MARK: - buildProgramAdjustmentPreview (ts:350)

    public static func buildProgramAdjustmentPreview(
        _ recommendations: [WeeklyActionRecommendation],
        _ programTemplate: ProgramTemplate? = nil
    ) -> [ProgramAdjustmentPreview] {
        let actionable = recommendations.filter { isPresent($0.suggestedChange) } // ts:354
        if actionable.isEmpty { // ts:355
            return [ProgramAdjustmentPreview(
                id: "preview-keep",
                title: "暂不调整计划结构",
                summary: "当前建议以观察和记录为主，暂时不生成训练模板改动。",
                changes: [ProgramAdjustmentPreview.Change(
                    type: "keep", muscleId: nil, exerciseId: nil, setsDelta: nil,
                    reason: "没有足够高置信的结构调整信号。"
                )],
                confidence: "low"
            )]
        }

        let changes: [ProgramAdjustmentPreview.Change] = actionable.flatMap { item -> [ProgramAdjustmentPreview.Change] in
            guard let change = item.suggestedChange?.objectValue else { return [] } // ts:368-369
            let reason = item.recommendation ?? ""
            let setsDelta = E1RMEngine.number(change["setsDelta"]) // number(change.setsDelta) (ts:370)
            if setsDelta > 0 { // ts:370
                return [ProgramAdjustmentPreview.Change(
                    type: "add_sets",
                    muscleId: change.optionalString("muscleId"),
                    exerciseId: change.optionalStringArray("exerciseIds")?.first, // change.exerciseIds?.[0]
                    setsDelta: change.optionalDouble("setsDelta"),
                    reason: reason
                )]
            }
            if setsDelta < 0 { // ts:379
                return [ProgramAdjustmentPreview.Change(
                    type: "remove_sets",
                    muscleId: change.optionalString("muscleId"),
                    exerciseId: nil,
                    setsDelta: change.optionalDouble("setsDelta"),
                    reason: reason
                )]
            }
            if let removeIds = change.optionalStringArray("removeExerciseIds"), !removeIds.isEmpty { // ts:387
                return removeIds.map { exerciseId in
                    ProgramAdjustmentPreview.Change(
                        type: "swap_exercise", muscleId: nil, exerciseId: exerciseId,
                        setsDelta: nil, reason: reason
                    )
                }
            }
            let supportDose = change.optionalString("supportDoseAdjustment") // ts:394
            if let supportDose, supportDose != "keep" {
                return [ProgramAdjustmentPreview.Change(
                    type: "reduce_support", muscleId: nil, exerciseId: nil,
                    setsDelta: nil, reason: reason
                )]
            }
            return [ProgramAdjustmentPreview.Change( // ts:400
                type: "keep",
                muscleId: change.optionalString("muscleId"),
                exerciseId: nil,
                setsDelta: nil,
                reason: reason
            )]
        }

        // ts:411 — programTemplate truthy → splitType summary; else generic.
        let summary: String
        if let programTemplate {
            summary = "基于当前数据，建议先预览 \(programTemplate.splitType ?? "undefined") 计划的微调，不自动应用。"
        } else {
            summary = "基于当前数据生成下周微调预览，不自动应用。"
        }
        let confidence = recommendations.contains { $0.confidence == .high } ? "high" : "medium" // ts:415

        return [ProgramAdjustmentPreview(
            id: "preview-next-week",
            title: "下周计划调整预览",
            summary: summary,
            changes: Array(changes.prefix(6)), // ts:414
            confidence: confidence
        )]
    }

    // MARK: - suggestedChange JSONValue builder

    /// Builds the `suggestedChange` anonymous-object subtree (training-model.ts:1087)
    /// as a raw `JSONValue`, mirroring the legacy web schema object-literal keys. Only the keys the
    /// caller passes are emitted (matching the legacy web schema literals, which omit `undefined`
    /// fields). Integer fields (`setsDelta`) use `.integer`; `volumeMultiplier` is a
    /// fractional `.double` — both canonicalise identically to the JSON-decoded golden.
    private static func suggestedChangeValue(
        muscleId: String? = nil,
        setsDelta: Int? = nil,
        exerciseIds: [String]? = nil,
        removeExerciseIds: [String]? = nil,
        volumeMultiplier: Double? = nil,
        supportDoseAdjustment: String? = nil
    ) -> JSONValue {
        var entries: [OrderedJSONObject.Entry] = []
        if let muscleId { entries.append(.init(key: "muscleId", value: .string(muscleId))) }
        if let setsDelta { entries.append(.init(key: "setsDelta", value: .number(.integer(Int64(setsDelta))))) }
        if let exerciseIds { entries.append(.init(key: "exerciseIds", value: .array(exerciseIds.map { .string($0) }))) }
        if let removeExerciseIds { entries.append(.init(key: "removeExerciseIds", value: .array(removeExerciseIds.map { .string($0) }))) }
        if let volumeMultiplier { entries.append(.init(key: "volumeMultiplier", value: .number(.double(volumeMultiplier)))) }
        if let supportDoseAdjustment { entries.append(.init(key: "supportDoseAdjustment", value: .string(supportDoseAdjustment))) }
        return .object(OrderedJSONObject(entries: entries))
    }

    /// JS truthiness for a `suggestedChange?` (an object literal is always truthy;
    /// only `nil` / `.null` are falsy).
    private static func isPresent(_ value: JSONValue?) -> Bool {
        guard let value else { return false }
        if case .null = value { return false }
        return true
    }
}

// MARK: - file-private formatting / collation helpers (per-file convention)

/// `nonEmpty` — JS `a || b` truthiness for an optional string (skips `''` and nil).
private func nonEmpty(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return nil }
    return value
}

/// `String(number)` — JS number→string: integral doubles print without a decimal
/// (`12` not `12.0`). Same paradigm as `AnalyticsDashboardEngine.jsNumberString`.
private func jsNumberString(_ value: Double) -> String {
    if value == value.rounded(.towardZero) && abs(value) < 1e15 {
        return String(Int(value))
    }
    return String(value)
}

/// `(value).toFixed(1)` — fixed 1-decimal string (always one fractional digit).
/// Same paradigm as `ProgressionRulesEngine.toFixed1` / `TrainingLevelEngine.toFixed1`.
private func toFixed1(_ value: Double) -> String {
    String(format: "%.1f", value)
}

/// `a.localeCompare(b, 'zh-CN')` via Foundation's ICU collation, returning -1/0/1.
/// Same paradigm + locale as `DataHealthIssueSorting.localeCompareZhCN`
/// (weeklyCoachActionEngine.ts:346).
private func localeCompareZhCN(_ a: String, _ b: String) -> Int {
    switch a.compare(b, options: [], range: nil, locale: Locale(identifier: "zh-CN")) {
    case .orderedAscending: return -1
    case .orderedSame: return 0
    case .orderedDescending: return 1
    }
}

/// A STABLE sort driven by a JS-style three-way comparator (negative = left first).
/// Ties keep their original relative order, mirroring `Array.prototype.sort`.
private func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
    array.enumerated().sorted { lhs, rhs in
        let c = comparator(lhs.element, rhs.element)
        if c != 0 { return c < 0 }
        return lhs.offset < rhs.offset
    }.map { $0.element }
}
