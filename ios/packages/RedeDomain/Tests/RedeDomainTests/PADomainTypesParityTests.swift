// PADomainTypesParityTests — PA-S1 PA Domain Types V1.
//
// REAL unit tests for the PA (Plan-Adaptive) domain type family ported in
// PA-S1. Each type is exercised with a representative legacy web schema-shaped JSON
// fixture (inline, the `ScreeningProfileEditTests` precedent — no new
// golden file, so the parity-fixture-count guards are untouched) and
// asserts the three faithfulness invariants the slice promises:
//
//   1. SHAPE — every documented field decodes to the right Swift value
//      (optional/required, union→String / closed-union→enum, number→
//      NumberRepr, string[]→[String], nested PA type→typed sub-struct,
//      tuple/Record/anonymous-object→raw JSONValue).
//   2. OPEN BAG — an unrecognised key (and an unknown closed-union token)
//      survives in `_unknown` and round-trips verbatim.
//   3. CANONICAL ROUND-TRIP — `decode → encoded()` is BYTE-IDENTICAL to
//      the canonical form of the input, at every nesting level (the §9
//      lossless round-trip contract).
//
// Plus the PA-S1 `ProgramTemplate` enrichment: the rich `dayTemplates` /
// `weeklyMuscleTargets` projection reads the open bag WHILE the thin
// persistence `ProgramTemplate` round-trips a rich document byte-identically
// (proof the enrichment did not change persistence / EDIT-4 decode/encode).
//
// Run via `swift test`. Deterministic; never touches disk/network/clock.

import XCTest
@testable import RedeDomain

final class PADomainTypesParityTests: XCTestCase {

    // MARK: - Helpers

    private func value(_ json: String) throws -> JSONValue {
        try JSONValue(decoding: Data(json.utf8))
    }

    /// Asserts `decode → encoded()` is byte-identical to the canonical
    /// form of the input — the lossless open-bag round-trip contract.
    private func assertRoundTrip<T: PAJSONCodable>(
        _ json: String, as type: T.Type, file: StaticString = #filePath, line: UInt = #line
    ) throws {
        let input = try value(json)
        let decoded = try T(decoding: input)
        let inputCanonical = try input.canonicalJSONData()
        let reEncoded = try decoded.encoded().canonicalJSONData()
        XCTAssertEqual(
            String(decoding: reEncoded, as: UTF8.self),
            String(decoding: inputCanonical, as: UTF8.self),
            "round-trip drift for \(T.self)", file: file, line: line
        )
    }

    // MARK: - Closed-union enums

    func testEstimateConfidenceRawValues() {
        XCTAssertEqual(EstimateConfidence(rawValue: "low"), .low)
        XCTAssertEqual(EstimateConfidence(rawValue: "medium"), .medium)
        XCTAssertEqual(EstimateConfidence(rawValue: "high"), .high)
        XCTAssertNil(EstimateConfidence(rawValue: "extreme"))
        XCTAssertEqual(Set(EstimateConfidence.allCases.map(\.rawValue)), ["low", "medium", "high"])
    }

    func testAdjustmentChangeTypeRawValues() {
        XCTAssertEqual(AdjustmentChangeType(rawValue: "add_sets"), .addSets)
        XCTAssertEqual(AdjustmentChangeType(rawValue: "remove_sets"), .removeSets)
        XCTAssertEqual(AdjustmentChangeType(rawValue: "add_new_exercise"), .addNewExercise)
        XCTAssertEqual(AdjustmentChangeType(rawValue: "swap_exercise"), .swapExercise)
        XCTAssertEqual(AdjustmentChangeType(rawValue: "reduce_support"), .reduceSupport)
        XCTAssertEqual(AdjustmentChangeType(rawValue: "increase_support"), .increaseSupport)
        XCTAssertEqual(AdjustmentChangeType(rawValue: "keep"), .keep)
        XCTAssertEqual(AdjustmentChangeType.allCases.count, 7)
    }

    // MARK: - DayTemplate

    func testDayTemplateDecodeOpenBagAndRoundTrip() throws {
        let json = """
        {"id":"day1","name":"上肢","focusMuscles":["chest","back"],\
        "correctionBlockIds":["c1"],"mainExerciseIds":["e1","e2"],\
        "functionalBlockIds":[],"estimatedDurationMin":55,\
        "customDayKey":{"keep":"me"}}
        """
        let d = try DayTemplate(decoding: try value(json))
        XCTAssertEqual(d.id, "day1")
        XCTAssertEqual(d.name, "上肢")
        XCTAssertEqual(d.focusMuscles, ["chest", "back"])
        XCTAssertEqual(d.mainExerciseIds, ["e1", "e2"])
        XCTAssertEqual(d.functionalBlockIds, [])
        XCTAssertEqual(d.estimatedDurationMin, .integer(55))
        // Unknown key preserved in the open bag.
        XCTAssertNotNil(d._unknown["customDayKey"])
        try assertRoundTrip(json, as: DayTemplate.self)
    }

