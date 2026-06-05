// CoachActionEngine — CC-2 coach-action track top-level aggregator.
//
// Faithful line-by-line Swift port of the PURE `src/engines/coachActionEngine.ts`
// (652 lines) — its three exported builders + every private helper + the public
// type family:
//   • buildCoachActionSourceFingerprint        (ts:138)
//   • buildCoachActionAdjustmentDraftInput      (ts:197)
//   • buildCoachActions                         (ts:624)
//   (+ the re-exported `buildCoachActionFingerprint` — already native as
//    `CoachActionIdentityEngine.buildCoachActionFingerprint` (PA-S5); NOT re-ported.)
//
// PURE / READ-ONLY: no write path, NOT wired into any UI, no randomness. The ONLY
// clock seams are (a) `now || new Date().toISOString()` (ts:637) — an INJECTED `now`
// (the wall-clock default is a DERIVED-only seam NOT ported; every fixture passes an
// explicit `now`, so it is never hit — golden-neutral, the PlanAdjustmentIdentityEngine
// precedent), and (b) `tomorrowIso` (ts:113) — `new Date(createdAt).setDate(getDate()+1)`,
// ported with PURE integer civil-calendar arithmetic (zero `: Date`, zero Calendar; see
// `tomorrowIso` below). Deterministic given its inputs.
//
// Dependency boundary (CC-2 dependency survey, §19.2) — EVERY import already native;
// this slice CONSUMES, never re-ports:
//   • formatMuscleName (formatters.ts:219)   → reuse `VolumeAdaptationEngine.formatMuscleName`
//     (AN-5b; the verbatim MUSCLE_LABELS string-path port). formatExerciseName's STRING
//     path (formatters.ts:492 → exerciseLibrary.ts:323 formatExerciseDisplayName) is a
//     2-line table lookup over `ExerciseLibrary.displayNames` (SR-1) + `hasChineseText`,
//     mirrored as the private `formatExerciseName` below (the only path the engine hits).
//   • enrichExercise / getPrimaryMuscles      → reuse `EngineUtils.*` (PA-S2). enrichExercise
//     runs the EMPTY override seam (PA-S2 boundary); every fixture template exercise uses an
//     id NOT in EXERCISE_KNOWLEDGE_OVERRIDES so `enrichExercise` lands on its default branch
//     (primaryMuscles=[muscle], secondaryMuscles=[]) — bit-identical to the TS default,
//     keeping the muscle-match parity exact (the CC-1 explicit-library deferral paradigm).
//   • sortDataHealthIssues + DataHealthIssue/Report → reuse `DataHealthEngine.*` /
//     `DataHealthIssue` / `DataHealthReport` (CC-0, IronPathDataHealth).
//   • buildCoachActionFingerprint + CoachActionFingerprintContext → reuse
//     `CoachActionIdentityEngine.*` (PA-S5).
//   • Domain types AppData / TrainingTemplate / ExerciseTemplate / WeeklyActionRecommendation
//     / EstimateConfidence / NumberRepr (IronPathDomain).
//   • TYPE-ONLY result inputs (consumed, engines NOT called): DailyTrainingAdjustment (CC-0) ·
//     SetAnomaly (CC-0) · NextWorkoutScheduler.NextWorkoutRecommendation (SC-C) ·
//     RecoveryAwareScheduler.RecoveryAwareRecommendation (SC-A) ·
//     SessionQualityEngine.SessionQualityResult (AN-4) ·
//     PlateauDetectionEngine.PlateauDetectionResult (AN-2) ·
//     RecommendationConfidenceEngine.RecommendationConfidenceResult (AN-5b) ·
//     VolumeAdaptationEngine.VolumeAdaptationReport / .MuscleVolumeAdaptation (AN-5b).
//   • Civil-calendar math → reuse `AnalyticsSupport.daysFromCivil / civilFromDays` (AN-1).
//
// `uniqueStrings` (ts:111) is DEAD in the TS source (defined, never called) — omitted
// (an unused const has no observable behaviour; the CC-1 `roundOne` precedent).
//
// Goldens are GENERATED from the REAL TS engine (scripts/generate-parity-goldens.mjs),
// never hand-edited (§22). The Swift CoachActionEngineParityTests re-run the SAME builders
// over each case's echoed input and COMPUTE-ASSERT the result == golden, case-by-case.

import Foundation
import IronPathDomain
import IronPathDataHealth

public enum CoachActionEngine {

    // MARK: - Output types (new — absent from Domain)

    /// `CoachAction` (coachActionEngine.ts:54). The string-union fields
    /// (`source` / `actionType` / `priority` / `status` / `targetType`) are carried as
    /// `String` (the `CoachActionIdentityEngine.FingerprintAction` precedent — String
    /// preserves any union member losslessly and the engine only string-compares them).
    /// `encoded()` mirrors the TS object literal: the optional fields
    /// (`expiresAt` / `targetId` / `targetType` / `confirmTitle` / `confirmDescription`)
    /// are OMITTED when nil exactly as `JSON.stringify` drops `undefined` keys;
    /// `sourceFingerprint` is always set by `makeAction` (ts:287) so it is always emitted.
    public struct CoachAction: Equatable, Sendable {
        public let id: String
        public let title: String
        public let description: String
        public let source: String
        public let actionType: String
        public let priority: String
        public let status: String
        public let requiresConfirmation: Bool
        public let reversible: Bool
        public let createdAt: String
        public let expiresAt: String?
        public let targetId: String?
        public let targetType: String?
        public let reason: String
        public let confirmTitle: String?
        public let confirmDescription: String?
        public let sourceFingerprint: String?

        public init(
            id: String, title: String, description: String, source: String,
            actionType: String, priority: String, status: String,
            requiresConfirmation: Bool, reversible: Bool, createdAt: String,
            expiresAt: String? = nil, targetId: String? = nil, targetType: String? = nil,
            reason: String, confirmTitle: String? = nil, confirmDescription: String? = nil,
            sourceFingerprint: String? = nil
        ) {
            self.id = id
            self.title = title
            self.description = description
            self.source = source
            self.actionType = actionType
            self.priority = priority
            self.status = status
            self.requiresConfirmation = requiresConfirmation
            self.reversible = reversible
            self.createdAt = createdAt
            self.expiresAt = expiresAt
            self.targetId = targetId
            self.targetType = targetType
            self.reason = reason
            self.confirmTitle = confirmTitle
            self.confirmDescription = confirmDescription
            self.sourceFingerprint = sourceFingerprint
        }

