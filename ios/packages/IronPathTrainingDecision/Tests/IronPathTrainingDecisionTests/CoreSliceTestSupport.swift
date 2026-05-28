// iOS-4B2 — shared test support for the TrainingDecision core-slice tests.
//
// Builds synthetic engine inputs IN MEMORY: a hand-constructed AppData (history
// at deterministic gap dates + optional mesocyclePlan) is run through the real
// IronPathDataHealth buildCleanAppDataView, then minted into a branded
// CleanTrainingDecisionInput via the package factory. This exercises the genuine
// clean-input boundary (RAW AppData never reaches the engine) and is fully
// deterministic — every date derives from the fixed parity clock string, never
// from `Date()`. NO makeAppData/synthetic-AppData JSON is committed (no local-user
// PII can leak), matching the iOS-4B0 privacy convention.

import Foundation
import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

enum CoreSliceTestKit {
    /// The pinned parity clock (parityGolden.deterministicClockIso for every
    /// expanded training-decision golden). referenceDate = first 10 chars.
    static let deterministicClockIso = "2026-05-27T10:00:00.000Z"
    static let referenceDateOnly = "2026-05-27"

    static let utc = TimeZone(identifier: "UTC")!

    static var utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = utc
        return c
    }()

    /// `referenceDateOnly` minus `gap` days, as a `yyyy-MM-dd` string. Derived
    /// from the fixed reference string — deterministic, no system clock.
    static func dateOnly(daysBefore gap: Int) -> String {
        let parts = referenceDateOnly.split(separator: "-")
        var comps = DateComponents()
        comps.year = Int(parts[0])
        comps.month = Int(parts[1])
        comps.day = Int(parts[2])
        comps.hour = 12
        let base = utcCalendar.date(from: comps)!
        let target = utcCalendar.date(byAdding: .day, value: -gap, to: base)!
        let fmt = DateFormatter()
        fmt.timeZone = utc
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: target)
    }

    /// The fixed clock for buildCleanAppDataView (only affects stale diagnostics,
    /// which 4B2 does not assert — kept fixed for hygiene).
    static var fixedClock: FixedRuntimeGuardClock {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fmt.timeZone = utc
        return FixedRuntimeGuardClock(fmt.date(from: deterministicClockIso)!)
    }

    /// A completed analytics session at `gap` days before the reference date.
    static func session(id: String, gap: Int, completed: Bool = true, dataFlag: String? = nil) -> TrainingSession {
        var unknown = OrderedJSONObject()
        if let dataFlag {
            unknown = OrderedJSONObject(entries: [.init(key: "dataFlag", value: .string(dataFlag))])
        }
        return TrainingSession(id: id, date: dateOnly(daysBefore: gap), completed: completed, _unknown: unknown)
    }

    /// A standard 4-week mesocyclePlan JSONValue (base/build/overload/deload).
    static func standardWeeksJSON() -> JSONValue {
        func week(_ phase: String, _ vol: Double, _ bias: String) -> JSONValue {
            .object(OrderedJSONObject(entries: [
                .init(key: "phase", value: .string(phase)),
                .init(key: "volumeMultiplier", value: .number(.double(vol))),
                .init(key: "intensityBias", value: .string(bias)),
            ]))
        }
        return .array([
            week("base", 0.9, "normal"),
            week("build", 1.0, "normal"),
            week("overload", 1.1, "aggressive"),
            week("deload", 0.6, "conservative"),
        ])
    }

    /// Build an in-memory AppData from session JSONValues (+ optional plan).
    static func makeAppData(sessions: [TrainingSession], mesocyclePlan: JSONValue? = nil) -> AppData {
        var entries: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
            .init(key: "history", value: .array(sessions.map { $0.encoded() })),
        ]
        if let mesocyclePlan {
            entries.append(.init(key: "mesocyclePlan", value: mesocyclePlan))
        }
        return AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
    }

    /// AppData → real CleanAppDataView (fixed clock).
    static func cleanView(sessions: [TrainingSession], mesocyclePlan: JSONValue? = nil) -> CleanAppDataView {
        buildCleanAppDataView(makeAppData(sessions: sessions, mesocyclePlan: mesocyclePlan), clock: fixedClock)
    }

    /// Full path: synthetic AppData → CleanAppDataView → branded clean input.
    static func makeCleanInput(
        gap: Int,
        acutePainReported: Bool = false,
        injuryFlag: Bool = false,
        illnessFlag: Bool = false,
        explicitDeloadAssigned: Bool = false,
        mesocyclePlan: JSONValue? = nil
    ) -> CleanTrainingDecisionInput {
        // Two analytics sessions: the latest at `gap`, an older one 7 days prior.
        let sessions = [
            session(id: "td-late", gap: gap),
            session(id: "td-early", gap: gap + 7),
        ]
        let view = cleanView(sessions: sessions, mesocyclePlan: mesocyclePlan)
        let metadata = CleanTrainingDecisionInputMetadata(
            nowIso: deterministicClockIso,
            trainingMode: "hybrid",
            acutePainReported: acutePainReported,
            injuryFlag: injuryFlag,
            illnessFlag: illnessFlag,
            explicitDeloadAssigned: explicitDeloadAssigned
        )
        return createCleanTrainingDecisionInput(cleanView: view, metadata: metadata)
    }
}
