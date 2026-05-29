// FocusModePreviewData — iOS-6 Focus Mode Sample Selector V1.
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
// iOS-6 adds a scenario dimension. Three scenarios drive the same engine
// pipeline with different deterministic inputs:
//   .normal           — recent history (2d / 9d), no acute pain -> base/normal-session.
//   .productiveFloor  — long gap (34d / 20d), no acute pain -> reentry phase,
//                       reentryProductive intent. Compound role floors stay at 2,
//                       so compounds do NOT all collapse to 1 set.
//   .severeRest       — recent history (5d / 2d) + acutePainReported=true ->
//                       severeRest intent. Conservative path; compounds may show 1 set.

import Foundation
import IronPathDomain
import IronPathDataHealth
import IronPathTrainingDecision

enum FocusModeSampleScenario: String, CaseIterable, Identifiable {
    case normal
    case productiveFloor
    case severeRest
    case deloadWeek

    var id: String { rawValue }

    var displayLabel: String {
        switch self {
        case .normal: return "普通训练 / Normal"
        case .productiveFloor: return "回归保底 / Productive Floor"
        case .severeRest: return "严重恢复 / Severe Rest"
        case .deloadWeek: return "减载周 / Deload Week"
        }
    }

    var shortLabel: String {
        switch self {
        case .normal: return "普通"
        case .productiveFloor: return "回归保底"
        case .severeRest: return "严重恢复"
        case .deloadWeek: return "减载周"
        }
    }

    var explanation: String {
        switch self {
        case .normal:
            return "普通训练样例"
        case .productiveFloor:
            return "回归/恢复训练下，复合动作仍保留最低有效组数"
        case .severeRest:
            return "严重恢复压力下，1 组保守路径是允许的"
        case .deloadWeek:
            return "显式减载周：explicitDeloadAssigned=true 触发 deload-week 意图"
        }
    }
}

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

    /// Returns the (later, earlier) day-gaps that drive the scenario.
    /// Larger gap => later session more days ago.
    private static func sessionGaps(for scenario: FocusModeSampleScenario) -> (late: Int, early: Int) {
        switch scenario {
        case .normal:          return (late: 2, early: 9)
        case .productiveFloor: return (late: 20, early: 34)
        case .severeRest:      return (late: 2, early: 5)
        case .deloadWeek:      return (late: 2, early: 9)
        }
    }

    private static func sampleAppData(for scenario: FocusModeSampleScenario) -> AppData {
        let gaps = sessionGaps(for: scenario)
        let history: [JSONValue] = [
            sampleSession(id: "td-late", daysBefore: gaps.late).encoded(),
            sampleSession(id: "td-early", daysBefore: gaps.early).encoded(),
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

    static func sampleCoreSlice(for scenario: FocusModeSampleScenario) -> TrainingDecisionCoreSlice {
        let cleanView = buildCleanAppDataView(sampleAppData(for: scenario), clock: fixedClock())
        let acutePain: Bool? = (scenario == .severeRest) ? true : nil
        // .deloadWeek is a pure input-shape change (no engine change): the
        // metadata flag flows through sessionIntentFor to produce
        // sessionIntent == .deloadWeek.
        let explicitDeload: Bool? = (scenario == .deloadWeek) ? true : nil
        let input = createCleanTrainingDecisionInput(
            cleanView: cleanView,
            metadata: CleanTrainingDecisionInputMetadata(
                nowIso: referenceClockIso,
                trainingMode: "hybrid",
                acutePainReported: acutePain,
                explicitDeloadAssigned: explicitDeload,
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