        /// Canonical JSON shape of the TS `CoachAction` object literal (undefined keys dropped).
        public func encoded() -> JSONValue {
            var e: [OrderedJSONObject.Entry] = []
            e.append(.init(key: "id", value: .string(id)))
            e.append(.init(key: "title", value: .string(title)))
            e.append(.init(key: "description", value: .string(description)))
            e.append(.init(key: "source", value: .string(source)))
            e.append(.init(key: "actionType", value: .string(actionType)))
            e.append(.init(key: "priority", value: .string(priority)))
            e.append(.init(key: "status", value: .string(status)))
            e.append(.init(key: "requiresConfirmation", value: .bool(requiresConfirmation)))
            e.append(.init(key: "reversible", value: .bool(reversible)))
            e.append(.init(key: "createdAt", value: .string(createdAt)))
            if let expiresAt { e.append(.init(key: "expiresAt", value: .string(expiresAt))) }
            if let targetId { e.append(.init(key: "targetId", value: .string(targetId))) }
            if let targetType { e.append(.init(key: "targetType", value: .string(targetType))) }
            e.append(.init(key: "reason", value: .string(reason)))
            if let confirmTitle { e.append(.init(key: "confirmTitle", value: .string(confirmTitle))) }
            if let confirmDescription { e.append(.init(key: "confirmDescription", value: .string(confirmDescription))) }
            if let sourceFingerprint { e.append(.init(key: "sourceFingerprint", value: .string(sourceFingerprint))) }
            return .object(OrderedJSONObject(entries: e))
        }
    }

    /// `CoachActionAdjustmentDraftInput` (coachActionEngine.ts:88) —
    /// `{ recommendation: WeeklyActionRecommendation; sourceTemplate: TrainingTemplate }`.
    public struct CoachActionAdjustmentDraftInput: Equatable, Sendable {
        public let recommendation: WeeklyActionRecommendation
        public let sourceTemplate: TrainingTemplate
        public init(recommendation: WeeklyActionRecommendation, sourceTemplate: TrainingTemplate) {
            self.recommendation = recommendation
            self.sourceTemplate = sourceTemplate
        }

        public func encoded() -> JSONValue {
            .object(OrderedJSONObject(entries: [
                .init(key: "recommendation", value: recommendation.encoded()),
                .init(key: "sourceTemplate", value: sourceTemplate.encoded()),
            ]))
        }
    }

    // MARK: - Input types

    /// The `recommendationConfidence?` union (coachActionEngine.ts:82):
    /// `RecommendationConfidenceResult | RecommendationConfidenceResult[] | null`.
    /// `recommendationConfidenceActions` (ts:556) normalises `.single → [single]`,
    /// `.list → list`, `nil → []`.
    public enum RecommendationConfidenceInput: Sendable {
        case single(RecommendationConfidenceEngine.RecommendationConfidenceResult)
        case list([RecommendationConfidenceEngine.RecommendationConfidenceResult])
    }

    /// `BuildCoachActionsInput` (coachActionEngine.ts:74). Every result-type field reuses
    /// the already-native engine output type (consumed, never re-ported).
    public struct BuildCoachActionsInput {
        public let appData: AppData
        public let dailyAdjustment: DailyTrainingAdjustment?
        public let nextWorkout: NextWorkoutScheduler.NextWorkoutRecommendation?
        public let dataHealthReport: DataHealthReport?
        public let sessionQuality: SessionQualityEngine.SessionQualityResult?
        public let plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]?
        public let volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport?
        public let recommendationConfidence: RecommendationConfidenceInput?
        public let setAnomalies: [SetAnomaly]?
        public let recoveryRecommendation: RecoveryAwareScheduler.RecoveryAwareRecommendation?
        public let now: String?

