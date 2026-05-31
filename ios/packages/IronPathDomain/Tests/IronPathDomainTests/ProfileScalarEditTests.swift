// ProfileScalarEditTests — EDIT-1 Profile Scalar Field Edit V1.
//
// REAL unit tests for the pure profile-edit helpers used by the first native
// canonical-AppData EDIT write path:
//   * UserProfile.withScalarFields — replaces the 9 editable scalars, preserves
//     id / injuryFlags / painNotes / the profile's own open bag (_unknown)
//   * AppData.withUpdatedProfile — rewrites ONLY the `userProfile` key, preserves
//     every other top-level key + unknown fields, never bumps schemaVersion, is a
//     pure value transform (no IO), and round-trips through canonical bytes
//   * the edit touches NEITHER healthMetricSamples NOR history (the self-entered
//     userProfile.weightKg is distinct from the Apple-Health-derived samples)
//
// Run via `swift test`. Deterministic; never touches disk/network.

import XCTest
@testable import IronPathDomain

final class ProfileScalarEditTests: XCTestCase {

    // MARK: - UserProfile.withScalarFields

    func testWithScalarFieldsReplacesScalarsAndPreservesNonScalars() {
        let original = UserProfile(
            id: "u1",
            name: "老王",
            sex: "male",
            age: .integer(30),
            heightCm: .integer(178),
            weightKg: .double(80),
            trainingLevel: "beginner",
            primaryGoal: "hypertrophy",
            weeklyTrainingDays: .integer(3),
            sessionDurationMin: .integer(60),
            injuryFlags: ["lower_back"],
            painNotes: ["左膝偶有不适"],
            _unknown: OrderedJSONObject(entries: [
                .init(key: "customProfileKey", value: .string("keepme")),
            ])
        )

        let edited = original.withScalarFields(
            name: "小李",
            sex: "female",
            age: .integer(28),
            heightCm: .integer(165),
            weightKg: .double(58.5),
            trainingLevel: "intermediate",
            primaryGoal: "strength",
            weeklyTrainingDays: .integer(4),
            sessionDurationMin: .integer(75)
        )

        // The 9 editable scalars are replaced.
        XCTAssertEqual(edited.name, "小李")
        XCTAssertEqual(edited.sex, "female")
        XCTAssertEqual(edited.age, .integer(28))
        XCTAssertEqual(edited.heightCm, .integer(165))
        XCTAssertEqual(edited.weightKg, .double(58.5))
        XCTAssertEqual(edited.trainingLevel, "intermediate")
        XCTAssertEqual(edited.primaryGoal, "strength")
        XCTAssertEqual(edited.weeklyTrainingDays, .integer(4))
        XCTAssertEqual(edited.sessionDurationMin, .integer(75))

        // Everything else is preserved verbatim.
        XCTAssertEqual(edited.id, "u1")
        XCTAssertEqual(edited.injuryFlags, ["lower_back"])
        XCTAssertEqual(edited.painNotes, ["左膝偶有不适"])
        XCTAssertEqual(edited._unknown["customProfileKey"]?.stringValue, "keepme")
    }

    func testWithScalarFieldsNilWritesHonestUnset() {
        let original = UserProfile(name: "老王", age: .integer(30), weightKg: .double(80))
        let edited = original.withScalarFields(
            name: nil, sex: nil, age: nil, heightCm: nil, weightKg: nil,
            trainingLevel: nil, primaryGoal: nil, weeklyTrainingDays: nil, sessionDurationMin: nil
        )
        XCTAssertNil(edited.name)
        XCTAssertNil(edited.age)
        XCTAssertNil(edited.weightKg)
        // Encoded form omits the now-nil scalars (honest "not set"), never a 0/"".
        let encoded = edited.encoded()
        guard case .object(let obj) = encoded else { return XCTFail("expected object") }
        XCTAssertNil(obj["name"])
        XCTAssertNil(obj["weightKg"])
    }

    // MARK: - AppData.withUpdatedProfile (open-bag preserving)

