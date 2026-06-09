// NextWorkoutScheduler — SC-C scheduling-track port (1/1 of this slice).
//
// Faithful line-by-line Swift port of `retired web reference` — the
// "what should I train next" recommender. Three exports are ported verbatim
// (`getOrderedProgramDayTemplates` ts:143 / `getOrderedTrainingTemplates` ts:149 /
// `buildNextWorkoutRecommendation` ts:346) together with EVERY private helper
// (`normalizeKey` ts:96 / `isAnalyticsSession` ts:103 / `completedHistory` ts:108 /
// `localizedTemplateName` ts:113 / `templateAliases` ts:119 / `resolveProgramDayTemplate`
// ts:122 / `explicitDayOrderValue` ts:132 / `resolveSessionTemplateKey` ts:159 /
// `templateMatchesKey` ts:170 / `rotationFamilyKey` ts:176 / `contiguousFamilyGroup`
// ts:183 / `nextByDefaultRotation` ts:193 / `cycleTemplatesFor` ts:210 / `templateMuscles`
// ts:223 / `painAreaKeys` ts:243 / `directPainRiskForTemplate` ts:258 / `hasPainRisk`
// ts:268 / `weeklyDeficitEntries` ts:289 / `candidateFor` ts:314 / `lowLoadTemplate`
// ts:324 / `alternativesFor` ts:328 / `appendWarning` ts:342) and the output / input types.
//
// CONSUMES already-ported slices (no re-port — §27): the i18n formatters
// `formatMuscleName` (AN-3 VolumeAdaptationEngine) / `formatTemplateName` STRING path
// (the SC-A RecoveryAwareScheduler local mirror's `formatTemplateNameCandidates`) /
// `formatTrainingMode` (SC-0 SchedulingFormatters); `number` (engineUtils, E1RMEngine
// finite-or-0 adapter); `buildWorkoutCycleState` (SC-1 WorkoutCycleScheduler);
// `buildRecoveryAwareRecommendation` + `buildTemplateRecoveryConflict` (SC-A
// RecoveryAwareScheduler); `jsNumberString` / `roundOne` (AN-3 AnalyticsDashboardEngine,
// the JS `${number}` / `Math.round(x*10)/10` formatters). Domain types
// (TrainingSession / TrainingTemplate / ProgramTemplate / ExerciseTemplate) come from
// RedeDomain; `TodayTrainingState` from SC-B TodayStateEngine; `ReadinessResult`
// from TrainingDecisionReadiness; `PainPattern` from PainPatternEngine (the full
// training-model port).
//
// PURE / READ-ONLY: zero `: Date` — the only "today" is the caller-supplied
// `todayState.date` string passed straight into `buildWorkoutCycleState`; no wall clock,
// no IO, no randomness, no write path. NOT wired into any UI (that is a later slice);
// this slice only adds the functions and parity-pins them (§19.2). The session open-bag
// keys the legacy web schema engine reads off `TrainingSession` (`templateId` / `templateName` /
// `programTemplateId` / `dataFlag`) and `ProgramTemplate` (`dayTemplates`) are not
// promoted Domain fields — they ride in the `_unknown` carrier (same precedent as the
// SC-1 WorkoutCycleScheduler `sourceProgramTemplateId` reads).

import Foundation
import RedeDomain

public enum NextWorkoutScheduler {

    // MARK: - Output type: NextWorkoutRecommendation (nextWorkoutScheduler.ts:21-39)

    public struct NextWorkoutRecommendation: Equatable, Sendable {
        /// `confidence: 'low' | 'medium' | 'high'` (ts:29).
        public enum Confidence: String, Equatable, Sendable {
            case low
            case medium
            case high
        }

        /// `alternatives[number]` (ts:34-38).
        public struct Alternative: Equatable, Sendable {
            public let templateId: String
            public let templateName: String
            public let reason: String

            public init(templateId: String, templateName: String, reason: String) {
                self.templateId = templateId
                self.templateName = templateName
                self.reason = reason
            }
        }

        public let kind: RecoveryAwareScheduler.DailyRecommendationKind?     // ts `kind?`
        public let plannedTemplateId: String?                               // ts `plannedTemplateId?`
        public let plannedTemplateName: String?                             // ts `plannedTemplateName?`
        public let recommendedTemplateId: String?                           // ts `recommendedTemplateId?`
        public let overrideReason: String?                                  // ts `overrideReason?`
        public let templateId: String?                                      // ts `templateId?`
        public let templateName: String                                     // ts `templateName` (required)
        public let confidence: Confidence                                   // ts `confidence` (required)
        public let reason: String                                           // ts `reason` (required)
        public let warnings: [String]                                       // ts `warnings` (required)
        public let conflictLevel: RecoveryAwareScheduler.RecoveryConflictLevel?  // ts `conflictLevel?`
        public let recovery: RecoveryAwareScheduler.RecoveryAwareRecommendation? // ts `recovery?`
        public let alternatives: [Alternative]                              // ts `alternatives` (required)

        public init(
            kind: RecoveryAwareScheduler.DailyRecommendationKind?,
            plannedTemplateId: String?,
            plannedTemplateName: String?,
            recommendedTemplateId: String?,
            overrideReason: String?,
            templateId: String?,
            templateName: String,
            confidence: Confidence,
            reason: String,
            warnings: [String],
            conflictLevel: RecoveryAwareScheduler.RecoveryConflictLevel?,
            recovery: RecoveryAwareScheduler.RecoveryAwareRecommendation?,
            alternatives: [Alternative]
        ) {
            self.kind = kind
            self.plannedTemplateId = plannedTemplateId
            self.plannedTemplateName = plannedTemplateName
            self.recommendedTemplateId = recommendedTemplateId
            self.overrideReason = overrideReason
            self.templateId = templateId
            self.templateName = templateName
            self.confidence = confidence
            self.reason = reason
            self.warnings = warnings
            self.conflictLevel = conflictLevel
            self.recovery = recovery
            self.alternatives = alternatives
        }
    }

    // MARK: - getOrderedTrainingTemplates result (nextWorkoutScheduler.ts:153-156)

    public struct OrderedTrainingTemplates: Equatable, Sendable {
        public let templates: [TrainingTemplate]
        public let usedProgramOrder: Bool

        public init(templates: [TrainingTemplate], usedProgramOrder: Bool) {
            self.templates = templates
            self.usedProgramOrder = usedProgramOrder
        }
    }

    // MARK: - WeeklyVolumeSummaryInput (nextWorkoutScheduler.ts:41-69)

