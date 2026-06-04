// ProgramAdjustmentEngine — PA-S8 (PA-1b) selectBestDayForNewExercise + buildAdjustmentDiff port.
//
// Faithful line-by-line Swift port of the TWO data-dense PURE / read-only exports of
// `src/engines/programAdjustmentEngine.ts` plus EVERY private helper they reach:
//   * selectBestDayForNewExercise (programAdjustmentEngine.ts:259-326)
//   * buildAdjustmentDiff         (programAdjustmentEngine.ts:709-789)
//   helpers: buildExerciseSeed(:190) / findExerciseSeed(:187) / exerciseKindFromId(:181)
//   / chooseInsertAnchor(:246) / muscleDayKeywords(:228) / hasPainRestriction(:238)
//   / dayTemplateFromTrainingTemplate(:141) / buildProgramDayTemplates(:151)
//   / findTemplateById(:179) / exerciseMatchesId(:154) / matchesMuscle(:162)
//   / findExerciseIndex(:171) / applyExerciseChange(:657) / buildNewExerciseTemplate(:641)
//   / estimateSetDurationMin(:635) / applySupportChange(:569) / ensureProgramDayTemplate(:536)
//   / pickSupportModuleForDay(:554) / pickFunctionalAddonForDay(:562) / summarizeSupportState(:521)
//   / stepStrategy(:527) / riskLevelForChange(:701) / cloneTemplate(:132) / cloneProgram(:133)
//   / changeTypeLabel(:67) / correctionStrategyOrder(:77) / functionalStrategyOrder(:78)
//   + the input/result types DaySelectionResult(:44) / NewExerciseSelectionContext(:53)
//   / AdjustmentDraftContext(:37).
//
// SCOPE BOUNDARY (PA-1b): the engine's other exports
// (createAdjustmentDraftFromRecommendations / applyAdjustmentDraft / hashProgramTemplate
// [PA-S7] / rollbackAdjustment [PA-S7]) and the helpers private to THEM
// (changeFromRecommendation / resolveSourceTemplateForRecommendation /
// buildAdjustmentChangeId / stableStringify / makeId / highestConfidence /
// riskLevelForDraft*) and planAdjustmentIdentityEngine are OUT of this slice.
//
// PURE / READ-ONLY — ZERO WRITES: `buildAdjustmentDiff` / `applyExerciseChange` /
// `applySupportChange` compute the diff PREVIEW on CLONES only and RETURN the result;
// they never persist, never call CanonicalSessionWriter / JSONFileAppDataStore / any §8
// write boundary (applying a draft to source-of-truth is the later PA write slice).
// Zero `: Date`, zero Calendar, zero clock (neither function reads the wall clock —
// the `new Date()` at ts:829 lives in applyAdjustmentDraft, NOT in this slice), zero IO,
// zero randomness.
//
// REUSES (never re-ports) the already-ported building blocks:
//   * PA-S1 IronPathDomain types verbatim (ProgramTemplate(+PARich) / DayTemplate /
//     ExerciseTemplate / TrainingTemplate / AdjustmentChange / AdjustmentChangeType /
//     ProgramAdjustmentDraft / ProgramAdjustmentDiff / EstimateConfidence / ScreeningProfile);
//   * S2 EngineUtils.enrichExercise (engineUtils.ts:196) — the EMPTY-override PINNED
//     branch: the full EXERCISE_KNOWLEDGE_OVERRIDES value table is a different slice's
//     data port; the ONLY override-derived field these two functions can observe is
//     `seeded.fatigueCost` (→ selectBestDay's `highFatigue`), and the parity fixtures use
//     compound / synthetic ids so the empty-override fatigueCost is output-equivalent;
//   * S2 deep-clone EngineValueUtils.clone (= TS `clone` = JSON.parse(JSON.stringify));
//   * S2/E1RMEngine.number (= TS `number`); S3 data tables (DefaultTrainingData.* /
//     SupportModules.* / ExerciseLibrary.displayNames); S4 formatters — formatExerciseName
//     via the in-package ExerciseLibrary.formatExerciseDisplayName.
//
// FORMATTER NOTE (formatDayTemplateName / formatProgramTemplateName): the canonical
// Swift port of these two lives in `IronPathL10n.Formatters` (PA-S4). IronPathL10n is a
// SEPARATE leaf package that IronPathTrainingDecision does NOT depend on — and the repo's
// package-graph contract (iosBootstrapPackageGraph / iosTrainingDecisionSwiftEngine /
// iosTrainingDecisionTypeSkeleton static guards) explicitly pins IPTD's allowed deps to
// {IronPathDomain, IronPathDataHealth}. Adding an IPTD -> IronPathL10n edge would break
// that contract in four places. So this slice mirrors the narrow `formatTemplateName`
// chain LOCALLY below (formatters.ts:187-208 / TEMPLATE_NAME_MAP ts:62-83 /
// normalizeDisplayKey ts:27-33 / localizeTemplateNameText ts:178-185), entry-by-entry
// faithful to the SAME TS source the L10n copy mirrors. The build-diff goldens
// mechanically reconcile this transcription (the support / add_new cases run both
// formatters), so no map entry, regex, or fallback string can drift.
//
// Goldens are GENERATED from the REAL TS engine (scripts/generate-parity-goldens.mjs),
// never hand-edited (§22); the function-level compute-assert is the byte-level judge.

import Foundation
import IronPathDomain

extension ProgramAdjustmentEngine {

    // MARK: - Input / result types (programAdjustmentEngine.ts:37-55)

    /// The TS `exercise: string | ExerciseTemplate` first parameter of
    /// `selectBestDayForNewExercise` (ts:260).
    public enum ExerciseRef: Equatable, Sendable {
        case id(String)
        case template(ExerciseTemplate)
    }

    /// The single PainPattern shape `hasPainRestriction` (ts:238-244) reads: only
    /// `exerciseId` + `suggestedAction` are consulted (the TS `PainPattern` carries
    /// more fields, but this slice's diff/select path reads exactly these two — a
    /// bounded per-consumer projection, like PlateauDetectionEngine.PainPattern).
    public struct DraftPainPattern: Equatable, Sendable {
        public let exerciseId: String?
        public let suggestedAction: String?
        public init(exerciseId: String? = nil, suggestedAction: String? = nil) {
            self.exerciseId = exerciseId
            self.suggestedAction = suggestedAction
        }
    }

    /// `AdjustmentDraftContext` (programAdjustmentEngine.ts:37-42).
    public struct AdjustmentDraftContext: Equatable, Sendable {
        public let programTemplate: ProgramTemplate?
        public let templates: [TrainingTemplate]?
        public let screeningProfile: ScreeningProfile?
        public let painPatterns: [DraftPainPattern]?
        public init(
            programTemplate: ProgramTemplate? = nil,
            templates: [TrainingTemplate]? = nil,
            screeningProfile: ScreeningProfile? = nil,
            painPatterns: [DraftPainPattern]? = nil
        ) {
            self.programTemplate = programTemplate
            self.templates = templates
            self.screeningProfile = screeningProfile
            self.painPatterns = painPatterns
        }
    }

    /// `NewExerciseSelectionContext extends AdjustmentDraftContext` (ts:53-55) — adds
    /// `sourceTemplateId`. Modelled as composition (Swift has no struct inheritance).
    public struct NewExerciseSelectionContext: Equatable, Sendable {
        public let programTemplate: ProgramTemplate?
        public let templates: [TrainingTemplate]?
        public let screeningProfile: ScreeningProfile?
        public let painPatterns: [DraftPainPattern]?
        public let sourceTemplateId: String?
        public init(
            programTemplate: ProgramTemplate? = nil,
            templates: [TrainingTemplate]? = nil,
            screeningProfile: ScreeningProfile? = nil,
            painPatterns: [DraftPainPattern]? = nil,
            sourceTemplateId: String? = nil
        ) {
            self.programTemplate = programTemplate
            self.templates = templates
            self.screeningProfile = screeningProfile
            self.painPatterns = painPatterns
            self.sourceTemplateId = sourceTemplateId
        }
    }

    /// `DaySelectionResult` (programAdjustmentEngine.ts:44-51). `confidence` is the only
    /// required field; the rest are optional (omitted, not null, when absent — matching
    /// JSON.stringify dropping `undefined`).
    public struct DaySelectionResult: Equatable, Sendable {
        public let dayTemplateId: String?
        public let dayTemplateName: String?
        public let confidence: EstimateConfidence
        public let note: String?
        public let insertAfterExerciseId: String?
        public let insertPositionLabel: String?
        public init(
            dayTemplateId: String? = nil,
            dayTemplateName: String? = nil,
            confidence: EstimateConfidence,
            note: String? = nil,
            insertAfterExerciseId: String? = nil,
            insertPositionLabel: String? = nil
        ) {
            self.dayTemplateId = dayTemplateId
            self.dayTemplateName = dayTemplateName
            self.confidence = confidence
            self.note = note
            self.insertAfterExerciseId = insertAfterExerciseId
            self.insertPositionLabel = insertPositionLabel
        }
    }

