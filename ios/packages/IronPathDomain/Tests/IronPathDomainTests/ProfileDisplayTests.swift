// ProfileDisplayTests — iOS-17B Profile Surface V1.
//
// Pins the read-only profile formatting: kg↔lb display conversion,
// compact numeric formatting, nil/empty placeholders, and the stable
// enum→Chinese mappings (with raw fallback for unknown tokens).

import XCTest
@testable import IronPathDomain

final class ProfileDisplayTests: XCTestCase {

    // MARK: - Weight (kg-stored, display-unit formatted)

    func testWeightNilIsPlaceholder() {
        XCTAssertEqual(ProfileDisplay.weight(nil, unit: .kg), ProfileDisplay.placeholder)
        XCTAssertEqual(ProfileDisplay.weight(nil, unit: .lb), ProfileDisplay.placeholder)
    }

    func testWeightInKilogramsIsUnchanged() {
        XCTAssertEqual(ProfileDisplay.weight(.integer(100), unit: .kg), "100 kg")
        XCTAssertEqual(ProfileDisplay.weight(.double(72.6), unit: .kg), "72.6 kg")
    }

    func testWeightConvertsToPoundsWithRounding() {
        // 100 kg * 2.2046226218487757 = 220.4623 → 220.5 lb (1 fraction digit)
        XCTAssertEqual(ProfileDisplay.weight(.integer(100), unit: .lb), "220.5 lb")
        // 72.6 kg → 160.0556 → 160.1 lb
        XCTAssertEqual(ProfileDisplay.weight(.double(72.6), unit: .lb), "160.1 lb")
    }

    func testWeightReusesSharedConversion() {
        // Guard against a divergent re-derivation: ProfileDisplay must
        // route through the single shared kg↔lb conversion, not a
        // privately re-declared constant.
        let shownLb = WeightConversion.fromKilograms(80, to: .lb)!
        XCTAssertEqual(
            ProfileDisplay.weight(.integer(80), unit: .lb),
            ProfileDisplay.number(shownLb, fractionDigits: 1) + " lb"
        )
    }

    // MARK: - Height & integer counts

    func testHeight() {
        XCTAssertEqual(ProfileDisplay.height(.integer(178)), "178 cm")
        XCTAssertEqual(ProfileDisplay.height(nil), ProfileDisplay.placeholder)
    }

    func testIntegerWithSuffix() {
        XCTAssertEqual(ProfileDisplay.integer(.integer(30), suffix: " 岁"), "30 岁")
        XCTAssertEqual(ProfileDisplay.integer(.integer(4), suffix: " 天/周"), "4 天/周")
        XCTAssertEqual(ProfileDisplay.integer(.integer(60), suffix: " 分钟"), "60 分钟")
        XCTAssertEqual(ProfileDisplay.integer(nil, suffix: " 岁"), ProfileDisplay.placeholder)
    }

    // MARK: - Free text

    func testTextTrimsAndPlaceholders() {
        XCTAssertEqual(ProfileDisplay.text("  示例用户  "), "示例用户")
        XCTAssertEqual(ProfileDisplay.text(""), ProfileDisplay.placeholder)
        XCTAssertEqual(ProfileDisplay.text("   "), ProfileDisplay.placeholder)
        XCTAssertEqual(ProfileDisplay.text(nil), ProfileDisplay.placeholder)
    }

    // MARK: - Enum mappings (stable domain → Chinese, raw fallback)

    func testSexMapping() {
        XCTAssertEqual(ProfileDisplay.sex("male"), "男")
        XCTAssertEqual(ProfileDisplay.sex("female"), "女")
        XCTAssertEqual(ProfileDisplay.sex("other"), "其他")
        XCTAssertEqual(ProfileDisplay.sex(nil), ProfileDisplay.placeholder)
        // Unknown future token is preserved verbatim, never dropped.
        XCTAssertEqual(ProfileDisplay.sex("nonbinary"), "nonbinary")
    }

    func testTrainingLevelMapping() {
        XCTAssertEqual(ProfileDisplay.trainingLevel("beginner"), "初级")
        XCTAssertEqual(ProfileDisplay.trainingLevel("intermediate"), "中级")
        XCTAssertEqual(ProfileDisplay.trainingLevel("advanced"), "高级")
        XCTAssertEqual(ProfileDisplay.trainingLevel(nil), ProfileDisplay.placeholder)
        XCTAssertEqual(ProfileDisplay.trainingLevel("elite"), "elite")
    }

    // MARK: - Lists & booleans

    func testListJoinTrimAndEmpty() {
        XCTAssertEqual(
            ProfileDisplay.list(["髋关节灵活性", "肩胛稳定性"]),
            "髋关节灵活性、肩胛稳定性"
        )
        XCTAssertEqual(ProfileDisplay.list(["a", "  ", "b"]), "a、b")
        XCTAssertEqual(ProfileDisplay.list(nil), ProfileDisplay.emptyList)
        XCTAssertEqual(ProfileDisplay.list([]), ProfileDisplay.emptyList)
        XCTAssertEqual(ProfileDisplay.list(["", "   "]), ProfileDisplay.emptyList)
    }

    func testBool() {
        XCTAssertEqual(ProfileDisplay.bool(true), "是")
        XCTAssertEqual(ProfileDisplay.bool(false), "否")
        XCTAssertEqual(ProfileDisplay.bool(nil), ProfileDisplay.placeholder)
    }

    func testUnitName() {
        XCTAssertEqual(ProfileDisplay.unitName(.kg), "千克 (kg)")
        XCTAssertEqual(ProfileDisplay.unitName(.lb), "磅 (lb)")
    }

    // MARK: - Preview sample (deterministic, demonstrates the surface)

    func testPreviewSampleFormatsConsistently() {
        let p = ProfileDisplayPreviewSample.userProfile
        XCTAssertEqual(ProfileDisplay.text(p.name), "示例用户")
        XCTAssertEqual(ProfileDisplay.sex(p.sex), "男")
        XCTAssertEqual(ProfileDisplay.trainingLevel(p.trainingLevel), "中级")
        XCTAssertEqual(ProfileDisplay.weight(p.weightKg, unit: .kg), "72.6 kg")
        XCTAssertEqual(ProfileDisplay.weight(p.weightKg, unit: .lb), "160.1 lb")
        XCTAssertEqual(ProfileDisplay.height(p.heightCm), "178 cm")

        let s = ProfileDisplayPreviewSample.screeningProfile
        XCTAssertEqual(ProfileDisplay.list(s.correctionPriority), "髋关节灵活性、肩胛稳定性")

        let a = ProfileDisplayPreviewSample.appSettings
        XCTAssertEqual(ProfileDisplay.bool(a.useHealthDataForReadiness), "否")
        XCTAssertEqual(ProfileDisplay.text(a.trainingMode), "hypertrophy")
    }
}