    /// A `byMuscle` map entry / a `muscles[]` row — the `Partial<{…}>` shape `weeklyDeficitEntries`
    /// reads (ts:289-312). All numeric fields are `Double?` (absent ↔ JS undefined; the nullish `??`
    /// chains pick the first PRESENT one). For a `byMuscle` entry the muscle name is the MAP KEY.
    public struct VolumeRow: Equatable, Sendable {
        public let muscle: String?
        public let muscleId: String?
        public let target: Double?
        public let targetSets: Double?
        public let sets: Double?
        public let completedSets: Double?
        public let effectiveSets: Double?
        public let weightedEffectiveSets: Double?
        public let remaining: Double?
        public let remainingSets: Double?

        public init(
            muscle: String? = nil,
            muscleId: String? = nil,
            target: Double? = nil,
            targetSets: Double? = nil,
            sets: Double? = nil,
            completedSets: Double? = nil,
            effectiveSets: Double? = nil,
            weightedEffectiveSets: Double? = nil,
            remaining: Double? = nil,
            remainingSets: Double? = nil
        ) {
            self.muscle = muscle
            self.muscleId = muscleId
            self.target = target
            self.targetSets = targetSets
            self.sets = sets
            self.completedSets = completedSets
            self.effectiveSets = effectiveSets
            self.weightedEffectiveSets = weightedEffectiveSets
            self.remaining = remaining
            self.remainingSets = remainingSets
        }
    }

    public struct WeeklyVolumeSummaryInput: Sendable {
        /// `byMuscle?: Record<string, Partial<{…}>>` (ts:42-54). Kept as ORDERED (key, row)
        /// pairs so `Object.entries` insertion order is preserved (the stable deficit-sort tie
        /// order depends on it). Input-only — never compared, so no Equatable needed.
        public let byMuscle: [(key: String, row: VolumeRow)]?
        /// `muscles?: Array<Partial<{…}>>` (ts:55-68).
        public let muscles: [VolumeRow]?

        public init(byMuscle: [(key: String, row: VolumeRow)]? = nil, muscles: [VolumeRow]? = nil) {
            self.byMuscle = byMuscle
            self.muscles = muscles
        }
    }

    // MARK: - ProgramDayTemplate (ProgramTemplate['dayTemplates'][number])

    /// A `ProgramTemplate.dayTemplates` entry. The Swift `ProgramTemplate` does not promote
    /// `dayTemplates` (it rides in `_unknown`), so the day object is decoded here. `id` / `name`
    /// are the documented `DayTemplate` fields (training-model.ts:218); `order` / `sortIndex` /
    /// `dayNumber` / `sequence` ride in the day's own open bag — the cast extras
    /// `explicitDayOrderValue` reads (ts:133-138), kept as raw `JSONValue?` so the nullish `??`
    /// chain distinguishes ABSENT from a present `0`.
    public struct ProgramDayTemplate: Equatable, Sendable {
        public let id: String?
        public let name: String?
        public let order: JSONValue?
        public let sortIndex: JSONValue?
        public let dayNumber: JSONValue?
        public let sequence: JSONValue?

        public init(
            id: String? = nil,
            name: String? = nil,
            order: JSONValue? = nil,
            sortIndex: JSONValue? = nil,
            dayNumber: JSONValue? = nil,
            sequence: JSONValue? = nil
        ) {
            self.id = id
            self.name = name
            self.order = order
            self.sortIndex = sortIndex
            self.dayNumber = dayNumber
            self.sequence = sequence
        }

        /// Decode a single day JSON object.
        public init(decoding object: OrderedJSONObject) {
            self.id = object["id"]?.stringValue
            self.name = object["name"]?.stringValue
            self.order = object["order"]
            self.sortIndex = object["sortIndex"]
            self.dayNumber = object["dayNumber"]
            self.sequence = object["sequence"]
        }
    }

    // MARK: - PPL_ORDER (nextWorkoutScheduler.ts:94)

    private static let pplOrder = ["push-a", "pull-a", "legs-a"]

    // MARK: - normalizeKey (nextWorkoutScheduler.ts:96-101)

    /// `normalizeKey` (ts:96): `String(value||'').trim().replace(/([a-z])([A-Z])/g,'$1-$2')
    /// .replace(/[_\s]+/g,'-').toLowerCase()`. NOTE this is the scheduler's OWN key normalizer —
    /// it does NOT strip parenthesised content (that is the formatters' `normalizeDisplayKey`).
    private static func normalizeKey(_ value: String?) -> String {
        var s = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        s = RecoveryAwareScheduler.regexReplaceAll(s, "([a-z])([A-Z])", "$1-$2")
        s = RecoveryAwareScheduler.regexReplaceAll(s, "[_\\s]+", "-")
        return s.lowercased()
    }

    // MARK: - JS-truthiness string helper

