// ProfileDisplayData — Profile real-AppData read path V1.
//
// Pure, deterministic read-model for the 我的 (Profile) surface, computed from a
// CLEANED canonical AppData (the document that has already passed through
// DataHealth `buildCleanAppDataView`, §10). It carries the four read-only Domain
// values the surface renders (UserProfile / UnitSettings / ScreeningProfile /
// AppSettings) plus the DERIVED "latest body weight" — the first native
// canonical READ-for-display of the profile area, mirroring the Today read path
// (`resolveTodayReadinessState`). It is a pure value type: no IO, no clock, no
// AppData mutation — the app layer does the disk read + clean-view build and feeds
// the cleaned pieces in. The thin SwiftUI surface still formats every field via
// `ProfileDisplay` (so formatting stays one place); this type only selects WHICH
// real values to show and answers the honest empty-state question.
//
// === latest body weight (derived, NOT the engine) ===
// HK-1 stores Apple-Health body weight as a `HealthMetricSample
// { metricType: "body_weight", unit: "kg" }` in `AppData.healthMetricSamples`; the
// import NEVER writes `userProfile.weightKg` (the user's self-entered field). The
// legacy web app derives "current body weight" as the latest such sample
// (`retired web reference` → `latestBodyWeightKg`). The native engine
// does NOT port `healthSummaryEngine`, so — as scoped for this read-only slice —
// the latest sample is selected DIRECTLY here for display (not via the unported
// engine). The selection mirrors the legacy web schema rule: among `body_weight` samples that are
// not `dataFlag == "excluded"`, take the one with the greatest ISO-8601 `startDate`
// and normalize its value to kg (a `lb`-unit reading is converted via the single
// `WeightConversion` home; `kg`/absent is taken as-is — HK-1 always writes kg).
// ⚠️ DO NOT add IO/persistence here (Domain is the Foundation-only leaf, §6.3).

import Foundation

/// Read-only profile read-model rendered by `ProfileRootView`. Built from a cleaned
/// canonical AppData by the DataHealth-side resolver (`resolveProfileDisplayState`),
/// never from raw AppData directly (§10). `Equatable`/`Sendable` so it can ride
/// inside the rendered `ProfileDisplayState`.
public struct ProfileDisplayData: Equatable, Sendable {
    /// The user's self-entered profile. `weightKg` here is the SELF-ENTERED weight —
    /// distinct from `latestBodyWeightKg` (the Apple-Health-derived reading).
    public let profile: UserProfile
    /// Display-unit preferences (storage stays kg; this only drives presentation).
    public let unitSettings: UnitSettings
    /// Screening profile — the DataHealth-CLEANED projection (capped issueScores /
    /// filtered performanceDrops); the displayed trigger/restriction/priority lists
    /// are unaffected by cleaning but are read from the clean view all the same.
    public let screening: ScreeningProfile
    /// App settings (training mode / selected template / readiness-health flag).
    public let appSettings: AppSettings
    /// DERIVED latest Apple-Health body weight in kilograms (HK-1), or nil when none
    /// has been imported. NOT `profile.weightKg` — this is the latest `body_weight`
    /// sample from the health-metric time series, selected for display (see header).
    public let latestBodyWeightKg: Double?

    public init(
        profile: UserProfile,
        unitSettings: UnitSettings,
        screening: ScreeningProfile,
        appSettings: AppSettings,
        latestBodyWeightKg: Double?
    ) {
        self.profile = profile
        self.unitSettings = unitSettings
        self.screening = screening
        self.appSettings = appSettings
        self.latestBodyWeightKg = latestBodyWeightKg
    }

    /// Build the read-model from the cleaned pieces a caller pulled out of a
    /// DataHealth clean view. `screening` should be the view's CLEANED screening and
    /// the scalars its `raw` fields (which carry no cleaning guards); `samples` is the
    /// raw `healthMetricSamples` time series the latest body weight is derived from.
    public static func make(
        profile: UserProfile,
        unitSettings: UnitSettings,
        screening: ScreeningProfile,
        appSettings: AppSettings,
        healthMetricSamples: [HealthMetricSample]
    ) -> ProfileDisplayData {
        ProfileDisplayData(
            profile: profile,
            unitSettings: unitSettings,
            screening: screening,
            appSettings: appSettings,
            latestBodyWeightKg: latestBodyWeightKilograms(from: healthMetricSamples)
        )
    }

