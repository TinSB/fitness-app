// BodyMassReading + BodyMassSampleSource — HK-1 HealthKit Body-Weight Import V1.
//
// The injectable seam that keeps the import MAPPING logic a pure, testable
// function with no dependency on the HealthKit framework. The HealthKit-specific
// extraction (HKQuantitySample → these primitives) lives in
// `HealthKitBodyMassSource` (`#if os(iOS)`); everything that consumes a
// `BodyMassReading` is plain value logic that `swift test` can exercise with a
// fake source.

import Foundation

/// One body-mass reading lifted out of HealthKit into a plain, testable value.
/// It carries already-extracted primitives so the mapper needs no HealthKit:
/// the source records the instant + a KILOGRAM value + optional provenance.
public struct BodyMassReading: Equatable, Sendable {
    /// The instant the body-mass sample was recorded (HealthKit `startDate`).
    public let startDate: Date

    /// Body mass in KILOGRAMS. HealthKit unit conversion is done at the source
    /// (`HKQuantity.doubleValue(for: .gramUnit(with: .kilo))`), so this is kg by
    /// construction — consistent with the UnitSettings "storage is always kg" rule.
    public let kilograms: Double

    /// Optional Apple-Health provenance (source app / device names), preserved
    /// verbatim into the sample when present.
    public let sourceName: String?
    public let deviceSourceName: String?

    public init(
        startDate: Date,
        kilograms: Double,
        sourceName: String? = nil,
        deviceSourceName: String? = nil
    ) {
        self.startDate = startDate
        self.kilograms = kilograms
        self.sourceName = sourceName
        self.deviceSourceName = deviceSourceName
    }
}

/// The protocol seam between the pure import logic and the real HealthKit store.
///
/// READ-ONLY by design: it can request READ authorization and read the latest
/// body-mass reading. It exposes NO write capability — writing Rede sessions
/// back to Apple Health is the deferred HK-3 slice, not part of this contract.
public protocol BodyMassSampleSource: Sendable {
    /// Request user authorization to READ body mass from Apple Health. Throws if
    /// authorization could not even be requested (e.g. HealthKit unavailable on
    /// the device). The user granting/denying is their choice; a denial surfaces
    /// as `latestBodyMass()` returning nil, not as a thrown error.
    func requestReadAuthorization() async throws

    /// The most recent body-mass reading, or nil when none exists or read access
    /// was not granted.
    func latestBodyMass() async throws -> BodyMassReading?
}