    /// `value || next` fall-through: a non-empty string is truthy; `undefined`/`null`/`''` falsy.
    private static func truthy(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// `Number(value)` finite-or-0 (engineUtils.ts:38) over an optional Double — `NaN`/absent → 0.
    private static func number(_ value: Double?) -> Double {
        guard let value, value.isFinite else { return 0 }
        return value
    }

    /// `Number(value)` finite-or-0 over a free-form JSON value (reuses the E1RMEngine adapter).
    private static func number(_ value: JSONValue?) -> Double {
        E1RMEngine.number(value)
    }

    /// `array.some(needle => haystack.includes(needle))` for the no-`\b` `/.../ i` pain regexes
    /// (the call-site text is already `toLowerCase()`d and the literals are lowercase, so a
    /// case-insensitive search reduces to a substring `contains`).
    private static func containsAny(_ haystack: String, _ needles: [String]) -> Bool {
        needles.contains { haystack.contains($0) }
    }

    // MARK: - isAnalyticsSession (nextWorkoutScheduler.ts:103-106)

    /// `isAnalyticsSession` (ts:103): `dataFlag || 'normal'` (rides in the open bag); excluded
    /// when 'test' / 'excluded'.
    private static func isAnalyticsSession(_ session: TrainingSession) -> Bool {
        let flag = truthy(session._unknown["dataFlag"]?.stringValue) ?? "normal"
        return flag != "test" && flag != "excluded"
    }

    // MARK: - completedHistory (nextWorkoutScheduler.ts:108-111)

    /// `sessionSortKey` for `completedHistory` (ts:111): `String(finishedAt||startedAt||date||'')`.
    private static func sessionSortKey(_ session: TrainingSession) -> String {
        truthy(session.finishedAt) ?? truthy(session.startedAt) ?? truthy(session.date) ?? ""
    }

    /// `completedHistory` (ts:108): filter analytics + `completed === true`, then sort NEWEST-FIRST
    /// (`(l,r) => rKey.localeCompare(lKey)`). `localeCompare` over §11-clean ISO keys reproduces with
    /// a code-point compare (the SC-1 WorkoutCycleScheduler / E1RMEngine precedent); `stableSorted`
    /// keeps JS `Array.sort` tie order.
    private static func completedHistory(_ history: [TrainingSession]) -> [TrainingSession] {
        let filtered = history.filter { isAnalyticsSession($0) && $0.completed == true }
        return stableSorted(filtered) { left, right in
            let l = sessionSortKey(left), r = sessionSortKey(right)
            return r < l ? -1 : (r > l ? 1 : 0)
        }
    }

    // MARK: - localizedTemplateName (nextWorkoutScheduler.ts:113-117)

    /// `localizedTemplateName` (ts:116) for a TEMPLATE: `formatTemplateName(template.id ||
    /// template.name, '未命名模板')`. The STRING-path formatter is the SC-A
    /// RecoveryAwareScheduler local mirror's shared candidate loop (reused, not re-ported).
    private static func localizedTemplateName(_ template: TrainingTemplate?) -> String {
        guard let template else { return "暂无下次建议" }  // ts:114
        let value = truthy(template.id) ?? template.name    // template.id || template.name
        return RecoveryAwareScheduler.formatTemplateNameCandidates([value], fallbackLabel: "未命名模板")
    }

    /// `localizedTemplateName` (ts:115) for a SESSION (`'templateId' in template`):
    /// `formatTemplateName(session.templateId || session.templateName, '未命名模板')`.
    /// `templateId` / `templateName` ride in the session open bag.
    private static func localizedTemplateName(session: TrainingSession?) -> String {
        guard let session else { return "暂无下次建议" }
        let templateId = session._unknown["templateId"]?.stringValue
        let templateName = session._unknown["templateName"]?.stringValue
        let value = truthy(templateId) ?? templateName
        return RecoveryAwareScheduler.formatTemplateNameCandidates([value], fallbackLabel: "未命名模板")
    }

    // MARK: - templateAliases (nextWorkoutScheduler.ts:119-120)

    /// `templateAliases` (ts:119): `new Set([id, sourceTemplateId, name].filter(Boolean)
    /// .map(normalizeKey))`. Returned as an ORDERED-unique list (JS `Set` insertion order) — only
    /// membership / the join-for-regex matter, so order is inert, but it is preserved for fidelity.
    private static func templateAliases(_ template: TrainingTemplate?) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for raw in [template?.id, template?.sourceTemplateId, template?.name] {
            guard let value = truthy(raw) else { continue }  // .filter(Boolean) (pre-normalize)
            let key = normalizeKey(value)
            if seen.insert(key).inserted { out.append(key) }
        }
        return out
    }

    private static func templateAliasesContains(_ template: TrainingTemplate?, _ key: String) -> Bool {
        templateAliases(template).contains(key)
    }

    // MARK: - resolveProgramDayTemplate (nextWorkoutScheduler.ts:122-130)

    /// `resolveProgramDayTemplate` (ts:122): exact id → `sourceTemplateId === day.id` →
    /// alias-by-dayKey/dayNameKey.
    private static func resolveProgramDayTemplate(_ day: ProgramDayTemplate, _ templates: [TrainingTemplate]) -> TrainingTemplate? {
        // byId = new Map(templates.map(t => [t.id, t])) — last-wins for duplicate ids.
        var byId: [String: TrainingTemplate] = [:]
        for template in templates { if let id = template.id { byId[id] = template } }
        if let dayId = day.id, let exact = byId[dayId] { return exact }  // ts:124-125
        let dayKey = normalizeKey(truthy(day.id) ?? day.name)            // ts:126 normalizeKey(day.id || day.name)
        let dayNameKey = normalizeKey(day.name)                          // ts:127
        // templates.find(t => t.sourceTemplateId === day.id) || templates.find(alias match)  (ts:128-129)
        if let bySource = templates.first(where: { $0.sourceTemplateId == day.id }) { return bySource }
        return templates.first { templateAliasesContains($0, dayKey) || templateAliasesContains($0, dayNameKey) }
    }

    // MARK: - explicitDayOrderValue (nextWorkoutScheduler.ts:132-141)

    /// `explicitDayOrderValue` (ts:132): `number(order ?? sortIndex ?? dayNumber ?? sequence)`,
    /// then `value > 0 ? value : index + 1`. The `??` is NULLISH (skips null/undefined, KEEPS 0).
    private static func explicitDayOrderValue(_ day: ProgramDayTemplate, _ index: Int) -> Double {
        let raw = firstPresent([day.order, day.sortIndex, day.dayNumber, day.sequence])
        let value = number(raw)
        return value > 0 ? value : Double(index + 1)
    }

    /// First JSON value that is PRESENT and not `null` — JS nullish-coalescing chain semantics.
    private static func firstPresent(_ values: [JSONValue?]) -> JSONValue? {
        for value in values {
            guard let value else { continue }
            if case .null = value { continue }
            return value
        }
        return nil
    }

    // MARK: - getOrderedProgramDayTemplates (nextWorkoutScheduler.ts:143-147) — EXPORT

    /// `getOrderedProgramDayTemplates` (ts:143): stable sort the program's day templates by
    /// `(explicitDayOrderValue ASC, originalIndex ASC)`. `dayTemplates` rides in the
    /// `ProgramTemplate` open bag.
    public static func getOrderedProgramDayTemplates(_ programTemplate: ProgramTemplate?) -> [ProgramDayTemplate] {
        let days = decodeDayTemplates(programTemplate)
        let indexed = days.enumerated().map { (day: $0.element, index: $0.offset, order: explicitDayOrderValue($0.element, $0.offset)) }
        let sorted = stableSorted(indexed) { left, right in
            // (l,r) => l.order - r.order || l.index - r.index
            if left.order != right.order { return left.order < right.order ? -1 : 1 }
            return left.index < right.index ? -1 : (left.index > right.index ? 1 : 0)
        }
        return sorted.map { $0.day }
    }

    /// Decode `programTemplate.dayTemplates` (open-bag array) into `[ProgramDayTemplate]`.
    private static func decodeDayTemplates(_ programTemplate: ProgramTemplate?) -> [ProgramDayTemplate] {
        guard let array = programTemplate?._unknown["dayTemplates"]?.arrayValue else { return [] }
        return array.compactMap { value in
            guard let object = value.objectValue else { return nil }
            return ProgramDayTemplate(decoding: object)
        }
    }

    /// The set of day ids — `new Set((programTemplate?.dayTemplates || []).map(day => day.id))`
    /// (ts:161), restricted to present ids (a string candidate never matches an undefined member).
    private static func dayTemplateIds(_ programTemplate: ProgramTemplate?) -> Set<String> {
        Set(decodeDayTemplates(programTemplate).compactMap { $0.id })
    }