        public init(
            appData: AppData,
            dailyAdjustment: DailyTrainingAdjustment? = nil,
            nextWorkout: NextWorkoutScheduler.NextWorkoutRecommendation? = nil,
            dataHealthReport: DataHealthReport? = nil,
            sessionQuality: SessionQualityEngine.SessionQualityResult? = nil,
            plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]? = nil,
            volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport? = nil,
            recommendationConfidence: RecommendationConfidenceInput? = nil,
            setAnomalies: [SetAnomaly]? = nil,
            recoveryRecommendation: RecoveryAwareScheduler.RecoveryAwareRecommendation? = nil,
            now: String? = nil
        ) {
            self.appData = appData
            self.dailyAdjustment = dailyAdjustment
            self.nextWorkout = nextWorkout
            self.dataHealthReport = dataHealthReport
            self.sessionQuality = sessionQuality
            self.plateauResults = plateauResults
            self.volumeAdaptation = volumeAdaptation
            self.recommendationConfidence = recommendationConfidence
            self.setAnomalies = setAnomalies
            self.recoveryRecommendation = recoveryRecommendation
            self.now = now
        }
    }

    /// The `buildCoachActionAdjustmentDraftInput` `context` param (coachActionEngine.ts:199).
    public struct AdjustmentDraftContext {
        public let templates: [TrainingTemplate]?
        public let volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport?
        public let plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]?
        public init(
            templates: [TrainingTemplate]? = nil,
            volumeAdaptation: VolumeAdaptationEngine.VolumeAdaptationReport? = nil,
            plateauResults: [PlateauDetectionEngine.PlateauDetectionResult]? = nil
        ) {
            self.templates = templates
            self.volumeAdaptation = volumeAdaptation
            self.plateauResults = plateauResults
        }
    }

    // MARK: - private constants

    /// `priorityRank` (coachActionEngine.ts:93) — urgent 4 > high 3 > medium 2 > low 1.
    private static let priorityRank: [String: Int] = [
        "urgent": 4,
        "high": 3,
        "medium": 2,
        "low": 1,
    ]

    /// `rawVisibleTokenPattern` (coachActionEngine.ts:100) — the `\b(...)\b` raw-signal-token
    /// strip, global + case-insensitive. JS `\b` is an ASCII word boundary (`\w` = [A-Za-z0-9_]),
    /// whereas an ICU bare `\b` treats CJK as word characters; reproduced EXACTLY with explicit
    /// ASCII look-around assertions so CJK-adjacent matches behave identically. Alternation order
    /// is preserved verbatim (longest-first, e.g. `possible_plateau` before `plateau`).
    private static let rawVisibleTokenPattern =
        "(?<![A-Za-z0-9_])(undefined|null|normal|conservative|deload_like|main_only|reduce_support|substitute_risky_exercises|rest_or_recovery|possible_plateau|plateau|fatigue_limited|technique_limited|volume_limited|load_too_aggressive|insufficient_data|increase|maintain|decrease|hold|low|medium|high|urgent|pending|applied|dismissed|expired|failed)(?![A-Za-z0-9_])"

    /// `muscleAliases` lookup table (coachActionEngine.ts:156-168).
    private static let muscleAliasMap: [String: [String]] = [
        "back": ["背", "背部"],
        "chest": ["胸", "胸部"],
        "shoulders": ["肩", "肩部"],
        "biceps": ["手臂", "肱二头"],
        "triceps": ["手臂", "肱三头"],
        "arms": ["手臂", "肱二头", "肱三头"],
        "quads": ["腿", "股四头"],
        "hamstrings": ["腿", "腿后侧"],
        "glutes": ["腿", "臀"],
        "calves": ["腿", "小腿"],
        "legs": ["腿", "股四头", "腿后侧", "小腿", "臀"],
    ]

    // MARK: - cleanVisibleText (coachActionEngine.ts:103-109)

    /// `String(value ?? '').replace(rawVisibleTokenPattern, '').replace(/\s+/g, ' ').trim() || fallback`.
    private static func cleanVisibleText(_ value: String?, _ fallback: String) -> String {
        var text = value ?? ""                                              // String(value ?? '')
        text = regexReplaceAll(text, rawVisibleTokenPattern, "", caseInsensitive: true) // .replace(pattern, '')
        text = regexReplaceAll(text, "\\s+", " ")                           // .replace(/\s+/g, ' ')
        text = text.trimmingCharacters(in: .whitespacesAndNewlines)         // .trim()
        return text.isEmpty ? fallback : text                              // || fallback
    }

    // MARK: - tomorrowIso (coachActionEngine.ts:113-118)

    /// ```
    /// const date = new Date(createdAt);
    /// if (Number.isNaN(date.getTime())) return undefined;
    /// date.setDate(date.getDate() + 1);
    /// return date.toISOString();
    /// ```
    /// `setDate(getDate()+1)` advances one *local* calendar day preserving the local time-of-day.
    /// The goldens are generated/checked under `TZ=America/New_York` with the FIXED western
    /// civil-offset degradation already established by `TrainingCalendarEngine.toLocalDateKey`
    /// (a constant EST/EDT offset, DST-invariant fixtures): under a constant offset, "+1 local
    /// day" preserving local time-of-day is exactly +86_400_000 ms UTC (the offset cancels on
    /// the round-trip). So this PURE port parses the instant, adds one UTC day, and re-emits
    /// `toISOString()` — zero `: Date`, zero Calendar. NaN parse → nil (TS `undefined`).
    private static func tomorrowIso(_ createdAt: String) -> String? {
        guard let ms = parseIsoMs(createdAt) else { return nil } // new Date NaN → undefined
        return isoStringFromMs(ms + 86_400_000)
    }

    // MARK: - activeSessionInProgress (coachActionEngine.ts:120)

    /// `Boolean(appData.activeSession && appData.activeSession.completed !== true)`.
    /// Read straight off the `AppData.root` open bag (the typed `appData.activeSession`
    /// accessor would `try? TrainingSession(decoding:)` and could drop a malformed-but-truthy
    /// object — the TS reads the raw value's truthiness, never decoding it).
    private static func activeSessionInProgress(_ appData: AppData) -> Bool {
        guard let value = appData.root["activeSession"], jsTruthy(value) else { return false }
        // `.completed !== true` — anything other than the boolean literal `true` passes.
        return value.objectValue?["completed"] != JSONValue.bool(true)
    }

    // MARK: - priority / confidence mapping (coachActionEngine.ts:122-132)

    /// `priorityToWeeklyPriority` (ts:122) → WeeklyActionRecommendation['priority'].
    private static func priorityToWeeklyPriority(_ priority: String) -> String {
        if priority == "urgent" || priority == "high" { return "high" }
        if priority == "medium" { return "medium" }
        return "low"
    }

    /// `confidenceFromActionPriority` (ts:128) → WeeklyActionRecommendation['confidence'].
    private static func confidenceFromActionPriority(_ priority: String) -> String {
        if priority == "urgent" || priority == "high" { return "high" }
        if priority == "medium" { return "medium" }
        return "low"
    }

    // MARK: - normalizeText (coachActionEngine.ts:134)

    /// `String(value || '').trim().toLowerCase()`.
    private static func normalizeText(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - buildCoachActionSourceFingerprint (coachActionEngine.ts:138-151)

    /// Public re-export wrapper. The TS param is a structural `Pick<CoachAction, …> &
    /// Partial<…>`; a full `CoachAction` is a superset, so it is accepted here. Builds the
    /// 7-field `FingerprintAction` with the `title || '' / description || '' / reason || ''`
    /// empty-string fallbacks (ts:144-148) and delegates to the PA-S5 fingerprint.
    public static func buildCoachActionSourceFingerprint(
        _ action: CoachAction,
        _ options: CoachActionIdentityEngine.CoachActionFingerprintContext = CoachActionIdentityEngine.CoachActionFingerprintContext()
    ) -> String {
        CoachActionIdentityEngine.buildCoachActionFingerprint(
            CoachActionIdentityEngine.FingerprintAction(
                source: action.source,
                actionType: action.actionType,
                targetType: action.targetType,
                targetId: action.targetId,
                title: nonEmpty(action.title) ?? "",        // action.title || ''
                description: nonEmpty(action.description) ?? "", // action.description || ''
                reason: nonEmpty(action.reason) ?? ""        // action.reason || ''
            ),
            options
        )
    }

    // MARK: - muscle matching (coachActionEngine.ts:153-195)

    /// `muscleAliases` (ts:153-170).
    private static func muscleAliases(_ muscleId: String?) -> [String] {
        let id = normalizeText(muscleId)                                  // normalizeText(muscleId)
        let label = VolumeAdaptationEngine.formatMuscleName(nonEmpty(muscleId) ?? "") // formatMuscleName(muscleId || '')
        var raw: [String] = [id, label]
        raw += (muscleAliasMap[id] ?? [])                                 // ...(aliases[id] || [])
        let filtered = raw.filter { !$0.isEmpty }                         // .filter(Boolean)
        return orderedUnique(filtered.map { normalizeText($0) })          // .map(normalizeText) → new Set
    }

    /// `exerciseMatchesMuscle` (ts:172-182).
    private static func exerciseMatchesMuscle(_ exercise: ExerciseTemplate, _ muscleId: String?) -> Bool {
        let aliases = muscleAliases(muscleId)
        if aliases.isEmpty { return false }                              // if (!aliases.length) return false
        let enriched = EngineUtils.enrichExercise(exercise)              // enrichExercise(exercise)
        var muscles: [String] = [normalizeText(exercise.muscle)]        // exercise.muscle
        muscles += EngineUtils.getPrimaryMuscles(enriched).map { normalizeText($0) } // ...getPrimaryMuscles(enriched)
        muscles += (enriched.secondaryMuscles ?? []).map { normalizeText($0) }       // ...(enriched.secondaryMuscles || [])
        return muscles.contains { muscle in
            aliases.contains { alias in
                // muscle === alias || muscle.includes(alias) || alias.includes(muscle)
                muscle == alias || jsIncludes(muscle, alias) || jsIncludes(alias, muscle)
            }
        }
    }

    /// `findTemplateByExercise` (ts:184-187).
    private static func findTemplateByExercise(_ templates: [TrainingTemplate], _ exerciseId: String?) -> TrainingTemplate? {
        guard let exerciseId, !exerciseId.isEmpty else { return nil }    // if (!exerciseId) return undefined
        return templates.first { template in
            (template.exercises ?? []).contains { $0.id == exerciseId || $0.baseId == exerciseId }
        }
    }

    /// `findTemplateByMuscle` (ts:189-192).
    private static func findTemplateByMuscle(_ templates: [TrainingTemplate], _ muscleId: String?) -> TrainingTemplate? {
        guard let muscleId, !muscleId.isEmpty else { return nil }        // if (!muscleId) return undefined
        return templates.first { template in
            (template.exercises ?? []).contains { exerciseMatchesMuscle($0, muscleId) }
        }
    }

    /// `firstExerciseForMuscle` (ts:194-195):
    /// `template.exercises.find(...) || template.exercises[0]`.
    private static func firstExerciseForMuscle(_ template: TrainingTemplate, _ muscleId: String?) -> ExerciseTemplate? {
        let exercises = template.exercises ?? []
        return exercises.first { exerciseMatchesMuscle($0, muscleId) } ?? exercises.first
    }

    // MARK: - buildCoachActionAdjustmentDraftInput (coachActionEngine.ts:197-266)

    public static func buildCoachActionAdjustmentDraftInput(
        _ action: CoachAction,
        _ context: AdjustmentDraftContext = AdjustmentDraftContext()
    ) -> CoachActionAdjustmentDraftInput? {
        // if (!action || action.actionType !== 'create_plan_adjustment_preview') return null
        if action.actionType != "create_plan_adjustment_preview" { return nil }
        let templates = context.templates ?? []                          // context.templates || []
        // if (!templates.length || !action.targetId) return null
        guard !templates.isEmpty, let targetId = nonEmpty(action.targetId) else { return nil }

        if action.targetType == "muscle" {
            let volumeItem = context.volumeAdaptation?.muscles.first { $0.muscleId == targetId }
            // const setsDelta = volumeItem?.setsDelta; if (!setsDelta) return null
            guard let setsDelta = volumeItem?.setsDelta, setsDelta != 0 else { return nil }
            guard let sourceTemplate = findTemplateByMuscle(templates, targetId) else { return nil }
            guard let exercise = firstExerciseForMuscle(sourceTemplate, targetId) else { return nil }
            let targetLabel = VolumeAdaptationEngine.formatMuscleName(targetId) // formatMuscleName(action.targetId)
            let recommendation = WeeklyActionRecommendation(
                id: "coach-action-\(action.id)",
                priority: priorityToWeeklyPriority(action.priority),
                category: "volume",
                targetType: "muscle",
                targetId: targetId,
                targetLabel: targetLabel,
                // action.description || `${targetLabel}训练量需要复查`
                issue: jsOr([nonEmpty(action.description)], "\(targetLabel)训练量需要复查"),
                // action.reason || action.description || `${targetLabel}训练量建议进入计划调整草案。`
                recommendation: jsOr([nonEmpty(action.reason), nonEmpty(action.description)], "\(targetLabel)训练量建议进入计划调整草案。"),
                // action.reason || volumeItem.reason || action.description
                reason: jsOrLast([nonEmpty(action.reason), volumeItem?.reason, nonEmpty(action.description)]),
                suggestedChange: suggestedChangeValue(
                    muscleId: targetId,
                    setsDelta: setsDelta,
                    exerciseIds: [exercise.id ?? ""]
                ),
                // volumeItem?.confidence || confidenceFromActionPriority(action.priority)
                confidence: estimateConfidence(jsOr([volumeItem?.confidence], confidenceFromActionPriority(action.priority)))
            )
            return CoachActionAdjustmentDraftInput(recommendation: recommendation, sourceTemplate: sourceTemplate)
        }

        if action.targetType == "exercise" {
            guard let sourceTemplate = findTemplateByExercise(templates, targetId) else { return nil }
            let plateau = context.plateauResults?.first { $0.exerciseId == targetId }
            let recommendation = WeeklyActionRecommendation(
                id: "coach-action-\(action.id)",
                priority: priorityToWeeklyPriority(action.priority),
                category: "exercise_selection",
                targetType: "exercise",
                targetId: targetId,
                targetLabel: formatExerciseName(targetId),               // formatExerciseName(action.targetId)
                // action.description || '动作进展需要复查'
                issue: jsOr([nonEmpty(action.description)], "动作进展需要复查"),
                // action.reason || plateau?.suggestedActions?.[0] || '生成动作调整草案，应用前由用户确认。'
                recommendation: jsOr([nonEmpty(action.reason), plateau?.suggestedActions.first], "生成动作调整草案，应用前由用户确认。"),
                // action.reason || plateau?.summary || action.description
                reason: jsOrLast([nonEmpty(action.reason), plateau?.summary, nonEmpty(action.description)]),
                suggestedChange: suggestedChangeValue(setsDelta: -1, exerciseIds: [targetId]),
                // plateau?.confidence || confidenceFromActionPriority(action.priority)
                confidence: estimateConfidence(jsOr([plateau?.confidence], confidenceFromActionPriority(action.priority)))
            )
            return CoachActionAdjustmentDraftInput(recommendation: recommendation, sourceTemplate: sourceTemplate)
        }

        return nil
    }

    // MARK: - makeAction (coachActionEngine.ts:268-289)

    /// Builds a `CoachAction`, cleaning the three visible-text fields and resolving the
    /// `sourceFingerprint` (the explicit `input.sourceFingerprint`, else
    /// `buildCoachActionFingerprint(action)` over the CLEANED title/description/reason +
    /// source/actionType/targetType/targetId — ts:287).
    private static func makeAction(
        id: String,
        source: String,
        actionType: String,
        priority: String,
        status: String? = nil,
        requiresConfirmation: Bool,
        reversible: Bool,
        createdAt: String,
        expiresAt: String? = nil,
        targetId: String? = nil,
        targetType: String? = nil,
        title: String?,
        description: String?,
        reason: String?,
        confirmTitle: String? = nil,
        confirmDescription: String? = nil,
        sourceFingerprint: String? = nil
    ) -> CoachAction {
        let cleanTitle = cleanVisibleText(title, "教练建议")
        let cleanDescription = cleanVisibleText(description, "请先查看详情，再决定是否采用。")
        let cleanReason = cleanVisibleText(reason, "当前建议来自训练记录和状态信号。")
        let resolvedStatus = nonEmpty(status) ?? "pending"               // input.status || 'pending'
        // input.sourceFingerprint || buildCoachActionFingerprint(action)
        let fingerprint = nonEmpty(sourceFingerprint) ?? CoachActionIdentityEngine.buildCoachActionFingerprint(
            CoachActionIdentityEngine.FingerprintAction(
                source: source,
                actionType: actionType,
                targetType: targetType,
                targetId: targetId,
                title: cleanTitle,
                description: cleanDescription,
                reason: cleanReason
            )
        )
        return CoachAction(
            id: id, title: cleanTitle, description: cleanDescription, source: source,
            actionType: actionType, priority: priority, status: resolvedStatus,
            requiresConfirmation: requiresConfirmation, reversible: reversible, createdAt: createdAt,
            expiresAt: expiresAt, targetId: targetId, targetType: targetType, reason: cleanReason,
            confirmTitle: confirmTitle, confirmDescription: confirmDescription, sourceFingerprint: fingerprint
        )
    }

    // MARK: - dataHealth actions (coachActionEngine.ts:291-326)

    /// `dataHealthPriority` (ts:291-296).
    private static func dataHealthPriority(_ issue: DataHealthIssue?) -> String {
        guard let issue else { return "medium" }
        if issue.severity == .error { return "urgent" }
        if issue.severity == .warning { return "high" }
        return "medium"
    }

    /// `dataHealthTargetType` (ts:298-304).
    private static func dataHealthTargetType(_ issue: DataHealthIssue?) -> String {
        guard let issue else { return "dataHealth" }
        if issue.category == .healthData { return "healthData" }
        if issue.category == .template { return "plan" }
        if issue.category == .history || issue.category == .summary || issue.category == .analytics || issue.category == .replacement {
            return "session"
        }
        return "dataHealth"
    }

    /// `dataHealthActions` (ts:306-326).
    private static func dataHealthActions(_ report: DataHealthReport?, _ createdAt: String) -> [CoachAction] {
        // if (!report || report.status === 'healthy') return []
        guard let report, report.status != .healthy else { return [] }
        return Array(DataHealthEngine.sortDataHealthIssues(report.issues).prefix(3)).map { issue in
            makeAction(
                id: "data-health-\(issue.id)",
                source: "dataHealth",
                actionType: "open_data_health",
                priority: dataHealthPriority(issue),
                requiresConfirmation: false,
                reversible: false,
                createdAt: createdAt,
                targetId: issue.affectedIds?.first,                      // issue.affectedIds?.[0]
                targetType: dataHealthTargetType(issue),
                title: issue.severity == .error ? "优先检查数据健康" : "复查数据健康提醒",
                description: issue.title,
                reason: jsOr([nonEmpty(issue.message)], report.summary)  // issue.message || report.summary
            )
        }
    }

    // MARK: - dailyAdjustment action (coachActionEngine.ts:328-390)

    /// `dailyAdjustmentTypeLabel` (ts:328-345).
    private static func dailyAdjustmentTypeLabel(_ type: DailyTrainingAdjustmentType) -> String {
        switch type {
        case .conservative: return "保守训练"
        case .deloadLike: return "接近减量"
        case .mainOnly: return "只做主训练"
        case .reduceSupport: return "减少辅助"
        case .substituteRiskyExercises: return "替代风险动作"
        case .restOrRecovery: return "恢复或低负荷"
        case .normal: return "照常训练"
        }
    }

    /// `dailyAdjustmentSummary` (ts:347-364).
    private static func dailyAdjustmentSummary(_ type: DailyTrainingAdjustmentType) -> String {
        switch type {
        case .conservative: return "今天建议保守训练，不主动加量。"
        case .deloadLike: return "今天建议明显降低训练压力。"
        case .mainOnly: return "今天只完成主训练，跳过非必要内容。"
        case .reduceSupport: return "今天保留主训练，减少辅助动作。"
        case .substituteRiskyExercises: return "今天建议替换风险动作。"
        case .restOrRecovery: return "今天更适合恢复或低负荷训练。"
        case .normal: return "今天按计划训练即可。"
        }
    }

    /// `dailyAdjustmentAction` (ts:366-390).
    private static func dailyAdjustmentAction(_ adjustment: DailyTrainingAdjustment?, _ createdAt: String) -> CoachAction? {
        // if (!adjustment || adjustment.type === 'normal') return undefined
        guard let adjustment, adjustment.type != .normal else { return nil }
        let priority = (adjustment.type == .restOrRecovery || adjustment.type == .substituteRiskyExercises) ? "high" : "medium"
        let summary = dailyAdjustmentSummary(adjustment.type)
        return makeAction(
            id: "daily-adjustment-\(adjustment.type.rawValue)",
            source: "dailyAdjustment",
            actionType: "apply_temporary_session_adjustment",
            priority: priority,
            status: "pending",
            requiresConfirmation: true,
            reversible: true,
            createdAt: createdAt,
            expiresAt: tomorrowIso(createdAt),
            targetType: "session",
            title: "今日自动调整：\(dailyAdjustmentTypeLabel(adjustment.type))",
            description: summary,
            reason: jsOr([nonEmpty(adjustment.reasons.first)], summary), // adjustment.reasons?.[0] || summary
            confirmTitle: "采用本次临时调整？",
            confirmDescription: "只影响本次训练，不会修改原训练模板或长期计划。"
        )
    }

    // MARK: - nextWorkout action (coachActionEngine.ts:392-410)

    private static func nextWorkoutAction(_ nextWorkout: NextWorkoutScheduler.NextWorkoutRecommendation?, _ createdAt: String) -> CoachAction? {
        // if (!nextWorkout?.templateId) return undefined
        guard let nextWorkout, let templateId = nonEmpty(nextWorkout.templateId) else { return nil }
        let priority = nextWorkout.warnings.isEmpty ? "low" : "medium"   // nextWorkout.warnings?.length ? 'medium' : 'low'
        return makeAction(
            id: "next-workout-\(templateId)",
            source: "nextWorkout",
            actionType: "open_next_workout",
            priority: priority,
            requiresConfirmation: false,
            reversible: false,
            createdAt: createdAt,
            expiresAt: tomorrowIso(createdAt),
            targetId: templateId,
            targetType: "template",
            title: "查看下次训练：\(nextWorkout.templateName)",
            // nextWorkout.warnings?.[0] || '打开下次训练建议详情，确认后再开始。'
            description: jsOr([nextWorkout.warnings.first], "打开下次训练建议详情，确认后再开始。"),
            reason: nextWorkout.reason
        )
    }

    // MARK: - recovery action (coachActionEngine.ts:412-432)

    private static func recoveryAction(_ recommendation: RecoveryAwareScheduler.RecoveryAwareRecommendation?, _ createdAt: String) -> CoachAction? {
        // if (!recommendation || recommendation.kind === 'train' || !recommendation.requiresConfirmationToOverride) return undefined
        guard let recommendation, recommendation.kind != .train, recommendation.requiresConfirmationToOverride else { return nil }
        let modified = recommendation.kind == .modifiedTrain
        return makeAction(
            id: "recovery-\(recommendation.kind.rawValue)-\(nonEmpty(recommendation.templateId) ?? "day")", // templateId || 'day'
            source: "recovery",
            actionType: modified ? "apply_temporary_session_adjustment" : "keep_observing",
            priority: (recommendation.kind == .rest || recommendation.kind == .activeRecovery) ? "high" : "medium",
            requiresConfirmation: modified,
            reversible: modified,
            createdAt: createdAt,
            expiresAt: tomorrowIso(createdAt),
            targetId: recommendation.templateId,
            targetType: nonEmpty(recommendation.templateId) != nil ? "template" : "session", // templateId ? 'template' : 'session'
            title: modified ? "采用恢复保守版" : "查看恢复建议",
            description: recommendation.summary,
            reason: jsOr([nonEmpty(recommendation.reasons.first)], recommendation.summary), // reasons?.[0] || summary
            confirmTitle: modified ? "采用本次保守训练？" : nil,
            confirmDescription: modified ? "只影响本次训练，不会修改原模板。" : nil
        )
    }

    // MARK: - sessionQuality action (coachActionEngine.ts:434-449)

    private static func sessionQualityAction(_ quality: SessionQualityEngine.SessionQualityResult?, _ createdAt: String) -> CoachAction? {
        // if (!quality || quality.level === 'high' || quality.level === 'insufficient_data') return undefined
        guard let quality, quality.level != "high", quality.level != "insufficient_data" else { return nil }
        return makeAction(
            id: "session-quality-\(quality.level)",
            source: "sessionQuality",
            actionType: "review_session",
            priority: quality.level == "low" ? "medium" : "low",
            requiresConfirmation: false,
            reversible: false,
            createdAt: createdAt,
            targetType: "session",
            title: quality.level == "low" ? "复查本次训练质量" : "查看训练质量提示",
            description: quality.summary,
            // quality.issues?.[0]?.reason || quality.nextSuggestions?.[0] || quality.summary
            reason: jsOrLast([quality.issues.first?.reason, quality.nextSuggestions.first, quality.summary])
        )
    }

    // MARK: - plateau actions (coachActionEngine.ts:451-497)

    /// `plateauActionType` (ts:451-452).
    private static func plateauActionType(_ result: PlateauDetectionEngine.PlateauDetectionResult) -> String {
        (result.status == .plateau && result.confidence != "low") ? "create_plan_adjustment_preview" : "review_exercise"
    }

    /// `plateauPriority` (ts:454-458).
    private static func plateauPriority(_ result: PlateauDetectionEngine.PlateauDetectionResult) -> String {
        if result.status == .plateau || result.status == .loadTooAggressive { return "medium" }
        if result.status == .possiblePlateau || result.status == .techniqueLimited
            || result.status == .fatigueLimited || result.status == .volumeLimited { return "medium" }
        return "low"
    }

    /// `plateauActions` (ts:460-497).
    private static func plateauActions(_ results: [PlateauDetectionEngine.PlateauDetectionResult]?, _ createdAt: String, _ templates: [TrainingTemplate]) -> [CoachAction] {
        let filtered = (results ?? []).filter { $0.status != .none && $0.status != .insufficientData }
        return Array(filtered.prefix(3)).map { result in
            let actionType = plateauActionType(result)
            let sourceTemplate = findTemplateByExercise(templates, result.exerciseId)
            let title = actionType == "create_plan_adjustment_preview" ? "生成动作调整预览" : "查看动作进展"
            // actionSeed (ts:467-475) — fingerprint is over the RAW seed, NOT makeAction's cleaned text.
            let seed = CoachActionIdentityEngine.FingerprintAction(
                source: "plateau",
                actionType: actionType,
                targetType: "exercise",
                targetId: result.exerciseId,
                title: title,
                description: result.title,
                // result.summary || result.signals?.[0]?.reason || result.suggestedActions?.[0] || ''
                reason: jsOr([nonEmpty(result.summary), result.signals.first?.reason, result.suggestedActions.first], "")
            )
            let fingerprint = CoachActionIdentityEngine.buildCoachActionFingerprint(
                seed,
                CoachActionIdentityEngine.CoachActionFingerprintContext(
                    sourceTemplateId: sourceTemplate?.id,
                    suggestedChangeType: "remove_sets",
                    exerciseId: result.exerciseId
                )
            )
            return makeAction(
                id: "plateau-\(result.exerciseId)-\(result.status.rawValue)",
                source: "plateau",
                actionType: actionType,
                priority: plateauPriority(result),
                requiresConfirmation: actionType == "create_plan_adjustment_preview",
                reversible: actionType == "create_plan_adjustment_preview",
                createdAt: createdAt,
                targetId: result.exerciseId,
                targetType: "exercise",
                title: title,
                description: result.title,
                // result.summary || result.signals?.[0]?.reason || result.suggestedActions?.[0]
                reason: jsOrLast([nonEmpty(result.summary), result.signals.first?.reason, result.suggestedActions.first]),
                confirmTitle: actionType == "create_plan_adjustment_preview" ? "生成计划调整预览？" : nil,
                confirmDescription: actionType == "create_plan_adjustment_preview" ? "只生成预览，不会直接修改正式计划。" : nil,
                sourceFingerprint: fingerprint
            )
        }
    }

    // MARK: - volume actions (coachActionEngine.ts:499-554)

    /// `shouldCreateVolumePreview` (ts:499-500).
    private static func shouldCreateVolumePreview(_ item: VolumeAdaptationEngine.MuscleVolumeAdaptation) -> Bool {
        item.decision == .increase || item.decision == .decrease
    }

    /// `volumeActions` (ts:502-554).
    private static func volumeActions(_ report: VolumeAdaptationEngine.VolumeAdaptationReport?, _ createdAt: String, _ templates: [TrainingTemplate]) -> [CoachAction] {
        // const target = (report?.muscles || []).find(shouldCreateVolumePreview); if (!target) return []
        guard let target = (report?.muscles ?? []).first(where: shouldCreateVolumePreview) else { return [] }
        let sourceTemplate = findTemplateByMuscle(templates, target.muscleId)
        // previewActionSeed (ts:506-514)
        let previewSeed = CoachActionIdentityEngine.FingerprintAction(
            source: "volumeAdaptation",
            actionType: "create_plan_adjustment_preview",
            targetType: "muscle",
            targetId: target.muscleId,
            title: "生成训练量调整预览",
            description: target.title,
            // target.reason || report?.summary || ''
            reason: jsOr([nonEmpty(target.reason), report?.summary], "")
        )
        let previewFingerprint = CoachActionIdentityEngine.buildCoachActionFingerprint(
            previewSeed,
            CoachActionIdentityEngine.CoachActionFingerprintContext(
                sourceTemplateId: sourceTemplate?.id,
                suggestedChange: CoachActionIdentityEngine.SuggestedChange(
                    muscleId: target.muscleId,
                    setsDelta: target.setsDelta.map { NumberRepr.integer(Int64($0)) }
                )
            )
        )
        return [
            makeAction(
                id: "volume-preview-\(target.muscleId)-\(target.decision.rawValue)",
                source: "volumeAdaptation",
                actionType: "create_plan_adjustment_preview",
                priority: "medium",
                requiresConfirmation: true,
                reversible: true,
                createdAt: createdAt,
                targetId: target.muscleId,
                targetType: "muscle",
                title: "生成训练量调整预览",
                description: target.title,
                reason: jsOrLast([nonEmpty(target.reason), report?.summary]), // target.reason || report?.summary
                confirmTitle: "生成计划调整预览？",
                confirmDescription: "只生成可检查的草案，不会自动覆盖当前训练计划。",
                sourceFingerprint: previewFingerprint
            ),
            makeAction(
                id: "review-volume-\(target.muscleId)",
                source: "volumeAdaptation",
                actionType: "review_volume",
                priority: "low",
                requiresConfirmation: false,
                reversible: false,
                createdAt: createdAt,
                targetId: target.muscleId,
                targetType: "muscle",
                title: "查看训练量建议",
                description: target.title,
                reason: jsOrLast([nonEmpty(target.reason), report?.summary])
            ),
        ]
    }

    // MARK: - recommendationConfidence actions (coachActionEngine.ts:556-575)

    private static func recommendationConfidenceActions(_ input: RecommendationConfidenceInput?, _ createdAt: String) -> [CoachAction] {
        // (Array.isArray(input) ? input : input ? [input] : []).filter(level === 'low')
        let results: [RecommendationConfidenceEngine.RecommendationConfidenceResult]
        switch input {
        case .some(.list(let arr)): results = arr
        case .some(.single(let one)): results = [one]
        case .none: results = []
        }
        let lowResults = results.filter { $0.level == .low }
        return Array(lowResults.prefix(2)).enumerated().map { index, result in
            makeAction(
                id: "recommendation-confidence-\(index)",
                source: "recommendationConfidence",
                actionType: "keep_observing",
                priority: "low",
                requiresConfirmation: false,
                reversible: false,
                createdAt: createdAt,
                title: "推荐建议保守参考",
                description: result.summary,
                // result.reasons?.[0]?.reason || result.missingData?.[0] || result.summary
                reason: jsOrLast([result.reasons.first?.reason, result.missingData.first, result.summary])
            )
        }
    }

    // MARK: - setAnomaly actions (coachActionEngine.ts:577-597)

    private static func setAnomalyActions(_ anomalies: [SetAnomaly]?, _ createdAt: String) -> [CoachAction] {
        let filtered = (anomalies ?? []).filter { $0.severity == .critical || $0.severity == .warning }
        return Array(filtered.prefix(2)).map { anomaly in
            makeAction(
                id: "set-anomaly-\(anomaly.id)",
                source: "setAnomaly",
                actionType: "review_session",
                priority: anomaly.severity == .critical ? "urgent" : "medium",
                requiresConfirmation: anomaly.requiresConfirmation,
                reversible: false,
                createdAt: createdAt,
                targetType: "session",
                title: anomaly.severity == .critical ? "确认异常训练输入" : "复查训练输入",
                description: anomaly.title,
                reason: jsOrLast([nonEmpty(anomaly.message), anomaly.suggestedAction]), // anomaly.message || anomaly.suggestedAction
                confirmTitle: anomaly.requiresConfirmation ? "确认保存这组？" : nil,
                confirmDescription: anomaly.requiresConfirmation ? "系统检测到重量、次数或 RIR 可能异常，请确认不是输入错误。" : nil
            )
        }
    }

    // MARK: - dedupe / sort / active-session noise gate (coachActionEngine.ts:599-622)

    /// `dedupeActions` (ts:599-606) — keep the highest-priority action per id, JS-`Map`
    /// first-insertion order preserved on updates.
    private static func dedupeActions(_ actions: [CoachAction]) -> [CoachAction] {
        var order: [String] = []
        var byId: [String: CoachAction] = [:]
        for action in actions {
            if let existing = byId[action.id] {
                // priorityRank[action] > priorityRank[existing] (JS undefined > n → false)
                if (priorityRank[action.priority] ?? 0) > (priorityRank[existing.priority] ?? 0) {
                    byId[action.id] = action
                }
            } else {
                order.append(action.id)
                byId[action.id] = action
            }
        }
        return order.map { byId[$0]! }
    }

    /// `sortActions` (ts:608-615) — STABLE: priority DESC, then dataHealth-first, then
    /// `id.localeCompare(id)`. `localeCompare` with no locale over the §11-clean ASCII ids
    /// reproduces with a code-point comparison (the `PainPatternEngine` / `TrainingCalendarEngine`
    /// precedent).
    private static func sortActions(_ actions: [CoachAction]) -> [CoachAction] {
        stableSorted(actions) { left, right in
            let priorityDiff = (priorityRank[right.priority] ?? 0) - (priorityRank[left.priority] ?? 0)
            if priorityDiff != 0 { return priorityDiff }
            if left.source == "dataHealth" && right.source != "dataHealth" { return -1 }
            if right.source == "dataHealth" && left.source != "dataHealth" { return 1 }
            return compareDefault(left.id, right.id)
        }
    }

    /// `lowNoiseDuringActiveSession` (ts:617-622).
    private static func lowNoiseDuringActiveSession(_ actions: [CoachAction]) -> [CoachAction] {
        Array(actions.filter { action in
            if action.source == "dataHealth" { return action.priority == "urgent" || action.priority == "high" }
            if action.source == "setAnomaly" { return action.priority == "urgent" }
            return false
        }.prefix(2))
    }

    // MARK: - buildCoachActions (coachActionEngine.ts:624-652)

    public static func buildCoachActions(_ input: BuildCoachActionsInput) -> [CoachAction] {
        // const createdAt = now || new Date().toISOString() — wall-clock fallback NOT ported
        // (DERIVED-only seam; every fixture passes an explicit `now`, so "" is never reached).
        // ③/CC-4 LIVE CONTRACT: the live read path (`resolveCoachActionState`, CoachActionReadPath)
        // injects the decision pipeline's `nowIso` here and `precondition`-asserts it is non-empty
        // BEFORE calling this builder, so the `""` branch is UNREACHABLE on the live path — the same
        // §11.2 injected-clock pinning as iOS-17e-6a's `asOfDate`. Passing a defaulted/empty `now`
        // from a live caller is a hard precondition failure, never a silent wall-clock fabrication.
        let createdAt = nonEmpty(input.now) ?? ""
        let templates = appDataTemplates(input.appData)                 // appData.templates || []

        var collected: [CoachAction?] = []
        collected += dataHealthActions(input.dataHealthReport, createdAt).map { Optional($0) }
        collected += setAnomalyActions(input.setAnomalies, createdAt).map { Optional($0) }
        collected.append(dailyAdjustmentAction(input.dailyAdjustment, createdAt))
        collected.append(nextWorkoutAction(input.nextWorkout, createdAt))
        // recoveryRecommendation || nextWorkout?.recovery
        collected.append(recoveryAction(input.recoveryRecommendation ?? input.nextWorkout?.recovery, createdAt))
        collected.append(sessionQualityAction(input.sessionQuality, createdAt))
        collected += plateauActions(input.plateauResults, createdAt, templates).map { Optional($0) }
        collected += volumeActions(input.volumeAdaptation, createdAt, templates).map { Optional($0) }
        collected += recommendationConfidenceActions(input.recommendationConfidence, createdAt).map { Optional($0) }

        let actions = dedupeActions(collected.compactMap { $0 })        // .filter(Boolean)
        let sorted = sortActions(actions)
        return activeSessionInProgress(input.appData) ? lowNoiseDuringActiveSession(sorted) : sorted
    }

    // MARK: - AppData.templates accessor

    /// `appData.templates || []` — the Domain `AppData` keeps `templates` in its open-bag
    /// `root` (no typed accessor); read + decode each entry leniently (a malformed entry is
    /// dropped, mirroring nothing the fixtures exercise — every fixture template is valid).
    private static func appDataTemplates(_ appData: AppData) -> [TrainingTemplate] {
        guard let arr = appData.root["templates"]?.arrayValue else { return [] }
        return arr.compactMap { try? TrainingTemplate(decoding: $0) }
    }

    // MARK: - formatExerciseName (formatters.ts:492 → exerciseLibrary.ts:323, STRING path)

    /// `formatExerciseName(value)` STRING path — the only path the engine hits
    /// (`formatExerciseName(action.targetId)`, ts:252). Mirrors `formatExerciseDisplayName`
    /// (exerciseLibrary.ts:323) for a string `value` (non-bilingual): CJK passthrough →
    /// `getExerciseNameEntry(id).zh` (= `EXERCISE_DISPLAY_NAMES[id] || ''`, reusing
    /// `ExerciseLibrary.displayNames`) → `'未命名动作'` fallback. The dev-only
    /// `warnMissingChineseName` console side effect is intentionally not ported.
    private static func formatExerciseName(_ value: String) -> String {
        if ExerciseLibrary.hasChineseText(value) { return value }        // hasChineseText(value) → value
        if let zh = nonEmpty(ExerciseLibrary.displayNames[value]) { return zh } // entry.zh
        return "未命名动作"
    }

    // MARK: - suggestedChange JSONValue builder (training-model.ts:1087)

    /// Builds the `suggestedChange` anonymous-object subtree as a raw `JSONValue`, emitting
    /// only the keys the caller passes (matching the TS object literals). `setsDelta` is an
    /// integer.
    private static func suggestedChangeValue(
        muscleId: String? = nil,
        setsDelta: Int? = nil,
        exerciseIds: [String]? = nil
    ) -> JSONValue {
        var entries: [OrderedJSONObject.Entry] = []
        if let muscleId { entries.append(.init(key: "muscleId", value: .string(muscleId))) }
        if let setsDelta { entries.append(.init(key: "setsDelta", value: .number(.integer(Int64(setsDelta))))) }
        if let exerciseIds { entries.append(.init(key: "exerciseIds", value: .array(exerciseIds.map { .string($0) }))) }
        return .object(OrderedJSONObject(entries: entries))
    }

    /// `EstimateConfidence(rawValue:)` — the WeeklyActionRecommendation.confidence carrier
    /// (the CC-1 `makeRecommendation` precedent). Non-enum confidence strings decode to nil
    /// (lossy by the PA-S1 Domain modelling); the engine only ever supplies low/medium/high.
    private static func estimateConfidence(_ value: String) -> EstimateConfidence? {
        EstimateConfidence(rawValue: value)
    }

    // MARK: - ISO instant helpers (PURE — zero `: Date`)

    /// Parses a `YYYY-MM-DDTHH:MM:SS(.fraction)?Z` instant to ms since epoch (UTC), or nil
    /// (→ the JS `NaN` branch). Same shape + degradation as `TrainingCalendarEngine.parseIsoMs`
    /// (the full-ISO-`Z` form is the only shape an injected `now` carries). Civil math via
    /// `AnalyticsSupport.daysFromCivil`.
    private static func parseIsoMs(_ value: String) -> Double? {
        let c = Array(value)
        guard c.count >= 20 else { return nil } // min "YYYY-MM-DDTHH:MM:SSZ"
        func dig(_ i: Int) -> Int? { (c[i].isASCII && c[i].isNumber) ? c[i].wholeNumberValue : nil }
        guard let y1 = dig(0), let y2 = dig(1), let y3 = dig(2), let y4 = dig(3), c[4] == "-",
              let mo1 = dig(5), let mo2 = dig(6), c[7] == "-", let d1 = dig(8), let d2 = dig(9),
              c[10] == "T",
              let h1 = dig(11), let h2 = dig(12), c[13] == ":", let mi1 = dig(14), let mi2 = dig(15),
              c[16] == ":", let s1 = dig(17), let s2 = dig(18) else { return nil }
        let y = y1 * 1000 + y2 * 100 + y3 * 10 + y4
        let mo = mo1 * 10 + mo2, d = d1 * 10 + d2
        let h = h1 * 10 + h2, mi = mi1 * 10 + mi2, s = s1 * 10 + s2
        guard mo >= 1, mo <= 12, d >= 1, d <= 31, h <= 23, mi <= 59, s <= 59 else { return nil }
        var idx = 19
        var ms = 0
        if idx < c.count, c[idx] == "." {
            idx += 1
            var frac = 0, taken = 0
            while idx < c.count, let dd = dig(idx) {
                if taken < 3 { frac = frac * 10 + dd; taken += 1 }
                idx += 1
            }
            while taken < 3 { frac *= 10; taken += 1 } // ".5" → 500ms
            ms = frac
        }
        guard idx == c.count - 1, c[idx] == "Z" else { return nil } // trailing UTC designator
        let days = AnalyticsSupport.daysFromCivil(y, mo, d)
        return Double(days) * 86_400_000 + Double(h * 3600 + mi * 60 + s) * 1000 + Double(ms)
    }

    /// `Date.prototype.toISOString()` — `YYYY-MM-DDTHH:MM:SS.sssZ` (always 3-digit ms, UTC)
    /// from ms since epoch, via `AnalyticsSupport.civilFromDays`.
    private static func isoStringFromMs(_ ms: Double) -> String {
        let total = Int(ms.rounded(.towardZero))
        let dayCount = Int((Double(total) / 86_400_000).rounded(.down))
        let msOfDay = total - dayCount * 86_400_000
        let (y, mo, d) = AnalyticsSupport.civilFromDays(dayCount)
        let h = msOfDay / 3_600_000
        let mi = (msOfDay / 60_000) % 60
        let s = (msOfDay / 1000) % 60
        let milli = msOfDay % 1000
        return "\(pad(y, 4))-\(pad(mo, 2))-\(pad(d, 2))T\(pad(h, 2)):\(pad(mi, 2)):\(pad(s, 2)).\(pad(milli, 3))Z"
    }
}