    // MARK: - ExerciseTemplate (flattened ExerciseMetadata + own fields)

    func testExerciseTemplateDecodeOpenBagAndRoundTrip() throws {
        let json = """
        {"id":"bench","name":"卧推","muscle":"chest","kind":"compound",\
        "sets":3,"repMin":6,"repMax":10,"rest":120,"startWeight":60.5,\
        "alternatives":["incline_bench"],"primaryMuscles":["chest"],\
        "fatigueCost":"high","highFrequencyOk":false,\
        "progressionPercent":[2.5,5],"recommendedRepRange":[6,10],\
        "techniqueStandard":{"rom":"full","tempo":"2-0-1","stopRule":"rir1"},\
        "warningSignals":[{"message":"肩痛","source":"painPattern","type":"pain_history"}],\
        "evidenceTags":["hypertrophy"],"warmupPreference":"auto",\
        "customExKey":42}
        """
        let e = try ExerciseTemplate(decoding: try value(json))
        XCTAssertEqual(e.id, "bench")
        XCTAssertEqual(e.muscle, "chest")
        XCTAssertEqual(e.kind, "compound")
        XCTAssertEqual(e.sets, .integer(3))
        XCTAssertEqual(e.startWeight, .double(60.5))
        XCTAssertEqual(e.alternatives, ["incline_bench"])
        XCTAssertEqual(e.primaryMuscles, ["chest"])
        XCTAssertEqual(e.fatigueCost, "high")          // union member preserved as String
        XCTAssertEqual(e.highFrequencyOk, false)
        XCTAssertEqual(e.warmupPreference, "auto")
        // Tuple / nested-object / object-array fields carried verbatim as raw JSONValue.
        XCTAssertNotNil(e.progressionPercent)
        XCTAssertNotNil(e.techniqueStandard?.objectValue)
        XCTAssertNotNil(e.warningSignals?.arrayValue)
        // Unknown key preserved.
        XCTAssertEqual(e._unknown["customExKey"]?.intValue, 42)
        try assertRoundTrip(json, as: ExerciseTemplate.self)
    }

    // MARK: - TrainingTemplate (nested ExerciseTemplate[])

    func testTrainingTemplateDecodeNestedAndRoundTrip() throws {
        let json = """
        {"id":"t1","name":"Push A","focus":"chest","duration":60,"note":"",\
        "exercises":[{"id":"bench","name":"卧推","muscle":"chest","kind":"compound",\
        "sets":3,"repMin":6,"repMax":10,"rest":120,"startWeight":60,"nestedUnknown":true}],\
        "isExperimentalTemplate":true,"adjustmentSummary":"+1 set",\
        "customTplKey":["x"]}
        """
        let t = try TrainingTemplate(decoding: try value(json))
        XCTAssertEqual(t.id, "t1")
        XCTAssertEqual(t.focus, "chest")
        XCTAssertEqual(t.duration, .integer(60))
        XCTAssertEqual(t.exercises?.count, 1)
        XCTAssertEqual(t.exercises?.first?.id, "bench")
        XCTAssertEqual(t.isExperimentalTemplate, true)
        // Unknown key inside the nested exercise is preserved at that level.
        XCTAssertEqual(t.exercises?.first?._unknown["nestedUnknown"]?.boolValue, true)
        XCTAssertNotNil(t._unknown["customTplKey"])
        try assertRoundTrip(json, as: TrainingTemplate.self)
    }

    // MARK: - WeeklyActionRecommendation (enum field + anonymous object)

    func testWeeklyActionRecommendationDecodeAndRoundTrip() throws {
        let json = """
        {"id":"w1","priority":"high","category":"volume","targetType":"muscle",\
        "targetId":"chest","targetLabel":"胸","issue":"under_volume",\
        "recommendation":"+2 sets","reason":"low weekly sets",\
        "suggestedChange":{"muscleId":"chest","setsDelta":2},\
        "evidenceRuleIds":["r1","r2"],"confidence":"medium","extra":1}
        """
        let w = try WeeklyActionRecommendation(decoding: try value(json))
        XCTAssertEqual(w.priority, "high")
        XCTAssertEqual(w.category, "volume")
        XCTAssertEqual(w.confidence, .medium)
        XCTAssertEqual(w.evidenceRuleIds, ["r1", "r2"])
        XCTAssertNotNil(w.suggestedChange?.objectValue)
        XCTAssertEqual(w._unknown["extra"]?.intValue, 1)
        try assertRoundTrip(json, as: WeeklyActionRecommendation.self)
    }