    // MARK: - getOrderedTrainingTemplates (nextWorkoutScheduler.ts:149-157) — EXPORT

    /// `getOrderedTrainingTemplates` (ts:149): program-day order first (resolved to concrete
    /// templates), then the remaining templates; `usedProgramOrder` when both lists are non-empty.
    public static func getOrderedTrainingTemplates(_ templates: [TrainingTemplate] = [], _ programTemplate: ProgramTemplate? = nil) -> OrderedTrainingTemplates {
        let dayTemplates = getOrderedProgramDayTemplates(programTemplate)
        let ordered = dayTemplates.compactMap { resolveProgramDayTemplate($0, templates) }  // .filter(Boolean)
        let remaining = templates.filter { template in !ordered.contains { $0.id == template.id } }
        return OrderedTrainingTemplates(
            templates: ordered + remaining,
            usedProgramOrder: dayTemplates.count > 0 && ordered.count > 0
        )
    }

    // MARK: - resolveSessionTemplateKey (nextWorkoutScheduler.ts:159-168)

    /// `resolveSessionTemplateKey` (ts:159). `programTemplateId` / `templateId` ride in the session
    /// open bag. matched.sourceTemplateId → a program-day-id candidate → matched.id || session.templateId.
    private static func resolveSessionTemplateKey(_ session: TrainingSession?, _ templates: [TrainingTemplate], _ programTemplate: ProgramTemplate?) -> String? {
        guard let session else { return nil }  // ts:160
        let programIds = dayTemplateIds(programTemplate)  // ts:161
        // candidates = [programTemplateId, templateId].filter(Boolean).map(String)  (ts:162)
        let candidates = [
            session._unknown["programTemplateId"]?.stringValue,
            session._unknown["templateId"]?.stringValue,
        ].compactMap { truthy($0) }
        // matchedTemplate = templates.find(t => candidates.includes(t.id))  (ts:163)
        let matchedTemplate = templates.first { template in
            guard let id = template.id else { return false }
            return candidates.contains(id)
        }
        if let source = truthy(matchedTemplate?.sourceTemplateId) { return source }  // ts:164
        if let programMatch = candidates.first(where: { programIds.contains($0) }) { return programMatch }  // ts:165-166
        // matchedTemplate?.id || session.templateId  (ts:167)
        return truthy(matchedTemplate?.id) ?? session._unknown["templateId"]?.stringValue
    }

    // MARK: - templateMatchesKey (nextWorkoutScheduler.ts:170-174)

    /// `templateMatchesKey` (ts:170): falsy key → false; else `templateAliases(template).has(normalizeKey(key))`.
    private static func templateMatchesKey(_ template: TrainingTemplate, _ key: String?) -> Bool {
        guard let key = truthy(key) else { return false }  // if (!key) return false
        return templateAliasesContains(template, normalizeKey(key))
    }

    // MARK: - rotationFamilyKey (nextWorkoutScheduler.ts:176-181)

    /// `rotationFamilyKey` (ts:176): `\b(push|pull|legs?|leg)\b` → 'push-pull-legs';
    /// `\b(upper|lower)\b` → 'upper-lower'; else ''. The JS `\b` (ASCII word boundary) is mirrored
    /// with `(?<![A-Za-z0-9_])…(?![A-Za-z0-9_])` lookarounds — NOT ICU `\b` (which treats CJK as
    /// word chars) — the same fix the SC-A formatTemplateName mirror carries.
    private static func rotationFamilyKey(_ template: TrainingTemplate?) -> String {
        let text = templateAliases(template).joined(separator: " ")
        if RecoveryAwareScheduler.regexTest(text, "(?<![A-Za-z0-9_])(push|pull|legs?|leg)(?![A-Za-z0-9_])") { return "push-pull-legs" }
        if RecoveryAwareScheduler.regexTest(text, "(?<![A-Za-z0-9_])(upper|lower)(?![A-Za-z0-9_])") { return "upper-lower" }
        return ""
    }

    // MARK: - contiguousFamilyGroup (nextWorkoutScheduler.ts:183-191)

    /// `contiguousFamilyGroup` (ts:183): the maximal contiguous run of `templates` around `index`
    /// sharing `index`'s rotation family; `[]` when the family is empty.
    private static func contiguousFamilyGroup(_ templates: [TrainingTemplate], _ index: Int) -> [TrainingTemplate] {
        guard index >= 0, index < templates.count else { return [] }
        let family = rotationFamilyKey(templates[index])
        if family.isEmpty { return [] }
        var start = index
        var end = index
        while start > 0 && rotationFamilyKey(templates[start - 1]) == family { start -= 1 }
        while end < templates.count - 1 && rotationFamilyKey(templates[end + 1]) == family { end += 1 }
        return Array(templates[start ... end])
    }

    // MARK: - nextByDefaultRotation (nextWorkoutScheduler.ts:193-208)

    /// `nextByDefaultRotation` (ts:193): PPL cyclic fallback (when usePplFallback + all PPL ids
    /// present + lastKey ∈ PPL), else family-group cycle, else flat `(index+1) % len` (first
    /// template when the last key is not found).
    private static func nextByDefaultRotation(_ lastTemplateKey: String?, _ templates: [TrainingTemplate], _ usePplFallback: Bool) -> TrainingTemplate? {
        if templates.isEmpty { return nil }  // ts:194
        let ids = Set(templates.compactMap { $0.id })
        if usePplFallback, let lastKey = truthy(lastTemplateKey),
           pplOrder.allSatisfy({ ids.contains($0) }), pplOrder.contains(lastKey),
           let lastIndex = pplOrder.firstIndex(of: lastKey) {
            let nextId = pplOrder[(lastIndex + 1) % pplOrder.count]  // ts:197
            return templates.first { $0.id == nextId }
        }
        guard let index = templates.firstIndex(where: { templateMatchesKey($0, lastTemplateKey) }) else {
            return templates[0]  // ts:201 (index < 0)
        }
        let familyGroup = contiguousFamilyGroup(templates, index)
        if familyGroup.count > 1 {
            // groupIndex = familyGroup.findIndex(t => t.id === templates[index].id)
            if let groupIndex = familyGroup.firstIndex(where: { $0.id == templates[index].id }) {
                return familyGroup[(groupIndex + 1) % familyGroup.count]  // ts:205
            }
        }
        return templates[(index + 1) % templates.count]  // ts:207
    }

    // MARK: - cycleTemplatesFor (nextWorkoutScheduler.ts:210-215)

