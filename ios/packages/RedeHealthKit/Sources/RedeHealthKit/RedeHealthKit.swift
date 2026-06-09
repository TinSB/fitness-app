// RedeHealthKit — HK-1 HealthKit Body-Weight Import V1.
//
// Activated from the iOS-1 inert stub into an APPROVED, BOUNDED, READ-ONLY
// Apple-Health adapter (master §6.2/§17/§18, amended by HK-1). The package owns:
//   • `BodyMassReading` + `BodyMassSampleSource` — the injectable value/protocol
//     seam, so the mapping logic is a pure function testable without HealthKit.
//   • `HealthKitBodyMassMapper` — pure `BodyMassReading` → `RedeDomain.HealthMetricSample`.
//   • `HealthKitBodyMassImporter` — authorize → read latest → map (uses the seam).
//   • `HealthKitBodyMassSource` — the ONLY file that `import`s HealthKit and uses
//     `HKHealthStore`/`HKQuantityType`, compiled `#if os(iOS)` (device/simulator
//     only; host `swift test` never builds it). READ-ONLY: it requests read
//     authorization and reads the latest body-mass sample — it NEVER writes back
//     to Apple Health (write-back is the deferred HK-3 slice).
//
// HARD BOUNDARIES (still enforced): no network/cloud/account; HealthKit data
// NEVER leaves the device; the gated write into canonical AppData is done by the
// app via `RedePersistence.CanonicalSessionWriter` (the iOS-17A paradigm),
// not here. Weight stays kilograms (the UnitSettings contract).

/// Retained for the iOS-1 bootstrap parity probe (`RedeLinkedPackages.versions`).
/// The constant is the link-graph proof only; it is orthogonal to the package's
/// HK-1 activation above.
public enum RedeHealthKitVersion {
    public static let value = "0.0.1-bootstrap"
}
