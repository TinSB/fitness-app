// iOS-4B2/4B3 — shared test support for the TrainingDecision core-slice tests.
//
// Builds synthetic engine inputs IN MEMORY: a hand-constructed AppData (history at
// deterministic gap dates + todayStatus + optional weighted sessions / health
// samples) is run through the real IronPathDataHealth buildCleanAppDataView, then
// minted into a branded CleanTrainingDecisionInput via the package factory. This
// exercises the genuine clean-input boundary (RAW AppData never reaches the engine)
// and is fully deterministic — every date derives from the fixed parity clock
// string, never from `Date()`. NO makeAppData/synthetic-AppData JSON is committed
// (no local-user PII can leak), matching the iOS-4B0 privacy convention.

import Foundation
import XCTest
import IronPathDomain
import IronPathDataHealth
@testable import IronPathTrainingDecision

enum CoreSliceTestKit {
    static let deterministicClockIso = "2026-05-27T10:00:00.000Z"
    static let referenceDateOnly = "2026-05-27"

    static let utc = TimeZone(identifier: "UTC")!

    static var utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = utc
        return c
    }()

    /// `referenceDateOnly` minus `gap` days, as `yyyy-MM-dd`. Deterministic.
    static func dateOnly(daysBefore gap: Int) -> String {
        let parts = referenceDateOnly.split(separator: "-")
        var comps = DateComponents()
        comps.year = Int(parts[0]); comps.month = Int(parts[1]); comps.day = Int(parts[2]); comps.hour = 12
        let base = utcCalendar.date(from: comps)!
        let target = utcCalendar.date(byAdding: .day, value: -gap, to: base)!
        let fmt = DateFormatter()
        fmt.timeZone = utc; fmt.locale = Locale(identifier: "en_US_POSIX"); fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: target)
    }

    /// Full ISO instant `gap` days before the clock (for health-sample staleness).
    static func isoDaysBefore(_ gap: Int) -> String {
        let parts = referenceDateOnly.split(separator: "-")
        var comps = DateComponents()
        comps.year = Int(parts[0]); comps.month = Int(parts[1]); comps.day = Int(parts[2]); comps.hour = 10
        let base = utcCalendar.date(from: comps)!
        let target = utcCalendar.date(byAdding: .day, value: -gap, to: base)!
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; fmt.timeZone = utc
        return fmt.string(from: target)
    }

    static var fixedClock: FixedRuntimeGuardClock {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; fmt.timeZone = utc
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

    /// A completed session at `gap` days with one exercise whose top set weight is
    /// `topWeight` — used to drive the e1RM trend.
    static func weightedSession(id: String, gap: Int, topWeight: Double) -> TrainingSession {
        let set = TrainingSetLog(weight: .double(topWeight), reps: .integer(6))
        let exercise = ExercisePrescription(id: "\(id)-ex", exerciseId: "bench", name: "Bench", sets: [set])
        return TrainingSession(id: id, date: dateOnly(daysBefore: gap), completed: true, exercises: [exercise])
    }

    /// A completed session at `gap` days carrying a per-session `status` (sleep /
    /// energy) in the `_unknown` carrier — drives the deload poorRecoveryCount path
    /// (adaptiveFeedbackEngine.ts:498). `status` is not a typed TrainingSession field.
    static func sessionWithStatus(id: String, gap: Int, sleep: String? = nil, energy: String? = nil) -> TrainingSession {
        var statusEntries: [OrderedJSONObject.Entry] = []
        if let sleep { statusEntries.append(.init(key: "sleep", value: .string(sleep))) }
        if let energy { statusEntries.append(.init(key: "energy", value: .string(energy))) }
        let unknown = OrderedJSONObject(entries: [
            .init(key: "status", value: .object(OrderedJSONObject(entries: statusEntries))),
        ])
        return TrainingSession(id: id, date: dateOnly(daysBefore: gap), completed: true, _unknown: unknown)
    }

    /// todayStatus JSON. Defaults mirror DEFAULT_STATUS (sleep 一般 / energy 中 /
    /// soreness ['无'] / time 60). `daysAgo` only stamps the date (staleness diag).
    static func todayStatusJSON(
        sleep: String = "一般",
        energy: String = "中",
        soreness: [String] = ["无"],
        time: String = "60",
        daysAgo: Int = 0
    ) -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "sleep", value: .string(sleep)),
            .init(key: "energy", value: .string(energy)),
            .init(key: "soreness", value: .array(soreness.map { .string($0) })),
            .init(key: "time", value: .string(time)),
            .init(key: "date", value: .string(dateOnly(daysBefore: daysAgo))),
        ]))
    }

    /// A single restingHeartRate health sample `daysAgo` days before the clock.
    static func healthSampleJSON(daysAgo: Int) -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "id", value: .string("synthetic-health-1")),
            .init(key: "type", value: .string("restingHeartRate")),
            .init(key: "value", value: .number(.integer(58))),
            .init(key: "unit", value: .string("count/min")),
            .init(key: "startDate", value: .string(isoDaysBefore(daysAgo))),
            .init(key: "endDate", value: .string(isoDaysBefore(daysAgo))),
            .init(key: "source", value: .string("synthetic")),
        ]))
    }

    static func standardWeeksJSON() -> JSONValue {
        func week(_ phase: String, _ vol: Double, _ bias: String) -> JSONValue {
            .object(OrderedJSONObject(entries: [
                .init(key: "phase", value: .string(phase)),
                .init(key: "volumeMultiplier", value: .number(.double(vol))),
                .init(key: "intensityBias", value: .string(bias)),
            ]))
        }
        return .array([
            week("base", 0.9, "normal"), week("build", 1.0, "normal"),
            week("overload", 1.1, "aggressive"), week("deload", 0.6, "conservative"),
        ])
    }

    /// Build an in-memory AppData from sessions (+ optional todayStatus / plan / health).
    static func makeAppData(
        sessions: [TrainingSession],
        todayStatus: JSONValue? = nil,
        mesocyclePlan: JSONValue? = nil,
        healthSamples: [JSONValue] = []
    ) -> AppData {
        var entries: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
            .init(key: "history", value: .array(sessions.map { $0.encoded() })),
        ]
        if let todayStatus { entries.append(.init(key: "todayStatus", value: todayStatus)) }
        if let mesocyclePlan { entries.append(.init(key: "mesocyclePlan", value: mesocyclePlan)) }
        if !healthSamples.isEmpty { entries.append(.init(key: "healthMetricSamples", value: .array(healthSamples))) }
        return AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
    }

    static func cleanView(
        sessions: [TrainingSession],
        todayStatus: JSONValue? = nil,
        mesocyclePlan: JSONValue? = nil,
        healthSamples: [JSONValue] = []
    ) -> CleanAppDataView {
        buildCleanAppDataView(
            makeAppData(sessions: sessions, todayStatus: todayStatus, mesocyclePlan: mesocyclePlan, healthSamples: healthSamples),
            clock: fixedClock
        )
    }

    /// Backwards-compatible simple builder (iOS-4B2): two analytics sessions (latest
    /// at `gap`, an older one 7 days prior), default todayStatus, no weights.
    static func makeCleanInput(
        gap: Int,
        acutePainReported: Bool = false,
        injuryFlag: Bool = false,
        illnessFlag: Bool = false,
        explicitDeloadAssigned: Bool = false,
        templateDurationMin: Double? = 70,
        mesocyclePlan: JSONValue? = nil
    ) -> CleanTrainingDecisionInput {
        let sessions = [session(id: "td-late", gap: gap), session(id: "td-early", gap: gap + 7)]
        let view = cleanView(sessions: sessions, todayStatus: todayStatusJSON())
        return createCleanTrainingDecisionInput(
            cleanView: view,
            metadata: CleanTrainingDecisionInputMetadata(
                nowIso: deterministicClockIso, trainingMode: "hybrid",
                acutePainReported: acutePainReported, injuryFlag: injuryFlag,
                illnessFlag: illnessFlag, explicitDeloadAssigned: explicitDeloadAssigned,
                templateDurationMin: templateDurationMin
            )
        )
    }

    /// iOS-4B3 rich builder: explicit sessions + todayStatus + optional stale health.
    static func makeCleanInput(
        sessions: [TrainingSession],
        sleep: String = "一般",
        energy: String = "中",
        soreness: [String] = ["无"],
        time: String = "60",
        todayStatusDaysAgo: Int = 0,
        acutePainReported: Bool = false,
        injuryFlag: Bool = false,
        illnessFlag: Bool = false,
        explicitDeloadAssigned: Bool = false,
        staleHealthSample: Bool = false,
        templateDurationMin: Double? = 70
    ) -> CleanTrainingDecisionInput {
        let health: [JSONValue] = staleHealthSample ? [healthSampleJSON(daysAgo: 30)] : []
        let view = cleanView(
            sessions: sessions,
            todayStatus: todayStatusJSON(sleep: sleep, energy: energy, soreness: soreness, time: time, daysAgo: todayStatusDaysAgo),
            healthSamples: health
        )
        return createCleanTrainingDecisionInput(
            cleanView: view,
            metadata: CleanTrainingDecisionInputMetadata(
                nowIso: deterministicClockIso, trainingMode: "hybrid",
                acutePainReported: acutePainReported, injuryFlag: injuryFlag,
                illnessFlag: illnessFlag, explicitDeloadAssigned: explicitDeloadAssigned,
                templateDurationMin: templateDurationMin
            )
        )
    }
}
