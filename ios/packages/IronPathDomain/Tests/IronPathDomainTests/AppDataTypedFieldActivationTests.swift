// AppDataTypedFieldActivationTests — iOS-2C typed-field activation.
//
// Asserts the documented iOS-3 / iOS-4 / iOS-5 unblock fields on
// the iOS-2C-promoted model types decode into real Swift properties
// (not via `_unknown` bag lookups). Pairs with the real-export
// parity test by exercising each model in isolation against
// synthetic fixtures so failures point at one type.

import XCTest
@testable import IronPathDomain

final class AppDataTypedFieldActivationTests: XCTestCase {
    private func decodeObject(_ json: String) throws -> JSONValue {
        try JSONValue(decoding: Data(json.utf8))
    }

    // MARK: - TrainingSession

    func testTrainingSessionTypedFieldsDecodeAndExcludeFromUnknown() throws {
        let json = """
        {
          "id": "s-1",
          "date": "2026-05-01",
          "startedAt": "2026-05-01T10:00:00.000Z",
          "finishedAt": "2026-05-01T11:00:00.000Z",
          "durationMin": 60,
          "completed": true,
          "earlyEndReason": null,
          "restTimerState": {"isRunning": true, "startedAt": "x"},
          "currentExerciseId": "ex-1",
          "currentFocusStepId": "step-2",
          "currentSetIndex": 1,
          "focusSessionComplete": false,
          "focusCompletedStepIds": ["step-0", "step-1"],
          "focusActualSetDrafts": [],
          "focusWarmupSetLogs": [],
          "exercises": [],
          "futureUnknownKey": "preserve-me",
          "templateName": "Push A"
        }
        """
        let value = try decodeObject(json)
        let session = try TrainingSession(decoding: value)
        XCTAssertEqual(session.id, "s-1")
        XCTAssertEqual(session.date, "2026-05-01")
        XCTAssertEqual(session.startedAt, "2026-05-01T10:00:00.000Z")
        XCTAssertEqual(session.finishedAt, "2026-05-01T11:00:00.000Z")
        XCTAssertEqual(session.durationMin?.intValue, 60)
        XCTAssertEqual(session.completed, true)
        XCTAssertNotNil(session.restTimerState)
        XCTAssertEqual(session.currentExerciseId, "ex-1")
        XCTAssertEqual(session.currentFocusStepId, "step-2")
        XCTAssertEqual(session.currentSetIndex?.intValue, 1)
        XCTAssertEqual(session.focusSessionComplete, false)
        XCTAssertEqual(session.focusCompletedStepIds, ["step-0", "step-1"])
        XCTAssertEqual(session.focusActualSetDrafts?.count, 0)
        XCTAssertEqual(session.focusWarmupSetLogs?.count, 0)
        XCTAssertEqual(session.exercises?.count, 0)
        // Typed keys must NOT appear in _unknown.
        XCTAssertNil(session._unknown["id"])
        XCTAssertNil(session._unknown["restTimerState"])
        // Future / unknown keys must survive in _unknown.
        XCTAssertEqual(session._unknown["futureUnknownKey"]?.stringValue, "preserve-me")
        XCTAssertEqual(session._unknown["templateName"]?.stringValue, "Push A")
    }