    // MARK: - AdjustmentChange (closed-union enum field)

    func testAdjustmentChangeDecodeAndRoundTrip() throws {
        let json = """
        {"id":"ch1","type":"add_sets","dayTemplateId":"day1","exerciseId":"bench",\
        "setsDelta":2,"sets":5,"repMin":6,"repMax":10,"restSec":120,\
        "skipped":false,"reason":"low volume","sourceRecommendationId":"w1","x":null}
        """
        let c = try AdjustmentChange(decoding: try value(json))
        XCTAssertEqual(c.type, .addSets)
        XCTAssertEqual(c.setsDelta, .integer(2))
        XCTAssertEqual(c.restSec, .integer(120))
        XCTAssertEqual(c.skipped, false)
        XCTAssertEqual(c.reason, "low volume")
        try assertRoundTrip(json, as: AdjustmentChange.self)
    }

    /// An unrecognised closed-union token must NOT be dropped: the field
    /// decodes to nil and the raw token stays in the open bag verbatim.
    func testAdjustmentChangeUnknownEnumTokenStaysInBag() throws {
        let json = """
        {"id":"ch2","type":"teleport_exercise","reason":"future change"}
        """
        let c = try AdjustmentChange(decoding: try value(json))
        XCTAssertNil(c.type)
        XCTAssertEqual(c._unknown["type"]?.stringValue, "teleport_exercise")
        try assertRoundTrip(json, as: AdjustmentChange.self)
    }

    // MARK: - ProgramAdjustmentDiff (anonymous-object array → raw)

    func testProgramAdjustmentDiffDecodeAndRoundTrip() throws {
        let json = """
        {"title":"周自适应","summary":"+2 组胸","changes":[{"changeId":"ch1",\
        "type":"add_sets","label":"卧推 +2 组","before":"3 组","after":"5 组",\
        "reason":"volume","riskLevel":"low"}],"meta":"keep"}
        """
        let d = try ProgramAdjustmentDiff(decoding: try value(json))
        XCTAssertEqual(d.title, "周自适应")
        XCTAssertNotNil(d.changes?.arrayValue)
        XCTAssertEqual(d._unknown["meta"]?.stringValue, "keep")
        try assertRoundTrip(json, as: ProgramAdjustmentDiff.self)
    }

    // MARK: - ProgramAdjustmentDraft (nested changes[] + diffPreview + enum)

    func testProgramAdjustmentDraftDecodeNestedAndRoundTrip() throws {
        let json = """
        {"id":"draft1","createdAt":"2026-06-01T00:00:00.000Z","status":"draft_created",\
        "sourceProgramTemplateId":"prog1","title":"周自适应草稿","summary":"+2 组",\
        "selectedRecommendationIds":["w1"],"changes":[{"id":"ch1","type":"add_sets",\
        "reason":"low volume","setsDelta":2}],"confidence":"high","riskLevel":"low",\
        "diffPreview":{"title":"周自适应","summary":"+2 组胸","changes":[]},\
        "notes":["note1"],"draftRevision":2,"unknownDraftKey":true}
        """
        let d = try ProgramAdjustmentDraft(decoding: try value(json))
        XCTAssertEqual(d.id, "draft1")
        XCTAssertEqual(d.status, "draft_created")          // wide union → String
        XCTAssertEqual(d.confidence, .high)
        XCTAssertEqual(d.changes?.count, 1)
        XCTAssertEqual(d.changes?.first?.type, .addSets)
        XCTAssertEqual(d.diffPreview?.title, "周自适应")
        XCTAssertEqual(d.draftRevision, .integer(2))
        XCTAssertEqual(d._unknown["unknownDraftKey"]?.boolValue, true)
        try assertRoundTrip(json, as: ProgramAdjustmentDraft.self)
    }

    // MARK: - ProgramAdjustmentHistoryItem (nested changes[] + ProgramTemplate snapshot)

