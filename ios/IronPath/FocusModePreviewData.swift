// FocusModePreviewData — iOS-5 Native Focus Mode Shell V1.
//
// Deterministic, in-memory sample input that feeds the real
// IronPathTrainingDecision engine entry. No Date(), no IO, no AppData mutation,
// no network, no HealthKit, no CloudSync. Identical inputs every launch ->
// identical TrainingDecisionCoreSlice every launch.
//
// Pipeline mirrors the engine's own clean-input contract:
//   AppData (synthesized) -> buildCleanAppDataView -> createCleanTrainingDecisionInput
//   -> buildTrainingDecisionFromCleanInput -> TrainingDecisionCoreSlice
//
// The push-a template + default todayStatus + no mesocycle plan deterministically
// resolve to: activePhase=base, sessionIntent=normal-session, normal volume floors.

import Foundation
import IronPathDomain
import IronPathDataHealth
import IronPathTrainingDecision

enum FocusModePreviewData {

    static let referenceClockIso = "2026-05-27T10:00:00.000Z"
    static let referenceDateOnly = "2026-05-27"

    private static let utc = TimeZone(identifier: "UTC")!

    private static var utcCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = utc
        return c
    }()

    private static func dateOnly(daysBefore gap: Int) -> String {
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

    private static func pushATemplateExercises() -> [TrainingDecisionTemplateExercise] {
        [
            TrainingDecisionTemplateExercise(id: "bench-press", name: "平板卧推", muscle: "胸", kind: "compound", sets: 3, repMin: 6, repMax: 8),
            TrainingDecisionTemplateExercise(id: "incline-db-press", name: "上斜哑铃卧推", muscle: "胸", kind: "compound", sets: 3, repMin: 8, repMax: 10),
            TrainingDecisionTemplateExercise(id: "machine-chest-press", name: "器械推胸", muscle: "胸", kind: "machine", sets: 2, repMin: 8, repMax: 12),
            TrainingDecisionTemplateExercise(id: "cable-fly", name: "绳索夹胸", muscle: "胸", kind: "isolation", sets: 2, repMin: 12, repMax: 15),
            TrainingDecisionTemplateExercise(id: "lateral-raise", name: "哑铃侧平举", muscle: "肩", kind: "isolation", sets: 4, repMin: 12, repMax: 20),
            TrainingDecisionTemplateExercise(id: "triceps-pushdown", name: "绳索下压", muscle: "手臂", kind: "isolation", sets: 3, repMin: 10, repMax: 15),
        ]
    }

    private static func todayStatusJSON() -> JSONValue {
        .object(OrderedJSONObject(entries: [
            .init(key: "sleep", value: .string("一般")),
            .init(key: "energy", value: .string("中")),
            .init(key: "soreness", value: .array([.string("无")])),
            .init(key: "time", value: .string("60")),
            .init(key: "date", value: .string(referenceDateOnly)),
        ]))
    }

    private static func sampleSession(id: String, daysBefore gap: Int) -> TrainingSession {
        TrainingSession(id: id, date: dateOnly(daysBefore: gap), completed: true)
    }

    private static func sampleAppData() -> AppData {
        let history: [JSONValue] = [
            sampleSession(id: "td-late", daysBefore: 2).encoded(),
            sampleSession(id: "td-early", daysBefore: 9).encoded(),
        ]
        let entries: [OrderedJSONObject.Entry] = [
            .init(key: "schemaVersion", value: .number(.integer(Int64(SchemaVersion.current.rawValue)))),
            .init(key: "history", value: .array(history)),
            .init(key: "todayStatus", value: todayStatusJSON()),
        ]
        return AppData(schemaVersion: .current, root: OrderedJSONObject(entries: entries))
    }

    private static func fixedClock() -> FixedRuntimeGuardClock {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        fmt.timeZone = utc
        let date = fmt.date(from: referenceClockIso) ?? Date(timeIntervalSince1970: 0)
        return FixedRuntimeGuardClock(date)
    }

    static func sampleCoreSlice() -> TrainingDecisionCoreSlice {
        let cleanView = buildCleanAppDataView(sampleAppData(), clock: fixedClock())
        let input = createCleanTrainingDecisionInput(
            cleanView: cleanView,
            metadata: CleanTrainingDecisionInputMetadata(
                nowIso: referenceClockIso,
                trainingMode: "hybrid",
                templateDurationMin: 60,
                templateExercises: pushATemplateExercises()
            )
        )
        return buildTrainingDecisionFromCleanInput(input)
    }

    static func sampleTemplateExercises() -> [TrainingDecisionTemplateExercise] {
        pushATemplateExercises()
    }
}
