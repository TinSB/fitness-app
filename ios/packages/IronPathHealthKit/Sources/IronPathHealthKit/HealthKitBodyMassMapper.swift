// HealthKitBodyMassMapper — HK-1 HealthKit Body-Weight Import V1.
//
// PURE mapping: one `BodyMassReading` → one canonical
// `IronPathDomain.HealthMetricSample`. No HealthKit import, no IO, no clock
// (timestamps are injected), so `swift test` exercises every rule with sample
// readings. Mirrors the TypeScript importer at `src/engines/healthImportEngine.ts`
// + `src/engines/appleHealthTypeMap.ts`: body mass → metricType "body_weight",
// unit "kg", value clamped at >= 0, source "apple_health_export", a
// content-addressed id for idempotent re-import, and dataFlag "normal".

import Foundation
import IronPathDomain

public enum HealthKitBodyMassMapper {
    /// Domain metric type for body weight (TS `HealthMetricType` = "body_weight";
    /// `HKQuantityTypeIdentifierBodyMass` maps here in `appleHealthTypeMap.ts`).
    public static let metricType = "body_weight"

    /// HealthKit-origin samples normalize to the contract's `apple_health_export`
    /// `HealthDataSource` (TS `normalizeHealthDataSource('healthkit')`).
    public static let source = "apple_health_export"

    /// Storage unit is always kilograms (UnitSettings contract).
    public static let unit = "kg"

    /// Shared ISO-8601 formatter — internet date-time with fractional seconds,
    /// matching every other timestamp in the codebase (e.g. "2026-05-27T06:30:00.000Z").
    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// ISO-8601 string for `date` in the canonical format.
    public static func isoString(_ date: Date) -> String { isoFormatter.string(from: date) }

    /// Map one body-mass reading into a canonical `HealthMetricSample`.
    ///
    /// - `value` is `max(0, kilograms)` (parity with the TS importer's
    ///   `Math.max(0, value)`), carried in kg with `unit == "kg"`.
    /// - `id` is content-addressed (`health-<hash>` over source/metric/start/value/unit)
    ///   so re-importing the same reading dedups in
    ///   `AppData.appendingHealthMetricSample`.
    /// - `metricType`, `source`, `dataFlag` are fixed per the contract; provenance
    ///   names are preserved when the reading carries them.
    public static func sample(
        from reading: BodyMassReading,
        importedAt: Date,
        batchId: String? = nil
    ) -> HealthMetricSample {
        let startIso = isoString(reading.startDate)
        let kg = max(0, reading.kilograms)
        let contentKey = "\(source):\(metricType):\(startIso):\(kg):\(unit)"
        return HealthMetricSample(
            id: "health-" + stableHash(contentKey),
            source: source,
            sourceName: reading.sourceName,
            deviceSourceName: reading.deviceSourceName,
            metricType: metricType,
            startDate: startIso,
            value: .double(kg),
            unit: unit,
            importedAt: isoString(importedAt),
            batchId: batchId,
            dataFlag: "normal"
        )
    }

    /// Deterministic content hash for the dedup id. Mirrors the TS importer's
    /// `hashText` (UTF-16 code unit, 31-multiplier rolling hash, uint32 wraparound,
    /// base-36) at `src/engines/healthImportEngine.ts`. Native AppData never leaves
    /// the device, so exact PWA byte-parity is not a contract requirement — the
    /// id's job is intra-device idempotency, and it is stable for a given reading.
    static func stableHash(_ text: String) -> String {
        var hash: UInt32 = 0
        for unit in text.utf16 {
            hash = hash &* 31 &+ UInt32(unit)
        }
        return String(hash, radix: 36)
    }
}