    func testProgramAdjustmentHistoryItemDecodeNestedAndRoundTrip() throws {
        let json = """
        {"id":"hist1","appliedAt":"2026-06-02T00:00:00.000Z",\
        "sourceProgramTemplateId":"prog1","experimentalProgramTemplateId":"prog1-exp",\
        "selectedRecommendationIds":["w1"],"changes":[{"id":"ch1","type":"swap_exercise",\
        "reason":"pain"}],"rollbackAvailable":true,"status":"applied",\
        "sourceProgramSnapshot":{"id":"prog1","userId":"u1","primaryGoal":"hypertrophy",\
        "splitType":"ppl","daysPerWeek":4,"dayTemplates":[{"id":"day1","name":"Push"}]},\
        "effectReview":{"historyItemId":"hist1","status":"improved","confidence":"high",\
        "summary":"better","metrics":{"adherenceChange":0.1},"recommendation":"keep"},\
        "histUnknown":"x"}
        """
        let h = try ProgramAdjustmentHistoryItem(decoding: try value(json))
        XCTAssertEqual(h.id, "hist1")
        XCTAssertEqual(h.rollbackAvailable, true)
        XCTAssertEqual(h.changes?.first?.type, .swapExercise)
        XCTAssertEqual(h.sourceProgramSnapshot?.id, "prog1")
        XCTAssertEqual(h.sourceProgramSnapshot?.primaryGoal, "hypertrophy")
        // The rich snapshot's dayTemplates ride the ProgramTemplate open bag,
        // reachable through the PA-S1 typed projection.
        XCTAssertEqual(h.sourceProgramSnapshot?.dayTemplates?.first?.name, "Push")
        // effectReview (out of PA-S1 scope) carried verbatim as raw JSONValue.
        XCTAssertNotNil(h.effectReview?.objectValue)
        XCTAssertEqual(h._unknown["histUnknown"]?.stringValue, "x")
        try assertRoundTrip(json, as: ProgramAdjustmentHistoryItem.self)
    }

    // MARK: - ProgramTemplate PA enrichment (read-only projection over the open bag)

    func testProgramTemplateRichProjectionAndThinRoundTrip() throws {
        // A RICH program document: thin persistence scalars + the rich
        // dayTemplates / weeklyMuscleTargets the PA track needs + an unknown key.
        let json = """
        {"id":"prog1","userId":"u1","primaryGoal":"hypertrophy","splitType":"ppl",\
        "daysPerWeek":4,"correctionStrategy":{"mode":"auto"},\
        "weeklyMuscleTargets":{"chest":12,"back":14},\
        "dayTemplates":[{"id":"day1","name":"Push","focusMuscles":["chest"],\
        "estimatedDurationMin":60},{"id":"day2","name":"Pull","focusMuscles":["back"]}],\
        "futureProgramKey":{"x":1}}
        """
        let input = try value(json)
        let p = try ProgramTemplate(decoding: input)

        // Thin persistence scalars decode exactly as before (unchanged struct).
        XCTAssertEqual(p.id, "prog1")
        XCTAssertEqual(p.userId, "u1")
        XCTAssertEqual(p.primaryGoal, "hypertrophy")
        XCTAssertEqual(p.splitType, "ppl")
        XCTAssertEqual(p.daysPerWeek, .integer(4))
        XCTAssertNotNil(p.correctionStrategy)

        // The rich data is NOT promoted to documented keys — it physically
        // lives in the open bag (so persistence / EDIT-4 round-trip it verbatim).
        XCTAssertNotNil(p._unknown["dayTemplates"])
        XCTAssertNotNil(p._unknown["weeklyMuscleTargets"])

        // PA-S1 typed projections read the rich data on demand.
        XCTAssertEqual(p.dayTemplates?.count, 2)
        XCTAssertEqual(p.dayTemplates?[0].name, "Push")
        XCTAssertEqual(p.dayTemplates?[0].focusMuscles, ["chest"])
        XCTAssertEqual(p.dayTemplates?[0].estimatedDurationMin, .integer(60))
        XCTAssertEqual(p.weeklyMuscleTargets?["chest"], .integer(12))
        XCTAssertEqual(p.weeklyMuscleTargets?["back"], .integer(14))

        // CRITICAL: the thin ProgramTemplate round-trips the RICH document
        // BYTE-IDENTICALLY — proof the enrichment did not change persistence.
        XCTAssertEqual(
            String(decoding: try p.encoded().canonicalJSONData(), as: UTF8.self),
            String(decoding: try input.canonicalJSONData(), as: UTF8.self),
            "rich ProgramTemplate must round-trip byte-identically"
        )

        // Absent rich keys → nil projections (no fabrication).
        let thin = try ProgramTemplate(decoding: try value("""
        {"id":"prog2","userId":"u1","primaryGoal":"strength"}
        """))
        XCTAssertNil(thin.dayTemplates)
        XCTAssertNil(thin.weeklyMuscleTargets)
    }
}
