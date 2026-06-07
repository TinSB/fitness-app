// ProfileDisplayDataTests — Profile real-AppData read path V1.
//
// Pins the PURE profile read-model: the derived "latest body weight" selection
// (mirroring the legacy web schema `healthSummaryEngine` rule) and the honest empty-state signal
// (`hasAnyContent`). No IO, no clock — every input is an in-memory value.

import XCTest
@testable import IronPathDomain

final class ProfileDisplayDataTests: XCTestCase {

    // MARK: - latest body weight (derived selection)

    private func bodyWeight(
        id: String,
        startDate: String?,
        kg: Double?,
        unit: String? = "kg",
        dataFlag: String? = "normal"
    ) -> HealthMetricSample {
        HealthMetricSample(
            id: id,
            metricType: "body_weight",
            startDate: startDate,
            value: kg.map { .double($0) },
            unit: unit,
            dataFlag: dataFlag
        )
    }

    func test_latestBodyWeight_emptySamples_isNil() {
        XCTAssertNil(ProfileDisplayData.latestBodyWeightKilograms(from: []))
    }

    func test_latestBodyWeight_noBodyWeightMetric_isNil() {
        let other = HealthMetricSample(
            metricType: "active_energy", startDate: "2026-05-20T06:00:00.000Z",
            value: .double(123), unit: "kcal"
        )
        XCTAssertNil(ProfileDisplayData.latestBodyWeightKilograms(from: [other]))
    }

    func test_latestBodyWeight_singleSample_returnsItsKilograms() {
        let s = bodyWeight(id: "a", startDate: "2026-05-20T06:00:00.000Z", kg: 71.4)
        XCTAssertEqual(ProfileDisplayData.latestBodyWeightKilograms(from: [s]), 71.4)
    }

    func test_latestBodyWeight_multipleSamples_picksGreatestStartDate() {
        let older = bodyWeight(id: "old", startDate: "2026-05-10T06:00:00.000Z", kg: 73.0)
        let newer = bodyWeight(id: "new", startDate: "2026-05-27T06:00:00.000Z", kg: 70.2)
        let middle = bodyWeight(id: "mid", startDate: "2026-05-18T06:00:00.000Z", kg: 72.0)
        // Order in the array must NOT matter — selection is by startDate.
        XCTAssertEqual(
            ProfileDisplayData.latestBodyWeightKilograms(from: [older, newer, middle]), 70.2
        )
        XCTAssertEqual(
            ProfileDisplayData.latestBodyWeightKilograms(from: [newer, older, middle]), 70.2
        )
    }

    func test_latestBodyWeight_lbUnit_isConvertedToKilograms() {
        // 160 lb → 160 * 0.45359237 kg (the single WeightConversion factor).
        let lb = bodyWeight(id: "lb", startDate: "2026-05-20T06:00:00.000Z", kg: 160, unit: "lb")
        let kg = ProfileDisplayData.latestBodyWeightKilograms(from: [lb])
        XCTAssertNotNil(kg)
        XCTAssertEqual(kg!, 160 * WeightConversion.kilogramsPerPound, accuracy: 1e-9)
    }

    func test_latestBodyWeight_excludedSamplesIgnored() {
        // The most recent reading is flagged excluded → the prior normal one wins.
        let normal = bodyWeight(id: "n", startDate: "2026-05-20T06:00:00.000Z", kg: 71.0)
        let excluded = bodyWeight(
            id: "x", startDate: "2026-05-27T06:00:00.000Z", kg: 99.0, dataFlag: "excluded"
        )
        XCTAssertEqual(ProfileDisplayData.latestBodyWeightKilograms(from: [normal, excluded]), 71.0)
    }

    func test_latestBodyWeight_allExcluded_isNil() {
        let excluded = bodyWeight(
            id: "x", startDate: "2026-05-27T06:00:00.000Z", kg: 99.0, dataFlag: "excluded"
        )
        XCTAssertNil(ProfileDisplayData.latestBodyWeightKilograms(from: [excluded]))
    }

    func test_latestBodyWeight_missingValueOrStartDate_ignored() {
        let noValue = bodyWeight(id: "nv", startDate: "2026-05-27T06:00:00.000Z", kg: nil)
        let noStart = bodyWeight(id: "ns", startDate: nil, kg: 80.0)
        let good = bodyWeight(id: "g", startDate: "2026-05-20T06:00:00.000Z", kg: 70.0)
        XCTAssertEqual(
            ProfileDisplayData.latestBodyWeightKilograms(from: [noValue, noStart, good]), 70.0
        )
        XCTAssertNil(ProfileDisplayData.latestBodyWeightKilograms(from: [noValue, noStart]))
    }

    // MARK: - hasAnyContent (honest empty-state signal)

    private func makeData(
        profile: UserProfile = UserProfile(),
        unitSettings: UnitSettings = UnitSettings(),
        screening: ScreeningProfile = ScreeningProfile(),
        appSettings: AppSettings = AppSettings(),
        samples: [HealthMetricSample] = []
    ) -> ProfileDisplayData {
        ProfileDisplayData.make(
            profile: profile, unitSettings: unitSettings, screening: screening,
            appSettings: appSettings, healthMetricSamples: samples
        )
    }

    func test_hasAnyContent_allEmpty_isFalse() {
        XCTAssertFalse(makeData().hasAnyContent)
    }

    func test_hasAnyContent_profileName_isTrue() {
        XCTAssertTrue(makeData(profile: UserProfile(name: "示例")).hasAnyContent)
    }

    func test_hasAnyContent_profileFlagsOnly_isTrue() {
        XCTAssertTrue(makeData(profile: UserProfile(injuryFlags: ["右肩"])).hasAnyContent)
    }

    func test_hasAnyContent_onlyImportedBodyWeight_isTrue() {
        let s = bodyWeight(id: "w", startDate: "2026-05-20T06:00:00.000Z", kg: 70.0)
        let data = makeData(samples: [s])
        XCTAssertEqual(data.latestBodyWeightKg, 70.0)
        XCTAssertTrue(data.hasAnyContent)
    }

    func test_hasAnyContent_screeningTriggers_isTrue() {
        XCTAssertTrue(makeData(screening: ScreeningProfile(painTriggers: ["膝前侧"])).hasAnyContent)
    }

    func test_hasAnyContent_unitPreference_isTrue() {
        XCTAssertTrue(makeData(unitSettings: UnitSettings(displayUnit: .lb)).hasAnyContent)
    }

    func test_hasAnyContent_appSettingsTrainingMode_isTrue() {
        XCTAssertTrue(makeData(appSettings: AppSettings(trainingMode: "hypertrophy")).hasAnyContent)
    }

    /// Internal bookkeeping (schemaVersion) must NOT make a profile-less document
    /// look populated — otherwise an empty doc would render a page of placeholders.
    func test_hasAnyContent_onlyInternalSchemaVersion_isFalse() {
        XCTAssertFalse(makeData(appSettings: AppSettings(schemaVersion: .integer(2))).hasAnyContent)
    }
}