    /// `cycleTemplatesFor` (ts:210): the family group around the last template (or index 0), or the
    /// full list when the group is a singleton.
    private static func cycleTemplatesFor(_ templates: [TrainingTemplate], _ lastTemplateKey: String?) -> [TrainingTemplate] {
        if templates.isEmpty { return [] }  // ts:211
        let index: Int
        if truthy(lastTemplateKey) != nil {
            index = templates.firstIndex { templateMatchesKey($0, lastTemplateKey) } ?? -1
        } else {
            index = 0
        }
        let familyGroup = contiguousFamilyGroup(templates, index >= 0 ? index : 0)
        return familyGroup.count > 1 ? familyGroup : templates
    }

    // MARK: - muscleAliases (nextWorkoutScheduler.ts:217-221)

    private static let muscleAliasesPush = ["chest", "shoulders", "triceps", "胸", "肩", "手臂"]
    private static let muscleAliasesPull = ["back", "lats", "biceps", "背", "背阔肌", "手臂"]
    private static let muscleAliasesLegs = ["legs", "quads", "hamstrings", "glutes", "calves", "腿", "股四头肌", "腘绳肌", "臀", "小腿"]

    // MARK: - templateMuscles (nextWorkoutScheduler.ts:223-241)

    /// `templateMuscles` (ts:223): the normalized muscle set implied by the template id (push/pull/
    /// leg|lower alias families) plus every exercise's muscle / primary / secondary /
    /// muscleContribution-keys / movementPattern.
    private static func templateMuscles(_ template: TrainingTemplate) -> Set<String> {
        var muscles = Set<String>()
        let id = normalizeKey(template.id)
        if id.contains("push") { muscleAliasesPush.forEach { muscles.insert(normalizeKey($0)) } }
        if id.contains("pull") { muscleAliasesPull.forEach { muscles.insert(normalizeKey($0)) } }
        if id.contains("leg") || id.contains("lower") { muscleAliasesLegs.forEach { muscles.insert(normalizeKey($0)) } }
        for exercise in template.exercises ?? [] {
            var values: [String?] = [exercise.muscle]
            values.append(contentsOf: (exercise.primaryMuscles ?? []).map { $0 })
            values.append(contentsOf: (exercise.secondaryMuscles ?? []).map { $0 })
            values.append(contentsOf: contributionKeys(exercise.muscleContribution).map { $0 })
            values.append(exercise.movementPattern)
            for value in values {
                if let value, !value.isEmpty { muscles.insert(normalizeKey(value)) }  // if (value) …
            }
        }
        return muscles
    }

    /// `Object.keys(exercise.muscleContribution || {})` — the muscleContribution map's keys
    /// (a `Record<string, number>` carried as raw `JSONValue?`), in object order.
    private static func contributionKeys(_ value: JSONValue?) -> [String] {
        guard let object = value?.objectValue else { return [] }
        return object.entries.map { $0.key }
    }

    // MARK: - painAreaKeys (nextWorkoutScheduler.ts:243-256)

    /// `painAreaKeys` (ts:243): the normalized pain area plus the alias family it falls into.
    private static func painAreaKeys(_ pattern: PainPatternEngine.PainPattern) -> Set<String> {
        let area = normalizeKey(pattern.area)
        var keys = Set([area])
        if containsAnyAreaItem(area, ["chest", "shoulder", "shoulders", "triceps", "arm", "arms", "胸", "肩", "手臂"]) {
            muscleAliasesPush.forEach { keys.insert(normalizeKey($0)) }
        }
        if containsAnyAreaItem(area, ["back", "lat", "lats", "biceps", "背", "背阔肌"]) {
            muscleAliasesPull.forEach { keys.insert(normalizeKey($0)) }
        }
        if containsAnyAreaItem(area, ["leg", "legs", "knee", "quad", "hamstring", "glute", "calf", "腿", "膝", "臀", "小腿"]) {
            muscleAliasesLegs.forEach { keys.insert(normalizeKey($0)) }
        }
        return keys
    }

    /// `items.some(item => area.includes(normalizeKey(item)))`.
    private static func containsAnyAreaItem(_ area: String, _ items: [String]) -> Bool {
        items.contains { area.contains(normalizeKey($0)) }
    }

    // MARK: - directPainRiskForTemplate (nextWorkoutScheduler.ts:258-266)

    /// `directPainRiskForTemplate` (ts:258): the template family directly overlaps the lower-cased
    /// `${area} ${exerciseId}` pain text.
    private static func directPainRiskForTemplate(_ template: TrainingTemplate, _ painPatterns: [PainPatternEngine.PainPattern]) -> Bool {
        let templateId = normalizeKey(template.id)
        let painText = painPatterns
            .map { "\($0.area) \(truthy($0.exerciseId) ?? "")" }  // `${area} ${exerciseId || ''}`
            .joined(separator: " ")
            .lowercased()
        if painText.isEmpty { return false }  // if (!painText) return false
        if templateId.contains("push") && containsAny(painText, ["chest", "shoulder", "triceps", "arm", "胸", "肩", "手臂"]) { return true }
        if templateId.contains("pull") && containsAny(painText, ["back", "lat", "biceps", "背", "背阔肌"]) { return true }
        if (templateId.contains("leg") || templateId.contains("lower")) && containsAny(painText, ["leg", "knee", "quad", "hamstring", "glute", "calf", "腿", "膝", "臀", "小腿"]) { return true }
        return false
    }

    // MARK: - hasPainRisk (nextWorkoutScheduler.ts:268-287)

    private struct PainRisk {
        let riskScore: Double
        let patterns: [PainPatternEngine.PainPattern]
    }

    /// `hasPainRisk` (ts:268): the relevant pain patterns (direct family overlap, alias-key overlap
    /// with the template muscles, or exerciseId match) + the accumulated risk score.
    private static func hasPainRisk(_ template: TrainingTemplate, _ painPatterns: [PainPatternEngine.PainPattern]) -> PainRisk {
        let muscles = templateMuscles(template)
        let templateId = normalizeKey(template.id)
        let relevant = painPatterns.filter { pattern in
            // if (suggestedAction === 'watch' && number(severityAvg) < 2) return false
            if pattern.suggestedAction == .watch && number(pattern.severityAvg) < 2 { return false }
            let area = normalizeKey(pattern.area)
            let directFamilyRisk =
                (templateId.contains("push") && containsAnyAreaItem(area, ["chest", "shoulder", "triceps", "arm", "胸", "肩", "手臂"]))
                || (templateId.contains("pull") && containsAnyAreaItem(area, ["back", "lat", "biceps", "背", "背阔肌"]))
                || ((templateId.contains("leg") || templateId.contains("lower")) && containsAnyAreaItem(area, ["leg", "knee", "quad", "hamstring", "glute", "calf", "腿", "膝", "臀", "小腿"]))
            if directFamilyRisk { return true }
            let keys = painAreaKeys(pattern)
            if keys.contains(where: { muscles.contains($0) }) { return true }
            if let exerciseId = truthy(pattern.exerciseId) {
                return (template.exercises ?? []).contains { $0.id == exerciseId || $0.baseId == exerciseId }
            }
            return false
        }
        let directRisk = directPainRiskForTemplate(template, painPatterns)
        // riskScore = relevant.reduce((s,i) => s + max(1, number(freq)) * max(1, number(sev)), 0) || (directRisk ? 1 : 0)
        let sum = relevant.reduce(0.0) { acc, item in
            acc + max(1, number(Double(item.frequency))) * max(1, number(item.severityAvg))
        }
        let riskScore = sum != 0 ? sum : (directRisk ? 1 : 0)
        return PainRisk(riskScore: riskScore, patterns: relevant)
    }