    // MARK: - changeTypeLabel + strategy orders (programAdjustmentEngine.ts:67-78)

    /// `changeTypeLabel` (ts:67-75). Total over `AdjustmentChangeType`, so the
    /// `|| formatAdjustmentChangeLabel(...)` fallback at ts:776 is unreachable for a
    /// valid enum type (the fallback is still wired through, defensively, for a nil type).
    static let changeTypeLabel: [AdjustmentChangeType: String] = [
        .addSets: "增加组数",          // ts:68
        .removeSets: "减少组数",       // ts:69
        .addNewExercise: "新增动作",   // ts:70
        .swapExercise: "替代动作",     // ts:71
        .reduceSupport: "减少 support", // ts:72
        .increaseSupport: "增加 support", // ts:73
        .keep: "保持当前结构",         // ts:74
    ]

    /// `correctionStrategyOrder` (ts:77) / `functionalStrategyOrder` (ts:78).
    static let correctionStrategyOrder: [String] = ["light", "moderate", "aggressive"]
    static let functionalStrategyOrder: [String] = ["minimal", "standard", "enhanced"]

    // MARK: - selectBestDayForNewExercise (programAdjustmentEngine.ts:259-326)

    /// `selectBestDayForNewExercise(exercise, programTemplate, targetMuscleId, context)`
    /// (programAdjustmentEngine.ts:259). PURE / clockless.
    public static func selectBestDayForNewExercise(
        _ exercise: ExerciseRef,
        programTemplate: ProgramTemplate,
        targetMuscleId: String? = nil,
        context: NewExerciseSelectionContext = NewExerciseSelectionContext()
    ) -> DaySelectionResult {
        // const seeded = typeof exercise === 'string'
        //   ? buildExerciseSeed(exercise, targetMuscleId)
        //   : enrichExercise(clone(exercise));  (ts:265)
        let seeded: ExerciseTemplate
        switch exercise {
        case .id(let s):
            seeded = buildExerciseSeed(s, targetMuscleId)
        case .template(let ex):
            seeded = EngineUtils.enrichExercise(cloneExercise(ex))
        }
        // const templates = context.templates?.length ? context.templates : INITIAL_TEMPLATES;  (ts:266)
        let templates: [TrainingTemplate] =
            (context.templates?.isEmpty == false) ? context.templates! : DefaultTrainingData.initialTemplates
        // const dayTemplates = buildProgramDayTemplates(programTemplate, templates);  (ts:267)
        let dayTemplates = buildProgramDayTemplates(programTemplate, templates)

        // if (hasPainRestriction(seeded.id, context.screeningProfile || DEFAULT_SCREENING_PROFILE,
        //     context.painPatterns || [])) { return { confidence: 'low', note: ... } }  (ts:269-274)
        if hasPainRestriction(
            seeded.id,
            context.screeningProfile ?? DefaultTrainingData.defaultScreeningProfile,
            context.painPatterns ?? []
        ) {
            return DaySelectionResult(
                confidence: .low,
                note: "\(formatExerciseName(.template(seeded))) 近期受到 pain 或 restricted 信号影响，系统不会自动插入。"
            )
        }

        // const keywords = muscleDayKeywords(targetMuscleId);  (ts:276)
        let keywords = muscleDayKeywords(targetMuscleId)
        // const ranked = dayTemplates.map(...).sort((l, r) => r.score - l.score);  (ts:277-297)
        let scored: [RankedDay] = dayTemplates.map { day in
            // const template = findTemplateById(templates, day.id);  (ts:279)
            let template = findTemplateById(templates, day.id)
            // const haystack = `${day.id} ${day.name}`.toLowerCase();  (ts:280)
            let haystack = "\(day.id ?? "undefined") \(day.name ?? "undefined")".lowercased()
            // const trainsTarget = (day.focusMuscles || []).includes(targetMuscleId);  (ts:281)
            let trainsTarget = targetMuscleId.map { (day.focusMuscles ?? []).contains($0) } ?? false
            // const longDay = number(day.estimatedDurationMin || template?.duration) >= 85;  (ts:282)
            let durSource: NumberRepr? = jsTruthyNumber(day.estimatedDurationMin) ? day.estimatedDurationMin : template?.duration
            let longDay = E1RMEngine.number(durSource) >= 85
            // const highFatigue = seeded.fatigueCost === 'high' || seeded.kind === 'compound';  (ts:283)
            let highFatigue = (seeded.fatigueCost == "high") || (seeded.kind == "compound")
            // const score = (trainsTarget?4:0) + (keyword match?3:0)
            //   + (day.id === context.sourceTemplateId?1:0) - (longDay && highFatigue?3:0);  (ts:284-288)
            let score =
                (trainsTarget ? 4 : 0)
                + (keywords.contains(where: { haystack.contains($0) }) ? 3 : 0)
                + ((day.id == context.sourceTemplateId) ? 1 : 0)
                - ((longDay && highFatigue) ? 3 : 0)
            let anchor = chooseInsertAnchor(template)  // ...chooseInsertAnchor(template) (ts:294)
            return RankedDay(
                day: day, score: score, longDay: longDay,
                insertAfterExerciseId: anchor.insertAfterExerciseId,
                insertPositionLabel: anchor.insertPositionLabel
            )
        }
        // .sort((left, right) => right.score - left.score)  (ts:297) — JS stable sort.
        let ranked = stableSorted(scored) { left, right in right.score - left.score }

        // const best = ranked[0];  (ts:299)
        guard let best = ranked.first else {
            // if (!best) { ... }  (ts:300-305). Unreachable when INITIAL_TEMPLATES is
            // non-empty (templates is never empty, so dayTemplates is never empty); ported
            // for faithfulness — the generator cannot reach it from real TS either.
            return DaySelectionResult(
                confidence: .low,
                note: "没有找到可安全插入新动作的训练日，请手动选择训练日。"
            )
        }

        // if (best.score < 2) { ... confidence 'low' ... }  (ts:307-316)
        if best.score < 2 {
            return DaySelectionResult(
                dayTemplateId: best.day.id,
                dayTemplateName: best.day.name,
                confidence: .low,
                note: "系统可以给出候选训练日，但当前把握不高，建议你手动确认。",
                insertAfterExerciseId: best.insertAfterExerciseId,
                insertPositionLabel: best.insertPositionLabel
            )
        }

        // return { confidence: best.longDay ? 'medium' : 'high', note: best.longDay ? ... : undefined, ... }  (ts:318-325)
        return DaySelectionResult(
            dayTemplateId: best.day.id,
            dayTemplateName: best.day.name,
            confidence: best.longDay ? .medium : .high,
            note: best.longDay ? "该训练日已经偏长，系统会把新动作尽量放在辅助动作区。" : nil,
            insertAfterExerciseId: best.insertAfterExerciseId,
            insertPositionLabel: best.insertPositionLabel
        )
    }

    /// One mapped entry of the `ranked` array (ts:289-295) used by the selection.
    private struct RankedDay {
        let day: DayTemplate
        let score: Int
        let longDay: Bool
        let insertAfterExerciseId: String?
        let insertPositionLabel: String
    }

    // MARK: - buildAdjustmentDiff (programAdjustmentEngine.ts:709-789)

