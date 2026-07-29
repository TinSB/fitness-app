import Foundation
import XCTest
@testable import RedeTrainingDecision

final class PainInjuryProgressionTests: XCTestCase {
    private enum PainRecord {
        case skippedSet
        case skippedExercise
    }

    private static let noSignalAppData = #"""
    {
      "schemaVersion": 8,
      "userProfile": {
        "trainingLevel": "intermediate",
        "equipmentScenario": "commercial-gym",
        "unitSystem": "kg"
      },
      "programTemplate": {
        "splitType": "upper-lower",
        "primaryGoal": "hypertrophy",
        "daysPerWeek": 4
      },
      "history": [
        {
          "id": "baseline-1",
          "date": "2026-07-20",
          "completed": true,
          "exercises": [
            {
              "exerciseId": "db-bench-press",
              "sets": [
                {"weight": 30, "reps": 10, "rir": 2},
                {"weight": 30, "reps": 10, "rir": 2},
                {"weight": 30, "reps": 10, "rir": 2}
              ]
            }
          ]
        },
        {
          "id": "baseline-2",
          "date": "2026-07-22",
          "completed": true,
          "exercises": []
        }
      ]
    }
    """#

    private static let noSignalExpectedBytes = #"{"dayCode":"upper","dayReasons":[],"exercises":[{"change":"increase","equipment":"dumbbell","exerciseId":"db-bench-press","loadType":"external","nextProjectedWeightKg":35,"previousTopReps":10,"previousWeightKg":30,"progressionStepKg":2.5,"reason":{"repCeilingReached":{}},"repLowerBound":6,"repUpperBound":10,"restSeconds":150,"sets":3,"targetReps":6,"targetRir":2,"targetWeightKg":32.5},{"change":"start","equipment":"cable","exerciseId":"lat-pulldown","loadType":"external","nextProjectedWeightKg":45,"progressionStepKg":2.5,"reason":{"firstExposure":{}},"repLowerBound":8,"repUpperBound":10,"restSeconds":120,"sets":3,"targetReps":8,"targetRir":2,"targetWeightKg":42.5},{"change":"start","equipment":"dumbbell","exerciseId":"shoulder-press","loadType":"external","nextProjectedWeightKg":17.5,"progressionStepKg":2.5,"reason":{"firstExposure":{}},"repLowerBound":6,"repUpperBound":10,"restSeconds":120,"sets":3,"targetReps":6,"targetRir":2,"targetWeightKg":15},{"change":"start","equipment":"dumbbell","exerciseId":"one-arm-db-row","loadType":"external","nextProjectedWeightKg":22.5,"progressionStepKg":2.5,"reason":{"firstExposure":{}},"repLowerBound":8,"repUpperBound":12,"restSeconds":90,"sets":3,"targetReps":8,"targetRir":2,"targetWeightKg":20},{"change":"start","equipment":"dumbbell","exerciseId":"lateral-raise","loadType":"external","nextProjectedWeightKg":7.5,"progressionStepKg":2.5,"reason":{"firstExposure":{}},"repLowerBound":12,"repUpperBound":20,"restSeconds":60,"sets":3,"targetReps":12,"targetRir":2,"targetWeightKg":5},{"change":"start","equipment":"cable","exerciseId":"triceps-pushdown","loadType":"external","nextProjectedWeightKg":22.5,"progressionStepKg":2.5,"reason":{"firstExposure":{}},"repLowerBound":10,"repUpperBound":15,"restSeconds":60,"sets":2,"targetReps":10,"targetRir":2,"targetWeightKg":20},{"change":"start","equipment":"dumbbell","exerciseId":"db-curl","loadType":"external","nextProjectedWeightKg":12.5,"progressionStepKg":2.5,"reason":{"firstExposure":{}},"repLowerBound":10,"repUpperBound":15,"restSeconds":60,"sets":2,"targetReps":10,"targetRir":2,"targetWeightKg":10},{"change":"start","equipment":"barbell","exerciseId":"barbell-shrug","loadType":"external","nextProjectedWeightKg":47.5,"progressionStepKg":2.5,"reason":{"firstExposure":{}},"repLowerBound":10,"repUpperBound":15,"restSeconds":60,"sets":3,"targetReps":10,"targetRir":2,"targetWeightKg":45}]}"#

    private func benchSession(
        id: String,
        date: String,
        pain: PainRecord? = nil,
        completedSets: Bool = true,
        weight: Double = 30,
        reps: Int = 10,
        rir: Int = 2
    ) -> String {
        let exercises = completedSets
            ? #""exercises":[{"exerciseId":"db-bench-press","sets":[{"weight":\#(weight),"reps":\#(reps),"rir":\#(rir)},{"weight":\#(weight),"reps":\#(reps),"rir":\#(rir)},{"weight":\#(weight),"reps":\#(reps),"rir":\#(rir)}]}]"#
            : #""exercises":[] "#
        let painField: String
        switch pain {
        case .skippedSet:
            painField = #","skippedSets":[{"exerciseId":"db-bench-press","setIndex":1,"reason":"painDiscomfort"}]"#
        case .skippedExercise:
            painField = #","skippedExercises":[{"exerciseId":"db-bench-press","reason":"painDiscomfort"}]"#
        case nil:
            painField = ""
        }
        return #"{"id":"\#(id)","date":"\#(date)","completed":true,\#(exercises)\#(painField)}"#
    }

    private func unrelatedSession(id: String, date: String) -> String {
        #"{"id":"\#(id)","date":"\#(date)","completed":true,"exercises":[]}"#
    }

    private func upperPlan(
        sessions: [String],
        injuryFlags: [String] = []
    ) throws -> TodayPrescription {
        let flags = injuryFlags.map { #""\#($0)""# }.joined(separator: ",")
        let profile = injuryFlags.isEmpty ? "" : #","userProfile":{"injuryFlags":[\#(flags)]}"#
        let json = #"{"schemaVersion":8,"programTemplate":{"splitType":"upper-lower"},"history":[\#(sessions.joined(separator: ","))]\#(profile)}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-29")
        return try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
            dayCodeOverride: "upper"
        ))
    }

    private func bench(in prescription: TodayPrescription) throws -> ExercisePrescriptionPlan {
        try XCTUnwrap(prescription.exercises.first { $0.exerciseId == "db-bench-press" })
    }

    private func injuryMatches(_ flag: String, exerciseId: String) throws -> Bool {
        let entry = try XCTUnwrap(ExerciseCatalog.minimal.entry(id: exerciseId))
        return ProgressionPausePolicy.injuryFlag(flag, matches: entry)
    }

    func testNoSignalPrescriptionIsByteIdenticalToPreChangeGolden() throws {
        let input = try TestSupport.makeInput(
            appDataJSON: Self.noSignalAppData,
            todayISO: "2026-07-24"
        )
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
            dayCodeOverride: "upper"
        ))
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let bytes = try encoder.encode(prescription)
        XCTAssertEqual(bytes, Data(Self.noSignalExpectedBytes.utf8))
    }

    func testOnePainSessionDoesNotPauseProgression() throws {
        let result = try bench(in: upperPlan(sessions: [
            benchSession(id: "pain-1", date: "2026-07-24", pain: .skippedSet),
        ]))

        XCTAssertEqual(result.targetWeightKg, 32.5)
        XCTAssertEqual(result.change, .increase)
        XCTAssertNil(result.progressionPauseReason)
    }

    func testSkippedSetAndSkippedExerciseAcrossTwoSessionsPauseProgression() throws {
        let result = try bench(in: upperPlan(sessions: [
            benchSession(id: "pain-set", date: "2026-07-22", pain: .skippedSet),
            benchSession(id: "pain-exercise", date: "2026-07-24", pain: .skippedExercise, completedSets: false),
        ]))

        XCTAssertEqual(result.targetWeightKg, 30)
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.progressionPauseReason, .painDiscomfort)
        XCTAssertEqual(result.nextProjectedWeightKg, 32.5, "Rail 下一步只显示被暂停的这一档")
        XCTAssertEqual(result.targetReps, 6, "只暂停加重，原本进阶分支的次数目标不变")
        XCTAssertEqual(result.sets, 3)
        XCTAssertEqual(result.targetRir, 2)
    }

    func testPainWindowIncludesFourthSessionAndExcludesFifth() throws {
        let fourthCounts = try bench(in: upperPlan(sessions: [
            benchSession(id: "boundary-pain", date: "2026-07-18", pain: .skippedExercise, completedSets: false),
            unrelatedSession(id: "other-1", date: "2026-07-20"),
            unrelatedSession(id: "other-2", date: "2026-07-22"),
            benchSession(id: "recent-pain", date: "2026-07-24", pain: .skippedSet),
        ]))
        XCTAssertEqual(fourthCounts.progressionPauseReason, .painDiscomfort)
        XCTAssertEqual(fourthCounts.targetWeightKg, 30)

        let fifthDoesNotCount = try bench(in: upperPlan(sessions: [
            benchSession(id: "expired-pain", date: "2026-07-16", pain: .skippedExercise, completedSets: false),
            unrelatedSession(id: "other-1", date: "2026-07-18"),
            unrelatedSession(id: "other-2", date: "2026-07-20"),
            unrelatedSession(id: "other-3", date: "2026-07-22"),
            benchSession(id: "recent-pain", date: "2026-07-24", pain: .skippedSet),
        ]))
        XCTAssertNil(fifthDoesNotCount.progressionPauseReason)
        XCTAssertEqual(fifthDoesNotCount.targetWeightKg, 32.5)
    }

    func testNormalCompletionOnceClearsPainPauseImmediately() throws {
        let result = try bench(in: upperPlan(sessions: [
            benchSession(id: "pain-set", date: "2026-07-20", pain: .skippedSet),
            benchSession(id: "pain-exercise", date: "2026-07-22", pain: .skippedExercise, completedSets: false),
            benchSession(id: "completed", date: "2026-07-24"),
        ]))

        XCTAssertNil(result.progressionPauseReason)
        XCTAssertEqual(result.targetWeightKg, 32.5)
        XCTAssertEqual(result.change, .increase)
    }

    func testNormalCompletionOnlyClearsAfterThePauseHasActuallyTriggered() throws {
        let interruptedSequence = try bench(in: upperPlan(sessions: [
            benchSession(id: "pain-1", date: "2026-07-20", pain: .skippedSet),
            benchSession(id: "normal-before-threshold", date: "2026-07-22"),
            benchSession(id: "pain-2", date: "2026-07-24", pain: .skippedExercise),
        ]))
        XCTAssertEqual(
            interruptedSequence.progressionPauseReason,
            .painDiscomfort,
            "触发前的正常完成不能抹掉两次疼痛场次"
        )

        let onePainAfterRecovery = try bench(in: upperPlan(sessions: [
            benchSession(id: "pain-1", date: "2026-07-18", pain: .skippedSet),
            benchSession(id: "pain-2", date: "2026-07-20", pain: .skippedExercise),
            benchSession(id: "recovered", date: "2026-07-22"),
            benchSession(id: "new-pain-1", date: "2026-07-24", pain: .skippedSet),
        ]))
        XCTAssertNil(onePainAfterRecovery.progressionPauseReason)

        let twoPainsAfterRecovery = try bench(in: upperPlan(sessions: [
            benchSession(id: "pain-1", date: "2026-07-16", pain: .skippedSet),
            benchSession(id: "pain-2", date: "2026-07-18", pain: .skippedExercise),
            benchSession(id: "recovered", date: "2026-07-20"),
            benchSession(id: "new-pain-1", date: "2026-07-22", pain: .skippedSet),
            benchSession(id: "new-pain-2", date: "2026-07-24", pain: .skippedExercise),
        ]))
        XCTAssertEqual(twoPainsAfterRecovery.progressionPauseReason, .painDiscomfort)

        let painAndCompletedSetsIsStillPain = try bench(in: upperPlan(sessions: [
            benchSession(id: "pain-1", date: "2026-07-20", pain: .skippedSet),
            benchSession(id: "pain-2", date: "2026-07-22", pain: .skippedExercise),
            benchSession(id: "pain-with-sets", date: "2026-07-24", pain: .skippedSet),
        ]))
        XCTAssertEqual(painAndCompletedSetsIsStillPain.progressionPauseReason, .painDiscomfort)
    }

    func testSameCalendarDayUsesCanonicalAppendOrderInsteadOfTimestampTextOrder() throws {
        let result = try bench(in: upperPlan(sessions: [
            benchSession(
                id: "pain-1", date: "2026-07-23T10:00:00Z",
                pain: .skippedSet, weight: 20
            ),
            benchSession(
                id: "pain-2", date: "2026-07-24T23:00:00Z",
                pain: .skippedExercise, weight: 20
            ),
            benchSession(
                id: "recovered-later-append", date: "2026-07-24T01:00:00Z",
                weight: 40
            ),
        ]))
        XCTAssertNil(
            result.progressionPauseReason,
            "同一日以 canonical append 顺序判定，最后追加的正常完成应恢复"
        )
        XCTAssertEqual(
            result.previousWeightKg,
            40,
            "恢复后的处方表现基线也必须取同日最后追加的正常完成"
        )
        XCTAssertEqual(result.targetWeightKg, 42.5)
    }

    func testPauseNeverRaisesAWeightAlreadyReducedByVerdictOrMesocycle() throws {
        func plan(
            history: [String],
            flags: [String],
            today: String,
            verdict: TodayVerdict,
            mesocycleEnabled: Bool = false
        ) throws -> ExercisePrescriptionPlan {
            let flagJSON = flags.map { #""\#($0)""# }.joined(separator: ",")
            let json = #"{"schemaVersion":8,"userProfile":{"injuryFlags":[\#(flagJSON)]},"programTemplate":{"splitType":"upper-lower"},"history":[\#(history.joined(separator: ","))]}"#
            let input = try TestSupport.makeInput(appDataJSON: json, todayISO: today)
            let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input,
                verdict: verdict,
                mesocycleEnabled: mesocycleEnabled,
                dayCodeOverride: "upper"
            ))
            return try bench(in: prescription)
        }

        let deloadHistory = [benchSession(id: "bench", date: "2026-07-24")]
        let deloadVerdict = TodayVerdict(
            call: .deload,
            reason: .sustainedLoadDeload(days: 14),
            signals: []
        )
        let baselineDeload = try plan(
            history: deloadHistory,
            flags: [],
            today: "2026-07-29",
            verdict: deloadVerdict
        )
        let screenedDeload = try plan(
            history: deloadHistory,
            flags: ["shoulder"],
            today: "2026-07-29",
            verdict: deloadVerdict
        )
        XCTAssertLessThan(baselineDeload.targetWeightKg, 30)
        XCTAssertEqual(screenedDeload.targetWeightKg, baselineDeload.targetWeightKg)

        let phaseHistory = [
            unrelatedSession(id: "anchor-1", date: "2026-06-22"),
            unrelatedSession(id: "anchor-2", date: "2026-06-29"),
            unrelatedSession(id: "anchor-3", date: "2026-07-05"),
            benchSession(id: "bench", date: "2026-07-07"),
        ]
        let trainVerdict = TodayVerdict(call: .train, reason: .normalProgression, signals: [])
        let baselinePhase = try plan(
            history: phaseHistory,
            flags: [],
            today: "2026-07-13",
            verdict: trainVerdict,
            mesocycleEnabled: true
        )
        let screenedPhase = try plan(
            history: phaseHistory,
            flags: ["shoulder"],
            today: "2026-07-13",
            verdict: trainVerdict,
            mesocycleEnabled: true
        )
        XCTAssertLessThan(baselinePhase.targetWeightKg, 30)
        XCTAssertEqual(screenedPhase.targetWeightKg, baselinePhase.targetWeightKg)
        XCTAssertEqual(screenedPhase.sets, baselinePhase.sets)
        XCTAssertEqual(screenedPhase.targetRir, baselinePhase.targetRir)
    }

    func testKneeMappingUsesTheApprovedCoarsePatternsOnly() throws {
        XCTAssertTrue(try injuryMatches("knee", exerciseId: "squat"))
        XCTAssertTrue(try injuryMatches("knee", exerciseId: "bodyweight-lunge"))
        XCTAssertTrue(try injuryMatches("knee", exerciseId: "sissy-squat"))
        XCTAssertTrue(try injuryMatches("knee", exerciseId: "leg-curl"))
        XCTAssertFalse(try injuryMatches("knee", exerciseId: "romanian-deadlift"))
    }

    func testShoulderMappingIncludesRearDeltAndExcludesInclinePattern() throws {
        XCTAssertTrue(try injuryMatches("shoulder", exerciseId: "overhead-press"))
        XCTAssertTrue(try injuryMatches("shoulder", exerciseId: "db-bench-press"))
        XCTAssertTrue(try injuryMatches("shoulder", exerciseId: "lateral-raise"))
        XCTAssertTrue(try injuryMatches("shoulder", exerciseId: "face-pull"))
        XCTAssertFalse(try injuryMatches("shoulder", exerciseId: "incline-db-press"))
        XCTAssertFalse(try injuryMatches("shoulder", exerciseId: "romanian-deadlift"))
    }

    func testElbowMappingUsesTricepsAndCurlPatternsOnly() throws {
        XCTAssertTrue(try injuryMatches("elbow", exerciseId: "triceps-pushdown"))
        XCTAssertTrue(try injuryMatches("elbow", exerciseId: "db-curl"))
        XCTAssertFalse(try injuryMatches("elbow", exerciseId: "lateral-raise"))
    }

    func testAnkleMappingUsesCalfRaiseAndSquatPatternsOnly() throws {
        XCTAssertTrue(try injuryMatches("ankle", exerciseId: "calf-raise"))
        XCTAssertTrue(try injuryMatches("ankle", exerciseId: "squat"))
        XCTAssertFalse(try injuryMatches("ankle", exerciseId: "leg-curl"))
    }

    func testWristMappingMatchesBarbellFixedWristFrontRackAndPushUpsOnly() throws {
        for id in [
            "overhead-press", "bench-press", "barbell-curl",
            "front-squat", "push-up", "diamond-push-up", "pike-push-up",
        ] {
            XCTAssertTrue(try injuryMatches("wrist", exerciseId: id), id)
        }
        for id in [
            "shoulder-press", "machine-shoulder-press", "cable-curl",
            "band-overhead-press", "leg-press", "pull-up",
        ] {
            XCTAssertFalse(try injuryMatches("wrist", exerciseId: id), id)
        }
    }

    func testLowerBackMappingMatchesHingesAndUnsupportedLoadedRowsWithoutBroadening() throws {
        for id in [
            "deadlift", "band-good-morning", "cable-pull-through",
            "squat", "front-squat", "smith-squat",
            "barbell-row", "pendlay-row", "t-bar-row", "meadows-row",
        ] {
            XCTAssertTrue(try injuryMatches("lowerBack", exerciseId: id), id)
        }
        for id in [
            "chest-supported-db-row", "seated-row", "machine-row",
            "single-arm-cable-row", "one-arm-db-row", "seal-row",
            "leg-press", "hack-squat",
        ] {
            XCTAssertFalse(try injuryMatches("lowerBack", exerciseId: id), id)
        }
    }

    func testNeckMappingMatchesShrugsAndBehindNeckIdsOnly() throws {
        XCTAssertTrue(try injuryMatches("neck", exerciseId: "barbell-shrug"))
        XCTAssertTrue(try injuryMatches("neck", exerciseId: "db-shrug"))
        XCTAssertFalse(try injuryMatches("neck", exerciseId: "db-overhead-triceps-extension"))
        XCTAssertFalse(try injuryMatches("neck", exerciseId: "shoulder-press"))

        let futureBehindNeck = ExerciseCatalogEntry(
            id: "behind-neck-press",
            nameZh: "测试颈后推举",
            nameEn: "Test behind-neck press",
            movementPattern: "vertical-press",
            primaryMuscle: "shoulders",
            equipment: "barbell",
            kind: "compound",
            substitutionGroups: ["vertical-press"],
            startWeightKg: 20,
            rank: 99_999
        )
        XCTAssertTrue(ProgressionPausePolicy.injuryFlag("neck", matches: futureBehindNeck))
    }

    func testOverlappingInjuryFlagsUseFixedBodyPartPrecedence() throws {
        let result = try XCTUnwrap(
            upperPlan(sessions: [], injuryFlags: ["wrist", "shoulder"])
                .exercises.first { $0.exerciseId == "shoulder-press" }
        )
        XCTAssertEqual(result.progressionPauseReason, .injuryFlag("shoulder"))
    }

    func testKneeFlagPausesSquatButLeavesUnrelatedHingePrescriptionUnchanged() throws {
        let session = #"""
        {
          "id":"legs","date":"2026-07-24","completed":true,
          "exercises":[
            {"exerciseId":"squat","sets":[
              {"weight":100,"reps":8,"rir":2},{"weight":100,"reps":8,"rir":2}
            ]},
            {"exerciseId":"romanian-deadlift","sets":[
              {"weight":100,"reps":10,"rir":2},{"weight":100,"reps":10,"rir":2}
            ]}
          ]
        }
        """#
        func plan(flags: [String]) throws -> TodayPrescription {
            let flagJSON = flags.map { #""\#($0)""# }.joined(separator: ",")
            let json = #"{"schemaVersion":8,"userProfile":{"injuryFlags":[\#(flagJSON)]},"programTemplate":{"splitType":"push-pull-legs"},"history":[\#(session)]}"#
            let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-29")
            return try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input,
                verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
                dayCodeOverride: "legs-a"
            ))
        }

        let baseline = try plan(flags: [])
        let screened = try plan(flags: ["knee"])
        let baseSquat = try XCTUnwrap(baseline.exercises.first { $0.exerciseId == "squat" })
        let screenedSquat = try XCTUnwrap(screened.exercises.first { $0.exerciseId == "squat" })
        XCTAssertEqual(baseSquat.targetWeightKg, 102.5)
        XCTAssertEqual(screenedSquat.targetWeightKg, 100)
        XCTAssertEqual(screenedSquat.change, .hold)
        XCTAssertEqual(screenedSquat.progressionPauseReason, .injuryFlag("knee"))

        let baseHinge = try XCTUnwrap(baseline.exercises.first { $0.exerciseId == "romanian-deadlift" })
        let screenedHinge = try XCTUnwrap(screened.exercises.first { $0.exerciseId == "romanian-deadlift" })
        XCTAssertEqual(screenedHinge, baseHinge, "膝盖标记不得改变不相关动作")
    }

    func testPainPauseStopsAssistedGraduationBeforeExerciseReplacement() throws {
        let assisted = ExerciseCatalogEntry(
            id: "t-assisted",
            nameZh: "测试辅助引体",
            nameEn: "Test assisted pull-up",
            movementPattern: "vertical-pull",
            primaryMuscle: "back",
            equipment: "selectorized",
            kind: "compound",
            substitutionGroups: ["vertical-pull"],
            startWeightKg: 30,
            loadType: "assisted",
            rank: -100
        )
        let catalog = ExerciseCatalog(
            catalogVersion: "pain-pause",
            entries: [assisted] + ExerciseCatalog.minimal.entries
        )
        func session(_ id: String, _ date: String) -> String {
            #"{"id":"\#(id)","date":"\#(date)","completed":true,"exercises":[{"exerciseId":"t-assisted","sets":[{"weight":5,"reps":12,"rir":3}]}],"skippedSets":[{"exerciseId":"t-assisted","setIndex":2,"reason":"painDiscomfort"}]}"#
        }
        let json = #"{"schemaVersion":8,"programTemplate":{"splitType":"push-pull-legs"},"history":[\#(session("pain-1", "2026-07-22")),\#(session("pain-2", "2026-07-24"))]}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-29")
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
            catalog: catalog,
            dayCodeOverride: "pull-a"
        ))
        let result = try XCTUnwrap(prescription.exercises.first { $0.exerciseId == "t-assisted" })

        XCTAssertEqual(result.exerciseId, "t-assisted", "保守态必须在毕业换动作前截住")
        XCTAssertEqual(result.loadType, "assisted")
        XCTAssertEqual(result.targetWeightKg, 5, "保留上次辅助量")
        XCTAssertEqual(result.change, .hold)
        XCTAssertEqual(result.progressionPauseReason, .painDiscomfort)
        XCTAssertNil(
            prescription.exercises.first { $0.exerciseId == "pull-up" },
            "疼痛信号不得触发或放任自动换成自重孪生"
        )
    }

    func testPainPauseHoldsOrdinaryAssistedProgressButPreservesLightAndDeloadEase() throws {
        let assisted = ExerciseCatalogEntry(
            id: "t-assisted",
            nameZh: "测试辅助引体",
            nameEn: "Test assisted pull-up",
            movementPattern: "vertical-pull",
            primaryMuscle: "back",
            equipment: "selectorized",
            kind: "compound",
            substitutionGroups: ["vertical-pull"],
            startWeightKg: 30,
            loadType: "assisted",
            rank: -100
        )
        let catalog = ExerciseCatalog(
            catalogVersion: "pain-pause-assisted",
            entries: [assisted] + ExerciseCatalog.minimal.entries
        )
        func session(_ id: String, _ date: String) -> String {
            #"{"id":"\#(id)","date":"\#(date)","completed":true,"exercises":[{"exerciseId":"t-assisted","sets":[{"weight":30,"reps":12,"rir":3}]}],"skippedSets":[{"exerciseId":"t-assisted","setIndex":2,"reason":"painDiscomfort"}]}"#
        }
        let json = #"{"schemaVersion":8,"programTemplate":{"splitType":"push-pull-legs"},"history":[\#(session("pain-1", "2026-07-22")),\#(session("pain-2", "2026-07-24"))]}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-29")
        func item(call: TodayCall) throws -> ExercisePrescriptionPlan {
            let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input,
                verdict: TodayVerdict(call: call, reason: .normalProgression, signals: []),
                catalog: catalog,
                dayCodeOverride: "pull-a"
            ))
            return try XCTUnwrap(prescription.exercises.first { $0.exerciseId == "t-assisted" })
        }

        let train = try item(call: .train)
        XCTAssertEqual(train.targetWeightKg, 30)
        XCTAssertEqual(train.change, .hold)
        XCTAssertEqual(train.progressionPauseReason, .painDiscomfort)

        let light = try item(call: .light)
        XCTAssertGreaterThan(light.targetWeightKg, 30, "轻练仍可增加辅助量")
        let deload = try item(call: .deload)
        XCTAssertGreaterThan(deload.targetWeightKg, light.targetWeightKg, "减载仍可进一步增加辅助量")
    }

    func testPainPauseHoldsBodyweightPlusIncreaseButPreservesFloorDegradation() throws {
        let weighted = ExerciseCatalogEntry(
            id: "t-weighted",
            nameZh: "测试负重引体",
            nameEn: "Test weighted pull-up",
            movementPattern: "vertical-pull",
            primaryMuscle: "back",
            equipment: "bodyweight",
            kind: "compound",
            substitutionGroups: ["vertical-pull"],
            startWeightKg: 5,
            loadType: "bodyweight-plus",
            rank: -100
        )
        let catalog = ExerciseCatalog(
            catalogVersion: "pain-pause-weighted",
            entries: [weighted] + ExerciseCatalog.minimal.entries
        )
        func item(weight: Double, reps: Int, rir: Int) throws -> ExercisePrescriptionPlan {
            func session(_ id: String, _ date: String) -> String {
                #"{"id":"\#(id)","date":"\#(date)","completed":true,"exercises":[{"exerciseId":"t-weighted","sets":[{"weight":\#(weight),"reps":\#(reps),"rir":\#(rir)}]}],"skippedSets":[{"exerciseId":"t-weighted","setIndex":1,"reason":"painDiscomfort"}]}"#
            }
            let json = #"{"schemaVersion":8,"programTemplate":{"splitType":"push-pull-legs"},"history":[\#(session("pain-1", "2026-07-22")),\#(session("pain-2", "2026-07-24"))]}"#
            let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-29")
            let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
                input: input,
                verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
                catalog: catalog,
                dayCodeOverride: "pull-a"
            ))
            return try XCTUnwrap(
                prescription.exercises.first { $0.exerciseId == "t-weighted" || $0.exerciseId == "pull-up" }
            )
        }

        let heldIncrease = try item(weight: 10, reps: 12, rir: 3)
        XCTAssertEqual(heldIncrease.exerciseId, "t-weighted")
        XCTAssertEqual(heldIncrease.targetWeightKg, 10)
        XCTAssertEqual(heldIncrease.nextProjectedWeightKg, 12.5)
        XCTAssertEqual(heldIncrease.change, .hold)
        XCTAssertEqual(heldIncrease.progressionPauseReason, .painDiscomfort)

        let degraded = try item(weight: 2.5, reps: 8, rir: 0)
        XCTAssertEqual(degraded.exerciseId, "pull-up", "最小外挂负重仍吃力时，原有回退行为不能被保守态挡住")
        XCTAssertEqual(degraded.targetWeightKg, 0)
        XCTAssertEqual(degraded.reason, .bodyweightPlusDegraded)
        XCTAssertEqual(degraded.change, .start)
    }

    func testPainSignalDoesNotBlockBandRepProgression() throws {
        let band = ExerciseCatalogEntry(
            id: "t-band-lateral",
            nameZh: "测试弹力带侧平举",
            nameEn: "Test band lateral raise",
            movementPattern: "lateral-raise",
            primaryMuscle: "side-delt",
            equipment: "band",
            kind: "isolation",
            substitutionGroups: ["side-delt"],
            startWeightKg: 0,
            loadType: "band",
            rank: -100
        )
        let catalog = ExerciseCatalog(
            catalogVersion: "pain-pause-band",
            entries: [band] + ExerciseCatalog.minimal.entries
        )
        func session(_ id: String, _ date: String) -> String {
            #"{"id":"\#(id)","date":"\#(date)","completed":true,"exercises":[{"exerciseId":"t-band-lateral","sets":[{"weight":0,"reps":12,"rir":2}]}],"skippedExercises":[{"exerciseId":"t-band-lateral","reason":"painDiscomfort"}]}"#
        }
        let json = #"{"schemaVersion":8,"programTemplate":{"splitType":"push-pull-legs"},"history":[\#(session("pain-1", "2026-07-22")),\#(session("pain-2", "2026-07-24"))]}"#
        let input = try TestSupport.makeInput(appDataJSON: json, todayISO: "2026-07-29")
        let prescription = try XCTUnwrap(TodayPrescriptionEngine.plan(
            input: input,
            verdict: TodayVerdict(call: .train, reason: .normalProgression, signals: []),
            catalog: catalog,
            dayCodeOverride: "push-a"
        ))
        let result = try XCTUnwrap(
            prescription.exercises.first { $0.exerciseId == "t-band-lateral" }
        )

        XCTAssertEqual(result.targetWeightKg, 0)
        XCTAssertEqual(result.targetReps, 14, "保守态只冻结加重，不冻结弹力带次数进阶")
        XCTAssertEqual(result.change, .increase)
        XCTAssertEqual(result.reason, .holdProgressing)
        XCTAssertEqual(result.progressionPauseReason, .painDiscomfort)
    }
}