    // MARK: - weeklyDeficitEntries (nextWorkoutScheduler.ts:289-312)

    private struct DeficitEntry {
        let muscle: String
        let key: String
        let label: String
        let deficit: Double
    }

    /// `weeklyDeficitEntries` (ts:289): rows (from `muscles[]`) ++ map entries (from `byMuscle`),
    /// each → `{muscle, remaining, target, done}`, then `{key, label, deficit}`, kept when
    /// `muscle && deficit >= 2`, sorted by deficit DESC (stable).
    private static func weeklyDeficitEntries(_ summary: WeeklyVolumeSummaryInput?) -> [DeficitEntry] {
        guard let summary else { return [] }  // if (!summary) return []
        // fromRows (ts:291-296)
        let fromRows = (summary.muscles ?? []).map { row -> (muscle: String, remaining: Double, target: Double, done: Double) in
            (
                muscle: truthy(row.muscle) ?? truthy(row.muscleId) ?? "",  // String(row.muscle || row.muscleId || '')
                remaining: number(row.remainingSets ?? row.remaining),
                target: number(row.targetSets ?? row.target),
                done: number(row.weightedEffectiveSets ?? row.effectiveSets ?? row.completedSets ?? row.sets)
            )
        }
        // fromMap (ts:297-302) — muscle is the map KEY
        let fromMap = (summary.byMuscle ?? []).map { entry -> (muscle: String, remaining: Double, target: Double, done: Double) in
            (
                muscle: entry.key,
                remaining: number(entry.row.remainingSets ?? entry.row.remaining),
                target: number(entry.row.targetSets ?? entry.row.target),
                done: number(entry.row.weightedEffectiveSets ?? entry.row.effectiveSets ?? entry.row.completedSets ?? entry.row.sets)
            )
        }
        let combined = (fromRows + fromMap).map { row -> DeficitEntry in
            DeficitEntry(
                muscle: row.muscle,
                key: normalizeKey(row.muscle),
                label: VolumeAdaptationEngine.formatMuscleName(row.muscle),
                deficit: row.remaining != 0 ? row.remaining : max(0, row.target - row.done)  // remaining || max(0, target - done)
            )
        }
        let filtered = combined.filter { !$0.muscle.isEmpty && $0.deficit >= 2 }  // muscle && deficit >= 2
        return stableSorted(filtered) { left, right in
            // (l,r) => r.deficit - l.deficit  (DESC)
            right.deficit < left.deficit ? -1 : (right.deficit > left.deficit ? 1 : 0)
        }
    }

    // MARK: - candidateFor (nextWorkoutScheduler.ts:314-322)

    private struct TemplateCandidate {
        let template: TrainingTemplate
        let muscles: Set<String>
        let riskScore: Double
        let deficitScore: Double
        let reasons: [String]
        let warnings: [String]
    }

    /// `candidateFor` (ts:314): per-template risk score + matching-deficit score + the (≤2) reason
    /// and (≤2) warning strings.
    private static func candidateFor(_ template: TrainingTemplate, _ painPatterns: [PainPatternEngine.PainPattern], _ deficits: [DeficitEntry]) -> TemplateCandidate {
        let muscles = templateMuscles(template)
        let pain = hasPainRisk(template, painPatterns)
        let matchingDeficits = deficits.filter { muscles.contains($0.key) }
        let deficitScore = matchingDeficits.reduce(0.0) { $0 + $1.deficit }
        let reasons = matchingDeficits.prefix(2).map { row in
            // `${row.label}本周训练量还差约 ${Math.round(row.deficit*10)/10} 组。`
            "\(row.label)本周训练量还差约 \(AnalyticsDashboardEngine.jsNumberString(AnalyticsDashboardEngine.roundOne(row.deficit))) 组。"
        }
        let warnings = pain.patterns.prefix(2).map { pattern in
            "\(VolumeAdaptationEngine.formatMuscleName(pattern.area))近期有不适记录，建议避免直接安排高风险训练日。"
        }
        return TemplateCandidate(template: template, muscles: muscles, riskScore: pain.riskScore, deficitScore: deficitScore, reasons: reasons, warnings: warnings)
    }

    // MARK: - lowLoadTemplate (nextWorkoutScheduler.ts:324-326)

    /// `lowLoadTemplate` (ts:324): the 'quick-30' template, else the shortest-duration one.
    private static func lowLoadTemplate(_ templates: [TrainingTemplate]) -> TrainingTemplate? {
        if let quick = templates.first(where: { $0.id == "quick-30" }) { return quick }
        // [...templates].sort((l,r) => l.duration - r.duration)[0]
        return stableSorted(templates) { left, right in
            let l = left.duration?.doubleValue ?? 0, r = right.duration?.doubleValue ?? 0
            return l < r ? -1 : (l > r ? 1 : 0)
        }.first
    }

    // MARK: - alternativesFor (nextWorkoutScheduler.ts:328-340)

    /// `alternativesFor` (ts:328): up to 3 non-selected templates, each with the candidate's first
    /// warning / first reason / the default备选 line.
    private static func alternativesFor(_ templates: [TrainingTemplate], _ selected: TrainingTemplate, _ candidates: [TemplateCandidate]) -> [NextWorkoutRecommendation.Alternative] {
        templates
            .filter { $0.id != selected.id }
            .prefix(3)
            .map { template in
                let candidate = candidates.first { $0.template.id == template.id }
                // candidate?.warnings[0] || candidate?.reasons[0] || '作为备选训练日…'
                let reason = candidate?.warnings.first
                    ?? candidate?.reasons.first
                    ?? "作为备选训练日，可在时间、器械或恢复状态变化时手动选择。"
                return NextWorkoutRecommendation.Alternative(
                    templateId: template.id ?? "",
                    templateName: localizedTemplateName(template),
                    reason: reason
                )
            }
    }