    /// `buildAdjustmentDiff(draft, sourceProgramTemplate, programTemplate, templates)`
    /// (programAdjustmentEngine.ts:709). PURE / clockless / ZERO writes (preview on
    /// clones, returns the diff). `programTemplate` defaults to DEFAULT_PROGRAM_TEMPLATE
    /// (ts:712) and `templates` to `[sourceProgramTemplate]` (ts:713) when omitted.
    public static func buildAdjustmentDiff(
        draft: ProgramAdjustmentDraft,
        sourceProgramTemplate: TrainingTemplate,
        programTemplate: ProgramTemplate? = nil,
        templates: [TrainingTemplate]? = nil
    ) -> ProgramAdjustmentDiff {
        let program = programTemplate ?? DefaultTrainingData.defaultProgramTemplate     // ts:712 default
        let templateList = templates ?? [sourceProgramTemplate]                         // ts:713 default

        // const templateMap = new Map(templates.map(t => [t.id, cloneTemplate(t)]));  (ts:715)
        // Last write wins on duplicate ids (JS Map). WTemplate is a value type, so each
        // conversion is a deep clone (= cloneTemplate).
        var templateMap: [String: WTemplate] = [:]
        for t in templateList {
            if let id = t.id { templateMap[id] = WTemplate(from: t) }
        }
        // if (!templateMap.has(source.id)) templateMap.set(source.id, cloneTemplate(source));  (ts:716)
        if let srcId = sourceProgramTemplate.id, templateMap[srcId] == nil {
            templateMap[srcId] = WTemplate(from: sourceProgramTemplate)
        }
        // const previewProgram = cloneProgram(programTemplate);  (ts:717) — cumulative across changes.
        let previewProgram = WProgram(from: program)

        // const changes = draft.changes.map((change) => { ... });  (ts:719-782)
        var rows: [JSONValue] = []
        for change in (draft.changes ?? []) {
            // const targetTemplate = templateMap.get(change.dayTemplateId || draft.sourceProgramTemplateId)
            //   || cloneTemplate(sourceProgramTemplate);  (ts:720)
            let key = jsOrString(change.dayTemplateId, draft.sourceProgramTemplateId)
            let targetTemplate = key.flatMap { templateMap[$0] } ?? WTemplate(from: sourceProgramTemplate)

            var before = "保持当前结构"   // ts:721
            var after = "保持当前结构"     // ts:722
            var note = change.previewNote ?? ""  // let note = change.previewNote || '';  (ts:723)
            var applied = false           // ts:724

            // if (change.type === 'add_sets' || change.type === 'remove_sets') { ... }  (ts:726-739)
            if change.type == .addSets || change.type == .removeSets {
                let index = findExerciseIndex(targetTemplate, change)
                let exercise: MutObj? = index >= 0 ? targetTemplate.exercises[index] : nil
                if let exercise {
                    // before = `${formatExerciseName(exercise)}：${number(exercise.sets)} 组`;  (ts:730)
                    before = "\(formatExerciseName(exercise.json))：\(jsNumString(E1RMEngine.number(exercise["sets"]))) 组"
                    var previewTemplate = targetTemplate  // const previewTemplate = cloneTemplate(targetTemplate);  (ts:731)
                    applied = applyExerciseChange(&previewTemplate, change)  // ts:732
                    let previewExercise = previewTemplate.exercises[index]  // ts:733
                    // after = `${formatExerciseName(previewExercise)}：${number(previewExercise.sets)} 组`;  (ts:734)
                    after = "\(formatExerciseName(previewExercise.json))：\(jsNumString(E1RMEngine.number(previewExercise["sets"]))) 组"
                } else {
                    before = "当前模板里没有找到可直接调整的动作"  // ts:736
                    after = "需要你手动确认具体动作后再调整"        // ts:737
                }
            }

            // if (change.type === 'add_new_exercise') { ... }  (ts:741-753)
            if change.type == .addNewExercise {
                // const dayName = formatDayTemplateName(change.dayTemplateName || change.dayTemplateId || targetTemplate.name);  (ts:742)
                let dayName = formatDayTemplateName(jsOrString(change.dayTemplateName, jsOrString(change.dayTemplateId, targetTemplate.name)))
                // before = `${dayName}：当前没有 ${formatExerciseName(change.exerciseName || change.exerciseId)}`;  (ts:743)
                before = "\(dayName)：当前没有 \(formatExerciseName(jsOrString(change.exerciseName, change.exerciseId)))"
                if jsTruthyString(change.dayTemplateId) {  // if (change.dayTemplateId) {  (ts:744)
                    // after = `${dayName}：新增 ${formatExerciseName(...)} ${number(change.sets)} 组`;  (ts:745)
                    after = "\(dayName)：新增 \(formatExerciseName(jsOrString(change.exerciseName, change.exerciseId))) \(jsNumString(E1RMEngine.number(change.sets))) 组"
                    // if (change.repMin && change.repMax) after += `，${change.repMin}-${change.repMax} 次`;  (ts:746)
                    if jsTruthyNumber(change.repMin) && jsTruthyNumber(change.repMax) {
                        after += "，\(jsNumString(E1RMEngine.number(change.repMin)))-\(jsNumString(E1RMEngine.number(change.repMax))) 次"
                    }
                    // if (change.restSec) after += `，休息 ${change.restSec} 秒`;  (ts:747)
                    if jsTruthyNumber(change.restSec) {
                        after += "，休息 \(jsNumString(E1RMEngine.number(change.restSec))) 秒"
                    }
                    // if (change.insertPositionLabel) after += `，位置：${change.insertPositionLabel}`;  (ts:748)
                    if jsTruthyString(change.insertPositionLabel) {
                        after += "，位置：\(change.insertPositionLabel!)"
                    }
                    applied = true  // ts:749
                } else {
                    after = "\(dayName)：系统暂时不能安全自动插入，需要手动选择训练日"  // ts:751
                }
            }

            // if (change.type === 'swap_exercise') { ... }  (ts:755-761)
            if change.type == .swapExercise {
                before = formatExerciseName(jsOrString(change.exerciseName, change.exerciseId))  // ts:756
                if jsTruthyString(change.replacementExerciseId) {  // ts:757
                    after = "\(formatExerciseName(jsOrString(change.replacementExerciseName, change.replacementExerciseId)))（替代）"  // ts:758
                } else {
                    after = "需要人工选择更安全的替代动作"  // ts:759
                }
                applied = jsTruthyString(change.replacementExerciseId)  // applied = Boolean(change.replacementExerciseId);  (ts:760)
            }

            // if (change.type === 'reduce_support' || change.type === 'increase_support') { ... }  (ts:763-771)
            if change.type == .reduceSupport || change.type == .increaseSupport {
                // before = summarizeSupportState(previewProgram, change.dayTemplateId || source.id, change.dayTemplateName || source.name);  (ts:764)
                before = summarizeSupportState(previewProgram, jsOrString(change.dayTemplateId, sourceProgramTemplate.id), jsOrString(change.dayTemplateName, sourceProgramTemplate.name))
                // const experimentalTemplate = cloneTemplate(sourceProgramTemplate); .id/.name overridden  (ts:765-767)
                var experimentalTemplate = WTemplate(from: sourceProgramTemplate)
                experimentalTemplate.id = "\(sourceProgramTemplate.id ?? "undefined")-preview"  // ts:766
                experimentalTemplate.name = "\(formatProgramTemplateName(sourceProgramTemplate)) 实验版"  // ts:767
                // applied = applySupportChange(previewProgram, experimentalTemplate, sourceProgramTemplate, change);  (ts:768)
                applied = applySupportChange(previewProgram, &experimentalTemplate, WTemplate(from: sourceProgramTemplate), change)
                // after = summarizeSupportState(previewProgram, experimentalTemplate.id, experimentalTemplate.name);  (ts:769)
                after = summarizeSupportState(previewProgram, experimentalTemplate.id, experimentalTemplate.name)
                // if (!applied) note = note || '当前 support 配置没有足够安全的调整空间。';  (ts:770)
                if !applied { note = jsTruthyString(note) ? note : "当前 support 配置没有足够安全的调整空间。" }
            }

            // return { changeId, type, label, before, after, reason, riskLevel };  (ts:773-781)
            var row: [OrderedJSONObject.Entry] = []
            if let id = change.id { row.append(.init(key: "changeId", value: .string(id))) }  // change.id (omit if undefined)
            if let type = change.type { row.append(.init(key: "type", value: .string(type.rawValue))) }
            // label: changeTypeLabel[change.type] || formatAdjustmentChangeLabel(change.type)  (ts:776).
            // changeTypeLabel is total over AdjustmentChangeType, so the `||` fallback is
            // unreachable for a valid type; for a nil type it matches
            // formatAdjustmentChangeLabel(undefined) === '计划调整' (formatters.ts:507).
            let label = (change.type.flatMap { changeTypeLabel[$0] }) ?? "计划调整"
            row.append(.init(key: "label", value: .string(label)))
            row.append(.init(key: "before", value: .string(before)))
            row.append(.init(key: "after", value: .string(after)))
            // reason: [change.reason, note].filter(Boolean).join(' ')  (ts:779)
            row.append(.init(key: "reason", value: .string([change.reason, note].compactMap { jsTruthyString($0) ? $0 : nil }.joined(separator: " "))))
            // riskLevel: riskLevelForChange(change, applied, note)  (ts:780)
            row.append(.init(key: "riskLevel", value: .string(riskLevelForChange(change, applied, note))))
            rows.append(.object(OrderedJSONObject(entries: row)))
        }

        // return { title: draft.title, summary: draft.summary, changes };  (ts:784-788)
        return ProgramAdjustmentDiff(title: draft.title, summary: draft.summary, changes: .array(rows))
    }

    // MARK: - exercise-seed helpers (programAdjustmentEngine.ts:181-208)