    /// True when the cleaned document carries ANY user-meaningful profile/baseline
    /// content (a profile field, a unit preference, a screening entry, a real app
    /// setting, or an imported body weight). When false, the surface shows an honest
    /// empty state ("还没有资料/基线") rather than a page of "未设置" placeholders —
    /// never a fabricated profile.
    public var hasAnyContent: Bool {
        if latestBodyWeightKg != nil { return true }
        if Self.profileHasContent(profile) { return true }
        if Self.unitSettingsHasContent(unitSettings) { return true }
        if Self.screeningHasContent(screening) { return true }
        if Self.appSettingsHasContent(appSettings) { return true }
        return false
    }

    // MARK: - Latest body weight (pure derivation)

    /// The metric-type token for Apple-Health body weight (mirrors
    /// `RedeHealthKit.HealthKitBodyMassMapper.metricType` + legacy web schema
    /// `appleHealthTypeMap.ts`). Duplicated here as a plain constant so this pure
    /// Domain logic needs no `RedeHealthKit` edge (Domain stays the leaf, §6.3).
    public static let bodyWeightMetricType = "body_weight"

    /// Latest body weight in kilograms, derived from the health-metric time series
    /// (see header). Returns nil when there is no usable `body_weight` sample.
    public static func latestBodyWeightKilograms(from samples: [HealthMetricSample]) -> Double? {
        let candidates = samples.filter { sample in
            sample.metricType == bodyWeightMetricType
                && (sample.dataFlag ?? "") != "excluded"
                && sample.startDate != nil
                && sample.value != nil
        }
        // Greatest ISO-8601 startDate == most recent (mirrors the legacy web schema descending
        // `startDate.localeCompare` sort + `[0]`); ties keep the first in order.
        guard let latest = candidates.max(by: { ($0.startDate ?? "") < ($1.startDate ?? "") }),
              let value = latest.value?.doubleValue
        else { return nil }
        // Normalize to kg (mirror `normalizeBodyWeightKg`). HK-1 always writes "kg",
        // but a `lb`-unit reading from any other origin is converted via the single
        // WeightConversion home so there is no unit drift.
        if (latest.unit ?? "").lowercased().contains("lb") {
            return WeightConversion.toKilograms(value, from: .lb)
        }
        return value
    }

    // MARK: - Per-source emptiness (documented fields only)

    private static func profileHasContent(_ p: UserProfile) -> Bool {
        p.id != nil || p.name != nil || p.sex != nil || p.age != nil
            || p.heightCm != nil || p.weightKg != nil || p.trainingLevel != nil
            || p.primaryGoal != nil || p.weeklyTrainingDays != nil || p.sessionDurationMin != nil
            || !(p.injuryFlags ?? []).isEmpty || !(p.painNotes ?? []).isEmpty
    }

    private static func unitSettingsHasContent(_ u: UnitSettings) -> Bool {
        u.weightUnit != nil || u.displayUnit != nil
    }

    private static func screeningHasContent(_ s: ScreeningProfile) -> Bool {
        s.userId != nil
            || !(s.painTriggers ?? []).isEmpty
            || !(s.restrictedExercises ?? []).isEmpty
            || !(s.correctionPriority ?? []).isEmpty
            || s.postureFlags != nil || s.movementFlags != nil || s.adaptiveState != nil
    }

    /// Only the user-meaningful settings count toward "has content" — internal
    /// bookkeeping (schemaVersion, DataHealth ledgers) must not make an otherwise
    /// profile-less document look populated.
    private static func appSettingsHasContent(_ a: AppSettings) -> Bool {
        a.selectedTemplateId != nil || a.trainingMode != nil || a.useHealthDataForReadiness != nil
    }
}
