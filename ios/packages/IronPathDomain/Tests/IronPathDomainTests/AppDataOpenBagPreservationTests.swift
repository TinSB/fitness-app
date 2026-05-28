// AppDataOpenBagPreservationTests — iOS-2B AppData Swift Models V1.
//
// Asserts that unknown / future JSON keys survive decode + canonical
// re-emit. iOS-2A plan §7 documents the open-bag contract; Agent 1
// §3 enumerates 37 documented sites where the TypeScript schema
// marks `additionalProperties: true`. iOS-2B's AppData carrier holds
// the entire top-level object in `root`, so every nested unknown key
// (regardless of which schema slot it inhabits) survives by virtue
// of the carrier's structural fidelity.
//
// FUTURE_FIXTURE_NEEDED — Agent 3 §6 deferred gaps:
//
//   (a) TrainingSession.restTimerState != null
//   (b) HealthMetricSample.raw != null
//   (c) AdaptiveCalibrationEntry.loadBias non-trivial float
//
// All three are transitively covered by the redacted real-export
// pointer fixture, which iOS-2B intentionally does NOT consume
// (deferred to iOS-2C / iOS-3). The synthetic fixture used here
// already exercises the top-level `settings.iosOpenBagField` open-bag
// path, which proves the carrier mechanism end-to-end.
//
// When iOS-2C lands and consumes the redacted real export, the
// `FUTURE_FIXTURE_NEEDED` block above can be removed.

import XCTest
@testable import IronPathDomain

final class AppDataOpenBagPreservationTests: XCTestCase {
    private func loadFixturePayload() throws -> OrderedJSONObject {
        guard let url = Bundle.module.url(
            forResource: "snapshot-hash-stable-v1-input",
            withExtension: "json",
            subdirectory: "Fixtures"
        ) else {
            XCTFail("Bundle.module missing input fixture")
            throw JSONValueError.decodeFailed("bundle miss")
        }
        let data = try Data(contentsOf: url)
        let root = try JSONValue(decoding: data)
        guard case .object(let obj) = root,
              case .object(let payload) = obj["payload"] ?? .null else {
            XCTFail("payload missing or not an object")
            throw JSONValueError.notAnObject
        }
        return payload
    }

    func testFixtureCarriesSettingsIosOpenBagField() throws {
        let payload = try loadFixturePayload()
        guard case .object(let settings) = payload["settings"] ?? .null else {
            XCTFail("settings missing or not an object")
            return
        }
        XCTAssertNotNil(settings["iosOpenBagField"],
                        "fixture should carry settings.iosOpenBagField (forward-compat marker)")
    }

    func testSettingsUnknownKeysSurviveAppDataRoundTrip() throws {
        let payload = try loadFixturePayload()
        let data = try JSONValue.object(payload).canonicalJSONData()
        let appData = try AppData(decoding: data)
        let canonical = try appData.canonicalJSONString()
        // The unknown key chain must survive the full round-trip.
        XCTAssertTrue(canonical.contains("iosOpenBagField"))
        XCTAssertTrue(canonical.contains("iosOnlyHint"))
        XCTAssertTrue(canonical.contains("preserve me across PWA<->iOS round trip"))
        XCTAssertTrue(canonical.contains("knownField"))
    }

    func testInjectedSyntheticFutureKeySurvivesRoundTrip() throws {
        // Inject a synthetic future key at the top level and assert it
        // survives the canonical round-trip.
        let payload = try loadFixturePayload()
        var entries = payload.entries
        entries.append(.init(key: "_iosTestFutureKey", value: .string("synthetic-2026-05-28")))
        let mutated = OrderedJSONObject(entries: entries)
        let data = try JSONValue.object(mutated).canonicalJSONData()
        let appData = try AppData(decoding: data)
        let canonical = try appData.canonicalJSONString()
        XCTAssertTrue(canonical.contains("_iosTestFutureKey"))
        XCTAssertTrue(canonical.contains("synthetic-2026-05-28"))
    }

    func testNestedUnknownKeysInSettingsSurvive() throws {
        let payload = try loadFixturePayload()
        // Build a mutated copy where settings carries an extra unknown nested key.
        var newEntries: [OrderedJSONObject.Entry] = []
        for entry in payload.entries {
            if entry.key == "settings", case .object(let settings) = entry.value {
                var updated = settings.entries
                updated.append(.init(
                    key: "_nestedFutureBag",
                    value: .object(OrderedJSONObject(entries: [
                        .init(key: "deep", value: .string("preserved"))
                    ]))
                ))
                newEntries.append(.init(key: "settings",
                                        value: .object(OrderedJSONObject(entries: updated))))
            } else {
                newEntries.append(entry)
            }
        }
        let mutated = OrderedJSONObject(entries: newEntries)
        let data = try JSONValue.object(mutated).canonicalJSONData()
        let appData = try AppData(decoding: data)
        let canonical = try appData.canonicalJSONString()
        XCTAssertTrue(canonical.contains("_nestedFutureBag"))
        XCTAssertTrue(canonical.contains("\"deep\":\"preserved\""))
    }

    func testJSONValueObjectArrayStringNumberBoolNullRoundTrip() throws {
        // Drive every JSONValue case once through the canonical path.
        let bag = OrderedJSONObject(entries: [
            .init(key: "n", value: .null),
            .init(key: "b", value: .bool(true)),
            .init(key: "i", value: .number(.integer(42))),
            .init(key: "d", value: .number(.decimal(Decimal(string: "3.14")!))),
            .init(key: "s", value: .string("hello")),
            .init(key: "a", value: .array([.number(.integer(1)), .string("two")])),
            .init(key: "o", value: .object(OrderedJSONObject(entries: [
                .init(key: "k", value: .string("v"))
            ]))),
        ])
        let canonical = try JSONValue.object(bag).canonicalJSONString()
        XCTAssertEqual(canonical,
                       #"{"a":[1,"two"],"b":true,"d":3.14,"i":42,"n":null,"o":{"k":"v"},"s":"hello"}"#)

        // Round-trip through Data and assert idempotence.
        let reparsed = try JSONValue(decoding: Data(canonical.utf8))
        let canonical2 = try reparsed.canonicalJSONString()
        XCTAssertEqual(canonical, canonical2)
    }
}