// MARK: - file-private JS-semantics helpers (per-file convention)

/// `nonEmpty` — JS `a || b` truthiness for an optional string (skips `''` and nil).
private func nonEmpty(_ value: String?) -> String? {
    guard let value, !value.isEmpty else { return nil }
    return value
}

/// JS `a || b || … || literal`: first non-empty operand, else the literal.
private func jsOr(_ candidates: [String?], _ fallback: String) -> String {
    for c in candidates where !(c ?? "").isEmpty { return c! }
    return fallback
}

/// JS `a || b || c` WITHOUT a literal fallback: first non-empty operand, else the LAST
/// operand verbatim (JS `||` returns the last operand even when falsy).
private func jsOrLast(_ candidates: [String?]) -> String? {
    for c in candidates where !(c ?? "").isEmpty { return c }
    return candidates.last ?? nil
}

/// JS `String.prototype.includes`: `x.includes('')` is ALWAYS true (an empty needle matches).
private func jsIncludes(_ haystack: String, _ needle: String) -> Bool {
    needle.isEmpty ? true : haystack.contains(needle)
}

/// JS truthiness for a `JSONValue` (`null`/`false`/`0`/`NaN`/`''` falsy; object/array truthy).
private func jsTruthy(_ value: JSONValue) -> Bool {
    switch value {
    case .null: return false
    case .bool(let b): return b
    case .number(let n): let d = n.doubleValue; return d != 0 && !d.isNaN
    case .string(let s): return !s.isEmpty
    case .array, .object: return true
    }
}