    // MARK: - appendWarning (nextWorkoutScheduler.ts:342-344)

    /// `appendWarning` (ts:342): push when truthy + not already present.
    private static func appendWarning(_ warnings: inout [String], _ value: String?) {
        if let value, !value.isEmpty, !warnings.contains(value) { warnings.append(value) }
    }

    // MARK: - buildNextWorkoutRecommendation (nextWorkoutScheduler.ts:346-534) — EXPORT

    public static func buildNextWorkoutRecommendation(
        history: [TrainingSession] = [],
        activeSession: TrainingSession? = nil,
        programTemplate: ProgramTemplate? = nil,
        templates: [TrainingTemplate] = [],
        todayState: TodayStateEngine.TodayTrainingState? = nil,
        weeklyVolumeSummary: WeeklyVolumeSummaryInput? = nil,
        painPatterns: [PainPatternEngine.PainPattern] = [],
        sorenessAreas: [String] = [],
        painAreas: [String] = [],
        readinessResult: ReadinessResult? = nil,
        trainingMode: String? = nil
    ) -> NextWorkoutRecommendation {
        // ts:359-369 — an open (incomplete) active session short-circuits everything.
        if let activeSession, activeSession.completed != true {
            return NextWorkoutRecommendation(
                kind: .train,
                plannedTemplateId: nil,
                plannedTemplateName: nil,
                recommendedTemplateId: nil,
                overrideReason: nil,
                templateId: activeSession._unknown["templateId"]?.stringValue,
                templateName: localizedTemplateName(session: activeSession),
                confidence: .high,
                reason: "今天已有进行中的训练，优先继续\(localizedTemplateName(session: activeSession))。系统不会生成覆盖当前训练的下次建议。",
                warnings: [],
                conflictLevel: nil,
                recovery: nil,
                alternatives: []
            )
        }

        let orderedResult = getOrderedTrainingTemplates(templates, programTemplate)
        let ordered = orderedResult.templates
        if ordered.isEmpty {
            // ts:373-382
            return NextWorkoutRecommendation(
                kind: .activeRecovery,
                plannedTemplateId: nil,
                plannedTemplateName: nil,
                recommendedTemplateId: nil,
                overrideReason: nil,
                templateId: nil,
                templateName: "暂无下次建议",
                confidence: .low,
                reason: "当前没有可用训练模板，因此暂时无法判断下次练什么。",
                warnings: ["请先确认训练计划中至少有一个可用模板。"],
                conflictLevel: nil,
                recovery: nil,
                alternatives: []
            )
        }

        let normalCompleted = completedHistory(history)
        // todayState?.status === 'completed' ? todayState.lastCompletedSessionId : undefined  (ts:385)
        let todayCompletedId = todayState?.status == "completed" ? todayState?.lastCompletedSessionId : nil
        // (todayCompletedId ? normalCompleted.find(s => s.id === todayCompletedId) : undefined) || normalCompleted[0]  (ts:386)
        let anchorSession: TrainingSession? = {
            if let todayCompletedId, let match = normalCompleted.first(where: { $0.id == todayCompletedId }) { return match }
            return normalCompleted.first
        }()
        let anchorTemplateKey = resolveSessionTemplateKey(anchorSession, ordered, programTemplate)  // ts:387
        let cycleTemplates = cycleTemplatesFor(ordered, anchorTemplateKey)  // ts:388
        let cycleState = WorkoutCycleScheduler.buildWorkoutCycleState(
            history: history,
            orderedTemplateIds: cycleTemplates.map { $0.id ?? "" },
            currentDate: todayState?.date
        )  // ts:389-393
        let cycleTemplate = ordered.first { templateMatchesKey($0, cycleState.nextTemplateId) }  // ts:394
        let rotationTemplate = nextByDefaultRotation(anchorTemplateKey, ordered, !orderedResult.usedProgramOrder)  // ts:395
        // shouldUseCycleTemplate (ts:396)
        let shouldUseCycleTemplate = anchorSession == nil || cycleState.isCycleComplete || cycleState.completedInCurrentCycle.count > 1
        // baseTemplate = (shouldUse ? cycleTemplate : rotationTemplate) || cycleTemplate || rotationTemplate || ordered[0]  (ts:397)
        let baseTemplate = (shouldUseCycleTemplate ? cycleTemplate : rotationTemplate) ?? cycleTemplate ?? rotationTemplate ?? ordered[0]
        let plannedTemplateId = baseTemplate.id  // ts:398
        let plannedTemplateName = localizedTemplateName(baseTemplate)  // ts:399
        let deficits = weeklyDeficitEntries(weeklyVolumeSummary)  // ts:400
        let candidates = ordered.map { candidateFor($0, painPatterns, deficits) }  // ts:401
        // readinessScore = readinessResult?.score; readinessLow = typeof === 'number' && < 50  (ts:402-403)
        let readinessLow = readinessResult.map { $0.score < 50 } ?? false

        var selected = baseTemplate  // ts:405
        var warnings: [String] = []  // ts:406
        var reasonParts: [String] = []  // ts:407
        var scheduleOverrideReason: String?  // ts:408
        let modeLabel = truthy(trainingMode).map { SchedulingFormatters.formatTrainingMode($0) } ?? ""  // ts:409

        reasonParts.append("按计划轮转判断：\(cycleState.reason)")  // ts:411
        if anchorSession == nil {
            reasonParts.append("还没有可用于轮转的正式训练记录，先从\(localizedTemplateName(baseTemplate))开始。")  // ts:413
        }
        if todayState?.status == "completed" {
            reasonParts.append("这是下次建议，不会覆盖今天已经完成的训练状态。")  // ts:417
        }
        if !modeLabel.isEmpty {
            reasonParts.append("当前训练侧重为\(modeLabel)，仅用于解释本次建议，不会改变计划顺序。")  // ts:420
        }

        // ts:422-435
        if readinessLow {
            let lowLoad = lowLoadTemplate(ordered)
            if let lowLoad, lowLoad.id != selected.id {
                appendWarning(&warnings, "准备度较低，建议把下次训练作为恢复或低负荷日执行。")
                selected = lowLoad
                scheduleOverrideReason = "原计划下次是 \(plannedTemplateName)，但准备度较低，因此当前建议改为 \(localizedTemplateName(selected)) 或低负荷安排。"
                reasonParts.append(scheduleOverrideReason!)
            } else {
                appendWarning(&warnings, "准备度较低，建议降低负荷、减少组数或缩短训练。")
                reasonParts.append("准备度较低，建议保守执行下次训练。")
            }
        } else if let adjustment = readinessResult?.trainingAdjustment, adjustment == .conservative || adjustment == .recovery {
            appendWarning(&warnings, "当前恢复状态提示需要保守执行。")
        }

        // ts:437-440
        if let anchorSession, selected.id == anchorSession._unknown["templateId"]?.stringValue {
            appendWarning(&warnings, "下次建议仍是\(localizedTemplateName(selected))，请确认这是因为计划里没有更合适的备选，或近期不适、训练量不足导致需要重复。")
            reasonParts.append("本次出现重复模板，是因为其他模板存在更高风险或计划中缺少可用备选。")
        }

        // ts:442-443
        let selectedCandidate = candidates.first { $0.template.id == selected.id }
        selectedCandidate?.warnings.forEach { appendWarning(&warnings, $0) }

        // ts:444-450
        let baseRotationFamily = rotationFamilyKey(baseTemplate)
        let familyRecoveryTemplates = baseRotationFamily.isEmpty
            ? []
            : ordered.filter { rotationFamilyKey($0) == baseRotationFamily }
        let recoveryTemplates = (familyRecoveryTemplates.count > 1 ? familyRecoveryTemplates : ordered).filter { template in
            template.id == selected.id || !templateMatchesKey(template, anchorTemplateKey)
        }
        let recoverySorenessAreas = sorenessAreas + painPatterns.map { $0.area }  // ts:451
        let recoveryPainAreas = painAreas  // ts:452

        // number(todayState && 'availableTimeMin' in todayState ? todayState.availableTimeMin : undefined)
        // (ts:460/477). The Swift TodayTrainingState models no `availableTimeMin` and carries no
        // open bag, so the `'availableTimeMin' in todayState` guard is never satisfied →
        // number(undefined) = 0. Passed through both buildRecoveryAwareRecommendation calls.
        let availableTimeMin = 0.0

        // ts:454-461
        var recovery = RecoveryAwareScheduler.buildRecoveryAwareRecommendation(
            preferredTemplate: selected,
            templates: recoveryTemplates.isEmpty ? ordered : recoveryTemplates,
            sorenessAreas: recoverySorenessAreas,
            painAreas: recoveryPainAreas,
            readinessResult: readinessResult,
            availableTimeMin: availableTimeMin
        )

        // ts:462-480 — when recovery says rest/active_recovery but readiness is fine, look for a
        // lower-conflict fallback template to recompute against.
        if (recovery.kind == .rest || recovery.kind == .activeRecovery) && !readinessLow {
            let pool = recoveryTemplates.isEmpty ? ordered : recoveryTemplates
            let fallbackTemplate = pool
                .filter { $0.id != selected.id }
                .first { template in
                    let conflict = RecoveryAwareScheduler.buildTemplateRecoveryConflict(
                        template: template,
                        sorenessAreas: recoverySorenessAreas,
                        painAreas: recoveryPainAreas,
                        readinessResult: readinessResult
                    )
                    return conflict.kind == .modifiedTrain || conflict.conflictLevel == .low || conflict.conflictLevel == .none
                }
            if let fallbackTemplate {
                recovery = RecoveryAwareScheduler.buildRecoveryAwareRecommendation(
                    preferredTemplate: fallbackTemplate,
                    templates: pool,
                    sorenessAreas: recoverySorenessAreas,
                    painAreas: recoveryPainAreas,
                    readinessResult: readinessResult,
                    availableTimeMin: availableTimeMin
                )
            }
        }

        // ts:481-484
        if recovery.kind != .train || recovery.templateId != selected.id || recovery.conflictLevel != .none {
            reasonParts.append(recovery.summary)
            recovery.reasons.prefix(2).forEach { appendWarning(&warnings, $0) }
        }
        // ts:485-493
        if let recoveryTemplateId = truthy(recovery.templateId), recoveryTemplateId != selected.id {
            if let recoveryTemplate = ordered.first(where: { $0.id == recoveryTemplateId }) {
                selected = recoveryTemplate
                scheduleOverrideReason = "原计划下次是 \(plannedTemplateName)，但近期不适或恢复信号与该训练日冲突，因此当前建议改为 \(localizedTemplateName(selected))。"
                reasonParts.append(scheduleOverrideReason!)
                appendWarning(&warnings, scheduleOverrideReason)
            }
        }

        // confidence (ts:495-500)
        let confidence: NextWorkoutRecommendation.Confidence = {
            if anchorSession == nil || readinessLow || warnings.count >= 2 || recovery.kind != .train {
                return .low
            }
            if selected.id != baseTemplate.id || !warnings.isEmpty || recovery.conflictLevel != .none {
                return .medium
            }
            return .high
        }()

        // ts:502-517 — rest / active_recovery / mobility_only return.
        if recovery.kind == .rest || recovery.kind == .activeRecovery || recovery.kind == .mobilityOnly {
            // recovery.templateName || recovery.title.replace('今日建议：', '')  (ts:509)
            let templateName = truthy(recovery.templateName) ?? recovery.title.replacingOccurrences(of: "今日建议：", with: "")
            return NextWorkoutRecommendation(
                kind: recovery.kind,
                plannedTemplateId: plannedTemplateId,
                plannedTemplateName: plannedTemplateName,
                recommendedTemplateId: recovery.templateId,
                overrideReason: truthy(scheduleOverrideReason) ?? recovery.summary,  // scheduleOverrideReason || recovery.summary
                templateId: nil,
                templateName: templateName,
                confidence: confidence,
                reason: reasonParts.joined(separator: " "),
                warnings: warnings,
                conflictLevel: recovery.conflictLevel,
                recovery: recovery,
                alternatives: alternativesFor(ordered, selected, candidates)
            )
        }

        // ts:519-533 — train / modified_train return.
        return NextWorkoutRecommendation(
            kind: recovery.kind,
            plannedTemplateId: plannedTemplateId,
            plannedTemplateName: plannedTemplateName,
            recommendedTemplateId: selected.id,
            // selected.id !== baseTemplate.id ? scheduleOverrideReason || recovery.summary : undefined  (ts:524)
            overrideReason: selected.id != baseTemplate.id ? (truthy(scheduleOverrideReason) ?? recovery.summary) : nil,
            templateId: selected.id,
            templateName: localizedTemplateName(selected),
            confidence: confidence,
            reason: reasonParts.joined(separator: " "),
            warnings: warnings,
            conflictLevel: recovery.conflictLevel,
            recovery: recovery,
            alternatives: alternativesFor(ordered, selected, candidates)
        )
    }

    // MARK: - stableSorted (JS `Array.prototype.sort` stability)

    /// A STABLE sort driven by a JS-style three-way comparator (negative = left first). Ties keep
    /// original order, mirroring `Array.prototype.sort`'s guaranteed stability — the same helper
    /// shape each already-ported scheduling engine carries.
    private static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }
}
