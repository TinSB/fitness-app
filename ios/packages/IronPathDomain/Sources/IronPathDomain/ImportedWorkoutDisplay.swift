// ImportedWorkoutDisplay — 记录 (History) imported-workout detail projection V1.
//
// Pure, IO-free, Date-free display projection of an Apple-Health-imported workout's
// rich fields for the 记录 "来自 Apple 健康" row. The HK-2 / HK-2b import already
// carries duration / distance / active energy / avg + max heart rate on
// `ImportedWorkoutSample` (every value a `NumberRepr` — never a `Date`, §9); this
// leaf converts each to a display-ready `Double`, present ONLY when the import
// actually recorded it (an absent field stays `nil` — the surface omits it honestly,
// never a fabricated 0), and projects distance metres → kilometres via a pure
// `Double` conversion.
//
// 100% pure value logic — NO IO, NO ambient clock, NO AppData, NO mutation, and NO
// Date (AppData instants are ISO-8601 strings end-to-end, §9; this leaf never types a
// `Date` — every field here is a metric `Double`). It only READS an already-resolved
// sample's fields; it never reorders, edits, or fabricates a row, and is purely
// ADDITIVE: it does NOT change the unified timeline's `make` / `filtered` / order or
// the #446 `searchableText` / source filter (the entry accessor below defaults to a
// no-op for native rows). Foundation only (Domain is the leaf, §6.3). The thin
// SwiftUI surface formats each present field (单位 / 取整); this type only SELECTS
// which numbers are present and converts distance to km.

import Foundation

/// Display-ready projection of an imported workout's rich fields (HK-2 / HK-2b), for
/// the 记录 "来自 Apple 健康" row. Each field is the import's value as a `Double`,
/// present ONLY when the import recorded it; distance is projected to KILOMETRES.
/// NO `Date` — every field is a metric `Double` (§9: the Domain leaf never types a
/// `Date`; instants stay ISO-8601 strings, which this projection does not carry).
public struct ImportedWorkoutDisplayFields: Equatable, Sendable {
    /// Workout duration in minutes, when the import recorded it.
    public let durationMin: Double?
    /// Distance in KILOMETRES (metres → km, pure conversion), when recorded.
    public let distanceKm: Double?
    /// Active energy in kilocalories, when recorded.
    public let activeEnergyKcal: Double?
    /// Average heart rate in bpm, when recorded.
    public let avgHeartRate: Double?
    /// Maximum heart rate in bpm, when recorded.
    public let maxHeartRate: Double?

    public init(
        durationMin: Double? = nil,
        distanceKm: Double? = nil,
        activeEnergyKcal: Double? = nil,
        avgHeartRate: Double? = nil,
        maxHeartRate: Double? = nil
    ) {
        self.durationMin = durationMin
        self.distanceKm = distanceKm
        self.activeEnergyKcal = activeEnergyKcal
        self.avgHeartRate = avgHeartRate
        self.maxHeartRate = maxHeartRate
    }

    /// Project the display fields from an imported sample. Pure; a field the import
    /// did NOT record stays `nil` (honest omission — never a fabricated 0). Distance
    /// is converted metres → kilometres; duration / energy / heart rate carry through
    /// as their recorded `Double`.
    public init(_ sample: ImportedWorkoutSample) {
        self.durationMin = sample.durationMin?.doubleValue
        self.distanceKm = sample.distanceMeters.map { Self.kilometresFromMetres($0.doubleValue) }
        self.activeEnergyKcal = sample.activeEnergyKcal?.doubleValue
        self.avgHeartRate = sample.avgHeartRate?.doubleValue
        self.maxHeartRate = sample.maxHeartRate?.doubleValue
    }

    /// True when the import recorded NONE of the rich fields — the row shows only its
    /// workout label, no detail line (the honest "nothing to show" signal).
    public var isEmpty: Bool {
        durationMin == nil
            && distanceKm == nil
            && activeEnergyKcal == nil
            && avgHeartRate == nil
            && maxHeartRate == nil
    }

    /// Pure metres → kilometres display conversion (1 km = 1000 m). No rounding — the
    /// surface chooses the display precision. A pure `Double` function, never a `Date`.
    public static func kilometresFromMetres(_ metres: Double) -> Double {
        metres / 1000
    }
}

public extension CompletedTrainingEntry {
    /// The imported workout's display-ready rich fields (duration / distance (km) /
    /// active energy / avg + max heart rate), or `nil` for a native row. Purely
    /// ADDITIVE: a native entry returns `nil`, so the existing row rendering and the
    /// #446 `searchableText` + source filter are unchanged. Pure, display-only — it
    /// never mutates, reorders, or fabricates a row.
    var importedDisplayFields: ImportedWorkoutDisplayFields? {
        switch self {
        case .native:
            return nil
        case .imported(let workout):
            return ImportedWorkoutDisplayFields(workout)
        }
    }
}