/// `[...new Set(array)]` — first-insertion-order unique.
private func orderedUnique(_ array: [String]) -> [String] {
    var seen: Set<String> = []
    var out: [String] = []
    for item in array where !seen.contains(item) {
        seen.insert(item)
        out.append(item)
    }
    return out
}

/// `a.localeCompare(b)` with no locale over §11-clean ASCII keys → code-point comparison
/// (-1/0/1). Same paradigm as `PainPatternEngine` / `TrainingCalendarEngine`.
private func compareDefault(_ a: String, _ b: String) -> Int {
    if a == b { return 0 }
    return a < b ? -1 : 1
}

/// Apply an ICU global regex replace (mirrors JS `String.prototype.replace(/…/g, repl)`).
/// Replacement strings used here are literals ("" / " ") with no `$`/`\`.
private func regexReplaceAll(_ input: String, _ pattern: String, _ replacement: String, caseInsensitive: Bool = false) -> String {
    let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
    guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return input }
    let range = NSRange(input.startIndex..., in: input)
    return regex.stringByReplacingMatches(in: input, options: [], range: range, withTemplate: replacement)
}

/// Zero-padded decimal (`String.padStart('0')`) for the ISO instant formatter.
private func pad(_ value: Int, _ width: Int) -> String {
    let s = String(value)
    return s.count >= width ? s : String(repeating: "0", count: width - s.count) + s
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