    /// `exerciseKindFromId(exerciseId)` (ts:181-185).
    static func exerciseKindFromId(_ exerciseId: String) -> String {
        // if (/(row|pulldown|press|squat|deadlift|rdl|hack|leg-press)/i.test(id)) return 'compound';
        if regexTest(exerciseId, "(row|pulldown|press|squat|deadlift|rdl|hack|leg-press)") { return "compound" }
        // if (/(machine|smith)/i.test(id)) return 'machine';
        if regexTest(exerciseId, "(machine|smith)") { return "machine" }
        return "isolation"
    }

    /// `findExerciseSeed(exerciseId)` (ts:187-188):
    /// `INITIAL_TEMPLATES.flatMap(t => t.exercises).find(e => e.id === exerciseId)`.
    static func findExerciseSeed(_ exerciseId: String) -> ExerciseTemplate? {
        for template in DefaultTrainingData.initialTemplates {
            for exercise in (template.exercises ?? []) where exercise.id == exerciseId {
                return exercise
            }
        }
        return nil
    }

    /// `buildExerciseSeed(exerciseId, muscleId)` (ts:190-208).
    static func buildExerciseSeed(_ exerciseId: String, _ muscleId: String?) -> ExerciseTemplate {
        // const fromTemplate = findExerciseSeed(exerciseId);
        // if (fromTemplate) return enrichExercise(clone(fromTemplate));  (ts:191-192)
        if let fromTemplate = findExerciseSeed(exerciseId) {
            return EngineUtils.enrichExercise(cloneExercise(fromTemplate))
        }
        // const override = EXERCISE_KNOWLEDGE_OVERRIDES[exerciseId] || {};  (ts:194)
        // The full override VALUE table is a different slice's data port; the only field
        // read here is `override.primaryMuscles[0]` (the muscle default), reachable ONLY
        // for an id present in EXERCISE_KNOWLEDGE_OVERRIDES yet absent from
        // INITIAL_TEMPLATES — no fixture uses such an id, so the empty-override branch is
        // the pinned one (`muscleId || '' || 'back'`).
        // return enrichExercise({ id, name, alias, muscle, kind, sets:2, repMin:8, repMax:12,
        //   rest:90, startWeight:0, alternatives:[] });  (ts:195-207)
        let displayName = ExerciseLibrary.displayNames[exerciseId] ?? formatExerciseName(.string(exerciseId))  // ts:197-198
        let muscle = jsTruthyString(muscleId) ? muscleId! : "back"  // ts:199 (empty-override branch)
        let seed = ExerciseTemplate(
            id: exerciseId,
            name: displayName,
            alias: displayName,
            muscle: muscle,
            kind: exerciseKindFromId(exerciseId),
            sets: .integer(2),
            repMin: .integer(8),
            repMax: .integer(12),
            rest: .integer(90),
            startWeight: .integer(0),
            alternatives: []
        )
        return EngineUtils.enrichExercise(seed)
    }

    // MARK: - day / template lookup helpers (programAdjustmentEngine.ts:141-179)

    /// `dayTemplateFromTrainingTemplate(template)` (ts:141-149) over a WTemplate.
    private static func dayTemplateFromTrainingTemplate(_ template: WTemplate) -> WDay {
        WDay(
            id: template.id,
            name: template.name,
            // focusMuscles: [...new Set(exercises.map(e => e.muscle).filter(Boolean))]  (ts:144)
            focusMuscles: DefaultTrainingData.orderPreservingUnique(
                template.exercises.compactMap { $0["muscle"]?.stringValue }.filter { !$0.isEmpty }
            ),
            correctionBlockIds: [],                                          // ts:145
            mainExerciseIds: template.exercises.map { $0["id"]?.stringValue ?? "" },  // ts:146
            functionalBlockIds: [],                                          // ts:147
            estimatedDurationMin: template.duration                          // ts:148
        )
    }

    /// `buildProgramDayTemplates(programTemplate, templates)` (ts:151-152).
    static func buildProgramDayTemplates(_ programTemplate: ProgramTemplate, _ templates: [TrainingTemplate]) -> [DayTemplate] {
        // programTemplate.dayTemplates.length ? programTemplate.dayTemplates : templates.map(dayTemplateFromTrainingTemplate)
        let dts = programTemplate.dayTemplates ?? []
        if !dts.isEmpty { return dts }
        // The false branch maps TrainingTemplate -> DayTemplate (the typed PA-S1 projection,
        // identical fields to dayTemplateFromTrainingTemplate's WDay).
        return templates.map { template in
            dayTemplateFromTrainingTemplate(WTemplate(from: template)).asDayTemplate()
        }
    }

    /// `exerciseMatchesId(exercise, exerciseId)` (ts:154-160) over a WExercise object.
    private static func exerciseMatchesId(_ exercise: MutObj, _ exerciseId: String?) -> Bool {
        guard let exerciseId, !exerciseId.isEmpty else { return false }  // Boolean(exerciseId && ...)
        let ids = [exercise["id"]?.stringValue, exercise["baseId"]?.stringValue, exercise["canonicalExerciseId"]?.stringValue]
            .compactMap { $0 }.filter { !$0.isEmpty }  // [...].filter(Boolean)
        return ids.contains(exerciseId)
    }

    /// `matchesMuscle(exercise, muscleId)` (ts:162-169) over a WExercise object.
    private static func matchesMuscle(_ exercise: MutObj, _ muscleId: String?) -> Bool {
        guard let muscleId, !muscleId.isEmpty else { return false }  // Boolean(muscleId && (...))
        if exercise["muscle"]?.stringValue == muscleId { return true }
        if let prim = exercise["primaryMuscles"]?.arrayValue, prim.contains(where: { $0.stringValue == muscleId }) { return true }
        if let sec = exercise["secondaryMuscles"]?.arrayValue, sec.contains(where: { $0.stringValue == muscleId }) { return true }
        // exercise.muscleContribution?.[muscleId] — truthy contribution value
        if let contrib = exercise["muscleContribution"]?.objectValue?[muscleId], jsTruthyJSON(contrib) { return true }
        return false
    }

    /// `findExerciseIndex(template, change)` (ts:171-177) over a WTemplate.
    private static func findExerciseIndex(_ template: WTemplate, _ change: AdjustmentChange) -> Int {
        // const exact = change.exerciseId ? findIndex(e => exerciseMatchesId(e, change.exerciseId)) : -1;
        let exact: Int = jsTruthyString(change.exerciseId)
            ? (template.exercises.firstIndex { exerciseMatchesId($0, change.exerciseId) } ?? -1)
            : -1
        if exact >= 0 { return exact }
        // return findIndex(e => matchesMuscle(e, change.muscleId));
        return template.exercises.firstIndex { matchesMuscle($0, change.muscleId) } ?? -1
    }

    /// `findTemplateById(templates, id)` (ts:179): `templates.find(t => t.id === id)`.
    static func findTemplateById(_ templates: [TrainingTemplate], _ id: String?) -> TrainingTemplate? {
        templates.first { $0.id == id }
    }

    // MARK: - selectBestDay helpers (programAdjustmentEngine.ts:228-257)

    /// `muscleDayKeywords(muscleId)` (ts:228-236).
    static func muscleDayKeywords(_ muscleId: String?) -> [String] {
        guard let muscleId else { return [] }                                    // if (!muscleId) return [];
        if muscleId == "back" { return ["pull", "upper", "back"] }               // ts:230
        if muscleId == "chest" { return ["push", "upper", "chest"] }             // ts:231
        if ["quads", "hamstrings", "glutes", "calves"].contains(muscleId) { return ["legs", "lower"] }  // ts:232
        if ["shoulders", "triceps"].contains(muscleId) { return ["push", "upper"] }  // ts:233
        if muscleId == "biceps" { return ["pull", "upper"] }                     // ts:234
        return []
    }

    /// `hasPainRestriction(exerciseId, screeningProfile, painPatterns)` (ts:238-244).
    static func hasPainRestriction(_ exerciseId: String?, _ screeningProfile: ScreeningProfile?, _ painPatterns: [DraftPainPattern]) -> Bool {
        // (screeningProfile?.restrictedExercises || []).includes(exerciseId)  (ts:243)
        let restricted = screeningProfile?.restrictedExercises ?? []
        if let exerciseId, restricted.contains(exerciseId) { return true }
        // || painPatterns.some(p => p.exerciseId === exerciseId && p.suggestedAction !== 'watch')  (ts:244)
        return painPatterns.contains { $0.exerciseId == exerciseId && $0.suggestedAction != "watch" }
    }