    func testWithUpdatedProfileRewritesOnlyUserProfileAndPreservesOpenBag() throws {
        // A document with a profile (carrying its own unknown key), plus history,
        // settings, and a top-level unknown future key.
        let json = """
        {"schemaVersion":8,\
        "userProfile":{"id":"u1","name":"老王","age":30,"customProfileKey":"keepme"},\
        "history":[{"id":"old","completed":true}],\
        "settings":{"weightUnit":"kg"},\
        "futureUnknownKey":{"nested":[1,2,3]}}
        """
        let appData = try AppData(decoding: Data(json.utf8))

        let edited = appData.userProfile.withScalarFields(
            name: "小李", sex: nil, age: .integer(28), heightCm: nil, weightKg: .double(58.5),
            trainingLevel: nil, primaryGoal: nil, weeklyTrainingDays: nil, sessionDurationMin: nil
        )
        let next = appData.withUpdatedProfile(edited)

        // userProfile rewritten with the new scalars.
        XCTAssertEqual(next.userProfile.name, "小李")
        XCTAssertEqual(next.userProfile.age, .integer(28))
        XCTAssertEqual(next.userProfile.weightKg, .double(58.5))
        // The profile's own id + its own open-bag key survive the edit.
        XCTAssertEqual(next.userProfile.id, "u1")
        XCTAssertEqual(next.userProfile._unknown["customProfileKey"]?.stringValue, "keepme")
        // schemaVersion unchanged (an edit is not a schema change).
        XCTAssertEqual(next.schemaVersion, .current)
        // Every other top-level key + the top-level unknown survive verbatim.
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "old")
        let canonical = try next.canonicalJSONString()
        XCTAssertTrue(canonical.contains("futureUnknownKey"), "top-level unknown dropped: \(canonical)")
        XCTAssertTrue(canonical.contains("\"nested\":[1,2,3]"), "nested unknown lost")
        XCTAssertTrue(canonical.contains("\"settings\":{\"weightUnit\":\"kg\"}"), "settings lost: \(canonical)")
        XCTAssertTrue(canonical.contains("\"customProfileKey\":\"keepme\""), "profile open-bag lost: \(canonical)")
        // Re-decodes cleanly (valid canonical document).
        let reDecoded = try AppData(decoding: next.canonicalJSONData())
        XCTAssertEqual(reDecoded.userProfile.name, "小李")
    }

    func testWithUpdatedProfileAddsKeyWhenAbsent() throws {
        let appData = AppData.emptyCurrent()   // {"schemaVersion":8,"history":[]} — no userProfile
        let profile = UserProfile(name: "新用户", weightKg: .double(70))
        let next = appData.withUpdatedProfile(profile)
        XCTAssertEqual(next.userProfile.name, "新用户")
        XCTAssertEqual(next.userProfile.weightKg, .double(70))
        // history still present + empty; schema unchanged.
        XCTAssertTrue(next.history.isEmpty)
        XCTAssertEqual(next.schemaVersion, .current)
        _ = try next.canonicalJSONData()   // round-trips
    }

    func testWithUpdatedProfileDoesNotMutateReceiver() throws {
        let json = """
        {"schemaVersion":8,"userProfile":{"name":"老王"}}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        _ = appData.withUpdatedProfile(UserProfile(name: "小李"))
        // Value semantics: the original is untouched.
        XCTAssertEqual(appData.userProfile.name, "老王")
    }

    // MARK: - Self-entered weight is distinct from Apple-Health samples

    func testEditTouchesNeitherHealthMetricSamplesNorHistory() throws {
        let json = """
        {"schemaVersion":8,\
        "userProfile":{"name":"老王","weightKg":80},\
        "healthMetricSamples":[{"id":"h1","metricType":"body_weight","unit":"kg","value":72.5,"startDate":"2026-05-27T06:30:00.000Z"}],\
        "history":[{"id":"s1","completed":true}]}
        """
        let appData = try AppData(decoding: Data(json.utf8))
        // Edit ONLY the self-entered userProfile.weightKg.
        let edited = appData.userProfile.withScalarFields(
            name: "老王", sex: nil, age: nil, heightCm: nil, weightKg: .double(78),
            trainingLevel: nil, primaryGoal: nil, weeklyTrainingDays: nil, sessionDurationMin: nil
        )
        let next = appData.withUpdatedProfile(edited)

        // Self-entered weight changed…
        XCTAssertEqual(next.userProfile.weightKg, .double(78))
        // …but the Apple-Health-derived sample is untouched (distinct source).
        XCTAssertEqual(next.healthMetricSamples.count, 1)
        XCTAssertEqual(next.healthMetricSamples.first?.id, "h1")
        XCTAssertEqual(next.healthMetricSamples.first?.value?.doubleValue ?? -1, 72.5, accuracy: 1e-9)
        // And history is untouched.
        XCTAssertEqual(next.history.count, 1)
        XCTAssertEqual(next.history.first?.id, "s1")
    }
}
