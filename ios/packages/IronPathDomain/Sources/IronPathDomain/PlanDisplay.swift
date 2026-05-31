// PlanDisplay — Plan real-AppData read path V1.
//
// Pure, deterministic plan read-model derived from the two Domain plan value types
// (`MesocyclePlan` + `ProgramTemplate`). Foundation-only, no IO. The DataHealth
// resolver builds this from a `CleanAppDataView`'s raw plan slots; the thin app
// layer renders it. Mirrors `ProfileDisplayData` (data holder + `make` + the
// honest-empty `hasAnyContent`).
//
// Field selection mirrors the existing plan surface (`PlanSurfaceSummary`):
//   • Mesocycle: phase, week count (count of the `weeks` array), date range.
//   • Program: primary goal, split type, days/week.
//   • Strategy presence (correction/functional) as collapsed booleans.
//
// nil / blank scalars are DROPPED so the surface stays calm; an all-empty plan
// yields `hasAnyContent == false` and the resolver renders the empty state.

import Foundation

public struct PlanDisplay: Equatable, Sendable {
    // Mesocycle (cycle)
    public let phase: String?
    public let weekCount: Int?
    public let startDate: String?
    public let endDate: String?
    // Program template
    public let primaryGoal: String?
    public let splitType: String?
    public let daysPerWeek: Int?
    // Strategy presence (collapsed booleans)
    public let hasCorrectionStrategy: Bool
    public let hasFunctionalStrategy: Bool

    public init(
        phase: String?,
        weekCount: Int?,
        startDate: String?,
        endDate: String?,
        primaryGoal: String?,
        splitType: String?,
        daysPerWeek: Int?,
        hasCorrectionStrategy: Bool,
        hasFunctionalStrategy: Bool
    ) {
        self.phase = phase
        self.weekCount = weekCount
        self.startDate = startDate
        self.endDate = endDate
        self.primaryGoal = primaryGoal
        self.splitType = splitType
        self.daysPerWeek = daysPerWeek
        self.hasCorrectionStrategy = hasCorrectionStrategy
        self.hasFunctionalStrategy = hasFunctionalStrategy
    }

    /// True when the plan has any user-meaningful content to show. Drives the honest
    /// empty state (master §15.4): a loaded-but-empty document (first launch / no plan
    /// yet) has nothing to show, so the surface renders its empty state instead of a
    /// page of placeholders. Mirrors `ProfileDisplayData.hasAnyContent`.
    public var hasAnyContent: Bool {
        phase != nil
            || weekCount != nil
            || startDate != nil
            || endDate != nil
            || primaryGoal != nil
            || splitType != nil
            || daysPerWeek != nil
            || hasCorrectionStrategy
            || hasFunctionalStrategy
    }

    /// Pure extraction from the two Domain plan value types (read from a cleaned
    /// AppData view's raw slots by the DataHealth resolver). Mirrors
    /// `ProfileDisplayData.make`.
    public static func make(mesocycle: MesocyclePlan, program: ProgramTemplate) -> PlanDisplay {
        PlanDisplay(
            phase: cleaned(mesocycle.phase),
            weekCount: weekCountValue(from: mesocycle.weeks),
            startDate: cleaned(mesocycle.startDate),
            endDate: cleaned(mesocycle.endDate),
            primaryGoal: cleaned(program.primaryGoal),
            splitType: cleaned(program.splitType),
            daysPerWeek: program.daysPerWeek.map { Int($0.doubleValue.rounded()) },
            hasCorrectionStrategy: isConfiguredStrategy(program.correctionStrategy),
            hasFunctionalStrategy: isConfiguredStrategy(program.functionalStrategy)
        )
    }

    /// Trimmed free-text; blank or nil → nil (the field is dropped, not shown empty).
    private static func cleaned(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }

    /// Number of planned weeks = count of the `weeks` JSON array; nil when `weeks`
    /// is absent, not an array, or empty.
    private static func weekCountValue(from weeks: JSONValue?) -> Int? {
        guard let array = weeks?.arrayValue, !array.isEmpty else { return nil }
        return array.count
    }

    /// A strategy is "configured" iff it is a non-empty JSON object; an empty `{}`,
    /// a non-object value, or an absent value is treated as not configured.
    private static func isConfiguredStrategy(_ value: JSONValue?) -> Bool {
        guard let object = value?.objectValue else { return false }
        return !object.entries.isEmpty
    }
}
