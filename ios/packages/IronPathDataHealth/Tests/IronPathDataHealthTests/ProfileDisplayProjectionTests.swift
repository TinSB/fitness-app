// ProfileDisplayProjectionTests — Profile real-AppData read path V1.
//
// Covers the PURE outcome→state branch logic only (no IO, no live store): the thin
// app-layer loader supplies the `ProfileAppDataLoadOutcome` (already routed through
// the GENUINE `buildCleanAppDataView`); this resolver maps it to an honest rendered
// state. AppData fixtures are built in memory from JSON and run through the real
// clean view, so the test proves the profile/screening/body-weight values reach the
// read-model THROUGH DataHealth — raw AppData never bypasses the clean view (§10).

import XCTest
import IronPathDomain
@testable import IronPathDataHealth

final class ProfileDisplayProjectionTests: XCTestCase {

    private func appData(_ json: String) throws -> AppData {
        try AppData(decoding: Data(json.utf8))
    }

    /// A document with a real profile / units / screening / settings + one imported
    /// body-weight sample — built at the current schema version.
    private func populatedJSON() -> String {
        """
        {
          "schemaVersion": \(SchemaVersion.current.rawValue),
          "history": [],
          "userProfile": {
            "name": "真实用户", "sex": "female", "heightCm": 165, "weightKg": 58.5,
            "trainingLevel": "advanced", "primaryGoal": "力量"
          },
          "unitSettings": { "weightUnit": "kg", "displayUnit": "lb" },
          "screeningProfile": {
            "painTriggers": ["膝前侧"], "restrictedExercises": ["过顶推举"],
            "correctionPriority": ["髋灵活性"]
          },
          "settings": { "trainingMode": "strength", "selectedTemplateId": "tpl-1" },
          "healthMetricSamples": [
            { "metricType": "body_weight", "startDate": "2026-05-20T06:00:00.000Z",
              "value": 60.0, "unit": "kg", "dataFlag": "normal" },
            { "metricType": "body_weight", "startDate": "2026-05-27T06:00:00.000Z",
              "value": 59.1, "unit": "kg", "dataFlag": "normal" }
          ]
        }
        """
    }

    // MARK: - missing → empty (first launch / no live source)

    func test_missing_resolvesToEmpty() {
        XCTAssertEqual(resolveProfileDisplayState(.missing), .empty)
    }

    // MARK: - unreadable → unavailable (present but unparseable; never overwritten)

    func test_unreadable_resolvesToUnavailable() {
        XCTAssertEqual(resolveProfileDisplayState(.unreadable), .unavailable)
    }

    // MARK: - loaded-but-empty document → empty (no profile baseline yet)

    func test_loadedEmptyDocument_resolvesToEmpty() {
        let cleanView = buildCleanAppDataView(.emptyCurrent())
        XCTAssertEqual(resolveProfileDisplayState(.loaded(cleanView)), .empty)
    }

    // MARK: - loaded with profile → ready, real values flow through the clean view

    func test_loadedWithProfile_resolvesToReadyWithRealValues() throws {
        let cleanView = buildCleanAppDataView(try appData(populatedJSON()))
        guard case .ready(let data) = resolveProfileDisplayState(.loaded(cleanView)) else {
            return XCTFail("expected .ready for a populated document")
        }
        XCTAssertEqual(data.profile.name, "真实用户")
        XCTAssertEqual(data.profile.sex, "female")
        XCTAssertEqual(data.profile.weightKg?.doubleValue, 58.5)
        XCTAssertEqual(data.unitSettings.displayUnit, .lb)
        XCTAssertEqual(data.screening.painTriggers, ["膝前侧"])
        XCTAssertEqual(data.appSettings.trainingMode, "strength")
        // Latest body weight is DERIVED (most recent sample), distinct from weightKg.
        XCTAssertEqual(data.latestBodyWeightKg, 59.1)
    }

    /// The resolver must read the DataHealth-CLEANED screening, never raw.
    /// Structural proof: the ready data's screening equals the clean view's
    /// `cleanedScreening` (the same value the §10 chokepoint produced).
    func test_loadedReadsCleanedScreening_notRaw() throws {
        let cleanView = buildCleanAppDataView(try appData(populatedJSON()))
        guard case .ready(let data) = resolveProfileDisplayState(.loaded(cleanView)) else {
            return XCTFail("expected .ready")
        }
        XCTAssertEqual(data.screening, cleanView.cleanedScreening)
    }

    // MARK: - loaded with ONLY an imported body weight → ready (honest, not empty)

    func test_loadedWithOnlyBodyWeight_resolvesToReady() throws {
        let json = """
        {
          "schemaVersion": \(SchemaVersion.current.rawValue),
          "history": [],
          "healthMetricSamples": [
            { "metricType": "body_weight", "startDate": "2026-05-27T06:00:00.000Z",
              "value": 70.0, "unit": "kg", "dataFlag": "normal" }
          ]
        }
        """
        let cleanView = buildCleanAppDataView(try appData(json))
        guard case .ready(let data) = resolveProfileDisplayState(.loaded(cleanView)) else {
            return XCTFail("expected .ready when only a body weight is present")
        }
        XCTAssertEqual(data.latestBodyWeightKg, 70.0)
        XCTAssertNil(data.profile.name)
    }

    // MARK: - determinism (same outcome → same state)

    func test_resolution_isDeterministic() throws {
        let cleanView = buildCleanAppDataView(try appData(populatedJSON()))
        XCTAssertEqual(
            resolveProfileDisplayState(.loaded(cleanView)),
            resolveProfileDisplayState(.loaded(cleanView))
        )
    }
}