    /// `chooseInsertAnchor(template)` (ts:246-257).
    static func chooseInsertAnchor(_ template: TrainingTemplate?) -> (insertAfterExerciseId: String?, insertPositionLabel: String) {
        let exercises = template?.exercises ?? []  // const exercises = template?.exercises || [];  (ts:247)
        if exercises.isEmpty {                     // if (!exercises.length) return {... '辅助动作区末尾'};  (ts:248)
            return (nil, "辅助动作区末尾")
        }
        let reversed = Array(exercises.reversed())  // const reversed = [...exercises].reverse();  (ts:249)
        // const anchor = reversed.find(e => e.kind !== 'compound') || reversed[0];  (ts:250-252)
        let anchor = reversed.first { $0.kind != "compound" } ?? reversed[0]
        // { insertAfterExerciseId: anchor?.id, insertPositionLabel: `辅助动作区，位于 ${formatExerciseName(anchor)} 之后` }  (ts:253-256)
        return (anchor.id, "辅助动作区，位于 \(formatExerciseName(.template(anchor))) 之后")
    }

    // MARK: - support-state helpers (programAdjustmentEngine.ts:521-633)

    /// `summarizeSupportState(programTemplate, dayTemplateId, fallbackName)` (ts:521-525).
    private static func summarizeSupportState(_ programTemplate: WProgram, _ dayTemplateId: String?, _ fallbackName: String?) -> String {
        // const day = programTemplate.dayTemplates.find(item => item.id === dayTemplateId);  (ts:522)
        let day = programTemplate.dayTemplates.first { $0.id == dayTemplateId }
        // const dayLabel = formatDayTemplateName(day?.name || fallbackName || dayTemplateId);  (ts:523)
        let dayLabel = formatDayTemplateName(jsOrString(day?.name, jsOrString(fallbackName, dayTemplateId)))
        // `${dayLabel}：纠偏 ${correctionStrategy} / 功能 ${functionalStrategy} / 纠偏模块 N 项 / 功能补丁 M 项`  (ts:524)
        return "\(dayLabel)：纠偏 \(programTemplate.correctionStrategy ?? "undefined") / 功能 \(programTemplate.functionalStrategy ?? "undefined") / 纠偏模块 \(day?.correctionBlockIds.count ?? 0) 项 / 功能补丁 \(day?.functionalBlockIds.count ?? 0) 项"
    }

    /// `stepStrategy(sequence, current, direction)` (ts:527-534).
    static func stepStrategy(_ sequence: [String], _ current: String?, _ direction: Int) -> String? {
        // const index = sequence.indexOf(current);
        // Bug #2: index === -1 (current absent) → return current unchanged, NEVER map to [0].
        guard let current, let index = sequence.firstIndex(of: current) else { return current }  // ts:528-531
        let nextIndex = max(0, min(sequence.count - 1, index + direction))  // ts:532
        return sequence[nextIndex]                                          // ts:533
    }

    /// `ensureProgramDayTemplate(programTemplate, sourceTemplate, experimentalTemplate)` (ts:536-552).
    @discardableResult
    private static func ensureProgramDayTemplate(_ programTemplate: WProgram, _ sourceTemplate: WTemplate, _ experimentalTemplate: WTemplate) -> WDay {
        // const index = dayTemplates.findIndex(d => d.id === source.id || d.id === experimental.id);  (ts:541)
        let index = programTemplate.dayTemplates.firstIndex { $0.id == sourceTemplate.id || $0.id == experimentalTemplate.id }
        // const nextDay = { ...(index>=0 ? dayTemplates[index] : dayTemplateFromTrainingTemplate(source)),
        //   id: experimental.id, name: experimental.name, mainExerciseIds: experimental.exercises.map(...),
        //   estimatedDurationMin: experimental.duration };  (ts:542-548)
        let base: WDay = index != nil ? programTemplate.dayTemplates[index!] : dayTemplateFromTrainingTemplate(sourceTemplate)
        let nextDay = WDay(
            id: experimentalTemplate.id,
            name: experimentalTemplate.name,
            focusMuscles: base.focusMuscles,                 // {...base} spread
            correctionBlockIds: base.correctionBlockIds,     // {...base} spread
            mainExerciseIds: experimentalTemplate.exercises.map { baseOrId($0) },  // override
            functionalBlockIds: base.functionalBlockIds,     // {...base} spread
            estimatedDurationMin: experimentalTemplate.duration  // override
        )
        // if (index>=0) dayTemplates[index] = nextDay; else dayTemplates.push(nextDay);  (ts:549-550)
        if let index { programTemplate.dayTemplates[index] = nextDay } else { programTemplate.dayTemplates.append(nextDay) }
        return nextDay  // ts:551
    }

    /// `pickSupportModuleForDay(template, muscleId)` (ts:554-560).
    private static func pickSupportModuleForDay(_ template: WTemplate, _ muscleId: String?) -> String {
        // const focus = `${template.id} ${template.name} ${template.focus}`.toLowerCase();  (ts:555)
        let focus = "\(template.id ?? "undefined") \(template.name ?? "undefined") \(template.focus ?? "undefined")".lowercased()
        let m = muscleId ?? ""
        if ["quads", "hamstrings", "glutes", "calves"].contains(m) || regexTest(focus, "leg|lower") { return "corr_ankle_mobility_01" }  // ts:556
        if m == "back" || regexTest(focus, "pull|back") { return "corr_thoracic_rotation_01" }  // ts:557
        if m == "chest" || m == "shoulders" || regexTest(focus, "push|upper") { return "corr_scapular_control_01" }  // ts:558
        return "corr_core_control_01"  // ts:559
    }

    /// `pickFunctionalAddonForDay(template, muscleId)` (ts:562-567).
    private static func pickFunctionalAddonForDay(_ template: WTemplate, _ muscleId: String?) -> String {
        let focus = "\(template.id ?? "undefined") \(template.name ?? "undefined") \(template.focus ?? "undefined")".lowercased()  // ts:563
        let m = muscleId ?? ""
        if ["quads", "hamstrings", "glutes", "calves"].contains(m) || regexTest(focus, "leg|lower") { return "func_single_leg_01" }  // ts:564
        if m == "shoulders" || regexTest(focus, "push|upper") { return "func_overhead_stability_01" }  // ts:565
        return "func_core_anti_rotation_01"  // ts:566
    }

    /// `applySupportChange(programTemplate, experimentalTemplate, sourceTemplate, change)` (ts:569-633).
    @discardableResult
    private static func applySupportChange(_ programTemplate: WProgram, _ experimentalTemplate: inout WTemplate, _ sourceTemplate: WTemplate, _ change: AdjustmentChange) -> Bool {
        // const day = ensureProgramDayTemplate(programTemplate, sourceTemplate, experimentalTemplate);  (ts:575)
        let day = ensureProgramDayTemplate(programTemplate, sourceTemplate, experimentalTemplate)
        var changed = false  // ts:576

        if change.type == .reduceSupport {  // ts:578
            let nextCorrection = stepStrategy(correctionStrategyOrder, programTemplate.correctionStrategy, -1)  // ts:579
            let nextFunctional = stepStrategy(functionalStrategyOrder, programTemplate.functionalStrategy, -1)  // ts:580
            if nextCorrection != programTemplate.correctionStrategy { programTemplate.correctionStrategy = nextCorrection; changed = true }  // ts:581-584
            if nextFunctional != programTemplate.functionalStrategy { programTemplate.functionalStrategy = nextFunctional; changed = true }  // ts:585-588
            // if (day.correctionBlockIds.length > 1) day.correctionBlockIds = slice(0, length-1);  (ts:589-592)
            if day.correctionBlockIds.count > 1 { day.correctionBlockIds = Array(day.correctionBlockIds.dropLast()); changed = true }
            // if (day.functionalBlockIds.length > 1) day.functionalBlockIds = slice(0, length-1);  (ts:593-596)
            if day.functionalBlockIds.count > 1 { day.functionalBlockIds = Array(day.functionalBlockIds.dropLast()); changed = true }
            // if (number(day.estimatedDurationMin) > 35) { day.est = max(30, number(est) - 5); experimental.duration = est; }  (ts:597-601)
            if E1RMEngine.number(day.estimatedDurationMin) > 35 {
                let next = jsNum(max(30, E1RMEngine.number(day.estimatedDurationMin) - 5))
                day.estimatedDurationMin = next
                experimentalTemplate.duration = next
                changed = true
            }
        }

        if change.type == .increaseSupport {  // ts:604
            let nextCorrection = stepStrategy(correctionStrategyOrder, programTemplate.correctionStrategy, 1)  // ts:605
            let nextFunctional = stepStrategy(functionalStrategyOrder, programTemplate.functionalStrategy, 1)  // ts:606
            if nextCorrection != programTemplate.correctionStrategy { programTemplate.correctionStrategy = nextCorrection; changed = true }  // ts:607-610
            if nextFunctional != programTemplate.functionalStrategy { programTemplate.functionalStrategy = nextFunctional; changed = true }  // ts:611-614
            // const correctionId = pickSupportModuleForDay(experimental, change.muscleId);  (ts:615)
            let correctionId = pickSupportModuleForDay(experimentalTemplate, change.muscleId)
            // if (correctionId && !includes && CORRECTION_MODULES.some(m => m.id === correctionId)) push;  (ts:616-619)
            if jsTruthyString(correctionId) && !day.correctionBlockIds.contains(correctionId) && SupportModules.correctionModules.contains(where: { $0.id == correctionId }) {
                day.correctionBlockIds = day.correctionBlockIds + [correctionId]
                changed = true
            }
            // const functionalId = pickFunctionalAddonForDay(experimental, change.muscleId);  (ts:620)
            let functionalId = pickFunctionalAddonForDay(experimentalTemplate, change.muscleId)
            // if (functionalId && !includes && FUNCTIONAL_ADDONS.some(a => a.id === functionalId)) push;  (ts:621-624)
            if jsTruthyString(functionalId) && !day.functionalBlockIds.contains(functionalId) && SupportModules.functionalAddons.contains(where: { $0.id == functionalId }) {
                day.functionalBlockIds = day.functionalBlockIds + [functionalId]
                changed = true
            }
            // day.estimatedDurationMin = Math.max(number(est), number(est) + 5); experimental.duration = est; changed = true;  (ts:625-627)
            let next = jsNum(max(E1RMEngine.number(day.estimatedDurationMin), E1RMEngine.number(day.estimatedDurationMin) + 5))
            day.estimatedDurationMin = next
            experimentalTemplate.duration = next
            changed = true
        }

        day.name = experimentalTemplate.name  // ts:630
        day.mainExerciseIds = experimentalTemplate.exercises.map { baseOrId($0) }  // ts:631
        return changed  // ts:632
    }