    func testTrainingSessionEncodedMergesTypedAndUnknownExactlyOnce() throws {
        let json = #"{"id":"s-1","completed":true,"templateName":"Push A","futureKey":42}"#
        let session = try TrainingSession(decoding: try decodeObject(json))
        let canonical = try session.encoded().canonicalJSONString()
        XCTAssertEqual(canonical,
                       #"{"completed":true,"futureKey":42,"id":"s-1","templateName":"Push A"}"#)
    }

    // MARK: - TrainingSetLog

    func testTrainingSetLogTypedFieldsDecode() throws {
        let json = """
        {
          "id": "set-1",
          "setIndex": 0,
          "exerciseId": "bench-press",
          "originalExerciseId": "bench-press",
          "actualExerciseId": "incline-db-press",
          "weight": 80,
          "actualWeightKg": 80,
          "displayWeight": 176,
          "displayUnit": "lb",
          "reps": 6,
          "rir": 2,
          "rpe": "8",
          "techniqueQuality": "acceptable",
          "painFlag": false,
          "painSeverity": 0,
          "completedAt": "2026-05-01T10:30:00.000Z",
          "completionStatus": "completed",
          "done": true,
          "futureUnknown": "x"
        }
        """
        let log = try TrainingSetLog(decoding: try decodeObject(json))
        XCTAssertEqual(log.id, "set-1")
        XCTAssertEqual(log.setIndex?.intValue, 0)
        XCTAssertEqual(log.exerciseId, "bench-press")
        XCTAssertEqual(log.originalExerciseId, "bench-press")
        XCTAssertEqual(log.actualExerciseId, "incline-db-press")
        XCTAssertEqual(log.weight?.intValue, 80)
        XCTAssertEqual(log.actualWeightKg?.intValue, 80)
        XCTAssertEqual(log.displayWeight?.intValue, 176)
        XCTAssertEqual(log.displayUnit, .lb)
        XCTAssertEqual(log.reps?.intValue, 6)
        XCTAssertEqual(log.rir?.intValue, 2)
        XCTAssertEqual(log.rpe?.stringValue, "8")
        XCTAssertEqual(log.techniqueQuality, "acceptable")
        XCTAssertEqual(log.painFlag, false)
        XCTAssertEqual(log.painSeverity?.intValue, 0)
        XCTAssertEqual(log.completedAt, "2026-05-01T10:30:00.000Z")
        XCTAssertEqual(log.completionStatus, "completed")
        XCTAssertEqual(log.done, true)
        XCTAssertNil(log._unknown["id"])
        XCTAssertEqual(log._unknown["futureUnknown"]?.stringValue, "x")
    }

    // MARK: - ExercisePrescription

    func testExercisePrescriptionTypedFieldsDecode() throws {
        let json = """
        {
          "id": "bench-press",
          "exerciseId": "bench-press",
          "name": "Bench Press",
          "originalExerciseId": "bench-press",
          "actualExerciseId": "incline-db-press",
          "displayExerciseId": "incline-db-press",
          "recordExerciseId": "bench-press__auto_alt",
          "sets": [
            {"id":"s1","setIndex":0,"weight":80,"reps":6}
          ],
          "warmupSets": [
            {"id":"w1","setIndex":0,"weight":20,"reps":10}
          ],
          "plannedSets": 3,
          "prescription": {"loadRange":"60-80%"},
          "suggestion": "Conservative top set",
          "adjustment": "Backoff by 10%",
          "warning": "Pain reported last time",
          "explanations": ["base period"],
          "futureUnknownKey": true
        }
        """
        let ex = try ExercisePrescription(decoding: try decodeObject(json))
        XCTAssertEqual(ex.id, "bench-press")
        XCTAssertEqual(ex.exerciseId, "bench-press")
        XCTAssertEqual(ex.name, "Bench Press")
        XCTAssertEqual(ex.originalExerciseId, "bench-press")
        XCTAssertEqual(ex.actualExerciseId, "incline-db-press")
        XCTAssertEqual(ex.displayExerciseId, "incline-db-press")
        XCTAssertEqual(ex.recordExerciseId, "bench-press__auto_alt")
        XCTAssertEqual(ex.sets?.count, 1)
        XCTAssertEqual(ex.sets?.first?.weight?.intValue, 80)
        XCTAssertEqual(ex.warmupSets?.count, 1)
        XCTAssertEqual(ex.warmupSets?.first?.weight?.intValue, 20)
        XCTAssertEqual(ex.plannedSets?.intValue, 3)
        XCTAssertNotNil(ex.prescription)
        XCTAssertEqual(ex.suggestion, "Conservative top set")
        XCTAssertEqual(ex.adjustment, "Backoff by 10%")
        XCTAssertEqual(ex.warning, "Pain reported last time")
        XCTAssertEqual(ex.explanations, ["base period"])
        XCTAssertEqual(ex._unknown["futureUnknownKey"]?.boolValue, true)
    }

    func testExercisePrescriptionSetsAsIntegerFlowsThroughUnknown() throws {
        // Template-form prescription uses `sets: 3` (integer count).
        // The typed `sets: [TrainingSetLog]?` MUST be nil and the
        // integer MUST survive in `_unknown` for round-trip parity.
        let json = #"{"id":"bench-press","sets":3}"#
        let ex = try ExercisePrescription(decoding: try decodeObject(json))
        XCTAssertNil(ex.sets)
        XCTAssertEqual(ex._unknown["sets"]?.intValue, 3)
    }

    // MARK: - AppSettings

    func testAppSettingsTypedFieldsDecode() throws {
        let json = """
        {
          "schemaVersion": 8,
          "selectedTemplateId": "push-a",
          "trainingMode": "hybrid",
          "unitSettings": {"weightUnit": "kg"},
          "useHealthDataForReadiness": true,
          "dataHealthRepairLedger": [{"id":"r1"}],
          "dataHealthAutoRepairSummary": {"appliedCount":1},
          "dataHealthRuntimeFlags": {"f":true},
          "futureSettingKey": "preserve"
        }
        """
        let settings = try AppSettings(decoding: try decodeObject(json))
        XCTAssertEqual(settings.schemaVersion?.intValue, 8)
        XCTAssertEqual(settings.selectedTemplateId, "push-a")
        XCTAssertEqual(settings.trainingMode, "hybrid")
        XCTAssertNotNil(settings.unitSettings)
        XCTAssertEqual(settings.useHealthDataForReadiness, true)
        XCTAssertNotNil(settings.dataHealthRepairLedger)
        XCTAssertNotNil(settings.dataHealthAutoRepairSummary)
        XCTAssertNotNil(settings.dataHealthRuntimeFlags)
        XCTAssertEqual(settings._unknown["futureSettingKey"]?.stringValue, "preserve")
    }

    // MARK: - HealthMetricSample

    func testHealthMetricSampleRawAndTypedFieldsDecode() throws {
        let json = """
        {
          "id": "h-1",
          "source": "apple_health_export",
          "metricType": "resting_heart_rate",
          "startDate": "2026-03-30T04:00:47.000Z",
          "endDate": "2026-03-31T02:58:32.000Z",
          "value": 50,
          "unit": "bpm",
          "importedAt": "2026-04-29T03:03:32.287Z",
          "batchId": "batch-1",
          "dataFlag": "normal",
          "raw": {"foo": "bar", "n": 42}
        }
        """
        let sample = try HealthMetricSample(decoding: try decodeObject(json))
        XCTAssertEqual(sample.id, "h-1")
        XCTAssertEqual(sample.source, "apple_health_export")
        XCTAssertEqual(sample.metricType, "resting_heart_rate")
        XCTAssertEqual(sample.startDate, "2026-03-30T04:00:47.000Z")
        XCTAssertEqual(sample.endDate, "2026-03-31T02:58:32.000Z")
        XCTAssertEqual(sample.value?.intValue, 50)
        XCTAssertEqual(sample.unit, "bpm")
        XCTAssertEqual(sample.importedAt, "2026-04-29T03:03:32.287Z")
        XCTAssertEqual(sample.batchId, "batch-1")
        XCTAssertEqual(sample.dataFlag, "normal")
        guard case .object(let rawObj) = sample.raw ?? .null else {
            XCTFail("raw must be a JSON object")
            return
        }
        XCTAssertEqual(rawObj["foo"]?.stringValue, "bar")
        XCTAssertEqual(rawObj["n"]?.intValue, 42)
    }

    // MARK: - AdaptiveCalibrationState (synthetic; real export has none)

    func testAdaptiveCalibrationStateLoadBiasSurvivesViaEntriesArray() throws {
        // Synthetic shape: AdaptiveCalibrationState.entries is opaque
        // `[JSONValue]` (iOS-2C did not promote the AdaptiveCalibrationEntry
        // typed shape — deferred to iOS-2D). loadBias survives via the
        // open-bag carrier inside each entry.
        let json = """
        {
          "version": 1,
          "lastUpdated": "2026-05-01T00:00:00.000Z",
          "entries": [
            {"exerciseId": "bench-press", "loadBias": 0.95, "observationCount": 3}
          ],
          "recommendationLog": []
        }
        """
        let s = try AdaptiveCalibrationState(decoding: try decodeObject(json))
        XCTAssertEqual(s.version?.intValue, 1)
        XCTAssertEqual(s.lastUpdated, "2026-05-01T00:00:00.000Z")
        XCTAssertEqual(s.entries?.count, 1)
        // loadBias survives as JSONValue inside the entry.
        guard case .object(let entry) = s.entries?.first ?? .null else {
            XCTFail("entry must be a JSON object")
            return
        }
        XCTAssertEqual(entry["loadBias"]?.doubleValue, 0.95)
    }

    func testNumberPrecisionForCommonGymWeights() throws {
        // The set of weights iOS-3 / iOS-4 will see most often. All
        // must canonical-emit byte-identically to their TS counterparts.
        let cases: [(String, String)] = [
            ("80", "80"),
            ("72.5", "72.5"),
            ("72.6", "72.6"),
            ("2.5", "2.5"),
            ("0.95", "0.95"),
            ("180", "180"),
            ("-5", "-5"),
            ("0", "0"),
        ]
        for (input, expected) in cases {
            let value = try JSONValue(decoding: Data("{\"w\":\(input)}".utf8))
            let canonical = try value.canonicalJSONString()
            XCTAssertEqual(canonical, "{\"w\":\(expected)}",
                           "number \(input) must canonical-emit as \(expected)")
        }
    }

    // MARK: - AppData typed accessors

    func testAppDataTypedAccessorsReadFromRoot() throws {
        let json = #"{"schemaVersion":8,"history":[{"id":"s-1","completed":true}],"activeSession":null,"settings":{"selectedTemplateId":"push-a"},"healthMetricSamples":[{"id":"h-1","raw":{"k":"v"}}],"unitSettings":{"weightUnit":"kg"},"todayStatus":{"date":"2026-05-01"}}"#
        let appData = try AppData(decoding: Data(json.utf8))
        XCTAssertEqual(appData.schemaVersion.rawValue, 8)
        XCTAssertEqual(appData.history.count, 1)
        XCTAssertEqual(appData.history.first?.id, "s-1")
        XCTAssertNil(appData.activeSession)
        XCTAssertEqual(appData.settings.selectedTemplateId, "push-a")
        XCTAssertEqual(appData.healthMetricSamples.count, 1)
        XCTAssertNotNil(appData.healthMetricSamples.first?.raw)
        XCTAssertEqual(appData.unitSettings.weightUnit, .kg)
        XCTAssertEqual(appData.todayStatus.date, "2026-05-01")
    }
}
