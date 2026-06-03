// TrainingIntelligenceSummaryEngine — AN-6 top-level intelligence-summary port +
// function-level parity.
//
// Faithful line-by-line Swift port of the PURE top-level aggregation function from
// `src/engines/trainingIntelligenceSummaryEngine.ts`:
//   - buildTrainingIntelligenceSummary   (trainingIntelligenceSummaryEngine.ts:204)
// + every private helper it reads (unique / isNormalSession / getExerciseIds /
//   exerciseLabelFromHistory / selectExerciseIds / plateauIsImportant / plateauInsight /
//   confidenceInsight / volumeInsight / addAction / buildActions) and the output / input
//   types (TrainingIntelligenceSummary / Action / BuildTrainingIntelligenceSummaryParams).
//
// This slice CLOSES the analysis-engine layer: it is the top aggregator that consumes the
// already-ported AN-1~5 leaves and re-emits their results plus derived insights/actions.
// It is NOT wired into any UI (that is AN-7).
//
// Dependency boundary (AN-6 §, matches the slice contract) — every real call is to an
// ALREADY-PORTED engine; NOTHING is re-ported here:
//   * SessionQualityEngine.buildSessionQualityResult            (AN-4)
//   * RecommendationConfidenceEngine.buildRecommendationConfidence (AN-5b)
//   * PlateauDetectionEngine.detectExercisePlateau               (AN-2)
//   * VolumeAdaptationEngine.buildVolumeAdaptationReport + .formatMuscleName (AN-5b)
//   * E1RMEngine.filterAnalyticsHistory / .hasInvalidExerciseIdentity (iOS-17e / SR)
//   * ExerciseLibrary.formatExerciseDisplayName  (SR-1, the `formatExerciseName` shim:
//     `formatExerciseName(value, fallback = '未命名动作')` = `formatExerciseDisplayName(value,
//     { fallback })`, and `ExerciseLibrary.formatExerciseDisplayName` already defaults its
//     fallback to "未命名动作" — formatters.ts:492)
//
// Opaque-input fidelity: TS holds the optional external inputs (`effectiveSetSummary` /
// `loadFeedback` / `painPatterns` / `e1rmProfiles` / `weeklyVolumeSummary`) as runtime
// duck-typed values and hands the SAME reference to each sub-engine, which read DIFFERENT
// field subsets off them. The port mirrors this exactly: the Params carry the raw
// `JSONValue` / `[JSONValue]` and this engine converts to the precise typed subset each
// sub-engine's Swift Params demands at the call site (the SAME conversion the sub-engines'
// own parity tests use), never closing a static type the TS does not assert.
//
// PURE: consumes `history: [TrainingSession]` (a §11 clean input) + an optional latest
// session + optional external summaries; no IO, no clock (`zero : Date` — the only date
// reads are inside the reused `E1RMEngine.filterAnalyticsHistory`, which parses the
// session's OWN date strings, never the wall clock), no randomness.

import Foundation
import IronPathDomain

public enum TrainingIntelligenceSummaryEngine {

    // MARK: - Output types (trainingIntelligenceSummaryEngine.ts:27-66)

    /// `TrainingIntelligenceSummary['recommendedActions'][number]` (ts:33-44). `actionType`
    /// is kept as a raw String (the TS string-literal union: 'review_session' |
    /// 'review_exercise' | 'review_volume' | 'create_adjustment_preview' | 'keep_observing')
    /// — the engine only ever assigns those five literals and the golden round-trips the
    /// string verbatim (the SessionQualityResult.level precedent).
    public struct Action: Equatable, Sendable {
        public let id: String
        public let label: String
        public let reason: String
        public let actionType: String
        public let requiresConfirmation: Bool
        public init(id: String, label: String, reason: String, actionType: String, requiresConfirmation: Bool) {
            self.id = id
            self.label = label
            self.reason = reason
            self.actionType = actionType
            self.requiresConfirmation = requiresConfirmation
        }
    }

