// AppDataIsoTimestampStaticGuardTests — iOS-2B AppData Swift Models V1.
//
// Build-time refusal: every public type in `IronPathDomain`'s model
// layer must NOT declare any property of type `Date`, `Date?`, or
// `[Date]`. iOS-2A plan §8 + Agent 5 §3.3 + Agent 2 §7 all forbid
// `Date` for persisted timestamps because Swift's
// `ISO8601DateFormatter` does not round-trip legacy web implementation's
// `.SSSZ`-precision strings (the iOS-3 (Entry Gate) data-loss risk
// #1). Strings end-to-end is the only safe answer.
//
// The test walks every public model type's stored properties via
// `Mirror` reflection and asserts no `Date`-typed field exists.
// Adding a new model file with a `Date` property fails this test
// immediately on `swift test`.

import XCTest
@testable import IronPathDomain
import Foundation

final class AppDataIsoTimestampStaticGuardTests: XCTestCase {
    /// One representative instance of each iOS-2B public model type.
    /// Default `OrderedJSONObject()` payloads are sufficient — Mirror
    /// only reads stored-property types, not values.
    private func makeInstances() -> [(typeName: String, any: Any)] {
        return [
            ("AppData",
             AppData(
                schemaVersion: SchemaVersion.current,
                root: OrderedJSONObject(entries: [
                    .init(key: "schemaVersion", value: .number(.integer(8)))
                ])
             )),
            ("AppSettings", AppSettings()),
            ("UserProfile", UserProfile()),
            ("TrainingSession", TrainingSession()),
            ("TrainingSetLog", TrainingSetLog()),
            ("ActualSetDraft", ActualSetDraft()),
            ("ExercisePrescription", ExercisePrescription()),
            ("MesocyclePlan", MesocyclePlan()),
            ("ScreeningProfile", ScreeningProfile()),
            ("ProgramTemplate", ProgramTemplate()),
            ("HealthMetricSample", HealthMetricSample()),
            ("UnitSettings", UnitSettings()),
            ("TodayStatus", TodayStatus()),
            ("AdaptiveCalibrationState", AdaptiveCalibrationState()),
        ]
    }

    /// Predicate used to flag `Date`-bearing fields. Matches `Date`,
    /// `Optional<Date>`, `Array<Date>`, `[Date]`, `Set<Date>`,
    /// `Dictionary<…, Date>`. Does NOT match
    /// `DateComponents` / `DateFormatter` (no `Date` followed by an
    /// alphanumeric continuation).
    static func isForbiddenDateType(_ description: String) -> Bool {
        // The Swift mangled / reflected form for `Date` is
        // `Foundation.Date`. Variants:
        //   - "Date"
        //   - "Foundation.Date"
        //   - "Optional<Foundation.Date>"
        //   - "Swift.Optional<Foundation.Date>"
        //   - "Array<Foundation.Date>"
        //   - "Swift.Array<Foundation.Date>"
        //   - "[Foundation.Date]"
        // Reject any match. The trailing boundary is enforced by
        // requiring the next character to NOT be alphanumeric or `_`.
        let scanner = description as NSString
        let pattern = "(^|[^A-Za-z0-9_])Date($|[^A-Za-z0-9_])"
        let regex = try? NSRegularExpression(pattern: pattern)
        let range = NSRange(location: 0, length: scanner.length)
        return regex?.firstMatch(in: description, range: range) != nil
    }

    func testNoDatePropertiesOnAnyPublicModel() {
        for (typeName, instance) in makeInstances() {
            let mirror = Mirror(reflecting: instance)
            for child in mirror.children {
                let valueType = String(reflecting: type(of: child.value))
                XCTAssertFalse(
                    Self.isForbiddenDateType(valueType),
                    "\(typeName).\(child.label ?? "?") has type \(valueType) — `Date` is forbidden on AppData model types (iOS-2A plan §8). Use String for ISO timestamps."
                )
            }
        }
    }

    func testDateTypeDetectorMatchesKnownVariants() {
        XCTAssertTrue(Self.isForbiddenDateType("Date"))
        XCTAssertTrue(Self.isForbiddenDateType("Foundation.Date"))
        XCTAssertTrue(Self.isForbiddenDateType("Swift.Optional<Foundation.Date>"))
        XCTAssertTrue(Self.isForbiddenDateType("Array<Foundation.Date>"))
        XCTAssertTrue(Self.isForbiddenDateType("Swift.Array<Foundation.Date>"))
    }

    func testDateTypeDetectorRejectsNonDateTypes() {
        // Must not false-positive on Date-prefixed type names.
        XCTAssertFalse(Self.isForbiddenDateType("Foundation.DateComponents"))
        XCTAssertFalse(Self.isForbiddenDateType("Foundation.DateFormatter"))
        XCTAssertFalse(Self.isForbiddenDateType("Foundation.DateInterval"))
        XCTAssertFalse(Self.isForbiddenDateType("MyType_Date"))
        XCTAssertFalse(Self.isForbiddenDateType("Swift.String"))
        XCTAssertFalse(Self.isForbiddenDateType("Swift.Int"))
    }
}
