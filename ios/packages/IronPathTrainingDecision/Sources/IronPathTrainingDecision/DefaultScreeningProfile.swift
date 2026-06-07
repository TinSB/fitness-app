// PA-S3 — DEFAULT_SCREENING_PROFILE data port (pure data, read-only).
//
// Faithful 1:1 Swift transcription of `retired web reference`. Built on the PA-S1 `ScreeningProfile` Domain type;
// `postureFlags` / `movementFlags` / `adaptiveState` are carried as raw JSONValue
// objects exactly as the Domain type models them.
//
// ZERO CLOCK: `adaptiveState.lastUpdated` is the EMPTY STRING `''` (defaults.ts:79),
// NOT a date — reproduced verbatim as `.string("")`. There is no `Date()` /
// ISO8601 / clock anywhere in this constant.
//
// Pure data: no runtime logic, no write path, no `: Date`, no clock.

import Foundation
import IronPathDomain

extension DefaultTrainingData {

    // MARK: - DEFAULT_SCREENING_PROFILE (defaults.ts:47-81)

    public static let defaultScreeningProfile: ScreeningProfile = ScreeningProfile(
        userId: "local-user",
        painTriggers: [],
        restrictedExercises: [],
        correctionPriority: ["upper_crossed", "scapular_control", "core_control"],
        // postureFlags (defaults.ts:49-55)
        postureFlags: .object(OrderedJSONObject(entries: [
            .init(key: "forwardHead", value: .string("mild")),
            .init(key: "roundedShoulders", value: .string("moderate")),
            .init(key: "thoracicKyphosis", value: .string("mild")),
            .init(key: "anteriorPelvicTilt", value: .string("none")),
            .init(key: "dynamicKneeValgus", value: .string("none")),
        ])),
        // movementFlags (defaults.ts:56-69)
        movementFlags: .object(OrderedJSONObject(entries: [
            .init(key: "overheadMobility", value: .string("limited")),
            .init(key: "squatPattern", value: .string("good")),
            .init(key: "hingePattern", value: .string("good")),
            .init(key: "singleLegStability", value: .string("limited")),
            .init(key: "scapularControl", value: .string("limited")),
            .init(key: "trunkStability", value: .string("limited")),
            .init(key: "ankleMobility", value: .string("limited")),
            .init(key: "thoracicRotation", value: .string("limited")),
            .init(key: "hipFlexorLength", value: .string("limited")),
            .init(key: "lumbarControl", value: .string("good")),
            .init(key: "ribCagePosition", value: .string("limited")),
            .init(key: "verticalPressTolerance", value: .string("limited")),
        ])),
        // adaptiveState (defaults.ts:73-80) — empty maps/arrays + EMPTY-STRING lastUpdated.
        adaptiveState: .object(OrderedJSONObject(entries: [
            .init(key: "issueScores", value: .object(OrderedJSONObject())),
            .init(key: "painByExercise", value: .object(OrderedJSONObject())),
            .init(key: "performanceDrops", value: .array([])),
            .init(key: "improvingIssues", value: .array([])),
            .init(key: "moduleDose", value: .object(OrderedJSONObject())),
            .init(key: "lastUpdated", value: .string("")),
        ]))
    )
}