    // MARK: - exercise-change helpers (programAdjustmentEngine.ts:635-699)

    /// `estimateSetDurationMin(exercise, setCount)` (ts:635-639).
    private static func estimateSetDurationMin(_ exercise: MutObj, _ setCount: Double) -> Double {
        let restMin = max(0.5, E1RMEngine.number(exercise["rest"]) / 60)        // ts:636
        let effortMin = exercise["kind"]?.stringValue == "compound" ? 0.8 : 0.55  // ts:637
        return max(1, jsRound((restMin + effortMin) * setCount))               // ts:638
    }

    /// `buildNewExerciseTemplate(change)` (ts:641-655).
    private static func buildNewExerciseTemplate(_ change: AdjustmentChange) -> MutObj {
        // const seed = buildExerciseSeed(change.exerciseId || 'unknown', change.muscleId);  (ts:642)
        let seed = buildExerciseSeed(jsTruthyString(change.exerciseId) ? change.exerciseId! : "unknown", change.muscleId)
        var obj = MutObj(seed.encoded())  // enrichExercise({ ...seed, ... }) — start from seed (ts:643-644)
        // id: change.exerciseId || seed.id  (ts:645)
        obj["id"] = .string(jsTruthyString(change.exerciseId) ? change.exerciseId! : (seed.id ?? ""))
        // name: change.exerciseName || seed.name  (ts:646)
        obj["name"] = .string(jsTruthyString(change.exerciseName) ? change.exerciseName! : (seed.name ?? ""))
        // alias: change.exerciseName || seed.alias || seed.name  (ts:647)
        obj["alias"] = .string(jsTruthyString(change.exerciseName) ? change.exerciseName! : (jsTruthyString(seed.alias) ? seed.alias! : (seed.name ?? "")))
        // muscle: change.muscleId || seed.muscle  (ts:648)
        obj["muscle"] = .string(jsTruthyString(change.muscleId) ? change.muscleId! : (seed.muscle ?? ""))
        // sets: Math.max(1, number(change.sets) || seed.sets)  (ts:649)
        obj["sets"] = jsNum(max(1, jsOrNumber(E1RMEngine.number(change.sets), E1RMEngine.number(seed.sets))))
        // repMin: Math.max(1, number(change.repMin) || seed.repMin)  (ts:650)
        obj["repMin"] = jsNum(max(1, jsOrNumber(E1RMEngine.number(change.repMin), E1RMEngine.number(seed.repMin))))
        // repMax: Math.max(number(change.repMin) || seed.repMin, number(change.repMax) || seed.repMax)  (ts:651)
        obj["repMax"] = jsNum(max(jsOrNumber(E1RMEngine.number(change.repMin), E1RMEngine.number(seed.repMin)), jsOrNumber(E1RMEngine.number(change.repMax), E1RMEngine.number(seed.repMax))))
        // rest: Math.max(30, number(change.restSec) || seed.rest)  (ts:652)
        obj["rest"] = jsNum(max(30, jsOrNumber(E1RMEngine.number(change.restSec), E1RMEngine.number(seed.rest))))
        // startWeight: 0  (ts:653)
        obj["startWeight"] = .number(.integer(0))
        // return enrichExercise({...});  (ts:643)
        if let decoded = try? ExerciseTemplate(decoding: obj.json) {
            return MutObj(EngineUtils.enrichExercise(decoded).encoded())
        }
        return obj
    }

    /// `applyExerciseChange(template, change)` (ts:657-699). Mutates the (cloned) template
    /// in place and returns whether a change applied.
    @discardableResult
    private static func applyExerciseChange(_ template: inout WTemplate, _ change: AdjustmentChange) -> Bool {
        let index = findExerciseIndex(template, change)  // ts:658

        // (add_sets || remove_sets) && index >= 0  (ts:660-667)
        if (change.type == .addSets || change.type == .removeSets) && index >= 0 {
            let exercise = template.exercises[index]                            // ts:661
            let delta = E1RMEngine.number(change.setsDelta)                     // ts:662
            let nextSets = max(1, E1RMEngine.number(exercise["sets"]) + delta)  // ts:663
            var nextExercise = exercise
            nextExercise["sets"] = jsNum(nextSets)                              // { ...exercise, sets: nextSets }  (ts:664)
            template.exercises[index] = nextExercise
            // template.duration = Math.max(20, template.duration + estimateSetDurationMin(exercise, Math.abs(delta)));  (ts:665)
            template.duration = jsNum(max(20, E1RMEngine.number(template.duration) + estimateSetDurationMin(exercise, abs(delta))))
            return true  // ts:666
        }

        // swap_exercise && index >= 0 && change.replacementExerciseId  (ts:669-684)
        if change.type == .swapExercise && index >= 0 && jsTruthyString(change.replacementExerciseId) {
            let current = template.exercises[index]  // ts:670
            // const replacement = buildExerciseSeed(change.replacementExerciseId, change.muscleId || current.muscle);  (ts:671)
            let replacementMuscle = jsTruthyString(change.muscleId) ? change.muscleId : current["muscle"]?.stringValue
            let replacement = buildExerciseSeed(change.replacementExerciseId!, replacementMuscle)
            var next = MutObj(replacement.encoded())  // { ...replacement, ... }  (ts:672-682)
            next["id"] = .string(change.replacementExerciseId!)  // ts:674
            // name: change.replacementExerciseName || replacement.name  (ts:675)
            next["name"] = .string(jsTruthyString(change.replacementExerciseName) ? change.replacementExerciseName! : (replacement.name ?? ""))
            // alias: change.replacementExerciseName || replacement.alias || replacement.name  (ts:676)
            next["alias"] = .string(jsTruthyString(change.replacementExerciseName) ? change.replacementExerciseName! : (jsTruthyString(replacement.alias) ? replacement.alias! : (replacement.name ?? "")))
            next["sets"] = current["sets"] ?? .null            // sets: current.sets  (ts:677)
            next["repMin"] = current["repMin"] ?? .null        // repMin: current.repMin  (ts:678)
            next["repMax"] = current["repMax"] ?? .null        // repMax: current.repMax  (ts:679)
            next["rest"] = current["rest"] ?? .null            // rest: current.rest  (ts:680)
            next["startWeight"] = current["startWeight"] ?? .null  // startWeight: current.startWeight  (ts:681)
            template.exercises[index] = next
            return true  // ts:683
        }

        // add_new_exercise && change.exerciseId  (ts:686-696)
        if change.type == .addNewExercise && jsTruthyString(change.exerciseId) {
            let nextExercise = buildNewExerciseTemplate(change)  // ts:687
            // const insertIndex = change.insertAfterExerciseId
            //   ? findIndex(e => e.id === change.insertAfterExerciseId) + 1 : template.exercises.length;  (ts:688-690)
            let insertIndex: Int
            if jsTruthyString(change.insertAfterExerciseId) {
                let found = template.exercises.firstIndex { $0["id"]?.stringValue == change.insertAfterExerciseId } ?? -1
                insertIndex = found + 1
            } else {
                insertIndex = template.exercises.count
            }
            var nextExercises = template.exercises  // const nextExercises = [...template.exercises];  (ts:691)
            nextExercises.insert(nextExercise, at: max(0, min(insertIndex, nextExercises.count)))  // splice(max(0, insertIndex), 0, next)  (ts:692)
            template.exercises = nextExercises  // ts:693
            // template.duration = Math.max(20, template.duration + estimateSetDurationMin(nextExercise, nextExercise.sets));  (ts:694)
            template.duration = jsNum(max(20, E1RMEngine.number(template.duration) + estimateSetDurationMin(nextExercise, E1RMEngine.number(nextExercise["sets"]))))
            return true  // ts:695
        }

        // return change.type === 'keep';  (ts:698)
        return change.type == .keep
    }