    /// `TrainingIntelligenceSummary` (ts:27). `sessionQuality` is omitted when the latest
    /// session is absent/non-normal (canonicalStringify then drops the key); the other three
    /// sub-results are always emitted (the return statement always assigns them, even when
    /// empty) — they are typed optional to mirror the TS interface.
    public struct TrainingIntelligenceSummary: Equatable, Sendable {
        public let sessionQuality: SessionQualityEngine.SessionQualityResult?
        public let recommendationConfidence: [RecommendationConfidenceEngine.RecommendationConfidenceResult]?
        public let plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]?
        public let volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport?
        public let keyInsights: [String]
        public let recommendedActions: [Action]
        public init(
            sessionQuality: SessionQualityEngine.SessionQualityResult?,
            recommendationConfidence: [RecommendationConfidenceEngine.RecommendationConfidenceResult]?,
            plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]?,
            volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport?,
            keyInsights: [String],
            recommendedActions: [Action]
        ) {
            self.sessionQuality = sessionQuality
            self.recommendationConfidence = recommendationConfidence
            self.plateauResults = plateauResults
            self.volumeAdaptation = volumeAdaptation
            self.keyInsights = keyInsights
            self.recommendedActions = recommendedActions
        }
    }

    // MARK: - Input params (trainingIntelligenceSummaryEngine.ts:55-64)

    /// `BuildTrainingIntelligenceSummaryParams` (ts:55). The opaque external inputs stay raw
    /// (`weeklyVolumeSummary` / `effectiveSetSummary` / `loadFeedback` as `JSONValue?`;
    /// `e1rmProfiles` as `[JSONValue]`; `painPatterns` as `[JSONValue]?`) — see the file
    /// header. `trainingLevel` (`AutoTrainingLevel | string | null`) is only ever passed
    /// through to the sub-engines (which `=== 'unknown'` / `=== 'beginner'` compare it), so
    /// it is kept as a raw `String?`.
    public struct Params {
        public let latestSession: TrainingSession?
        public let history: [TrainingSession]
        public let weeklyVolumeSummary: JSONValue?
        public let e1rmProfiles: [JSONValue]
        public let effectiveSetSummary: JSONValue?
        public let loadFeedback: JSONValue?
        public let painPatterns: [JSONValue]?
        public let trainingLevel: String?
        public init(
            latestSession: TrainingSession? = nil,
            history: [TrainingSession] = [],
            weeklyVolumeSummary: JSONValue? = nil,
            e1rmProfiles: [JSONValue] = [],
            effectiveSetSummary: JSONValue? = nil,
            loadFeedback: JSONValue? = nil,
            painPatterns: [JSONValue]? = nil,
            trainingLevel: String? = nil
        ) {
            self.latestSession = latestSession
            self.history = history
            self.weeklyVolumeSummary = weeklyVolumeSummary
            self.e1rmProfiles = e1rmProfiles
            self.effectiveSetSummary = effectiveSetSummary
            self.loadFeedback = loadFeedback
            self.painPatterns = painPatterns
            self.trainingLevel = trainingLevel
        }
    }

    // MARK: - Tiny helpers

    /// `unique` (ts:68): `[...new Set(items.filter(Boolean))]` — drops empty strings, dedups
    /// keeping first-occurrence order.
    private static func unique(_ items: [String]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for item in items where !item.isEmpty {
            if seen.insert(item).inserted { out.append(item) }
        }
        return out
    }

    /// `isNormalSession` (ts:70): `Boolean(session && dataFlag !== 'test' && dataFlag !==
    /// 'excluded')`. The `dataFlag` lives in the session open-bag (`_unknown`); an
    /// absent/`nil` flag is normal (`undefined !== 'test'`).
    private static func isNormalSession(_ session: TrainingSession?) -> Bool {
        guard let session else { return false }
        let dataFlag = session._unknown["dataFlag"]?.stringValue
        return dataFlag != "test" && dataFlag != "excluded"
    }

    /// `getExerciseIds` (ts:73): `hasInvalidExerciseIdentity(ex) ? [] : [canonical, base,
    /// actual, replacement, original, id].filter(Boolean).map(String)`. Order is meaningful
    /// — `selectExerciseIds` takes the FIRST id only (`.slice(0, 1)`). `baseId` /
    /// `canonicalExerciseId` / `replacementExerciseId` live in the open-bag; `actual` /
    /// `original` / `id` are typed fields. Reuses the ported `E1RMEngine.hasInvalidExerciseIdentity`.
    private static func getExerciseIds(_ exercise: ExercisePrescription) -> [String] {
        if E1RMEngine.hasInvalidExerciseIdentity(exercise) { return [] }
        let candidates: [String?] = [
            exercise._unknown["canonicalExerciseId"]?.stringValue,
            exercise._unknown["baseId"]?.stringValue,
            exercise.actualExerciseId,
            exercise._unknown["replacementExerciseId"]?.stringValue,
            exercise.originalExerciseId,
            exercise.id,
        ]
        return candidates.compactMap { $0 }.filter { !$0.isEmpty }
    }

    /// `exerciseLabelFromHistory` (ts:87): the display name of the FIRST session (latest, then
    /// history) carrying an exercise whose `getExerciseIds` includes `exerciseId`; else the id
    /// formatted directly. `formatExerciseName(exercise)` / `formatExerciseName(exerciseId)`
    /// → `ExerciseLibrary.formatExerciseDisplayName` over the exercise object (round-tripped
    /// via `.encoded()`) / the bare id string.
    private static func exerciseLabelFromHistory(
        _ exerciseId: String,
        _ latestSession: TrainingSession?,
        _ history: [TrainingSession]
    ) -> String {
        var sessions: [TrainingSession] = []
        if let latestSession { sessions.append(latestSession) } // [latestSession, ...].filter(Boolean)
        sessions.append(contentsOf: history)
        for session in sessions {
            if let exercise = (session.exercises ?? []).first(where: { getExerciseIds($0).contains(exerciseId) }) {
                return ExerciseLibrary.formatExerciseDisplayName(exercise.encoded())
            }
        }
        return ExerciseLibrary.formatExerciseDisplayName(.string(exerciseId))
    }

    /// `selectExerciseIds` (ts:96): up to 4 ids — each latest-session exercise's first id (only
    /// when the latest session is normal), then each e1rm profile's `exerciseId`, then the first
    /// id of every exercise in the first 3 analytics-history sessions. Deduped + capped at 4.
    private static func selectExerciseIds(
        _ latestSession: TrainingSession?,
        _ history: [TrainingSession],
        _ e1rmProfiles: [JSONValue]
    ) -> [String] {
        let fromLatest: [String] = isNormalSession(latestSession)
            ? (latestSession?.exercises ?? []).flatMap { Array(getExerciseIds($0).prefix(1)) }
            : []
        let fromProfiles: [String] = e1rmProfiles
            .compactMap { $0.objectValue?["exerciseId"]?.stringValue }
            .filter { !$0.isEmpty } // `.filter(Boolean)`
        let fromHistory: [String] = E1RMEngine.filterAnalyticsHistory(history)
            .prefix(3)
            .flatMap { session in
                (session.exercises ?? []).flatMap { Array(getExerciseIds($0).prefix(1)) }
            }
        return Array(unique(fromLatest + fromProfiles + fromHistory).prefix(4))
    }

    /// `plateauIsImportant` (ts:108): `status !== 'none' && status !== 'insufficient_data'`.
    private static func plateauIsImportant(_ status: PlateauDetectionEngine.PlateauStatus) -> Bool {
        status != PlateauDetectionEngine.PlateauStatus.none && status != .insufficientData
    }

    /// `plateauInsight` (ts:111). Non-important statuses (none / insufficient_data) → "".
    private static func plateauInsight(_ result: PlateauDetectionEngine.PlateauDetectionResult, _ label: String) -> String {
        switch result.status {
        case .plateau: return "\(label) 近期进展停滞，建议进入计划调整预览前重点复核。"
        case .possiblePlateau: return "\(label) 近期进展放缓，先继续观察并提高完成质量。"
        case .loadTooAggressive: return "\(label) 反馈偏重，下一次不宜急于加重。"
        case .techniqueLimited: return "\(label) 更受动作质量限制，先稳定动作再推进。"
        case .fatigueLimited: return "\(label) 有疲劳或不适记录，先降低风险再加量。"
        case .volumeLimited: return "\(label) 可能受有效训练量不足限制。"
        default: return ""
        }
    }

    /// `confidenceInsight` (ts:121). `high` → "".
    private static func confidenceInsight(_ result: RecommendationConfidenceEngine.RecommendationConfidenceResult, _ label: String) -> String {
        if result.level == .low { return "\(label) 的推荐可信度偏低，建议保守参考。" }
        if result.level == .medium { return "\(label) 的推荐可信度中等，继续补齐记录会更稳定。" }
        return ""
    }

    /// `volumeInsight` (ts:127): `const name = item.title.split('：')[0] || formatMuscleName(item.muscleId)`.
    /// `item.setsDelta || 1` — 0 / nil / undefined → 1 (JS falsy); a negative delta is truthy
    /// and kept. Reuses the ported `VolumeAdaptationEngine.formatMuscleName`.
    private static func volumeInsight(_ item: VolumeAdaptationEngine.MuscleVolumeAdaptation) -> String {
        let split = item.title.components(separatedBy: "：").first ?? ""
        let name = split.isEmpty ? VolumeAdaptationEngine.formatMuscleName(item.muscleId) : split
        let rawDelta = item.setsDelta ?? 0
        let delta = rawDelta != 0 ? rawDelta : 1 // `item.setsDelta || 1`
        switch item.decision {
        case .increase: return "\(name) 下周可小幅增加 \(delta) 组。"
        case .decrease: return "\(name) 下周建议减少 \(abs(delta)) 组，优先控制疲劳。"
        case .hold: return "\(name) 暂缓调整，先继续积累稳定记录。"
        default: return ""
        }
    }

    /// `addAction` (ts:135): append only if no existing action shares the id.
    private static func addAction(_ actions: inout [Action], _ action: Action) {
        if !actions.contains(where: { $0.id == action.id }) { actions.append(action) }
    }

    /// `buildActions` (ts:139). At most 4 actions; falls back to a single keep-observing
    /// action whose label depends on whether the latest session is normal.
    private static func buildActions(
        sessionQuality: SessionQualityEngine.SessionQualityResult?,
        plateauResults: [PlateauDetectionEngine.PlateauDetectionResult],
        volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport?,
        latestSession: TrainingSession?
    ) -> [Action] {
        var actions: [Action] = []

        if let sessionQuality, sessionQuality.level != "high", sessionQuality.level != "insufficient_data" {
            addAction(&actions, Action(
                id: "review-latest-session",
                label: "查看本次训练",
                reason: "最近一次训练质量还有可复核空间，建议先查看完成组、动作质量和不适标记。",
                actionType: "review_session",
                requiresConfirmation: false
            ))
        }

        if let importantPlateau = plateauResults.first(where: { plateauIsImportant($0.status) }) {
            addAction(&actions, Action(
                id: "review-exercise-\(importantPlateau.exerciseId)",
                label: "查看动作进展",
                reason: "有动作出现进展放缓或限制信号，建议先查看该动作历史。",
                actionType: "review_exercise",
                requiresConfirmation: false
            ))
        }

        if let volumeChange = volumeAdaptation?.muscles.first(where: { $0.decision == .increase || $0.decision == .decrease }) {
            addAction(&actions, Action(
                id: "review-volume-\(volumeChange.muscleId)",
                label: "查看训练量建议",
                reason: "有肌群训练量可能需要小幅调整，先查看原因和建议组数。",
                actionType: "review_volume",
                requiresConfirmation: false
            ))
            addAction(&actions, Action(
                id: "create-adjustment-preview",
                label: "生成计划调整预览",
                reason: "仅生成可确认的预览，不会自动修改当前计划。",
                actionType: "create_adjustment_preview",
                requiresConfirmation: true
            ))
        }

        if actions.isEmpty {
            addAction(&actions, Action(
                id: "keep-observing",
                label: isNormalSession(latestSession) ? "继续观察" : "继续记录训练",
                reason: "当前没有需要立即处理的高优先级信号，继续记录后判断会更稳定。",
                actionType: "keep_observing",
                requiresConfirmation: false
            ))
        }

        return Array(actions.prefix(4))
    }

    // MARK: - Opaque-input → typed-subset converters (call-site only; see file header)

    /// `Partial<EffectiveVolumeSummary>` subset the plateau / recommendation-confidence engines
    /// read off `effectiveSetSummary` — the SAME three-field decode their own parity tests use.
    private static func effectiveVolumeSummary(_ value: JSONValue?) -> PlateauDetectionEngine.EffectiveVolumeSummary? {
        guard let obj = value?.objectValue else { return nil }
        return PlateauDetectionEngine.EffectiveVolumeSummary(
            completedSets: obj.optionalDouble("completedSets"),
            effectiveSets: obj.optionalDouble("effectiveSets"),
            highConfidenceEffectiveSets: obj.optionalDouble("highConfidenceEffectiveSets")
        )
    }

    /// The `{ exerciseId, severityAvg }` subset the plateau engine reads off each pain pattern.
    private static func plateauPainPatterns(_ values: [JSONValue]?) -> [PlateauDetectionEngine.PainPattern]? {
        guard let values else { return nil }
        return values.map { value in
            let o = value.objectValue ?? OrderedJSONObject()
            return PlateauDetectionEngine.PainPattern(
                exerciseId: o.optionalString("exerciseId"),
                severityAvg: o.optionalDouble("severityAvg")
            )
        }
    }

    /// The full `PainPattern` shape the recommendation-confidence / volume-adaptation engines
    /// read — the SAME decode the VolumeAdaptationEngine parity test uses.
    private static func fullPainPatterns(_ values: [JSONValue]?) -> [PainPatternEngine.PainPattern]? {
        guard let values else { return nil }
        return values.map { value in
            let o = value.objectValue ?? OrderedJSONObject()
            return PainPatternEngine.PainPattern(
                area: o.optionalString("area") ?? "",
                exerciseId: o.optionalString("exerciseId"),
                frequency: o.optionalInt("frequency") ?? 0,
                severityAvg: o.optionalDouble("severityAvg") ?? 0,
                lastOccurredAt: o.optionalString("lastOccurredAt") ?? "",
                suggestedAction: PainPatternEngine.PainSuggestedAction(rawValue: o.optionalString("suggestedAction") ?? "") ?? .watch
            )
        }
    }

    /// `e1rmProfiles.find(p => p.exerciseId === exerciseId)` (ts:229 / ts:240): the raw profile
    /// JSONValue handed verbatim to the duck-typing sub-engines, or nil.
    private static func e1rmProfile(_ e1rmProfiles: [JSONValue], _ exerciseId: String) -> JSONValue? {
        e1rmProfiles.first { $0.objectValue?["exerciseId"]?.stringValue == exerciseId }
    }

    // MARK: - buildTrainingIntelligenceSummary (trainingIntelligenceSummaryEngine.ts:204)

    public static func buildTrainingIntelligenceSummary(_ params: Params) -> TrainingIntelligenceSummary {
        let analyticsHistory = E1RMEngine.filterAnalyticsHistory(params.history)
        let normalLatestSession = isNormalSession(params.latestSession) ? params.latestSession : nil
        let exerciseIds = selectExerciseIds(normalLatestSession, analyticsHistory, params.e1rmProfiles)

        let sessionQuality: SessionQualityEngine.SessionQualityResult?
        if let session = normalLatestSession {
            sessionQuality = SessionQualityEngine.buildSessionQualityResult(
                SessionQualityEngine.Params(
                    session: session,
                    effectiveSetSummary: params.effectiveSetSummary,
                    loadFeedback: params.loadFeedback,
                    painPatterns: params.painPatterns
                )
            )
        } else {
            sessionQuality = nil
        }

        // The typed subsets the duck-typing sub-engines demand (the SAME object TS hands each).
        let effectiveTyped = effectiveVolumeSummary(params.effectiveSetSummary)
        let plateauPain = plateauPainPatterns(params.painPatterns)
        let fullPain = fullPainPatterns(params.painPatterns)

        let recommendationConfidence = exerciseIds.map { exerciseId in
            RecommendationConfidenceEngine.buildRecommendationConfidence(
                RecommendationConfidenceEngine.Params(
                    exerciseId: exerciseId,
                    history: analyticsHistory,
                    e1rmProfile: e1rmProfile(params.e1rmProfiles, exerciseId),
                    effectiveSetSummary: effectiveTyped,
                    loadFeedback: params.loadFeedback,
                    techniqueQualitySummary: nil,
                    painPatterns: fullPain,
                    trainingLevel: params.trainingLevel,
                    recentEdits: nil
                )
            )
        }

        let plateauResults = exerciseIds.map { exerciseId in
            PlateauDetectionEngine.detectExercisePlateau(
                PlateauDetectionEngine.DetectExercisePlateauParams(
                    exerciseId: exerciseId,
                    history: analyticsHistory,
                    e1rmProfile: e1rmProfile(params.e1rmProfiles, exerciseId),
                    loadFeedback: params.loadFeedback,
                    effectiveSetSummary: effectiveTyped,
                    techniqueQualitySummary: nil,
                    painPatterns: plateauPain
                )
            )
        }

        let volumeAdaptation = VolumeAdaptationEngine.buildVolumeAdaptationReport(
            VolumeAdaptationEngine.Params(
                weeklyVolumeSummary: params.weeklyVolumeSummary,
                effectiveSetSummary: params.effectiveSetSummary,
                adherenceReport: nil,
                painPatterns: fullPain,
                loadFeedback: params.loadFeedback,
                sessionQualityResults: sessionQuality.map { [$0] } ?? [],
                trainingLevel: params.trainingLevel
            )
        )

        var insightCandidates: [String] = []

        if let sessionQuality {
            if sessionQuality.level == "high" {
                insightCandidates.append("最近一次训练质量较好，可以作为后续推荐参考。")
            } else if sessionQuality.level == "medium" {
                insightCandidates.append("最近一次训练质量中等，建议复核动作质量和余力（RIR）记录。")
            } else if sessionQuality.level == "low" {
                insightCandidates.append("最近一次训练质量偏低，下次建议先保证关键主训练完成度。")
            }
        }

        for result in plateauResults.filter({ plateauIsImportant($0.status) }).prefix(2) {
            insightCandidates.append(plateauInsight(result, exerciseLabelFromHistory(result.exerciseId, normalLatestSession, analyticsHistory)))
        }

        for item in volumeAdaptation.muscles.filter({ $0.decision == .increase || $0.decision == .decrease || $0.decision == .hold }).prefix(2) {
            insightCandidates.append(volumeInsight(item))
        }

        // `forEach((result, index) => exerciseIds[index] || '')` — `index` is the position in
        // the FILTERED+SLICED array (so always 0 here), matching the TS exactly.
        for (index, result) in recommendationConfidence.filter({ $0.level != .high }).prefix(1).enumerated() {
            let exerciseId = index < exerciseIds.count ? exerciseIds[index] : ""
            insightCandidates.append(confidenceInsight(result, exerciseLabelFromHistory(exerciseId, normalLatestSession, analyticsHistory)))
        }

        // `unique(...)` already drops empty strings, so the TS's extra `.filter(Boolean)` is a no-op.
        let keyInsights = Array(unique(insightCandidates).prefix(4))
        let finalInsights = keyInsights.isEmpty
            ? ["当前训练智能数据还在积累中，继续记录训练、余力（RIR）和动作质量后会更稳定。"]
            : keyInsights

        return TrainingIntelligenceSummary(
            sessionQuality: sessionQuality,
            recommendationConfidence: recommendationConfidence,
            plateauResults: plateauResults,
            volumeAdaptation: volumeAdaptation,
            keyInsights: finalInsights,
            recommendedActions: buildActions(
                sessionQuality: sessionQuality,
                plateauResults: plateauResults,
                volumeAdaptation: volumeAdaptation,
                latestSession: normalLatestSession
            )
        )
    }
}