    /// `riskLevelForChange(change, applied, note)` (ts:701-707).
    private static func riskLevelForChange(_ change: AdjustmentChange, _ applied: Bool, _ note: String) -> String {
        if !applied || jsTruthyString(note) { return "high" }  // if (!applied || note) return 'high';  (ts:702)
        if change.type == .swapExercise { return jsTruthyString(change.replacementExerciseId) ? "medium" : "high" }  // ts:703
        if change.type == .addNewExercise { return jsTruthyString(change.dayTemplateId) ? "medium" : "high" }      // ts:704
        if change.type == .addSets || change.type == .removeSets { return abs(E1RMEngine.number(change.setsDelta)) >= 4 ? "medium" : "low" }  // ts:705
        return "low"  // ts:706
    }

    // MARK: - clone helpers (programAdjustmentEngine.ts:132-133)

    /// `cloneTemplate` (ts:132) = `clone` (engineUtils.ts:28) for an ExerciseTemplate seed.
    private static func cloneExercise(_ exercise: ExerciseTemplate) -> ExerciseTemplate {
        (try? ExerciseTemplate(decoding: EngineValueUtils.clone(exercise.encoded()))) ?? exercise
    }

    // MARK: - S4 formatter shims (adapt typed/JSONValue inputs to the ported formatters)

    /// `formatExerciseName(value, '未命名动作')` (formatters.ts:492-494) =
    /// `formatExerciseDisplayName(value, { fallback: '未命名动作' })` — reuses the in-package
    /// `ExerciseLibrary.formatExerciseDisplayName` (the canonical Swift port). TS
    /// `string | ExerciseTemplate` is carried as a `JSONValue` here.
    private static func formatExerciseName(_ ref: ExerciseRef) -> String {
        switch ref {
        case .id(let s): return ExerciseLibrary.formatExerciseDisplayName(.string(s))
        case .template(let ex): return ExerciseLibrary.formatExerciseDisplayName(ex.encoded())
        }
    }
    private static func formatExerciseName(_ value: JSONValue) -> String {
        ExerciseLibrary.formatExerciseDisplayName(value)
    }
    /// `formatExerciseName(maybeString)` where the arg is a `string | undefined` (a `||`
    /// chain of change fields). `nil` → `.null` → the `'未命名动作'` fallback.
    private static func formatExerciseName(_ value: String?) -> String {
        ExerciseLibrary.formatExerciseDisplayName(value.map { JSONValue.string($0) } ?? .null)
    }

    /// `formatDayTemplateName(value, '未指定训练日')` (formatters.ts:488-490) =
    /// `formatTrainingDayName` = `formatTemplateName` (a thin wrapper). The engine only
    /// ever passes a string (or `undefined`) here.
    private static func formatDayTemplateName(_ value: String?) -> String {
        formatTemplateNameString(value, fallbackLabel: "未指定训练日")
    }

    /// `formatProgramTemplateName(template, '未知模板')` (formatters.ts:484-486) =
    /// `formatTemplateName`. The engine passes a TrainingTemplate object (ts:767); its
    /// `id` / `name` are the only fields `formatTemplateName` reads from a template object.
    private static func formatProgramTemplateName(_ template: TrainingTemplate) -> String {
        formatTemplateNameObject(id: template.id, name: template.name, fallbackLabel: "未知模板")
    }

    // MARK: - Local formatTemplateName mirror (formatters.ts:187-208) — see file header
    //
    // Faithful local transcription of the L10n `Formatters.formatTemplateName` chain
    // (which itself mirrors src/i18n/formatters.ts). Lives here, not behind an
    // IPTD -> IronPathL10n edge, to respect the package-graph dependency contract. The
    // build-diff goldens (support + add_new cases) reconcile every entry / regex / branch.

    /// `TEMPLATE_NAME_MAP` (formatters.ts:62-83). 20 entries, key + value verbatim.
    private static let templateNameMap: [String: String] = [
        "push-a": "推 A", "pusha": "推 A", "push": "推 A",
        "pull-a": "拉 A", "pulla": "拉 A", "pull": "拉 A",
        "legs-a": "腿 A", "legsa": "腿 A", "legs": "腿 A",
        "upper-a": "上肢 A", "uppera": "上肢 A", "upper": "上肢 A",
        "lower-a": "下肢 A", "lowera": "下肢 A", "lower": "下肢 A",
        "full-body": "全身训练", "fullbody": "全身训练",
        "arms": "手臂补量", "quick-30": "30 分钟快练", "crowded-gym": "人多替代",
    ]

    /// `formatTemplateName` (formatters.ts:187-208) for a primitive string value:
    /// `value === undefined || null || '' → fallbackLabel`, else candidates = [value].
    private static func formatTemplateNameString(_ value: String?, fallbackLabel: String) -> String {
        guard let value, !value.isEmpty else { return fallbackLabel }  // ts:188
        return formatTemplateNameCandidates([value], fallbackLabel: fallbackLabel)
    }

    /// `formatTemplateName` (formatters.ts:187-208) for an object value: candidate order is
    /// `[id, nameZh, name, label]` (ts:191-196). An object is never the empty/undefined case.
    private static func formatTemplateNameObject(id: String?, name: String?, fallbackLabel: String) -> String {
        formatTemplateNameCandidates([id, nil, name, nil], fallbackLabel: fallbackLabel)
    }

    /// The shared candidate loop of `formatTemplateName` (formatters.ts:198-207).
    private static func formatTemplateNameCandidates(_ candidates: [String?], fallbackLabel: String) -> String {
        for candidate in candidates {
            // String(candidate || '') → normalizeDisplayKey → TEMPLATE_NAME_MAP  (ts:199-200)
            let normalized = normalizeDisplayKey(candidate ?? "")
            if let hit = templateNameMap[normalized] { return hit }
            // typeof candidate === 'string' (ts:201)
            if let candidate {
                // localizeTemplateNameText(candidate.trim())  (ts:202)
                let localized = localizeTemplateNameText(candidate.trimmingCharacters(in: .whitespacesAndNewlines))
                // /[㐀-鿿]/.test(localized) && !/\b(push|pull|legs|upper|lower|full body)\b/i.test(localized)  (ts:203)
                if containsCjk(localized) && !regexTest(localized, "\\b(push|pull|legs|upper|lower|full body)\\b") {
                    return localized
                }
            }
        }
        // warnMissingFormatter — DEV-only console.warn, no-op (ts:206)
        return fallbackLabel  // ts:207
    }

    /// `normalizeDisplayKey` (formatters.ts:27-33): trim → strip parenthesised (CN/EN) →
    /// camelCase split → collapse `[_\s]+` to `-` → lowercase.
    private static func normalizeDisplayKey(_ value: String) -> String {
        var s = value.trimmingCharacters(in: .whitespacesAndNewlines)
        s = regexReplaceAll(s, "[（(].*?[)）]", "")        // .replace(/[（(].*?[)）]/g, '')
        s = regexReplaceAll(s, "([a-z])([A-Z])", "$1-$2") // .replace(/([a-z])([A-Z])/g, '$1-$2')
        s = regexReplaceAll(s, "[_\\s]+", "-")            // .replace(/[_\s]+/g, '-')
        return s.lowercased()
    }

    /// `localizeTemplateNameText` (formatters.ts:178-185): six case-insensitive `\b…\b`
    /// template-name substitutions, regex + replacement verbatim.
    private static func localizeTemplateNameText(_ value: String) -> String {
        var s = value
        s = regexReplaceAll(s, "\\bpush[\\s_-]*a\\b", "推 A", caseInsensitive: true)        // ts:180
        s = regexReplaceAll(s, "\\bpull[\\s_-]*a\\b", "拉 A", caseInsensitive: true)        // ts:181
        s = regexReplaceAll(s, "\\blegs[\\s_-]*a\\b", "腿 A", caseInsensitive: true)        // ts:182
        s = regexReplaceAll(s, "\\bupper[\\s_-]*a\\b", "上肢 A", caseInsensitive: true)     // ts:183
        s = regexReplaceAll(s, "\\blower[\\s_-]*a\\b", "下肢 A", caseInsensitive: true)     // ts:184
        s = regexReplaceAll(s, "\\bfull[\\s_-]*body\\b", "全身训练", caseInsensitive: true) // ts:185
        return s
    }

    /// `/[㐀-鿿]/.test(value)` (formatters.ts:203) — any CJK scalar in U+3400…U+9FFF.
    private static func containsCjk(_ value: String) -> Bool {
        value.unicodeScalars.contains { $0.value >= 0x3400 && $0.value <= 0x9FFF }
    }

    /// Global regex replace (`String.prototype.replace(/…/g, …)`) with NSRegularExpression
    /// template (`$1`/`$2` group refs); literal Chinese replacements pass through verbatim.
    private static func regexReplaceAll(_ input: String, _ pattern: String, _ replacement: String, caseInsensitive: Bool = false) -> String {
        let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return input }
        let range = NSRange(input.startIndex..., in: input)
        return regex.stringByReplacingMatches(in: input, range: range, withTemplate: replacement)
    }

    // MARK: - JS-semantics helpers + stable sort

    /// JS stable `Array.prototype.sort` with a three-way comparator (negative → left
    /// first). Per-engine private copy (the repo convention; no shared `stableSorted`).
    private static func stableSorted<T>(_ array: [T], _ comparator: (T, T) -> Int) -> [T] {
        array.enumerated().sorted { lhs, rhs in
            let c = comparator(lhs.element, rhs.element)
            if c != 0 { return c < 0 }
            return lhs.offset < rhs.offset
        }.map { $0.element }
    }

    /// `Math.round` (round half toward +∞): `Math.round(2.5) === 3`, `Math.round(-2.5) === -2`.
    private static func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }

    /// JS `${number}` / `Number.prototype.toString`: integer-valued doubles render with no
    /// fractional part (`5` not `5.0`); other finite values use the shortest round-trip form.
    private static func jsNumString(_ d: Double) -> String {
        if d.isFinite, d.truncatingRemainder(dividingBy: 1) == 0, abs(d) < 9_007_199_254_740_992 {
            return String(Int64(d))
        }
        return String(d)
    }

    /// A finite double → JSON number with JS's integer collapse (`5.0` → `5`).
    private static func jsNum(_ d: Double) -> JSONValue {
        if d.isFinite, d.truncatingRemainder(dividingBy: 1) == 0, abs(d) < 9_007_199_254_740_992 {
            return .number(.integer(Int64(d)))
        }
        return .number(.double(d))
    }

    /// JS truthiness for a string field: present AND non-empty (`'' ` is falsy).
    private static func jsTruthyString(_ s: String?) -> Bool { (s?.isEmpty == false) }

    /// JS truthiness for a `NumberRepr` field: present, non-zero, not NaN.
    private static func jsTruthyNumber(_ n: NumberRepr?) -> Bool {
        guard let n else { return false }
        let d = n.doubleValue
        return d != 0 && !d.isNaN
    }

    /// JS truthiness for an arbitrary JSON value (used for `muscleContribution?.[id]`).
    private static func jsTruthyJSON(_ v: JSONValue) -> Bool {
        switch v {
        case .null: return false
        case .bool(let b): return b
        case .number(let n): let d = n.doubleValue; return d != 0 && !d.isNaN
        case .string(let s): return !s.isEmpty
        case .array, .object: return true
        }
    }

    /// JS `a || b` for `string | undefined`: `a` when truthy (non-empty), else `b`.
    private static func jsOrString(_ a: String?, _ b: String?) -> String? {
        jsTruthyString(a) ? a : b
    }

    /// JS numeric `a || b` over `number()`-coerced magnitudes: `a` when non-zero (not NaN), else `b`.
    private static func jsOrNumber(_ a: Double, _ b: @autoclosure () -> Double) -> Double {
        (a != 0 && !a.isNaN) ? a : b()
    }

    /// `baseId || id` (the mainExerciseIds projection, ts:546/631/880).
    private static func baseOrId(_ e: MutObj) -> String {
        jsTruthyString(e["baseId"]?.stringValue) ? (e["baseId"]?.stringValue ?? "") : (e["id"]?.stringValue ?? "")
    }

    /// `new RegExp(pattern, 'i').test(input)` — case-insensitive partial match.
    private static func regexTest(_ input: String, _ pattern: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return false }
        return regex.firstMatch(in: input, range: NSRange(input.startIndex..., in: input)) != nil
    }
}

// MARK: - Internal mutable working model (mirrors the JS objects the diff preview mutates)
//
// PURE: these live ONLY inside buildAdjustmentDiff's preview computation. They carry the
// fields the ported helpers read/write; the diff OUTPUT is computed strings, never a
// re-serialized template, so a focused (non-lossless) projection is faithful. Reference
// semantics (class for WProgram/WDay = shared cumulative mutation, like JS objects; value
// semantics for WTemplate/MutObj = automatic per-`clone` copy).

/// A mutable ordered JS object (faithful `{...spread}` + key set/get).
private struct MutObj {
    var entries: [OrderedJSONObject.Entry]
    init(_ value: JSONValue) { if case .object(let o) = value { entries = o.entries } else { entries = [] } }
    subscript(_ key: String) -> JSONValue? {
        get { entries.first { $0.key == key }?.value }
        set {
            if let i = entries.firstIndex(where: { $0.key == key }) {
                if let nv = newValue { entries[i] = .init(key: key, value: nv) } else { entries.remove(at: i) }
            } else if let nv = newValue {
                entries.append(.init(key: key, value: nv))
            }
        }
    }
    var json: JSONValue { .object(OrderedJSONObject(entries: entries)) }
}

/// Mutable mirror of a `DayTemplate` (class = the find→mutate→read aliasing JS relies on).
private final class WDay {
    var id: String?
    var name: String?
    var focusMuscles: [String]
    var correctionBlockIds: [String]
    var mainExerciseIds: [String]
    var functionalBlockIds: [String]
    var estimatedDurationMin: JSONValue
    init(id: String?, name: String?, focusMuscles: [String], correctionBlockIds: [String], mainExerciseIds: [String], functionalBlockIds: [String], estimatedDurationMin: JSONValue) {
        self.id = id
        self.name = name
        self.focusMuscles = focusMuscles
        self.correctionBlockIds = correctionBlockIds
        self.mainExerciseIds = mainExerciseIds
        self.functionalBlockIds = functionalBlockIds
        self.estimatedDurationMin = estimatedDurationMin
    }
    convenience init(from day: DayTemplate) {
        self.init(
            id: day.id,
            name: day.name,
            focusMuscles: day.focusMuscles ?? [],
            correctionBlockIds: day.correctionBlockIds ?? [],
            mainExerciseIds: day.mainExerciseIds ?? [],
            functionalBlockIds: day.functionalBlockIds ?? [],
            estimatedDurationMin: day.estimatedDurationMin.map { JSONValue.number($0) } ?? .null
        )
    }
    /// Project back to a typed `DayTemplate` (only used by buildProgramDayTemplates' false branch).
    func asDayTemplate() -> DayTemplate {
        DayTemplate(
            id: id,
            name: name,
            focusMuscles: focusMuscles,
            correctionBlockIds: correctionBlockIds,
            mainExerciseIds: mainExerciseIds,
            functionalBlockIds: functionalBlockIds,
            estimatedDurationMin: estimatedDurationMin.numberValue
        )
    }
}

/// Mutable mirror of a `ProgramTemplate` (class = cumulative previewProgram mutation).
private final class WProgram {
    var correctionStrategy: String?
    var functionalStrategy: String?
    var dayTemplates: [WDay]
    init(from program: ProgramTemplate) {
        self.correctionStrategy = program.correctionStrategy?.stringValue
        self.functionalStrategy = program.functionalStrategy?.stringValue
        self.dayTemplates = (program.dayTemplates ?? []).map { WDay(from: $0) }
    }
}

/// Mutable mirror of a `TrainingTemplate` (value type = automatic per-`clone` deep copy).
private struct WTemplate {
    var id: String?
    var name: String?
    var focus: String?
    var duration: JSONValue
    var exercises: [MutObj]
    init(from template: TrainingTemplate) {
        self.id = template.id
        self.name = template.name
        self.focus = template.focus
        self.duration = template.duration.map { JSONValue.number($0) } ?? .null
        self.exercises = (template.exercises ?? []).map { MutObj($0.encoded()) }
    }
}
